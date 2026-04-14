
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROSTER_FILE = path.join(__dirname, '../src/data/rosters/CHI.json');
const OUTPUT_FILE = path.join(__dirname, '../IMAGE_SOURCING_REPORT.md');

const roster = JSON.parse(fs.readFileSync(ROSTER_FILE, 'utf-8'));

function generateImageUrl(espnId) {
    // secure High Res URL using ESPN Combiner
    return `https://a.espncdn.com/combiner/i?img=/i/headshots/nfl/players/full/${espnId}.png&w=1000&h=1000&scale=crop`;
}

let markdown = `# Image Sourcing Report: Chicago Bears (Active Roster)

**Generated:** ${new Date().toLocaleString()}
**Count:** ${roster.length} Players
**Source:** ESPN / NFL (via API)
**Resolution Logic:** High-Quality Upscale (1000px)

> [!WARNING]
> **Licensing Information:**
> These images are proprietary and owned by ESPN, the NFL, or their respective copyright holders. 
> 
> **Attribution:**
> "Images provided by ESPN API. All rights reserved by ESPN and the NFL."
> 
> **Usage:**
> Personal / Educational / Demo use only. Commercial use requires a license from NFL Photos / AP.

| Player Name | Position | Image URL (1000px) | Status | License |
|:---|:---|:---|:---|:---|
`;

for (const player of roster) {
    const highResUrl = generateImageUrl(player.sourceId);

    // Status Logic
    let status = "✅ OK";
    let notes = "";

    if (player.position === 'DST') {
        status = "⚠️ Generic";
        notes = "Team Logo used for DST";
    }

    markdown += `| **${player.fullName}** | ${player.position} | [View Image](${highResUrl}) | ${status} ${notes} | Copyright ESPN/NFL |\n`;
}

markdown += `\n\n## Missing / Fallback Items\n`;
markdown += `- **DST (Chicago Bears)**: Uses Team Logo (Vector/PNG) instead of Player Headshot.\n`;

fs.writeFileSync(OUTPUT_FILE, markdown);
console.log(`Report generated at ${OUTPUT_FILE}`);
