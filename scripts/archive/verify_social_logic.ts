
import fs from 'fs';
import path from 'path';

const socialHandles = JSON.parse(fs.readFileSync(path.join(__dirname, '../src/data/social_handles.json'), 'utf-8'));
const balRoster = JSON.parse(fs.readFileSync(path.join(__dirname, '../src/data/rosters/BAL.json'), 'utf-8'));

const derrickHenry = balRoster.find((p: any) => p.fullName === 'Derrick Henry');

if (!derrickHenry) {
    console.error('CRITICAL: Derrick Henry not found in BAL.json');
    process.exit(1);
}

console.log('Found Player:', derrickHenry.fullName);
console.log('Player ID:', derrickHenry.id);

const match = socialHandles.find((s: any) =>
    s.player_id === String(derrickHenry.id) ||
    derrickHenry.id.includes(s.player_id)
);

console.log('Social Match Result:', match);

if (match) {
    console.log('SUCCESS: Match found.');
} else {
    console.error('FAILURE: No match found.');
    console.log('Available Handles:', socialHandles);
}
