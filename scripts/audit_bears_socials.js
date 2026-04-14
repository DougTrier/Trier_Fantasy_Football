import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const players = require('../src/data/all_players_pool.json');
const socialHandles = require('../src/data/social_handles.json');

// Create a map of existing handles
const handleMap = new Set(socialHandles.map(s => String(s.player_id)));

// Filter for Chicago Bears players
const bearsPlayers = players.filter(p => p.team === 'CHI');

const audit = bearsPlayers.map(p => {
    const idStr = String(p.id);
    const espnIdStr = p.espnId ? String(p.espnId) : null;
    const hasSocials = handleMap.has(idStr) || (espnIdStr && handleMap.has(espnIdStr));

    return {
        name: `${p.firstName} ${p.lastName}`,
        id: p.id,
        espnId: p.espnId,
        hasSocials: hasSocials
    };
});

const missing = audit.filter(p => !p.hasSocials);
const found = audit.filter(p => p.hasSocials);

console.log(`Total Bears Players: ${audit.length}`);
console.log(`Found Socials: ${found.length}`);
console.log(`Missing Socials: ${missing.length}`);
console.log('--- Missing Players ---');
console.log(JSON.stringify(missing, null, 2));
