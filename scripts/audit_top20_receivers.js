import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const players = require('../src/data/all_players_pool.json');
const socialHandles = require('../src/data/social_handles.json');

const handleMap = new Set(socialHandles.map(s => String(s.player_id)));

const targets = [
    "DeAndre Hopkins",
    "Mike Evans",
    "Travis Kelce",
    "Davante Adams",
    "Keenan Allen",
    "Tyreek Hill",
    "Stefon Diggs",
    "Brandin Cooks",
    "Tyler Lockett",
    "Adam Thielen",
    "Zach Ertz",
    "Cooper Kupp",
    "DJ Moore",
    "Justin Jefferson",
    "George Kittle",
    "A.J. Brown",
    "Terry McLaurin",
    "CeeDee Lamb",
    "DK Metcalf",
    "Mark Andrews"
];

const missing = [];

targets.forEach(targetName => {
    // Find player in pool to get ID
    const player = players.find(p => `${p.firstName} ${p.lastName}` === targetName);

    if (player) {
        const idStr = String(player.id);
        const espnIdStr = player.espnId ? String(player.espnId) : null;
        const hasSocials = handleMap.has(idStr) || (espnIdStr && handleMap.has(espnIdStr));

        if (!hasSocials) {
            missing.push({
                name: targetName,
                id: player.id,
                espnId: player.espnId
            });
        }
    } else {
        console.log(`Warning: Could not find player ${targetName} in database.`);
    }
});

console.log(`Total Targets: ${targets.length}`);
console.log(`Missing Handles: ${missing.length}`);
console.log(JSON.stringify(missing, null, 2));
