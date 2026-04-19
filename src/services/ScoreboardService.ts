/**
 * ScoreboardService — NFL Intelligence Panel Data Layer
 * ======================================================
 * Polls ESPN's free public APIs for live game scores, team records,
 * and per-team schedule snapshots. All data is cached with TTLs so the
 * UI never hammers the API on rapid re-renders.
 *
 * Data sources (all free, no API key required):
 *   Standings : site.api.espn.com/apis/site/v2/sports/football/nfl/standings
 *   Scoreboard: site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard
 *   Schedule  : site.api.espn.com/apis/site/v2/sports/football/nfl/teams/{id}/schedule
 *
 * Subscriber pattern mirrors DiscoveryService — call subscribe() to get
 * notified whenever standings or live scores refresh.
 */

// ─── Static conference / division roster ─────────────────────────────────────
// Pre-defined so the columns render immediately before the ESPN standings
// response arrives, and so conference membership is always authoritative.

export const AFC_DIVISIONS: Record<string, string[]> = {
    'AFC East':  ['BUF', 'MIA', 'NE',  'NYJ'],
    'AFC North': ['BAL', 'CIN', 'CLE', 'PIT'],
    'AFC South': ['HOU', 'IND', 'JAX', 'TEN'],
    'AFC West':  ['DEN', 'KC',  'LV',  'LAC'],
};

export const NFC_DIVISIONS: Record<string, string[]> = {
    'NFC East':  ['DAL', 'NYG', 'PHI', 'WAS'],
    'NFC North': ['CHI', 'DET', 'GB',  'MIN'],
    'NFC South': ['ATL', 'CAR', 'NO',  'TB'],
    'NFC West':  ['ARI', 'LAR', 'SF',  'SEA'],
};

// Full team name lookup used in the snapshot panel
const TEAM_NAMES: Record<string, string> = {
    ARI:'Arizona Cardinals',  ATL:'Atlanta Falcons',    BAL:'Baltimore Ravens',
    BUF:'Buffalo Bills',      CAR:'Carolina Panthers',  CHI:'Chicago Bears',
    CIN:'Cincinnati Bengals', CLE:'Cleveland Browns',   DAL:'Dallas Cowboys',
    DEN:'Denver Broncos',     DET:'Detroit Lions',      GB:'Green Bay Packers',
    HOU:'Houston Texans',     IND:'Indianapolis Colts', JAX:'Jacksonville Jaguars',
    KC:'Kansas City Chiefs',  LAC:'LA Chargers',        LAR:'LA Rams',
    LV:'Las Vegas Raiders',   MIA:'Miami Dolphins',     MIN:'Minnesota Vikings',
    NE:'New England Patriots',NO:'New Orleans Saints',  NYG:'NY Giants',
    NYJ:'NY Jets',            PHI:'Philadelphia Eagles',PIT:'Pittsburgh Steelers',
    SF:'San Francisco 49ers', SEA:'Seattle Seahawks',   TB:'Tampa Bay Buccaneers',
    TEN:'Tennessee Titans',   WAS:'Washington Commanders',
};

// ─── Public types ─────────────────────────────────────────────────────────────

export interface TeamRecord {
    abbr: string;
    name: string;
    wins: number;
    losses: number;
    ties: number;
    espnId: string; // numeric ESPN team ID — needed for schedule fetch
}

export interface LiveGame {
    id: string;
    homeTeam: string;   // abbreviation
    awayTeam: string;
    homeScore: number;
    awayScore: number;
    status: 'pre' | 'in' | 'post';
    statusDetail: string; // "Q3 7:42", "Final", "7:00 PM ET Sun"
}

export interface TeamSnapshot {
    abbr: string;
    fullName: string;
    record: string; // "8-4" or "8-4-1"
    lastGame: {
        opponentAbbr: string;
        result: 'W' | 'L' | 'T';
        teamScore: number;
        oppScore: number;
        dateLabel: string; // "Nov 24"
    } | null;
    nextGame: {
        opponentAbbr: string;
        isHome: boolean;
        dateLabel: string;  // "Sun Dec 15"
        timeLabel: string;  // "1:00 PM ET"
    } | null;
}

// ─── Cache ────────────────────────────────────────────────────────────────────

