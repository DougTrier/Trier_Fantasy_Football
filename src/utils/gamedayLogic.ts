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
 * gamedayLogic — NFL Gameday Locking System
 * ===========================================
 * Enforces the anti-cheat rule: players on teams actively playing cannot be
 * moved in/out of starting lineups (the "gameday lock").
 *
 * WHY THIS EXISTS:
 *   Without a lock, a coach could bench an injured player mid-game to avoid
 *   losing points — which is the same as cheating in a real fantasy league.
 *   Locking is applied at the UI level in executeSwap() and enforced via
 *   isPlayerLocked() on every roster action.
 *
 * Live schedule locks and commissioner-added locks are kept separately.
 *
 * @module gamedayLogic
 */
import type { Player } from '../types';

/**
 * Utility to manage NFL team game statuses for the simulator.
 */
export const NFL_TEAMS = [
    'ARI', 'ATL', 'BAL', 'BUF', 'CAR', 'CHI', 'CIN', 'CLE', 'DAL', 'DEN', 'DET', 'GB',
    'HOU', 'IND', 'JAX', 'KC', 'LV', 'LAC', 'LAR', 'MIA', 'MIN', 'NE', 'NO', 'NYG',
    'NYJ', 'PHI', 'PIT', 'SF', 'SEA', 'TB', 'TEN', 'WAS'
];

/**
 * Checks if a player's NFL team is currently 'locked' (active gameday).
 * @param player The player to check.
 * @param lockedTeams Array of NFL team codes that are currently playing.
 */
export const isPlayerLocked = (player: Player | null, lockedTeams: string[]): boolean => {
    if (!player) return false;
    return lockedTeams.includes(player.team.toUpperCase());
};

/**
 * Returns a list of teams that 'typically' play on certain days for simulation.
 */
export const getAutomaticLockedTeams = (date: Date): string[] => {
    const day = date.getDay();
    // Simplified: Sunday (0) and Monday (1) are gamedays
    if (day === 0 || day === 1) {
        return NFL_TEAMS; // For the global simulation mode
    }
    return [];
};

/**
 * Returns true if today is a typical NFL gameday (Sun / Mon / Thu).
 * Used for the gameday UI only. Schedule polling must run on every day.
 */
export const isGameday = (date: Date = new Date()): boolean => {
    const day = date.getDay();
    return day === 0 || day === 1 || day === 4; // Sun, Mon, Thu
};

/**
 * Result type returned by fetchLiveGameData.
 * statuses maps each locked team abbreviation to a human-readable status string
 * like "Q3 7:42" or "Halftime" so the UI can show more than just "LOCKED".
 */
export interface LiveGameData {
    lockedTeams: string[];
    statuses: Record<string, string>; // team abbr → display string e.g. "Q3 7:42"
    games: ScheduledGame[];
}

export interface ScheduledGame {
    teams: string[];
    kickoff: number;
    state: 'pre' | 'in' | 'post';
    status: string;
}

export const liveLocksAt = (games: ScheduledGame[], now = Date.now()): string[] =>
    [...new Set(games.filter(game => game.state === 'in' ||
        (game.state === 'pre' && game.kickoff <= now)).flatMap(game => game.teams))];

export function parseScoreboard(data: unknown, now = Date.now()): LiveGameData {
    if (!data || typeof data !== 'object' || !('events' in data) || !Array.isArray(data.events)) {
        throw new Error('Invalid ESPN scoreboard');
    }
    const games: ScheduledGame[] = [];
    for (const event of data.events) {
        const competition = event?.competitions?.[0];
        const type = competition?.status?.type;
        if (!competition || !type || !Array.isArray(competition.competitors)) {
            throw new Error('Invalid ESPN game');
        }
        if (/postponed|canceled|cancelled/i.test(type.name ?? '')) continue;
        if (!['pre', 'in', 'post'].includes(type.state)) throw new Error('Unknown game state');
        const kickoff = Date.parse(competition.date ?? event.date);
        if (!Number.isFinite(kickoff)) throw new Error('Missing kickoff time');
        const teams = competition.competitors.map((competitor: { team?: { abbreviation?: string } }) => {
            const raw = competitor.team?.abbreviation?.toUpperCase();
            const team = raw === 'WSH' ? 'WAS' : raw === 'LA' ? 'LAR' : raw;
            if (!team || !NFL_TEAMS.includes(team)) throw new Error('Unknown NFL team');
            return team;
        });
        if (teams.length !== 2) throw new Error('Incomplete game');
        const period = competition.status.period ?? 0;
        const seconds = competition.status.clock ?? 0;
        const clock = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
        const status = type.state === 'pre' ? 'Kickoff' : /halftime/i.test(type.detail ?? '')
            ? 'Halftime' : `${period > 4 ? 'OT' : `Q${period}`} ${clock}`;
        games.push({ teams, kickoff, state: type.state, status });
    }
    return {
        games,
        lockedTeams: liveLocksAt(games, now),
        statuses: Object.fromEntries(games.flatMap(game => game.teams.map(team => [team, game.status]))),
    };
}

/**
 * Fetches live game data from ESPN's public scoreboard API.
 * Returns locked teams + per-team status strings. No API key required.
 */
export const fetchLiveGameData = async (): Promise<LiveGameData> => {
        const res = await fetch(
            'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard',
            { signal: AbortSignal.timeout(10_000) }
        );
        if (!res.ok) throw new Error(`ESPN API returned ${res.status}`);
        // Errors propagate: callers must retain their last successful snapshot.
        return parseScoreboard(await res.json());
};

/**
 * Convenience wrapper — returns only the locked team abbreviations.
 * Kept for call sites that don't need game status strings.
 */
export const fetchLiveLockedTeams = async (): Promise<string[]> => {
    const { lockedTeams } = await fetchLiveGameData();
    return lockedTeams;
};
