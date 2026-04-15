import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const players = require('../src/data/all_players_pool.json');
const socialHandles = require('../src/data/social_handles.json');

// create a map of existing handles
const handleMap = new Set(socialHandles.map(s => s.player_id));

// Filter: Top 100 players by projected points who are missing handles
const missing = players
    .filter(p => !handleMap.has(p.id) && !handleMap.has(p.espnId) && p.projectedPoints > 100)
    .sort((a, b) => b.projectedPoints - a.projectedPoints)
    .slice(0, 20) // Let's just look at the top 20 missing for now to batch it
    .map(p => ({
        name: `${p.firstName} ${p.lastName}`,
        id: p.id,
        team: p.team,
        proj: p.projectedPoints
    }));

console.log(JSON.stringify(missing, null, 2));
