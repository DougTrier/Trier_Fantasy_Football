
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROSTERS_DIR = path.join(__dirname, '../src/data/rosters');

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

const TEAM_IDS = [
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16,
    17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 33, 34
];

async function ingestTeam(teamId) {
    const API_URL = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/${teamId}/roster`;
    console.log(`Fetching team ${teamId} from ${API_URL}...`);

    try {
        const response = await fetch(API_URL);
        if (!response.ok) {
            console.error(`Skipping team ${teamId}: HTTP ${response.status}`);
            return;
        }

        const data = await response.json();
        const abbr = data.team.abbreviation.toUpperCase();
        const roster = [];

        for (const group of data.athletes) {
            for (const item of group.items) {
                const posName = item.position?.displayName || item.position?.name;
                const mappedPos = POSITION_MAP[posName] || item.position?.abbreviation || 'UNKNOWN';

                roster.push({
                    id: item.uid || item.id,
                    sourceId: item.id,
                    espnId: item.id,
                    firstName: item.firstName,
                    lastName: item.lastName,
                    fullName: item.fullName,
                    displayName: item.displayName,
                    team: abbr,
                    position: mappedPos,
                    jersey: item.jersey,
                    height: item.displayHeight,
                    weight: item.displayWeight,
                    headshotUrl: item.id ?
                        `https://a.espncdn.com/combiner/i?img=/i/headshots/nfl/players/full/${item.id}.png&w=1000&h=1000&scale=crop` :
                        null,
                    age: item.age,
                    college: item.college?.name,
                    isActive: item.status?.type === 'active'
                });
            }
        }

        const outputFile = path.join(ROSTERS_DIR, `${abbr}.json`);
        fs.writeFileSync(outputFile, JSON.stringify(roster, null, 2));
        console.log(`Saved ${roster.length} players for ${abbr} to ${outputFile}`);
        return abbr;

    } catch (error) {
        console.error(`Failed team ${teamId}:`, error);
    }
}

async function run() {
    if (!fs.existsSync(ROSTERS_DIR)) fs.mkdirSync(ROSTERS_DIR, { recursive: true });

    const teams = [];
    for (const id of TEAM_IDS) {
        const abbr = await ingestTeam(id);
        if (abbr) teams.push(abbr);
        // Add a small delay
        await new Promise(r => setTimeout(r, 200));
    }

    console.log(`Finished. Ingested ${teams.length} teams: ${teams.join(', ')}`);
}

run();
