// MOCK: VideoBlacklistService
class VideoBlacklistService {
    constructor() {
        this.blacklist = new Map();
    }

    add(videoId, reason, errorCode) {
        console.log(`[Blacklist] ADDING ${videoId} (Reason: ${reason})`);
        this.blacklist.set(videoId, { timestamp: Date.now() });
    }

    isBlocked(videoId) {
        const blocked = this.blacklist.has(videoId);
        if (blocked) console.log(`[Blacklist] BLOCKED check for ${videoId} -> TRUE`);
        return blocked;
    }
}

const blacklist = new VideoBlacklistService();

// MOCK: Validation Service with "Expand & Shuffle"
function getPlaylist(candidates) {
    console.log(`\n[Playlist] Generating... (Candidates: ${candidates.join(', ')})`);

    // 1. Filter
    const valid = candidates.filter(id => !blacklist.isBlocked(id));
    console.log(`[Playlist] Filtered list: ${valid.join(', ')}`);

    // 2. Shuffle (Mock: just reverse for var)
    // valid.reverse();

    if (valid.length === 0) {
        console.log("[Playlist] EMPTY! (All candidates blacklisted)");
        return [];
    }

    // Pick first
    return valid;
}

// SIMULATION
console.log("=== STARTING BLACKLIST SIMULATION ===");

const allVideos = ['vid1', 'vid2', 'vid3', 'good_vid'];
let currentPlaylist = getPlaylist(allVideos);

// Loop until success
for (let i = 0; i < 10; i++) {
    if (currentPlaylist.length === 0) {
        console.log("!!! SYSTEM HALTED: No videos left.");
        break;
    }

    const currentVid = currentPlaylist[0]; // Active video
    console.log(`\n--- Attempt ${i + 1}: Playing ${currentVid} ---`);

    if (currentVid === 'good_vid') {
        console.log("✅ Video playing successfully! Loop ends.");
        break;
    } else {
        console.log("❌ Video Failed (Error 150)!");
        // Logic from ScoutingReportModal:
        blacklist.add(currentVid, "Simulated Error", 150);

        // Re-fetch playlist (conceptually what happens on next selection/render)
        // OR in auto-advance, we just increment index.
        // But if we re-evaluate the playlist (e.g. user closes/opens or we filter live):
        currentPlaylist = getPlaylist(allVideos);
    }
}

console.log("\n=== SIMULATION COMPLETE ===");
