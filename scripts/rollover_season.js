/**
 * rollover_season.js
 * ════════════════════════════════════════════════════════════════════════════
 * Annual Season Rollover Script
 *
 * Triggered automatically on September 1st via GitHub Actions,
 * or manually: node scripts/rollover_season.js [--season=2026]
 *
 * What it does:
 *  1. Archives the current live_stats_current.json
 *  2. Initializes a FUTURE-state JSON for the new season
 *  3. Updates the player pool (calls refresh_player_pool.js)
 *  4. Commits changes via git (in CI)
 *
 * © 2026 Doug Trier · Trier Fantasy Football
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const DATA_DIR    = path.join(__dirname, '../src/data');
const ARCHIVE_DIR = path.join(DATA_DIR, 'archive');
const OUTPUT_PATH = path.join(DATA_DIR, 'live_stats_current.json');

// ─── Season Detection ─────────────────────────────────────────────────────────

function parseArgs() {
    return Object.fromEntries(
        process.argv.slice(2)
            .filter(a => a.startsWith('--'))
            .map(a => {
                const [k, v] = a.slice(2).split('=');
                return [k, v ?? true];
            })
    );
}

function getNewSeason(args) {
    if (args.season) {
        const explicit = parseInt(args.season, 10);
        if (!isNaN(explicit)) return explicit;
    }
    // September 1st rollover: the new season is always the current calendar year
    return new Date().getFullYear();
}

// ─── Archive ──────────────────────────────────────────────────────────────────

function archiveCurrentSeason() {
    if (!fs.existsSync(OUTPUT_PATH)) {
        console.log('📦 [ARCHIVE] No current file to archive.');
        return null;
    }

    try {
        const current    = JSON.parse(fs.readFileSync(OUTPUT_PATH, 'utf8'));
        const prevSeason = current.season;
        if (!prevSeason) return null;

        if (!fs.existsSync(ARCHIVE_DIR)) fs.mkdirSync(ARCHIVE_DIR, { recursive: true });

        const archivePath = path.join(ARCHIVE_DIR, `live_stats_${prevSeason}.json`);
        fs.copyFileSync(OUTPUT_PATH, archivePath);
        console.log(`📦 [ARCHIVE] Season ${prevSeason} archived → ${path.relative(process.cwd(), archivePath)}`);
        return prevSeason;
    } catch (err) {
        console.warn(`⚠️  [ARCHIVE] Could not archive: ${err.message}`);
        return null;
    }
}

// ─── Initialize New Season ────────────────────────────────────────────────────

function initNewSeason(newSeason) {
    const payload = {
        season:       newSeason,
        season_state: 'FUTURE',
        finality:     'NONE',
        last_updated: new Date().toISOString(),
        data_status:  'NO_DATA_AVAILABLE',
        reason:       `${newSeason} NFL season begins in September ${newSeason}. Run stats:fetch when the season starts.`,
        stats:        null,
    };

    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(payload, null, 2));
    console.log(`🆕 [INIT] Season ${newSeason} initialized with state: FUTURE`);
    return payload;
}

// ─── Player Pool Refresh ──────────────────────────────────────────────────────

async function refreshPlayers() {
    const scriptPath = path.join(__dirname, 'refresh_player_pool.js');
    if (!fs.existsSync(scriptPath)) {
        console.warn('⚠️  [PLAYERS] refresh_player_pool.js not found — skipping player pool update.');
        return;
    }

    console.log('👥 [PLAYERS] Refreshing player pool from Sleeper API...');
    try {
        execSync(`node "${scriptPath}"`, { stdio: 'inherit' });
    } catch (err) {
        console.warn(`⚠️  [PLAYERS] Player pool refresh failed: ${err.message}`);
        // Non-fatal — proceed without it
    }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
    console.log('');
    console.log('🔄 TRIER FANTASY FOOTBALL — Annual Season Rollover');
    console.log('════════════════════════════════════════════════════');

    const args      = parseArgs();
    const newSeason = getNewSeason(args);

    // Check if this is actually a new season
    if (fs.existsSync(OUTPUT_PATH)) {
        try {
            const current = JSON.parse(fs.readFileSync(OUTPUT_PATH, 'utf8'));
            if (current.season === newSeason) {
                console.log(`✅ [SKIP] Season ${newSeason} is already current — no rollover needed.`);
                console.log('   Use --season=YYYY to force a specific season.');
                process.exit(0);
            }
        } catch {}
    }

    console.log(`📅 Rolling over to: ${newSeason} season`);
    console.log('');

    // Step 1: Archive previous season
    const prevSeason = archiveCurrentSeason();
    if (prevSeason) {
        console.log(`✅ Previous season (${prevSeason}) safely archived.`);
    }

    // Step 2: Initialize new season file
    initNewSeason(newSeason);

    // Step 3: Refresh player pool (rookies, retirements, trades)
    await refreshPlayers();

    console.log('');
    console.log(`🏈 Season ${newSeason} rollover complete!`);
    console.log('');
    console.log('📋 Season timeline:');
    console.log(`   • Now → Jul 31, ${newSeason}:    FUTURE (off-season)`);
    console.log(`   • Aug 1 → Sep 4, ${newSeason}:  PRESEASON (Hall of Fame + preseason games — scouting only)`);
    console.log(`   • Sep 5, ${newSeason} → Feb 15, ${newSeason + 1}: ACTIVE_UNOFFICIAL (regular season + playoffs)`);
    console.log(`   • Feb 16+, ${newSeason + 1}:     COMPLETED_OFFICIAL (season final)`);
    console.log('');
    console.log('   All transitions are automatic via GitHub Actions.');
    console.log(`   Manual override: npm run stats:fetch --season=${newSeason}`);
    console.log('');
}

main().catch(err => {
    console.error(`\n💀 [FATAL] Rollover failed: ${err.message}`);
    process.exit(1);
});
