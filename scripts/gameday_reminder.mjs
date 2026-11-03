/** One advisory per actual NFL game date. Safe to rerun, even after issue closure. */
export function upcomingGameDays(data, now = Date.now()) {
    if (!Array.isArray(data?.events)) throw new Error('Invalid NFL scoreboard');
    const days = new Map();
    const dateFormat = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' });
    const timeFormat = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' });
    for (const event of data.events) {
        const game = event.competitions?.[0];
        const status = game?.status?.type;
        const kickoff = Date.parse(game?.date ?? event.date);
        if (!Number.isFinite(kickoff) || status?.state !== 'pre' ||
            /postponed|canceled|cancelled/i.test(status?.name ?? '') ||
            kickoff <= now || kickoff > now + 24 * 60 * 60 * 1000) continue;
        const date = dateFormat.format(new Date(kickoff));
        const games = days.get(date) ?? [];
        games.push({ id: event.id, kickoff, description: `${event.name ?? 'NFL game'} — ${timeFormat.format(new Date(kickoff))}` });
        days.set(date, games);
    }
    return [...days].map(([date, games]) => ({ date, games: games.sort((a, b) => a.kickoff - b.kickoff) }));
}

/** Fetch every Eastern calendar date touched by the next 24 hours before writing issues.
 * ESPN's NFL scoreboard rejects date ranges with HTTP 400; single dates also
 * preserve late-night games whose Eastern date differs from their UTC date.
 */
export async function fetchUpcomingGameDays({ now = Date.now(), fetchImpl = fetch, sleep = ms => new Promise(resolve => setTimeout(resolve, ms)) } = {}) {
    const format = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' });
    const first = Date.parse(`${format.format(new Date(now))}T00:00:00Z`);
    const last = Date.parse(`${format.format(new Date(now + 86400000))}T00:00:00Z`);
    const events = new Map();
    // Calendar arithmetic in UTC avoids skipping a date across the spring DST change.
    for (let date = first; date <= last; date += 86400000) {
        const stamp = new Date(date).toISOString().slice(0, 10).replaceAll('-', '');
        const url = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates=${stamp}`;
        let response;
        for (let attempt = 0; attempt < 3; attempt++) {
            try {
                response = await fetchImpl(url, { signal: AbortSignal.timeout(10000) });
            } catch (error) {
                if (attempt === 2) throw new Error(`NFL schedule request failed for ${stamp}; no reminder created`, { cause: error });
                await sleep(500 * 2 ** attempt);
                continue;
            }
            if (response.ok) break;
            if (attempt === 2 || (response.status !== 429 && response.status < 500)) {
                throw new Error(`NFL schedule returned ${response.status} for ${stamp}; no reminder created`);
            }
            await sleep(500 * 2 ** attempt);
        }
        const data = await response.json();
        if (!Array.isArray(data?.events)) throw new Error(`Invalid NFL scoreboard for ${stamp}; no reminder created`);
        for (const event of data.events) {
            // A provider may include the same event in adjacent scoreboards.
            events.set(event.id ?? JSON.stringify(event), event);
        }
    }
    return upcomingGameDays({ events: [...events.values()] }, now);
}

export async function runReminder({ github, context, note = '', now = Date.now(), fetchImpl = fetch, sleep }) {
    const days = await fetchUpcomingGameDays({ now, fetchImpl, sleep });
    if (!days.length) return 0;
    const issues = await github.paginate(github.rest.issues.listForRepo, { ...context.repo, state: 'all', labels: 'game-day', per_page: 100 });
    let created = 0;
    for (const { date, games } of days) {
        const marker = `<!-- gameday-reminder:${date} -->`;
        if (issues.some(issue => issue.body?.includes(marker))) continue;
        await github.rest.issues.create({
            ...context.repo,
            title: `🏈 Game Day Lock Check — ${date}`,
            labels: ['game-day', 'commissioner'],
            body: [
                marker, '## Upcoming NFL games', '',
                ...games.map(game => `- ${game.description}`), '',
                'Open Trier Fantasy before kickoff so it can refresh the schedule. The app uses scheduled kickoff times to lock players automatically.', '',
                'In **Settings → Commissioner Center**, sign in and use **LIVE SCHEDULE** to verify the locks. For additional restrictions, use **LOCK ALL** or individual manual team locks.', '',
                'Manual locks persist until cleared. **CLEAR MANUAL LOCKS** removes those restrictions; live-game locks remain until the game finishes.', '',
                'This is a schedule advisory. GitHub cannot inspect your app or confirm its current locks. Close this reminder after checking.',
                ...(note ? ['', `Note: ${note}`] : []),
            ].join('\n'),
        });
        created++;
    }
    return created;
}
