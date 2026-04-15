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
 * dataNormalizer — Team Data Integrity Guard
 * ===========================================
 * Coerces loaded team data (from localStorage, imports, or P2P sync) into a
 * guaranteed-valid FantasyTeam shape before it enters React state.
 *
 * WHY THIS EXISTS:
 *   Team data is serialized/deserialized across multiple paths (localStorage v1→v3
 *   migrations, peer sync, file imports). Any one of those paths can produce malformed
 *   objects — missing roster slots, undefined bench arrays, no ID, etc.
 *   This normalizer runs as a firewall on every load path so the rest of the app
 *   can assume a fully valid FantasyTeam at all times.
 *
 * @module dataNormalizer
 */

import type { FantasyTeam } from '../types';

/**
 * Accepts any unknown object and returns a guaranteed-valid FantasyTeam.
 * Creates safe fallback values for every required field if missing.
 * All load and sync paths should run team data through this before setState.
 */
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
