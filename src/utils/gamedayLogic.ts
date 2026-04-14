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
