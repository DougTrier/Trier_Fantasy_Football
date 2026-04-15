
import { VideoPipelineService } from '../src/services/VideoPipelineService';
import { videoBlacklist } from '../src/services/VideoBlacklistService';
import { VideoValidationService } from '../src/services/VideoValidationService';

async function testStrictPipeline() {
    console.log("=== Testing Strict Verified Film Room ===");

    // 1. Setup Context
    const context = {
        playerName: "Josh Allen",
        team: "Bills"
    };

    // 2. Run Pipeline
    console.log(`\n[Action] Fetching playlist for ${context.playerName}...`);
    const playlist = await VideoPipelineService.fetchPlaylist(context);

    // 3. Inspection
    console.log(`\n[Result] Found ${playlist.length} verified videos:`);
    playlist.forEach(v => {
        console.log(` - [${v.provider.toUpperCase()}] ${v.title} (Score: ${v.relevanceScore})`);
    });

    // 4. Verification Assertions
    const hasOfficial = playlist.some(v => v.id === '0-7IcnZqgq0');
    const hasRickRoll = playlist.some(v => v.id === 'dQw4w9WgXcQ');
    const hasX = playlist.some(v => v.provider === 'x');

    if (hasOfficial) console.log("✅ Official YouTube content found.");
    else console.error("❌ Failed to find official content.");

    if (!hasRickRoll) console.log("✅ Rick Roll correctly BLOCKED by Relevance Engine.");
    else console.error("❌ Rick Roll slipped through!");

    if (hasX) console.log("✅ X (Twitter) content found and verified.");
    else console.error("⚠️ No X content found (Check Mock Runner priority or enable it).");

    // 5. Test Blacklist Integration (Strict Mode)
    console.log("\n[Test] Simulating runtime failure for top video...");
    if (playlist.length > 0) {
        const topVideo = playlist[0];
        console.log(`Blocking ${topVideo.id}...`);
        videoBlacklist.add(topVideo.id, "Runtime Error", 150);

        const playlist2 = await VideoPipelineService.fetchPlaylist(context);
        const exists = playlist2.some(v => v.id === topVideo.id);

        if (!exists) console.log("✅ Blacklisted video excluded from subsequent fetch.");
        else console.error("❌ Blacklisted video reappeared!");
    }

    console.log("\n=== strict_pipeline Test Complete ===");
}

testStrictPipeline();
