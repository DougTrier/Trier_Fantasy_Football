import type { Player } from '../types';
import liveStatsSource from '../data/live_stats_2025.json';

const liveData = liveStatsSource as any;

/**
 * ScoringEngine (Protocol v2)
 * 
 * Rules:
 * - Only returns points if data_status is VALIDATED.
 * - Respects season_state (FUTURE, ACTIVE_UNOFFICIAL, COMPLETED_OFFICIAL).
 * - No fabrication, no projections in actual totals.
 */
export class ScoringEngine {

    static getOrchestrationStatus() {
        return {
            season: liveData.season,
            season_state: liveData.season_state,
            finality: liveData.finality,
            last_updated: liveData.last_updated,
            data_status: liveData.data_status,
            reason: liveData.reason || "Operational"
        };
    }

    static calculatePoints(player: Player) {
        // 1. Check Protocol Constraints
        if (liveData.season_state === "FUTURE") {
            return { total: null, status: "NO_DATA_AVAILABLE", reason: "Season has not started" };
        }

        if (liveData.data_status !== "VALIDATED") {
            return { total: null, status: "NO_DATA_AVAILABLE", reason: liveData.reason || "API provenance not established" };
        }

        // 2. Resolve Player Stats
        const stats = liveData.stats?.[player.id] || liveData.stats?.[player.espnId || ''];

        if (!stats) {
            return { total: null, status: "NO_DATA_FOUND", reason: "Official records not found for this player" };
        }

        // 3. Strict Calculation (No Inferred Stats)
        let total = 0;
        const breakdown: Record<string, number> = {};

        // Passing
        if (stats.pass_yd !== undefined) {
            const pts = stats.pass_yd / 25;
            breakdown.passingYards = pts;
            total += pts;
        }
        if (stats.pass_td !== undefined) {
            const pts = stats.pass_td * 4;
            breakdown.passingTDs = pts;
            total += pts;
        }
        if (stats.pass_int !== undefined) {
            const pts = stats.pass_int * -2;
            breakdown.interceptions = pts;
            total += pts;
        }

        // Rushing/Receiving
        const rushRecYds = (stats.rush_yd || 0) + (stats.rec_yd || 0);
        if (rushRecYds) {
            const pts = rushRecYds / 10;
            breakdown.yards = pts;
            total += pts;
        }
        const tds = (stats.rush_td || 0) + (stats.rec_td || 0);
        if (tds) {
            const pts = tds * 6;
            breakdown.tds = pts;
            total += pts;
        }
        if (stats.rec !== undefined) {
            const pts = stats.rec * 1;
            breakdown.receptions = pts;
            total += pts;
        }

        // Fumbles
        if (stats.fum_lost !== undefined) {
            const pts = stats.fum_lost * -2;
            breakdown.fumbles = pts;
            total += pts;
        }

        // Defense (DST)
        if (player.position === 'DST') {
            const sacks = stats.sack || 0;
            const ints = stats.def_int || 0;
            const defTDs = stats.def_td || 0;
            const safeties = stats.safety || 0;

            total += sacks + (ints * 2) + (defTDs * 6) + (safeties * 2);
        }

        return {
            total: parseFloat(total.toFixed(2)),
            breakdown,
            status: "ORCHESTRATED",
            finality: liveData.finality
        };
    }

    static calculateTeamTotal(team: any) {
        if (liveData.season_state === "FUTURE" || liveData.data_status !== "VALIDATED") {
            return { total: 0, status: "NO_DATA_AVAILABLE" };
        }

        let grandTotal = 0;
        const audits: Record<string, any> = {};

        Object.values(team.roster).forEach((player: any) => {
            if (player) {
                const res = this.calculatePoints(player);
                if (res.total !== null) {
                    grandTotal += res.total;
                }
                audits[player.id] = res;
            }
        });

        return {
            total: parseFloat(grandTotal.toFixed(2)),
            audits,
            finality: liveData.finality
        };
    }
}
