/**
 * IntelligenceStore — Curated + Auto-Generated Scout Intelligence
 * ================================================================
 * Two-tier system for player scouting content:
 *
 *   Tier 1 (Curated)   — Hand-authored entries for top ~25 players. Each has
 *                         a reporter feed with 2-3 beat writer quotes and a
 *                         hand-set sentimentTrend.
 *
 *   Tier 2 (Generated) — generateIntelForPlayer() produces contextual intel for
 *                         ALL other players using live data: injury status, depth
 *                         chart position, performance differential, and ADP.
 *                         Never returns null — every player gets a report.
 *
 * Usage:
 *   import { getIntelForPlayer, generateIntelForPlayer } from './IntelligenceStore';
 *   const intel = getIntelForPlayer(player.lastName) ?? generateIntelForPlayer(player);
 */
import type { Player } from '../types';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ReporterItem {
    reporter: string;
    outlet: string;
    headline: string;
    timestamp: string;    // relative e.g. "2h ago", "Mon", "3d ago"
    sentiment: 'bullish' | 'bearish' | 'neutral';
}

export interface ScoutIntel {
    playerLastName: string;
    socialIntelligence: string;
    trendingNews?: string;
    scoutSentiment: string[];
    // New in v1.5: sentiment summary and reporter feed
    sentimentTrend?: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    reporterFeed?: ReporterItem[];
}

// ─── ScoutVocab ───────────────────────────────────────────────────────────────

/**
 * ScoutVocab — Sentence templates for dynamically generated scouting prose.
 * {player} is replaced at render time with the player's last name.
 */
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

// ─── Curated Store ────────────────────────────────────────────────────────────

