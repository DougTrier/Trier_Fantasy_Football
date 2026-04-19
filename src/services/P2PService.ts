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
    timeoutTimer?: ReturnType<typeof setTimeout>;

    // ── Handshake state ──────────────────────────────────────────────────────
    isInitiator?: boolean;      // true if WE initiated the connection
    pendingNonce?: string;       // nonce WE sent — we wait for peer to sign it
    peerPublicKey?: string;      // peer's long-term ECDSA P-256 public key
    negotiatedVersion?: number;  // agreed protocol version for this session
    peerUuid?: string;           // peer's stable install UUID, learned during handshake

    // ── Forward-secrecy session keys (ECDH P-256) ────────────────────────────
    // Fresh ephemeral ECDH keypair generated per connection; private key never leaves this object.
    ephemeralKeyPair?: CryptoKeyPair;           // our ephemeral ECDH keypair
    myEphemeralPublicKeyB64?: string;            // our exported ephemeral public key (stored for nonce binding)
    peerEphemeralPublicKeyB64?: string;          // peer's ephemeral public key (SPKI Base64)
    sessionKey?: CryptoKey;                      // AES-GCM-256 key derived via ECDH after VERIFIED
}

export interface SignalPayload {
    sender_id: string;
    type_: SignalType;
    sdp?: string;
    candidate?: RTCIceCandidateInit;
    fingerprint?: unknown;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Generates a one-time-use ECDH P-256 keypair for this connection. */
async function generateEphemeralKeyPair(): Promise<CryptoKeyPair> {
    return crypto.subtle.generateKey(
        { name: 'ECDH', namedCurve: 'P-256' },
        true,               // extractable so we can export the public key to send to peer
        ['deriveKey']
    );
}

/** Exports an ECDH public key to Base64-encoded SPKI (safe to send over the wire). */
async function exportEphemeralPublicKey(key: CryptoKey): Promise<string> {
    const buf = await crypto.subtle.exportKey('spki', key);
    return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

/**
 * Derives an AES-GCM-256 session key from our ephemeral private key and the
 * peer's ephemeral public key. The resulting key provides forward secrecy:
 * compromising the long-term ECDSA identity keys does not expose session traffic.
 */
async function deriveSessionKey(myPrivateKey: CryptoKey, peerPublicKeyB64: string): Promise<CryptoKey> {
    const peerPubBytes = Uint8Array.from(atob(peerPublicKeyB64), c => c.charCodeAt(0));
    const peerPubKey = await crypto.subtle.importKey(
        'spki', peerPubBytes,
        { name: 'ECDH', namedCurve: 'P-256' },
        false, []
    );
    return crypto.subtle.deriveKey(
        { name: 'ECDH', public: peerPubKey },
        myPrivateKey,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
    );
}

/**
 * Encrypts a JSON-serializable message with the session AES-GCM key.
 * Returns a self-contained envelope: "sess:<ivB64>:<ciphertextB64>".
 */
async function encryptWithSession(sessionKey: CryptoKey, message: object): Promise<string> {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const plain = new TextEncoder().encode(JSON.stringify(message));
    const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, sessionKey, plain);
    const b64 = (buf: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(buf instanceof ArrayBuffer ? buf : buf.buffer)));
    return `sess:${b64(iv)}:${b64(cipher)}`;
}

/**
 * Decrypts a "sess:..." envelope produced by encryptWithSession.
 * Returns the parsed inner message object, or null if decryption fails.
 */
async function decryptWithSession(sessionKey: CryptoKey, envelope: string): Promise<object | null> {
    if (!envelope.startsWith('sess:')) return null;
    try {
        const parts = envelope.split(':');
        if (parts.length !== 3) return null;
        const iv         = Uint8Array.from(atob(parts[1]), c => c.charCodeAt(0));
        const ciphertext = Uint8Array.from(atob(parts[2]), c => c.charCodeAt(0));
        const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, sessionKey, ciphertext);
        return JSON.parse(new TextDecoder().decode(plain));
    } catch {
        return null; // tampered or wrong key — caller should terminate the connection
    }
}

/**
 * Returns true only for RFC-1918 private addresses and loopback.
 * Used to ensure LAN HTTP signal requests never target public internet IPs.
 */
