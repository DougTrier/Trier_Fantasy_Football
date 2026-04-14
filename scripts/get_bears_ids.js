import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const players = require('../src/data/all_players_pool.json');

const targets = [
    "Caleb Williams",
    "DJ Moore",
    "Keenan Allen",
    "Rome Odunze",
    "D'Andre Swift",
    "Cole Kmet",
    "Kyler Gordon",
    "Tyrique Stevenson", // Try to find him too
    "Jaylon Johnson",
    "Montez Sweat"
];

const results = players.filter(p => {
    const fullName = `${p.firstName} ${p.lastName}`;
    return targets.includes(fullName);
}).map(p => ({
    name: `${p.firstName} ${p.lastName}`,
    id: p.id,
    espnId: p.espnId
}));

console.log(JSON.stringify(results, null, 2));
