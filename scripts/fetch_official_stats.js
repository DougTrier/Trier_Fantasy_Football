/**
 * fetch_official_stats.js
 * ════════════════════════════════════════════════════════════════════════════
 * Tier 3 NFL Stats Pipeline — Automated Season-Aware Orchestrator
 *
 * Usage:
 *   node scripts/fetch_official_stats.js               # auto-detect season
 *   node scripts/fetch_official_stats.js --season=2026 # explicit override
 *   node scripts/fetch_official_stats.js --dry-run     # fetch but don't write
 *
 * Output:
 *   src/data/live_stats_current.json   ← always the active season
 *   src/data/archive/live_stats_YYYY.json ← historical archive (on rollover)
 *
 * Season detection rules:
 *   - Jan 1 – Aug 31: previous calendar year (e.g. 2026-01 → 2025 season)
 *   - Sep 1 – Dec 31: current calendar year (e.g. 2026-09 → 2026 season)
 *
 * Season state rules (applied automatically):
 *   - Before Sep 1 of season year:          FUTURE
 *   - Sep 1 – ~Feb 15 of following year:    ACTIVE_UNOFFICIAL
 *   - After ~Feb 15 of following year:      COMPLETED_OFFICIAL
 *
 * © 2026 Doug Trier · Trier Fantasy Football
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── Paths ───────────────────────────────────────────────────────────────────

const DATA_DIR     = path.join(__dirname, '../src/data');
const ARCHIVE_DIR  = path.join(DATA_DIR, 'archive');
const OUTPUT_PATH  = path.join(DATA_DIR, 'live_stats_current.json');

// ─── CLI Args ─────────────────────────────────────────────────────────────────

const args = Object.fromEntries(
    process.argv.slice(2)
        .filter(a => a.startsWith('--'))
        .map(a => {
            const [k, v] = a.slice(2).split('=');
            return [k, v ?? true];
        })
);

const DRY_RUN = args['dry-run'] === true;

// ─── Season Detection ─────────────────────────────────────────────────────────

/**
 * Determines the NFL season year to query.
 * NFL season year = the calendar year in which Week 1 kicks off (September).
 *
 * Timeline example for the 2026 season:
 *   Sep 2026 – Jan 2027:  Regular season + Wild Card
 *   Jan–Feb 2027:         Playoffs + Super Bowl (~Feb 9)
 *   Mar 2027+:            Off-season, 2027 season upcoming
 */
function detectNFLSeason() {
    if (args.season) {
        const explicit = parseInt(args.season, 10);
        if (!isNaN(explicit) && explicit >= 2020 && explicit <= 2040) {
            return explicit;
        }
        console.warn(`⚠️  Invalid --season value "${args.season}", falling back to auto-detect.`);
    }

    const now = new Date();
    const month = now.getMonth(); // 0-indexed
    const year  = now.getFullYear();

    // Jan–Aug: we're in the off-season; the season that just finished was year-1
    // Sep–Dec: we're in or about to enter the current year's season
    return month >= 8 ? year : year - 1;
}

/**
 * Determines the season_state based on the current date relative to a given season year.
 *
 * NFL Season Calendar (example: 2026 season):
 *   Feb 16, 2026 – Jul 31, 2026  →  FUTURE            (off-season)
 *   Aug 1,  2026 – Sep 4,  2026  →  PRESEASON         (Hall of Fame + 3 preseason weeks)
 *   Sep 5,  2026 – Feb 15, 2027  →  ACTIVE_UNOFFICIAL (regular season + playoffs)
 *   Feb 16, 2027+                →  COMPLETED_OFFICIAL (Super Bowl done, stats frozen)
 *
 * @param {number} season - NFL season year (e.g. 2026)
 * @returns {{ state: string, finality: string }}
 */
function detectSeasonState(season) {
    const now = new Date();

    // Preseason: Hall of Fame game is always first weekend of August.
    // Regular season: always starts the first Thursday after Labor Day (~Sep 4-8).
    const preseasonStart  = new Date(season,     7,  1);  // Aug 1  of season year
    const regularStart    = new Date(season,     8,  5);  // Sep 5  of season year (conservative)
    const superBowlDate   = new Date(season + 1, 1, 15);  // Feb 15 of following year

    if (now < preseasonStart) {
        return { state: 'FUTURE', finality: 'NONE' };
    }
    if (now < regularStart) {
        return { state: 'PRESEASON', finality: 'PROVISIONAL' };
    }
    if (now < superBowlDate) {
        return { state: 'ACTIVE_UNOFFICIAL', finality: 'PROVISIONAL' };
    }
    return { state: 'COMPLETED_OFFICIAL', finality: 'FINAL' };
}

// ─── Sleeper API ──────────────────────────────────────────────────────────────

const SLEEPER_BASE = 'https://api.sleeper.app/v1';

/**
 * Fetches official season stats from the Sleeper API.
 * Returns null on failure; the caller decides how to handle errors.
 *
 * @param {number} season
 * @param {string} seasonType - 'regular' | 'post'
 */
