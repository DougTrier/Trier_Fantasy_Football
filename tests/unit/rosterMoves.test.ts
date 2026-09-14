import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { applyRosterMoveEvent, validateRosterMove, preservesLockedPlayers } from '../../src/utils/rosterMoves';
import type { RosterMovePayload } from '../../src/utils/rosterMoves';
import type { FantasyTeam, Player } from '../../src/types';
import type { EventLogEntry } from '../../src/types/P2P';

const player = (id: string, team: string) => ({ id, team, position: 'QB' } as Player);
const teams = [{ id: 'coach', roster: { qb: player('starter', 'KC') }, bench: [player('bench', 'BUF')] }] as FantasyTeam[];
const event = (overrides: Partial<RosterMovePayload> = {}) => ({ type: 'ROSTER_MOVE', payload: {
    teamId: 'coach', candidatePlayerId: 'starter', sourceSlot: 'qb', targetSlot: 'bench-0', targetPlayerId: null, ...overrides,
} } as EventLogEntry);

describe('Incoming roster move validation', () => {
    it('rejects locked candidates without changing the roster', () => {
        assert.equal(validateRosterMove(teams, event(), ['KC']), false);
        assert.equal(applyRosterMoveEvent(teams, event(), ['KC']), teams);
    });
    it('rejects swaps with a locked target', () => {
        assert.equal(validateRosterMove(teams, event({ candidatePlayerId: 'bench', sourceSlot: null, targetPlayerId: 'starter', targetSlot: 'qb' }), ['KC']), false);
    });
    it('cannot disguise an occupied locked slot as an empty destination', () => {
        assert.equal(validateRosterMove(teams, event({ candidatePlayerId: 'bench', sourceSlot: null, targetSlot: 'qb' }), ['KC']), false);
    });
    it('rejects a forged source slot', () => {
        assert.equal(validateRosterMove(teams, event({ candidatePlayerId: 'bench', sourceSlot: 'qb' }), []), false);
    });
    it('accepts legal unlocked moves, preserving the input', () => {
        const next = applyRosterMoveEvent(teams, event(), []);
        assert.equal(next[0].roster.qb, null);
        assert.equal(next[0].bench.length, 2);
        assert.equal(teams[0].roster.qb?.id, 'starter');
    });
    it('rejects malformed or missing targets', () => {
        assert.equal(validateRosterMove(teams, event({ targetPlayerId: 'missing' }), []), false);
        assert.equal(validateRosterMove(teams, event({ targetSlot: '__proto__' }), []), false);
        assert.equal(validateRosterMove(teams, { payload: null } as EventLogEntry, []), false);
    });
    it('blocks full-state snapshots from moving or removing locked players', () => {
        const moved = applyRosterMoveEvent(teams, event(), []);
        assert.equal(preservesLockedPlayers(teams, moved, ['KC']), false);
        assert.equal(preservesLockedPlayers(teams, [], ['KC']), false);
        assert.equal(preservesLockedPlayers(teams, teams, ['KC']), true);
        assert.equal(preservesLockedPlayers(teams, moved, []), true);
    });
    it('allows score updates without moving locked players', () => {
        const updated = structuredClone(teams);
        updated[0].roster.qb!.projectedPoints = 25;
        assert.equal(preservesLockedPlayers(teams, updated, ['KC']), true);
    });
});
