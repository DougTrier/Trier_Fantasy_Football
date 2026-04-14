
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { EventStore } from '../../src/services/EventStore';
import { EventLogEntry } from '../../src/types/P2P';

describe('EventStore', () => {
    it('should add valid events', () => {
        const store = new EventStore();
        const event: EventLogEntry = {
            seq: 1,
            id: 'test-1',
            type: 'ROSTER_MOVE',
            payload: {},
            ts: Date.now(),
            author: 'node-1',
            signature: 'sig'
        };
        assert.strictEqual(store.add(event), true);
        assert.strictEqual(store.getAll().length, 1);
    });

    it('should reject invalid events (bad seq)', () => {
        const store = new EventStore();
        const event: EventLogEntry = {
            seq: 0, // Invalid
            id: 'test-2',
            type: 'ROSTER_MOVE',
            payload: {},
            ts: Date.now(),
            author: 'node-1',
            signature: 'sig'
        };
        assert.strictEqual(store.add(event), false);
    });

    it('should reject duplicates', () => {
        const store = new EventStore();
        const event: EventLogEntry = {
            seq: 1,
            id: 'unique-id',
            type: 'ROSTER_MOVE',
            payload: {},
            ts: Date.now(),
            author: 'node-1',
            signature: 'sig'
        };
        store.add(event);
        assert.strictEqual(store.add(event), false);
        assert.strictEqual(store.getAll().length, 1);
    });
});
