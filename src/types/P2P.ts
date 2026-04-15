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
 * P2P Type Definitions — Protocol Contract
 * ==========================================
 * Canonical types for the peer-to-peer networking layer.
 * These types define the wire format of every message that crosses a peer boundary.
 *
 * PROTOCOL CONSTANTS:
 *   APP_MAGIC, APP_FAMILY, PROTOCOL_VERSION — all three must match between peers
 *   or the handshake fails immediately. This is the "same app" detection layer.
 *   Changing PROTOCOL_VERSION signals a breaking wire format change.
 *
 * CONNECTION STATES:
 *   CONNECTED  ≠ trusted. Only VERIFIED peers may exchange game data.
 *   See P2PService.ts for the full state machine and trust boundary documentation.
 *
 * ⚠️  CORE ARCHITECTURE — Do not modify without opening an issue first.
 *
 * @module types/P2P
 */

// ─────────────────────────────────────────────────────────────────────────────
// Protocol Constants — both peers must match ALL THREE to be considered
// the same application. Any mismatch on handshake = immediate disconnect.
// ─────────────────────────────────────────────────────────────────────────────
export const APP_MAGIC = 'TFLP2P/1';
export const APP_FAMILY = 'trier-fantasy-football';
export const PROTOCOL_VERSION = 1;
/** Oldest version we will still speak. Peers below this are rejected. */
export const MIN_PROTOCOL_VERSION = 1;

// ─────────────────────────────────────────────────────────────────────────────
// Signal Types — WebRTC negotiation + connection control messages
// ─────────────────────────────────────────────────────────────────────────────
export type SignalType =
    | 'offer'
    | 'answer'
    | 'candidate'
    | 'CONNECT_REQUEST'
    | 'CONNECT_ACCEPT'
    | 'CONNECT_REJECT'
    | 'CONNECT_CANCEL';

// ─────────────────────────────────────────────────────────────────────────────
// Node / Peer Types
// ─────────────────────────────────────────────────────────────────────────────
export type NodeId = string; // e.g., "TriersTitans_A1B2_2026-02-01"

/**
 * Peer lifecycle states.
 *
 * Transport states (WebRTC layer):
 *   DISCONNECTED → CONNECTING → CONNECTED → VERIFYING → VERIFIED
 *
 * IMPORTANT: CONNECTED means the WebRTC data channel is open.
 * It does NOT mean the peer is trusted or verified.
 * Only VERIFIED peers may send or receive game data.
 */
export type PeerStatus =
    | 'DISCONNECTED'
    | 'CONNECTING'
    | 'CONNECTED'   // WebRTC open — handshake NOT yet done
    | 'VERIFYING'   // Handshake in progress
    | 'VERIFIED'    // Both sides signed — safe to sync data
    | 'SYNCING'
    | 'FAILED';

export interface PeerState {
    id: NodeId;
    ip: string;
    port: number;
    status: PeerStatus;
    lastSeen: number;
    latency: number; // ms
    protocolVersion: number;
    isTrusted: boolean; // true only when status === 'VERIFIED'
}

// ─────────────────────────────────────────────────────────────────────────────
// Event Log
// ─────────────────────────────────────────────────────────────────────────────
export type EventType =
    | 'ROSTER_MOVE'
    | 'WAIVER_CLAIM'
    | 'TRADE_PROPOSAL'
    | 'TRADE_ACCEPT'
    | 'COMMISSIONER_OVERRIDE';

export interface EventLogEntry {
    seq: number;        // Monotonically increasing per-node
    id: string;         // UUID of event
    type: EventType;
    payload: unknown;   // JSON payload
    ts: number;         // Wall clock time (ms)
    author: NodeId;     // Who created this
    signature: string;  // Base64: ECDSA P-256 signature of (seq|type|payload|ts|author)
}

// ─────────────────────────────────────────────────────────────────────────────
// Handshake Protocol — 3-message mutual authentication
//
// Flow:
//   Initiator → Responder : HANDSHAKE    (with initiator's nonce_A)
//   Responder → Initiator : HANDSHAKE_ACK (signed nonce_A + responder's nonce_B)
//   Initiator → Responder : HANDSHAKE_COMPLETE (signed nonce_B)
//
// After HANDSHAKE_ACK:  Initiator marks responder VERIFIED (checked sig of nonce_A)
// After HANDSHAKE_COMPLETE: Responder marks initiator VERIFIED (checked sig of nonce_B)
// ─────────────────────────────────────────────────────────────────────────────

/** Step 1: Initiator → Responder */
export interface HandshakeMsg {
    type: 'HANDSHAKE';
    magic: string;            // Must equal APP_MAGIC
    app_family: string;       // Must equal APP_FAMILY
    protocol_version: number; // Must equal PROTOCOL_VERSION
    nodeId: NodeId;
    publicKey: string;        // Base64-encoded SPKI public key (ECDSA P-256)
    nonce: string;            // Random UUID — responder must sign this to prove key ownership
    peerUuid?: string;        // Stable install UUID — safe to share, used for friends matching
}

/** Step 2: Responder → Initiator */
export interface HandshakeAck {
    type: 'HANDSHAKE_ACK';
    nodeId: NodeId;
    publicKey: string;         // Responder's Base64-encoded SPKI public key
    signedNonce: string;       // Base64: ECDSA P-256 signature of initiator's nonce
    nonce: string;             // Responder's own nonce — initiator must sign this
    protocol_version?: number; // Responder's native version — initiator computes agreed version
    peerUuid?: string;         // Stable install UUID — echoed back so initiator learns responder's UUID
}

/** Step 3: Initiator → Responder */
export interface HandshakeComplete {
    type: 'HANDSHAKE_COMPLETE';
    nodeId: NodeId;
    signedNonce: string;  // Base64: ECDSA P-256 signature of responder's nonce
}

// ─────────────────────────────────────────────────────────────────────────────
// Sync Protocol
// ─────────────────────────────────────────────────────────────────────────────
export interface SyncRequest {
    type: 'SYNC_REQ';
    fromSeq: number; // I have events up to this seq — send me everything after
}

// ─────────────────────────────────────────────────────────────────────────────
// Full P2P Message Union
// ─────────────────────────────────────────────────────────────────────────────
export type P2PMessage =
    | HandshakeMsg
    | HandshakeAck
    | HandshakeComplete
    | SyncRequest
    | { type: 'EVENT'; event: EventLogEntry }
    | { type: 'HEARTBEAT'; ts: number; leagues?: string[] };
