import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.resolve(__dirname, '../src/data');
const ROSTERS_DIR = path.join(DATA_DIR, 'rosters');
const ALL_PLAYERS_POOL_PATH = path.join(DATA_DIR, 'all_players_pool.json');

const updatePlayerList = (players) => {
    return players.map(player => ({
        ...player,
        ownerId: player.ownerId || null
    }));
};

const run = async () => {
    try {
        console.log('Initializing Ledger and Ownership fields...');

        // 1. Update Pool
        console.log('Updating all_players_pool.json...');
        const poolPlayers = JSON.parse(fs.readFileSync(ALL_PLAYERS_POOL_PATH, 'utf8'));
        const updatedPool = updatePlayerList(poolPlayers);
        fs.writeFileSync(ALL_PLAYERS_POOL_PATH, JSON.stringify(updatedPool, null, 2));

        // 2. Update Rosters
        console.log('Updating roster files...');
        const teamFiles = fs.readdirSync(ROSTERS_DIR).filter(f => f.endsWith('.json') && f !== 'career_stats.json');

        for (const file of teamFiles) {
            const filePath = path.join(ROSTERS_DIR, file);
            const roster = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            const updatedRoster = updatePlayerList(roster);
            fs.writeFileSync(filePath, JSON.stringify(updatedRoster, null, 2));
            console.log(`Updated ${file}`);
        }

        console.log('Successfully initialized ledger and ownership fields!');
    } catch (error) {
        console.error('Error during initialization:', error);
    }
};

run();
