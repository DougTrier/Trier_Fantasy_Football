
import type { EventLogEntry } from '../types/P2P';

export class EventStore {
    private events: EventLogEntry[] = [];
    private subscriptions: ((events: EventLogEntry[]) => void)[] = [];

    constructor() {
        // Load from storage if needed in future (PR5)
    }

    public add(event: EventLogEntry): boolean {
        if (!this.validate(event)) {
            console.error('[EventStore] Invalid event rejected:', event);
            return false;
        }

        // Duplicate Check
        if (this.events.some(e => e.id === event.id)) {
            console.warn('[EventStore] Duplicate event ignored:', event.id);
            return false;
        }

        this.events.push(event);
        this.events.sort((a, b) => a.seq - b.seq); // Keep ordered
        this.notify();
        return true;
    }

    public getEventsSince(vector: Record<string, number>): EventLogEntry[] {
        return this.events.filter(e => {
            const lastSeen = vector[e.author] || 0;
            return e.seq > lastSeen;
        });
    }

    public getVector(): Record<string, number> {
        const vector: Record<string, number> = {};
        for (const e of this.events) {
            if (!vector[e.author] || e.seq > vector[e.author]) {
                vector[e.author] = e.seq;
            }
        }
        return vector;
    }

    public getAll(): EventLogEntry[] {
        return [...this.events];
    }

    public getLatestSeq(): number {
        if (this.events.length === 0) return 0;
        return this.events[this.events.length - 1].seq;
    }

    private validate(event: EventLogEntry): boolean {
        if (!event.id || !event.type || !event.author || !event.signature) return false;
        if (event.seq < 1) return false;
        if (event.ts > Date.now() + 60000) return false; // Future check 1min buffer
        return true;
    }

    public subscribe(callback: (events: EventLogEntry[]) => void) {
        this.subscriptions.push(callback);
        return () => {
            this.subscriptions = this.subscriptions.filter(s => s !== callback);
        };
    }

    private notify() {
        this.subscriptions.forEach(sub => sub(this.events));
    }
}

export const GlobalEventStore = new EventStore();
