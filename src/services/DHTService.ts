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
 * DHTService — Internet-Wide Peer Discovery via Trystero
 * ======================================================
 * Enables peers to find each other anywhere on the internet using their
 * stable Peer UUID — similar in concept to BitTorrent DHT, but implemented
 * via Trystero's Nostr-relay WebRTC signaling.
 *
 * DISCOVERY MODEL:
 *   Every running instance joins a Trystero room keyed to its own UUID.
 *   When a friend's UUID is known, we also join THAT room.
 *   Since friends do the same for each other, they will both be in at least
 *   one shared room and WebRTC will connect them automatically.
 *
 * HANDSHAKE:
 *   Once the WebRTC channel is open (handled entirely by Trystero), we
 *   immediately inject it into P2PService via injectDHTConnection(). The
 *   same 3-message ECDSA handshake that runs over LAN then runs over this
 *   channel — ensuring cryptographic mutual authentication before any game
 *   data is exchanged.
 *
 * DEDUPLICATION:
 *   connectedTrysteroIds tracks active Trystero peer IDs across all rooms so
 *   that reconnecting via a second shared room doesn't double-create a session.
 *
 * ⚠️  CORE ARCHITECTURE — Do not modify without opening an issue first.
 *
 * @module DHTService
 */

import { joinRoom, selfId } from 'trystero';
import type { Room } from '@trystero-p2p/core';
import { APP_FAMILY } from '../types/P2P';
import { P2PService } from './P2PService';

// ─────────────────────────────────────────────────────────────────────────────
// Module-level state — persists across DHTService method calls
// ─────────────────────────────────────────────────────────────────────────────

/** roomId → Trystero Room handle */
const rooms = new Map<string, Room>();

/**
 * Trystero peerId → tempId used in P2PService connections map.
 * Allows receiveDHTData routing after the initial inject.
 */
const trysteroToTemp = new Map<string, string>();

/**
 * Set of Trystero peer IDs currently connected.
 * Guards against duplicate connections when the same peer is in multiple rooms.
 */
const connectedTrysteroIds = new Set<string>();

// ─────────────────────────────────────────────────────────────────────────────
// DHTService
// ─────────────────────────────────────────────────────────────────────────────

export const DHTService = {
    myUuid: '' as string,
    _ready: false,

    /**
     * Start DHT presence: join the room keyed to our own UUID so others can find us.
     * Safe to call multiple times — idempotent if called with the same UUID.
     *
     * No-op in HTTP dev mode: Trystero requires crypto.subtle (Nostr event signing),
     * which is only available in secure contexts (HTTPS, Tauri). This mirrors the
     * same guard used in IdentityService.
     */
    init(myUuid: string): void {
        if (!crypto?.subtle) {
            console.log('[DHT] crypto.subtle unavailable (HTTP dev mode — expected). DHT disabled.');
            return;
        }
        if (this._ready && this.myUuid === myUuid) return;
        this._ready = true;
        this.myUuid = myUuid;
        console.log('[DHT] Initializing. Announcing on room:', myUuid.slice(0, 8), '...');
        this._watch(myUuid);
    },

    /**
     * Join a friend's room so we can discover them when they come online.
     * Also causes them to discover us (they're watching their own room).
     */
    watchFriend(friendUuid: string): void {
        if (!this._ready) return; // silently skip — DHT disabled in dev mode
        if (rooms.has(friendUuid)) return; // already watching
        console.log('[DHT] Watching friend room:', friendUuid.slice(0, 8), '...');
        this._watch(friendUuid);
    },

    /**
     * Stop watching a friend's room (e.g., after they're removed from the friends list).
     * Never removes the self-room (own UUID).
     */
    stopWatchingFriend(friendUuid: string): void {
        if (!this._ready) return;
        if (friendUuid === this.myUuid) return;
        const room = rooms.get(friendUuid);
        if (room) {
            room.leave().catch(() => {});
            rooms.delete(friendUuid);
            console.log('[DHT] Left friend room:', friendUuid.slice(0, 8), '...');
        }
    },

    /** Returns the number of Trystero rooms currently joined. */
    roomCount(): number {
        return rooms.size;
    },

    // ─────────────────────────────────────────────────────────────────────────
    // Internal
    // ─────────────────────────────────────────────────────────────────────────

    _watch(roomId: string): void {
        const room = joinRoom({ appId: APP_FAMILY }, roomId);
        rooms.set(roomId, room);

        // Each room shares the same 'p2p' action namespace.
        // Trystero ensures the underlying RTCPeerConnection is deduplicated per peer pair,
        // so data sent via any room's sendAction reaches the peer via the shared channel.
        const [sendMsg, recvMsg] = room.makeAction<string>('p2p');

        room.onPeerJoin((trysteroId: string) => {
            // Deduplicate — if already connected via another room, skip
            if (connectedTrysteroIds.has(trysteroId)) return;
            connectedTrysteroIds.add(trysteroId);

            // Stable temp ID used as the map key in P2PService until handshake reveals real nodeId
            const tempId = `dht:${trysteroId.slice(0, 12)}`;
            trysteroToTemp.set(trysteroId, tempId);

            // Deterministic initiator: lexicographically smaller selfId goes first
            const isInitiator = selfId < trysteroId;

            console.log(`[DHT] Peer joined room ${roomId.slice(0, 8)}: trysteroId ${trysteroId.slice(0, 8)} | initiator: ${isInitiator}`);

            P2PService.injectDHTConnection(
                tempId,
                (data: string) => { sendMsg(data, trysteroId); },
                isInitiator,
            );
        });

        recvMsg((data: string, trysteroId: string) => {
            const tempId = trysteroToTemp.get(trysteroId);
            if (tempId) {
                P2PService.receiveDHTData(tempId, data).catch(e =>
                    console.error('[DHT] receiveDHTData error:', e)
                );
            }
        });

        room.onPeerLeave((trysteroId: string) => {
            const tempId = trysteroToTemp.get(trysteroId);
            if (tempId) {
                P2PService.terminateConnection(tempId, 'DHT peer disconnected');
                trysteroToTemp.delete(trysteroId);
            }
            connectedTrysteroIds.delete(trysteroId);
            console.log(`[DHT] Peer left: ${trysteroId.slice(0, 8)}`);
        });
    },
};
