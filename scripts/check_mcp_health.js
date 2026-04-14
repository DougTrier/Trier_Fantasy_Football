
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const REQUIRED_SERVER_PATH = path.resolve(__dirname, '../../mcp-chatgpt-consult/cli_consult.js');

console.log("=== MCP Health Check ===");

// 1. Check API Key
if (!process.env.OPENAI_API_KEY) {
    console.error("❌ ERROR: OPENAI_API_KEY is not set.");
    console.error("   Remediation: Set OPENAI_API_KEY in your environment variables or .env file.");
    process.exit(1);
} else {
    console.log("✅ OPENAI_API_KEY found.");
}

// 2. Check Server Script
if (!fs.existsSync(REQUIRED_SERVER_PATH)) {
    console.error(`❌ ERROR: MCP Server script not found at: ${REQUIRED_SERVER_PATH}`);
    console.error("   Remediation: Clone or restore the 'mcp-chatgpt-consult' repository to the parent directory.");
    process.exit(1);
} else {
    console.log("✅ MCP Server script found.");
}

console.log("=== Health Check Passed ===");
process.exit(0);
