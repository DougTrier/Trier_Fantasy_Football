
import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

const OUTPUT_PATH = 'O:\\Trier Fantasy League Backup\\Trier Fantasy Football Complete AI Agent Backup.pdf';
const FALLBACK_PATH = path.join(process.cwd(), 'Trier Fantasy Football Complete AI Agent Backup.pdf');

const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Trier Fantasy Football Complete AI Agent Backup</title>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.5; color: #111; max-width: 900px; margin: 0 auto; padding: 40px; }
        h1 { color: #000; border-bottom: 3px solid #000; padding-bottom: 15px; margin-top: 50px; }
        h2 { color: #222; border-bottom: 2px solid #555; padding-bottom: 10px; margin-top: 40px; }
        h3 { color: #444; margin-top: 30px; border-left: 4px solid #3498db; padding-left: 10px; }
        h4 { color: #666; margin-top: 20px; text-decoration: underline; }
        code { background-color: #f1f1f1; padding: 2px 4px; border-radius: 4px; font-family: 'Courier New', monospace; font-size: 0.9em; color: #d63384; }
        pre { background-color: #f8f8f8; padding: 15px; border-radius: 4px; overflow-x: auto; border: 1px solid #ddd; font-size: 0.85em; }
        .section-number { color: #888; font-size: 0.8em; margin-right: 10px; }
        .critical { color: red; font-weight: bold; }
        .warning { background-color: #fff3cd; border: 1px solid #ffeeba; padding: 10px; margin: 10px 0; }
        ul, ol { margin-bottom: 15px; }
        li { margin-bottom: 5px; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
        .toc { background-color: #f9f9f9; padding: 20px; border: 1px solid #ccc; margin-bottom: 40px; }
        .toc a { text-decoration: none; color: #333; display: block; margin-bottom: 5px; }
    </style>
</head>
<body>
    <div style="text-align: center; margin-bottom: 100px;">
        <h1 style="border: none; font-size: 3em;">Trier Fantasy Football</h1>
        <h2>Complete AI Agent Backup & Forensic Reconstruction Document</h2>
        <p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
        <p><strong>Status:</strong> AS-BUILT FORENSIC SNAPSHOT</p>
        <p><strong>Target:</strong> AI Autonomous Rebuild</p>
    </div>

    <div class="toc">
        <h3>Table of Contents</h3>
        <a href="#section1">1. Executive System Identity</a>
        <a href="#section2">2. Technology Stack (Exact)</a>
        <a href="#section3">3. Application Architecture</a>
        <a href="#section4">4. File & Folder Structure</a>
        <a href="#section5">5. Core Features (Deep Dive)</a>
        <a href="#section6">6. Video System (CRITICAL)</a>
        <a href="#section7">7. AI Agent Responsibilities</a>
        <a href="#section8">8. Configuration & Environment</a>
        <a href="#section9">9. Known Errors, Warnings, and Logs</a>
        <a href="#section10">10. Rebuild Instructions</a>
        <a href="#section11">11. Non-Goals & Explicit Exclusions</a>
    </div>

    <div id="section1">
        <h1>1. Executive System Identity</h1>
        <p><strong>Application Name:</strong> Trier Fantasy Football 2026</p>
        <p><strong>Purpose:</strong> A specialized, high-fidelity fantasy football desktop dashboard designed for a specific private league ("Trier's Fantasy League"). It differs from standard platforms by focusing on "Vibe Coding" aesthetics, cinematic video integration, and a peer-to-peer decentralized syncing model.</p>
        <p><strong>Target Users:</strong> Doug Trier (Commissioner/Owner) and invited league members.</p>
        <p><strong>Success Criteria:</strong> The app is functional if:</p>
        <ul>
            <li>It launches as a desktop application via Tauri.</li>
            <li>Users can manage multiple teams locally.</li>
            <li>Rosters sync between peers via broadcast channels (Sideband).</li>
            <li><strong>Video highlights play correctly</strong> without showing blacklisted content.</li>
            <li>The UI maintains a "premium, glassy, stadium-like" aesthetic.</li>
        </ul>
    </div>

    <div id="section2">
        <h1>2. Technology Stack (Exact)</h1>
        <table>
            <tr><th>Layer</th><th>Technology</th><th>Version (approx)</th></tr>
            <tr><td><strong>Frontend</strong></td><td>React</td><td>^19.2.0</td></tr>
            <tr><td><strong>Build Tool</strong></td><td>Vite</td><td>^7.2.4</td></tr>
            <tr><td><strong>Language</strong></td><td>TypeScript</td><td>~5.9.3</td></tr>
            <tr><td><strong>Desktop Runtime</strong></td><td>Tauri</td><td>v1 (Rust Backend)</td></tr>
            <tr><td><strong>Package Manager</strong></td><td>NPM</td><td>(Project relies on package-lock.json)</td></tr>
            <tr><td><strong>Styling</strong></td><td>Vanilla CSS (App.css, index.css)</td><td>Custom Glassmorphism</td></tr>
            <tr><td><strong>Icons</strong></td><td>Lucide React</td><td>^0.563.0</td></tr>
            <tr><td><strong>Video Players</strong></td><td>react-youtube, react-twitter-embed</td><td>Standard Libs</td></tr>
            <tr><td><strong>Scraping</strong></td><td>Puppeteer</td><td>^24.36.0 (Scripts only)</td></tr>
        </table>
        
        <h3>Hosting Assumptions</h3>
        <p>The application is designed to run <strong>locally</strong> as a compiled executable (<code>.exe</code> on Windows). There is NO central backend server. All persistence is <code>localStorage</code> or local file system via Tauri.</p>
    </div>

    <div id="section3">
        <h1>3. Application Architecture</h1>
        <h3>High-Level Diagram</h3>
        <p><code>[User] <-> [React Frontend (Vite)] <-> [Local Storage]</code></p>
        <p><code>[React Frontend] <-> [Tauri Rust Core] <-> [OS (Window/FS)]</code></p>
        <p><code>[Peer A] <-> [BroadcastChannel (Sideband)] <-> [Peer B] (Local Network/Browser Context)</code></p>

        <h3>Module Boundaries</h3>
        <ul>
            <li><strong>Views (Components):</strong> Handle UI rendering (e.g., <code>Roster.tsx</code>, <code>LeagueTable.tsx</code>).</li>
            <li><strong>Services (Logic):</strong> specific business logic domains (e.g., <code>VideoPipelineService.ts</code>).</li>
            <li><strong>Utils (Helpers):</strong> Stateless functions (scrapers, scoring engines).</li>
            <li><strong>Data (Static):</strong> JSON files embedded at build time (Mock DB).</li>
        </ul>

        <h3>Critical Control Flow: Syncing</h3>
        <p>The <code>SyncService</code> (Sideband) uses the <code>BroadcastChannel</code> API to communicate between tabs or windows on the same machine. It does NOT sync over the internet to a cloud DB. It is a "Lobby" style sync.</p>
    </div>

    <div id="section4">
        <h1>4. File & Folder Structure</h1>
        <pre>
g:\\Vibe Coding\\TrierFantasy\\
├── src\\
│   ├── components\\      # React UI Components (Views & Widgets)
│   ├── data\\            # JSON Data (Rosters, Stats, Mock DB)
│   ├── services\\        # Business Logic (Video, Validation)
│   ├── utils\\           # Helpers (Scraper, Sync, Math)
│   ├── App.tsx         # Main Controller & State Container
│   └── main.tsx        # Entry Point
├── src-tauri\\           # Rust Backend Configuration
│   ├── tauri.conf.json # Critical Window/Build Config
│   └── src\\             # Rust Source Code
├── scripts\\             # Node.js Ingestion Scripts
│   ├── ingest_roster.js
│   ├── scrape_data.js
│   └── generate_pdf_report.js
├── vite.config.ts      # Build Config (Port 1420)
└── package.json        # Dependencies
        </pre>
        <h3>Critical Files</h3>
        <ul>
            <li><code>src/App.tsx</code>: Contains the "God Object" state management (userTeams, activeTeamId).</li>
            <li><code>src/data/mockDB.ts</code>: The central data repository that merges static JSONs.</li>
            <li><code>src/services/VideoPipelineService.ts</code>: The brain of the video system.</li>
        </ul>
    </div>

    <div id="section5">
        <h1>5. Core Features (Deep Dive)</h1>
        
        <h3>A. Multi-Team Management</h3>
        <p><strong>Trigger:</strong> User clicks "Create Team" or selects from dropdown.</p>
        <p><strong>Data:</strong> Stored in <code>localStorage.getItem('trier_fantasy_all_teams_v3')</code>.</p>
        <p><strong>Logic:</strong> <code>activeTeamId</code> determines which roster is currently ensuring manipulations (Add/Drop/Swap). Admin mode allows deleting teams.</p>

        <h3>B. Player Trading Card (Modal)</h3>
        <p><strong>Trigger:</strong> Clicking a player name anywhere.</p>
        <p><strong>Feature:</strong> Shows stats, bio, and <strong>Video Highlights</strong>.</p>
        <p><strong>Hydration:</strong> If data is missing, it triggers an on-the-fly Puppeteer scrape (via <code>scraper.ts</code> and Tauri/Node bridge) to fetch career stats and photos.</p>

        <h3>C. Trade Center</h3>
        <p><strong>Feature:</strong> Allows "Coach" to offer points for players.</p>
        <p><strong>Logic:</strong> Uses an Escrow system. Points are deducted immediately upon offer. If declined, points are refunded. If accepted, player moves teams and points transfer.</p>
    </div>

    <div id="section6">
        <h1>6. Video System (CRITICAL)</h1>
        <p class="critical">WARNING: This system determines user satisfaction. Failure here is catastrophic.</p>

        <h3>Components</h3>
        <ul>
            <li><strong>VideoPipelineService:</strong> Orchestrator. Fetches, Scores, Filters.</li>
            <li><strong>VideoValidationService:</strong> Gatekeeper. Checks liveness (200 OK) and format.</li>
            <li><strong>VideoBlacklistService:</strong> Defense. Blocks bad IDs.</li>
        </ul>

        <h3>Tier Logic (Relevance Engine)</h3>
        <p>The system searches for videos in 4 Tiers, stopping as soon as it finds 3 valid candidates:</p>
        <ol>
            <li><strong>Tier A (Score >= 15):</strong> High precision. Matches specific "Must Include" tokens.</li>
            <li><strong>Tier B (Score >= 5):</strong> Standard relevance. Matches player name + team or "highlights".</li>
            <li><strong>Tier C (Score >= 1):</strong> Loose match. Just needs to not be explicitly negative.</li>
            <li><strong>Tier D (Score >= -10):</strong> Desperation mode.</li>
        </ol>

        <h3>Validation Rules (Safe Lists & Gatekeepers)</h3>
        <ul>
            <li><strong>YouTube:</strong>
                <ul>
                    <li><strong>Check:</strong> Uses <code>oEmbed</code> endpoint via GET.</li>
                    <li><strong>404/400:</strong> BLACKLIST (Private/Deleted/Malformed).</li>
                    <li><strong>429 (Rate Limit):</strong> SOFT FAIL (Do not blacklist).</li>
                    <li><strong>401/403:</strong> SOFT FAIL.</li>
                    <li><strong>ID Check:</strong> Must be 11 chars, alphanumeric/underscore/dash.</li>
                </ul>
            </li>
            <li><strong>X (Twitter):</strong> Checks <code>publish.twitter.com/oembed</code>. 404 results in blacklisting.</li>
            <li><strong>Web:</strong> Allowlist ONLY: <code>nfl.com</code>, <code>espn.com</code>.</li>
        </ul>

        <h3>Blacklist Behavior</h3>
        <ul>
            <li><strong>Storage:</strong> <code>localStorage</code> ('trier_video_blacklist').</li>
            <li><strong>TTL:</strong> 7 Days.</li>
            <li><strong>Mechanism:</strong> Checked <em>before</em> network calls in the Pipeline to save bandwidth.</li>
        </ul>

        <h3>Known Failure Modes</h3>
        <ul>
            <li><strong>Rickrolls:</strong> Explicitly blocked by term "rick roll" in <code>RelevanceEngine.BLOCK_TERMS</code>.</li>
            <li><strong>Mock Data:</strong> The system has hardcoded bypasses for mock IDs like <code>0-7IcnZqgq0</code> (Josh Allen).</li>
        </ul>
    </div>

    <div id="section7">
        <h1>7. AI Agent Responsibilities</h1>
        <h3>Must Do:</h3>
        <ul>
            <li>Maintain the integrity of <code>VideoPipelineService.ts</code> logic regarding 429 vs 404 errors.</li>
            <li>Ensure <code>vite.config.ts</code> port matches <code>tauri.conf.json</code> (Port 1420).</li>
            <li>Respect the directory structure. Do not create files in root unless asked.</li>
        </ul>
        <h3>Must Never:</h3>
        <ul>
            <li>Assume a backend server exists.</li>
            <li>Delete <code>src/data/mockDB.ts</code> without a replacement strategy.</li>
            <li>Overwrite the "Bears DST" synthesis logic in <code>ingest_roster.js</code> without preserving the ID <code>chi-dst-defense</code>.</li>
        </ul>
    </div>

    <div id="section8">
        <h1>8. Configuration & Environment</h1>
        <ul>
            <li><strong>Vite Port:</strong> 1420 (Strict).</li>
            <li><strong>Tauri Dev Path:</strong> <code>http://localhost:1420</code>.</li>
            <li><strong>Local Storage Keys:</strong>
                <ul>
                    <li><code>trier_fantasy_all_teams_v3</code>: Main DB.</li>
                    <li><code>trier_fantasy_active_id</code>: Session.</li>
                    <li><code>trier_video_blacklist</code>: Cache.</li>
                    <li><code>trier_admin_pass</code>: Security.</li>
                </ul>
            </li>
        </ul>
    </div>

    <div id="section9">
        <h1>9. Known Errors, Warnings, and Logs</h1>
        <ul>
            <li><code>[Gatekeeper] YouTube 429 Rate Limit. Soft failing...</code>: Normal behavior. Do not "fix" by removing the check; the check is saving the system from banning valid IDs.</li>
            <li><code>[VideoPipeline] Search: {Name} (Brute Force Mode)</code>: Indicates cache miss. Normal.</li>
            <li><code>Tauri exit failed</code>: Occurs when running in browser mode outside of Tauri. Safe to ignore.</li>
        </ul>
    </div>

    <div id="section10">
        <h1>10. Rebuild Instructions (CRITICAL)</h1>
        <p><strong>To Rebuild this App from scratch:</strong></p>
        <ol>
            <li><strong>Init:</strong> Create a Vite + React + TypeScript project.</li>
            <li><strong>Tauri:</strong> Initialize Tauri with <code>npm run tauri init</code>. Set dist to <code>../dist</code> and devPath to <code>http://localhost:1420</code>.</li>
            <li><strong>Config:</strong> Update <code>vite.config.ts</code> to set <code>server.port = 1420</code> and <code>strictPort = true</code>.</li>
            <li><strong>Data Layer:</strong> Recreate <code>src/data</code> folders. Populate <code>mockDB.ts</code>.</li>
            <li><strong>Services:</strong> Implement <code>VideoPipelineService</code> BEFORE building the UI, as the UI depends on its types.</li>
            <li><strong>Components:</strong> Build <code>App.tsx</code> one feature at a time, starting with <code>Layout_Dashboard</code>.</li>
            <li><strong>Hydration:</strong> Ensure <code>useEffect</code> hooks in App are handling the 5-minute timeout and roster hydration.</li>
        </ol>
    </div>

    <div id="section11">
        <h1>11. Non-Goals & Explicit Exclusions</h1>
        <ul>
            <li><strong>Online Backend:</strong> This app does NOT sync to a cloud database (Firebase, AWS, etc.). It is strictly P2P/Local.</li>
            <li><strong>Mobile Support:</strong> This is a desktop-first design. Responsiveness is secondary to the "Stadium Vibe" on desktop.</li>
            <li><strong>Real-Time Game Scoring:</strong> While it supports "Live Stats", it retrieves them via static JSON imports or specific scrape triggers, not a websocket socket connection to NFL.com.</li>
        </ul>
    </div>
</body>
</html>
`;

async function createBackup() {
    console.log('Generating Forensic Backup PDF...');
    const browser = await puppeteer.launch({ headless: "new" });
    const page = await browser.newPage();

    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

    const outputDir = path.dirname(OUTPUT_PATH);
    if (!fs.existsSync(outputDir)) {
        try {
            fs.mkdirSync(outputDir, { recursive: true });
        } catch (e) {
            console.warn('Cannot create O: drive directory. Switching to fallback.');
        }
    }

    try {
        await page.pdf({
            path: OUTPUT_PATH,
            format: 'A4',
            printBackground: true,
            margin: { top: '20px', bottom: '20px', left: '20px', right: '20px' }
        });
        console.log(`Backup saved to: ${OUTPUT_PATH}`);
    } catch (e) {
        console.warn(`Primary save failed. Saving to fallback: ${FALLBACK_PATH}`);
        await page.pdf({
            path: FALLBACK_PATH,
            format: 'A4',
            printBackground: true
        });
        console.log(`Backup saved to: ${FALLBACK_PATH}`);
    }

    await browser.close();
}

createBackup();
