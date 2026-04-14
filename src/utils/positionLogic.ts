// import type { Position } from '../types'; // Temporarily removed to fix runtime import error

export const getAllowedPositionsForSlot = (slotId: string): string[] => {
    // Normalization
    const id = slotId.toLowerCase().trim();
    console.log(`[positionLogic] Processing slotId: '${slotId}' -> normalized: '${id}'`);

    // Offense
    if (id === 'qb') return ['QB'];
    if (id === 'rb1' || id === 'rb2') return ['RB'];
    if (id.startsWith('wr')) return ['WR'];
    if (id === 'te') return ['TE'];
    if (id === 'flex') return ['RB', 'WR', 'TE'];
    if (id === 'dst' || id === 'def') return ['DST']; // Standard Defense Team

    // O-Line
    if (id === 'lt') return ['LT'];
    if (id === 'lg') return ['LG'];
    if (id === 'c') return ['C'];
    if (id === 'rg') return ['RG'];
    if (id === 'rt') return ['RT'];

    // Defense (IDP)
    if (id.startsWith('de')) return ['DE'];
    if (id.startsWith('dt')) return ['DT'];
    if (id.startsWith('lb') || id === 'mlb') return ['LB'];
    if (id.startsWith('cb')) return ['CB'];
    if (id.startsWith('s') && !id.startsWith('st')) return ['S']; // Avoid mistaking st1 for s1 if not careful, but 's' matches 's1', 's2'

    // Special Teams - Kickers/Punters
    if (id === 'k') return ['K'];
    if (id === 'p') return ['P'];
    if (id === 'ls') return ['LS'];

    // Returners
    if (id === 'kr') return ['KR', 'WR', 'RB', 'CB']; // Often skill players
    if (id === 'pr') return ['PR', 'WR', 'RB', 'CB'];

    // Special Teams Coverage / Blocking (R1-R5, L1-L5, etc)
    // These are usually generic ST, or backup LBs/DBs/TEs.
    // For now, let's map them to 'ST' and also 'LB', 'CB', 'S' to give options.
    if (id.startsWith('st') || /^[rl][0-9]/.test(id) || /^[rl][ct]/.test(id)) {
        return ['ST', 'LB', 'CB', 'S', 'WR', 'TE'];
    }

    // Head Coach
    if (id === 'headcoach') return ['HC'];

    // Bench
    return []; // 'BN' or Any? usually any.
};
