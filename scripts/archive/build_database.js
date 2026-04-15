// import fetch from 'node-fetch'; // Standard in Node 18+, but using if needed or just global fetch
import puppeteer from 'puppeteer';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OUTPUT_FILE = path.join(__dirname, '../src/data/scraped_players.json');

// Helper to normalize names for matching (e.g. "Patrick Mahomes II" -> "patrickmahomes")
const normalize = (name) => name.toLowerCase().replace(/[^a-z]/g, '');

async function buildDatabase() {
    console.log('🚀 Starting Database Build Process...');

    // 1. Fetch Master Data from Sleeper
    console.log('📥 Fetching Master Data from Sleeper API...');
    let sleeperPlayers = {};
    try {
        const resp = await fetch('https://api.sleeper.app/v1/players/nfl');
        if (!resp.ok) throw new Error('Sleeper API failed');
        const data = await resp.json();

        // Filter for active players only and useful positions
        const usefulPos = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF']; // Sleeper uses 'DEF', we use 'DST'

        Object.values(data).forEach(p => {
            if (!p.active) return;
            // Map Sleeper 'DEF' to our 'DST'
            const pos = p.position === 'DEF' ? 'DST' : p.position;
            if (!usefulPos.includes(pos) && p.position !== 'DEF') return;

            const normName = normalize(p.full_name || `${p.first_name} ${p.last_name}`);

            sleeperPlayers[normName] = {
                id: p.player_id,
                firstName: p.first_name,
                lastName: p.last_name,
                position: pos,
                team: p.team || 'FA',
                height: p.height,
                weight: p.weight,
                college: p.college,
                age: p.age,
                yearsExp: p.years_exp,
                gsisId: p.gsis_id,
                espnId: p.espn_id,
                yahooId: p.yahoo_id,
                photoUrl: null // Will try to fill later
            };
        });
        console.log(`✅ Loaded ${Object.keys(sleeperPlayers).length} Active Players from Sleeper.`);
    } catch (e) {
        console.error('❌ Sleeper API Error:', e);
        process.exit(1);
    }

    // 2. Scrape ADP & Projections from FantasyPros
    console.log('🕷️  Scraping ADP & Images from FantasyPros...');
    let adpData = [];
    const browser = await puppeteer.launch({ headless: "new", args: ['--no-sandbox'] });
    const page = await browser.newPage();

    try {
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
        await page.goto('https://www.fantasypros.com/nfl/adp/overall.php', { waitUntil: 'domcontentloaded' });
        await page.waitForSelector('table#data');

        adpData = await page.evaluate(() => {
            const rows = Array.from(document.querySelectorAll('table#data tbody tr'));
            return rows.map(row => {
                const cells = row.querySelectorAll('td');
                if (cells.length < 3) return null;

                const playerLink = row.querySelector('a.player-name');
                const nameRaw = playerLink ? playerLink.innerText.trim() : 'Unknown';
                const name = nameRaw.replace(/\(.*\)/, '').replace(/ - [A-Z]+$/, '').trim();

                // Extract Image if present
                const imgTag = cells[1]?.querySelector('img');
                let photoUrl = null;
                if (imgTag && imgTag.src) {
                    photoUrl = imgTag.src.replace('70x70', '250x250');
                }

                // Extract ADP
                let adp = 999;
                const lastCell = cells[cells.length - 1];
                if (lastCell) {
                    const val = parseFloat(lastCell.innerText.trim());
                    if (!isNaN(val)) adp = val;
                }

                return { name, adp, photoUrl };
            }).filter(x => x);
        });
        console.log(`✅ Scraped ${adpData.length} entries for ADP/Photos.`);
    } catch (e) {
        console.warn('⚠️ Scraper Warning:', e.message);
    } finally {
        await browser.close();
    }

    // 3. Merge Data
    console.log('🔄 Merging Datasets...');
    const finalDB = [];

    // We iterate through the SCRAPED list because we only want relevant fantasy players (ADP list),
    // but we use SLEEPER data as the source of truth for metadata.
    // If a player is in ADP but not Sleeper (rare), we verify.
    // Actually, let's iterate ADP list to filter the massive Sleeper list down to "Draftable" players.

    adpData.forEach(scraped => {
        const normName = normalize(scraped.name);
        const sleeper = sleeperPlayers[normName];

        if (sleeper) {
            // Calculate Project Points (Mock Logic)
            let estimatedPoints = Math.max(0, 350 - (scraped.adp * 2) + (Math.random() * 20));
            if (sleeper.position === 'QB') estimatedPoints += 50;
            if (sleeper.position === 'K' || sleeper.position === 'DST') estimatedPoints = Math.max(100, 160 - scraped.adp);

            finalDB.push({
                ...sleeper,
                id: sleeper.id, // Prefer Sleeper ID
                adp: scraped.adp,
                projectedPoints: parseFloat(estimatedPoints.toFixed(1)),
                photoUrl: scraped.photoUrl || sleeper.photoUrl, // Prefer Scraped Image (Headshot)
                ownership: Math.max(1, 100 - (scraped.adp / 2)).toFixed(0) + '%'
            });
        }
    });

    // 4. Fallback for DST
    // Sleeper has 'DEF' players (Team Defenses). Ensure we captured them.
    // If FantasyPros lists "San Francisco 49ers", Sleeper might list "San Francisco 49ers" or just "SF"

    console.log(`💾 Saving ${finalDB.length} merged players to disk...`);
    await fs.writeFile(OUTPUT_FILE, JSON.stringify(finalDB, null, 2));
    console.log('✨ Database Build Complete!');
}

buildDatabase();
