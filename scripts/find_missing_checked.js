import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const players = require('../src/data/all_players_pool.json');
const socialHandles = require('../src/data/social_handles.json');

// create a map of existing handles (ensure strings)
const handleMap = new Set(socialHandles.map(s => String(s.player_id)));

// Filter: Top players by projected points who are missing handles
const missing = players
    .filter(p => {
        const idStr = String(p.id);
        const espnIdStr = p.espnId ? String(p.espnId) : null;
        return !handleMap.has(idStr) && (!espnIdStr || !handleMap.has(espnIdStr));
    })
    .filter(p => p.projectedPoints > 200) // Lower threshold to catch more starters
    .sort((a, b) => b.projectedPoints - a.projectedPoints)
    .slice(0, 30) // Batch of 30
    .map(p => ({
        name: `${p.firstName} ${p.lastName}`,
        id: p.id,
        espnId: p.espnId,
        team: p.team,
        proj: p.projectedPoints
    }));

console.log(JSON.stringify(missing, null, 2));
