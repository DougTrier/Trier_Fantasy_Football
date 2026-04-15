/**
 * VideoBlacklistService — Persistent Bad-Video Registry
 * =======================================================
 * Tracks video IDs that have caused playback errors (e.g. 101 — video not
 * embeddable, 150 — restricted by owner). Entries expire after TTL_MS to
 * allow videos that have been fixed upstream to re-appear naturally.
 *
 * Two-layer persistence: in-memory Map for fast O(1) lookups during the
 * current session, and localStorage for survival across reloads.
 * Expired entries are pruned lazily on first access, not on startup, to
 * avoid blocking the initial render.
 */
export interface BlacklistEntry {
    videoId: string;
    timestamp: number;
    reason: string;
    errorCode?: number;
    provider: string;
}

const STORAGE_KEY = 'trier_video_blacklist';
const TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days — stale enough to catch transient issues

class VideoBlacklistService {
    private blacklist: Map<string, BlacklistEntry>;

    constructor() {
        this.blacklist = new Map();
        this.load();
    }

    /** Hydrates the in-memory map from localStorage, discarding expired entries. */
    private load() {
        if (typeof window === 'undefined') return;

        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
                const parsed: BlacklistEntry[] = JSON.parse(raw);
                const now = Date.now();

                // Only load entries still within their TTL window
                parsed.forEach(entry => {
                    if (now - entry.timestamp < TTL_MS) {
                        this.blacklist.set(entry.videoId, entry);
                    }
                });
            }
        } catch (e) {
            console.error('[VideoBlacklistService] Failed to load blacklist', e);
        }
    }

    /** Persists the current in-memory blacklist to localStorage. */
    private save() {
        if (typeof window === 'undefined') return;

        try {
            const entries = Array.from(this.blacklist.values());
            localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
        } catch (e) {
            console.error('[VideoBlacklistService] Failed to save blacklist', e);
        }
    }

    /**
     * Adds a video to the blacklist and immediately persists.
     * The UniversalPlayer calls this on non-recoverable YouTube error codes.
     */
    public add(videoId: string, reason: string, errorCode?: number, provider: string = 'youtube') {
        // Immediate Session Block
        const entry: BlacklistEntry = {
            videoId,
            timestamp: Date.now(),
            reason,
            errorCode,
            provider
        };

        this.blacklist.set(videoId, entry);
        this.save();

        console.warn(`[VideoBlacklistService] Blocked ${videoId}: ${reason} (Code: ${errorCode})`);
    }

    /**
     * Returns true if the video is currently blacklisted and within TTL.
     * Performs a lazy TTL check on each call to avoid a separate expiry sweep.
     */
    public isBlocked(videoId: string): boolean {
        // Check memory (which is synced with valid localStorage items)
        const entry = this.blacklist.get(videoId);
        if (!entry) return false;

        // Double check TTL (lazy expiry — prune stale entries on access)
        if (Date.now() - entry.timestamp > TTL_MS) {
            this.blacklist.delete(videoId);
            this.save();
            return false;
        }

        return true;
    }

    public getBlacklist(): BlacklistEntry[] {
        return Array.from(this.blacklist.values());
    }

    public clear() {
        this.blacklist.clear();
        if (typeof window !== 'undefined') {
            localStorage.removeItem(STORAGE_KEY);
        }
    }
}

export const videoBlacklist = new VideoBlacklistService();
