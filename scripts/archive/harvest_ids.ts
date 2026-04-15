
import fs from 'fs';
import path from 'path';

const allPlayers = JSON.parse(fs.readFileSync(path.join(__dirname, '../src/data/all_players_pool.json'), 'utf-8'));

const targets = [
    "Josh Allen", "Lamar Jackson", "Jalen Hurts", "Patrick Mahomes",
    "Christian McCaffrey", "Saquon Barkley", "Breece Hall", "Bijan Robinson", "Jonathan Taylor", "Derrick Henry",
    "Justin Jefferson", "Ja'Marr Chase", "CeeDee Lamb", "Tyreek Hill", "Amon-Ra St. Brown", "Puka Nacua", "Xavier Worthy",
    "Travis Kelce", "George Kittle", "Sam LaPorta"
];

console.log("Found IDs:");
targets.forEach(target => {
    const p = allPlayers.find((p: any) => `${p.firstName} ${p.lastName}` === target);
    if (p) {
        // Use espnId if available and non-zero (preferred), else id
        const id = (p.espnId && p.espnId !== "0") ? p.espnId : p.id;
        console.log(`"${target}": "${id}",`); // Format for easy copy-paste
    } else {
        console.log(`// ${target} NOT FOUND`);
    }
});
