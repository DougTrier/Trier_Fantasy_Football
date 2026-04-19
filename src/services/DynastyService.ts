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
 * DynastyService — Season-to-Season Keeper Logic
 * ================================================
 * Handles the dynasty-specific operations:
 *   - Roster rollover: preserve kept players, release everyone else
 *   - Draft pick generation: create a fresh set of picks for the new season
 *   - Contract year tracking: each kept player increments their contract year
 *
 * Called by the commissioner's "Archive Season" flow when dynasty mode is enabled.
 *
 * @module DynastyService
 */

import type { FantasyTeam, DraftPick, DynastySettings, Player } from '../types';

export const DynastyService = {

    /**
     * Determine which players in a team's roster/bench are eligible to be kept.
     * If contractYearsEnabled, players at year 3 are ineligible.
     */
    getEligibleKeepers(team: FantasyTeam, settings: DynastySettings): Player[] {
        const allPlayers = [
            ...Object.values(team.roster).filter(Boolean),
            ...team.bench,
        ] as Player[];

        if (!settings.contractYearsEnabled) return allPlayers;
        // Players at or above year 3 cannot be kept
        return allPlayers.filter(p => !p.contractYear || p.contractYear < 3);
    },

    /**
     * Apply season rollover for all teams:
     *   - Kept players move to bench with contractYear incremented
     *   - All other players are released back to the pool
     *   - Season stats (wins/losses/scores) are reset to zero
     *   - keptPlayerIds is cleared (ready for next season's selections)
     *
     * Returns the updated teams array and the list of released Player objects.
     */
    rolloverRosters(
        teams: FantasyTeam[],
    ): { teams: FantasyTeam[]; releasedPlayers: Player[] } {
        const releasedPlayers: Player[] = [];

        const updatedTeams = teams.map(team => {
            const keptIds = new Set(team.keptPlayerIds ?? []);
            const allPlayers = [
                ...Object.values(team.roster).filter(Boolean),
                ...team.bench,
            ] as Player[];

            const keepers  = allPlayers.filter(p => keptIds.has(p.id));
            const released = allPlayers.filter(p => !keptIds.has(p.id));
            releasedPlayers.push(...released);

            // Increment contract year for each kept player; cap display at 3
            const keepersWithUpdatedContracts: Player[] = keepers.map(p => ({
                ...p,
                contractYear: Math.min((p.contractYear ?? 1) + 1, 3),
            }));

            return {
                ...team,
                // Clear all roster slots; keepers go to bench
                roster: {
                    qb: null, rb1: null, rb2: null, wr1: null, wr2: null,
                    te: null, flex: null, k: null, dst: null,
                    lb: null, dl: null, db: null,
                },
                bench: keepersWithUpdatedContracts,
                keptPlayerIds: [],         // reset for next year's selections
                // Reset season stats
                wins: 0, losses: 0, ties: 0,
                weeklyScores: [],
                total_production_pts: 0,
                points_escrowed: 0,
            };
        });

        return { teams: updatedTeams, releasedPlayers };
    },

    /**
     * Generate a full set of draft picks for a new season — one pick per team
     * per round (rounds 1..totalRounds). Each team starts owning their own picks.
     * Any picks previously acquired via trade are preserved from the existing
     * draftPicks arrays.
     */
    generatePicksForSeason(
        teams: FantasyTeam[],
        year: number,
        totalRounds: number = 8,
    ): FantasyTeam[] {
        return teams.map(team => {
            // Keep existing picks for future years; drop any from past years
            const existingFuturePicks = (team.draftPicks ?? []).filter(p => p.year > year);

            // Create this team's own picks for the new season
            const newPicks: DraftPick[] = Array.from({ length: totalRounds }, (_, i) => ({
                id: `pick_${year}_r${i + 1}_${team.id}`,
                year,
                round: i + 1,
                originalTeamId: team.id,
                currentTeamId: team.id,
            }));

            return { ...team, draftPicks: [...existingFuturePicks, ...newPicks] };
        });
    },

};