/** Keyed by exact player last name (as it appears in the Player type). */
export const IntelligenceStore: Record<string, ScoutIntel> = {

    // ── QBs ──────────────────────────────────────────────────────────────────

    'Allen': {
        playerLastName: 'Allen',
        sentimentTrend: 'BULLISH',
        socialIntelligence: 'Josh Allen enters the week as the consensus QB1, combining elite arm talent with elite rushing ability. Analytics models project a top-2 finish at the position for the sixth consecutive season.',
        trendingNews: 'Posted back-to-back 30+ point fantasy performances. Usage rate on designed runs remains the highest of any QB in the league.',
        scoutSentiment: [
            '"He is the complete package — arm strength, mobility, football IQ."',
            '"Defensive coordinators have no answer for his third-down scramble threat."',
            '"He has elevated himself into a tier by himself this season."'
        ],
        reporterFeed: [
            { reporter: 'Ian Rapoport', outlet: 'NFL Network', headline: 'Allen designated full participant in practice — no injury designation heading into Sunday.', timestamp: '6h ago', sentiment: 'bullish' },
            { reporter: 'Field Yates', outlet: 'ESPN', headline: 'Bills offensive coordinator confirms Allen will maintain his rushing package regardless of opponent.', timestamp: '1d ago', sentiment: 'bullish' },
            { reporter: 'Adam Schefter', outlet: 'ESPN', headline: 'Josh Allen extension talks progressing; both sides motivated to get a deal done before season ends.', timestamp: '3d ago', sentiment: 'neutral' }
        ]
    },

    'Jackson': {
        playerLastName: 'Jackson',
        sentimentTrend: 'BULLISH',
        socialIntelligence: 'Lamar Jackson is producing at an MVP pace. His dual-threat ceiling makes him nearly unguardable when the Ravens get creative with the run game.',
        trendingNews: 'Leads all QBs in rushing yards over the past four weeks. The Ravens have dialed up more designed runs than any offense in football.',
        scoutSentiment: [
            '"When he takes off, the defense is in scramble mode."',
            '"The best athlete playing the quarterback position, period."',
            '"His efficiency numbers in the red zone are generational."'
        ],
        reporterFeed: [
            { reporter: 'Tom Pelissero', outlet: 'NFL Network', headline: 'Jackson listed as a full practice participant Wednesday. Expected to play Sunday.', timestamp: '8h ago', sentiment: 'bullish' },
            { reporter: 'Jordan Schultz', outlet: 'The Score', headline: 'Ravens OC signals increased usage for Lamar at the goal line following last week\'s short-yardage issues.', timestamp: '1d ago', sentiment: 'bullish' }
        ]
    },

    'Mahomes': {
        playerLastName: 'Mahomes',
        sentimentTrend: 'BULLISH',
        socialIntelligence: 'Patrick Mahomes continues to defy gravity. Despite a supporting cast that changes year-over-year, his efficiency metrics remain elite across every meaningful category.',
        trendingNews: 'Has thrown multiple TDs in 8 of his last 10 games. Red zone targets are up 22% since Week 6 as the Chiefs lean on him in crunch time.',
        scoutSentiment: [
            '"The best quarterback in football when the game is on the line."',
            '"He makes throws that no one else in the league even attempts."',
            '"Even without elite receivers, he finds a way to produce at a QB1 level."'
        ],
        reporterFeed: [
            { reporter: 'Adam Schefter', outlet: 'ESPN', headline: 'Mahomes did not carry an injury designation into the week and is expected to play at full strength.', timestamp: '5h ago', sentiment: 'bullish' },
            { reporter: 'Field Yates', outlet: 'ESPN', headline: 'Andy Reid confirms the Chiefs will not limit Mahomes\' volume regardless of score.', timestamp: '2d ago', sentiment: 'bullish' }
        ]
    },

    'Hurts': {
        playerLastName: 'Hurts',
        sentimentTrend: 'NEUTRAL',
        socialIntelligence: 'Jalen Hurts is a borderline QB1/QB2 this week. His floor is protected by the rushing touchdowns, but the passing efficiency has been inconsistent.',
        trendingNews: 'Rushing TD rate is down from last season but still among top-3 QBs. Passing yards have been volatile — three games under 200 yards in the last six weeks.',
        scoutSentiment: [
            '"His rushing floor makes him a safe play even in bad matchups."',
            '"The passing game consistency is the only thing separating him from the top tier."',
            '"DeVonta Smith\'s usage is the key to unlocking Hurts\' ceiling."'
        ],
        reporterFeed: [
            { reporter: 'Tim McManus', outlet: 'ESPN', headline: 'Hurts listed as limited in Wednesday practice with shoulder — monitor throughout the week.', timestamp: '10h ago', sentiment: 'neutral' },
            { reporter: 'Field Yates', outlet: 'ESPN', headline: 'Eagles OC notes Hurts has been managing the shoulder since training camp — not considered serious.', timestamp: '1d ago', sentiment: 'neutral' }
        ]
    },

    // ── RBs ──────────────────────────────────────────────────────────────────

    'Henry': {
        playerLastName: 'Henry',
        sentimentTrend: 'BULLISH',
        socialIntelligence: 'Derrick Henry\'s move to Baltimore has reinvigorated his career. The Ravens\' commitment to the run and Lamar\'s presence have created an elite ground game.',
        trendingNews: 'Top-5 in rush yards over the past month. Goal-line carries remain his bread and butter — averaging 4.1 red zone looks per game.',
        scoutSentiment: [
            '"He is impossible to bring down in open space — still running like 2020."',
            '"The Ravens\' run-first identity is built around his volume."',
            '"Elite goal-line back with enough speed to break the big one."'
        ],
        reporterFeed: [
            { reporter: 'Tom Pelissero', outlet: 'NFL Network', headline: 'Derrick Henry had a full practice week and carries no injury designation.', timestamp: '4h ago', sentiment: 'bullish' },
            { reporter: 'Jordan Schultz', outlet: 'The Score', headline: 'Ravens HC confirms Henry will handle the bulk of the backfield work Sunday.', timestamp: '1d ago', sentiment: 'bullish' }
        ]
    },

    'Barkley': {
        playerLastName: 'Barkley',
        sentimentTrend: 'BULLISH',
        socialIntelligence: 'Saquon Barkley is thriving in Philadelphia\'s wide-zone scheme. His receiving ability in Sirianni\'s offense creates consistent floor with weekly upside.',
        trendingNews: 'Leads Eagles in receptions from backfield. Has topped 100 scrimmage yards in 4 of the last 6 games.',
        scoutSentiment: [
            '"The Eagles have unlocked a new dimension of his game through the passing attack."',
            '"As good a pass-catching back as there is in football."',
            '"His vision in the zone scheme is legitimately elite."'
        ],
        reporterFeed: [
            { reporter: 'Tim McManus', outlet: 'ESPN', headline: 'Saquon Barkley full participant Wednesday — no injury concerns.', timestamp: '7h ago', sentiment: 'bullish' },
            { reporter: 'Field Yates', outlet: 'ESPN', headline: 'Eagles to feature Barkley heavily in the passing game against Cover-2 looks.', timestamp: '1d ago', sentiment: 'bullish' }
        ]
    },

    'Gibbs': {
        playerLastName: 'Gibbs',
        sentimentTrend: 'BULLISH',
        socialIntelligence: 'Jahmyr Gibbs is ascending into the RB1 conversation. Detroit\'s offensive identity is shifting toward giving him the lion\'s share of early-down work.',
        trendingNews: 'Snap share has increased to 65% over the last three weeks. Montgomery injury opened the path to true three-down usage.',
        scoutSentiment: [
            '"Elite speed that creates explosive plays on nearly every touch."',
            '"The Lions\' best playmaker — not just at running back."',
            '"Route-running from the backfield is genuinely special."'
        ],
        reporterFeed: [
            { reporter: 'Eric Woodyard', outlet: 'ESPN', headline: 'Gibbs confirmed as Detroit\'s lead back for Sunday after Montgomery ruled out.', timestamp: '3h ago', sentiment: 'bullish' },
            { reporter: 'Field Yates', outlet: 'ESPN', headline: 'Lions OC signals "full workload" for Gibbs heading into Sunday\'s game.', timestamp: '20h ago', sentiment: 'bullish' }
        ]
    },

    'McCaffrey': {
        playerLastName: 'McCaffrey',
        sentimentTrend: 'NEUTRAL',
        socialIntelligence: 'Christian McCaffrey\'s floor remains elite when healthy, but the injury management this season has created weekly uncertainty in his snap share.',
        trendingNews: 'Limited to under 60% of snaps in three of the last five games. Kyle Shanahan has shown a willingness to manage his workload on short weeks.',
        scoutSentiment: [
            '"When healthy and on the field, there is no better fantasy asset."',
            '"The 49ers\' entire offense flows through him — the question is always health."',
            '"On a short week, his snap share is the most important number to watch."'
        ],
        reporterFeed: [
            { reporter: 'Adam Schefter', outlet: 'ESPN', headline: 'McCaffrey listed as limited in Wednesday practice. Being monitored but expected to play.', timestamp: '9h ago', sentiment: 'neutral' },
            { reporter: 'Jordan Schultz', outlet: 'The Score', headline: 'Kyle Shanahan: "We\'ll see how he feels Thursday. We\'re not going to rush him."', timestamp: '1d ago', sentiment: 'neutral' }
        ]
    },

    // ── WRs ──────────────────────────────────────────────────────────────────

    'Jefferson': {
        playerLastName: 'Jefferson',
        sentimentTrend: 'NEUTRAL',
        socialIntelligence: 'Prominent scouts like Greg Cosell highlight Jefferson as the "best receiver in football" despite recent per-game production dips.',
        trendingNews: 'Struggling with the 2025 quarterback transition; per-game yards (76.2) are at a career low due to inconsistent signal-calling.',
        scoutSentiment: [
            '"Can take the top off any defense and create after the catch."',
            '"Master of route-running nuances, often drawing triple-coverage."',
            '"QB situation in Minnesota is currently the only thing holding him back from 1,800+ yard pace."'
        ],
        reporterFeed: [
            { reporter: 'Kevin Seifert', outlet: 'ESPN', headline: 'Jefferson and the new Vikings QB building chemistry through extra reps this week.', timestamp: '1d ago', sentiment: 'neutral' },
            { reporter: 'Field Yates', outlet: 'ESPN', headline: 'Jefferson\'s target share (31%) remains elite — volume is there; efficiency is the concern.', timestamp: '2d ago', sentiment: 'neutral' }
        ]
    },

    'Chase': {
        playerLastName: 'Chase',
        sentimentTrend: 'BULLISH',
        socialIntelligence: 'Ja\'Marr Chase and Joe Burrow\'s connection is one of the most efficient QB-WR pairings in football. His yards-per-route-run number is elite.',
        trendingNews: 'Six straight games with 80+ receiving yards. Burrow is targeting him on 33% of routes run — a historic usage rate.',
        scoutSentiment: [
            '"The most complete receiver in football not named Jefferson."',
            '"He and Burrow have developed a truly special connection."',
            '"His ability to separate at all three levels of the route tree is borderline unprecedented."'
        ],
        reporterFeed: [
            { reporter: 'Ben Baby', outlet: 'ESPN', headline: 'Chase full participant in practice Wednesday, will play Sunday.', timestamp: '5h ago', sentiment: 'bullish' },
            { reporter: 'Adam Schefter', outlet: 'ESPN', headline: 'Bengals have drawn up new red zone packages to get Chase more goal-line looks.', timestamp: '2d ago', sentiment: 'bullish' }
        ]
    },

    'Hill': {
        playerLastName: 'Hill',
        sentimentTrend: 'NEUTRAL',
        socialIntelligence: 'Tyreek Hill\'s floor has dipped without Tua Tagovailoa operating at full capacity. His speed and route-running create weekly ceiling potential, but the volume is inconsistent.',
        trendingNews: 'Contract restructure talks creating off-field noise. Target share over the last four weeks (22%) is below his career average of 28%.',
        scoutSentiment: [
            '"Physically, there isn\'t a player faster in the NFL today."',
            '"The question is always whether the offense will give him enough touches."',
            '"Can be neutralized by elite press corners — matchup dependent."'
        ],
        reporterFeed: [
            { reporter: 'Cameron Wolfe', outlet: 'NFL Network', headline: 'Tyreek Hill practicing in full Wednesday — no limitations noted.', timestamp: '6h ago', sentiment: 'neutral' },
            { reporter: 'Adam Schefter', outlet: 'ESPN', headline: 'Tyreek Hill and the Dolphins are working through a contract restructure — not expected to affect availability.', timestamp: '2d ago', sentiment: 'neutral' }
        ]
    },

    'St. Brown': {
        playerLastName: 'St. Brown',
        sentimentTrend: 'BULLISH',
        socialIntelligence: 'Amon-Ra St. Brown is the engine of the Detroit passing game. His slot usage and short-to-intermediate route tree generates elite PPR volume.',
        trendingNews: 'Leads the NFL in slot targets over the last six weeks. Ben Johnson\'s scheme creates consistent matchup advantages against linebackers.',
        scoutSentiment: [
            '"The most dangerous receiver in Detroit\'s offense — pure volume machine."',
            '"His ability to find soft spots in zone coverage is elite-level IQ."',
            '"Even when the box score looks modest, the target total rarely disappoints."'
        ],
        reporterFeed: [
            { reporter: 'Eric Woodyard', outlet: 'ESPN', headline: 'St. Brown full practice participant this week, no concerns heading into Sunday.', timestamp: '7h ago', sentiment: 'bullish' },
            { reporter: 'Field Yates', outlet: 'ESPN', headline: 'Detroit\'s slot-heavy scheme faces a favorable matchup this week — ideal for St. Brown.', timestamp: '1d ago', sentiment: 'bullish' }
        ]
    },

    'Nacua': {
        playerLastName: 'Nacua',
        sentimentTrend: 'BULLISH',
        socialIntelligence: 'Puka Nacua has cemented himself as the Rams\' top receiver. His pre-snap motion usage and route versatility make him Sean McVay\'s favorite target.',
        trendingNews: 'Leads the Rams in air yards over the last month. Stafford\'s trust in him on third down is reflected in a 38% target share on critical downs.',
        scoutSentiment: [
            '"McVay has installed him as the clear alpha — the usage speaks for itself."',
            '"His pre-snap reads are already at a veteran level for a second-year player."',
            '"Stafford looks his way early and often when the game is in the balance."'
        ],
        reporterFeed: [
            { reporter: 'Sarah Barshop', outlet: 'ESPN', headline: 'Nacua a full practice participant — no injury concerns this week.', timestamp: '4h ago', sentiment: 'bullish' },
            { reporter: 'Jordan Schultz', outlet: 'The Score', headline: 'Rams WR corps depth concerns could elevate Nacua\'s role even further in the short term.', timestamp: '2d ago', sentiment: 'bullish' }
        ]
    },

    'Adams': {
        playerLastName: 'Adams',
        sentimentTrend: 'BEARISH',
        socialIntelligence: 'Davante Adams\' production is tied directly to the Raiders\' quarterback situation — which remains one of the least reliable in football.',
        trendingNews: 'Under 60 receiving yards in three of the last four games. The Raiders\' 29th-ranked passing offense is the central drag on his fantasy value.',
        scoutSentiment: [
            '"His route-running is still elite — the production numbers don\'t reflect his talent."',
            '"He is being let down by the quarterback situation. Same story, new season."',
            '"Hard to trust in fantasy until the Raiders stabilize at quarterback."'
        ],
        reporterFeed: [
            { reporter: 'Paul Gutierrez', outlet: 'ESPN', headline: 'Adams expressed frustration with the offense\'s consistency in a post-practice session.', timestamp: '1d ago', sentiment: 'bearish' },
            { reporter: 'Tom Pelissero', outlet: 'NFL Network', headline: 'Raiders have yet to resolve the QB carousel — Josh McDaniels offense still sputtering.', timestamp: '2d ago', sentiment: 'bearish' }
        ]
    },

    // ── TEs ──────────────────────────────────────────────────────────────────

    'Kelce': {
        playerLastName: 'Kelce',
        sentimentTrend: 'NEUTRAL',
        socialIntelligence: 'Travis Kelce remains the blueprint for TE usage, but the age narrative is becoming harder to ignore. Andy Reid\'s scheme continues to manufacture his production.',
        trendingNews: 'Target share (21%) is the lowest of his career over a 6-week stretch. Schemed open looks still coming, but contested coverage catches are harder to come by.',
        scoutSentiment: [
            '"The route running and release package are still elite even at this age."',
            '"Mahomes will find him — the system is built for it."',
            '"The floor is protected by the offense, but the ceiling has compressed."'
        ],
        reporterFeed: [
            { reporter: 'Adam Schefter', outlet: 'ESPN', headline: 'Kelce listed as a full participant Wednesday — knee maintenance not a concern this week.', timestamp: '6h ago', sentiment: 'neutral' },
            { reporter: 'Field Yates', outlet: 'ESPN', headline: 'Andy Reid on Kelce: "He is as good as ever in terms of preparation and reading defenses."', timestamp: '1d ago', sentiment: 'neutral' }
        ]
    },

    'Andrews': {
        playerLastName: 'Andrews',
        sentimentTrend: 'BULLISH',
        socialIntelligence: 'Mark Andrews is back to full health and operating as Lamar Jackson\'s security blanket. His red zone dominance makes him one of the most reliable fantasy TEs.',
        trendingNews: 'Three receiving TDs in the last four games. Lamar\'s connection with Andrews in the red zone is the highest-converting QB-TE pairing in the league.',
        scoutSentiment: [
            '"When healthy, he\'s the best TE in football — no debate."',
            '"His catch radius in the end zone is impossible to cover."',
            '"Lamar-to-Andrews in the red zone is becoming automatic."'
        ],
        reporterFeed: [
            { reporter: 'Jamison Hensley', outlet: 'ESPN', headline: 'Mark Andrews had a full week of practice and carries no injury designation.', timestamp: '3h ago', sentiment: 'bullish' },
            { reporter: 'Tom Pelissero', outlet: 'NFL Network', headline: 'Ravens coordinator confirms Andrews will see increased red zone alignment this week.', timestamp: '1d ago', sentiment: 'bullish' }
        ]
    },

    'Bowers': {
        playerLastName: 'Bowers',
        sentimentTrend: 'BULLISH',
        socialIntelligence: 'Brock Bowers has rewritten the rookie TE record book. His usage as a de facto WR in the Raiders\' offense creates consistent volume despite the QB uncertainty.',
        trendingNews: 'Leads all TEs in targets over the last 8 weeks. His route tree is the most diverse for a rookie TE since Travis Kelce\'s second season.',
        scoutSentiment: [
            '"He plays more like an elite WR than a tight end — remarkable football IQ."',
            '"The volume is there every week regardless of what else is happening on the offense."',
            '"Best rookie TE prospect since Andrew Gronkowski. The ceiling is generational."'
        ],
        reporterFeed: [
            { reporter: 'Paul Gutierrez', outlet: 'ESPN', headline: 'Bowers full go in practice Wednesday — Raiders confirm he will start and play full load.', timestamp: '5h ago', sentiment: 'bullish' },
            { reporter: 'Jordan Schultz', outlet: 'The Score', headline: 'Bowers named Raiders\' offensive captain for Sunday — rare honor for a rookie.', timestamp: '1d ago', sentiment: 'bullish' }
        ]
    },

    'LaPorta': {
        playerLastName: 'LaPorta',
        sentimentTrend: 'BULLISH',
        socialIntelligence: 'Sam LaPorta has solidified his role as Jared Goff\'s go-to check-down option and red zone target. The Lions\' high-volume passing attack benefits him weekly.',
        trendingNews: 'Target share in the red zone (18%) is the highest among TEs over the last five games. Goff\'s affinity for the slot creates consistent floor.',
        scoutSentiment: [
            '"Goff trusts him absolutely in clutch situations — the targets show it."',
            '"His ability to work the seam and the corner of the end zone is already elite."',
            '"Detroit\'s offensive identity continues to elevate his value."'
        ],
        reporterFeed: [
            { reporter: 'Eric Woodyard', outlet: 'ESPN', headline: 'LaPorta full practice all week — no injury designation heading into Sunday.', timestamp: '4h ago', sentiment: 'bullish' }
        ]
    },

    // ── Others ────────────────────────────────────────────────────────────────

    'Anusiem': {
        playerLastName: 'Anusiem',
        sentimentTrend: 'NEUTRAL',
        socialIntelligence: 'Identified as a raw, high-upside undrafted free agent with elite 4.39 speed.',
        trendingNews: 'Currently working on ball-tracking consistency; excels in aggressive man coverage but still learning zone depth.',
        scoutSentiment: [
            '"Physically imposing at the line of scrimmage with great length."',
            '"Willing contributor in run support, doesn\'t shy away from contact."',
            '"Speed allows him to recover from technical mistakes, but high-IQ WRs can bait him."'
        ]
    },

    'Achane': {
        playerLastName: 'Achane',
        sentimentTrend: 'BULLISH',
        socialIntelligence: 'De\'Von Achane is the most explosive back in football. His speed creates instant big-play potential on any given carry, and Miami leans on him in the passing game.',
        trendingNews: 'Leads all RBs in yards per carry (5.9) and explosive run rate. Tua targeting him on screens has become a signature play in the Miami scheme.',
        scoutSentiment: [
            '"There is no back in football with his combination of burst and acceleration."',
            '"Miami\'s entire offense is faster when he\'s on the field."',
            '"The only limit is touches — when he gets them, the upside is top-3 RB."'
        ],
        reporterFeed: [
            { reporter: 'Cameron Wolfe', outlet: 'NFL Network', headline: 'Achane designated full participant in practice Wednesday — trending toward playing Sunday.', timestamp: '6h ago', sentiment: 'bullish' }
        ]
    },

    'Tucker': {
        playerLastName: 'Tucker',
        sentimentTrend: 'NEUTRAL',
        socialIntelligence: 'Justin Tucker\'s accuracy record speaks for itself, but the Ravens\' red zone efficiency has reduced his opportunities compared to prior seasons.',
        trendingNews: 'Fewer field goal attempts per game than last season (1.6 vs 2.4). The Ravens\' improved red zone conversion rate is squeezing kicker value.',
        scoutSentiment: [
            '"Still the most reliable kicker in NFL history when called upon."',
            '"The concern isn\'t accuracy — it\'s opportunity volume this year."',
            '"A touchdown-heavy Baltimore offense is the enemy of his fantasy ceiling."'
        ]
    }
};

