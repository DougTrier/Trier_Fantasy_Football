
export type NodeId = string; // e.g., "TriersTitans_A1B2_2026-02-01"
export type PeerStatus = 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'SYNCING' | 'FAILED';

export interface PeerState {
    id: NodeId;
    ip: string;
    port: number;
    status: PeerStatus;
    lastSeen: number;
    latency: number; // ms
    protocolVersion: number;
    isTrusted: boolean; // Has completed Handshake
}

export type EventType =
    | 'ROSTER_MOVE'
    | 'WAIVER_CLAIM'
    | 'TRADE_PROPOSAL'
    | 'TRADE_ACCEPT'
    | 'COMMISSIONER_OVERRIDE';

export interface EventLogEntry {
    seq: number;          // Monotonically increasing per-node
    id: string;           // UUID of event
    type: EventType;
    payload: any;         // JSON payload
    ts: number;           // Wall clock time
    author: NodeId;       // Who created this
    signature: string;    // Ed25519 signature of (seq + type + payload + ts + author)
}

export interface HandshakeMsg {
    type: 'HANDSHAKE';
    nodeId: NodeId;
    publicKey: string; // Base64
    nonce: string;     // Random string to sign
    version: number;
}

export interface HandshakeAck {
    type: 'HANDSHAKE_ACK';
    nodeId: NodeId;
    signature: string; // Signed nonce
}

export interface SyncRequest {
    type: 'SYNC_REQ';
    fromSeq: number; // I have up to this seq
}

export type P2PMessage =
    | HandshakeMsg
    | HandshakeAck
    | SyncRequest
    | { type: 'EVENT', event: EventLogEntry }
    | { type: 'HEARTBEAT', ts: number };
