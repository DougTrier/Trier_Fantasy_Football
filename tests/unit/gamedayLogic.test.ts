/**
 * gamedayLogic Unit Tests
 * =======================
 * Tests the game day locking rules — the anti-cheat mechanism that prevents
 * lineup changes once a player's NFL team has kicked off.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isPlayerLocked, getAutomaticLockedTeams, NFL_TEAMS } from '../../src/utils/gamedayLogic';
import type { Player } from '../../src/types';

// ─── Fixture builders ─────────────────────────────────────────────────────────

function makePlayer(overrides: Partial<Player> = {}): Player {
    return {
        id: 'p1',
        name: 'Test Player',
        position: 'QB',
        team: 'KC',
        espnId: '',
        stats: {},
        ...overrides,
    } as Player;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('isPlayerLocked', () => {
    it('returns false when lockedTeams is empty', () => {
        const player = makePlayer({ team: 'KC' });
        assert.equal(isPlayerLocked(player, []), false);
    });

    it('returns true when player team is in lockedTeams', () => {
        const player = makePlayer({ team: 'KC' });
        assert.equal(isPlayerLocked(player, ['KC', 'SF']), true);
    });

    it('returns false when player team is NOT in lockedTeams', () => {
        const player = makePlayer({ team: 'BUF' });
        assert.equal(isPlayerLocked(player, ['KC', 'SF']), false);
    });

    it('is case-insensitive (normalizes team to uppercase)', () => {
        const player = makePlayer({ team: 'kc' }); // lowercase team
        assert.equal(isPlayerLocked(player, ['KC']), true);
    });

    it('returns false for a null player', () => {
        assert.equal(isPlayerLocked(null, ['KC']), false);
    });

    it('returns false for player with no team match', () => {
        const player = makePlayer({ team: 'NE' });
        assert.equal(isPlayerLocked(player, ['KC', 'SF', 'BUF', 'DAL']), false);
    });

    it('handles all 32 teams locked (commissioner locks all)', () => {
        const player = makePlayer({ team: 'LV' });
        assert.equal(isPlayerLocked(player, NFL_TEAMS), true);
    });
});

describe('getAutomaticLockedTeams', () => {
    it('returns all 32 teams on Sunday (game day)', () => {
        const sunday = new Date('2026-09-13T12:00:00'); // A Sunday
        assert.equal(sunday.getDay(), 0, 'should be Sunday');
        const locked = getAutomaticLockedTeams(sunday);
        assert.equal(locked.length, NFL_TEAMS.length);
    });

    it('returns all 32 teams on Monday (MNF)', () => {
        const monday = new Date('2026-09-14T20:00:00'); // A Monday
        assert.equal(monday.getDay(), 1, 'should be Monday');
        const locked = getAutomaticLockedTeams(monday);
        assert.equal(locked.length, NFL_TEAMS.length);
    });

    it('returns empty array on Tuesday (no games)', () => {
        const tuesday = new Date('2026-09-15T12:00:00');
        assert.equal(tuesday.getDay(), 2, 'should be Tuesday');
        const locked = getAutomaticLockedTeams(tuesday);
        assert.equal(locked.length, 0);
    });

    it('returns empty array on Wednesday', () => {
        const wednesday = new Date('2026-09-16T12:00:00');
        const locked = getAutomaticLockedTeams(wednesday);
        assert.equal(locked.length, 0);
    });

    it('returns empty array on Saturday (no auto-lock — TNF handled manually)', () => {
        const saturday = new Date('2026-09-19T12:00:00');
        const locked = getAutomaticLockedTeams(saturday);
        assert.equal(locked.length, 0);
    });
});

describe('NFL_TEAMS constant', () => {
    it('contains exactly 32 teams', () => {
        assert.equal(NFL_TEAMS.length, 32);
    });

    it('all entries are uppercase abbreviations', () => {
        for (const team of NFL_TEAMS) {
            assert.equal(team, team.toUpperCase(), `${team} should be uppercase`);
            assert.ok(team.length >= 2 && team.length <= 3, `${team} length should be 2-3 chars`);
        }
    });

    it('contains expected teams', () => {
        const expected = ['KC', 'BUF', 'SF', 'PHI', 'DAL', 'NE', 'GB', 'SEA'];
        for (const team of expected) {
            assert.ok(NFL_TEAMS.includes(team), `should include ${team}`);
        }
    });

    it('has no duplicate entries', () => {
        const unique = new Set(NFL_TEAMS);
        assert.equal(unique.size, NFL_TEAMS.length, 'no duplicate team codes');
    });
});
