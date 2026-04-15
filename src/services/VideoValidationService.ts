import { videoBlacklist } from './VideoBlacklistService';
import { type VideoCandidate } from './VideoPipelineService';

export const VideoValidationService = {

    /**
     * Relaxed Guard: Validates a candidate primarily by format and blacklist status.
     * NETWORK CHECKS REMOVED to avoid CORS/Opacity false positives.
     */
    async validate(candidate: VideoCandidate): Promise<boolean> {
        // 1. BLACKLIST CHECK (Runtime failures are stored here)
        if (videoBlacklist.isBlocked(candidate.id)) {
            console.warn(`[Gatekeeper] REJECT: ${candidate.id} is blacklisted.`);
            return false;
        }

        // 2. Format / Domain Check (Client-side only)
        let passed = false;
        try {
            switch (candidate.provider) {
                case 'youtube':
                    passed = this.verifyYouTube(candidate);
                    break;
                case 'x':
                    passed = this.verifyX(candidate);
                    break;
                case 'web':
                    passed = this.verifyWeb(candidate);
                    break;
                default:
                    console.warn(`[Gatekeeper] REJECT: Unknown provider ${candidate.provider}`);
                    passed = false;
            }
        } catch (error) {
            console.error(`[Gatekeeper] ERROR verifying ${candidate.id}:`, error);
            passed = false;
        }

        return passed;
    },

    /**
     * Verifies YouTube ID format ONLY.
     * No network calls.
     */
    verifyYouTube(candidate: VideoCandidate): boolean {
        const id = candidate.id;

        // 1. Format Check: 11 chars, alphanumeric + _ or -
        if (!/^[a-zA-Z0-9_-]{11}$/.test(id)) {
            console.warn(`[Gatekeeper] Invalid YouTube ID Invalid Format: ${id}`);
            // This is a definitive formatting error, effectively "malformed data", safe to blacklist locally.
            videoBlacklist.add(id, 'Invalid Format (Regex)', 400);
            return false;
        }

        return true;
    },

    /**
     * Verifies X (Twitter) URL structure ONLY.
     * No network calls.
     */
    verifyX(candidate: VideoCandidate): boolean {
        // Mock Bypass
        if (candidate.id.startsWith('x_')) return true;

        if (!candidate.url) return false;

        try {
            const url = new URL(candidate.url);
            // Must be x.com or twitter.com
            const validDomains = ['x.com', 'www.x.com', 'twitter.com', 'www.twitter.com'];
            if (!validDomains.includes(url.hostname)) {
                return false;
            }
            return true;
        } catch {
            return false;
        }
    },

    /**
     * Verifies generic Web sources against allowlisted domains.
     */
    verifyWeb(candidate: VideoCandidate): boolean {
        if (!candidate.url) return false;

        try {
            const domain = new URL(candidate.url).hostname;
            const ALLOWED_DOMAINS = ['nfl.com', 'www.nfl.com', 'espn.com', 'www.espn.com'];

            if (!ALLOWED_DOMAINS.some(d => domain.endsWith(d))) {
                console.warn(`[Gatekeeper] Domain not allowed: ${domain}`);
                return false;
            }
            return true;
        } catch {
            return false;
        }
    }
};
