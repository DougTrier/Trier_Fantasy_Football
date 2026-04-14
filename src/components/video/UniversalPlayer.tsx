import React, { memo, useEffect, useState } from 'react';
import type { VideoProviderType } from '../../services/VideoPipelineService';
import type { PlayerState } from './VideoAdapter';
import { YouTubeAdapter } from './adapters/YouTubeAdapter';

// ==========================================
// TYPES
// ==========================================
export interface UniversalPlayerProps {
    videoId: string;
    provider: VideoProviderType;
    url?: string; // Optional URL for providers that need it (X/Twitter)
    title?: string;
    onStateChange?: (state: PlayerState) => void;
    style?: React.CSSProperties;
}

// ==========================================
// FALLBACK UI
// ==========================================
const PlayerMessage: React.FC<{ icon: string, title: string, subtitle?: string, color?: string }> = ({
    icon, title, subtitle, color = '#9ca3af'
}) => (
    <div style={{
        width: '100%', height: '100%',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        background: '#000', color: color,
        textAlign: 'center', padding: '1rem',
        fontFamily: "'Orbitron', sans-serif"
    }}>
        <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>{icon}</div>
        <div style={{ fontWeight: 700, textTransform: 'uppercase', fontSize: '0.9rem' }}>
            {title}
        </div>
        {subtitle && (
            <div style={{ fontSize: '0.75rem', marginTop: '0.5rem', opacity: 0.7, fontFamily: 'sans-serif' }}>
                {subtitle}
            </div>
        )}
    </div>
);

// Helpers
const extractTweetId = (url: string | undefined, id: string): string => {
    if (!url) return id;
    const match = url.match(/status\/(\d+)/);
    return match ? match[1] : id;
};

// ==========================================
// MAIN COMPONENT
// ==========================================
export const UniversalPlayer: React.FC<UniversalPlayerProps> = memo(({
    videoId,
    provider,
    url,
    title = '', // Default to empty string
    onStateChange,
    style
}) => {
    const [state, setState] = useState<PlayerState>('idle');

    // Notify parent
    useEffect(() => {
        onStateChange?.(state);
    }, [state, onStateChange]);

    // Reset when video changes
    useEffect(() => {
        setState('loading');
    }, [videoId, provider]);

    // ---------------- HANDLERS ----------------
    // Bridge local state to parent callback
    const handleStateChange = (newState: PlayerState) => {
        setState(newState);
    };

    // X/Twitter Timeout Handler
    useEffect(() => {
        if (provider === 'x' && state === 'loading') {
            const timer = setTimeout(() => {
                // If still loading after 8 seconds, assume failed/blocked
                console.warn('[UniversalPlayer] Twitter load timeout. Marking unavailable.');
                setState('unavailable');
            }, 8000);
            return () => clearTimeout(timer);
        }
    }, [provider, state]);

    // ---------------- RENDER ----------------
    return (
        <div title={title} style={style || { width: '100%', height: '100%', position: 'relative', overflow: 'hidden', borderRadius: '8px', background: '#000' }}>

            {/* ACTIVE PLAYER: ADAPTER PATTERN */}

            {provider === 'youtube' ? (
                <div style={{ width: '100%', height: '100%', display: state === 'unavailable' ? 'none' : 'block' }}>
                    <YouTubeAdapter
                        videoId={videoId}
                        onStateChange={handleStateChange}
                    />
                </div>
            ) : provider === 'x' ? (
                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000', overflowY: 'auto' }}>
                    {/* Lazy load Twitter only if needed */}
                    {state !== 'unavailable' && (
                        React.createElement(
                            React.lazy(() => import('react-twitter-embed').then(module => ({ default: module.TwitterTweetEmbed }))),
                            {
                                tweetId: extractTweetId(url, videoId),
                                options: { theme: 'dark', cards: 'hidden', conversation: 'none' },
                                onLoad: () => handleStateChange('ready')
                            }
                        )
                    )}
                </div>
            ) : (
                // Unsupported Provider Fallback
                <PlayerMessage
                    icon="🚫"
                    title="UNSUPPORTED SOURCE"
                    subtitle={`Provider '${provider}' is not currently supported.`}
                />
            )}

            {/* LOADING STATE */}
            {state === 'loading' && (
                <div style={{ position: 'absolute', inset: 0, zIndex: 10 }}>
                    <PlayerMessage icon="⏳" title="LOADING PREVIEW..." />
                </div>
            )}

            {/* ERROR STATE (Covering the adapter) */}
            {state === 'unavailable' && (
                <div style={{ position: 'absolute', inset: 0, zIndex: 20 }}>
                    <PlayerMessage
                        icon="⚠️"
                        title="VIDEO UNAVAILABLE"
                        subtitle="This video cannot be played. It may be restricted or removed."
                        color="#fca5a5"
                    />
                    <div style={{ marginTop: '1rem', textAlign: 'center' }}>
                        <button
                            onClick={() => {
                                const targetUrl = url || (provider === 'youtube' ? `https://www.youtube.com/watch?v=${videoId}` : '#');
                                window.open(targetUrl, '_blank');
                            }}
                            style={{
                                background: 'transparent',
                                border: '1px solid #fff',
                                color: '#fff',
                                padding: '5px 10px',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '0.8rem'
                            }}
                        >
                            Open in Browser
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
});
