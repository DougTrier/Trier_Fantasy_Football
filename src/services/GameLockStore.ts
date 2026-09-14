import { liveLocksAt, NFL_TEAMS } from '../utils/gamedayLogic';
import type { LiveGameData, ScheduledGame } from '../utils/gamedayLogic';

export const GAME_LOCK_STORAGE_KEY = 'trier_game_locks_v2';
const LEGACY_KEY = 'trier_locked_nfl_teams';
type Storage = Pick<globalThis.Storage, 'getItem' | 'setItem'>;

/** Manual locks survive refreshes; live locks follow successful schedule snapshots. */
export class GameLockStore {
    private manual: string[] = [];
    private games: ScheduledGame[] = [];

    constructor(privateStorage?: Storage) {
        this.storage = privateStorage;
        try {
            const saved = privateStorage?.getItem(GAME_LOCK_STORAGE_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                this.manual = this.normalize(parsed.manual);
                this.games = Array.isArray(parsed.games) ? parsed.games.filter((game: ScheduledGame) =>
                    Array.isArray(game.teams) && game.teams.every(team => NFL_TEAMS.includes(team)) &&
                    Number.isFinite(game.kickoff) && ['pre', 'in', 'post'].includes(game.state)) : [];
            } else {
                this.manual = this.normalize(JSON.parse(privateStorage?.getItem(LEGACY_KEY) ?? '[]'));
            }
        } catch { /* Ignore corrupt local storage. */ }
    }

    private storage?: Storage;

    private normalize(teams: unknown): string[] {
        return Array.isArray(teams) ? [...new Set(teams.filter((team): team is string =>
            typeof team === 'string' && NFL_TEAMS.includes(team)))] : [];
    }

    setManual(teams: unknown, isCommissioner: boolean): boolean {
        if (!isCommissioner) return false;
        this.manual = this.normalize(teams);
        this.persist();
        return true;
    }

    getManual(): string[] { return [...this.manual]; }

    accept(data: LiveGameData): void {
        this.games = data.games;
        this.persist();
    }

    getLockedTeams(now = Date.now()): string[] {
        return [...new Set([...this.manual, ...liveLocksAt(this.games, now)])].sort();
    }

    getStatuses(): Record<string, string> {
        return Object.fromEntries(this.games.flatMap(game => game.teams.map(team => [team, game.status])));
    }

    persist(): void {
        try {
            this.storage?.setItem(GAME_LOCK_STORAGE_KEY, JSON.stringify({ manual: this.manual, games: this.games }));
            this.storage?.setItem(LEGACY_KEY, JSON.stringify(this.getLockedTeams()));
        } catch { /* Storage may be unavailable; keep the in-memory locks. */ }
    }
}
