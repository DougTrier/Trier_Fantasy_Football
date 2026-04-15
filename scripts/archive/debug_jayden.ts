
import * as fs from 'fs';
import * as path from 'path';

const cwd = process.cwd();
const playersPath = path.join(cwd, 'src/data/all_players_pool.json');
const statsPath = path.join(cwd, 'src/data/rosters/career_stats.json');

console.log('Players path:', playersPath);
const players = JSON.parse(fs.readFileSync(playersPath, 'utf8'));
const careerStats = JSON.parse(fs.readFileSync(statsPath, 'utf8'));

const jayden = players.find((p: any) => p.lastName === 'Daniels' && p.firstName === 'Jayden');

if (!jayden) {
    console.log('Jayden Daniels not found in pool');
    process.exit(1);
}

console.log('Jayden found:', jayden.id);
console.log('ESPN ID:', jayden.espnId);

let tid = jayden.espnId || jayden.id;
console.log('Resolved TID:', tid);

const history = careerStats[String(tid)] || jayden.historicalStats || [];
console.log('History length:', history.length);
console.log('History:', JSON.stringify(history, null, 2));

const totals = history.reduce((acc: any, h: any) => ({
    passYds: acc.passYds + (h.passingYards || 0),
    rushYds: acc.rushYds + (h.rushingYards || 0),
    recYds: acc.recYds + (h.receivingYards || 0),
    games: acc.games + (h.gamesPlayed || 0)
}), { passYds: 0, rushYds: 0, recYds: 0, games: 0 });

console.log('Totals:', totals);