// ─── Auto-Generation ──────────────────────────────────────────────────────────

/**
 * Derives sentiment trend from a player's performance differential and injury status.
 * Used by generateIntelForPlayer and also available for the modal's sentiment gauge.
 */
export function deriveSentimentTrend(player: Player): 'BULLISH' | 'BEARISH' | 'NEUTRAL' {
    if (player.injuryStatus === 'IR' || player.injuryStatus === 'O') return 'BEARISH';
    if (player.injuryStatus === 'D') return 'BEARISH';
    const diff = player.performance_differential ?? 0;
    if (diff >= 15) return 'BULLISH';
    if (diff >= 5)  return 'BULLISH';
    if (diff <= -15) return 'BEARISH';
    if (diff <= -5)  return 'BEARISH';
    return 'NEUTRAL';
}

/**
 * Generates contextual scouting intel for any player using their live data fields.
 * Covers injury status, depth chart position, performance differential, and ADP.
 * Always returns a valid ScoutIntel — never null.
 */
export function generateIntelForPlayer(player: Player): ScoutIntel {
    const sentiment = deriveSentimentTrend(player);
    const diff = player.performance_differential ?? 0;
    const isStarter = player.depthChartOrder === 1;
    const isBackup  = (player.depthChartOrder ?? 0) > 1;

    // Build context blocks that stack together naturally
    const parts: string[] = [];

    // Injury context
    if (player.injuryStatus) {
        const bodyPart = player.injuryBodyPart ? ` (${player.injuryBodyPart})` : '';
        parts.push(`Currently listed ${player.injuryStatus}${bodyPart} — a significant concern for fantasy managers this week.`);
    }

    // Depth chart context
    if (isStarter) {
        parts.push(`Locked in as the clear starter, which provides a reliable weekly floor.`);
    } else if (isBackup) {
        parts.push(`Currently listed as a depth piece — upside is capped unless there is an injury ahead of him on the depth chart.`);
    }

    // Performance differential context
    if (diff >= 15) {
        parts.push(`Significantly outperforming projections this season (+${diff.toFixed(1)} pts differential). The tape backs it up — this is a real improvement, not a fluke.`);
    } else if (diff >= 5) {
        parts.push(`Modestly outpacing preseason projections (+${diff.toFixed(1)} pts). Trending in the right direction.`);
    } else if (diff <= -15) {
        parts.push(`Falling well short of expectations this season (${diff.toFixed(1)} pts differential). The usage and efficiency numbers both point to structural issues.`);
    } else if (diff <= -5) {
        parts.push(`Underperforming projections (${diff.toFixed(1)} pts). Bears watching for a breakout correction or continued decline.`);
    }

    // ADP context
    if (player.adp) {
        if (player.adp <= 30) {
            parts.push(`A top-30 ADP asset — fantasy managers are paying for the upside.`);
        } else if (player.adp >= 150) {
            parts.push(`Low ADP (${player.adp.toFixed(0)}) creates a high reward-to-risk ratio for those willing to take a flier.`);
        }
    }

    // Default fallback if no data produced content
    if (parts.length === 0) {
        parts.push(`${player.lastName} is a player to watch. Early-season data is limited but the physical tools warrant attention.`);
    }

    // Build sentiment tags from available data
    const tags: string[] = [];
    if (player.injuryStatus) tags.push(`"Health status is the week-to-week variable to track."`);
    if (isStarter)           tags.push(`"Starter-level usage floor."`);
    if (diff >= 10)          tags.push(`"Outperforming projections — trending up."`);
    if (diff <= -10)         tags.push(`"Underperforming expectations — patience required."`);
    if (!tags.length)        tags.push(`"Profiles as a solid depth add at current ADP."`, `"Upside tied to usage share."`);

    return {
        playerLastName: player.lastName,
        sentimentTrend: sentiment,
        socialIntelligence: parts.join(' '),
        trendingNews: player.injuryStatus
            ? `Injury report: ${player.injuryStatus}${player.injuryBodyPart ? ` — ${player.injuryBodyPart}` : ''}. Practice participation is the key update to monitor.`
            : undefined,
        scoutSentiment: tags,
        reporterFeed: []
    };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Returns curated scouting intel by last name, or null if not in the store.
 * Callers should fall back to generateIntelForPlayer(player) on null.
 */
export const getIntelForPlayer = (lastName: string): ScoutIntel | null =>
    IntelligenceStore[lastName] ?? null;
