
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TEAM_ID = '3'; // Chicago Bears
const API_URL = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/${TEAM_ID}/roster`;
const OUTPUT_FILE = path.join(__dirname, '../src/data/rosters/CHI.json');

const POSITION_MAP = {
    'Quarterback': 'QB',
    'Running Back': 'RB',
    'Wide Receiver': 'WR',
    'Tight End': 'TE',
    'Center': 'OL',
    'Guard': 'OL',
    'Offensive Tackle': 'OL',
    'Defensive Tackle': 'DL',
    'Defensive End': 'DL',
    'Linebacker': 'LB',
    'Cornerback': 'DB',
    'Safety': 'DB',
    'Defensive Back': 'DB',
    'Place Kicker': 'K',
    'Punter': 'P',
    'Long Snapper': 'LS'
};

async function ingestBears() {
    console.log(`Fetching roster from ${API_URL}...`);

    try {
        const response = await fetch(API_URL);
        if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);

        const data = await response.json();
        const roster = [];

        console.log(`Processing ${data.athletes.length} groups...`);

        for (const group of data.athletes) {
            for (const item of group.items) {
                const posName = item.position?.displayName || item.position?.name;
                const mappedPos = POSITION_MAP[posName] || item.position?.abbreviation || 'UNKNOWN';

                const player = {
                    id: item.uid || item.id,
                    sourceId: item.id,
                    firstName: item.firstName,
                    lastName: item.lastName,
                    fullName: item.fullName,
                    displayName: item.displayName,
                    team: 'CHI',
                    position: mappedPos,
                    jersey: item.jersey,
                    height: item.displayHeight,
                    weight: item.displayWeight,
                    // UPGRADED: Force 1000px High-Res Image via ESPN Combiner
                    headshotUrl: item.id ?
                        `https://a.espncdn.com/combiner/i?img=/i/headshots/nfl/players/full/${item.id}.png&w=1000&h=1000&scale=crop` :
                        'https://a.espncdn.com/combiner/i?img=/i/headshots/nfl/players/full/0.png&w=1000&h=1000&scale=crop',
                    age: item.age,
                    college: item.college?.name,
                    isActive: item.status?.type === 'active'
                };

                roster.push(player);
            }
        }

        // Add "Bears DST" as a synthesized player for fantasy purposes
        roster.push({
            id: 'chi-dst-defense',
            sourceId: 'chi-dst',
            firstName: 'Chicago',
            lastName: 'Bears',
            fullName: 'Chicago Bears',
            displayName: 'Chicago Bears',
            team: 'CHI',
            position: 'DST',
            headshotUrl: 'https://a.espncdn.com/i/teamlogos/nfl/500/chi.png',
            isActive: true,
            stats: {
                // Mock baseline stats
                sacks: 0,
                interceptions: 0,
                pointsAllowed: 0
            }
        });

        console.log(`Total players ingested: ${roster.length}`);

        fs.writeFileSync(OUTPUT_FILE, JSON.stringify(roster, null, 2));
        console.log(`Saved to ${OUTPUT_FILE}`);

    } catch (error) {
        console.error("Ingestion failed:", error);
        process.exit(1);
    }
}

ingestBears();
