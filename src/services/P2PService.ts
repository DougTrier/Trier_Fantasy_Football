/**
 * Trier Fantasy Football
 * © 2026 Doug Trier
 *
 * Licensed under the MIT License.
 * See LICENSE file for details.
 *
 * "Trier OS" and "Trier Fantasy Football" are trademarks of Doug Trier.
 */

/**
 * P2PService — WebRTC Peer-to-Peer Transport + Application-Layer Trust
 * ======================================================================
 * Manages the full lifecycle of a peer connection from raw WebRTC transport
 * through to cryptographically verified application-level trust.
 *
 * CONNECTION STATE MACHINE:
 *   IDLE → REQUESTING → NEGOTIATING → CONNECTED → VERIFYING → VERIFIED
 *
 *   CONNECTED  = WebRTC data channel is open. Peer identity is UNKNOWN.
 *                No game data may flow at this state.
 *   VERIFYING  = 3-message ECDSA handshake is in progress.
 *                No game data may flow at this state.
 *   VERIFIED   = Mutual authentication complete. Safe to exchange game state.
 *
 * HANDSHAKE PROTOCOL (3-message mutual auth):
 *   Initiator → Responder : HANDSHAKE   { magic, app_family, version, nodeId, publicKey, nonce_A }
 *   Responder → Initiator : HANDSHAKE_ACK { nodeId, publicKey, sign(nonce_A), nonce_B }
 *   Initiator → Responder : HANDSHAKE_COMPLETE { nodeId, sign(nonce_B) }
 *
 *   Both sides verify the other's signature before marking VERIFIED.
 *   Nonces are single-use and invalidated immediately after verification.
 *
 * SECURITY BOUNDARIES:
 *   - sendData() and broadcast() are hard-gated on VERIFIED.
 *   - sendRaw() bypasses the gate — used ONLY for the 3 handshake messages.
 *   - Any non-handshake message from an unverified peer is dropped with a warning.
 *
 * ⚠️  CORE ARCHITECTURE — Do not modify without opening an issue first.
 *     See CONTRIBUTING.md for the protected architecture list.
 *
 * @module P2PService
 */
import SimplePeer from 'simple-peer';
import { listen } from '@tauri-apps/api/event';
import { IdentityService } from './IdentityService';
import {
    APP_MAGIC,
    APP_FAMILY,
    PROTOCOL_VERSION,
    MIN_PROTOCOL_VERSION,
    type HandshakeMsg,
    type HandshakeAck,
    type HandshakeComplete,
    type SignalType,
} from '../types/P2P';

// Re-export SignalType for consumers
export type { SignalType };

// ─────────────────────────────────────────────────────────────────────────────
// Connection State Machine
//
// Transport layer:
//   IDLE → REQUESTING → NEGOTIATING → CONNECTED → VERIFYING → VERIFIED
//
// Key separation:
//   CONNECTED  = WebRTC data channel is open. Peer is UNKNOWN. No data flows.
//   VERIFYING  = Application-layer handshake is in progress. Still no data.
//   VERIFIED   = Both sides signed. This peer is the same application. Data flows.
//
// Any state below VERIFIED = no game data may be sent or received.
// ─────────────────────────────────────────────────────────────────────────────
export type ConnectionState =
    | 'IDLE'
    | 'REQUESTING'
    | 'NEGOTIATING'
    | 'CONNECTED'    // WebRTC transport open — handshake NOT started yet
    | 'VERIFYING'    // Handshake in progress — waiting for signed ack
    | 'VERIFIED'     // Mutual authentication complete — safe to sync
    | 'FAILED'
    | 'DISCONNECTED'
    | 'TERMINATED';

interface P2PConnection {
    peer: InstanceType<typeof SimplePeer> | null;
    /** DHT transport — used when peer is null (internet peers via Trystero). */
    sendFn?: (data: string) => void;
    state: ConnectionState;
    /** Peer's real node ID. For DHT peers this starts as tempId and is updated after handshake. */
    nodeId: string;
    startTime: number;
    lastError?: string;
    iceStats?: {
        host: number;
        srflx: number;
        relay: number;
    };
    timeoutTimer?: any;

