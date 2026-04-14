import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { fileURLToPath } from 'url';
import https from 'https';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MCP_CLI_PATH = path.resolve(__dirname, '../../mcp-chatgpt-consult/cli_consult.js');
const OUTPUT_FILE = path.resolve(__dirname, '../src/data/verified_videos.json');

// Known IDs to verify (in a real app, this might come from a DB or scrape)
const CANDIDATE_IDS = [
    'M7lc1UVf-VE', // Test (Safe)
    '0-7IcnZqgq0', // Josh Allen
    '7JqXPj2l2mQ', // Bills vs Chiefs
    'm9L2eY1v1Jc', // Defense
    'qR2w1E5t8Y0', // Pass Rush
    'dQw4w9WgXcQ', // Rick Roll (Known Safe)
    'INVALID_ID_TEST' // Should Fail
];

async function checkOEmbed(videoId) {
    return new Promise((resolve) => {
        const url = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
        https.get(url, (res) => {
            if (res.statusCode === 200) {
                resolve({ embeddable: true, status: 200 });
            } else {
                resolve({ embeddable: false, status: res.statusCode });
            }
        }).on('error', (e) => {
            resolve({ embeddable: false, error: e.message });
        });
    });
}

async function consultChatGPT(videoId, contextData) {
    console.log(`[*] Ambiguity detected for ${videoId}. Consulting ChatGPT...`);

    const payload = {
        title: `Embedded Video Failure: YouTube Verification`,
        problem: `User selected video ${videoId} from dropdown. Player must load paused and play on click, but fails with verification error. Need fix + verification logic so broken videos are never added.`,
        context: `
Provider: YouTube
Video: https://www.youtube.com/watch?v=${videoId} | ID: ${videoId}
Embed URL used: https://www.youtube.com/embed/${videoId}
Library: N/A (Verification Phase)
Where triggered: verify_sources.js (Batch Pipeline)
Expected behavior: oEmbed check returns 200 OK
Observed behavior: oEmbed check returned ${contextData.status} (${contextData.error || 'N/A'})
Console errors:
N/A
Network errors:
oEmbed Status: ${contextData.status}
Relevant code:
VideoValidationService.ts (Gatekeeper)
Verification pipeline result:
FAILED: oEmbed check failed
`,
        logs: JSON.stringify(contextData)
    };

    return new Promise((resolve) => {
        const command = `node "${MCP_CLI_PATH}"`;
        const child = exec(command, (error, stdout, stderr) => {
            if (error) {
                console.error(`[!] MCP Call Failed: ${error.message}`);
                resolve("UNKNOWN"); // Fail safe
                return;
            }
            try {
                const response = JSON.parse(stdout);
                // Simple heuristic: Does GPT think it's likely fixable or just dead?
                // For verification, we just want to know if we should blacklist it.
                // We'll treat ChatGPT's response as a log but default to UNSAFE if oEmbed failed.
                resolve(response);
            } catch (e) {
                resolve("MCP_PARSE_ERROR");
            }
        });

        child.stdin.write(JSON.stringify(payload));
        child.stdin.end();
    });
}

(async () => {
    console.log("Starting Batch Video Verification...");
    const results = {
        safe: [],
        unsafe: [],
        timestamp: new Date().toISOString()
    };

    for (const id of CANDIDATE_IDS) {
        process.stdout.write(`Checking ${id}... `);
        const check = await checkOEmbed(id);

        if (check.embeddable) {
            console.log("✅ SAFE");
            results.safe.push(id);
        } else {
            console.log("❌ FAILED/AMBIGUOUS");
            // MANDATORY CONSULT
            const advice = await consultChatGPT(id, check);
            console.log("   -> ChatGPT consulted.");

            results.unsafe.push({
                id,
                reason: `oEmbed Status ${check.status}`,
                advice: advice
            });
        }
    }

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2));
    console.log(`\nVerification Complete. Saved to ${OUTPUT_FILE}`);
    console.log(`Safe: ${results.safe.length}, Unsafe: ${results.unsafe.length}`);
})();
