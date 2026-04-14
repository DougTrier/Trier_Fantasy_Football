export interface ScoutIntel {
    playerLastName: string;
    socialIntelligence: string;
    trendingNews?: string;
    scoutSentiment: string[];
}

export const ScoutVocab = {
    opening: [
        "The tape on #{player} doesn't lie: ",
        "Inside the war room, the consensus on #{player} is clear: ",
        "Watching the film, you can't ignore how #{player} ",
        "The metrics suggest a heavy dose of #{player} this week: ",
        "Looking at the positional chart, #{player} has the edge here: "
    ],
    mismatch: [
        "is a nightmare in space.",
        "possesses functional strength that overwhelms.",
        "has the twitchiness to lose any defender.",
        "displays elite ball-tracking in high-traffic areas."
    ]
};

export const IntelligenceStore: Record<string, ScoutIntel> = {
    'Jefferson': {
        playerLastName: 'Jefferson',
        socialIntelligence: 'Prominent scouts like Greg Cosell highlight Jefferson as the "best receiver in football" despite recent per-game production dips.',
        trendingNews: 'Struggling with the 2025 quarterback transition; per-game yards (76.2) are at a career low due to inconsistent signal-calling.',
        scoutSentiment: [
            '"Can take the top off any defense and create after the catch."',
            '"Master of route-running nuances, often drawing triple-coverage."',
            '"QB situation in Minnesota is currently the only thing holding him back from 1,800+ yard pace."'
        ]
    },
    'Anusiem': {
        playerLastName: 'Anusiem',
        socialIntelligence: 'Identified as a raw, high-upside undrafted free agent with elite 4.39 speed.',
        trendingNews: 'Currently working on ball-tracking consistency; excels in aggressive man coverage but still learning zone depth.',
        scoutSentiment: [
            '"Physically imposing at the line of scrimmage with great length."',
            '"Willing contributor in run support, doesn\'t shy away from contact."',
            '"Speed allows him to recover from technical mistakes, but high-IQ WRs can bait him."'
        ]
    }
    // Add more intelligence as needed or dynamically fetch
};

export const getIntelForPlayer = (lastName: string): ScoutIntel | null => {
    return IntelligenceStore[lastName] || null;
};
