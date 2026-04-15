import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const players = require('../src/data/all_players_pool.json');
const socialHandles = require('../src/data/social_handles.json');

const handleMap = new Set(socialHandles.map(s => String(s.player_id)));

const ravensPlayers = players.filter(p => p.team === 'BAL');

const missing = ravensPlayers.filter(p => {
    const idStr = String(p.id);
    const espnIdStr = p.espnId ? String(p.espnId) : null;
    return !handleMap.has(idStr) && (!espnIdStr || !handleMap.has(espnIdStr));
}).map(p => ({
    name: `${p.firstName} ${p.lastName}`,
    id: p.id,
    espnId: p.espnId
}));

console.log(`Total Ravens Players: ${ravensPlayers.length}`);
console.log(`Missing Handles: ${missing.length}`);
console.log(JSON.stringify(missing, null, 2));