const RECORDS_TTL  = 60 * 60 * 1000;  // 1 hour — standings don't change often
const GAMES_TTL    = 60 * 1000;        // 60 s   — live scores need to be fresh
const SNAPSHOT_TTL = 30 * 60 * 1000;  // 30 min — schedule is stable within a day

let recordsCache: Record<string, TeamRecord> = {};
let recordsLastFetch = 0;

let gamesCache: LiveGame[] = [];
let gamesLastFetch = 0;

const snapshotCache: Record<string, { data: TeamSnapshot; ts: number }> = {};

// ─── Subscribers ──────────────────────────────────────────────────────────────

type Listener = () => void;
const listeners = new Set<Listener>();

function notify() {
    listeners.forEach(fn => fn());
}

// ─── Internal fetch helpers ───────────────────────────────────────────────────

async function fetchStandings(): Promise<void> {
    if (Date.now() - recordsLastFetch < RECORDS_TTL) return;
    try {
        const res = await fetch(
            'https://site.api.espn.com/apis/site/v2/sports/football/nfl/standings?season=2024'
        );
        if (!res.ok) return;
        const data = await res.json();

        // ESPN standings are nested: root → children (conferences) → children (divisions) → entries
        const conferenceGroups: any[] = data?.children ?? [];
        for (const conf of conferenceGroups) {
            const divGroups: any[] = conf?.children ?? [];
            for (const div of divGroups) {
                const entries: any[] = div?.standings?.entries ?? [];
                for (const entry of entries) {
                    const abbr: string = entry?.team?.abbreviation?.toUpperCase() ?? '';
                    if (!abbr) continue;
                    const stats: any[] = entry?.stats ?? [];
                    const get = (name: string) =>
                        stats.find((s: any) => s.name === name)?.value ?? 0;
                    recordsCache[abbr] = {
                        abbr,
                        name: entry?.team?.displayName ?? TEAM_NAMES[abbr] ?? abbr,
                        wins:   Math.round(get('wins')),
                        losses: Math.round(get('losses')),
                        ties:   Math.round(get('ties')),
                        espnId: String(entry?.team?.id ?? ''),
                    };
                }
            }
        }
        recordsLastFetch = Date.now();
        notify();
    } catch (e) {
        console.warn('[ScoreboardService] Failed to fetch standings:', e);
    }
}

