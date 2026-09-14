import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { GameLockStore, GAME_LOCK_STORAGE_KEY } from '../../src/services/GameLockStore';
import { fetchLiveGameData, parseScoreboard } from '../../src/utils/gamedayLogic';

const kickoff = Date.parse('2026-09-13T17:00:00Z');
function scoreboard(state = 'pre', teams = ['KC', 'SF']) {
    return { events: [{ date: new Date(kickoff).toISOString(), competitions: [{
        status: { type: { state }, period: 1, clock: 900 },
        competitors: teams.map(abbreviation => ({ team: { abbreviation } })),
    }] }] };
}

describe('Game lock persistence and schedule boundaries', () => {
    it('preserves manual locks through an empty successful refresh and reload', () => {
        const values = new Map<string, string>();
        const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
        const store = new GameLockStore(storage);
        store.setManual(['BUF'], true);
        store.accept(parseScoreboard({ events: [] }));
        assert.deepEqual(new GameLockStore(storage).getLockedTeams(), ['BUF']);
        assert.ok(values.has(GAME_LOCK_STORAGE_KEY));
    });
    it('migrates legacy locks without discarding them', () => {
        const store = new GameLockStore({ getItem: key => key === 'trier_locked_nfl_teams' ? '["KC"]' : null, setItem() {} });
        store.accept(parseScoreboard({ events: [] }));
        assert.deepEqual(store.getLockedTeams(), ['KC']);
    });
    it('rejects manual changes by a non-commissioner', () => {
        const store = new GameLockStore();
        store.setManual(['KC'], true);
        assert.equal(store.setManual([], false), false);
        assert.deepEqual(store.getLockedTeams(), ['KC']);
    });
    it('locks at cached kickoff without another fetch, including Saturday games', () => {
        const store = new GameLockStore();
        store.accept(parseScoreboard(scoreboard(), kickoff - 1000));
        assert.deepEqual(store.getLockedTeams(kickoff - 1), []);
        assert.deepEqual(store.getLockedTeams(kickoff), ['KC', 'SF']);
        assert.deepEqual(store.getLockedTeams(kickoff + 3600000), ['KC', 'SF']);
    });
    it('clearing manual locks cannot unlock an active game, but a final can', () => {
        const store = new GameLockStore();
        store.accept(parseScoreboard(scoreboard('in')));
        store.setManual(['BUF'], true);
        store.setManual([], true);
        assert.deepEqual(store.getLockedTeams(), ['KC', 'SF']);
        store.accept(parseScoreboard(scoreboard('post')));
        assert.deepEqual(store.getLockedTeams(), []);
    });
    it('normalizes ESPN aliases to the app team codes', () => {
        assert.deepEqual(parseScoreboard(scoreboard('in', ['WSH', 'LA'])).lockedTeams, ['WAS', 'LAR']);
    });
    it('rejects malformed responses instead of treating them as no games', () => {
        assert.throws(() => parseScoreboard({}));
        assert.throws(() => parseScoreboard({ events: [{}] }));
        assert.throws(() => parseScoreboard(scoreboard('unknown')));
    });
    it('propagates API failure so active locks are retained', async () => {
        const store = new GameLockStore();
        store.accept(parseScoreboard(scoreboard('in')));
        const original = globalThis.fetch;
        globalThis.fetch = async () => new Response('', { status: 503 });
        try { await assert.rejects(async () => store.accept(await fetchLiveGameData()), /503/); }
        finally { globalThis.fetch = original; }
        assert.deepEqual(store.getLockedTeams(), ['KC', 'SF']);
    });
});
