/**
 * refresh_player_pool.js
 * ════════════════════════════════════════════════════════════════════════════
 * NFL Player Pool Refresh — Full Lifecycle Tracking
 *
 * Handles four distinct data events in the NFL calendar:
 *
 *   1. POST-DRAFT    (~May 1)    — Rookies + UDFA signings finalized
 *   2. TRAINING CAMP (~Jul 25)  — Depth charts, camp injuries, position battles
 *   3. FINAL CUTS    (~Aug 27)  — 53-man rosters locked, PS designations
 *   4. IN-SEASON     (M/W/F)    — Trades, injuries (Q/D/IR/PUP), waiver wire
 *
 * Usage:
 *   node scripts/refresh_player_pool.js              # standard update
 *   node scripts/refresh_player_pool.js --dry-run    # preview only
 *   node scripts/refresh_player_pool.js --diff-only  # show changes, no write
 *   node scripts/refresh_player_pool.js --full       # force full re-pull
 *   node scripts/refresh_player_pool.js --mode=draft # label pull as post-draft
 *
 * © 2026 Doug Trier · Trier Fantasy Football
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const DATA_DIR  = path.join(__dirname, '../src/data');
const POOL_PATH = path.join(DATA_DIR, 'all_players_pool.json');
const LOG_PATH  = path.join(DATA_DIR, 'player_pool_changelog.json');

// ─── CLI Args ─────────────────────────────────────────────────────────────────

const args = Object.fromEntries(
    process.argv.slice(2)
        .filter(a => a.startsWith('--'))
        .map(a => {
            const [k, v] = a.slice(2).split('=');
            return [k, v ?? true];
        })
);

const DRY_RUN   = args['dry-run'] === true;
const DIFF_ONLY = args['diff-only'] === true;
const FULL      = args['full'] === true;
const MODE      = args['mode'] || detectPullMode();

// ─── Pull Mode Detection ──────────────────────────────────────────────────────

/**
 * Determines what kind of pull this is based on the current date.
 * This affects logging and what fields are considered "significant" changes.
 */
function detectPullMode() {
    const now   = new Date();
    const month = now.getMonth(); // 0-indexed
    const day   = now.getDate();

    // Post-Draft: late April / early May
    if ((month === 3 && day >= 24) || (month === 4 && day <= 10)) return 'post-draft';

    // Training Camp: late July
    if (month === 6 && day >= 20) return 'training-camp';

    // Final Roster Cuts: late August
    if (month === 7 && day >= 25) return 'final-cuts';

    // Preseason: early August
    if (month === 7 && day < 25) return 'preseason';

    // Regular season
    if (month >= 8 || month === 0 || month === 1) return 'in-season';

    // Off-season
    return 'offseason';
}

const MODE_LABELS = {
    'post-draft':    '🏈 POST-DRAFT PULL — Rookies & UDFA signings',
    'training-camp': '⛺ TRAINING CAMP PULL — Depth charts & camp battles',
    'final-cuts':    '✂️  FINAL ROSTER CUTS — 53-man rosters locked',
    'preseason':     '🎯 PRESEASON PULL — Preseason roster update',
    'in-season':     '📊 IN-SEASON UPDATE — Trades, injuries & waiver wire',
    'offseason':     '❄️  OFF-SEASON UPDATE — Roster maintenance',
};

// ─── Sleeper API ──────────────────────────────────────────────────────────────

const SLEEPER_BASE = 'https://api.sleeper.app/v1';

async function fetchWithTimeout(url, timeoutMs = 60_000) {
    const controller = new AbortController();
    const timer      = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const res = await fetch(url, {
            signal:  controller.signal,
            headers: { 'Accept': 'application/json' }
        });
        clearTimeout(timer);
        if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
        return await res.json();
    } catch (err) {
        clearTimeout(timer);
        if (err.name === 'AbortError') throw new Error(`Timed out after ${timeoutMs / 1000}s`);
        throw err;
    }
}