async function fetchSleeperStats(season, seasonType = 'regular') {
    const url = `${SLEEPER_BASE}/stats/nfl/${seasonType}/${season}`;
    console.log(`📡 [SLEEPER] Fetching ${seasonType} season stats: ${url}`);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);

    try {
        const response = await fetch(url, {
            signal: controller.signal,
            headers: { 'Accept': 'application/json' }
        });
        clearTimeout(timeout);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        const count = Object.keys(data || {}).length;

        if (count === 0) {
            console.warn(`⚠️  [SLEEPER] API returned empty dataset for ${season} ${seasonType}.`);
            return null;
        }

        console.log(`✅ [SLEEPER] Received ${count.toLocaleString()} player records.`);
        return data;

    } catch (err) {
        clearTimeout(timeout);
        if (err.name === 'AbortError') {
            throw new Error('Request timed out after 30 seconds');
        }
        throw err;
    }
}

/**
 * Merges regular-season and playoff stats for COMPLETED_OFFICIAL seasons.
 * Playoff stats are additive on top of regular season totals.
 *
 * @param {Record<string, any>} regular
 * @param {Record<string, any>} playoff - may be null
 */
function mergeSeasonStats(regular, playoff) {
    if (!playoff) return regular;

    const merged = { ...regular };
    for (const [playerId, pStats] of Object.entries(playoff)) {
        if (!merged[playerId]) {
            merged[playerId] = { ...pStats };
        } else {
            const r = merged[playerId];
            for (const [field, val] of Object.entries(pStats)) {
                if (typeof val === 'number' && typeof r[field] === 'number') {
                    merged[playerId][field] = r[field] + val;
                } else {
                    merged[playerId][field] = merged[playerId][field] ?? val;
                }
            }
        }
    }

    const addedPlayers = Object.keys(playoff).filter(id => !regular[id]).length;
    console.log(`🔀 [MERGE] Combined regular + playoff. ${addedPlayers} playoff-only players added.`);
    return merged;
}

// ─── Archive ──────────────────────────────────────────────────────────────────

/**
 * Archives the current live_stats_current.json to archive/live_stats_YYYY.json
 * before overwriting it. Safe to call if no current file exists.
 */
function archivePreviousSeason() {
    if (!fs.existsSync(OUTPUT_PATH)) return;

    try {
        const existing = JSON.parse(fs.readFileSync(OUTPUT_PATH, 'utf8'));
        const prevSeason = existing.season;
        if (!prevSeason) return;

        if (!fs.existsSync(ARCHIVE_DIR)) {
            fs.mkdirSync(ARCHIVE_DIR, { recursive: true });
        }

        const archivePath = path.join(ARCHIVE_DIR, `live_stats_${prevSeason}.json`);
        if (!fs.existsSync(archivePath)) {
            fs.copyFileSync(OUTPUT_PATH, archivePath);
            console.log(`📦 [ARCHIVE] Saved season ${prevSeason} → ${path.relative(process.cwd(), archivePath)}`);
        } else {
            console.log(`📦 [ARCHIVE] Season ${prevSeason} already archived — skipping.`);
        }
    } catch {
        // Non-fatal: current file may be malformed
    }
}

// ─── Change Detection ─────────────────────────────────────────────────────────

/**
 * Returns true if the new data differs meaningfully from the existing file.
 * Used to avoid unnecessary git commits when stats haven't changed.
 */
function hasChanged(newData) {
    if (!fs.existsSync(OUTPUT_PATH)) return true;

    try {
        const existing = JSON.parse(fs.readFileSync(OUTPUT_PATH, 'utf8'));
        // Compare key fields
        if (existing.season !== newData.season) return true;
        if (existing.season_state !== newData.season_state) return true;
        if (existing.data_status !== newData.data_status) return true;

        // Compare stat counts
        const existingCount = Object.keys(existing.stats || {}).length;
        const newCount      = Object.keys(newData.stats || {}).length;
        if (Math.abs(existingCount - newCount) > 5) return true;

        // Sample 10 random players to check for stat changes
        const playerIds = Object.keys(newData.stats || {}).slice(0, 10);
        for (const id of playerIds) {
            const oldPts = existing.stats?.[id]?.pts_ppr;
            const newPts = newData.stats?.[id]?.pts_ppr;
            if (oldPts !== newPts) return true;
        }

        return false;
    } catch {
        return true;
    }
}

// ─── Main Orchestrator ────────────────────────────────────────────────────────

