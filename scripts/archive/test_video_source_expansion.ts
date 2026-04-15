
import { VideoPipelineService, normalizePlatform } from '../src/services/VideoPipelineService';
import { RelevanceEngine } from '../src/services/VideoPipelineService';

async function testExpansionAndNormalization() {
    console.log("=== Testing Phase 6: Reliability & Expansion ===\n");

    // 1. Test Normalization
    console.log("[Test 1] Platform Normalization");
    const p1 = normalizePlatform('Twitter');
    const p2 = normalizePlatform('x');
    const p3 = normalizePlatform('YT');

    if (p1 === 'x' && p2 === 'x' && p3 === 'youtube') {
        console.log("✅ Platform normalization works.");
    } else {
        console.error("❌ Normalization failed:", { p1, p2, p3 });
    }

    // 2. Test Token Expansion (Integration)
    console.log("\n[Test 2] Token Expansion & Pipeline");
    // We expect the pipeline to search 'from:NFL' and return the mocked X result
    const context = { playerName: "Josh Allen", team: "Bills" };
    const playlist = await VideoPipelineService.fetchPlaylist(context);

    console.log(`\nFound ${playlist.length} videos.`);
    playlist.forEach(v => console.log(` - [${v.provider}] ${v.title} (Score: ${v.relevanceScore})`));

    const hasX = playlist.some(v => v.provider === 'x' && v.title.includes('TD Pass'));
    if (hasX) console.log("✅ Expanded X (Twitter) query returned valid result.");
    else console.error("❌ Failed to find expanded X result.");

    // 3. Test Rick Roll Global Block
    console.log("\n[Test 3] Global Rick Roll Block");
    // Mock a candidate that has the forbidden text
    const badCandidate = {
        id: 'bad_rick',
        provider: 'youtube' as const,
        url: '...',
        title: 'Super Cool Highlight (Rick Roll)',
        relevanceScore: 0,
        embeddable: true
    };

    const score = RelevanceEngine.calculateScore(badCandidate, { playerName: 'Josh Allen' });
    if (score === -100) {
        console.log("✅ Rick Roll blocked by Global Safety Net (Score -100).");
    } else {
        console.error(`❌ Rick Roll NOT blocked! Score: ${score}`);
    }

    console.log("\n=== Phase 6 Test Complete ===");
}

testExpansionAndNormalization();
