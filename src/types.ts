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
}

/**
 * Transaction — Immutable ledger entry for every roster/trade event.
 * TRADE_OFFER creates escrow; TRADE_ACCEPT or decline releases it.
 * amount is denominated in Production Points (PTS), not dollars.
 */
export interface Transaction {
    id: string;
    type: 'ADD' | 'DROP' | 'TRADE' | 'STASH' | 'SWAP' | 'TRADE_OFFER' | 'TRADE_ACCEPT';
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
}

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
        pointsFormat: 'PPR' | 'Half PPR' | 'Standard';
    };
    history?: {
        year: number;
        champion: string;
        points: number;
    }[];
}
