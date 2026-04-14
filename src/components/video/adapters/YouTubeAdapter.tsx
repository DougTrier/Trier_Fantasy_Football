import React, { memo, useCallback, useEffect } from 'react';
import YouTube, { type YouTubeEvent } from 'react-youtube';
import type { VideoAdapterProps } from '../VideoAdapter';

/**
 * YouTube-specific implementation using the official IFrame API wrapper.
 * Handles extensive error mapping (150 -> unavailable).
 */
export const YouTubeAdapter: React.FC<VideoAdapterProps> = memo(({
    videoId,
    onStateChange,
    style
}) => {
    // Reset when videoId changes
    useEffect(() => {
        onStateChange('loading');
    }, [videoId, onStateChange]);

    const onPlayerReady = useCallback(() => {
        onStateChange('ready');
    }, [onStateChange]);

    const onPlayerStateChange = useCallback((event: YouTubeEvent) => {
        // YT: -1 (unstarted), 0 (ended), 1 (playing), 2 (paused), 3 (buffering), 5 (cued)
        const status = event.data;
        switch (status) {
            case 0: onStateChange('ended'); break;
            case 1: onStateChange('playing'); break;
            case 2: onStateChange('ready'); break; // Paused = Ready
            case 3: onStateChange('loading'); break;
            case 5: onStateChange('ready'); break;
        }
    }, [onStateChange]);

    const onPlayerError = useCallback((event: YouTubeEvent) => {
        const code = event.data;
        // STRUCTURED LOG FOR AGENT/PUPPETEER INTERCEPTION
        console.error(JSON.stringify({
            context: 'YouTubeAdapter',
            event: 'onError',
            videoId,
            embedUrl: `https://www.youtube.com/embed/${videoId}`,
            library: 'react-youtube',
            errorCode: code,
            timestamp: new Date().toISOString()
        }));

        console.warn(`[YouTubeAdapter] Error ${code}: Video ${videoId}`);
        // 100 = Not Found, 101/150 = Embed Blocked
        onStateChange('unavailable');
    }, [onStateChange, videoId]);

    const opts = {
        height: '100%',
        width: '100%',
        playerVars: {
            autoplay: 0,
            controls: 1,
            modestbranding: 1,
            rel: 0,
            origin: typeof window !== 'undefined' ? window.location.origin : undefined
        },
    };

    return (
        <div style={{ width: '100%', height: '100%', background: '#000', ...style }}>
            <YouTube
                videoId={videoId}
                opts={opts}
                style={{ width: '100%', height: '100%' }}
                onReady={onPlayerReady}
                onStateChange={onPlayerStateChange}
                onError={onPlayerError}
            />
        </div>
    );
});
