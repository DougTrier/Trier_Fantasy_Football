/**
 * WaiverService — FAAB waiver wire logic
 * ========================================
 * Manages free agent detection, blind bid submission, and weekly processing.
 *
 * PROCESSING RULES:
 *   1. All bids for the same player are compared; highest FAAB bid wins.
 *   2. Tie → team with the lower waiverPriority number wins (best waiver position).
 *   3. Winner pays their bid amount; losers are refunded automatically.
 *   4. Winner drops to the bottom of waiver order (continuous rolling priority).
 *   5. If no team bids on a player they can still be added freely (priority add).
 *
 * PROCESSING WINDOW:
 *   Standard fantasy waiver processing: Tuesday 02:00 local time.
 *   Commissioner can force-process at any time.
 */
import type { FantasyTeam, Player, WaiverBid } from '../types';

// ── Free Agent Detection ──────────────────────────────────────────────────────

/**
 * Returns players not currently on any team's active roster or bench.
 * Called fresh on every render so ownership is always current.
 */
export function getFreeAgents(allPlayers: Player[], allTeams: FantasyTeam[]): Player[] {
    // Build a set of all owned player IDs across every team
    const ownedIds = new Set<string>();
    allTeams.forEach(team => {
        Object.values(team.roster).forEach(p => { if (p) ownedIds.add(p.id); });
        (team.bench || []).forEach(p => ownedIds.add(p.id));
    });
    return allPlayers.filter(p => !ownedIds.has(p.id));
}

// ── Bid Management ────────────────────────────────────────────────────────────

