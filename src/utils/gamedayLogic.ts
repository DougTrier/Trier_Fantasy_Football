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
 * Fetches live game status from ESPN's public scoreboard API.
 * Returns the abbreviations of NFL teams currently in an in-progress game.
 * No API key required.
 */
export const fetchLiveLockedTeams = async (): Promise<string[]> => {
    try {
        const res = await fetch(
            'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard'
        );
        if (!res.ok) throw new Error(`ESPN API returned ${res.status}`);
        const data = await res.json();
        const locked: string[] = [];
        for (const event of (data.events || [])) {
            const competition = event.competitions?.[0];
            if (!competition) continue;
            // status.type.state: 'pre' | 'in' | 'post'
            if (competition.status?.type?.state === 'in') {
                for (const competitor of (competition.competitors || [])) {
                    const abbr = competitor.team?.abbreviation?.toUpperCase();
                    if (abbr && NFL_TEAMS.includes(abbr)) locked.push(abbr);
                }
            }
        }
        console.log(`[GamedayLogic] Live locked teams: ${locked.join(', ') || 'none (no games in progress)'}`);
        return locked;
    } catch (e) {
        console.warn('[GamedayLogic] Failed to fetch live NFL schedule:', e);
        return [];
    }
};
