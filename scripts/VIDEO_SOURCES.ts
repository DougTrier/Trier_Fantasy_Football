// videoSources.ts
export type Platform = "youtube" | "x" | "web" | "tiktok" | "instagram";

export type VideoSource = {
    id: string;
    platform: Platform;
    priority: number; // lower = earlier
    // where to search (channel/account/site allowlists)
    allowlist: {
        channels?: string[];   // YouTube channel IDs OR channel handles if your search supports it
        accounts?: string[];   // X handles without @
        domains?: string[];    // For web sources (nfl.com, team sites, etc.)
    };
    // search templates
    queries: string[];
    // strict relevance rules (agent must enforce)
    mustInclude: string[];     // tokens that must appear in title/description/page or metadata
    mustNotInclude: string[];  // blocklist tokens
    // embed & verification capabilities
    verification: {
        requiresEmbeddableCheck: boolean; // must pass platform check before acceptance
        requiresRelevanceCheck: boolean;  // must pass relevance scoring before acceptance
    };
};

export const VIDEO_SOURCES: VideoSource[] = [
    // ---------- Tier 0: Official / safest ----------
    {
        id: "yt_nfl_official",
        platform: "youtube",
        priority: 0,
        allowlist: {
            // Prefer official NFL channel(s). Add more official channels you trust.
            channels: [
                "UCiWLfSweyRNmLpgEHekhoAg", // NFL (channel ID example; replace if you maintain your own list)
            ],
        },
        queries: [
            `{player} {team} highlights`,
            `{player} {team} {season} highlights`,
            `{team} highlights week {week} {season}`,
            `{player} mic'd up {team}`,
        ],
        mustInclude: ["{player}"],
        mustNotInclude: ["rickroll", "never gonna give you up", "compilation", "madden", "fan edit"],
        verification: { requiresEmbeddableCheck: true, requiresRelevanceCheck: true },
    },

    {
        id: "web_nfl_com",
        platform: "web",
        priority: 1,
        allowlist: { domains: ["nfl.com"] },
        queries: [
            `site:nfl.com {player} highlights`,
            `site:nfl.com videos {player} {team}`,
            `site:nfl.com {team} recap week {week} {season}`,
        ],
        mustInclude: ["{player}"],
        mustNotInclude: ["fantasy", "shop", "tickets"],
        verification: { requiresEmbeddableCheck: true, requiresRelevanceCheck: true },
    },

    {
        id: "x_nfl_official",
        platform: "x",
        priority: 2,
        allowlist: { accounts: ["NFL"] },
        queries: [
            `{player} {team} (from:NFL)`,
            `{team} highlight (from:NFL) week {week}`,
            `{player} TD (from:NFL)`,
        ],
        mustInclude: ["{player}"],
        mustNotInclude: ["giveaway", "podcast"],
        verification: { requiresEmbeddableCheck: true, requiresRelevanceCheck: true },
    },

    // ---------- Tier 1: Broadcast / major outlets ----------
    {
        id: "yt_espn_nfl",
        platform: "youtube",
        priority: 3,
        allowlist: {
            channels: [
                "UCiWLfSweyRNmLpgEHekhoAg", // Replace with ESPN / NFL on ESPN channel IDs you maintain
            ],
        },
        queries: [
            `{player} {team} highlights ESPN`,
            `{team} recap ESPN`,
        ],
        mustInclude: ["{player}"],
        mustNotInclude: ["full game", "illegal", "stream"],
        verification: { requiresEmbeddableCheck: true, requiresRelevanceCheck: true },
    },

    {
        id: "x_sports_outlets",
        platform: "x",
        priority: 4,
        allowlist: {
            accounts: ["ESPNNFL", "SportsCenter", "CBSSports", "SNFonNBC", "NFLonFOX", "espn", "NBCSports"],
        },
        queries: [
            `{player} (from:{acct})`,
            `{player} {team} highlight (from:{acct})`,
            `{team} touchdown (from:{acct})`,
        ],
        mustInclude: ["{player}"],
        mustNotInclude: ["bet", "odds", "promo"],
        verification: { requiresEmbeddableCheck: true, requiresRelevanceCheck: true },
    },

    // ---------- Tier 2: Team accounts / team YouTube ----------
    {
        id: "x_team_accounts",
        platform: "x",
        priority: 5,
        allowlist: {
            // Your agent should map team -> official handle (e.g., "Chiefs", "49ers", etc.)
            accounts: ["{teamOfficialHandle}"],
        },
        queries: [
            `{player} (from:{teamOfficialHandle})`,
            `{player} highlight (from:{teamOfficialHandle})`,
            `{player} {season} (from:{teamOfficialHandle})`,
        ],
        mustInclude: ["{player}"],
        mustNotInclude: ["shop", "tickets"],
        verification: { requiresEmbeddableCheck: true, requiresRelevanceCheck: true },
    },

    {
        id: "yt_team_channels",
        platform: "youtube",
        priority: 6,
        allowlist: {
            channels: ["{teamYouTubeChannelId}"], // agent resolves from a team->channel map
        },
        queries: [
            `{player} highlights`,
            `{player} {season} highlights`,
            `{player} best plays`,
        ],
        mustInclude: ["{player}"],
        mustNotInclude: ["rickroll", "rick roll", "never gonna give you up", "compilation", "madden", "fan edit"],
        verification: { requiresEmbeddableCheck: true, requiresRelevanceCheck: true },
    },
];
