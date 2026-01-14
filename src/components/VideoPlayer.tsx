'use client';

import React, { useRef, useEffect, useState } from 'react';
import ReactPlayer from 'react-player';
import { VideoState } from '@/lib/types';

interface VideoPlayerProps {
    initialState?: VideoState;
    onPlay: (timestamp: number) => void;
    onPause: (timestamp: number) => void;
    onSeek: (timestamp: number) => void;
    onProgress: (state: { playedSeconds: number }) => void;
    url: string;
    playing: boolean;
    volume: number;
    seekToTimestamp?: number | null;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({
    onPlay,
    onPause,
    onSeek,
    onProgress,
    url,
    playing,
    volume,
    seekToTimestamp
}) => {
    // Explicitly type ref as any to avoid complex ReactPlayer type issues with refs
    const playerRef = useRef<any>(null);
    const [hasMounted, setHasMounted] = useState(false);
    const [isReady, setIsReady] = useState(false);

    useEffect(() => {
        setHasMounted(true);
    }, []);

    // Handle external seek commands
    useEffect(() => {
        if (hasMounted && seekToTimestamp !== null && seekToTimestamp !== undefined && playerRef.current) {
            const currentPlayer = playerRef.current;
            // Verify getCurrentTime exists before calling
            if (currentPlayer && typeof currentPlayer.getCurrentTime === 'function') {
                const current = currentPlayer.getCurrentTime();
                if (Math.abs(current - seekToTimestamp) > 0.5) {
                    currentPlayer.seekTo(seekToTimestamp, 'seconds');
                }
            }
        }
    }, [seekToTimestamp, hasMounted]);

    // Explicitly cast to any to avoid strict type checking on props which vary between versions
    const RP = ReactPlayer as any;

    if (!hasMounted) {
        return (
            <div className="relative w-full h-full bg-black rounded-lg overflow-hidden shadow-2xl flex items-center justify-center">
                <div className="text-gray-500">Loading Player...</div>
            </div>
        );
    }

    return (
        <div className="relative w-full h-full bg-black rounded-lg overflow-hidden shadow-2xl">
            <div className="absolute inset-0 flex items-center justify-center">
                {!url && <div className="text-gray-500">No Video Loaded</div>}
            </div>
            {/* Wrapper div to ensure layout */}
            <RP
                key={url}
                ref={playerRef}
                url={url}
                playing={playing}
                volume={volume}
                width="100%"
                height="100%"
                controls={false}
                onPlay={() => {
                    const time = playerRef.current?.getCurrentTime ? playerRef.current.getCurrentTime() : 0;
                    onPlay(time);
                }}
                onPause={() => {
                    const time = playerRef.current?.getCurrentTime ? playerRef.current.getCurrentTime() : 0;
                    onPause(time);
                }}
                onSeek={(seconds: number) => onSeek(seconds)}
                onProgress={onProgress as any}
                onReady={() => setIsReady(true)}
                className="absolute top-0 left-0"
                style={{ position: 'absolute', top: 0, left: 0 }}
            />
        </div>
    );
};

export default VideoPlayer;
