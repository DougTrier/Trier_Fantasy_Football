import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
// Workflow scripts run directly in Node, outside the app's TypeScript build.
import { runReminder, upcomingGameDays } from '../../scripts/gameday_reminder.mjs';

const now = Date.parse('2026-09-13T10:17:00Z');
const game = (date = '2026-09-13T17:00:00Z', state = 'pre') => ({ id: 'game1', name: 'KC at SF', date, competitions: [{ status: { type: { state } } }] });
function api(existing: { body: string }[] = []) {
    const created: { body: string; title: string }[] = [];
    return { created, github: { paginate: async () => existing, rest: { issues: { listForRepo() {}, create: async (issue: { body: string; title: string }) => { created.push(issue); } } } } };
}
describe('Game-day reminders', () => {
    it('skips empty schedules and games that already started', () => {
        assert.deepEqual(upcomingGameDays({ events: [] }, now), []);
        assert.deepEqual(upcomingGameDays({ events: [game('2026-09-13T09:00:00Z')] }, now), []);
        assert.deepEqual(upcomingGameDays({ events: [game(undefined, 'in')] }, now), []);
    });
    it('uses actual Eastern game dates and DST-aware kickoff labels', () => {
        const [summer] = upcomingGameDays({ events: [game('2026-09-14T00:20:00Z')] }, now);
        assert.equal(summer.date, '2026-09-13');
        assert.match(summer.games[0].description, /8:20 PM EDT/);
        const [winter] = upcomingGameDays({ events: [game('2026-12-14T01:20:00Z')] }, Date.parse('2026-12-13T10:17:00Z'));
        assert.equal(winter.date, '2026-12-13');
        assert.match(winter.games[0].description, /8:20 PM EST/);
    });
    it('deduplicates against closed as well as open reminders', async () => {
        const { github, created } = api([{ body: '<!-- gameday-reminder:2026-09-13 -->' }]);
        assert.equal(await runReminder({ github, context: { repo: { owner: 'test', repo: 'test' } }, now,
            fetchImpl: async () => ({ ok: true, json: async () => ({ events: [game()] }) }) }), 0);
        assert.equal(created.length, 0);
    });
    it('creates one truthful advisory per game date and treats notes as text', async () => {
        const { github, created } = api();
        await runReminder({ github, context: { repo: { owner: 'test', repo: 'test' } }, now, note: "Coach's check",
            fetchImpl: async () => ({ ok: true, json: async () => ({ events: [game(), game('2026-09-13T20:05:00Z')] }) }) });
        assert.equal(created.length, 1);
        assert.match(created[0].body, /GitHub cannot inspect your app/);
        assert.match(created[0].body, /Coach's check/);
        assert.match(created[0].title, /2026-09-13/);
    });
    it('creates nothing on API failure', async () => {
        const { github, created } = api();
        await assert.rejects(runReminder({ github, context: { repo: {} }, now, fetchImpl: async () => ({ ok: false, status: 503 }) }), /503/);
        assert.equal(created.length, 0);
    });
});
