import type { Player } from '../types';

export type MatchupMode = 'OFF_VS_DEF' | 'OFF_VS_OFF' | 'DEF_VS_OFF' | 'DEF_VS_DEF';

export interface H2HMatchupResult {
    primaryPlayer: Player;
    rivalPlayer: Player | null;
    advantageScore: number; // 0-100
    metric: 'PHYSICALITY' | 'SPEED' | 'STRATEGY' | 'PRODUCTION' | 'EFFICIENCY';
}

export class H2HEngine {
    /**
     * Calculates an Advantage Score (0-100) for a matchup.
     * Uses cached performance_differential and recent trends.
     */
    static calculateAdvantage(player1: Player, player2: Player | null, isStrict: boolean = false): number {
        if (!player2) return 75;

        const p1Diff = player1.performance_differential || 0;
        const p2Diff = player2.performance_differential || 0;

        if (isStrict) {
            // Strict Performance Differential Comparison (0-100 scale)
            // If p1Diff is 10 and p2Diff is 5, advantage is 55.
            const diff = (p1Diff - p2Diff) * 2; // Each point of diff is 2% swing
            return Math.min(100, Math.max(0, 50 + diff));
        }

        const p1Trend = (player1.total_actual_fantasy_points || 0) / 17;
        const p2Trend = (player2.total_actual_fantasy_points || 0) / 17;

        const baseScore = 50;
        const diffWeight = (p1Diff - p2Diff) * 0.4;
        const trendWeight = (p1Trend - p2Trend) * 0.6 * 5;

        let finalScore = baseScore + diffWeight + trendWeight;
        return Math.min(100, Math.max(0, finalScore));
    }

    /**
     * Pairs players based on selected MatchupMode.
     */
    static getMatchups(
        userStarters: Player[],
        userDefense: Player[],
        rivalStarters: Player[],
        rivalDefense: Player[],
        mode: MatchupMode = 'OFF_VS_DEF'
    ): H2HMatchupResult[] {
        if (mode === 'OFF_VS_DEF') {
            return userStarters.filter(p => !['DST', 'K'].includes(p.position)).map(player => {
                let counterpart: Player | null = null;
                let metric: H2HMatchupResult['metric'] = 'STRATEGY';

                if (player.position === 'TE') {
                    counterpart = rivalDefense.find(d => d.position === 'DL' || d.position === 'LB') || null;
                    metric = 'PHYSICALITY';
                } else if (player.position === 'WR') {
                    counterpart = rivalDefense.find(d => d.position === 'DB') || null;
                    metric = 'SPEED';
                } else if (player.position === 'QB') {
                    counterpart = rivalDefense.find(d => d.position === 'DB' || d.position === 'LB') || null;
                    metric = 'STRATEGY';
                } else if (player.position === 'RB') {
                    counterpart = rivalDefense.find(d => d.position === 'DL' || d.position === 'LB') || null;
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
            return userStarters.filter(p => !['DST', 'K'].includes(p.position)).map(player => {
                const counterpart = rivalStarters.find(rp => rp.position === player.position) || null;
                return {
                    primaryPlayer: player,
                    rivalPlayer: counterpart,
                    advantageScore: this.calculateAdvantage(player, counterpart, mode === 'OFF_VS_OFF'),
                    metric: mode === 'OFF_VS_OFF' ? 'PRODUCTION' : 'STRATEGY'
                };
            });
        }

        if (mode === 'DEF_VS_OFF') {
            return userDefense.slice(0, 9).map(player => {
                const counterpart = rivalStarters.find(rp => {
                    if (player.position === 'DB') return rp.position === 'WR';
                    if (player.position === 'LB' || player.position === 'DL') return rp.position === 'RB' || rp.position === 'TE';
                    return false;
                }) || null;
                return {
                    primaryPlayer: player,
                    rivalPlayer: counterpart,
                    advantageScore: this.calculateAdvantage(player, counterpart),
                    metric: 'STRATEGY'
                };
            });
        }

        if (mode === 'DEF_VS_DEF') {
            return userDefense.slice(0, 9).map(player => {
                const counterpart = rivalDefense.find(rd => rd.position === player.position) || null;
                return {
                    primaryPlayer: player,
                    rivalPlayer: counterpart,
                    advantageScore: this.calculateAdvantage(player, counterpart),
                    metric: 'EFFICIENCY'
                };
            });
        }

        return [];
    }
}