/** Submits a waiver claim for a player. Replaces any existing pending bid for the same player. */
export function placeBid(
    team: FantasyTeam,
    player: Player,
    bidAmount: number,
    dropPlayer?: Player,
): FantasyTeam {
    const existing = (team.waiverBids || []).filter(
        b => b.playerId !== player.id || b.status !== 'pending'
    );
    const newBid: WaiverBid = {
        id: `wbid-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        teamId: team.id,
        playerId: player.id,
        playerName: `${player.firstName} ${player.lastName}`,
        dropPlayerId: dropPlayer?.id,
        dropPlayerName: dropPlayer ? `${dropPlayer.firstName} ${dropPlayer.lastName}` : undefined,
        bidAmount: Math.max(0, Math.min(bidAmount, team.faabBalance ?? 100)),
        submittedAt: Date.now(),
        status: 'pending',
    };
    return { ...team, waiverBids: [...existing, newBid] };
}

/** Cancels a pending bid by id. */
export function cancelBid(team: FantasyTeam, bidId: string): FantasyTeam {
    return {
        ...team,
        waiverBids: (team.waiverBids || []).map(b =>
            b.id === bidId && b.status === 'pending' ? { ...b, status: 'cancelled' } : b
        ),
    };
}

// ── Waiver Processing ─────────────────────────────────────────────────────────

/**
 * Processes all pending bids across all teams and returns updated team list.
 * Called by the commissioner or on the weekly schedule.
 *
 * Algorithm per contested player:
 *   - Collect all pending bids with status 'pending'
 *   - Sort by bidAmount DESC, then waiverPriority ASC (lower = better)
 *   - Winner: add player to bench, deduct FAAB, drop to bottom of waiver order
 *   - Losers: mark bid 'lost', FAAB unchanged
 *   - Unclaimed players remain in the free agent pool (no action needed)
 */
export function processWaivers(teams: FantasyTeam[], allPlayers: Player[]): FantasyTeam[] {
    // Index teams by id for fast lookup
    const teamMap = new Map<string, FantasyTeam>(teams.map(t => [t.id, { ...t, waiverBids: [...(t.waiverBids || [])] }]));

    // Collect all pending bids grouped by player
    const bidsByPlayer = new Map<string, WaiverBid[]>();
    teamMap.forEach(team => {
        (team.waiverBids || []).filter(b => b.status === 'pending').forEach(bid => {
            if (!bidsByPlayer.has(bid.playerId)) bidsByPlayer.set(bid.playerId, []);
            bidsByPlayer.get(bid.playerId)!.push(bid);
        });
    });

    // Determine the current lowest priority number to assign winners to the bottom
    const maxPriority = Math.max(...teams.map(t => t.waiverPriority ?? 1));

    // Process each contested player
    bidsByPlayer.forEach((bids, playerId) => {
        const player = allPlayers.find(p => p.id === playerId);
        if (!player) return;

        // Sort: highest bid wins; tie broken by best (lowest) waiver priority number
        const sorted = [...bids].sort((a, b) => {
            if (b.bidAmount !== a.bidAmount) return b.bidAmount - a.bidAmount;
            const pA = teamMap.get(a.teamId)?.waiverPriority ?? 999;
            const pB = teamMap.get(b.teamId)?.waiverPriority ?? 999;
            return pA - pB;
        });

        const winner = sorted[0];
        const winningTeam = teamMap.get(winner.teamId);
        if (!winningTeam) return;

        // Add claimed player to bench, deduct FAAB, sink to bottom of waiver order
        const newBench = [...(winningTeam.bench || []), player];
        let updatedBench = newBench;

        // Drop the nominated player if specified and they're on the bench
        if (winner.dropPlayerId) {
            updatedBench = newBench.filter(p => p.id !== winner.dropPlayerId);
        }

        teamMap.set(winner.teamId, {
            ...winningTeam,
            bench: updatedBench,
            faabBalance: Math.max(0, (winningTeam.faabBalance ?? 100) - winner.bidAmount),
            waiverPriority: maxPriority + 1, // sink to bottom
            transactions: [
                ...(winningTeam.transactions || []),
                {
                    id: `wvr-${Date.now()}`,
                    type: 'WAIVER_WIN' as const,
                    timestamp: Date.now(),
                    description: `Waiver claim: added ${winner.playerName}${winner.dropPlayerName ? `, dropped ${winner.dropPlayerName}` : ''} (bid: $${winner.bidAmount} FAAB)`,
                    playerName: winner.playerName,
                    amount: winner.bidAmount,
                },
            ],
            waiverBids: (winningTeam.waiverBids || []).map(b =>
                b.id === winner.id ? { ...b, status: 'won' } : b
            ),
        });

        // Mark all losing bids
        sorted.slice(1).forEach(loser => {
            const losingTeam = teamMap.get(loser.teamId);
            if (!losingTeam) return;
            teamMap.set(loser.teamId, {
                ...losingTeam,
                transactions: [
                    ...(losingTeam.transactions || []),
                    {
                        id: `wvr-loss-${Date.now()}-${loser.teamId}`,
                        type: 'WAIVER_LOSS' as const,
                        timestamp: Date.now(),
                        description: `Waiver loss: ${loser.playerName} (bid: $${loser.bidAmount} FAAB)`,
                        playerName: loser.playerName,
                        amount: loser.bidAmount,
                    },
                ],
                waiverBids: (losingTeam.waiverBids || []).map(b =>
                    b.id === loser.id ? { ...b, status: 'lost' } : b
                ),
            });
        });
    });

    return Array.from(teamMap.values());
}

// ── Schedule Helpers ──────────────────────────────────────────────────────────

/**
 * Returns the ms timestamp of the next Tuesday at 02:00 local time.
 * Standard fantasy waiver wire processing window.
 */
export function getNextWaiverTime(): number {
    const now = new Date();
    const day = now.getDay(); // 0=Sun, 2=Tue
    // Days until Tuesday: if today is Tue and it's before 2am, same day; else next Tuesday
    const daysUntilTue = day === 2 && now.getHours() < 2 ? 0 : (2 - day + 7) % 7 || 7;
    const next = new Date(now);
    next.setDate(now.getDate() + daysUntilTue);
    next.setHours(2, 0, 0, 0);
    return next.getTime();
}

/** Formats ms duration into "Xd Yh Zm" countdown string. */
export function formatCountdown(ms: number): string {
    if (ms <= 0) return 'Processing now';
    const totalSecs = Math.floor(ms / 1000);
    const d = Math.floor(totalSecs / 86400);
    const h = Math.floor((totalSecs % 86400) / 3600);
    const m = Math.floor((totalSecs % 3600) / 60);
    if (d > 0) return `${d}d ${h}h ${m}m`;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m ${totalSecs % 60}s`;
}

/** Initialises waiver fields on a team that pre-dates the waiver system. */
export function ensureWaiverFields(team: FantasyTeam, priority: number): FantasyTeam {
    return {
        ...team,
        faabBalance: team.faabBalance ?? 100,
        waiverPriority: team.waiverPriority ?? priority,
        waiverBids: team.waiverBids ?? [],
    };
}
