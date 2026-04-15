import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_FILE = path.resolve(__dirname, '../src/data/verified_videos.json');

console.log("Testing Gatekeeper Logic...");

if (!fs.existsSync(DATA_FILE)) {
    console.error("❌ verified_videos.json missing!");
    process.exit(1);
}

const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
const safeList = new Set(data.safe);
const unsafeList = data.unsafe;

let passed = true;

// 1. Verify Unsafe IDs are blocked
console.log("\n[Check 1] Verify strict blocking of unsafe IDs:");
unsafeList.forEach(item => {
    if (safeList.has(item.id)) {
        console.error(`❌ CRITICAL FAILURE: ID ${item.id} is in both SAFE and UNSAFE lists!`);
        passed = false;
    } else {
        console.log(`✅ correctly blocked ${item.id} (${item.reason})`);
    }
});

// 2. Mock Service Logic
console.log("\n[Check 2] Simulating VideoValidationService.getVerifiedPlaylist:");
const candidates = [
    { id: 'M7lc1UVf-VE', title: 'Good Video' }, // Safe
    { id: 'INVALID_ID_TEST', title: 'Bad Video' }, // Unsafe
    { id: 'NEW_UNKNOWN_ID', title: 'Unknown Video' } // Unknown (Should be dropped)
];

const processed = candidates.filter(c => safeList.has(c.id));

if (processed.find(p => p.id === 'INVALID_ID_TEST')) {
    console.error("❌ Gatekeeper LEAKED invalid video!");
    passed = false;
}
if (processed.find(p => p.id === 'NEW_UNKNOWN_ID')) {
    console.error("❌ Gatekeeper LEAKED unknown video!");
    passed = false;
}
if (!processed.find(p => p.id === 'M7lc1UVf-VE')) {
    console.error("❌ Gatekeeper BLOCKED valid video!");
    passed = false;
}

if (passed) {
    console.log("\n✅ Gatekeeper Logic PASSED. Only pre-verified SAFE videos are allowed.");
} else {
    console.error("\n❌ Gatekeeper Logic FAILED.");
    process.exit(1);
}
