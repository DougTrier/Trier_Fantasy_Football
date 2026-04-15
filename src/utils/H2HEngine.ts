import type { Player } from '../types';

export type MatchupMode = 'OFF_VS_DEF' | 'OFF_VS_OFF' | 'DEF_VS_OFF' | 'DEF_VS_DEF';

export interface H2HMatchupResult {
    primaryPlayer: Player;
    rivalPlayer: Player | null;
    advantageScore: number; // 0-100
    metric: 'PHYSICALITY' | 'SPEED' | 'STRATEGY' | 'PRODUCTION' | 'EFFICIENCY';
}

// ─────────────────────────────────────────────────────────────────────────────
// H2HEngine — Matchup Advantage Calculator
// ─────────────────────────────────────────────────────────────────────────────
//
// ADVANTAGE FORMULA (three weighted signals, each contributes 0-100):
//
//   projectedFactor  — projected points this week (most immediate signal)
//   trendFactor      — season PPG (sustained production)
//   diffFactor       — performance vs projection (over/under-performer)
//
//   raw = w_proj * projectedFactor
//       + w_trend * trendFactor
//       + w_diff  * diffFactor
//
//   advantageScore = clamp(50 + raw, 0, 100)
//
// When no counterpart exists, score defaults to 50 (neutral) not 75 (free win).
//
// DEFENSE PAIRING: uses a "best unused" strategy — each offensive player is
// matched against the highest-rated unused defender at the correct position,
// preventing two players from sharing the same counterpart.
// ─────────────────────────────────────────────────────────────────────────────

export class H2HEngine {

    // ── Advantage Calculation ─────────────────────────────────────────────────

    /**
     * Calculates a 0-100 advantage score for player1 vs player2.
     *
     * Three signals, each expressed as a signed delta between the two players:
     *   projected  — projected fantasy points for the current week
     *   trend      — actual PPG over the season (total / gamesPlayed)
     *   diff       — performance_differential (actual minus projected, historical)
     *
     * Weights can be tuned per mode; defaults favor projected points slightly
     * since that's the most game-week-relevant signal.
     */
    static calculateAdvantage(
        player1: Player,
        player2: Player | null,
        weights: { proj: number; trend: number; diff: number } = { proj: 0.45, trend: 0.35, diff: 0.20 }
    ): number {
        // No counterpart = neutral (50), not a free win (75).
        // If there's genuinely no one covering this player, the UI can call that out
        // separately — it shouldn't inflate the team score.
        if (!player2) return 50;

        // Signal 1: Projected points delta
        const p1Proj = player1.projectedPoints ?? 0;
        const p2Proj = player2.projectedPoints ?? 0;
        const projDelta = p1Proj - p2Proj;

        // Signal 2: Season PPG delta (normalize by actual games played, not a
        // hardcoded 17 — falls back to 17 only if games_played is missing)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const p1Games = (player1 as any).games_played || 17;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const p2Games = (player2 as any).games_played || 17;
        const p1PPG = (player1.total_actual_fantasy_points ?? 0) / p1Games;
        const p2PPG = (player2.total_actual_fantasy_points ?? 0) / p2Games;
        const trendDelta = p1PPG - p2PPG;

        // Signal 3: Performance differential (actual minus projected — is this
        // player consistently over or under their projection?)
        const p1Diff = player1.performance_differential ?? 0;
        const p2Diff = player2.performance_differential ?? 0;
        const diffDelta = p1Diff - p2Diff;

        // Scale each signal so that a "meaningful" difference maps to ~15-20 pts
        // of advantage, keeping extreme gaps from pinning the needle at 0 or 100.
        //   projDelta:  10 pts projected diff    → 10 * 1.5 = 15
        //   trendDelta: 5 PPG diff               → 5  * 3.0 = 15
        //   diffDelta:  10 pt overperformance    → 10 * 1.5 = 15
        const raw =
            weights.proj  * projDelta  * 1.5 +
            weights.trend * trendDelta * 3.0 +
            weights.diff  * diffDelta  * 1.5;

        return Math.min(100, Math.max(0, 50 + raw));
    }

    // ── Defense Pairing ───────────────────────────────────────────────────────

    /**
     * Returns the best UNUSED defender matching the given position filter,
     * ranked by projected points descending (or performance_differential as fallback).
     * Removes the chosen player from the pool so two players can't share a counterpart.
     */
    private static pickBestDefender(
        pool: Player[],
        positions: string[],
        used: Set<string>
    ): Player | null {
        const candidates = pool
            .filter(d => positions.includes(d.position) && !used.has(d.id))
            .sort((a, b) =>
                (b.projectedPoints ?? b.performance_differential ?? 0) -
                (a.projectedPoints ?? a.performance_differential ?? 0)
            );

        const pick = candidates[0] ?? null;
        if (pick) used.add(pick.id);
        return pick;
    }

