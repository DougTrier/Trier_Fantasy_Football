/**
 * types.ts — Canonical Domain Types
 * ===================================
 * Single source of truth for all shared data shapes used across the app,
 * services, and P2P sync layer. Changing these affects wire format — do
 * not rename fields without updating EventStore serialization and any
 * peer-synced payloads simultaneously.
 */

// All valid fantasy-relevant NFL positions, including IDP (DL/LB/DB).
export type Position = 'QB' | 'RB' | 'WR' | 'TE' | 'K' | 'DST' | 'LB' | 'DL' | 'DB' | 'OL' | 'P' | 'LS';

/**
 * Player — The core data entity for every NFL player in the system.
 * Supports three data tiers:
 *   - Tier 1: Basic identity (id, name, position, team)
 *   - Tier 2: Historical/projected stats and bio enrichment
 *   - Tier 3: Live scoring data sourced from the Sleeper pipeline
 */
export interface Player {
    id: string;
    firstName: string;
    lastName: string;
    position: Position;
    team: string; // NFL Team abbreviation (e.g. "KC", "BUF")
    photoUrl?: string; // For the "Beautiful" aspect
    projectedPoints: number;
    adp?: number; // Average Draft Position — lower is better
    ownership?: string; // e.g. "98%"

    // Bio Stats
    height?: string;
    weight?: string;
    college?: string;
    age?: number;
    yearsExp?: number;

    // Phase 2 Data
    historicalStats?: {
        year: number;
        team?: string;
        gamesPlayed: number;
        fantasyPoints: number;
        // Granular Box Score
        passingYards?: number;
        passingTDs?: number;
        rushingYards?: number;
        rushingTDs?: number;
        receptions?: number;
        receivingYards?: number;
        receivingTDs?: number;
        interceptions?: number;
    }[];
    projectedStats?: {
        year: number;
        gamesPlayed: number;
        fantasyPoints: number;
        passingYards?: number;
        passingTDs?: number;
        rushingYards?: number;
        rushingTDs?: number;
        receivingYards?: number;
        receivingTDs?: number;
        interceptions?: number;
    };
    combineStats?: {
        forty_yard: number | null;
        ten_yard_split: number | null;
        vertical_in: number | null;
        broad_jump_in: number | null;
        bench_press_reps: number | null;
        three_cone: number | null;
        shuttle: number | null;
        measurements: {
            height_in: number | null;
            weight_lb: number | null;
            arm_length_in: number | null;
            hand_size_in: number | null;
        };
        source_url?: string;
        combine_tab_visible?: boolean;
        display_status?: "OFFICIAL" | "UNOFFICIAL";
    };
    nflProfileUrl?: string;
    socials?: {
        twitter?: string;
        facebook?: string;
        instagram?: string;
        snapchat?: string;
        tiktok?: string;
        youtube?: string;
        rumble?: string;
    };
    currentSeasonLogs?: {
        week: number;
        opponent: string;
        points: number;
        stats: {
            passingYards?: number;
            passingTDs?: number;
            rushingYards?: number;
            rushingTDs?: number;
            receivingYards?: number;
            receivingTDs?: number;
            receptions?: number;
            int?: number;
            fumbles?: number;
        };
    }[];
    financials?: {
        nflContract: {
            year: number;
            amount: number;
        };
        sponsorships: {
            vendor: string;
            amount: number;
        }[];
        lifetimeEarnings: number;
    };
    bio?: {
        height?: string;
        weight?: string;
        college?: string;
        age?: string;
        stats?: {
            passingYards?: string;
            passingTDs?: string;
            rushingYards?: string;
            rushingTDs?: string;
            receivingYards?: string;
            receivingTDs?: string;
            receptions?: string;
        };
        financials?: {
            nflContract: { amount: number; year: number; };
            lifetimeEarnings: number;
        };
    };
    stats?: {
        // Passing
        cmp?: number;
        att?: number;
        cmpPct?: number;
        passingYards?: number;
        passingTDs?: number;
        int?: number;
        rate?: number;

        // Rushing
        rushingAtt?: number;
        rushingYards?: number;
        rushingAvg?: number;
        rushingTDs?: number;

        // Receiving
        receptions?: number;
        receivingYards?: number;
        receivingAvg?: number;
        receivingTDs?: number;
        targets?: number;

        // Defensive
        sacks?: number;
        defensiveTDs?: number;
        fumblesLost?: number;
    };
    isEnriched?: boolean;
    espnId?: string;
    sourceId?: string;

