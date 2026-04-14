
import { IdentityService } from './IdentityService';
import { GlobalEventStore } from './EventStore';

export const BackupService = {
    async exportProfile(): Promise<string> {
        const identity = await IdentityService.init();
        const events = GlobalEventStore.getAll();

        const backup = {
            version: 1,
            timestamp: Date.now(),
            identity: {
                nodeId: identity.nodeId,
                name: identity.name,
                franchiseId: identity.franchiseId
            },
            events
        };

        return JSON.stringify(backup, null, 2);
    },

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