/** Sleeper master player registry — all NFL players (~5-10MB) */
async function fetchSleeperPlayers() {
    console.log(`📡 [SLEEPER] Fetching master player registry...`);
    console.log('   (~5-10MB · 10-20 seconds)');
    const data  = await fetchWithTimeout(`${SLEEPER_BASE}/players/nfl`, 90_000);
    const count = Object.keys(data || {}).length;
    console.log(`✅ [SLEEPER] ${count.toLocaleString()} player records received.`);
    return data;
}

/** Sleeper trending players — recently picked up on waivers (in-season signal) */
async function fetchTrendingPlayers() {
    try {
        const adds = await fetchWithTimeout(`${SLEEPER_BASE}/players/nfl/trending/add?limit=50`);
        const drops = await fetchWithTimeout(`${SLEEPER_BASE}/players/nfl/trending/drop?limit=50`);
        return { adds: adds || [], drops: drops || [] };
    } catch {
        return { adds: [], drops: [] };
    }
}

// ─── Normalization ────────────────────────────────────────────────────────────

/** All NFL team abbreviations (32 teams) */
const NFL_TEAMS = new Set([
    'ARI','ATL','BAL','BUF','CAR','CHI','CIN','CLE',
    'DAL','DEN','DET','GB', 'HOU','IND','JAX','KC',
    'LAC','LAR','LV', 'MIA','MIN','NE', 'NO', 'NYG',
    'NYJ','PHI','PIT','SEA','SF', 'TB', 'TEN','WAS',
]);

/** Fantasy-relevant positions */
const FANTASY_POSITIONS = new Set(['QB','RB','WR','TE','K','DEF','DST']);

/**
 * Maps Sleeper injury status codes to standardized labels.
 */
const INJURY_STATUS_MAP = {
    'Questionable':        'Q',
    'Doubtful':            'D',
    'Out':                 'O',
    'IR':                  'IR',
    'PUP':                 'PUP',     // Physically Unable to Perform
    'NFI':                 'NFI',     // Non-Football Injury
    'COV':                 'COV',     // COVID (legacy)
    'DNR':                 'DNR',     // Did Not Return (game-time)
    'Sus':                 'SUS',     // Suspended
    null:                  null,
    undefined:             null,
};

/**
 * Normalizes a Sleeper player record into the app's Player schema,
 * including all fields needed for in-season tracking.
 */
function normalizePlayer(id, raw, trendingData = {}) {
    const position = raw.fantasy_positions?.[0] || raw.position || 'UNKNOWN';
    const team     = (raw.team || '').toUpperCase();
    const injStat  = INJURY_STATUS_MAP[raw.injury_status] ?? null;

    return {
        // Identity
        id:               id,
        firstName:        raw.first_name    || '',
        lastName:         raw.last_name     || '',
        fullName:         `${raw.first_name || ''} ${raw.last_name || ''}`.trim(),

        // Position & Team
        position:         position,
        team:             team,
        number:           raw.number        || null,
        depthChartOrder:  raw.depth_chart_order ?? null,  // 1 = starter, 2 = backup, etc.
        depthChartPosition: raw.depth_chart_position || null,

        // Status
        status:           raw.status        || 'Inactive',
        practiceStatus:   raw.practice_status || null,   // Limited / Full / Did Not Participate
        isActive:         raw.active         === true,
        practiceSquad:    raw.practice_squad === true || raw.status === 'PracticeSquad',

        // Injury
        injuryStatus:     injStat,
        injuryBodyPart:   raw.injury_body_part   || null,
        injuryStartDate:  raw.injury_start_date  || null,
        injuryNotes:      raw.injury_notes        || null,

        // Identifiers (for cross-referencing stats)
        espnId:           raw.espn_id   ? String(raw.espn_id)  : null,
        yahooId:          raw.yahoo_id  ? String(raw.yahoo_id) : null,
        gsisId:           raw.gsis_id   || null,
        sleeperTeamId:    raw.team_abbr || team,

        // Career info
        yearsExp:         raw.years_exp  ?? null,
        college:          raw.college    || null,
        age:              raw.age        || null,
        birthdate:        raw.birth_date || null,
        height:           raw.height     || null,
        weight:           raw.weight     || null,

        // Photo — ESPN full headshots are higher quality when espnId is available;
        // onError handlers in the UI fall back to Sleeper CDN automatically.
        photoUrl: raw.espn_id
            ? `https://a.espncdn.com/i/headshots/nfl/players/full/${raw.espn_id}.png`
            : `https://sleepercdn.com/content/nfl/players/thumb/${id}.jpg`,

        // Fantasy signals
        fantasyPositions: raw.fantasy_positions || [position],
        searchRank:       raw.search_rank       || 9999,  // lower = more prominent
        adp:              raw.adp               || null,

        // Trending (in-season)
        trendingAdd:      trendingData.adds?.some(t => t.player_id === id) || false,
        trendingDrop:     trendingData.drops?.some(t => t.player_id === id) || false,
    };
}

