import SimplePeer from 'simple-peer';
import { listen } from '@tauri-apps/api/event';
import { IdentityService } from './IdentityService';

export type ConnectionState = 'IDLE' | 'REQUESTING' | 'NEGOTIATING' | 'CONNECTED' | 'FAILED' | 'DISCONNECTED' | 'TERMINATED';

interface P2PConnection {
    peer: InstanceType<typeof SimplePeer> | null;
    state: ConnectionState;
    nodeId: string;
    startTime: number;
    lastError?: string;
    iceStats?: {
        host: number;
        srflx: number;
        relay: number;
    };
    timeoutTimer?: any;
}

export type SignalType = 'offer' | 'answer' | 'candidate' | 'CONNECT_REQUEST' | 'CONNECT_ACCEPT' | 'CONNECT_REJECT' | 'CONNECT_CANCEL';

export interface SignalPayload {
    sender_id: string;
    type_: SignalType;
    sdp?: string;
    candidate?: any;
    fingerprint?: any; // Phase 12
}

export const P2PService = {
    connections: new Map<string, P2PConnection>(), // Map<TargetNodeID, Conn>
    connectionRequests: new Set<string>(), // IDs of peers wanting to connect

    myId: '',
    port: 15432, // Default
    isPortAssigned: false,
    ipResolver: null as ((id: string) => { ip: string, port: number } | undefined) | null,

    // Event Listeners
    signalListeners: [] as ((payload: SignalPayload) => void)[],
    dataListeners: [] as ((data: any, peerId: string) => void)[],
    connectionListeners: [] as ((status: { peerId: string, status: ConnectionState, details?: any }) => void)[],
    portAssignmentListeners: [] as ((port: number) => void)[], // New listener type

    onPortAssigned(callback: (port: number) => void) {
        this.portAssignmentListeners.push(callback);
        // If already assigned, fire immediately
        if (this.isPortAssigned) {
            callback(this.port);
        }
        return () => {
            this.portAssignmentListeners = this.portAssignmentListeners.filter(l => l !== callback);
        };
    },

    async init() {
        const identity = await IdentityService.init();
        this.myId = identity.nodeId;

        // Check environment
        const { isTauri } = await import('../utils/tauriEnv');
        if (!isTauri()) return;

        // Listen for Signals from Rust
        try {
            await listen('PEER_SIGNAL', (event) => {
                const payload = event.payload as SignalPayload;
                this.handleSignal(payload);
            });
        } catch (e) {
            console.warn('[P2P] Failed to listen for signals:', e);
        }
    },

    setIpResolver(resolver: (id: string) => { ip: string, port: number } | undefined) {
        this.ipResolver = resolver;
    },

    // --- STATE MACHINE ACTIONS ---

    /**
     * TRIGGER: User Clicks Connect
     * STATE: IDLE -> REQUESTING
     */
    requestConnection(targetId: string, targetIp: string, port: number) {
        if (this.connections.has(targetId)) {
            const c = this.connections.get(targetId)!;
            if (c.state === 'CONNECTED' || c.state === 'NEGOTIATING') return;
        }

        console.log(`[P2P] Requesting connection to ${targetId}...`);

        // Init State
        this.updateState(targetId, 'REQUESTING');

        // Send Signal
        this.sendSignal(targetId, targetIp, port, 'CONNECT_REQUEST');

        // Start Timeout (Guardrail)
        this.startNegotiationTimeout(targetId);
    },

    /**
     * TRIGGER: User Clicks Accept
     * STATE: REQUESTING (Incoming) -> NEGOTIATING
     */
    acceptConnection(targetId: string) {
        console.log(`[P2P] Accepting connection from ${targetId}`);
        const peerInfo = this.getPeerIP(targetId);
        if (!peerInfo) {
            console.error('[P2P] Cannot accept - Unknown IP');
            return;
        }

        this.connectionRequests.delete(targetId);
        this.updateState(targetId, 'NEGOTIATING');

        this.sendSignal(targetId, peerInfo.ip, peerInfo.port, 'CONNECT_ACCEPT');

        // We are the ANSWERER (Passive) usually, but in this P2P flow, 
        // the INITIATOR (Requestor) will receive ACCEPT and start the Peer.
        // Wait... standard WebRTC: Initiator creates Offer.
        // So Requestor = Initiator. Acceptor = Responder.
        // Requestor sends REQUEST. Responder sends ACCEPT. Requestor gets ACCEPT -> Creates Peer (Initiator).
        // Requestor sends OFFER. Responder gets OFFER -> Creates Peer (Non-Initiator).
    },

    rejectConnection(targetId: string) {
        console.log(`[P2P] Rejecting connection from ${targetId}`);
        const peerInfo = this.getPeerIP(targetId);
        if (peerInfo) {
            this.sendSignal(targetId, peerInfo.ip, peerInfo.port, 'CONNECT_REJECT');
            this.connectionRequests.delete(targetId);
        }
        this.updateState(targetId, 'REJECTED' as ConnectionState); // Custom state implied
    },

    cancelConnection(targetId: string) {
        console.log(`[P2P] Canceling connection to ${targetId}`);
        const peerInfo = this.getPeerIP(targetId);
        if (peerInfo) {
            this.sendSignal(targetId, peerInfo.ip, peerInfo.port, 'CONNECT_CANCEL');
        }
        this.terminateConnection(targetId, 'User Cancelled');
    },

    terminateConnection(targetId: string, reason: string = 'Terminated') {
        const conn = this.connections.get(targetId);
        if (conn) {
            console.log(`[P2P] Terminating ${targetId}: ${reason}`);
            if (conn.peer) {
                try { conn.peer.destroy(); } catch (e) { }
            }
            if (conn.timeoutTimer) clearTimeout(conn.timeoutTimer);
            this.updateState(targetId, 'TERMINATED');
            this.connections.delete(targetId);
        }
        this.notifyConnectionListeners(targetId, 'TERMINATED', { reason });
    },

    // --- SIGNAL HANDLING ---

    handleSignal(payload: SignalPayload) {
        const { sender_id, type_, sdp, candidate } = payload;
        const peerInfo = this.getPeerIP(sender_id);

        if (type_ === 'CONNECT_REQUEST') {
            console.log(`[P2P] Incoming Connection Request from ${sender_id}`);
            this.connectionRequests.add(sender_id);
            this.notifySignalListeners(payload);
            return;
        }

        if (type_ === 'CONNECT_ACCEPT') {
            console.log(`[P2P] Connection Accepted by ${sender_id}`);
            // Transition: REQUESTING -> NEGOTIATING
            // Action: Start WebRTC (Initiator)
            if (peerInfo) {
                this.updateState(sender_id, 'NEGOTIATING');
                this.startPeerSession(sender_id, peerInfo.ip, peerInfo.port, true);
            }
            return;
        }

        if (type_ === 'CONNECT_REJECT') {
            this.terminateConnection(sender_id, 'Rejected by Peer');
            return;
        }

        if (type_ === 'CONNECT_CANCEL') {
            this.terminateConnection(sender_id, 'Cancelled by Peer');
            this.connectionRequests.delete(sender_id);
            return;
        }

        // WebRTC Signals
        if (type_ === 'offer') {
            // Received Offer -> We are the Responder -> Start Peer (Non-Initiator)
            console.log(`[P2P] Received Offer from ${sender_id}`);
            if (!this.connections.has(sender_id)) {
                // If we accepted previously, we should be expecting this.
                // Implicit logic: If we don't have a peer, create one.
                this.updateState(sender_id, 'NEGOTIATING');
                if (peerInfo) {
                    this.startPeerSession(sender_id, peerInfo.ip, peerInfo.port, false);
                } else {
                    console.error("Unknown IP for offer sender");
                    return;
                }
            }
        }

        const conn = this.connections.get(sender_id);
        if (conn && conn.peer) {
            if (sdp) {
                conn.peer.signal({ type: type_ as any, sdp });
            } else if (candidate) {
                conn.peer.signal({ candidate });
            }
        }
    },

    // --- WEBRTC SESSION ---

    startPeerSession(targetId: string, targetIp: string, port: number, initiator: boolean) {
        console.log(`[P2P] Starting WebRTC Session with ${targetId} (Initiator: ${initiator})`);

        // Guard against duplicate peers
        const existing = this.connections.get(targetId);
        if (existing && existing.peer) {
            existing.peer.destroy();
        }

        const p = new SimplePeer({
            initiator,
            trickle: false,
            config: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] }
        });

        // Initialize State Object if not exists (it should exist from updateState)
        let conn = this.connections.get(targetId);
        if (!conn) {
            conn = {
                peer: p,
                state: 'NEGOTIATING',
                nodeId: targetId,
                startTime: Date.now(),
                iceStats: { host: 0, srflx: 0, relay: 0 }
            };
            this.connections.set(targetId, conn);
        } else {
            conn.peer = p;
            conn.state = 'NEGOTIATING';
            conn.startTime = Date.now();
        }

        this.startNegotiationTimeout(targetId);

        // --- EVENT HANDLERS ---

        p.on('signal', (data: any) => {
            // Capture candidates for "Privacy-Safe Diagnostics"
            if (data.candidate && data.candidate.candidate) {
                this.logCandidateType(targetId, data.candidate.candidate);
            }
            this.sendSignal(targetId, targetIp, port, (data.type as SignalType) || 'candidate', data.sdp, data.candidate);
        });

        p.on('connect', () => {
            console.log(`[P2P] CONNECTED to ${targetId}`);
            this.updateState(targetId, 'CONNECTED');
            // Stop Timeout logic
            if (this.connections.get(targetId)?.timeoutTimer) {
                clearTimeout(this.connections.get(targetId)!.timeoutTimer);
            }
        });

        // @ts-ignore
        p.on('iceStateChange', (state) => {
            // can be used for detailed diagnostics
        });

        p.on('data', (data: any) => {
            try {
                const msg = JSON.parse(data.toString());
                this.notifyDataListeners(msg, targetId);
            } catch (e) { }
        });

        p.on('close', () => {
            console.log(`[P2P] Connection Closed: ${targetId}`);
            this.updateState(targetId, 'DISCONNECTED');
            this.connections.delete(targetId);
        });

        p.on('error', (err: any) => {
            console.error(`[P2P] Error ${targetId}:`, err);
            const c = this.connections.get(targetId);
            if (c) c.lastError = err.message;
            this.updateState(targetId, 'FAILED');
        });
    },

    startNegotiationTimeout(targetId: string) {
        const conn = this.connections.get(targetId);
        if (!conn) return;

        if (conn.timeoutTimer) clearTimeout(conn.timeoutTimer);

        conn.timeoutTimer = setTimeout(() => {
            if (conn.state === 'REQUESTING' || conn.state === 'NEGOTIATING') {
                console.warn(`[P2P] Negotiation Timeout for ${targetId}`);
                this.terminateConnection(targetId, 'Negotiation Timeout (20s)');
                this.updateState(targetId, 'FAILED'); // Should trigger UI update
            }
        }, 20000); // 20s Hard Limit
    },

    updateState(targetId: string, state: ConnectionState) {
        let conn = this.connections.get(targetId);
        if (!conn) {
            conn = {
                peer: null,
                state,
                nodeId: targetId,
                startTime: Date.now(),
                iceStats: { host: 0, srflx: 0, relay: 0 }
            };
            this.connections.set(targetId, conn);
        } else {
            conn.state = state;
        }
        this.notifyConnectionListeners(targetId, state);
    },

    logCandidateType(targetId: string, candidateStr: string) {
        const conn = this.connections.get(targetId);
        if (!conn || !conn.iceStats) return;

        if (candidateStr.includes(' typ host')) conn.iceStats.host++;
        else if (candidateStr.includes(' typ srflx')) conn.iceStats.srflx++;
        else if (candidateStr.includes(' typ relay')) conn.iceStats.relay++;
    },

    getPeerIP(id: string): { ip: string, port: number } | undefined {
        return this.ipResolver ? this.ipResolver(id) : undefined;
    },

    // Public API
    sendData(peerId: string, msg: any) {
        const conn = this.connections.get(peerId);
        if (conn && conn.state === 'CONNECTED' && conn.peer) {
            conn.peer.send(JSON.stringify(msg));
        } else {
            console.warn(`[P2P] Cannot send data to ${peerId} - not connected`);
        }
    },

    broadcast(msg: any) {
        const payload = JSON.stringify(msg);
        this.connections.forEach(conn => {
            if (conn.state === 'CONNECTED' && conn.peer) {
                conn.peer.send(payload);
            }
        });
    },

    onSignal(callback: (payload: SignalPayload) => void) {
        this.signalListeners.push(callback);
        return () => { this.signalListeners = this.signalListeners.filter(l => l !== callback); };
    },
    notifySignalListeners(payload: SignalPayload) { this.signalListeners.forEach(l => l(payload)); },

    onData(callback: (data: any, peerId: string) => void) {
        this.dataListeners.push(callback);
        return () => { this.dataListeners = this.dataListeners.filter(l => l !== callback); };
    },
    notifyDataListeners(data: any, peerId: string) { this.dataListeners.forEach(l => l(data, peerId)); },

    onConnectionStatus(callback: (status: { peerId: string, status: ConnectionState, details?: any }) => void) {
        this.connectionListeners.push(callback);
        return () => { this.connectionListeners = this.connectionListeners.filter(l => l !== callback); };
    },
    notifyConnectionListeners(peerId: string, status: ConnectionState, details?: any) {
        this.connectionListeners.forEach(l => l({ peerId, status, details }));
    },

    sendSignal(targetId: string, targetIp: string, port: number, type_: SignalType, sdp?: string, candidate?: any, fingerprint?: any) {
        const payload: SignalPayload = {
            sender_id: this.myId,
            type_,
            sdp,
            candidate,
            fingerprint
        };
        fetch(`http://${targetIp}:${port}/signal`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        }).catch(e => {
            console.error(`[P2P] Signal fail to ${targetId}:`, e);
        });
    }
};
