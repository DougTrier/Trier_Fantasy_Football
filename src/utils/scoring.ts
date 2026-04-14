import type { Player } from '../types';

export const calculatePoints = (player: Player): number => {
    // Start with projected points as baseline for mock
    let points = player.projectedPoints || 0;

    // Standard PPR Scoring Calculation
    if (player.stats) {
        points = 0;
        // Passing
        points += (player.stats.passingYards || 0) / 25;
        points += (player.stats.passingTDs || 0) * 4;
        points += (player.stats.int || 0) * -2; // Interception

        // Rushing
        points += (player.stats.rushingYards || 0) / 10;
        points += (player.stats.rushingTDs || 0) * 6;

        // Receiving
        points += (player.stats.receivingYards || 0) / 10;
        points += (player.stats.receivingTDs || 0) * 6;
        points += (player.stats.receptions || 0) * 1; // 1 Point Per Reception (PPR)

        // Fumbles
        points += (player.stats.fumblesLost || 0) * -2;

        // Defense / Special Teams (simplified mock logic)
        if (player.position === 'DST') {
            points += (player.stats.sacks || 0) * 1;
            points += (player.stats.defensiveTDs || 0) * 6;
            // Points allowed logic would go here ideally
        }
    }

    return parseFloat(points.toFixed(2));
};

export const ROSTER_SLOTS = [
    { id: 'qb', label: 'QB', accepted: ['QB'] },
    { id: 'rb1', label: 'RB', accepted: ['RB'] },
    { id: 'rb2', label: 'RB', accepted: ['RB'] },
    { id: 'wr1', label: 'WR', accepted: ['WR'] },
    { id: 'wr2', label: 'WR', accepted: ['WR'] },
    { id: 'te', label: 'TE', accepted: ['TE'] },
    { id: 'flex', label: 'FLEX', accepted: ['RB', 'WR', 'TE'] },
    { id: 'k', label: 'K', accepted: ['K'] },
    { id: 'dst', label: 'D/ST', accepted: ['DST'] },
];