/** Returns true if this player is fantasy-relevant and on an active roster */
function isRelevant(id, raw) {
    const position = raw.fantasy_positions?.[0] || raw.position || '';
    const team     = (raw.team || '').toUpperCase();

    if (!FANTASY_POSITIONS.has(position))    return false;
    if (!NFL_TEAMS.has(team))                return false;
    if (!raw.first_name || !raw.last_name)   return false;
    // Include practice squad players (they can be promoted)
    // Exclude truly inactive players with no team and no experience
    if (raw.status === 'Inactive' && !raw.years_exp && !raw.espn_id) return false;

    return true;
}

// ─── Change Detection ─────────────────────────────────────────────────────────

/** Fields that constitute a "significant" change worth surfacing in the changelog */
const SIGNIFICANT_FIELDS = ['team', 'status', 'injuryStatus', 'injuryBodyPart', 'practiceSquad', 'depthChartOrder'];

/**
 * Computes a structured diff between the existing pool and the incoming update.
 * Returns categorized change groups meaningful to fantasy managers.
 */
function computeDiff(existingPool, incomingMap) {
    const existingMap = new Map(existingPool.map(p => [String(p.id), p]));
    const incomingIds = new Set(Object.keys(incomingMap));

    const changes = {
        newPlayers:    [],   // Rookies, free agents, UDFA signings
        teamChanges:   [],   // Trades, free agent signings, cuts
        injuries:      [],   // New/changed injury designations
        returns:       [],   // Cleared from injury (IR → active)
        practiceSquad: [],   // PS designations and promotions
        depthShifts:   [],   // Depth chart order changes (starter → backup)
        removed:       [],   // Released, retired, foreign league
    };

    // Check new and changed players
    for (const [id, fresh] of Object.entries(incomingMap)) {
        const existing = existingMap.get(id);

        if (!existing) {
            changes.newPlayers.push({
                id,
                name: fresh.fullName,
                position: fresh.position,
                team: fresh.team,
                status: fresh.status,
                yearsExp: fresh.yearsExp,
                isRookie: (fresh.yearsExp ?? 99) === 0,
            });
            continue;
        }

        // Team change (trade or free agent signing)
        if (existing.team !== fresh.team && fresh.team) {
            changes.teamChanges.push({
                id,
                name: fresh.fullName,
                position: fresh.position,
                from: existing.team,
                to: fresh.team,
                status: fresh.status,
            });
        }

        // Injury changes
        // Normalize undefined → null so that missing-field existing records don't
        // generate spurious "new injury" events against fresh null values.
        const existingInjStatus   = existing.injuryStatus   ?? null;
        const existingInjBodyPart = existing.injuryBodyPart ?? null;
        const injChanged = existingInjStatus !== fresh.injuryStatus ||
                           existingInjBodyPart !== fresh.injuryBodyPart;
        if (injChanged) {
            if (!existingInjStatus && fresh.injuryStatus) {
                // New injury
                changes.injuries.push({
                    id,
                    name: fresh.fullName,
                    position: fresh.position,
                    team: fresh.team,
                    status: fresh.injuryStatus,
                    bodyPart: fresh.injuryBodyPart,
                    notes: fresh.injuryNotes,
                });
            } else if (existingInjStatus && !fresh.injuryStatus) {
                // Cleared from injury
                changes.returns.push({
                    id,
                    name: fresh.fullName,
                    position: fresh.position,
                    team: fresh.team,
                    wasStatus: existingInjStatus,
                });
            } else if (existingInjStatus !== fresh.injuryStatus) {
                // Injury status changed (Q→D, D→IR, etc.)
                changes.injuries.push({
                    id,
                    name: fresh.fullName,
                    position: fresh.position,
                    team: fresh.team,
                    status: fresh.injuryStatus,
                    previousStatus: existing.injuryStatus,
                    bodyPart: fresh.injuryBodyPart,
                    notes: fresh.injuryNotes,
                });
            }
        }

        // Practice squad changes
        // Normalize undefined → false so that missing-field existing records don't
        // generate spurious PS events against fresh false values.
        const existingPS = existing.practiceSquad ?? false;
        if (existingPS !== fresh.practiceSquad) {
            changes.practiceSquad.push({
                id,
                name: fresh.fullName,
                position: fresh.position,
                team: fresh.team,
                action: fresh.practiceSquad ? 'placed on PS' : 'promoted from PS',
            });
        }

        // Depth chart shifts (starter becoming backup or vice versa)
        const oldDepth = existing.depthChartOrder;
        const newDepth = fresh.depthChartOrder;
        if (oldDepth !== newDepth && oldDepth !== null && newDepth !== null) {
            const isSignificant = (oldDepth === 1 && newDepth > 1) || (oldDepth > 1 && newDepth === 1);
            if (isSignificant) {
                changes.depthShifts.push({
                    id,
                    name: fresh.fullName,
                    position: fresh.position,
                    team: fresh.team,
                    from: oldDepth,
                    to: newDepth,
                    action: newDepth === 1 ? 'became starter' : 'moved to backup',
                });
            }
        }
    }

    // Check for removed players (released / retired)
    for (const [id, existing] of existingMap) {
        if (!incomingIds.has(id)) {
            changes.removed.push({
                id,
                name: existing.fullName || `${existing.firstName} ${existing.lastName}`,
                position: existing.position,
                team: existing.team,
            });
        }
    }

    return changes;
}

