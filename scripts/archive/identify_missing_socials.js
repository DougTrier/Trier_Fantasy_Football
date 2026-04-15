
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const allPlayersPath = path.join(__dirname, '../src/data/all_players_pool.json');
const socialHandlesPath = path.join(__dirname, '../src/data/social_handles.json');

const allPlayers = JSON.parse(fs.readFileSync(allPlayersPath, 'utf-8'));
const socialHandles = JSON.parse(fs.readFileSync(socialHandlesPath, 'utf-8'));

// Sort by projected points descending
const topPlayers = allPlayers
    .filter(p => p.projectedPoints > 50)
    .sort((a, b) => b.projectedPoints - a.projectedPoints)
    .slice(0, 50);

const existingIds = new Set(socialHandles.map(s => s.player_id));

console.log(`Top ${topPlayers.length} Players by Projection:`);
console.log('------------------------------------------------');

topPlayers.forEach(p => {
    const id = (p.espnId && p.espnId !== "0") ? p.espnId : p.id;
    const found = existingIds.has(String(id));

    // Always print status
    console.log(`[${found ? 'FOUND' : 'MISSING'}] ${p.firstName} ${p.lastName} (ID: ${id}) - Proj: ${p.projectedPoints}`);
});
