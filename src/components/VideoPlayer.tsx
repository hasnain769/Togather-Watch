'use client';

import React, { useRef, useEffect, useState, forwardRef, useImperativeHandle, useCallback } from 'react';
import ReactPlayer from 'react-player';

interface VideoPlayerProps {
    url: string;
    playing: boolean;
    volume: number;
    onPlay: () => void;
    onPause: () => void;
    onSeek: (time: number) => void;
    onProgress: (state: { playedSeconds: number }) => void;
    onWaiting?: () => void;
    onCanPlay?: () => void;
    seekToTimestamp?: number | null;
    isRemoteAction?: React.MutableRefObject<boolean>;
}

export interface VideoPlayerHandle {
    getCurrentTime: () => number;
    seekTo: (time: number) => void;
    getInternalPlayer: () => any;
}

const DOUBLE_TAP_DELAY = 300;
const SKIP_SECONDS = 10;

const VideoPlayer = forwardRef<VideoPlayerHandle, VideoPlayerProps>(({
    url,
    playing,
    volume,
    onPlay,
    onPause,
    onSeek,
    onProgress,
    onWaiting,
    onCanPlay,
    seekToTimestamp,
    isRemoteAction,
}, ref) => {
    const playerRef = useRef<any>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const seekBarRef = useRef<HTMLDivElement>(null);

    const [hasMounted, setHasMounted] = useState(false);
    const [duration, setDuration] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);
    const [isScrubbing, setIsScrubbing] = useState(false);
    const [scrubTime, setScrubTime] = useState(0);
    const [showControls, setShowControls] = useState(true);

    // Double-tap detection
    const lastTapTime = useRef(0);
    const lastTapSide = useRef<'left' | 'right' | null>(null);
    const tapTimeout = useRef<NodeJS.Timeout | null>(null);

    // Control hide timeout
    const controlsTimeout = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        setHasMounted(true);
    }, []);

    // Expose methods via ref
    useImperativeHandle(ref, () => ({
        getCurrentTime: () => {
            if (playerRef.current && typeof playerRef.current.getCurrentTime === 'function') {
                return playerRef.current.getCurrentTime();
            }
            return 0;
        },
        seekTo: (time: number) => {
            if (playerRef.current && typeof playerRef.current.seekTo === 'function') {
                playerRef.current.seekTo(time, 'seconds');
            }
        },
        getInternalPlayer: () => {
            return playerRef.current?.getInternalPlayer?.();
        },
    }));

    // Handle external seek commands
    useEffect(() => {
        if (hasMounted && seekToTimestamp !== null && seekToTimestamp !== undefined && playerRef.current) {
            const currentPlayer = playerRef.current;
            if (currentPlayer && typeof currentPlayer.getCurrentTime === 'function') {
                const current = currentPlayer.getCurrentTime();
                if (Math.abs(current - seekToTimestamp) > 0.5) {
                    currentPlayer.seekTo(seekToTimestamp, 'seconds');
                }
            }
        }
    }, [seekToTimestamp, hasMounted]);

    // Auto-hide controls
    const resetControlsTimeout = useCallback(() => {
        if (controlsTimeout.current) clearTimeout(controlsTimeout.current);
        setShowControls(true);
        if (playing) {
            controlsTimeout.current = setTimeout(() => {
                setShowControls(false);
            }, 3000);
        }
    }, [playing]);

    useEffect(() => {
        resetControlsTimeout();
        return () => {
            if (controlsTimeout.current) clearTimeout(controlsTimeout.current);
        };
    }, [playing, resetControlsTimeout]);

    // Progress tracking
    const handleProgress = useCallback((state: { playedSeconds: number; played: number }) => {
        if (!isScrubbing) {
            setCurrentTime(state.playedSeconds);
        }
        onProgress(state);
    }, [isScrubbing, onProgress]);

    const handleDuration = useCallback((dur: number) => {
        setDuration(dur);
    }, []);

    // ========== SEEK BAR TOUCH HANDLERS ==========

    const getSeekTimeFromPosition = useCallback((clientX: number) => {
        if (!seekBarRef.current || duration === 0) return 0;
        const rect = seekBarRef.current.getBoundingClientRect();
        const pos = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        return pos * duration;
    }, [duration]);

    const handleSeekStart = useCallback((clientX: number) => {
        setIsScrubbing(true);
        const time = getSeekTimeFromPosition(clientX);
        setScrubTime(time);
        resetControlsTimeout();
    }, [getSeekTimeFromPosition, resetControlsTimeout]);

    const handleSeekMove = useCallback((clientX: number) => {
        if (!isScrubbing) return;
        const time = getSeekTimeFromPosition(clientX);
        setScrubTime(time);
    }, [isScrubbing, getSeekTimeFromPosition]);

    const handleSeekEnd = useCallback(() => {
        if (!isScrubbing) return;
        setIsScrubbing(false);
        setCurrentTime(scrubTime);
        onSeek(scrubTime);
        if (playerRef.current) {
            playerRef.current.seekTo(scrubTime, 'seconds');
        }
    }, [isScrubbing, scrubTime, onSeek]);

    // Mouse events
    const onMouseDown = useCallback((e: React.MouseEvent) => {
        handleSeekStart(e.clientX);
    }, [handleSeekStart]);

    const onMouseMove = useCallback((e: React.MouseEvent) => {
        handleSeekMove(e.clientX);
    }, [handleSeekMove]);

    const onMouseUp = useCallback(() => {
        handleSeekEnd();
    }, [handleSeekEnd]);

    // Touch events
    const onTouchStart = useCallback((e: React.TouchEvent) => {
        if (e.touches.length > 0) {
            handleSeekStart(e.touches[0].clientX);
        }
    }, [handleSeekStart]);

    const onTouchMove = useCallback((e: React.TouchEvent) => {
        if (e.touches.length > 0) {
            handleSeekMove(e.touches[0].clientX);
        }
    }, [handleSeekMove]);

    const onTouchEnd = useCallback(() => {
        handleSeekEnd();
    }, [handleSeekEnd]);

    // Global mouse up to handle drag release outside seekbar
    useEffect(() => {
        const handleGlobalMouseUp = () => {
            if (isScrubbing) handleSeekEnd();
        };
        const handleGlobalTouchEnd = () => {
            if (isScrubbing) handleSeekEnd();
        };

        window.addEventListener('mouseup', handleGlobalMouseUp);
        window.addEventListener('touchend', handleGlobalTouchEnd);

        return () => {
            window.removeEventListener('mouseup', handleGlobalMouseUp);
            window.removeEventListener('touchend', handleGlobalTouchEnd);
        };
    }, [isScrubbing, handleSeekEnd]);

    // ========== DOUBLE-TAP SEEK ==========

    const handleVideoTap = useCallback((e: React.MouseEvent | React.TouchEvent) => {
        resetControlsTimeout();

        if (!containerRef.current) return;

        const rect = containerRef.current.getBoundingClientRect();
        let clientX: number;

        if ('touches' in e) {
            if (e.touches.length === 0) return;
            clientX = e.changedTouches[0].clientX;
        } else {
            clientX = e.clientX;
        }

        const relativeX = clientX - rect.left;
        const side: 'left' | 'right' = relativeX < rect.width / 2 ? 'left' : 'right';

        const now = Date.now();

        if (now - lastTapTime.current < DOUBLE_TAP_DELAY && lastTapSide.current === side) {
            // Double tap detected
            if (tapTimeout.current) clearTimeout(tapTimeout.current);

            const current = playerRef.current?.getCurrentTime() || 0;
            const newTime = side === 'left'
                ? Math.max(0, current - SKIP_SECONDS)
                : Math.min(duration, current + SKIP_SECONDS);

            console.log(`Double-tap ${side}: seeking to ${newTime}`);
            onSeek(newTime);
            if (playerRef.current) {
                playerRef.current.seekTo(newTime, 'seconds');
            }

            lastTapTime.current = 0;
            lastTapSide.current = null;
        } else {
            // First tap
            lastTapTime.current = now;
            lastTapSide.current = side;

            // Single tap shows/hides controls
            tapTimeout.current = setTimeout(() => {
                setShowControls(prev => !prev);
            }, DOUBLE_TAP_DELAY);
        }
    }, [duration, onSeek, resetControlsTimeout]);

    // ========== PLAY/PAUSE TOGGLE ==========

    const handlePlayPause = useCallback(() => {
        resetControlsTimeout();
        if (playing) {
            onPause();
        } else {
            onPlay();
        }
    }, [playing, onPlay, onPause, resetControlsTimeout]);

    // Format time
    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const RP = ReactPlayer as any;
    const displayTime = isScrubbing ? scrubTime : currentTime;
    const progress = duration > 0 ? (displayTime / duration) * 100 : 0;

    if (!hasMounted) {
        return (
            <div className="relative w-full h-full bg-black rounded-lg overflow-hidden flex items-center justify-center">
                <div className="text-gray-500">Loading Player...</div>
            </div>
        );
    }

    return (
        <div
            ref={containerRef}
            className="relative w-full h-full bg-black rounded-lg overflow-hidden group"
            onClick={handleVideoTap}
            onTouchEnd={handleVideoTap}
        >
            {/* Video */}
            <div className="absolute inset-0">
                {!url && (
                    <div className="w-full h-full flex items-center justify-center text-gray-500">
                        No Video Loaded
                    </div>
                )}
                <RP
                    key={url}
                    ref={playerRef}
                    url={url}
                    playing={playing}
                    volume={volume}
                    width="100%"
                    height="100%"
                    controls={false}
                    playsinline
                    config={{
                        file: {
                            attributes: {
                                playsInline: true,
                                'webkit-playsinline': 'true',
                            }
                        }
                    }}
                    onPlay={() => {
                        if (isRemoteAction?.current) {
                            isRemoteAction.current = false;
                            return;
                        }
                        onPlay();
                    }}
                    onPause={() => {
                        if (isRemoteAction?.current) {
                            isRemoteAction.current = false;
                            return;
                        }
                        onPause();
                    }}
                    onProgress={handleProgress}
                    onDuration={handleDuration}
                    onBuffer={onWaiting}
                    onBufferEnd={onCanPlay}
                    onReady={onCanPlay}
                />
            </div>

            {/* Skip Indicators */}
            <div className="absolute inset-0 flex pointer-events-none">
                <div className="flex-1 flex items-center justify-center">
                    <div className="skip-indicator opacity-0 text-white text-2xl font-bold">
                        ⏪ {SKIP_SECONDS}s
                    </div>
                </div>
                <div className="flex-1 flex items-center justify-center">
                    <div className="skip-indicator opacity-0 text-white text-2xl font-bold">
                        {SKIP_SECONDS}s ⏩
                    </div>
                </div>
            </div>

            {/* Controls Overlay */}
            <div
                className={`absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30 transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
                    }`}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Center Play Button */}
                <div className="absolute inset-0 flex items-center justify-center">
                    <button
                        onClick={handlePlayPause}
                        className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center 
                                   transition-all duration-200 active:scale-90 active:bg-white/30 touch-manipulation"
                        style={{ minWidth: '48px', minHeight: '48px' }}
                    >
                        {playing ? (
                            <svg className="w-8 h-8 md:w-10 md:h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <rect x="6" y="4" width="4" height="16" fill="currentColor" />
                                <rect x="14" y="4" width="4" height="16" fill="currentColor" />
                            </svg>
                        ) : (
                            <svg className="w-8 h-8 md:w-10 md:h-10 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
                                <polygon points="5,3 19,12 5,21" />
                            </svg>
                        )}
                    </button>
                </div>

                {/* Bottom Controls */}
                <div className="absolute bottom-0 left-0 right-0 p-3 md:p-4">
                    {/* Seek Bar - Large touch area */}
                    <div
                        ref={seekBarRef}
                        className="relative w-full cursor-pointer mb-2"
                        style={{
                            height: '30px',
                            touchAction: 'none',
                            display: 'flex',
                            alignItems: 'center'
                        }}
                        onMouseDown={onMouseDown}
                        onMouseMove={onMouseMove}
                        onMouseUp={onMouseUp}
                        onTouchStart={onTouchStart}
                        onTouchMove={onTouchMove}
                        onTouchEnd={onTouchEnd}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Track */}
                        <div className="absolute left-0 right-0 h-1 bg-white/30 rounded-full" style={{ top: '50%', transform: 'translateY(-50%)' }}>
                            {/* Progress */}
                            <div
                                className="absolute left-0 h-full bg-blue-500 rounded-full transition-all"
                                style={{ width: `${progress}%` }}
                            />
                            {/* Thumb */}
                            <div
                                className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full shadow-lg transition-transform ${isScrubbing ? 'scale-125' : 'scale-100'
                                    }`}
                                style={{ left: `calc(${progress}% - 8px)` }}
                            />
                        </div>
                    </div>

                    {/* Time Display */}
                    <div className="flex justify-between text-white text-xs md:text-sm">
                        <span>{formatTime(displayTime)}</span>
                        <span>{formatTime(duration)}</span>
                    </div>
                </div>
            </div>
        </div>
    );
});

VideoPlayer.displayName = 'VideoPlayer';

export default VideoPlayer;
