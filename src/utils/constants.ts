/**
 * Type-safe JSON.parse wrapper — returns null on any parse error instead of throwing.
 * Use this for all localStorage reads and external data deserialization.
 */
export function safeJsonParse<T>(raw: string | null | undefined): T | null {
    if (!raw) return null;
    try {
        return JSON.parse(raw) as T;
    } catch {
        return null;
    }
}

export const NFL_TEAMS = [
    'ARI', 'ATL', 'BAL', 'BUF', 'CAR', 'CHI', 'CIN', 'CLE', 'DAL', 'DEN',
    'DET', 'GB', 'HOU', 'IND', 'JAX', 'KC', 'LV', 'LAC', 'LAR', 'MIA',
    'MIN', 'NE', 'NO', 'NYG', 'NYJ', 'PHI', 'PIT', 'SF', 'SEA', 'TB',
    'TEN', 'WAS'
];

export const POSITIONS = [
    'QB', 'RB', 'WR', 'TE', 'LT', 'LG', 'C', 'RG', 'RT',
    'DE', 'DT', 'LB', 'CB', 'S',
    'K', 'P', 'LS', 'KR', 'PR', 'ST', 'HC'
];