async function orchestrate() {
    console.log('');
    console.log('🏈 TRIER FANTASY FOOTBALL — NFL Stats Pipeline v3');
    console.log('════════════════════════════════════════════════════');

    const SEASON = detectNFLSeason();
    const { state: season_state, finality } = detectSeasonState(SEASON);

    console.log(`📅 Season:       ${SEASON}`);
    console.log(`📊 Season State: ${season_state}`);
    console.log(`🔒 Finality:     ${finality}`);
    if (DRY_RUN) console.log(`🧪 Dry Run:      YES — no files will be written`);
    console.log('');

    let payload = {
        season:       SEASON,
        season_state: season_state,
        finality:     finality,
        last_updated: new Date().toISOString(),
        data_status:  'NO_DATA_AVAILABLE',
        stats:        null,
    };

    // ── FUTURE: Off-season, no games ─────────────────────────────────────────
    if (season_state === 'FUTURE') {
        console.log('⏳ [FUTURE] Off-season — no game data available yet.');
        payload.data_status = 'NO_DATA_AVAILABLE';
        payload.reason      = `${SEASON} NFL preseason begins in August ${SEASON}. Regular season starts September ${SEASON}.`;

    // ── PRESEASON: Hall of Fame + 3 preseason weeks ───────────────────────────
    } else if (season_state === 'PRESEASON') {
        try {
            console.log('🏈 [PRESEASON] Fetching preseason game stats...');
            const preStats = await fetchSleeperStats(SEASON, 'pre');
            if (preStats) {
                payload.stats       = preStats;
                payload.data_status = 'VALIDATED';
                payload.stats_scope = 'PRESEASON_ONLY';
                payload.finality    = 'PROVISIONAL';
                payload.reason      = `Preseason stats — do not count toward fantasy scoring. Regular season begins September ${SEASON}.`;
            } else {
                payload.reason = 'Preseason has not yet produced stats. Check back after the Hall of Fame game in early August.';
            }
        } catch (err) {
            console.error(`❌ [PRESEASON] Fetch error: ${err.message}`);
            payload.data_status = 'ERROR';
            payload.reason      = err.message;
        }

    // ── ACTIVE: Fetch weekly regular season stats ──────────────────────────────
    } else if (season_state === 'ACTIVE_UNOFFICIAL') {
        try {
            const regularStats = await fetchSleeperStats(SEASON, 'regular');
            if (regularStats) {
                payload.stats        = regularStats;
                payload.data_status  = 'VALIDATED';
                payload.stats_scope  = 'COMPLETED_GAMES_ONLY';
                payload.finality     = 'PROVISIONAL';
            } else {
                payload.reason = 'Sleeper API returned no data — season may not have started yet.';
            }
        } catch (err) {
            console.error(`❌ [ACTIVE] Fetch error: ${err.message}`);
            payload.data_status = 'ERROR';
            payload.reason      = err.message;
        }

    // ── COMPLETED: Fetch regular + playoff ───────────────────────────────────
    } else {
        try {
            const [regularStats, playoffStats] = await Promise.allSettled([
                fetchSleeperStats(SEASON, 'regular'),
                fetchSleeperStats(SEASON, 'post'),
            ]);

            const regular = regularStats.status === 'fulfilled' ? regularStats.value : null;
            const playoff = playoffStats.status === 'fulfilled' ? playoffStats.value : null;

            if (!regular) {
                payload.data_status = 'ERROR';
                payload.reason      = 'Could not fetch regular season stats from Sleeper API.';
            } else {
                const merged = mergeSeasonStats(regular, playoff);
                payload.stats       = merged;
                payload.data_status = 'VALIDATED';
                payload.stats_scope = 'FULL_SEASON_INCLUDING_PLAYOFFS';
            }
        } catch (err) {
            console.error(`❌ [COMPLETED] Fetch error: ${err.message}`);
            payload.data_status = 'ERROR';
            payload.reason      = err.message;
        }
    }

    // ── Write output ──────────────────────────────────────────────────────────
    if (DRY_RUN) {
        console.log('');
        console.log('🧪 [DRY RUN] Would write:');
        const preview = { ...payload, stats: payload.stats ? `{…${Object.keys(payload.stats).length} players}` : null };
        console.log(JSON.stringify(preview, null, 2));
        return;
    }

    if (!hasChanged(payload)) {
        console.log('');
        console.log('✅ [SKIP] Stats unchanged — no write needed. Nothing to commit.');
        process.exit(0);
    }

    // Archive previous season if the season year changed
    if (fs.existsSync(OUTPUT_PATH)) {
        try {
            const existing = JSON.parse(fs.readFileSync(OUTPUT_PATH, 'utf8'));
            if (existing.season !== SEASON) {
                console.log(`🔄 [ROLLOVER] Detected season change: ${existing.season} → ${SEASON}`);
                archivePreviousSeason();
            }
        } catch {}
    }

    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(payload, null, 2));

    const playerCount = payload.stats ? Object.keys(payload.stats).length : 0;
    console.log('');
    console.log(`💾 [OUTPUT] Written to: ${path.relative(process.cwd(), OUTPUT_PATH)}`);
    console.log(`📈 [STATS]  Season: ${SEASON} | State: ${season_state} | Players: ${playerCount.toLocaleString()} | Status: ${payload.data_status}`);
    console.log('');
    console.log('✅ Pipeline complete.');
}

orchestrate().catch(err => {
    console.error(`\n💀 [FATAL] Unhandled error: ${err.message}`);
    process.exit(1);
});
