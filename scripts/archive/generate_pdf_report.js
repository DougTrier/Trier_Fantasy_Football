
import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

const OUTPUT_PATH = 'O:\\Trier Fantasy League Backup\\Player Import Details.pdf';
// Fallback path in case O: drive is not accessible
const FALLBACK_PATH = path.join(process.cwd(), 'Player Import Details.pdf');

const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Player Data Import Details</title>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; padding: 40px; }
        h1 { color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 10px; }
        h2 { color: #2980b9; margin-top: 30px; }
        h3 { color: #16a085; margin-top: 25px; }
        code { background-color: #f8f9fa; padding: 2px 4px; border-radius: 4px; font-family: Consolas, monospace; color: #c7254e; }
        pre { background-color: #f8f9fa; padding: 15px; border-radius: 4px; overflow-x: auto; border: 1px solid #e9ecef; }
        .note { background-color: #e8f4f8; border-left: 5px solid #3498db; padding: 15px; margin: 20px 0; }
        .warning { background-color: #fff3cd; border-left: 5px solid #ffc107; padding: 15px; margin: 20px 0; }
        ul { margin-bottom: 20px; }
        li { margin-bottom: 8px; }
        .footer { margin-top: 50px; border-top: 1px solid #ddd; padding-top: 20px; font-size: 0.9em; color: #777; text-align: center; }
    </style>
</head>
<body>
    <h1>Player Data Import & Ingestion Report</h1>
    <p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
    <p><strong>Project:</strong> Trier Fantasy League</p>

    <h2>1. Executive Summary</h2>
    <p>The application utilizes a <strong>hybrid data ingestion strategy</strong>, combining real-time API data, web scraping, and curated static datasets to build a comprehensive player database. This ensures high-fidelity roster information (headshots, physicals) while leveraging market data (ADP, ownership) for fantasy relevance.</p>

    <h2>2. Data Sources</h2>
    <ul>
        <li><strong>ESPN Hidden API</strong>: Primary source for official roster data, providing high-resolution headshots, physical attributes (height, weight), and active status.</li>
        <li><strong>FantasyPros (Scraped)</strong>: Source for Average Draft Position (ADP), ownership percentages, and simulated projections.</li>
        <li><strong>Static Repositories</strong>: JSON files stored in <code>src/data/</code> containing career stats, combine results, and social media handles.</li>
        <li><strong>Unused Assets</strong>: <code>Chicago Bears Roster.xlsx</code> is present in the root directory but is <strong>not currently utilized</strong> in the automated ingestion pipeline.</li>
    </ul>

    <h2>3. Ingestion Processes</h2>

    <h3>A. Official Roster Ingestion</h3>
    <p><strong>Script:</strong> <code>scripts/ingest_roster.js</code></p>
    <p>This script targets specific NFL teams (currently configured for the Chicago Bears, ID: 3) via ESPN's internal API.</p>
    <ul>
        <li><strong>Endpoint:</strong> <code>https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/{TEAM_ID}/roster</code></li>
        <li><strong>Normalization:</strong> Maps raw position names (e.g., "Cornerback") to standard abbreviations ("DB").</li>
        <li><strong>Enrichment:</strong> Forces high-resolution (1000px) headshots via ESPN's image combiner service.</li>
        <li><strong>Synthesized Data:</strong> Automatically generates a "Bears DST" player entry for fantasy defense scoring.</li>
        <li><strong>Output:</strong> Saves processed data to <code>src/data/rosters/CHI.json</code>.</li>
    </ul>

    <h3>B. Fantasy Market Data Scraping</h3>
    <p><strong>Script:</strong> <code>scripts/scrape_data.js</code></p>
    <p>This script uses <strong>Puppeteer</strong> to scrape reliable ADP data from FantasyPros.</p>
    <ul>
        <li><strong>Source:</strong> <code>https://www.fantasypros.com/nfl/adp/overall.php</code></li>
        <li><strong>Extraction:</strong> Parses the DOM to extract Player Name, Team, Position, ADP, and Image URLs.</li>
        <li><strong>Projection Simulation:</strong> Since real projections are often paywalled, the script simulates projections using an inverse-ADP curve:
            <pre>Points = 350 - (ADP * 2) + RandomVariance</pre>
            Special adjustments are applied for QBs (+50 pts) and K/DST (capped).
        </li>
        <li><strong>Output:</strong> Saves to <code>src/data/scraped_players.json</code>.</li>
    </ul>

    <h2>4. Application Integration & Logic</h2>
    <p><strong>Controller:</strong> <code>src/data/mockDB.ts</code></p>
    <p>The application loads data at runtime using a sophisticated merge strategy:</p>
    <ol>
        <li><strong>Loading:</strong> Imports the base player pool (<code>all_players_pool.json</code>).</li>
        <li><strong>Enrichment:</strong> Merges in:
            <ul>
                <li><strong>Career Stats:</strong> From <code>rosters/career_stats.json</code>.</li>
                <li><strong>Combine Data:</strong> From <code>combine_stats.json</code>.</li>
                <li><strong>Social Handles:</strong> From <code>social_handles.json</code>.</li>
                <li><strong>Live Stats 2025:</strong> From <code>live_stats_2025.json</code> (with priority over historical data).</li>
            </ul>
        </li>
        <li><strong>Sanity Checks & Repairs:</strong> Includes hard-coded logic to fix known data issues:
            <ul>
                <li>Resolves ID collisions (e.g., Matthew Stafford vs. Jack Bech).</li>
                <li><strong>Validation:</strong> Clears career stats for non-QBs with >2000 passing yards (data error detection).</li>
                <li><strong>Specific Fixes:</strong> Hard-coded patch for "Jack Bech" and injection of 2024 stats for "Jayden Daniels".</li>
            </ul>
        </li>
    </ol>

    <h2>5. Recommendations</h2>
    <div class="note">
        <p><strong>Scaling:</strong> To support more teams, <code>scripts/ingest_roster.js</code> should be parameterized to accept a generic Team ID, instead of hardcoding the Chicago Bears.</p>
    </div>
    <div class="warning">
        <p><strong>Excel File:</strong> The file <code>Chicago Bears Roster.xlsx</code> is currently orphaned. If this contains manual overrides or scouting data, a new script is needed to parse it and merge it into <code>src/data/mockDB.ts</code>.</p>
    </div>

    <div class="footer">
        Generated by Antigravity AI | Trier Fantasy League
    </div>
</body>
</html>
`;

async function generateReport() {
    console.log('Generating PDF report...');
    let browser;
    try {
        browser = await puppeteer.launch({
            headless: "new"
        });
        const page = await browser.newPage();

        // Set content
        await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

        // Ensure directory exists
        const outputDir = path.dirname(OUTPUT_PATH);
        try {
            if (!fs.existsSync(outputDir)) {
                console.log(`Directory ${outputDir} does not exist. Attempting to create...`);
                fs.mkdirSync(outputDir, { recursive: true });
            }
        } catch (e) {
            console.warn(`Could not access or create directory ${outputDir}. Using fallback.`);
            // We will let the write attempt fail or succeed naturally, but logic suggests using fallback if this fails.
        }

        try {
            await page.pdf({
                path: OUTPUT_PATH,
                format: 'A4',
                printBackground: true,
                margin: {
                    top: '20px',
                    bottom: '40px',
                    left: '20px',
                    right: '20px'
                }
            });
            console.log(`Successfully saved report to: ${OUTPUT_PATH}`);
        } catch (err) {
            console.error(`Failed to save to O: drive (${err.message}). Saving to local directory instead.`);
            await page.pdf({
                path: FALLBACK_PATH,
                format: 'A4',
                printBackground: true
            });
            console.log(`Saved fallback report to: ${FALLBACK_PATH}`);
        }

    } catch (error) {
        console.error('Error generating PDF:', error);
        process.exit(1);
    } finally {
        if (browser) await browser.close();
    }
}

generateReport();
