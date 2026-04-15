import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.resolve(__dirname, '../src/data');
const ROSTERS_DIR = path.join(DATA_DIR, 'rosters');
const ALL_PLAYERS_POOL_PATH = path.join(DATA_DIR, 'all_players_pool.json');
const LIVE_STATS_PATH = path.join(DATA_DIR, 'live_stats_2025.json');

const run = async () => {
    try {
        console.log('Starting Performance Differential update...');

        // 1. Load Data
        const liveStatsData = JSON.parse(fs.readFileSync(LIVE_STATS_PATH, 'utf8'));
        const poolPlayers = JSON.parse(fs.readFileSync(ALL_PLAYERS_POOL_PATH, 'utf8'));

        // 2. Build Mappings from Pool
        const espnToLiveId = {};
        const poolProjections = {};

        poolPlayers.forEach(p => {
            if (p.espnId) {
                espnToLiveId[String(p.espnId)] = String(p.id);
                poolProjections[String(p.espnId)] = Number(p.projectedPoints);
            }
            if (p.id) {
                poolProjections[String(p.id)] = Number(p.projectedPoints);
            }
        });

        // 3. Helper to update a player list
        const updatePlayerList = (players) => {
            return players.map(player => {
                const id = String(player.id);
                const espnId = String(player.espnId || '');
                const liveIdFromEspn = espnToLiveId[espnId];

                // Find actual stats
                const liveEntry = liveStatsData.stats?.[id] ||
                    liveStatsData.stats?.[espnId] ||
                    (liveIdFromEspn ? liveStatsData.stats?.[liveIdFromEspn] : null);

                const actualPoints = liveEntry ? (liveEntry.pts_ppr || liveEntry.pts_std || 0) : null;

                // Find projected points (prefer existing field, then fallback to pool mappings)
                let projectedPoints = player.projectedPoints !== undefined ? Number(player.projectedPoints) : null;
                if (projectedPoints === null || isNaN(projectedPoints)) {
                    projectedPoints = poolProjections[espnId] !== undefined ? poolProjections[espnId] : (poolProjections[id] || null);
                }

                let diff = null;
                if (actualPoints !== null && projectedPoints !== null) {
                    diff = Number((actualPoints - projectedPoints).toFixed(2));
                }

                return {
                    ...player,
                    total_actual_fantasy_points: actualPoints,
                    total_projected_fantasy_points: projectedPoints,
                    performance_differential: diff
                };
            });
        };

        // 4. Update Pool
        console.log('Updating all_players_pool.json...');
        const updatedPool = updatePlayerList(poolPlayers);
        fs.writeFileSync(ALL_PLAYERS_POOL_PATH, JSON.stringify(updatedPool, null, 2));

        // 5. Update Rosters
        console.log('Updating roster files...');
        const teamFiles = fs.readdirSync(ROSTERS_DIR).filter(f => f.endsWith('.json') && f !== 'career_stats.json');

        for (const file of teamFiles) {
            const filePath = path.join(ROSTERS_DIR, file);
            const roster = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            const updatedRoster = updatePlayerList(roster);
            fs.writeFileSync(filePath, JSON.stringify(updatedRoster, null, 2));
            console.log(`Updated ${file}`);
        }

        console.log('Successfully updated all player files with Performance Differential!');
    } catch (error) {
        console.error('Error during update:', error);
    }
};

run();
