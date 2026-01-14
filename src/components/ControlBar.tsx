'use client';

import React, { useState, useEffect, useCallback } from 'react';

interface ControlBarProps {
    isPlaying: boolean;
    onPlayPause: () => void;
    // Walkie-talkie props
    isRecording: boolean;
    countdown: number;
    maxSeconds: number;
    isChannelOpen: boolean;
    connectionStatus: 'disconnected' | 'connecting' | 'connected';
    onRecordStart: () => void;
    onRecordStop: () => void;
    // Volume
    volume: number;
    onVolumeChange: (vol: number) => void;
    // URL
    currentUrl: string;
    onUrlChange: (url: string) => void;
}

export default function ControlBar({
    isPlaying,
    onPlayPause,
    isRecording,
    countdown,
    maxSeconds,
    isChannelOpen,
    connectionStatus,
    onRecordStart,
    onRecordStop,
    volume,
    onVolumeChange,
    currentUrl,
    onUrlChange
}: ControlBarProps) {
    const [showSettings, setShowSettings] = useState(false);
    const [inputUrl, setInputUrl] = useState(currentUrl);
    const [isLandscape, setIsLandscape] = useState(false);

    useEffect(() => {
        setInputUrl(currentUrl);
    }, [currentUrl]);

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

    const handleUrlSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onUrlChange(inputUrl);
        setShowSettings(false);
    };

    // Touch handlers for walkie-talkie
    const handleTalkTouchStart = useCallback((e: React.TouchEvent) => {
        e.preventDefault();
        console.log('Touch START - isChannelOpen:', isChannelOpen);
        onRecordStart();
    }, [isChannelOpen, onRecordStart]);

    const handleTalkTouchEnd = useCallback((e: React.TouchEvent) => {
        e.preventDefault();
        console.log('Touch END - isRecording:', isRecording);
        if (isRecording) onRecordStop();
    }, [isRecording, onRecordStop]);

    const handleTalkMouseDown = useCallback(() => {
        console.log('Mouse DOWN - isChannelOpen:', isChannelOpen);
        onRecordStart();
    }, [isChannelOpen, onRecordStart]);

    const handleTalkMouseUp = useCallback(() => {
        console.log('Mouse UP - isRecording:', isRecording);
        if (isRecording) onRecordStop();
    }, [isRecording, onRecordStop]);

    // Progress ring calculations
    const progress = isRecording ? ((maxSeconds - countdown) / maxSeconds) * 100 : 0;
    const circumference = 2 * Math.PI * 38; // radius = 38
    const strokeDashoffset = circumference - (progress / 100) * circumference;

    // Button size based on orientation
    const buttonSize = isLandscape ? 56 : 72;
    const ringSize = buttonSize + 16;

    return (
        <>
            {/* Main Control Bar */}
            <div
                className={`fixed bottom-0 left-0 right-0 bg-black/90 backdrop-blur-md border-t border-white/10 
                            flex items-center justify-between px-3 md:px-6 z-50 safe-area-bottom
                            ${isLandscape ? 'h-16' : 'h-20 md:h-24'}`}
            >
                {/* Left: Play/Pause */}
                <div className="flex items-center space-x-2 md:space-x-4 w-1/4">
                    <button
                        onClick={onPlayPause}
                        className="w-12 h-12 flex items-center justify-center text-white hover:text-blue-400 
                                   transition-all duration-200 active:scale-90 active:bg-white/10 rounded-full
                                   touch-manipulation"
                        style={{ minWidth: '48px', minHeight: '48px' }}
                    >
                        {isPlaying ? (
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <rect x="6" y="4" width="4" height="16" />
                                <rect x="14" y="4" width="4" height="16" />
                            </svg>
                        ) : (
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                                <polygon points="5 3 19 12 5 21 5 3" />
                            </svg>
                        )}
                    </button>
                </div>

                {/* Center: Walkie-Talkie Button with Progress Ring */}
                <div className="flex-1 flex justify-center relative">
                    <div
                        className="relative flex items-center justify-center"
                        style={{ width: ringSize, height: ringSize }}
                    >
                        {/* Progress Ring SVG */}
                        <svg
                            className="absolute inset-0 -rotate-90"
                            width={ringSize}
                            height={ringSize}
                        >
                            {/* Background circle */}
                            <circle
                                cx={ringSize / 2}
                                cy={ringSize / 2}
                                r={38}
                                fill="none"
                                stroke="rgba(255,255,255,0.1)"
                                strokeWidth="4"
                            />
                            {/* Progress circle */}
                            {isRecording && (
                                <circle
                                    cx={ringSize / 2}
                                    cy={ringSize / 2}
                                    r={38}
                                    fill="none"
                                    stroke="#ef4444"
                                    strokeWidth="4"
                                    strokeLinecap="round"
                                    strokeDasharray={circumference}
                                    strokeDashoffset={strokeDashoffset}
                                    className="transition-all duration-1000 linear"
                                />
                            )}
                        </svg>

                        {/* Main Button */}
                        <button
                            className={`rounded-full flex flex-col items-center justify-center transition-all duration-200 
                                        transform active:scale-95 touch-manipulation select-none
                                        ${!isChannelOpen
                                    ? 'bg-gray-600'
                                    : isRecording
                                        ? 'bg-red-500 shadow-[0_0_30px_rgba(239,68,68,0.7)] scale-105'
                                        : 'bg-gradient-to-br from-blue-500 to-blue-700 shadow-lg hover:shadow-blue-500/30'
                                }`}
                            style={{
                                width: buttonSize,
                                height: buttonSize,
                                minWidth: '48px',
                                minHeight: '48px',
                                zIndex: 100,
                                position: 'relative',
                            }}
                            onClick={() => {
                                console.log('CLICK - isChannelOpen:', isChannelOpen, 'isRecording:', isRecording);
                                if (!isRecording) {
                                    onRecordStart();
                                } else {
                                    onRecordStop();
                                }
                            }}
                            onMouseDown={handleTalkMouseDown}
                            onMouseUp={handleTalkMouseUp}
                            onMouseLeave={handleTalkMouseUp}
                            onTouchStart={handleTalkTouchStart}
                            onTouchEnd={handleTalkTouchEnd}
                        >
                            {connectionStatus === 'connecting' ? (
                                <div className="flex flex-col items-center">
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                </div>
                            ) : isRecording ? (
                                <div className="flex flex-col items-center">
                                    <span className="text-white font-bold text-lg">{countdown}</span>
                                    <span className="text-white/70 text-[10px]">sec</span>
                                </div>
                            ) : (
                                <svg
                                    width="24"
                                    height="24"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="white"
                                    strokeWidth="2"
                                >
                                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                                    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                                    <line x1="12" y1="19" x2="12" y2="23" />
                                    <line x1="8" y1="23" x2="16" y2="23" />
                                </svg>
                            )}
                        </button>
                    </div>

                    {/* Status Labels */}
                    {!isChannelOpen && connectionStatus === 'connecting' && (
                        <div className="absolute -top-7 left-1/2 -translate-x-1/2 
                                        bg-yellow-500/90 text-black text-xs px-3 py-1 rounded-full 
                                        whitespace-nowrap font-medium">
                            Connecting...
                        </div>
                    )}
                    {!isChannelOpen && connectionStatus === 'disconnected' && (
                        <div className="absolute -top-7 left-1/2 -translate-x-1/2 
                                        bg-gray-600/90 text-white text-xs px-3 py-1 rounded-full 
                                        whitespace-nowrap">
                            Waiting for peer
                        </div>
                    )}
                    {isRecording && (
                        <div className="absolute -top-7 left-1/2 -translate-x-1/2 
                                        bg-red-500/90 text-white text-xs px-3 py-1 rounded-full 
                                        animate-pulse whitespace-nowrap font-medium">
                            🔴 Recording...
                        </div>
                    )}
                </div>

                {/* Right: Settings */}
                <div className="flex items-center justify-end w-1/4">
                    <button
                        onClick={() => setShowSettings(!showSettings)}
                        className={`w-12 h-12 flex items-center justify-center rounded-full 
                                    transition-all duration-200 active:scale-90 touch-manipulation
                                    ${showSettings
                                ? 'bg-white/20 text-white'
                                : 'text-gray-400 hover:text-white active:bg-white/10'
                            }`}
                        style={{ minWidth: '48px', minHeight: '48px' }}
                    >
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="3" />
                            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                        </svg>
                    </button>
                </div>
            </div>

            {/* Settings Panel */}
            <div
                className={`fixed left-0 right-0 bg-gray-900/95 backdrop-blur-md border-t border-gray-700 
                            rounded-t-2xl p-4 shadow-2xl transition-all duration-300 z-40
                            ${isLandscape ? 'bottom-16' : 'bottom-20 md:bottom-24'}
                            ${showSettings
                        ? 'translate-y-0 opacity-100'
                        : 'translate-y-full opacity-0 pointer-events-none'
                    }`}
            >
                <div className="max-w-md mx-auto space-y-4">
                    <div className="flex justify-center mb-2">
                        <div className="w-10 h-1 bg-gray-600 rounded-full" />
                    </div>

                    <h3 className="text-white font-bold uppercase text-xs tracking-wider">Settings</h3>

                    {/* Volume */}
                    <div>
                        <label className="block text-gray-400 text-xs mb-2">Movie Volume</label>
                        <div className="flex items-center space-x-3">
                            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                            </svg>
                            <input
                                type="range"
                                min="0" max="1" step="0.05"
                                value={volume}
                                onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
                                className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                                style={{ touchAction: 'none' }}
                            />
                            <span className="text-gray-400 text-sm w-10 text-right">{Math.round(volume * 100)}%</span>
                        </div>
                    </div>

                    {/* URL */}
                    <form onSubmit={handleUrlSubmit}>
                        <label className="block text-gray-400 text-xs mb-2">Video URL</label>
                        <div className="flex space-x-2">
                            <input
                                type="url"
                                value={inputUrl}
                                onChange={(e) => setInputUrl(e.target.value)}
                                className="bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-3 flex-1 
                                           focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                placeholder="https://example.com/video.mp4"
                            />
                            <button
                                type="submit"
                                className="bg-blue-600 hover:bg-blue-500 active:bg-blue-700 active:scale-95
                                           px-4 py-3 rounded-lg text-white text-sm font-medium transition-all
                                           touch-manipulation"
                                style={{ minWidth: '48px' }}
                            >
                                Load
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            {showSettings && (
                <div
                    className="fixed inset-0 bg-black/50 z-30"
                    onClick={() => setShowSettings(false)}
                />
            )}
        </>
    );
}
