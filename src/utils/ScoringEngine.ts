import type { Player, ScoringRuleset } from '../types';
import { SCORING_PRESETS } from '../types';
import liveStatsSource from '../data/live_stats_current.json';

interface LiveStatsData {
    season?: number;
    season_state?: string;
    finality?: string;
    last_updated?: string;
    data_status?: string;
    reason?: string;
    stats?: Record<string, Record<string, number>>;
}

// Double-cast through unknown: TypeScript infers the exact JSON type (specific player ID keys),
// which doesn't overlap cleanly with LiveStatsData's Record<string,...> interface.
const liveData = liveStatsSource as unknown as LiveStatsData;

// Active ruleset — defaults to PPR. Call ScoringEngine.setRuleset() to change it.
// All calculatePoints() calls automatically pick up the current value.
let currentRuleset: ScoringRuleset = SCORING_PRESETS.PPR;

/**
 * ScoringEngine (Protocol v2)
 *
 * Rules:
 * - Only returns points if data_status is VALIDATED.
 * - Respects season_state (FUTURE, ACTIVE_UNOFFICIAL, COMPLETED_OFFICIAL).
 * - No fabrication, no projections in actual totals.
 * - Call setRuleset() once on app load (and on commissioner change) to switch formats.
 */
export class ScoringEngine {

    /** Replace the active scoring format. Called from App.tsx whenever league settings change. */
    static setRuleset(ruleset: ScoringRuleset) {
        currentRuleset = ruleset;
    }

    static getRuleset(): ScoringRuleset {
        return currentRuleset;
    }

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
        const r = currentRuleset;