    // ── Public API ────────────────────────────────────────────────────────────

    /**
     * Pairs players based on the selected MatchupMode and returns ranked matchup results.
     */
    static getMatchups(
        userStarters: Player[],
        userDefense: Player[],
        rivalStarters: Player[],
        rivalDefense: Player[],
        mode: MatchupMode = 'OFF_VS_DEF'
    ): H2HMatchupResult[] {

        if (mode === 'OFF_VS_DEF') {
            const usedDefenders = new Set<string>();
            return userStarters
                .filter(p => !['DST', 'K'].includes(p.position))
                .map(player => {
                    let counterpart: Player | null = null;
                    let metric: H2HMatchupResult['metric'] = 'STRATEGY';

                    if (player.position === 'TE') {
                        counterpart = this.pickBestDefender(rivalDefense, ['DL', 'LB'], usedDefenders);
                        metric = 'PHYSICALITY';
                    } else if (player.position === 'WR') {
                        counterpart = this.pickBestDefender(rivalDefense, ['DB'], usedDefenders);
                        metric = 'SPEED';
                    } else if (player.position === 'QB') {
                        counterpart = this.pickBestDefender(rivalDefense, ['DB', 'LB'], usedDefenders);
                        metric = 'STRATEGY';
                    } else if (player.position === 'RB') {
                        counterpart = this.pickBestDefender(rivalDefense, ['DL', 'LB'], usedDefenders);
                        metric = 'PHYSICALITY';
                    }

                    return {
                        primaryPlayer: player,
                        rivalPlayer: counterpart,
                        advantageScore: this.calculateAdvantage(player, counterpart),
                        metric
                    };
                });
        }

        if (mode === 'OFF_VS_OFF') {
            // Pure production comparison — use projected-heavy weighting
            const projWeights = { proj: 0.60, trend: 0.25, diff: 0.15 };
            const usedRivals = new Set<string>();

            return userStarters
                .filter(p => !['DST', 'K'].includes(p.position))
                .map(player => {
                    // Best position match by projected points (not just first found)
                    const counterpart = rivalStarters
                        .filter(rp => rp.position === player.position && !usedRivals.has(rp.id))
                        .sort((a, b) => (b.projectedPoints ?? 0) - (a.projectedPoints ?? 0))[0] ?? null;

                    if (counterpart) usedRivals.add(counterpart.id);

                    return {
                        primaryPlayer: player,
                        rivalPlayer: counterpart,
                        advantageScore: this.calculateAdvantage(player, counterpart, projWeights),
                        metric: 'PRODUCTION' as const
                    };
                });
        }

        if (mode === 'DEF_VS_OFF') {
            const usedOffense = new Set<string>();

            return userDefense.slice(0, 9).map(player => {
                let positions: string[] = [];
                let metric: H2HMatchupResult['metric'] = 'STRATEGY';

                if (player.position === 'DB') {
                    positions = ['WR'];
                    metric = 'SPEED';
                } else if (player.position === 'LB') {
                    positions = ['RB', 'TE'];
                    metric = 'PHYSICALITY';
                } else if (player.position === 'DL') {
                    positions = ['RB', 'QB'];
                    metric = 'PHYSICALITY';
                }

                const counterpart = rivalStarters
                    .filter(rp => positions.includes(rp.position) && !usedOffense.has(rp.id))
                    .sort((a, b) => (b.projectedPoints ?? 0) - (a.projectedPoints ?? 0))[0] ?? null;

                if (counterpart) usedOffense.add(counterpart.id);

                return {
                    primaryPlayer: player,
                    rivalPlayer: counterpart,
                    advantageScore: this.calculateAdvantage(player, counterpart),
                    metric
                };
            });
        }

        if (mode === 'DEF_VS_DEF') {
            const usedRivals = new Set<string>();

            return userDefense.slice(0, 9).map(player => {
                const counterpart = rivalDefense
                    .filter(rd => rd.position === player.position && !usedRivals.has(rd.id))
                    .sort((a, b) => (b.projectedPoints ?? 0) - (a.projectedPoints ?? 0))[0] ?? null;

                if (counterpart) usedRivals.add(counterpart.id);

                return {
                    primaryPlayer: player,
                    rivalPlayer: counterpart,
                    advantageScore: this.calculateAdvantage(player, counterpart),
                    metric: 'EFFICIENCY' as const
                };
            });
        }

        return [];
    }
}
