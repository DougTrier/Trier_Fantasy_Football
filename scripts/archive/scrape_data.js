import puppeteer from 'puppeteer';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OUTPUT_FILE = path.join(__dirname, '../src/data/scraped_players.json');

async function scrapeFantasyPros() {
    console.log('🏈 Starting Scraping Process...');
    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();

    // Set a realistic user agent to avoid bot detection
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');

    const players = [];

    try {
        // 1. Scrape ADP (Average Draft Position)
        const adpUrl = 'https://www.fantasypros.com/nfl/adp/overall.php';
        console.log(`stats: Fetching ADP from ${adpUrl}...`);

        await page.goto(adpUrl, { waitUntil: 'domcontentloaded' });

        // Wait for table
        await page.waitForSelector('table#data');

        const scrapedData = await page.evaluate(() => {
            const rows = Array.from(document.querySelectorAll('table#data tbody tr'));
            return rows.map(row => {
                const cells = row.querySelectorAll('td');
                if (cells.length < 3) return null;

                // 1. Player Name & Team extraction
                const playerLink = row.querySelector('a.player-name');
                const nameRaw = playerLink ? playerLink.innerText.trim() : 'Unknown';
                // Remove (Team) or status or suffixes
                const name = nameRaw.replace(/\(.*\)/, '').replace(/ - [A-Z]+$/, '').trim();

                // Get Team from text like "Patrick Mahomes II (KC - QB)" -> "KC"
                const playerCellText = cells[1]?.innerText || '';
                let team = 'FA';
                const teamMatch = playerCellText.match(/\(([A-Z]{2,3})/) || playerCellText.match(/\s([A-Z]{2,3})\s*$/);
                if (teamMatch) team = teamMatch[1];

                // 2. Position from Rank Column (e.g. "WR1" -> "WR")
                const posRaw = cells[2]?.innerText.trim() || 'UNK';
                const position = posRaw.replace(/\d+/, '').trim();

                // 3. ADP (Last numeric column)
                let adp = 999;
                const lastCell = cells[cells.length - 1];
                if (lastCell) {
                    const val = parseFloat(lastCell.innerText.trim());
                    if (!isNaN(val)) adp = val;
                }

                // 4. Image Scrape (Look for img tag)
                const imgTag = cells[1]?.querySelector('img');
                let photoUrl = '';
                if (imgTag && imgTag.src) {
                    photoUrl = imgTag.src;
                    // Try to upgrade quality if possible, otherwise use as is
                    if (photoUrl.includes('70x70')) photoUrl = photoUrl.replace('70x70', '250x250');
                }

                return {
                    id: name.toLowerCase().replace(/[^a-z]/g, '') + '-' + position.toLowerCase(),
                    firstName: name.split(' ')[0],
                    lastName: name.split(' ').slice(1).join(' '),
                    position: position,
                    team: team,
                    adp: adp,
                    photoUrl: photoUrl,
                    projectedPoints: 0
                };
            }).filter(p => p !== null && p.position.length > 0 && p.position.length < 5);
        });

        console.log(`✅ Found ${scrapedData.length} players from ADP list.`);

        // Simple projection simulation based on ADP (since real projections are often behind paywalls or complex)
        console.log('✨ Generating simulated projections based on ADP...');

        const enhancedPlayers = scrapedData.map(p => {
            // Simple curve to estimate points from ADP
            let estimatedPoints = Math.max(0, 350 - (p.adp * 2) + (Math.random() * 20));

            // Boost QBs
            if (p.position === 'QB') estimatedPoints += 50;
            // Penalities for K/DST
            if (p.position === 'K' || p.position === 'DST') estimatedPoints = Math.max(100, 160 - p.adp);

            return {
                ...p,
                projectedPoints: parseFloat(estimatedPoints.toFixed(1)),
                ownership: Math.max(1, 100 - (p.adp / 2)).toFixed(0) + '%'
            };
        });

        // Save to disk
        await fs.writeFile(OUTPUT_FILE, JSON.stringify(enhancedPlayers, null, 2));
        console.log(`💾 Scraped data saved to ${OUTPUT_FILE}`);

    } catch (error) {
        console.error('❌ Error during scraping:', error);
    } finally {
        await browser.close();
    }
}

scrapeFantasyPros();
