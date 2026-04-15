/**
 * BackupService — Profile Export / Import
 * =========================================
 * Serialises the node identity and full event log to JSON for backup or
 * migration between devices. The "Follower Profile" import path intentionally
 * only ingests events — it does NOT overwrite the local identity — so a user
 * can replay a teammate's history without becoming that teammate.
 */

import { IdentityService } from './IdentityService';
import { GlobalEventStore } from './EventStore';

export const BackupService = {
    /**
     * Exports the local node's identity metadata and every event it has ever
     * recorded to a JSON string. The caller is responsible for saving the string
     * (e.g. writing to file via Tauri or triggering a browser download).
     */
    async exportProfile(): Promise<string> {
        const identity = await IdentityService.init();
        const events = GlobalEventStore.getAll();

        const backup = {
            version: 1,
            timestamp: Date.now(),
            // Include only non-sensitive identity fields — private key is never exported
            identity: {
                nodeId: identity.nodeId,
                name: identity.name,
                franchiseId: identity.franchiseId
            },
            events
        };

        return JSON.stringify(backup, null, 2);
    },

    /**
     * Ingests events from a previously exported profile JSON string.
     * Duplicate events are silently dropped by GlobalEventStore.add.
     * Returns the count of newly accepted (non-duplicate) events.
     */
    async importProfile(jsonString: string): Promise<{ success: boolean, count: number }> {
        try {
            const backup = JSON.parse(jsonString);
            if (!backup.events || !Array.isArray(backup.events)) {
                throw new Error("Invalid backup format");
            }

            // In V1, we only import events. We don't overwrite identity yet unless forced.
            // "Follower Profile" implies we import SOMEONE ELSE'S data.
            // So we just ingest their events.

            let count = 0;
            backup.events.forEach((e: any) => {
                if (GlobalEventStore.add(e)) count++;
            });

            console.log(`[Backup] Imported ${count} events from profile.`);
            return { success: true, count };
        } catch (e) {
            console.error('[Backup] Import failed', e);
            throw e;
        }
    }
};
