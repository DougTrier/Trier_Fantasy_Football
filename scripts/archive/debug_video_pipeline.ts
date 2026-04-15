
import { VideoPipelineService } from '../src/services/VideoPipelineService';

async function runDebug() {
    console.log("=== Debugging Video Pipeline (Brute Force Mode) ===\n");

    const context = {
        playerName: "Josh Allen",
        team: "Bills"
    };

    const playlist = await VideoPipelineService.fetchPlaylist(context);
    console.log(`\n[Result] Found ${playlist.length} videos:\n`);
    playlist.forEach(v => {
        console.log(` - [${v.tierFound || '?'}] [${v.provider}] ${v.title} (Score: ${v.relevanceScore})`);
    });

    console.log("\n--- Diagnostics ---");
    if (VideoPipelineService.lastDiagnostics) {
        VideoPipelineService.lastDiagnostics.forEach(d => {
            console.log(`\n[Tier ${d.tier}] Total: ${d.totalCandidates} | Final: ${d.finalCount}`);
            console.log(`  Drops: Blacklist=${d.droppedBlacklist}, LowScore=${d.droppedRelevance}, Validation=${d.droppedEmbeddable}`);

            Object.entries(d.sources).forEach(([srcId, stats]) => {
                if (stats.dropped > 0 || stats.found > 0) {
                    console.log(`    > ${srcId}: Found ${stats.found}, Dropped ${stats.dropped}`);
                    if (stats.reasons.length > 0) {
                        const topReasons = stats.reasons.slice(0, 3).join('; ');
                        console.log(`      Constraint: ${topReasons}`);
                    }
                }
            });
        });
    } else {
        console.log("No diagnostics available.");
    }

    console.log("\n=== Debug Complete ===");
}

runDebug();