/** Total count of all changes */
function totalChanges(diff) {
    return Object.values(diff).reduce((sum, arr) => sum + arr.length, 0);
}

// ─── Changelog ────────────────────────────────────────────────────────────────

/**
 * Appends a structured entry to the player pool changelog.
 * This gives fantasy managers a history of roster moves.
 */
function appendChangelog(diff, mode, playerCount) {
    let log = [];
    if (fs.existsSync(LOG_PATH)) {
        try { log = JSON.parse(fs.readFileSync(LOG_PATH, 'utf8')); } catch {}
    }

    const entry = {
        timestamp:   new Date().toISOString(),
        mode,
        playerCount,
        summary: {
            newPlayers:    diff.newPlayers.length,
            teamChanges:   diff.teamChanges.length,
            injuries:      diff.injuries.length,
            returns:       diff.returns.length,
            practiceSquad: diff.practiceSquad.length,
            depthShifts:   diff.depthShifts.length,
            removed:       diff.removed.length,
        },
        // Only store top items per category (keep log small)
        highlights: {
            trades:     diff.teamChanges.slice(0, 20),
            injuries:   diff.injuries.slice(0, 20),
            returns:    diff.returns.slice(0, 10),
            rookies:    diff.newPlayers.filter(p => p.isRookie).slice(0, 30),
            promoted:   diff.practiceSquad.filter(p => p.action.includes('promoted')).slice(0, 10),
        },
    };

    // Keep last 52 entries (~1 year of weekly pulls)
    log.unshift(entry);
    if (log.length > 52) log = log.slice(0, 52);

    if (!DRY_RUN) {
        fs.writeFileSync(LOG_PATH, JSON.stringify(log, null, 2));
    }

    return entry;
}

// ─── Report ───────────────────────────────────────────────────────────────────

