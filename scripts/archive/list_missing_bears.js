import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const players = require('../src/data/all_players_pool.json');
const socialHandles = require('../src/data/social_handles.json');

const handleMap = new Set(socialHandles.map(s => String(s.player_id)));

const bearsPlayers = players.filter(p => p.team === 'CHI');

const missing = bearsPlayers.filter(p => {
    const idStr = String(p.id);
    const espnIdStr = p.espnId ? String(p.espnId) : null;
    return !handleMap.has(idStr) && (!espnIdStr || !handleMap.has(espnIdStr));
}).map(p => p.firstName + ' ' + p.lastName);

console.log(JSON.stringify(missing, null, 2));