function isPrivateIp(ip: string): boolean {
    // Strip IPv6 zone ID or brackets if present
    const clean = ip.replace(/^\[/, '').replace(/\]$/, '').split('%')[0];
    if (clean === '::1' || clean === '127.0.0.1') return true;
    const parts = clean.split('.').map(Number);
    if (parts.length !== 4) return false; // IPv6 non-loopback is not LAN for our purposes
    const [a, b] = parts;
    return a === 10                            // 10.0.0.0/8
        || (a === 172 && b >= 16 && b <= 31)   // 172.16.0.0/12
        || (a === 192 && b === 168)            // 192.168.0.0/16
        || a === 127;                          // 127.0.0.0/8 loopback
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    relaySender: null as ((payload: any) => void) | null,

    // Event listener arrays
    signalListeners: [] as ((payload: SignalPayload) => void)[],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    dataListeners: [] as ((data: any, peerId: string) => void)[],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

    // In-memory TURN config cache. Populated by NetworkPage after decryption so that
    // getTurnConfig() can stay synchronous (Web Crypto is async; we decrypt once at mount).
    _turnConfigCache: null as RTCIceServer[] | null,

    /**
     * Returns the cached TURN server config. NetworkPage is responsible for decrypting
     * credentials from localStorage and calling setTurnConfigCache() on mount and save.
     * Falls back to a raw localStorage read for unencrypted legacy entries.
     */
    getTurnConfig(): RTCIceServer[] {
        // Prefer in-memory cache populated by NetworkPage after decryption
        if (this._turnConfigCache !== null) return this._turnConfigCache;
        // Legacy fallback: plaintext JSON (no enc1: prefix) — used before encryption upgrade
        try {
            const raw = localStorage.getItem('trier_turn_config');
            if (!raw || raw.startsWith('enc1:')) return [];
            const cfg = JSON.parse(raw);
            if (!cfg?.url) return [];
            return [{ urls: cfg.url, username: cfg.username || '', credential: cfg.credential || '' }];
        } catch {
            return [];
        }
    },

    /**
     * Called by NetworkPage after decrypting TURN credentials from localStorage.
     * Caches the ICE server list in memory so getTurnConfig() can remain synchronous.
     */
    setTurnConfigCache(servers: RTCIceServer[] | null): void {
        this._turnConfigCache = servers;
    },

    /** Called by RelayService to hook into outbound signal routing. */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
                try { conn.peer.destroy(); } catch { /* ignore */ }
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
                conn.peer.signal({ type: type_ as 'offer' | 'answer', sdp });
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

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

        // 'iceStateChange' is a valid SimplePeer event relayed from the underlying RTCPeerConnection,
        // but simple-peer types only declare their public API subset. The event fires correctly at runtime.
        p.on('iceStateChange', () => { /* available for diagnostics */ });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        p.on('data', async (data: any) => {
            try {
                const raw = data.toString();

                // ── Decrypt session-encrypted messages ───────────────────────
                // If the message starts with "sess:" it was encrypted by the peer's sendRaw.
                // Decrypt it before routing. Non-sess messages (handshake) arrive as plain JSON.
                const currentConn = this.connections.get(targetId);
                let msgObj: object;
                if (raw.startsWith('sess:') && currentConn?.sessionKey) {
                    const decrypted = await decryptWithSession(currentConn.sessionKey, raw);
                    if (!decrypted) {
                        console.error(`[P2P] Decryption failed from ${targetId} — possible tamper. Terminating.`);
                        this.terminateConnection(targetId, 'Decryption failure — message tampered or wrong key');
                        return;
                    }
                    msgObj = decrypted;
                } else {
                    msgObj = JSON.parse(raw);
                }

                const msg = msgObj as { type: string };

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

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    async receiveDHTData(tempId: string, rawData: string) {
        const conn = this.connections.get(tempId);
        if (!conn) {
            console.warn(`[P2P] receiveDHTData: no connection for ${tempId}`);
            return;
        }
        try {
            // Decrypt if the message is a session-encrypted envelope
            let msgObj: object;
            if (rawData.startsWith('sess:') && conn.sessionKey) {
                const decrypted = await decryptWithSession(conn.sessionKey, rawData);
                if (!decrypted) {
                    console.error(`[P2P] DHT: Decryption failed from ${tempId} — terminating.`);
                    this.terminateConnection(tempId, 'DHT decryption failure — message tampered');
                    return;
                }
                msgObj = decrypted;
            } else {
                msgObj = JSON.parse(rawData);
            }

            const msg = msgObj as { type: string };

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

        // Generate a random nonce the peer must sign to prove key ownership
        const nonce = crypto.randomUUID();
        conn.pendingNonce = nonce;

        // Generate an ephemeral ECDH keypair for this connection's session key.
        // Store the B64 form so it can be bound into the HANDSHAKE_COMPLETE signature later.
        conn.ephemeralKeyPair = await generateEphemeralKeyPair();
        const ephemeralPublicKey = await exportEphemeralPublicKey(conn.ephemeralKeyPair.publicKey);
        conn.myEphemeralPublicKeyB64 = ephemeralPublicKey;

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
            ephemeralPublicKey, // included for ECDH forward secrecy
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

        // Generate our own nonce for the initiator to sign
        const myNonce = crypto.randomUUID();
        conn.pendingNonce = myNonce;

        // Store initiator's ephemeral public key; we'll derive the session key after COMPLETE
        if (msg.ephemeralPublicKey) conn.peerEphemeralPublicKeyB64 = msg.ephemeralPublicKey;

        // Generate our own ephemeral ECDH keypair and include it in the ACK.
        // Store B64 form so it can be bound into the HANDSHAKE_ACK signature (ephem-key binding).
        conn.ephemeralKeyPair = await generateEphemeralKeyPair();
        const ephemeralPublicKey = await exportEphemeralPublicKey(conn.ephemeralKeyPair.publicKey);
        conn.myEphemeralPublicKeyB64 = ephemeralPublicKey;

        const publicKey = await IdentityService.getPublicKeyBase64();

        // Sign their nonce bound to our ephemeral key: sign(nonce_A + ":eph:" + ephKey_B).
        // Binding our ephemeral key into the signature prevents a MITM from substituting it.
        const signPayload = ephemeralPublicKey
            ? `${msg.nonce}:eph:${ephemeralPublicKey}`
            : msg.nonce;
        const signedNonce = await IdentityService.sign(signPayload);

        const ack: HandshakeAck = {
            type: 'HANDSHAKE_ACK',
            nodeId: this.myId,
            publicKey,
            signedNonce,
            nonce: myNonce,
            protocol_version: PROTOCOL_VERSION,
            peerUuid: IdentityService.getPeerUuid(),
            ephemeralPublicKey, // included for ECDH forward secrecy
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

        // Verify: did they sign OUR nonce bound to THEIR ephemeral key?
        // Expected payload: nonce_A + ":eph:" + responder_ephKey (prevents ephemeral-key MITM swap)
        const verifyPayload = msg.ephemeralPublicKey
            ? `${conn.pendingNonce}:eph:${msg.ephemeralPublicKey}`
            : conn.pendingNonce;
        const valid = await IdentityService.verifySignature(msg.publicKey, verifyPayload, msg.signedNonce);
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

        // Sign THEIR nonce bound to OUR ephemeral key: sign(nonce_B + ":eph:" + ephKey_A).
        // This proves we own our long-term identity key AND commits to our ephemeral key.
        const signPayload = conn.myEphemeralPublicKeyB64
            ? `${msg.nonce}:eph:${conn.myEphemeralPublicKeyB64}`
            : msg.nonce;
        const signedNonce = await IdentityService.sign(signPayload);

        const complete: HandshakeComplete = {
            type: 'HANDSHAKE_COMPLETE',
            nodeId: this.myId,
            signedNonce,
        };

        this.sendRaw(targetId, complete);

        // Derive forward-secret session key: ECDH(our ephemeral priv, peer's ephemeral pub)
        // Both sides now have each other's ephemeral public keys and can derive the same secret.
        if (conn.ephemeralKeyPair && msg.ephemeralPublicKey) {
            try {
                conn.sessionKey = await deriveSessionKey(
                    conn.ephemeralKeyPair.privateKey, msg.ephemeralPublicKey
                );
                console.log(`[P2P] 🔐 Session key derived for ${targetId} — forward secrecy active.`);
            } catch (e) {
                console.warn(`[P2P] Session key derivation failed for ${targetId} — falling back to unencrypted.`, e);
            }
        }

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

        // Verify: did they sign OUR nonce bound to THEIR ephemeral key?
        // Expected: sign(nonce_B + ":eph:" + initiator_ephKey_A) — mirrors the ACK binding
        const verifyPayload = conn.peerEphemeralPublicKeyB64
            ? `${conn.pendingNonce}:eph:${conn.peerEphemeralPublicKeyB64}`
            : conn.pendingNonce;
        const valid = await IdentityService.verifySignature(conn.peerPublicKey, verifyPayload, msg.signedNonce);
        if (!valid) {
            console.error(`[P2P] ✗ Final verification FAILED for ${targetId}. Terminating.`);
            this.terminateConnection(targetId, 'Final handshake: signature invalid');
            return;
        }

        // Derive forward-secret session key using the initiator's ephemeral key stored during HANDSHAKE
        // The responder has the initiator's ephemeral pub key (from HANDSHAKE) and our own priv key.
        if (conn.ephemeralKeyPair && conn.peerEphemeralPublicKeyB64) {
            try {
                conn.sessionKey = await deriveSessionKey(
                    conn.ephemeralKeyPair.privateKey, conn.peerEphemeralPublicKeyB64
                );
                console.log(`[P2P] 🔐 Session key derived for ${targetId} — forward secrecy active.`);
            } catch (e) {
                console.warn(`[P2P] Session key derivation failed for ${targetId} — falling back to unencrypted.`, e);
            }
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
     * Sends a message to a peer's data channel.
     * Handshake messages (pre-VERIFIED) are sent as plain JSON.
     * Post-VERIFIED messages are AES-GCM encrypted with the session key when available.
     * Falls back to plain JSON if no session key is established (older peer compatibility).
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    sendRaw(targetId: string, msg: any) {
        const conn = this.connections.get(targetId);
        if (!conn) { console.warn(`[P2P] sendRaw: no connection for ${targetId}`); return; }

        const isHandshake = msg.type === 'HANDSHAKE' || msg.type === 'HANDSHAKE_ACK' || msg.type === 'HANDSHAKE_COMPLETE';

        const transmit = (payload: string) => {
            if (conn.sendFn) {
                conn.sendFn(payload);
            } else if (conn.peer) {
                try { conn.peer.send(payload); } catch (e) { console.error(`[P2P] sendRaw failed to ${targetId}:`, e); }
            } else {
                console.warn(`[P2P] sendRaw: no transport for ${targetId}`);
            }
        };

        // Encrypt post-handshake messages if a session key has been derived.
        // On encryption failure: terminate rather than fall back to plaintext —
        // AES-GCM should never fail with a valid key, so failure means a corrupt state.
        if (!isHandshake && conn.sessionKey) {
            encryptWithSession(conn.sessionKey, msg).then(transmit).catch(e => {
                console.error(`[P2P] Encryption failed for ${targetId} — terminating:`, e);
                this.terminateConnection(targetId, 'Session encryption failure');
            });
        } else {
            transmit(JSON.stringify(msg));
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    broadcast(msg: any) {
        const payload = JSON.stringify(msg);
        let sent = 0;
        this.connections.forEach((conn) => {
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onData(callback: (data: any, peerId: string) => void) {
        this.dataListeners.push(callback);
        return () => { this.dataListeners = this.dataListeners.filter(l => l !== callback); };
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    notifyDataListeners(data: any, peerId: string) {
        this.dataListeners.forEach(l => l(data, peerId));
    },

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onConnectionStatus(callback: (status: { peerId: string; status: ConnectionState; details?: any }) => void) {
        this.connectionListeners.push(callback);
        return () => { this.connectionListeners = this.connectionListeners.filter(l => l !== callback); };
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    notifyConnectionListeners(peerId: string, status: ConnectionState, details?: any) {
        this.connectionListeners.forEach(l => l({ peerId, status, details }));
    },

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
        // Enforce private IP ranges only — prevents the LAN signal path from being
        // abused to send HTTP to arbitrary internet hosts. Game data is protected by
        // WebRTC DTLS + our ECDSA handshake; this guards the initial rendezvous only.
        if (!isPrivateIp(targetIp)) {
            console.error(`[P2P] Signal rejected: ${targetIp} is not a private LAN address`);
            return;
        }
        fetch(`http://${targetIp}:${port}/signal`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        }).catch(e => {
            console.error(`[P2P] Signal fail to ${targetId}:`, e);
        });
    }
};