        // 1. Check Protocol Constraints
        if (liveData.season_state === "FUTURE") {
            return { total: null, status: "NO_DATA_AVAILABLE", reason: "Season has not started" };
        }
        if (liveData.season_state === "PRESEASON") {
            return { total: null, status: "PRESEASON", reason: "Preseason stats are for scouting only — fantasy scoring begins Week 1" };
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

        // ── Passing ──────────────────────────────────────────────────────────
        if (stats.pass_yd !== undefined) {
            const pts = stats.pass_yd / r.passingYardsPerPoint;
            breakdown.passingYards = pts;
            total += pts;
            // Yardage milestone bonuses (mutually exclusive — take the higher tier)
            if (r.passing400YardBonus && stats.pass_yd >= 400) {
                breakdown.passing400Bonus = r.passing400YardBonus;
                total += r.passing400YardBonus;
            } else if (r.passing300YardBonus && stats.pass_yd >= 300) {
                breakdown.passing300Bonus = r.passing300YardBonus;
                total += r.passing300YardBonus;
            }
        }
        if (stats.pass_td !== undefined) {
            const pts = stats.pass_td * r.passingTDPoints;
            breakdown.passingTDs = pts;
            total += pts;
        }
        if (stats.pass_int !== undefined) {
            const pts = stats.pass_int * r.passingINTPoints;
            breakdown.interceptions = pts;
            total += pts;
        }

        // ── Rushing ──────────────────────────────────────────────────────────
        if (stats.rush_yd) {
            const pts = stats.rush_yd / r.rushingYardsPerPoint;
            breakdown.rushingYards = pts;
            total += pts;
            if (r.rushing200YardBonus && stats.rush_yd >= 200) {
                breakdown.rushing200Bonus = r.rushing200YardBonus;
                total += r.rushing200YardBonus;
            } else if (r.rushing100YardBonus && stats.rush_yd >= 100) {
                breakdown.rushing100Bonus = r.rushing100YardBonus;
                total += r.rushing100YardBonus;
            }
        }
        if (stats.rush_td) {
            const pts = stats.rush_td * r.rushingTDPoints;
            breakdown.rushingTDs = pts;
            total += pts;
        }

        // ── Receiving ────────────────────────────────────────────────────────
        if (stats.rec_yd) {
            const pts = stats.rec_yd / r.receivingYardsPerPoint;
            breakdown.receivingYards = pts;
            total += pts;
            if (r.receiving200YardBonus && stats.rec_yd >= 200) {
                breakdown.receiving200Bonus = r.receiving200YardBonus;
                total += r.receiving200YardBonus;
            } else if (r.receiving100YardBonus && stats.rec_yd >= 100) {
                breakdown.receiving100Bonus = r.receiving100YardBonus;
                total += r.receiving100YardBonus;
            }
        }
        if (stats.rec_td) {
            const pts = stats.rec_td * r.receivingTDPoints;
            breakdown.receivingTDs = pts;
            total += pts;
        }
        if (stats.rec !== undefined) {
            // TEP: TEs earn tepBonus extra per reception on top of the base receptionPoints
            const perCatch = r.receptionPoints + (player.position === 'TE' ? r.tepBonus : 0);
            const pts = stats.rec * perCatch;
            breakdown.receptions = pts;
            total += pts;
        }

        // ── Fumbles ──────────────────────────────────────────────────────────
        if (stats.fum_lost !== undefined) {
            const pts = stats.fum_lost * r.fumbleLostPoints;
            breakdown.fumbles = pts;
            total += pts;
        }

        // ── Kicker ───────────────────────────────────────────────────────────
        if (player.position === 'K') {
            const fg0_39  = (stats.fgm_0_19 || 0) + (stats.fgm_20_29 || 0) + (stats.fgm_30_39 || 0);
            const fg40_49 = stats.fgm_40_49 || 0;
            const fg50p   = stats.fgm_50p   || 0;
            const xpm     = stats.xpm       || 0;
            const xpmiss  = stats.xpmiss    || 0;

            const kickerPts =
                (fg0_39  * r.fgUnder40Points) +
                (fg40_49 * r.fg40to49Points)  +
                (fg50p   * r.fg50plusPoints)  +
                (xpm     * r.xpPoints)        +
                (xpmiss  * r.missedXPPoints);

            breakdown.kicker = kickerPts;
            total += kickerPts;
        }

        // ── Defense / ST ─────────────────────────────────────────────────────
        if (player.position === 'DST') {
            const sacks    = stats.sack    || 0;
            const ints     = stats.def_int || 0;
            const defTDs   = stats.def_td  || 0;
            const safeties = stats.safety  || 0;
            const fumRec   = stats.fum_rec || 0;

            breakdown.dstBase =
                (sacks    * r.dstSackPoints)      +
                (ints     * r.dstINTPoints)       +
                (defTDs   * r.dstTDPoints)        +
                (safeties * r.dstSafetyPoints)    +
                (fumRec   * r.dstFumbleRecPoints);
            total += breakdown.dstBase;

            // Points-allowed brackets (fixed — not configurable by design)
            const ptsAllowed = stats.pts_allow;
            if (ptsAllowed !== undefined) {
                let paBracketPts = 0;
                if      (ptsAllowed === 0)  paBracketPts = 10;
                else if (ptsAllowed <= 6)   paBracketPts = 7;
                else if (ptsAllowed <= 13)  paBracketPts = 4;
                else if (ptsAllowed <= 20)  paBracketPts = 1;
                else if (ptsAllowed <= 27)  paBracketPts = 0;
                else if (ptsAllowed <= 34)  paBracketPts = -1;
                else                        paBracketPts = -4;

                breakdown.dstPointsAllowed = paBracketPts;
                total += paBracketPts;
            }
        }

        // ── IDP — Individual Defensive Players (LB, DL, DB) ─────────────────
        if (['LB', 'DL', 'DB'].includes(player.position)) {
            const idpPts =
                ((stats.idp_tkl_solo || 0) * r.soloTacklePoints)     +
                ((stats.idp_tkl_ast  || 0) * r.assistedTacklePoints) +
                ((stats.idp_sack     || 0) * r.idpSackPoints)        +
                ((stats.idp_tkl_loss || 0) * r.tflPoints)            +
                ((stats.idp_pass_def || 0) * r.passDefPoints)        +
                ((stats.idp_qb_hit   || 0) * r.qbHitPoints)         +
                ((stats.idp_ff       || 0) * r.ffPoints)             +
                ((stats.idp_blk_kick || 0) * r.blockedKickPoints);

            breakdown.idp = parseFloat(idpPts.toFixed(2));
            total += idpPts;
        }

        return {
            total: parseFloat(total.toFixed(2)),
            breakdown,
            status: "ORCHESTRATED",
            finality: liveData.finality
        };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    static calculateTeamTotal(team: any) {
        if (liveData.season_state === "FUTURE" || liveData.season_state === "PRESEASON" || liveData.data_status !== "VALIDATED") {
            return { total: 0, status: liveData.season_state === "PRESEASON" ? "PRESEASON" : "NO_DATA_AVAILABLE" };
        }

        let grandTotal = 0;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const audits: Record<string, any> = {};

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        Object.values(team.roster).forEach((player: any) => {
            if (player) {
                const res = this.calculatePoints(player);
                if (res.total !== null) grandTotal += res.total;
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
