'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { usePusher } from '@/hooks/usePusher';
import { useSyncLogic } from '@/hooks/useSyncLogic';
import { useWalkieTalkie } from '@/hooks/useWalkieTalkie';
import VideoPlayer, { VideoPlayerHandle } from '@/components/VideoPlayer';
import ControlBar from '@/components/ControlBar';
import RoomHeader from '@/components/RoomHeader';

// Audio ducking constants
const DUCK_VOLUME = 0.2;
const RAMP_TIME = 0.3; // 300ms

export default function RoomPage() {
    const { roomId } = useParams() as { roomId: string };

    // Audio unlock state
    const [isAudioUnlocked, setIsAudioUnlocked] = useState(false);

    // Volume state (managed here for ducking)
    const [volume, setVolume] = useState(0.8);
    const [baseVolume, setBaseVolume] = useState(0.8);

    // Toast notification
    const [toast, setToast] = useState<string | null>(null);

    // Orientation
    const [isLandscape, setIsLandscape] = useState(false);

    // Player ref
    const playerRef = useRef<VideoPlayerHandle>(null);

    // Audio refs for ducking
    const audioContextRef = useRef<AudioContext | null>(null);
    const gainNodeRef = useRef<GainNode | null>(null);
    const talkieAudioRef = useRef<HTMLAudioElement>(null);

    // Orientation detection
    useEffect(() => {
        const checkOrientation = () => {
            setIsLandscape(window.innerWidth > window.innerHeight);
        };
        checkOrientation();
        window.addEventListener('resize', checkOrientation);
        window.addEventListener('orientationchange', checkOrientation);
        return () => {
            window.removeEventListener('resize', checkOrientation);
            window.removeEventListener('orientationchange', checkOrientation);
        };
    }, []);

    // Pusher connection (only after audio unlock)
    const {
        isConnected,
        members,
        myUserId,
        memberCount,
        trigger,
        bind,
        unbind,
        channel
    } = usePusher({ roomId, enabled: isAudioUnlocked });

    // Sync logic
    const {
        syncState,
        url,
        isPlaying,
        handleLocalPlay,
        handleLocalPause,
        handleLocalSeek,
        handleLocalReady,
        handleUrlChange,
        isRemoteAction,
    } = useSyncLogic({
        playerRef: playerRef as any,
        trigger,
        bind,
        unbind,
        isConnected,
        channel,
        myUserId,
    });

    // Audio ducking handler
    const handleAudioReceived = useCallback((audioBlob: Blob) => {
        if (!talkieAudioRef.current) return;

        console.log('Received walkie-talkie audio, ducking video...');

        // Duck video volume
        const prevVolume = volume;
        setVolume(DUCK_VOLUME);

        // Play the received audio at MAX volume
        const audioUrl = URL.createObjectURL(audioBlob);
        talkieAudioRef.current.src = audioUrl;
        talkieAudioRef.current.volume = 1.0; // Max volume for voice

        talkieAudioRef.current.onended = () => {
            console.log('Walkie-talkie audio ended, restoring volume');
            setVolume(prevVolume);
            URL.revokeObjectURL(audioUrl);
        };

        talkieAudioRef.current.onerror = () => {
            setVolume(prevVolume);
            URL.revokeObjectURL(audioUrl);
        };

        talkieAudioRef.current.play().catch((e) => {
            console.error('Failed to play received audio:', e);
            setVolume(prevVolume);
        });
    }, [volume]);

    // Walkie-talkie
    const {
        isRecording,
        countdown,
        isChannelOpen,
        connectionStatus,
        startRecording,
        stopRecording,
        maxSeconds,
    } = useWalkieTalkie({
        trigger,
        bind,
        unbind,
        isConnected,
        channel,
        myUserId,
        onAudioReceived: handleAudioReceived,
    });

    // Watch for member changes to show toast
    const prevMemberCount = useRef(memberCount);
    useEffect(() => {
        if (prevMemberCount.current > memberCount && memberCount < 2) {
            setToast('Your friend left the room');
            setTimeout(() => setToast(null), 3000);
        }
        prevMemberCount.current = memberCount;
    }, [memberCount]);

    // Handle volume change from control bar
    const handleVolumeChange = useCallback((v: number) => {
        setBaseVolume(v);
        setVolume(v);
    }, []);

    // Toggle play/pause
    const handleTogglePlay = useCallback(() => {
        if (isPlaying) {
            handleLocalPause();
        } else {
            handleLocalPlay();
        }
    }, [isPlaying, handleLocalPlay, handleLocalPause]);

    // Hydration
    const [hasMounted, setHasMounted] = useState(false);
    useEffect(() => setHasMounted(true), []);

    if (!hasMounted) {
        return (
            <div className="h-screen w-full bg-black flex items-center justify-center text-white">
                Loading...
            </div>
        );
    }

    // Audio unlock overlay
    if (!isAudioUnlocked) {
        return (
            <div className="fixed inset-0 bg-gradient-to-br from-gray-900 via-black to-gray-900 flex flex-col items-center justify-center z-50 p-4">
                <div className="max-w-md w-full text-center space-y-8">
                    <div className="space-y-2">
                        <h1 className="text-4xl md:text-5xl font-bold text-white tracking-wider">
                            CINE<span className="text-blue-500">SYNC</span>
                        </h1>
                        <p className="text-gray-400">Watch together. Stay in sync.</p>
                    </div>

                    <button
                        onClick={() => setIsAudioUnlocked(true)}
                        className="w-full bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 
                                   text-white font-bold py-5 rounded-2xl text-lg shadow-lg shadow-blue-900/30 
                                   transition-all duration-300 transform hover:scale-[1.02] active:scale-95
                                   touch-manipulation"
                        style={{ minHeight: '56px' }}
                    >
                        🎬 Start Sync
                    </button>

                    <p className="text-gray-600 text-xs">
                        Tap to enable audio & video sync
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-screen w-full bg-black overflow-hidden relative">
            {/* Room Header - Hidden in landscape for more video space */}
            {!isLandscape && (
                <RoomHeader roomId={roomId} userCount={memberCount} />
            )}

            {/* Toast Notification */}
            {toast && (
                <div className="fixed top-4 left-1/2 transform -translate-x-1/2 
                                bg-red-600/90 backdrop-blur-sm text-white px-6 py-3 rounded-xl 
                                shadow-lg z-50 animate-pulse flex items-center space-x-2">
                    <span>⚠️</span>
                    <span>{toast}</span>
                </div>
            )}

            {/* Sync State Indicator (Debug) */}
            {syncState !== 'idle' && syncState !== 'playing' && syncState !== 'paused' && (
                <div className="fixed top-4 right-4 bg-yellow-500/90 text-black px-3 py-1 rounded text-xs z-50">
                    Syncing: {syncState}
                </div>
            )}

            {/* Main Player Area - Full height in landscape */}
            <div className={`flex-1 w-full relative flex items-center justify-center bg-black 
                            ${isLandscape ? 'pb-16' : 'pb-20 md:pb-24'}`}>
                <div className={`w-full h-full shadow-2xl bg-black overflow-hidden 
                                ${isLandscape
                        ? 'max-w-none max-h-none rounded-none'
                        : 'max-w-6xl max-h-[75vh] aspect-video rounded-lg border border-white/5'
                    }`}>
                    <VideoPlayer
                        ref={playerRef}
                        url={url}
                        playing={isPlaying}
                        volume={volume}
                        onPlay={handleLocalPlay}
                        onPause={handleLocalPause}
                        onSeek={handleLocalSeek}
                        onProgress={() => { }}
                        onWaiting={() => { }}
                        onCanPlay={handleLocalReady}
                        isRemoteAction={isRemoteAction}
                    />
                </div>
            </div>

            <ControlBar
                isPlaying={isPlaying}
                onPlayPause={handleTogglePlay}
                isRecording={isRecording}
                countdown={countdown}
                maxSeconds={maxSeconds}
                isChannelOpen={isChannelOpen}
                connectionStatus={connectionStatus}
                onRecordStart={startRecording}
                onRecordStop={stopRecording}
                volume={baseVolume}
                onVolumeChange={handleVolumeChange}
                currentUrl={url}
                onUrlChange={handleUrlChange}
            />

            {/* Hidden audio for walkie-talkie playback */}
            <audio ref={talkieAudioRef} className="hidden" playsInline />
        </div>
    );
}
