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

export async function runReminder({ github, context, note = '', now = Date.now(), fetchImpl = fetch }) {
    const stamp = ms => new Date(ms).toISOString().slice(0, 10).replaceAll('-', '');
    const response = await fetchImpl(`https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates=${stamp(now)}-${stamp(now + 86400000)}`, { signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error(`NFL schedule returned ${response.status}; no reminder created`);
    const days = upcomingGameDays(await response.json(), now);
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
