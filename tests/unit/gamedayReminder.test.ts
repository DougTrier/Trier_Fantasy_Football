import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
// Workflow scripts run directly in Node, outside the app's TypeScript build.
import { fetchUpcomingGameDays, runReminder, upcomingGameDays } from '../../scripts/gameday_reminder.mjs';

const now = Date.parse('2026-09-13T10:17:00Z');
const game = (date = '2026-09-13T17:00:00Z', state = 'pre') => ({ id: date, name: 'KC at SF', date, competitions: [{ status: { type: { state } } }] });
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
        await assert.rejects(runReminder({ github, context: { repo: {} }, now, sleep: async () => {}, fetchImpl: async () => ({ ok: false, status: 503 }) }), /503/);
        assert.equal(created.length, 0);
    });
    it('uses single Eastern dates and includes late-night games after UTC midnight', async () => {
        const urls: string[] = [];
        const days = await fetchUpcomingGameDays({ now: Date.parse('2026-09-14T00:00:00Z'),
            fetchImpl: async (url: string) => {
                urls.push(url);
                // Reproduce the production provider failure for any range query.
                if (!/dates=\d{8}$/.test(url)) return { ok: false, status: 400 };
                return { ok: true, json: async () => ({ events: url.endsWith('20260913') ? [game('2026-09-14T00:20:00Z')] : [] }) };
            } });
        assert.deepEqual(urls.map(url => new URL(url).searchParams.get('dates')), ['20260913', '20260914']);
        assert.equal(days[0].date, '2026-09-13');
        assert.equal(days[0].games.length, 1);
    });
    it('covers all three Eastern dates touched by a spring DST 24-hour window', async () => {
        const dates: string[] = [];
        await fetchUpcomingGameDays({ now: Date.parse('2026-03-08T04:30:00Z'), fetchImpl: async (url: string) => {
            dates.push(new URL(url).searchParams.get('dates')!);
            return { ok: true, json: async () => ({ events: [] }) };
        } });
        assert.deepEqual(dates, ['20260307', '20260308', '20260309']);
    });
    it('merges adjacent responses once and retains the exact 24-hour boundary', async () => {
        const days = await fetchUpcomingGameDays({ now, fetchImpl: async () => ({ ok: true, json: async () => ({ events: [
            game(), game(new Date(now).toISOString()), game(new Date(now + 86400000).toISOString()),
            game(new Date(now + 86400001).toISOString()), game('2026-09-13T18:00:00Z', 'in'),
        ] }) }) });
        assert.equal(days.flatMap(day => day.games).length, 2);
    });
    it('retries only transient fetch failures with a bounded backoff', async () => {
        for (const failure of [429, 503, 'network']) {
            let calls = 0;
            const waits: number[] = [];
            const days = await fetchUpcomingGameDays({ now, sleep: async (ms: number) => { waits.push(ms); },
                fetchImpl: async () => {
                    if (++calls <= 2) {
                        if (failure === 'network') throw new Error('connection reset');
                        return { ok: false, status: failure };
                    }
                    return { ok: true, json: async () => ({ events: [] }) };
                } });
            assert.deepEqual(days, []);
            assert.deepEqual(waits, [500, 1000]);
            assert.equal(calls, 4);
        }
    });
    it('does not retry HTTP 400 or write issues after a partial schedule failure', async () => {
        for (const status of [400, 503, 'malformed', 'network']) {
            const { github, created } = api();
            let calls = 0;
            let reads = 0;
            github.paginate = async () => { reads++; return []; };
            await assert.rejects(runReminder({ github, context: { repo: {} }, now, sleep: async () => {},
                fetchImpl: async () => {
                    if (++calls === 1) return { ok: true, json: async () => ({ events: [game()] }) };
                    if (status === 'network') throw new Error('timeout');
                    if (status === 'malformed') return { ok: true, json: async () => ({}) };
                    return { ok: false, status };
                } }), /no reminder created/);
            assert.equal(calls, status === 503 || status === 'network' ? 4 : 2);
            assert.equal(created.length, 0);
            assert.equal(reads, 0);
        }
    });
});
