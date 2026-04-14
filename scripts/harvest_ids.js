
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Manually constructing path to avoid import assertions needing flag
const jsonPath = path.join(__dirname, '../src/data/all_players_pool.json');
const allPlayers = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));

const targets = [
    "Josh Allen", "Lamar Jackson", "Jalen Hurts", "Patrick Mahomes",
    "Christian McCaffrey", "Saquon Barkley", "Breece Hall", "Bijan Robinson", "Jonathan Taylor", "Derrick Henry",
    "Justin Jefferson", "Ja'Marr Chase", "CeeDee Lamb", "Tyreek Hill", "Amon-Ra St. Brown", "Puka Nacua", "Xavier Worthy",
    "Travis Kelce", "George Kittle", "Sam LaPorta"
];

console.log("Found IDs:");
targets.forEach(target => {
    const p = allPlayers.find(p => p.firstName + ' ' + p.lastName === target);
    if (p) {
        const id = (p.espnId && p.espnId !== "0") ? p.espnId : p.id;
        console.log(`"${target}": "${id}",`);
    } else {
        const loose = allPlayers.find(p => target.includes(p.lastName) && target.includes(p.firstName));
        if (loose) {
            const id = (loose.espnId && loose.espnId !== "0") ? loose.espnId : loose.id;
            console.log(`"${target}": "${id}", // Loose match`);
        } else {
            console.log(`// ${target} NOT FOUND`);
        }
    }
});
