/**
 * ScheduleService — H2H season schedule generation and standings
 * ==============================================================
 * Generates a balanced round-robin schedule, calculates W/L standings,
 * and seeds the playoff bracket.
 *
 * SCHEDULE ALGORITHM:
 *   Standard round-robin rotation: fix one team, rotate the rest.
 *   For N teams this produces N-1 unique rounds. Repeat rounds to fill
 *   the desired number of regular-season weeks (14 or 16).
 *   Odd team counts get a bye week rotation (virtual "bye" team).
 *
 * PLAYOFFS:
 *   Top 4 teams by W/L record qualify (weeks 15–16 = semifinals, week 17 = final).
 *   Tiebreaker: total points scored (total_production_pts).
 */
import type { FantasyTeam, League, Matchup } from '../types';

// ── Schedule Generation ───────────────────────────────────────────────────────

/**
 * Generates a full regular-season schedule using the round-robin rotation
 * algorithm. Returns an array of Matchup objects covering all numWeeks.
 */
export function generateSchedule(teams: FantasyTeam[], numWeeks: number): Matchup[] {
    const ids = teams.map(t => t.id);
    // Pad to even number with a 'BYE' placeholder if needed
    const pool = ids.length % 2 === 0 ? [...ids] : [...ids, 'BYE'];
    const n = pool.length;
    const rounds: Array<Array<[string, string]>> = [];

    // Classic round-robin: fix pool[0], rotate pool[1..n-1]
    for (let r = 0; r < n - 1; r++) {
        const round: Array<[string, string]> = [];
        const rotated = [pool[0], ...pool.slice(1)];
        for (let i = 0; i < n / 2; i++) {
            const home = rotated[i];
            const away = rotated[n - 1 - i];
            // Skip BYE matchups
            if (home !== 'BYE' && away !== 'BYE') {
                round.push([home, away]);
            }
        }
        rounds.push(round);
        // Rotate: move last element to position 1
        pool.splice(1, 0, pool.pop()!);
    }

    // Repeat rounds until we fill numWeeks
    const matchups: Matchup[] = [];
    for (let week = 1; week <= numWeeks; week++) {
        const round = rounds[(week - 1) % rounds.length];
        round.forEach(([homeId, awayId]) => {
            matchups.push({
                id: `m-w${week}-${homeId}-${awayId}`,
                week,
                homeTeamId: homeId,
                awayTeamId: awayId,
                completed: false,
            });
        });
    }
    return matchups;
}

// ── Week Completion ───────────────────────────────────────────────────────────

/**
 * Marks a week as complete: records scores, updates W/L/ties on each team,
 * and advances currentWeek. Scores are pulled from each team's
 * total_production_pts averaged across the season (proxy until live scoring).
 * The commissioner can override scores before calling this.
 */
export function completeWeek(
    league: League,
    teams: FantasyTeam[],
    week: number,
    scoreOverrides?: Record<string, number>, // teamId → score for this week
): { league: League; teams: FantasyTeam[] } {
    if (!league.schedule) return { league, teams };

    // Default score: use the team's recorded weeklyScore if present, else pts / weeks_played
    const getScore = (teamId: string, weeksPlayed: number): number => {
        if (scoreOverrides?.[teamId] !== undefined) return scoreOverrides[teamId];
        const team = teams.find(t => t.id === teamId);
        if (!team) return 0;
        if (team.weeklyScores?.[week - 1] !== undefined) return team.weeklyScores[week - 1];
        // Distribute season total evenly as a fallback
        const total = team.total_production_pts ?? 0;
        return weeksPlayed > 0 ? Math.round(total / Math.max(1, weeksPlayed)) : 0;
    };

    const weeksPlayedBefore = week - 1;
    const updatedSchedule = league.schedule.map(m => {
        if (m.week !== week || m.completed) return m;
        const homeScore = getScore(m.homeTeamId, weeksPlayedBefore);
        const awayScore = getScore(m.awayTeamId, weeksPlayedBefore);
        return { ...m, homeScore, awayScore, completed: true };
    });

    // Update W/L/tie records on each team
    const weekMatchups = updatedSchedule.filter(m => m.week === week && m.completed);
    const updatedTeams = teams.map(team => {
        const matchup = weekMatchups.find(m => m.homeTeamId === team.id || m.awayTeamId === team.id);
        if (!matchup) return team;

        const myScore = matchup.homeTeamId === team.id ? (matchup.homeScore ?? 0) : (matchup.awayScore ?? 0);
        const oppScore = matchup.homeTeamId === team.id ? (matchup.awayScore ?? 0) : (matchup.homeScore ?? 0);
        const isWin = myScore > oppScore;
        const isTie = myScore === oppScore;

        const newWeeklyScores = [...(team.weeklyScores ?? [])];
        newWeeklyScores[week - 1] = myScore;

        return {
            ...team,
            wins: (team.wins ?? 0) + (isWin ? 1 : 0),
            losses: (team.losses ?? 0) + (!isWin && !isTie ? 1 : 0),
            ties: (team.ties ?? 0) + (isTie ? 1 : 0),
            weeklyScores: newWeeklyScores,
        };
    });

    return {
        league: { ...league, schedule: updatedSchedule, currentWeek: Math.min(week + 1, (league.numWeeks ?? 16) + 3) },
        teams: updatedTeams,
    };
}

// ── Standings ─────────────────────────────────────────────────────────────────

/** Returns teams sorted by W/L record, tiebroken by total_production_pts. */
export function getStandings(teams: FantasyTeam[]): FantasyTeam[] {
    return [...teams].sort((a, b) => {
        const wA = a.wins ?? 0, wB = b.wins ?? 0;
        const lA = a.losses ?? 0, lB = b.losses ?? 0;
        // More wins first
        if (wB !== wA) return wB - wA;
        // Fewer losses second
        if (lA !== lB) return lA - lB;
        // Tiebreaker: total production points
        return (b.total_production_pts ?? 0) - (a.total_production_pts ?? 0);
    });
}

/** Returns the top 4 teams for playoff seeding. */
export function getPlayoffSeeds(teams: FantasyTeam[]): FantasyTeam[] {
    return getStandings(teams).slice(0, 4);
}

// ── Matchup Helpers ───────────────────────────────────────────────────────────

/** Returns this week's matchups from the league schedule. */
export function getWeekMatchups(league: League, week: number): Matchup[] {
    return (league.schedule ?? []).filter(m => m.week === week);
}

/** Returns the matchup for a specific team in a given week. */
export function getTeamMatchup(league: League, teamId: string, week: number): Matchup | undefined {
    return (league.schedule ?? []).find(
        m => m.week === week && (m.homeTeamId === teamId || m.awayTeamId === teamId)
    );
}

/** Points for (total weekly scores recorded) for a team. */
export function getPointsFor(team: FantasyTeam): number {
    return (team.weeklyScores ?? []).reduce((s, v) => s + v, 0);
}