    // Performance Differential fields — computed by the Sleeper pipeline.
    // Positive = player outperformed projection; negative = underperformed.
    total_actual_fantasy_points?: number | null;
    total_projected_fantasy_points?: number | null;
    performance_differential?: number | null;
    ownerId?: string | null; // "Single Owner" rule — null means unowned/free agent

    // Dynasty fields — set when a player is drafted in a dynasty league
    draftedRound?: number;     // fantasy draft round (1-based)
    draftedYear?: number;      // season year they were drafted in this fantasy league
    contractYear?: number;     // 1 = first year; increments each season kept
}

/**
 * Transaction — Immutable ledger entry for every roster/trade event.
 * TRADE_OFFER creates escrow; TRADE_ACCEPT or decline releases it.
 * amount is denominated in Production Points (PTS), not dollars.
 */
/**
 * WaiverBid — a blind FAAB claim submitted by a team for a free agent.
 * Status transitions: pending → won | lost | cancelled.
 */
export interface WaiverBid {
    id: string;
    teamId: string;
    playerId: string;
    playerName: string;
    dropPlayerId?: string;   // player to drop from bench when claim succeeds
    dropPlayerName?: string;
    bidAmount: number;       // FAAB dollars (0–100)
    submittedAt: number;     // Unix ms timestamp
    status: 'pending' | 'won' | 'lost' | 'cancelled';
}

/** Dynasty draft pick — a tradable asset representing a future draft slot. */
export interface DraftPick {
    id: string;
    year: number;              // NFL season year this pick is for
    round: number;             // 1-based round number
    originalTeamId: string;    // team this pick originally belonged to
    currentTeamId: string;     // current owner (may differ after trades)
    note?: string;             // e.g. "via The Tuskers"
}

/** Dynasty mode settings stored inside league.settings. */
export interface DynastySettings {
    enabled: boolean;
    maxKeepers: number;           // max players each team can retain (1–10)
    contractYearsEnabled: boolean; // players have a 3-year max before they expire
}

export interface Transaction {
    id: string;
    type: 'ADD' | 'DROP' | 'TRADE' | 'STASH' | 'SWAP' | 'TRADE_OFFER' | 'TRADE_ACCEPT' | 'WAIVER_WIN' | 'WAIVER_LOSS' | 'KEEPER_DESIGNATE' | 'KEEPER_RELEASE' | 'DRAFT_PICK_TRADE';
    date?: string;
    timestamp: number;
    description: string;
    amount?: number;
    teamId?: string;
    otherTeamId?: string;
    playerName?: string;
    targetPlayerId?: string; // The player being offered on / traded away
}

/**
 * FantasyTeam — Full team state including roster, bench, and financial ledger.
 *
 * ROSTER SLOTS: 9 active starters (fixed) + unlimited bench.
 * LEDGER: total_production_pts is the team's earned currency from player performance.
 *         points_escrowed is held temporarily during open trade offers.
 *         points_spent is the running total of points paid out in completed trades.
 */
export interface FantasyTeam {
    id: string;
    name: string;
    ownerName: string;
    password?: string;
    roster: {
        qb: Player | null;
        rb1: Player | null;
        rb2: Player | null;
        wr1: Player | null;
        wr2: Player | null;
        te: Player | null;
        flex: Player | null; // RB/WR/TE eligible
        k: Player | null;
        dst: Player | null;
        // IDP slots — optional so existing leagues without IDP don't break
        lb?: Player | null;
        dl?: Player | null;
        db?: Player | null;
    };
    bench: Player[];
    budget?: number; // Optional legacy budget field (pre-ledger)
    points?: {
        total: number;
        projected: number;
        weekly: number[];
    };
    standing?: number;
    transactions?: Transaction[];
    // Ledger System — tracks Production Points economy
    total_production_pts?: number;
    points_escrowed?: number; // Held while an outgoing trade offer is open
    points_spent?: number;
    ownerId?: string;
    // H2H Season Record — updated each time the commissioner completes a week
    wins?: number;
    losses?: number;
    ties?: number;
    weeklyScores?: number[];  // Points scored per week (index 0 = week 1)
    // Waiver Wire — FAAB budget, priority order, and pending claims
    faabBalance?: number;       // Free Agent Acquisition Budget (default 100)
    waiverPriority?: number;    // Lower number = higher priority; worst record gets 1
    waiverBids?: WaiverBid[];   // Pending blind bids awaiting Tuesday processing

