
import { VideoPipelineService, RelevanceEngine } from '../src/services/VideoPipelineService';
import { videoBlacklist } from '../src/services/VideoBlacklistService';

// Polyfill for fetch if needed (Node env) or just rely on MockProvider not using fetch
// The MockProvider uses setTimeout, so we need to await result.

async function testPipeline() {
    console.log("=== Testing VideoPipelineService ===");

    // 1. Setup Context
    const playerContext = {
        playerName: "Josh Allen",
        team: "Bills"
    };

    console.log(`\n[Test 1] Searching for: ${playerContext.playerName}`);
    const results = await VideoPipelineService.fetchPlaylist(playerContext);

    console.log(`\n[Result] Found ${results.length} valid candidates:`);
    results.forEach(r => {
        console.log(` - [${r.relevanceScore}] ${r.title} (${r.id})`);
    });

    // ASSERTIONS
    const hasRickRoll = results.some(r => r.id === 'dQw4w9WgXcQ');
    const hasUnembeddable = results.some(r => r.id === 'M7lc1UVf-VE'); // Simulating VideoPipeline drops unembeddable
    const hasValid = results.some(r => r.id === '0-7IcnZqgq0');

    if (hasRickRoll) {
        console.error("\n[FAIL] Rick Roll was NOT filtered out!");
    } else {
        console.log("\n[PASS] Rick Roll correctly filtered.");
    }

    if (hasUnembeddable) {
        console.error("[FAIL] Unembeddable video was NOT filtered out!");
    } else {
        console.log("[PASS] Unembeddable video filtered (via mock logic).");
    }

    if (hasValid) {
        console.log("[PASS] Valid highlight found.");
    } else {
        console.error("[FAIL] Valid highlight missing!");
    }

    // TEST BLACKLIST
    console.log("\n[Test 2] Testing Blacklist Integration...");
    const targetId = results[0].id;
    console.log(`Blacklisting top result: ${targetId}`);
    videoBlacklist.add(targetId, "Test Block", 400);

    const results2 = await VideoPipelineService.fetchPlaylist(playerContext);
    const isBlocked = !results2.some(r => r.id === targetId);

    if (isBlocked) {
        console.log("[PASS] Blacklisted video was correctly excluded from second search.");
    } else {
        console.error(`[FAIL] Video ${targetId} still appeared in search results!`);
    }

    console.log("\n=== Test Complete ===");
}

testPipeline();
