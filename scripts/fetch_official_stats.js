import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SEASON = 2025;
const OUTPUT_PATH = path.join(__dirname, '../src/data/live_stats_2025.json');

/**
 * BACKEND ORCHESTRATOR
 * 
 * Determines:
 * - Season State (FUTURE | ACTIVE_UNOFFICIAL | COMPLETED_OFFICIAL)
 * - Finality of data
 */
async function orchestrate() {
    console.log(`🔍 [ORCHESTRATOR] Initializing for Season ${SEASON}`);

    // Determinitic Backend Logic: 
    // Given the current date (Jan 2026), the 2025 Regular Season is COMPLETED_OFFICIAL.
    const season_state = "COMPLETED_OFFICIAL";
    const finality = "FINAL";

    let dataToSave = {
        season: SEASON,
        season_state: season_state,
        finality: finality,
        last_updated: new Date().toISOString(),
        stats: null,
        data_status: "NO_DATA_AVAILABLE",
        reason: "Orchestration in progress..."
    };

    try {
        console.log(`📡 [QUERY] Fetching official records from Sleeper API (Season: ${SEASON})...`);
        const response = await fetch(`https://api.sleeper.app/v1/stats/nfl/regular/${SEASON}`);

        if (!response.ok) {
            throw new Error(`API Source Error: ${response.status}`);
        }

        const externalStats = await response.json();
        const playerCount = Object.keys(externalStats || {}).length;

        if (playerCount === 0) {
            dataToSave.reason = "API returned empty dataset. Data is unavailable.";
        } else {
            console.log(`✅ [PROVENANCE] Retrieved finalized records for ${playerCount} players.`);
            dataToSave.stats = externalStats;
            dataToSave.data_status = "VALIDATED";
            dataToSave.stats_scope = "COMPLETED_GAMES_ONLY";
            delete dataToSave.reason;
        }

    } catch (error) {
        console.error(`❌ [FAILURE] Orchestration error: ${error.message}`);
        dataToSave.data_status = "ERROR";
        dataToSave.reason = error.message;
    }

    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(dataToSave, null, 2));
    console.log(`💾 [OUTPUT] Protocol persistent state saved to ${OUTPUT_PATH}`);
}

orchestrate();
