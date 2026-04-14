export interface BlacklistEntry {
    videoId: string;
    timestamp: number;
    reason: string;
    errorCode?: number;
    provider: string;
}

const STORAGE_KEY = 'trier_video_blacklist';
const TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 Days

class VideoBlacklistService {
    private blacklist: Map<string, BlacklistEntry>;

    constructor() {
        this.blacklist = new Map();
        this.load();
    }

    private load() {
        if (typeof window === 'undefined') return;

        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
                const parsed: BlacklistEntry[] = JSON.parse(raw);
                const now = Date.now();

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

    private save() {
        if (typeof window === 'undefined') return;

        try {
            const entries = Array.from(this.blacklist.values());
            localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
        } catch (e) {
            console.error('[VideoBlacklistService] Failed to save blacklist', e);
        }
    }

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

    public isBlocked(videoId: string): boolean {
        // Check memory (which is synced with valid localStorage items)
        const entry = this.blacklist.get(videoId);
        if (!entry) return false;

        // Double check TTL (lazy expiry)
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
