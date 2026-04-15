/**
 * migrate_to_current.js
 * ════════════════════════════════════════════════════════════════════════════
 * One-time migration: copies live_stats_2025.json → live_stats_current.json
 *
 * Run this ONCE to initialize the stable filename convention.
 * After this, only fetch_official_stats.js writes to live_stats_current.json.
 *
 * Usage: node scripts/migrate_to_current.js
 *
 * © 2026 Doug Trier · Trier Fantasy Football
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const DATA_DIR    = path.join(__dirname, '../src/data');
const SOURCE_2025 = path.join(DATA_DIR, 'live_stats_2025.json');
const OUTPUT_PATH = path.join(DATA_DIR, 'live_stats_current.json');
const ARCHIVE_DIR = path.join(DATA_DIR, 'archive');

console.log('');
console.log('🔀 TRIER FANTASY — Season Data Migration');
console.log('══════════════════════════════════════════');

if (fs.existsSync(OUTPUT_PATH)) {
    console.log('✅ live_stats_current.json already exists — no migration needed.');
    console.log('   Delete it and re-run if you want to force a fresh copy.');
    process.exit(0);
}

if (!fs.existsSync(SOURCE_2025)) {
    console.error('❌ live_stats_2025.json not found. Cannot migrate.');
    console.error('   Run: node scripts/fetch_official_stats.js --season=2025');
    process.exit(1);
}

// Copy 2025 → current
fs.copyFileSync(SOURCE_2025, OUTPUT_PATH);
console.log(`✅ Copied: live_stats_2025.json → live_stats_current.json`);

// Archive 2025 for historical reference
if (!fs.existsSync(ARCHIVE_DIR)) fs.mkdirSync(ARCHIVE_DIR, { recursive: true });
const archivePath = path.join(ARCHIVE_DIR, 'live_stats_2025.json');
if (!fs.existsSync(archivePath)) {
    fs.copyFileSync(SOURCE_2025, archivePath);
    console.log(`📦 Archived: live_stats_2025.json → archive/live_stats_2025.json`);
}

console.log('');
console.log('🏈 Migration complete!');
console.log('');
console.log('📋 What to do next:');
console.log('   1. Update src/data/mockDB.ts import:');
console.log("      from: import liveStatsRaw from './live_stats_2025.json'");
console.log("        to: import liveStatsRaw from './live_stats_current.json'");
console.log('   2. Update src/utils/ScoringEngine.ts import similarly');
console.log('   3. Run: npm run stats:fetch to verify the pipeline works');
console.log('');