    // Dynasty fields
    keptPlayerIds?: string[];   // IDs designated as keepers for the upcoming season
    draftPicks?: DraftPick[];   // Future draft picks owned by this team
}

/**
 * Matchup — a single head-to-head game between two teams in a given week.
 * Scores are recorded when the week is marked complete by the commissioner.
 */
export interface Matchup {
    id: string;
    week: number;
    homeTeamId: string;
    awayTeamId: string;
    homeScore?: number;  // Actual points scored; undefined until week is complete
    awayScore?: number;
    completed: boolean;
}

// ── Scoring Rulesets ─────────────────────────────────────────────────────────

/** All per-stat weights that define a fantasy scoring format. */
export interface ScoringRuleset {
    name: string;
    presetKey: 'PPR' | 'Half PPR' | 'Standard' | 'TEP' | 'Custom';
    // Passing
    passingYardsPerPoint: number;     // pts per yard (e.g. 25 → 1pt/25yds)
    passingTDPoints: number;
    passingINTPoints: number;
    passing300YardBonus: number;      // flat bonus for ≥300 passing yards
    passing400YardBonus: number;      // flat bonus for ≥400 passing yards
    // Rushing
    rushingYardsPerPoint: number;
    rushingTDPoints: number;
    rushing100YardBonus: number;
    rushing200YardBonus: number;
    // Receiving
    receivingYardsPerPoint: number;
    receivingTDPoints: number;
    receptionPoints: number;          // 1=PPR, 0.5=Half, 0=Standard
    tepBonus: number;                 // extra pts per TE reception (TEP)
    receiving100YardBonus: number;
    receiving200YardBonus: number;
    // Misc
    fumbleLostPoints: number;
    // Kicker
    fgUnder40Points: number;
    fg40to49Points: number;
    fg50plusPoints: number;
    xpPoints: number;
    missedXPPoints: number;
    // D/ST
    dstSackPoints: number;
    dstINTPoints: number;
    dstTDPoints: number;
    dstSafetyPoints: number;
    dstFumbleRecPoints: number;
    // IDP
    soloTacklePoints: number;
    assistedTacklePoints: number;
    idpSackPoints: number;
    tflPoints: number;
    passDefPoints: number;
    qbHitPoints: number;
    ffPoints: number;
    blockedKickPoints: number;
}

