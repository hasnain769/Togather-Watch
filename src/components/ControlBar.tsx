'use client';

import React, { useState, useEffect } from 'react';

interface ControlBarProps {
    isPlaying: boolean;
    onPlayPause: () => void;
    isRecording: boolean;
    onRecordStart: () => void;
    onRecordStop: () => void;
    volume: number;
    onVolumeChange: (vol: number) => void;
    currentUrl: string;
    onUrlChange: (url: string) => void;
}

export default function ControlBar({
    isPlaying,
    onPlayPause,
    isRecording,
    onRecordStart,
    onRecordStop,
    volume,
    onVolumeChange,
    currentUrl,
    onUrlChange
}: ControlBarProps) {
    const [showSettings, setShowSettings] = useState(false);
    const [inputUrl, setInputUrl] = useState(currentUrl);

    // Sync input with prop updates
    useEffect(() => {
        setInputUrl(currentUrl);
    }, [currentUrl]);

    const handleUrlSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onUrlChange(inputUrl);
        setShowSettings(false);
    };

    return (
        <>
            {/* Main Control Bar */}
            <div className="fixed bottom-0 left-0 right-0 h-24 bg-black/80 backdrop-blur-md border-t border-white/10 flex items-center justify-between px-6 z-50">
                {/* Left: Play/Pause */}
                <div className="flex items-center space-x-4 w-1/4">
                    <button
                        onClick={onPlayPause}
                        className="text-white hover:text-blue-400 transition-colors"
                    >
                        {isPlaying ? (
                            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>
                        ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                        )}
                    </button>
                </div>

                {/* Center: Push to Talk */}
                <div className="flex-1 flex justify-center">
                    <button
                        className={`w-16 h-16 rounded-full flex items-center justify-center transition-all duration-200 transform active:scale-95 ${isRecording
                                ? 'bg-red-500 shadow-[0_0_20px_rgba(239,68,68,0.5)] scale-110'
                                : 'bg-blue-600 hover:bg-blue-500 shadow-lg'
                            }`}
                        onMouseDown={onRecordStart}
                        onMouseUp={onRecordStop}
                        onMouseLeave={onRecordStop} // Safety: stop if drag out
                        onTouchStart={(e) => { e.preventDefault(); onRecordStart(); }}
                        onTouchEnd={(e) => { e.preventDefault(); onRecordStop(); }}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
                            <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                            <line x1="12" y1="19" x2="12" y2="23"></line>
                            <line x1="8" y1="23" x2="16" y2="23"></line>
                        </svg>
                    </button>
                    {isRecording && (
                        <span className="absolute -top-12 bg-black/50 text-white text-sm px-3 py-1 rounded-full animate-pulse border border-red-500/50">
                            Recording...
                        </span>
                    )}
                </div>

                {/* Right: Settings Toggle */}
                <div className="flex items-center justify-end w-1/4">
                    <button
                        onClick={() => setShowSettings(!showSettings)}
                        className={`p-2 rounded-full transition-colors ${showSettings ? 'bg-white/20 text-white' : 'text-gray-400 hover:text-white'}`}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
                    </button>
                </div>
            </div>

            {/* Settings Overlay (Slide up) */}
            <div className={`fixed bottom-24 left-4 right-4 md:right-6 md:left-auto md:w-80 bg-gray-900 border border-gray-700 rounded-xl p-4 shadow-2xl transition-all duration-300 transform origin-bottom ${showSettings ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-4 pointer-events-none'} z-40`}>
                <h3 className="text-white font-bold mb-4 uppercase text-xs tracking-wider">Settings</h3>

                {/* Volume */}
                <div className="mb-4">
                    <label className="block text-gray-400 text-xs mb-2">Volume</label>
                    <input
                        type="range"
                        min="0" max="1" step="0.05"
                        value={volume}
                        onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
                        className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                    />
                </div>

                {/* URL Input */}
                <form onSubmit={handleUrlSubmit}>
                    <label className="block text-gray-400 text-xs mb-2">Video URL</label>
                    <div className="flex space-x-2">
                        <input
                            type="text"
                            value={inputUrl}
                            onChange={(e) => setInputUrl(e.target.value)}
                            className="bg-gray-800 border border-gray-700 text-white text-sm rounded px-3 py-2 flex-1 focus:outline-none focus:border-blue-500"
                            placeholder="https://..."
                        />
                        <button type="submit" className="bg-blue-600 px-3 py-1 rounded text-white text-sm">
                            Load
                        </button>
                    </div>
                </form>
            </div>
        </>
    );
}
