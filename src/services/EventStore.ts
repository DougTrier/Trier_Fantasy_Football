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
 * EventStore — Canonical Event Log
 * ==================================
 * Append-only, ordered log of all game-state-changing events in the league.
 * Every mutation that crosses a peer boundary (e.g. ROSTER_MOVE) is represented
 * here as an EventLogEntry rather than as a direct state mutation.
 *
 * ARCHITECTURE:
 *   - Events are identified by (author nodeId, seq number) — no central authority.
 *   - add() enforces deduplication by event.id — safe to call on both local and inbound events.
 *   - getVector() returns the latest seen seq per author — used for delta sync.
 *   - getEventsSince(vector) returns only events the caller hasn't seen — efficient sync handshake.
 *   - subscribe() allows React state or other services to react to new events.
 *
 * WHY EVENTSTORE INSTEAD OF DIRECT STATE MUTATION:
 *   Deterministic replay — two peers with the same event log will always converge
 *   to the same state regardless of network ordering or partial delivery.
 *
 * CURRENT STATUS (Hybrid Model):
 *   React state is still the active runtime truth. EventStore is the sync and
 *   audit layer. Full event-sourced state derivation is a planned future step.
 *
 * @module EventStore
 */

import type { EventLogEntry } from '../types/P2P';

/** Maximum events retained per author node. Oldest are dropped when exceeded. */
const MAX_EVENTS_PER_NODE = 500;

const STORAGE_KEY = 'trier_event_log';

export class EventStore {
    private events: EventLogEntry[] = [];
    private subscriptions: ((events: EventLogEntry[]) => void)[] = [];

    constructor() {
        this.hydrate();
    }

    /** Load persisted events from localStorage on startup. */
    private hydrate(): void {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return;
            const parsed: EventLogEntry[] = JSON.parse(raw);
            // Re-validate every stored event — reject anything corrupted
            this.events = parsed.filter(e => this.validate(e));
            this.events.sort((a, b) => a.seq - b.seq);
            console.log(`[EventStore] Hydrated ${this.events.length} events from storage.`);
        } catch (e) {
            console.warn('[EventStore] Failed to hydrate from storage — starting fresh.', e);
            this.events = [];
        }
    }

    /** Persist the current event list to localStorage. Caps per-node to MAX_EVENTS_PER_NODE. */
    private flush(): void {
        try {
            // Count events per author and drop oldest if over cap
            const byAuthor = new Map<string, EventLogEntry[]>();
            for (const e of this.events) {
                const bucket = byAuthor.get(e.author) ?? [];
                bucket.push(e);
                byAuthor.set(e.author, bucket);
            }
            const capped: EventLogEntry[] = [];
            byAuthor.forEach(bucket => {
                // bucket is already sorted (oldest first) because this.events is sorted
                const trimmed = bucket.length > MAX_EVENTS_PER_NODE
                    ? bucket.slice(bucket.length - MAX_EVENTS_PER_NODE)
                    : bucket;
                capped.push(...trimmed);
            });
            // If we trimmed anything, update the in-memory list too
            if (capped.length !== this.events.length) {
                this.events = capped.sort((a, b) => a.seq - b.seq);
            }
            localStorage.setItem(STORAGE_KEY, JSON.stringify(this.events));
        } catch (e) {
            console.warn('[EventStore] Failed to flush to storage.', e);
        }
    }

    // --- ARCHITECTURE BOUNDARY ---
    // add() is the single entry point for ALL events — both locally emitted and peer-received.
    // Deduplication and validation must remain here. Do not add events to this.events directly.
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
        this.flush();
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
