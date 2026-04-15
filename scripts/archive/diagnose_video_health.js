import puppeteer from 'puppeteer';
import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// CONFIG
const APP_URL = 'http://localhost:5173/'; // Assumes dev server is running
const MCP_CLI_PATH = path.resolve(__dirname, '../../mcp-chatgpt-consult/cli_consult.js');
const REPORT_PATH = path.resolve(__dirname, '../video_health_report.md');

console.log("Starting Video Health Diagnosis...");
console.log(`Target: ${APP_URL}`);

(async () => {
    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();

    let errorDetected = false;
    let diagnosisPending = false;

    // Monitor Console for Video Errors
    page.on('console', async (msg) => {
        if (msg.type() === 'error') {
            const text = msg.text();

            // Check for our structured log
            try {
                // Heuristic: Is it JSON?
                if (text.startsWith('{') && text.includes('YouTubeAdapter')) {
                    const data = JSON.parse(text);
                    if (data.context === 'YouTubeAdapter' && data.event === 'onError') {

                        // DEBOUNCE / SINGLE DIAGNOSIS
                        if (diagnosisPending) return;
                        diagnosisPending = true;
                        errorDetected = true;

                        console.log("\n[!] Video Error Detected:", data);
                        await handleVideoError(data, page.url());
                    }
                }
            } catch (e) {
                // Not our JSON log, ignore
            }
        }
    });

    try {
        await page.goto(APP_URL, { waitUntil: 'networkidle0', timeout: 15000 });
        console.log("Page loaded. Waiting for video events...");

        // Wait a few seconds for any autoplay/load errors
        await new Promise(r => setTimeout(r, 5000));

    } catch (e) {
        console.error("Failed to load page or timeout:", e.message);
    }

    if (!errorDetected) {
        console.log("\nNo video errors detected during scan.");
    }

    await browser.close();
})();

async function handleVideoError(errorData, pageUrl) {
    console.log("[*] Consulting ChatGPT via MCP...");

    const payload = {
        title: `Embedded Video Failure: YouTube ${errorData.errorCode}`,
        problem: `User selected video ${errorData.videoId} from dropdown. Player must load paused and play on click, but fails with ${errorData.errorCode}. Need fix + verification logic so broken videos are never added.`,
        context: `
Provider: YouTube
Video: https://www.youtube.com/watch?v=${errorData.videoId} | ID: ${errorData.videoId}
Embed URL used: ${errorData.embedUrl || 'N/A'}
Library: ${errorData.library || 'react-youtube'}
Where triggered: ${pageUrl}
Expected behavior: loads paused -> plays on click -> ends -> returns to static ready state
Observed behavior: Video infrastructure reported fatal error ${errorData.errorCode}
Console errors:
${JSON.stringify(errorData, null, 2)}
Network errors:
(See logs/timestamp)
Relevant code:
YouTubeAdapter.tsx (via react-youtube wrapper)
Verification pipeline result:
Unknown (Runtime Failure)
`,
        logs: JSON.stringify(errorData)
    };

    return new Promise((resolve) => {
        const command = `node "${MCP_CLI_PATH}"`;

        const child = exec(command, (error, stdout, stderr) => {
            if (error) {
                console.error(`[!] MCP Call Failed: ${error.message}`);
                console.error("Stderr:", stderr);
                resolve();
                return;
            }

            try {
                const response = JSON.parse(stdout);
                console.log("[+] Diagnosis Received.");

                // Parse inner content if needed (mcp sdk commonly wraps it)
                const content = response.content?.[0]?.text || JSON.stringify(response); // Fallback

                const report = `
# Video Health Diagnosis
**Timestamp:** ${new Date().toISOString()}
**Error Code:** ${errorData.errorCode}
**Video ID:** ${errorData.videoId}

## ChatGPT Diagnosis
${content}
`;
                fs.writeFileSync(REPORT_PATH, report);
                console.log(`[+] Report saved to ${REPORT_PATH}`);

            } catch (e) {
                console.error("Failed to parse MCP response:", e);
                console.log("Raw Output:", stdout);
            }
            resolve();
        });

        // Write payload to stdin
        child.stdin.write(JSON.stringify(payload));
        child.stdin.end();
    });
}
