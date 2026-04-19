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
 * MultiLeagueService — League Slot Registry
 * ==========================================
 * Manages a registry of named league slots so the user can run multiple
 * independent leagues (e.g. "Work League", "Family League") from one install.
 *
 * STORAGE KEYS:
 *   trier_league_registry  — JSON array of LeagueSlot metadata
 *   trier_active_league    — ID of the currently loaded league
 *
 *   Per-league data is stored under namespaced keys via leagueKey.*().
 *   Teams:      trier_teams_{id}
 *   League obj: trier_league_{id}
 *   Active team: trier_active_team_{id}
 *   Event log:  trier_events_{id}
 *
 * MIGRATION:
 *   migrate() runs once on app start. If old single-league keys exist
 *   (trier_fantasy_all_teams_v3, trier_fantasy_league_v1) and no registry
 *   exists yet, it creates a default league slot and copies the data over.
 *
 * @module MultiLeagueService
 */

export interface LeagueSlot {
    id: string;
    name: string;
    createdAt: number;
}

const REGISTRY_KEY = 'trier_league_registry';
const ACTIVE_KEY   = 'trier_active_league';

/** Per-league localStorage key helpers — use these instead of raw key strings. */
export const leagueKey = {
    teams:      (id: string) => `trier_teams_${id}`,
    league:     (id: string) => `trier_league_${id}`,
    activeTeam: (id: string) => `trier_active_team_${id}`,
    events:     (id: string) => `trier_events_${id}`,
};

export const MultiLeagueService = {

    getRegistry(): LeagueSlot[] {
        try {
            const raw = localStorage.getItem(REGISTRY_KEY);
            return raw ? JSON.parse(raw) : [];
        } catch { return []; }
    },

    _setRegistry(slots: LeagueSlot[]) {
        localStorage.setItem(REGISTRY_KEY, JSON.stringify(slots));
    },

    getActiveId(): string | null {
        return localStorage.getItem(ACTIVE_KEY);
    },

    setActiveId(id: string) {
        localStorage.setItem(ACTIVE_KEY, id);
    },

    createLeague(name: string): LeagueSlot {
        const slot: LeagueSlot = { id: `league_${Date.now()}`, name, createdAt: Date.now() };
        const registry = this.getRegistry();
        registry.push(slot);
        this._setRegistry(registry);
        return slot;
    },

    renameLeague(id: string, name: string) {
        const registry = this.getRegistry().map(s => s.id === id ? { ...s, name } : s);
        this._setRegistry(registry);
    },

    deleteLeague(id: string) {
        const registry = this.getRegistry().filter(s => s.id !== id);
        this._setRegistry(registry);
        // Remove all per-league data for the deleted slot
        Object.values(leagueKey).forEach(fn => {
            try { localStorage.removeItem(fn(id)); } catch { /* non-fatal */ }
        });
        if (this.getActiveId() === id) {
            const next = registry[0];
            if (next) this.setActiveId(next.id);
            else localStorage.removeItem(ACTIVE_KEY);
        }
    },

    /**
     * One-time migration from single-league to multi-league storage layout.
     * Safe to call on every app start — exits immediately if already migrated.
     */
    migrate() {
        if (this.getRegistry().length > 0) return; // already migrated

        const oldTeams  = localStorage.getItem('trier_fantasy_all_teams_v3');
        const oldLeague = localStorage.getItem('trier_fantasy_league_v1');

        if (!oldTeams && !oldLeague) return; // fresh install — nothing to migrate

        const defaultId = `league_${Date.now()}`;
        let name = 'My League';
        try {
            if (oldLeague) name = JSON.parse(oldLeague).name || name;
        } catch { /* use default */ }

        const slot: LeagueSlot = { id: defaultId, name, createdAt: Date.now() };
        this._setRegistry([slot]);
        this.setActiveId(defaultId);

        // Copy existing data into the new per-league keys
        if (oldTeams)  localStorage.setItem(leagueKey.teams(defaultId), oldTeams);
        if (oldLeague) localStorage.setItem(leagueKey.league(defaultId), oldLeague);

        const oldActiveTeam = localStorage.getItem('trier_fantasy_active_id');
        if (oldActiveTeam) localStorage.setItem(leagueKey.activeTeam(defaultId), oldActiveTeam);

        console.log(`[MultiLeague] Migrated existing league to slot: ${defaultId}`);
    },

};
