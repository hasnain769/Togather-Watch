'use client';

import React, { useState } from 'react';

interface SidebarProps {
    connectionStatus: string;
    currentUrl: string;
    onUrlChange: (url: string) => void;
    volume: number;
    onVolumeChange: (vol: number) => void;
    friendVolume: number;
    onFriendVolumeChange: (vol: number) => void;
    isRecording: boolean;
}

export default function Sidebar({
    connectionStatus,
    currentUrl,
    onUrlChange,
    volume,
    onVolumeChange,
    friendVolume,
    onFriendVolumeChange,
    isRecording
}: SidebarProps) {
    const [inputUrl, setInputUrl] = useState(currentUrl);

    const handleLoad = () => {
        onUrlChange(inputUrl);
    };

    return (
        <div className="w-full md:w-80 md:h-full bg-gray-900 border-l border-gray-800 p-4 flex flex-col text-white overflow-y-auto text-sm shrink-0 z-20">
            <div className="mb-6 flex justify-between items-center">
                <div>
                    <h2 className="text-xl font-bold mb-1">CineSync</h2>
                    <div className="flex items-center space-x-2">
                        <div className={`w-3 h-3 rounded-full ${connectionStatus === 'connected' ? 'bg-green-500' : 'bg-red-500'}`} />
                        <span className="text-gray-400 capitalize">{connectionStatus}</span>
                    </div>
                </div>
            </div>

            <div className="space-y-6">
                {/* Video Source */}
                <div>
                    <label className="block text-gray-500 uppercase text-xs font-bold mb-2">Video Source</label>
                    <input
                        type="text"
                        className="w-full bg-gray-800 text-white p-2 rounded mb-2 border border-gray-700 focus:border-blue-500 outline-none transition-colors"
                        placeholder="Paste video URL..."
                        value={inputUrl}
                        onChange={(e) => setInputUrl(e.target.value)}
                    />
                    <button
                        onClick={handleLoad}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white p-2 rounded font-medium transition-colors"
                    >
                        Load Video
                    </button>
                </div>

                {/* Volume Controls */}
                <div>
                    <label className="block text-gray-500 uppercase text-xs font-bold mb-2">Movie Volume</label>
                    <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.01"
                        value={volume}
                        onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
                        className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                    />
                    <div className="text-right text-xs text-gray-400 mt-1">{Math.round(volume * 100)}%</div>
                </div>

                <div>
                    <label className="block text-gray-500 uppercase text-xs font-bold mb-2">Friend Volume</label>
                    <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.01"
                        value={friendVolume}
                        onChange={(e) => onFriendVolumeChange(parseFloat(e.target.value))}
                        className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                    />
                    <div className="text-right text-xs text-gray-400 mt-1">{Math.round(friendVolume * 100)}%</div>
                </div>

                {/* Voice Chat Indicator */}
                <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                    <label className="block text-gray-500 uppercase text-xs font-bold mb-3">Voice Note (Hold Space)</label>
                    <div className={`flex items-center justify-center p-4 rounded-lg transition-all duration-200 ${isRecording ? 'bg-red-500/20 border border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.5)]' : 'bg-gray-900 border border-gray-700'
                        }`}>
                        <div className="flex items-center space-x-3">
                            <div className={`w-3 h-3 rounded-full transition-colors duration-200 ${isRecording ? 'bg-red-500 animate-pulse' : 'bg-gray-600'}`} />
                            <span className={`font-medium ${isRecording ? 'text-red-400' : 'text-gray-500'}`}>
                                {isRecording ? 'Recording...' : 'Ready to Talk'}
                            </span>
                        </div>
                    </div>
                    <p className="text-xs text-gray-500 mt-2 text-center">Mobile: Tap & Hold button below</p>
                    {/* Mobile PTT Button support could be added here */}
                    <button
                        className={`w-full mt-2 py-3 rounded font-bold text-white transition-colors md:hidden ${isRecording ? 'bg-red-600' : 'bg-blue-600'}`}
                        onTouchStart={() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }))}
                        onTouchEnd={() => window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space' }))}
                        onMouseDown={() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }))}
                        onMouseUp={() => window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space' }))}
                    >
                        {isRecording ? 'Release to Send' : 'Hold to Talk'}
                    </button>
                </div>
            </div>
        </div>
    );
}
