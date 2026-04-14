import { P2PService } from './P2PService';
import { GlobalEventStore } from './EventStore';

export const SyncService = {
    init() {
        P2PService.onData((msg: any, peerId: string) => {
            this.handleMessage(msg, peerId);
        });

        // Auto-Sync on Connect
        P2PService.onConnectionStatus(({ peerId, status }) => {
            if (status === 'CONNECTED') {
                this.requestSync(peerId);
            }
        });
    },

    requestSync(peerId: string) {
        console.log(`[Sync] Requesting Sync from ${peerId}`);
        const vector = GlobalEventStore.getVector();
        P2PService.sendData(peerId, {
            type: 'SYNC_REQUEST',
            vector
        });
    },

    handleMessage(msg: any, peerId: string) {
        if (!msg.type) return;

        if (msg.type === 'SYNC_REQUEST') {
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