    // ── Handshake state ──────────────────────────────────────────────────────
    isInitiator?: boolean;      // true if WE initiated the connection
    pendingNonce?: string;       // nonce WE sent — we wait for peer to sign it
    peerPublicKey?: string;      // peer's public key once received in HANDSHAKE/ACK
    negotiatedVersion?: number;  // agreed protocol version for this session
    peerUuid?: string;           // peer's stable install UUID, learned during handshake
}

export interface SignalPayload {
    sender_id: string;
    type_: SignalType;
    sdp?: string;
    candidate?: any;
    fingerprint?: any;
}

// ─────────────────────────────────────────────────────────────────────────────
// P2PService
// ─────────────────────────────────────────────────────────────────────────────
export const P2PService = {
    connections: new Map<string, P2PConnection>(),
    connectionRequests: new Set<string>(),

    myId: '',
    port: 15432,
    isPortAssigned: false,
    ipResolver: null as ((id: string) => { ip: string; port: number } | undefined) | null,

    // ── Peer public key registry ──────────────────────────────────────────────
    // Populated when a peer reaches VERIFIED state (both sides of the handshake).
    // Used to verify event signatures: knownPeerKeys.get(event.author) → Base64 SPKI.
    // Only peers whose signatures we have cryptographically verified appear here.
    knownPeerKeys: new Map<string, string>(), // nodeId → Base64 SPKI public key

    /** Returns the ECDSA public key for a verified peer, or undefined if unknown. */
    getPeerPublicKey(nodeId: string): string | undefined {
        return this.knownPeerKeys.get(nodeId);
    },

    // ── Relay support ─────────────────────────────────────────────────────────
    // Peers discovered via the relay server (not LAN). Their signals are routed
    // through RelayService's WebSocket instead of the Rust HTTP signal endpoint.
    relayPeers: new Set<string>(),
    // Callback set by RelayService — called instead of HTTP fetch for relay peers.
    // Receives the full SignalPayload with a `to` field added.
    relaySender: null as ((payload: any) => void) | null,

    // Event listener arrays
    signalListeners: [] as ((payload: SignalPayload) => void)[],
    dataListeners: [] as ((data: any, peerId: string) => void)[],
    connectionListeners: [] as ((status: { peerId: string; status: ConnectionState; details?: any }) => void)[],
    portAssignmentListeners: [] as ((port: number) => void)[],

    onPortAssigned(callback: (port: number) => void) {
        this.portAssignmentListeners.push(callback);
        if (this.isPortAssigned) callback(this.port);
        return () => {
            this.portAssignmentListeners = this.portAssignmentListeners.filter(l => l !== callback);
        };
    },

    async init() {
        const identity = await IdentityService.init();
        this.myId = identity.nodeId;

        const { isTauri } = await import('../utils/tauriEnv');
        if (!isTauri()) return;

        try {
            await listen('PEER_SIGNAL', (event) => {
                const payload = event.payload as SignalPayload;
                this.handleSignal(payload);
            });
        } catch (e) {
            console.warn('[P2P] Failed to listen for signals:', e);
        }
    },

    setIpResolver(resolver: (id: string) => { ip: string; port: number } | undefined) {
        this.ipResolver = resolver;
    },

    /**
     * Read user-configured TURN server credentials from localStorage.
     * Returns an empty array if no TURN server is configured (STUN-only mode).
     * Storage key: 'trier_turn_config' → { url, username, credential }
     */
    getTurnConfig(): RTCIceServer[] {
        try {
            const raw = localStorage.getItem('trier_turn_config');
            if (!raw) return [];
            const cfg = JSON.parse(raw);
            if (!cfg?.url) return [];
            return [{ urls: cfg.url, username: cfg.username || '', credential: cfg.credential || '' }];
        } catch {
            return [];
        }
    },

    /** Called by RelayService to hook into outbound signal routing. */
    setRelaySender(fn: ((payload: any) => void) | null) {
        this.relaySender = fn;
    },

    /** Mark a nodeId as a relay peer so its signals are routed via RelayService. */
    addRelayPeer(nodeId: string) {
        this.relayPeers.add(nodeId);
    },

    // ─────────────────────────────────────────────────────────────────────────
    // State Machine Actions
    // ─────────────────────────────────────────────────────────────────────────

    requestConnection(targetId: string, targetIp: string, port: number) {
        if (this.connections.has(targetId)) {
            const c = this.connections.get(targetId)!;
            if (c.state === 'CONNECTED' || c.state === 'VERIFYING' || c.state === 'VERIFIED' || c.state === 'NEGOTIATING') return;
        }
        console.log(`[P2P] Requesting connection to ${targetId}...`);
        this.updateState(targetId, 'REQUESTING');
        this.sendSignal(targetId, targetIp, port, 'CONNECT_REQUEST');
        this.startNegotiationTimeout(targetId);
    },

    acceptConnection(targetId: string) {
        console.log(`[P2P] Accepting connection from ${targetId}`);
        const peerInfo = this.getPeerIP(targetId);
        if (!peerInfo) {
            console.error('[P2P] Cannot accept — Unknown IP');
            return;
        }
        this.connectionRequests.delete(targetId);
        this.updateState(targetId, 'NEGOTIATING');
        this.sendSignal(targetId, peerInfo.ip, peerInfo.port, 'CONNECT_ACCEPT');
    },

    rejectConnection(targetId: string) {
        console.log(`[P2P] Rejecting connection from ${targetId}`);
        const peerInfo = this.getPeerIP(targetId);
        if (peerInfo) {
            this.sendSignal(targetId, peerInfo.ip, peerInfo.port, 'CONNECT_REJECT');
            this.connectionRequests.delete(targetId);
        }
        this.updateState(targetId, 'TERMINATED' as ConnectionState);
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
        const notifyId = conn?.nodeId ?? targetId;
        if (conn) {
            console.log(`[P2P] Terminating ${notifyId}: ${reason}`);
            if (conn.peer) {
                try { conn.peer.destroy(); } catch (e) { /* ignore */ }
            }
            if (conn.timeoutTimer) clearTimeout(conn.timeoutTimer);
            this.updateState(targetId, 'TERMINATED');
            this.connections.delete(targetId);
        }
        this.notifyConnectionListeners(notifyId, 'TERMINATED', { reason });
    },

    // ─────────────────────────────────────────────────────────────────────────
    // Signal Handling (used during WebRTC negotiation)
    // ─────────────────────────────────────────────────────────────────────────

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

        if (type_ === 'offer') {
            console.log(`[P2P] Received Offer from ${sender_id}`);
            if (!this.connections.has(sender_id)) {
                this.updateState(sender_id, 'NEGOTIATING');
                if (peerInfo) {
                    this.startPeerSession(sender_id, peerInfo.ip, peerInfo.port, false);
                } else {
                    console.error('[P2P] Unknown IP for offer sender');
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

    // ─────────────────────────────────────────────────────────────────────────
    // WebRTC Session
    // ─────────────────────────────────────────────────────────────────────────

    startPeerSession(targetId: string, targetIp: string, port: number, initiator: boolean) {
        console.log(`[P2P] Starting WebRTC Session with ${targetId} (Initiator: ${initiator})`);

        const existing = this.connections.get(targetId);
        if (existing && existing.peer) {
            existing.peer.destroy();
        }

        const turnServers = this.getTurnConfig();
        const iceServers: RTCIceServer[] = [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            ...turnServers,
        ];
        if (turnServers.length > 0) {
            console.log(`[P2P] ICE config: STUN + TURN (${(turnServers[0].urls as string).split(':')[1]})`);
        }

        const p = new SimplePeer({
            initiator,
            trickle: false,
            config: { iceServers }
        });

        let conn = this.connections.get(targetId);
        if (!conn) {
            conn = {
                peer: p,
                state: 'NEGOTIATING',
                nodeId: targetId,
                startTime: Date.now(),
                iceStats: { host: 0, srflx: 0, relay: 0 },
                isInitiator: initiator
            };
            this.connections.set(targetId, conn);
        } else {
            conn.peer = p;
            conn.state = 'NEGOTIATING';
            conn.startTime = Date.now();
            conn.isInitiator = initiator;
            // Clear any stale handshake state from a previous attempt
            conn.pendingNonce = undefined;
            conn.peerPublicKey = undefined;
        }

        this.startNegotiationTimeout(targetId);

        // ── WebRTC Events ────────────────────────────────────────────────────

        p.on('signal', (data: any) => {
            if (data.candidate && data.candidate.candidate) {
                this.logCandidateType(targetId, data.candidate.candidate);
            }
            this.sendSignal(targetId, targetIp, port, (data.type as SignalType) || 'candidate', data.sdp, data.candidate);
        });

        p.on('connect', async () => {
            // Transport is open — do NOT mark as CONNECTED yet in the traditional sense.
            // Immediately start the application-layer handshake.
            console.log(`[P2P] Transport open with ${targetId}. Starting handshake (initiator: ${initiator})...`);

            // Clear negotiation timeout — transport is established
            const c = this.connections.get(targetId);
            if (c?.timeoutTimer) clearTimeout(c.timeoutTimer);

            // Transition: NEGOTIATING → CONNECTED (transport only — not yet verified)
            this.updateState(targetId, 'CONNECTED');

            // Transition immediately: CONNECTED → VERIFYING
            this.updateState(targetId, 'VERIFYING');

            // Only the initiator sends the first HANDSHAKE message.
            // The responder waits for the HANDSHAKE to arrive.
            if (initiator) {
                await this.initiateHandshake(targetId);
            }
        });

        // @ts-ignore
        p.on('iceStateChange', (_state: string) => { /* available for diagnostics */ });

        p.on('data', async (data: any) => {
            try {
                const msg = JSON.parse(data.toString());

                // ── Route handshake messages BEFORE any trust check ──────────
                if (msg.type === 'HANDSHAKE') {
                    await this.handleHandshake(targetId, msg as HandshakeMsg);
                    return;
                }
                if (msg.type === 'HANDSHAKE_ACK') {
                    await this.handleHandshakeAck(targetId, msg as HandshakeAck);
                    return;
                }
                if (msg.type === 'HANDSHAKE_COMPLETE') {
                    await this.handleHandshakeComplete(targetId, msg as HandshakeComplete);
                    return;
                }

                // ── Gate all other messages on VERIFIED state ─────────────────
                const currentConn = this.connections.get(targetId);
                if (!currentConn || currentConn.state !== 'VERIFIED') {
                    console.warn(`[P2P] Dropping "${msg.type}" from unverified peer ${targetId} (state: ${currentConn?.state})`);
                    return;
                }

                this.notifyDataListeners(msg, targetId);
            } catch (e) {
                console.warn('[P2P] Failed to parse data message:', e);
            }
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

    // ─────────────────────────────────────────────────────────────────────────
    // DHT Peer Injection — internet peers discovered via Trystero
    //
    // Instead of SimplePeer managing WebRTC, Trystero gives us a ready-made
    // data channel. We inject it here using a sendFn callback and immediately
    // run our existing ECDSA handshake over it.
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Register a DHT peer (connected via Trystero/WebRTC) with the P2P layer.
     * The sendFn replaces SimplePeer.send() for this connection.
     * The ECDSA handshake runs immediately — if we are the initiator.
     */
    injectDHTConnection(tempId: string, sendFn: (data: string) => void, isInitiator: boolean) {
        if (this.connections.has(tempId)) return; // already handling
        console.log(`[P2P] DHT peer injected: ${tempId} (initiator: ${isInitiator})`);
        const conn: P2PConnection = {
            peer: null,
            sendFn,
            state: 'VERIFYING',
            nodeId: tempId,   // updated to real nodeId once handshake reveals it
            startTime: Date.now(),
            isInitiator,
        };
        this.connections.set(tempId, conn);
        // Note: we skip CONNECTING/NEGOTIATING notifications for DHT peers —
        // the WebRTC channel is already established by Trystero before we get here.

        if (isInitiator) {
            this.initiateHandshake(tempId).catch(e => {
                console.error(`[P2P] DHT handshake initiation failed for ${tempId}:`, e);
                this.terminateConnection(tempId, 'Handshake initiation error');
            });
        }
    },

    /**
     * Route raw data received from a DHT peer through the standard message handler.
     * Called by DHTService whenever the Trystero data channel delivers a message.
     */
    receiveDHTData(tempId: string, rawData: string) {
        const conn = this.connections.get(tempId);
        if (!conn) {
            console.warn(`[P2P] receiveDHTData: no connection for ${tempId}`);
            return;
        }
        try {
            const msg = JSON.parse(rawData);

            if (msg.type === 'HANDSHAKE') { this.handleHandshake(tempId, msg as HandshakeMsg); return; }
            if (msg.type === 'HANDSHAKE_ACK') { this.handleHandshakeAck(tempId, msg as HandshakeAck); return; }
            if (msg.type === 'HANDSHAKE_COMPLETE') { this.handleHandshakeComplete(tempId, msg as HandshakeComplete); return; }

            if (conn.state !== 'VERIFIED') {
                console.warn(`[P2P] Dropping "${msg.type}" from unverified DHT peer ${tempId} (state: ${conn.state})`);
                return;
            }
            this.notifyDataListeners(msg, conn.nodeId);
        } catch (e) {
            console.warn('[P2P] DHT: Failed to parse message:', e);
        }
    },

    // ─────────────────────────────────────────────────────────────────────────
    // Application-Layer Handshake — 3-message mutual authentication
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Step 1 (Initiator): Send HANDSHAKE with our public key and a nonce.
     * The responder must sign our nonce to prove they own their private key.
     */
    async initiateHandshake(targetId: string) {
        const conn = this.connections.get(targetId);
        if (!conn) return;

        // Generate a random nonce the peer must sign
        const nonce = crypto.randomUUID();
        conn.pendingNonce = nonce;

        const publicKey = await IdentityService.getPublicKeyBase64();

        const msg: HandshakeMsg = {
            type: 'HANDSHAKE',
            magic: APP_MAGIC,
            app_family: APP_FAMILY,
            protocol_version: PROTOCOL_VERSION,
            nodeId: this.myId,
            publicKey,
            nonce,
            peerUuid: IdentityService.getPeerUuid(),
        };

        this.sendRaw(targetId, msg);
        console.log(`[P2P] → HANDSHAKE sent to ${targetId} (nonce: ${nonce.slice(0, 8)}...)`);
    },

    /**
     * Step 2 (Responder): Validate the HANDSHAKE, sign their nonce, send ACK with our own nonce.
     */
    async handleHandshake(targetId: string, msg: HandshakeMsg) {
        // ── Protocol validation ───────────────────────────────────────────────
        if (msg.magic !== APP_MAGIC) {
            console.warn(`[P2P] ✗ Rejected ${targetId}: bad magic "${msg.magic}" (expected "${APP_MAGIC}")`);
            this.terminateConnection(targetId, `Protocol mismatch: bad magic "${msg.magic}"`);
            return;
        }
        if (msg.app_family !== APP_FAMILY) {
            console.warn(`[P2P] ✗ Rejected ${targetId}: wrong app_family "${msg.app_family}"`);
            this.terminateConnection(targetId, `Protocol mismatch: wrong app_family`);
            return;
        }
        // ── Version negotiation ───────────────────────────────────────────────
        // Agree on the highest version BOTH sides support.
        // If that floor is below our minimum supported version, reject.
        const agreedVersion = Math.min(msg.protocol_version, PROTOCOL_VERSION);
        if (agreedVersion < MIN_PROTOCOL_VERSION) {
            console.warn(`[P2P] ✗ Rejected ${targetId}: negotiated v${agreedVersion} is below minimum v${MIN_PROTOCOL_VERSION}`);
            this.terminateConnection(targetId, `Version too old: negotiated v${agreedVersion}, minimum v${MIN_PROTOCOL_VERSION}`);
            return;
        }
        if (!msg.nodeId || !msg.publicKey || !msg.nonce) {
            console.warn(`[P2P] ✗ Rejected ${targetId}: incomplete handshake payload`);
            this.terminateConnection(targetId, 'Incomplete handshake payload');
            return;
        }

        const versionNote = agreedVersion < PROTOCOL_VERSION
            ? ` (downgraded to v${agreedVersion} for peer on v${msg.protocol_version})`
            : '';
        console.log(`[P2P] ← HANDSHAKE valid from ${msg.nodeId}. Protocol v${agreedVersion}${versionNote}. Sending ACK...`);

        const conn = this.connections.get(targetId);
        if (!conn) return;

        conn.negotiatedVersion = agreedVersion;
        conn.peerUuid = msg.peerUuid;
        // Store peer's public key
        conn.peerPublicKey = msg.publicKey;
        // For DHT connections: conn.nodeId starts as tempId. Update to the peer's real nodeId.
        if (msg.nodeId && conn.nodeId !== msg.nodeId) {
            console.log(`[P2P] DHT: nodeId resolved ${conn.nodeId} → ${msg.nodeId}`);
            conn.nodeId = msg.nodeId;
        }

        // Sign their nonce — proves we own our private key
        const signedNonce = await IdentityService.sign(msg.nonce);

        // Generate our own nonce for the initiator to sign
        const myNonce = crypto.randomUUID();
        conn.pendingNonce = myNonce;

        const publicKey = await IdentityService.getPublicKeyBase64();

        const ack: HandshakeAck = {
            type: 'HANDSHAKE_ACK',
            nodeId: this.myId,
            publicKey,
            signedNonce,
            nonce: myNonce,
            protocol_version: PROTOCOL_VERSION,
            peerUuid: IdentityService.getPeerUuid(),
        };

        this.sendRaw(targetId, ack);
        console.log(`[P2P] → HANDSHAKE_ACK sent to ${targetId}`);
    },

    /**
     * Step 3a (Initiator): Verify the ACK's signature, then send HANDSHAKE_COMPLETE.
     * After this step, the initiator marks the peer as VERIFIED.
     */
    async handleHandshakeAck(targetId: string, msg: HandshakeAck) {
        const conn = this.connections.get(targetId);
        if (!conn || !conn.pendingNonce) {
            console.warn(`[P2P] Unexpected HANDSHAKE_ACK from ${targetId} — no pending nonce.`);
            return;
        }

        // ── Version negotiation (initiator side) ──────────────────────────────
        // Responder told us their native version; agree on the floor.
        const peerVersion = msg.protocol_version ?? PROTOCOL_VERSION;
        const agreedVersion = Math.min(peerVersion, PROTOCOL_VERSION);
        conn.negotiatedVersion = agreedVersion;
        if (agreedVersion < PROTOCOL_VERSION) {
            console.log(`[P2P] Protocol downgraded to v${agreedVersion} (peer on v${peerVersion})`);
        }

        // Verify: did they correctly sign OUR nonce?
        const valid = await IdentityService.verifySignature(msg.publicKey, conn.pendingNonce, msg.signedNonce);
        if (!valid) {
            console.error(`[P2P] ✗ Signature verification FAILED for ${targetId}. Terminating.`);
            this.terminateConnection(targetId, 'Handshake: signature of nonce is invalid');
            return;
        }

        console.log(`[P2P] ✓ Signature from ${targetId} verified (v${agreedVersion}). Sending COMPLETE...`);
        conn.peerPublicKey = msg.publicKey;
        if (msg.peerUuid) conn.peerUuid = msg.peerUuid;
        // For DHT connections: update conn.nodeId to the responder's real nodeId.
        if (msg.nodeId && conn.nodeId !== msg.nodeId) {
            console.log(`[P2P] DHT: nodeId resolved ${conn.nodeId} → ${msg.nodeId}`);
            conn.nodeId = msg.nodeId;
        }

        // Sign THEIR nonce — proves we own our private key (completes mutual auth)
        const signedNonce = await IdentityService.sign(msg.nonce);

        const complete: HandshakeComplete = {
            type: 'HANDSHAKE_COMPLETE',
            nodeId: this.myId,
            signedNonce,
        };

        this.sendRaw(targetId, complete);

        // Register the peer's verified public key — used to verify inbound event signatures
        this.knownPeerKeys.set(conn.nodeId, msg.publicKey);

        conn.pendingNonce = undefined;
        this.updateState(targetId, 'VERIFIED', { peerUuid: conn.peerUuid });
        console.log(`[P2P] ✅ Peer ${targetId} VERIFIED (initiator side)`);
    },

    /**
     * Step 3b (Responder): Verify the HANDSHAKE_COMPLETE signature.
     * After this step, the responder marks the peer as VERIFIED.
     */
    async handleHandshakeComplete(targetId: string, msg: HandshakeComplete) {
        const conn = this.connections.get(targetId);
        if (!conn || !conn.pendingNonce || !conn.peerPublicKey) {
            console.warn(`[P2P] Unexpected HANDSHAKE_COMPLETE from ${targetId}`);
            return;
        }

        // Verify: did they sign OUR nonce?
        const valid = await IdentityService.verifySignature(conn.peerPublicKey, conn.pendingNonce, msg.signedNonce);
        if (!valid) {
            console.error(`[P2P] ✗ Final verification FAILED for ${targetId}. Terminating.`);
            this.terminateConnection(targetId, 'Final handshake: signature invalid');
            return;
        }

        // Register the peer's verified public key — used to verify inbound event signatures
        this.knownPeerKeys.set(conn.nodeId, conn.peerPublicKey);

        conn.pendingNonce = undefined;
        this.updateState(targetId, 'VERIFIED', { peerUuid: conn.peerUuid });
        console.log(`[P2P] ✅ Peer ${targetId} VERIFIED (responder side)`);
    },

    // ─────────────────────────────────────────────────────────────────────────
    // Internal Utilities
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Sends a raw JSON message directly to a peer's data channel (WebRTC or DHT).
     * Bypasses the VERIFIED gate — used only for handshake messages.
     */
    sendRaw(targetId: string, msg: any) {
        const conn = this.connections.get(targetId);
        if (!conn) { console.warn(`[P2P] sendRaw: no connection for ${targetId}`); return; }
        const payload = JSON.stringify(msg);
        if (conn.sendFn) {
            conn.sendFn(payload);
        } else if (conn.peer) {
            try { conn.peer.send(payload); } catch (e) { console.error(`[P2P] sendRaw failed to ${targetId}:`, e); }
        } else {
            console.warn(`[P2P] sendRaw: no transport for ${targetId}`);
        }
    },

    startNegotiationTimeout(targetId: string) {
        const conn = this.connections.get(targetId);
        if (!conn) return;
        if (conn.timeoutTimer) clearTimeout(conn.timeoutTimer);
        conn.timeoutTimer = setTimeout(() => {
            if (conn.state === 'REQUESTING' || conn.state === 'NEGOTIATING' || conn.state === 'VERIFYING') {
                console.warn(`[P2P] Timeout for ${targetId} (state: ${conn.state})`);
                this.terminateConnection(targetId, `Timeout in state ${conn.state} (20s)`);
                this.updateState(targetId, 'FAILED');
            }
        }, 20000);
    },

    updateState(targetId: string, state: ConnectionState, details?: any) {
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
        // Use conn.nodeId as the notify ID — for DHT peers this is the peer's real nodeId
        // once the handshake has revealed it, even though the map key remains the tempId.
        this.notifyConnectionListeners(conn.nodeId, state, details);
    },

    logCandidateType(targetId: string, candidateStr: string) {
        const conn = this.connections.get(targetId);
        if (!conn || !conn.iceStats) return;
        if (candidateStr.includes(' typ host')) conn.iceStats.host++;
        else if (candidateStr.includes(' typ srflx')) conn.iceStats.srflx++;
        else if (candidateStr.includes(' typ relay')) conn.iceStats.relay++;
    },

    getPeerIP(id: string): { ip: string; port: number } | undefined {
        return this.ipResolver ? this.ipResolver(id) : undefined;
    },

    // ─────────────────────────────────────────────────────────────────────────
    // Public Data API — gated on VERIFIED state
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Send data to a specific peer.
     * Supports both LAN (SimplePeer) and DHT (sendFn) transports.
     * Silently drops the message if the peer is not VERIFIED.
     */
    sendData(peerId: string, msg: any) {
        // Direct key lookup first; fall back to nodeId search for DHT peers (keyed by tempId)
        let conn = this.connections.get(peerId);
        if (!conn) {
            for (const c of this.connections.values()) {
                if (c.nodeId === peerId) { conn = c; break; }
            }
        }
        if (conn && conn.state === 'VERIFIED') {
            const payload = JSON.stringify(msg);
            if (conn.sendFn) { conn.sendFn(payload); }
            else if (conn.peer) { conn.peer.send(payload); }
        } else {
            console.warn(`[P2P] Cannot send to ${peerId} — state: ${conn?.state ?? 'no connection'}`);
        }
    },

    /**
     * Broadcast data to ALL verified peers (LAN + DHT).
     * Unverified peers are silently skipped.
     */
    broadcast(msg: any) {
        const payload = JSON.stringify(msg);
        let sent = 0;
        this.connections.forEach((conn, _id) => {
            if (conn.state === 'VERIFIED') {
                if (conn.sendFn) { conn.sendFn(payload); sent++; }
                else if (conn.peer) { conn.peer.send(payload); sent++; }
            }
        });
        if (sent === 0 && this.connections.size > 0) {
            console.log(`[P2P] Broadcast skipped — no VERIFIED peers (${this.connections.size} connections pending verification)`);
        }
    },

    // ─────────────────────────────────────────────────────────────────────────
    // Event Subscription API
    // ─────────────────────────────────────────────────────────────────────────

    onSignal(callback: (payload: SignalPayload) => void) {
        this.signalListeners.push(callback);
        return () => { this.signalListeners = this.signalListeners.filter(l => l !== callback); };
    },
    notifySignalListeners(payload: SignalPayload) {
        this.signalListeners.forEach(l => l(payload));
    },

    onData(callback: (data: any, peerId: string) => void) {
        this.dataListeners.push(callback);
        return () => { this.dataListeners = this.dataListeners.filter(l => l !== callback); };
    },
    notifyDataListeners(data: any, peerId: string) {
        this.dataListeners.forEach(l => l(data, peerId));
    },

    onConnectionStatus(callback: (status: { peerId: string; status: ConnectionState; details?: any }) => void) {
        this.connectionListeners.push(callback);
        return () => { this.connectionListeners = this.connectionListeners.filter(l => l !== callback); };
    },
    notifyConnectionListeners(peerId: string, status: ConnectionState, details?: any) {
        this.connectionListeners.forEach(l => l({ peerId, status, details }));
    },

    sendSignal(targetId: string, targetIp: string, port: number, type_: SignalType, sdp?: string, candidate?: any, fingerprint?: any) {
        const payload: SignalPayload & { to?: string } = {
            sender_id: this.myId,
            type_,
            sdp,
            candidate,
            fingerprint,
        };

        // ── Relay peers: route through RelayService WebSocket ─────────────────
        if (this.relayPeers.has(targetId) && this.relaySender) {
            payload.to = targetId;
            this.relaySender(payload);
            return;
        }

        // ── LAN peers: route through Rust HTTP signal endpoint ────────────────
        fetch(`http://${targetIp}:${port}/signal`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        }).catch(e => {
            console.error(`[P2P] Signal fail to ${targetId}:`, e);
        });
    }
};
