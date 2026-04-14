
import type { FantasyTeam } from '../types';

export const normalizeTeam = (team: any): FantasyTeam => {
    if (!team || typeof team !== 'object') {
        console.warn('[Normalizer] Invalid team object encountered', team);
        // Return a bare minimum valid team to prevent crash
        return {
            id: 'invalid-' + Math.random(),
            name: 'Invalid Team',
            ownerName: 'System',
            roster: {
                qb: null, rb1: null, rb2: null, wr1: null, wr2: null, te: null, flex: null, k: null, dst: null
            },
            bench: [],
            transactions: []
        };
    }

    // Ensure arrays
    if (!Array.isArray(team.bench)) team.bench = [];
    if (!Array.isArray(team.transactions)) team.transactions = [];

    // Ensure Roster Object
    if (!team.roster || typeof team.roster !== 'object') {
        team.roster = {
            qb: null, rb1: null, rb2: null, wr1: null, wr2: null, te: null, flex: null, k: null, dst: null
        };
    }

    // Ensure ID and Name
    if (!team.id) team.id = 'restored-' + Math.random().toString(36).substr(2, 9);
    if (!team.name) team.name = 'Unnamed Team';
    if (!team.ownerName) team.ownerName = 'Unknown';

    return team as FantasyTeam;
};
