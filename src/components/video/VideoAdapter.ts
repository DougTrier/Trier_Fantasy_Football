import React from 'react';

export type PlayerState = 'idle' | 'loading' | 'ready' | 'playing' | 'ended' | 'unavailable';

export interface VideoAdapterProps {
    videoId: string;
    onStateChange: (state: PlayerState) => void;
    style?: React.CSSProperties;
}

/**
 * Interface that all Video Providers (YouTube, generic, etc.) must implement.
 * This ensures the UniversalPlayer doesn't care about the underlying tech.
 */
export type VideoAdapterComponent = React.FC<VideoAdapterProps>;