function printDiffReport(diff, mode) {
    const total = totalChanges(diff);
    if (total === 0) {
        console.log('\n✅ [DIFF] No changes detected — player pool is current.');
        return;
    }

    console.log(`\n📊 [DIFF] ${total} total changes detected (mode: ${mode})`);
    console.log('─'.repeat(55));

    if (diff.newPlayers.length) {
        const rookies = diff.newPlayers.filter(p => p.isRookie);
        const vets    = diff.newPlayers.filter(p => !p.isRookie);
        console.log(`\n  ➕ New Players: ${diff.newPlayers.length} (${rookies.length} rookies, ${vets.length} vets)`);
        rookies.slice(0, 10).forEach(p =>
            console.log(`     🆕 ${p.name} (${p.position}, ${p.team}) — ROOKIE`)
        );
        vets.slice(0, 5).forEach(p =>
            console.log(`     🆕 ${p.name} (${p.position}, ${p.team})`)
        );
        if (diff.newPlayers.length > 15) console.log(`     ... and ${diff.newPlayers.length - 15} more`);
    }

    if (diff.teamChanges.length) {
        console.log(`\n  🔄 Trades / Signings: ${diff.teamChanges.length}`);
        diff.teamChanges.slice(0, 15).forEach(p =>
            console.log(`     🔀 ${p.name} (${p.position}): ${p.from} → ${p.to}`)
        );
        if (diff.teamChanges.length > 15) console.log(`     ... and ${diff.teamChanges.length - 15} more`);
    }

    if (diff.injuries.length) {
        console.log(`\n  🚑 New / Changed Injuries: ${diff.injuries.length}`);
        diff.injuries.slice(0, 10).forEach(p => {
            const prev = p.previousStatus ? ` (was ${p.previousStatus})` : '';
            const body = p.bodyPart ? ` [${p.bodyPart}]` : '';
            console.log(`     ⚠️  ${p.name} (${p.position}, ${p.team}): ${p.status}${prev}${body}`);
        });
        if (diff.injuries.length > 10) console.log(`     ... and ${diff.injuries.length - 10} more`);
    }

    if (diff.returns.length) {
        console.log(`\n  💪 Cleared from Injury: ${diff.returns.length}`);
        diff.returns.slice(0, 10).forEach(p =>
            console.log(`     ✅ ${p.name} (${p.position}, ${p.team}) — cleared from ${p.wasStatus}`)
        );
    }

    if (diff.practiceSquad.length) {
        console.log(`\n  📋 Practice Squad Moves: ${diff.practiceSquad.length}`);
        diff.practiceSquad.slice(0, 10).forEach(p =>
            console.log(`     📌 ${p.name} (${p.position}, ${p.team}): ${p.action}`)
        );
    }

    if (diff.depthShifts.length) {
        console.log(`\n  📈 Depth Chart Shifts: ${diff.depthShifts.length}`);
        diff.depthShifts.slice(0, 10).forEach(p =>
            console.log(`     🔁 ${p.name} (${p.position}, ${p.team}): ${p.action}`)
        );
    }

    if (diff.removed.length) {
        console.log(`\n  ➖ Removed (released/retired): ${diff.removed.length}`);
        diff.removed.slice(0, 5).forEach(p =>
            console.log(`     ❌ ${p.name} (${p.position}, ${p.team})`)
        );
        if (diff.removed.length > 5) console.log(`     ... and ${diff.removed.length - 5} more`);
    }

    console.log('');
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
    console.log('');
    console.log(`👥 TRIER FANTASY FOOTBALL — Player Pool Refresh`);
    console.log(`   ${MODE_LABELS[MODE] || MODE}`);
    console.log('═══════════════════════════════════════════════════');
    if (DRY_RUN)   console.log('🧪 Dry Run: YES — no files written');
    if (DIFF_ONLY) console.log('🔍 Diff Only: changes shown but not written');
    console.log('');

    // ── Fetch fresh player registry ────────────────────────────────────────────
    let rawPlayers;
    try {
        rawPlayers = await fetchSleeperPlayers();
    } catch (err) {
        console.error(`❌ [FATAL] Cannot fetch player registry: ${err.message}`);
        process.exit(1);
    }

    // ── Fetch trending (in-season only, non-fatal) ─────────────────────────────
    let trendingData = { adds: [], drops: [] };
    if (MODE === 'in-season') {
        console.log('📈 [TRENDING] Fetching trending players...');
        trendingData = await fetchTrendingPlayers();
        console.log(`   ${trendingData.adds.length} trending adds, ${trendingData.drops.length} trending drops`);
    }

    // ── Filter to fantasy-relevant players ─────────────────────────────────────
    const incomingMap = {};
    for (const [id, raw] of Object.entries(rawPlayers)) {
        if (isRelevant(id, raw)) {
            incomingMap[id] = normalizePlayer(id, raw, trendingData);
        }
    }

    const newCount = Object.keys(incomingMap).length;
    console.log(`🎯 [FILTER] ${newCount.toLocaleString()} fantasy-relevant players selected.`);

    // ── Load existing pool ─────────────────────────────────────────────────────
    let existingPool = [];
    if (fs.existsSync(POOL_PATH) && !FULL) {
        try {
            existingPool = JSON.parse(fs.readFileSync(POOL_PATH, 'utf8'));
            console.log(`📂 [EXISTING] ${existingPool.length.toLocaleString()} players in current pool.`);
        } catch {
            console.warn('⚠️  Could not parse existing pool — treating as fresh install.');
        }
    } else if (FULL) {
        console.log('⚡ [FULL] Full re-pull requested — treating existing pool as empty.');
    }

    // ── Compute diff ───────────────────────────────────────────────────────────
    const diff = computeDiff(existingPool, incomingMap);
    printDiffReport(diff, MODE);

    // ── Skip if nothing changed ────────────────────────────────────────────────
    if (totalChanges(diff) === 0 && !FULL) {
        console.log('✅ Player pool is up to date — nothing to write.');
        return;
    }

    if (DRY_RUN || DIFF_ONLY) {
        console.log('🧪 No files written (dry-run / diff-only mode).');
        return;
    }

    // ── Write updated pool ─────────────────────────────────────────────────────
    const newPool = Object.values(incomingMap);
    fs.writeFileSync(POOL_PATH, JSON.stringify(newPool, null, 2));
    console.log(`💾 [OUTPUT] Updated ${path.relative(process.cwd(), POOL_PATH)}`);
    console.log(`   ${newPool.length.toLocaleString()} players · ${(fs.statSync(POOL_PATH).size / 1024).toFixed(0)} KB`);

    // ── Write changelog ────────────────────────────────────────────────────────
    const logEntry = appendChangelog(diff, MODE, newPool.length);
    console.log(`📋 [CHANGELOG] Logged to ${path.relative(process.cwd(), LOG_PATH)}`);

    // ── GitHub Actions annotation (surfaced in CI logs) ────────────────────────
    if (process.env.GITHUB_STEP_SUMMARY) {
        const summary = [
            `## 👥 Player Pool Update — ${MODE}`,
            `| Category | Count |`,
            `|---|---|`,
            `| New Players | ${diff.newPlayers.length} |`,
            `| Trades / Signings | ${diff.teamChanges.length} |`,
            `| New Injuries | ${diff.injuries.length} |`,
            `| Cleared from Injury | ${diff.returns.length} |`,
            `| Practice Squad Moves | ${diff.practiceSquad.length} |`,
            `| Depth Chart Shifts | ${diff.depthShifts.length} |`,
            `| Released / Retired | ${diff.removed.length} |`,
            `| **Total Players** | **${newPool.length}** |`,
        ];

        if (diff.teamChanges.length > 0) {
            summary.push('\n### 🔀 Top Trades/Signings');
            diff.teamChanges.slice(0, 10).forEach(p =>
                summary.push(`- **${p.name}** (${p.position}): ${p.from} → ${p.to}`)
            );
        }

        if (diff.injuries.length > 0) {
            summary.push('\n### 🚑 Key Injuries');
            diff.injuries.slice(0, 10).forEach(p => {
                const body = p.bodyPart ? ` [${p.bodyPart}]` : '';
                summary.push(`- **${p.name}** (${p.position}, ${p.team}): ${p.status}${body}`);
            });
        }

        fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary.join('\n') + '\n');
    }

    console.log('\n✅ Player pool refresh complete.');
}

main().catch(err => {
    console.error(`\n💀 [FATAL] ${err.message}`);
    process.exit(1);
});