/** Built-in preset rulesets — all match legacy PPR defaults except receptionPoints/tepBonus. */
export const SCORING_PRESETS: Record<string, ScoringRuleset> = {
    PPR: {
        name: 'Full PPR', presetKey: 'PPR',
        passingYardsPerPoint: 25, passingTDPoints: 4, passingINTPoints: -2,
        passing300YardBonus: 0, passing400YardBonus: 0,
        rushingYardsPerPoint: 10, rushingTDPoints: 6,
        rushing100YardBonus: 0, rushing200YardBonus: 0,
        receivingYardsPerPoint: 10, receivingTDPoints: 6,
        receptionPoints: 1, tepBonus: 0,
        receiving100YardBonus: 0, receiving200YardBonus: 0,
        fumbleLostPoints: -2,
        fgUnder40Points: 3, fg40to49Points: 4, fg50plusPoints: 5,
        xpPoints: 1, missedXPPoints: -1,
        dstSackPoints: 1, dstINTPoints: 2, dstTDPoints: 6,
        dstSafetyPoints: 2, dstFumbleRecPoints: 2,
        soloTacklePoints: 1, assistedTacklePoints: 0.5, idpSackPoints: 2,
        tflPoints: 1, passDefPoints: 1, qbHitPoints: 0.5, ffPoints: 2, blockedKickPoints: 3,
    },
    'Half PPR': {
        name: 'Half PPR', presetKey: 'Half PPR',
        passingYardsPerPoint: 25, passingTDPoints: 4, passingINTPoints: -2,
        passing300YardBonus: 0, passing400YardBonus: 0,
        rushingYardsPerPoint: 10, rushingTDPoints: 6,
        rushing100YardBonus: 0, rushing200YardBonus: 0,
        receivingYardsPerPoint: 10, receivingTDPoints: 6,
        receptionPoints: 0.5, tepBonus: 0,
        receiving100YardBonus: 0, receiving200YardBonus: 0,
        fumbleLostPoints: -2,
        fgUnder40Points: 3, fg40to49Points: 4, fg50plusPoints: 5,
        xpPoints: 1, missedXPPoints: -1,
        dstSackPoints: 1, dstINTPoints: 2, dstTDPoints: 6,
        dstSafetyPoints: 2, dstFumbleRecPoints: 2,
        soloTacklePoints: 1, assistedTacklePoints: 0.5, idpSackPoints: 2,
        tflPoints: 1, passDefPoints: 1, qbHitPoints: 0.5, ffPoints: 2, blockedKickPoints: 3,
    },
    Standard: {
        name: 'Standard', presetKey: 'Standard',
        passingYardsPerPoint: 25, passingTDPoints: 4, passingINTPoints: -2,
        passing300YardBonus: 0, passing400YardBonus: 0,
        rushingYardsPerPoint: 10, rushingTDPoints: 6,
        rushing100YardBonus: 0, rushing200YardBonus: 0,
        receivingYardsPerPoint: 10, receivingTDPoints: 6,
        receptionPoints: 0, tepBonus: 0,
        receiving100YardBonus: 0, receiving200YardBonus: 0,
        fumbleLostPoints: -2,
        fgUnder40Points: 3, fg40to49Points: 4, fg50plusPoints: 5,
        xpPoints: 1, missedXPPoints: -1,
        dstSackPoints: 1, dstINTPoints: 2, dstTDPoints: 6,
        dstSafetyPoints: 2, dstFumbleRecPoints: 2,
        soloTacklePoints: 1, assistedTacklePoints: 0.5, idpSackPoints: 2,
        tflPoints: 1, passDefPoints: 1, qbHitPoints: 0.5, ffPoints: 2, blockedKickPoints: 3,
    },
    TEP: {
        name: 'TEP (TE Premium)', presetKey: 'TEP',
        passingYardsPerPoint: 25, passingTDPoints: 4, passingINTPoints: -2,
        passing300YardBonus: 0, passing400YardBonus: 0,
        rushingYardsPerPoint: 10, rushingTDPoints: 6,
        rushing100YardBonus: 0, rushing200YardBonus: 0,
        receivingYardsPerPoint: 10, receivingTDPoints: 6,
        receptionPoints: 1, tepBonus: 0.5,     // TEs get 1.5 pts per catch
        receiving100YardBonus: 0, receiving200YardBonus: 0,
        fumbleLostPoints: -2,
        fgUnder40Points: 3, fg40to49Points: 4, fg50plusPoints: 5,
        xpPoints: 1, missedXPPoints: -1,
        dstSackPoints: 1, dstINTPoints: 2, dstTDPoints: 6,
        dstSafetyPoints: 2, dstFumbleRecPoints: 2,
        soloTacklePoints: 1, assistedTacklePoints: 0.5, idpSackPoints: 2,
        tflPoints: 1, passDefPoints: 1, qbHitPoints: 0.5, ffPoints: 2, blockedKickPoints: 3,
    },
};

/**
 * League — Top-level container for all teams and season configuration.
 * Settings are optional to support both the legacy roster-only mode and
 * the full points-economy mode introduced in Season 2.
 */
export interface League {
    id: string;
    name: string;
    teams: FantasyTeam[];
    settings?: {
        budget: number;
        maxPlayers: number;
        ruleset: ScoringRuleset;   // replaces legacy pointsFormat string
        dynastySettings?: DynastySettings;
    };
    // H2H Weekly Schedule
    schedule?: Matchup[];
    currentWeek?: number;   // Active week (1-indexed); commissioner advances it
    numWeeks?: number;      // 14 or 16 regular-season weeks
    history?: {
        year: number;
        champion: string;
        points: number;
        // Extended fields populated when admin archives a completed season
        championOwner?: string;
        championRecord?: string;      // e.g. "12-2-0"
        championPoints?: number;      // total season fantasy points
        topScorer?: {
            playerName: string;
            position: string;
            points: number;
            teamAbbr: string;
        };
        standings?: {
            rank: number;
            teamName: string;
            ownerName: string;
            wins: number;
            losses: number;
            ties: number;
            totalPoints: number;
        }[];
    }[];
}
