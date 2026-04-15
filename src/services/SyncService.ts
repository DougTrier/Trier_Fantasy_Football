/**
 * SyncService (services layer) — P2P Delta Event Synchroniser
 * =============================================================
 * Handles the lower-level SYNC_REQUEST / SYNC_RESPONSE protocol over
 * the P2PService WebRTC data channel. This is the services-layer companion
 * to the sideband SyncService in utils/; they operate on different transports.
 *
 * Protocol:
 *   1. On connect, request a delta by sending our current vector clock.
 *   2. Peer responds with only the events we haven't seen yet.
 *   3. Inbound events are added to GlobalEventStore (deduplicated internally).
 *
 * NOTE: This service does NOT perform signature verification — that responsibility
 * belongs to the App.tsx SYNC_RESPONSE handler which operates post-VERIFIED.
 */
import { P2PService } from './P2PService';
import { GlobalEventStore } from './EventStore';

export const SyncService = {
    /** Wire up P2P data and connection listeners. Call once at app startup. */
    init() {
        P2PService.onData((msg: any, peerId: string) => {
            this.handleMessage(msg, peerId);
        });

        // Auto-Sync on Connect — kicks off delta exchange immediately after transport connects
        P2PService.onConnectionStatus(({ peerId, status }) => {
            if (status === 'CONNECTED') {
                this.requestSync(peerId);
            }
        });
    },

    /**
     * Sends our current vector clock to a peer so they can compute
     * which events we're missing and reply with only the delta.
     */
    requestSync(peerId: string) {
        console.log(`[Sync] Requesting Sync from ${peerId}`);
        const vector = GlobalEventStore.getVector();
        P2PService.sendData(peerId, {
            type: 'SYNC_REQUEST',
            vector
        });
    },

    /** Dispatches incoming P2P messages to the appropriate handler. */
    handleMessage(msg: any, peerId: string) {
        if (!msg.type) return;

        if (msg.type === 'SYNC_REQUEST') {
            // Peer shared their vector — compute delta and send back only what they lack
            const { vector } = msg;
            const events = GlobalEventStore.getEventsSince(vector || {});
            console.log(`[Sync] Received Request from ${peerId}. Sending ${events.length} events.`);

            P2PService.sendData(peerId, {
                type: 'SYNC_RESPONSE',
                events
            });
            return;
        }

        if (msg.type === 'SYNC_RESPONSE') {
            // Ingest each event; GlobalEventStore.add is idempotent for duplicates
            const { events } = msg;
            if (Array.isArray(events)) {
                let count = 0;
                events.forEach(e => {
                    if (GlobalEventStore.add(e)) count++;
                });
                if (count > 0) console.log(`[Sync] Ingested ${count} new events.`);
            }
        }
    }
};
