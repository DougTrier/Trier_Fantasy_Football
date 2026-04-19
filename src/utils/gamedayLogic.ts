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
 * The `lockedNFLTeams` array in App.tsx state drives this — it is set manually
 * (simulate Sunday) or could be wired to a live NFL schedule API in future.
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
 * Used to gate the auto-poll interval — no need to hit the API on off-days.
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
}

/**
 * Fetches live game data from ESPN's public scoreboard API.
 * Returns locked teams + per-team status strings. No API key required.
 */
export const fetchLiveGameData = async (): Promise<LiveGameData> => {
    try {
        const res = await fetch(
            'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard'
        );
        if (!res.ok) throw new Error(`ESPN API returned ${res.status}`);
        const data = await res.json();
        const lockedTeams: string[] = [];
        const statuses: Record<string, string> = {};

        for (const event of (data.events || [])) {
            const competition = event.competitions?.[0];
            if (!competition) continue;
            const state = competition.status?.type?.state;
            if (state !== 'in') continue;

            // Build a readable status string: "Q3 7:42" or "Halftime"
            const detail: string = competition.status?.type?.detail ?? '';
            const period: number = competition.status?.period ?? 0;
            const clockSecs: number = competition.status?.clock ?? 0;
            const mm = String(Math.floor(clockSecs / 60)).padStart(2, '0');
            const ss = String(clockSecs % 60).padStart(2, '0');
            const statusStr = detail.toLowerCase().includes('halftime')
                ? 'Halftime'
                : period > 4
                    ? `OT ${mm}:${ss}`
                    : `Q${period} ${mm}:${ss}`;

            for (const competitor of (competition.competitors || [])) {
                const abbr = competitor.team?.abbreviation?.toUpperCase();
                if (abbr && NFL_TEAMS.includes(abbr)) {
                    lockedTeams.push(abbr);
                    statuses[abbr] = statusStr;
                }
            }
        }
        console.log(`[GamedayLogic] Live locked teams: ${lockedTeams.join(', ') || 'none'}`);
        return { lockedTeams, statuses };
    } catch (e) {
        console.warn('[GamedayLogic] Failed to fetch live NFL schedule:', e);
        return { lockedTeams: [], statuses: {} };
    }
};

/**
 * Convenience wrapper — returns only the locked team abbreviations.
 * Kept for call sites that don't need game status strings.
 */
export const fetchLiveLockedTeams = async (): Promise<string[]> => {
    const { lockedTeams } = await fetchLiveGameData();
    return lockedTeams;
};