async function fetchScoreboard(): Promise<void> {
    if (Date.now() - gamesLastFetch < GAMES_TTL) return;
    try {
        const res = await fetch(
            'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard'
        );
        if (!res.ok) return;
        const data = await res.json();

        gamesCache = [];
        for (const event of (data?.events ?? [])) {
            const comp = event?.competitions?.[0];
            if (!comp) continue;
            const state: string = comp?.status?.type?.state ?? 'pre';
            const period: number = comp?.status?.period ?? 0;
            const clock: number = comp?.status?.clock ?? 0;
            const detail: string = comp?.status?.type?.shortDetail ?? '';

            // Build compact status string
            let statusDetail = detail;
            if (state === 'in') {
                const mm = String(Math.floor(clock / 60)).padStart(2, '0');
                const ss = String(clock % 60).padStart(2, '0');
                statusDetail = detail.toLowerCase().includes('half')
                    ? 'Halftime'
                    : period > 4 ? `OT ${mm}:${ss}` : `Q${period} ${mm}:${ss}`;
            }

            const competitors: any[] = comp?.competitors ?? [];
            const home = competitors.find((c: any) => c.homeAway === 'home');
            const away = competitors.find((c: any) => c.homeAway === 'away');
            if (!home || !away) continue;

            gamesCache.push({
                id: event.id,
                homeTeam: home?.team?.abbreviation?.toUpperCase() ?? '',
                awayTeam: away?.team?.abbreviation?.toUpperCase() ?? '',
                homeScore: Number(home?.score ?? 0),
                awayScore: Number(away?.score ?? 0),
                status: state as 'pre' | 'in' | 'post',
                statusDetail,
            });
        }
        gamesLastFetch = Date.now();
        notify();
    } catch (e) {
        console.warn('[ScoreboardService] Failed to fetch scoreboard:', e);
    }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export const ScoreboardService = {

    /** Subscribe to data changes. Returns an unsubscribe function. */
    subscribe(fn: Listener): () => void {
        listeners.add(fn);
        return () => listeners.delete(fn);
    },

    /** Refresh standings + scoreboard and notify subscribers. */
    async refresh(): Promise<void> {
        await Promise.all([fetchStandings(), fetchScoreboard()]);
    },

    /** Returns the cached record for a team, falling back to 0-0. */
    getRecord(abbr: string): TeamRecord {
        return recordsCache[abbr] ?? {
            abbr,
            name: TEAM_NAMES[abbr] ?? abbr,
            wins: 0, losses: 0, ties: 0, espnId: '',
        };
    },

    /** Returns all cached live games. */
    getLiveGames(): LiveGame[] {
        return gamesCache;
    },

    /** Returns the live game involving this team, if any. */
    getLiveGame(abbr: string): LiveGame | null {
        return gamesCache.find(
            g => g.homeTeam === abbr || g.awayTeam === abbr
        ) ?? null;
    },

    /**
     * Fetches a per-team snapshot (last game + next game).
     * Cached for 30 minutes per team. Requires the ESPN team ID from getRecord().
     */
    async getTeamSnapshot(abbr: string): Promise<TeamSnapshot> {
        const cached = snapshotCache[abbr];
        if (cached && Date.now() - cached.ts < SNAPSHOT_TTL) return cached.data;

        const record = this.getRecord(abbr);
        const fullName = record.name || TEAM_NAMES[abbr] || abbr;
        const recStr = record.ties > 0
            ? `${record.wins}-${record.losses}-${record.ties}`
            : `${record.wins}-${record.losses}`;

        // Base snapshot — populated below if the schedule fetch succeeds
        const snap: TeamSnapshot = {
            abbr, fullName,
            record: recStr,
            lastGame: null,
            nextGame: null,
        };

        // Skip the network fetch if we don't have an ESPN ID yet
        if (!record.espnId) {
            snapshotCache[abbr] = { data: snap, ts: Date.now() };
            return snap;
        }

        try {
            const res = await fetch(
                `https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/${record.espnId}/schedule`
            );
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();

            const events: any[] = data?.events ?? [];
            const now = Date.now();

            // Identify the last completed game and the next upcoming game
            let lastEvent: any = null;
            let nextEvent: any = null;

            for (const ev of events) {
                const evTime = new Date(ev?.date ?? 0).getTime();
                const state: string = ev?.competitions?.[0]?.status?.type?.state ?? 'pre';
                if (state === 'post' && evTime < now) {
                    lastEvent = ev; // keeps updating to the most recent completed
                } else if ((state === 'pre' || state === 'in') && !nextEvent) {
                    nextEvent = ev;
                }
            }

            if (lastEvent) {
                const comp = lastEvent.competitions?.[0];
                const myComp = comp?.competitors?.find(
                    (c: any) => c?.team?.abbreviation?.toUpperCase() === abbr
                );
                const oppComp = comp?.competitors?.find(
                    (c: any) => c?.team?.abbreviation?.toUpperCase() !== abbr
                );
                if (myComp && oppComp) {
                    const myScore  = Number(myComp.score ?? 0);
                    const oppScore = Number(oppComp.score ?? 0);
                    snap.lastGame = {
                        opponentAbbr: oppComp.team?.abbreviation?.toUpperCase() ?? '?',
                        result: myScore > oppScore ? 'W' : myScore < oppScore ? 'L' : 'T',
                        teamScore: myScore,
                        oppScore,
                        dateLabel: new Date(lastEvent.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                    };
                }
            }

            if (nextEvent) {
                const comp = nextEvent.competitions?.[0];
                const myComp  = comp?.competitors?.find(
                    (c: any) => c?.team?.abbreviation?.toUpperCase() === abbr
                );
                const oppComp = comp?.competitors?.find(
                    (c: any) => c?.team?.abbreviation?.toUpperCase() !== abbr
                );
                const gameDate = new Date(nextEvent.date);
                snap.nextGame = {
                    opponentAbbr: oppComp?.team?.abbreviation?.toUpperCase() ?? '?',
                    isHome: myComp?.homeAway === 'home',
                    dateLabel: gameDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
                    timeLabel: gameDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }),
                };
            }
        } catch (e) {
            console.warn(`[ScoreboardService] Schedule fetch failed for ${abbr}:`, e);
        }

        snapshotCache[abbr] = { data: snap, ts: Date.now() };
        return snap;
    },

    /** Full team name for display. */
    getFullName(abbr: string): string {
        return TEAM_NAMES[abbr] ?? abbr;
    },
};
