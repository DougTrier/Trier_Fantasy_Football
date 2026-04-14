import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const players = require('../src/data/all_players_pool.json');

const josh = players.find(p => p.firstName === 'Josh' && p.lastName === 'Allen');
console.log(JSON.stringify(josh, null, 2));
