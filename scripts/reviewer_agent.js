
import fs from 'fs';
import https from 'https';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const API_KEY = process.env.OPENAI_API_KEY;

if (!API_KEY) {
    console.error("ERROR: OPENAI_API_KEY environment variable is not set.");
    console.error("Please set it to run the Reviewer Agent.");
    process.exit(1);
}

const targetFile = process.argv[2];
if (!targetFile) {
    console.error("Usage: node reviewer_agent.js <path_to_doc>");
    process.exit(1);
}

const fullPath = path.resolve(targetFile);
if (!fs.existsSync(fullPath)) {
    console.error(`File not found: ${fullPath}`);
    process.exit(1);
}

const content = fs.readFileSync(fullPath, 'utf8');
const filename = path.basename(fullPath);

const SYSTEM_PROMPT = `
You are a Senior Software Architect and Security Reviewer specialized in Local-First functionality, P2P networking, and Rust/Tauri applications.
Your job is to CRITIQUE the provided architecture document or audit report.

OUTPUT FORMAT:
1. **Verdict**: [APPROVE | REQUEST CHANGES]
2. **Summary**: Brief assessment.
3. **Critical Risks**: List any security or stability risks.
4. **Missing Information**: What specific details are absent?
5. **Checklist**: List of required actions before approval (if Verdict is REQUEST CHANGES).

CRITERIA:
- Security: No hardcoded secrets. Correct crypto. Least privilege.
- Feasibility: Does it work with Tauri v1? Windows Firewall?
- Completeness: Are all edge cases (NAT, Offline, Conflict) handled?
- Architecture: clean separation of concerns.

Be strict but constructive.
`;

const USER_PROMPT = `Please review the following document: ${filename}\n\nCONTENT:\n${content}`;

const payload = JSON.stringify({
    model: "gpt-4o",
    messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: USER_PROMPT }
    ],
    temperature: 0.2
});

const options = {
    hostname: 'api.openai.com',
    path: '/v1/chat/completions',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Length': payload.length
    }
};

console.log(`[Reviewer] Analyzing ${filename}...`);

const req = https.request(options, (res) => {
    let data = '';

    res.on('data', (chunk) => {
        data += chunk;
    });

    res.on('end', () => {
        if (res.statusCode !== 200) {
            console.error(`API Request Failed: ${res.statusCode} ${res.statusMessage}`);
            console.error(data);
            process.exit(1);
        }

        try {
            const json = JSON.parse(data);
            const review = json.choices[0].message.content;

            console.log("\n--- REVIEWER OUTPUT ---\n");
            console.log(review);
            console.log("\n-----------------------\n");

            // Save to reviews directory
            const reviewsDir = path.join(path.dirname(path.dirname(fullPath)), 'reviews');
            if (!fs.existsSync(reviewsDir)) {
                fs.mkdirSync(reviewsDir, { recursive: true });
            }

            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const reviewFile = path.join(reviewsDir, `${filename}_review_${timestamp}.md`);

            fs.writeFileSync(reviewFile, review);
            console.log(`Review saved to: ${reviewFile}`);

        } catch (e) {
            console.error("Failed to parse response:", e);
        }
    });
});

req.on('error', (e) => {
    console.error("Request Error:", e);
});

req.write(payload);
req.end();
