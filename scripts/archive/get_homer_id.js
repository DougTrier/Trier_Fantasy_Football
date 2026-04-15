import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const players = require('../src/data/all_players_pool.json');

const targets = [
    "Travis Homer"
];

const results = players.filter(p => {
    const fullName = `${p.firstName} ${p.lastName}`;
    return targets.some(t => fullName.includes(t) || t.includes(fullName));
}).map(p => ({
    name: `${p.firstName} ${p.lastName}`,
    id: p.id,
    espnId: p.espnId
}));

console.log(JSON.stringify(results, null, 2));
