
// Canonical Data Model for Trier Fantasy

export interface CanonicalPlayer {
    id: string; // Internal UUID or Source ID
    sourceId: string; // ESPN ID

    // Bio
    firstName: string;
    lastName: string;
    fullName: string;
    position: 'QB' | 'RB' | 'WR' | 'TE' | 'K' | 'DST' | 'LB' | 'DL' | 'DB' | 'OL';
    team: string; // "CHI"
    jersey?: string;

    // Physical
    height: string; // "6' 3\""
    weight: string; // "235 lbs"
    age?: number;
    college?: string;

    // Media
    headshotUrl: string;

    // Status
    isActive: boolean;

    // Analysis (To be calculated/fetched later)
    stats: Record<string, any>; // Flexible for now
    fantasyPoints: number;
}

// ESPN API Response Types (for type safety during ingestion)
export interface EspnAthleteItem {
    id: string;
    firstName: string;
    lastName: string;
    fullName: string;
    displayName: string;
    weight: number;
    displayWeight: string;
    height: number;
    displayHeight: string;
    age?: number;
    jersey?: string;
    position: {
        id: string;
        name: string;
        abbreviation: string;
    };
    headshot?: {
        href: string;
    };
    status: {
        type: string; // "active"
    };
    college?: {
        name: string;
    };
}

export interface EspnRosterResponse {
    timestamp: string;
    athletes: {
        position: string; // "offense", "defense", "special teams"
        items: EspnAthleteItem[];
    }[];
}
