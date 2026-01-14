'use client';

import React, { useState } from 'react';

interface RoomHeaderProps {
    roomId: string;
    userCount: number;
}

const RoomHeader: React.FC<RoomHeaderProps> = ({ roomId, userCount }) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        const url = window.location.href;

        // Mobile native share
        if (typeof navigator !== 'undefined' && 'share' in navigator) {
            try {
                await (navigator as any).share({
                    title: 'Join Watch Room',
                    text: 'Join me on CineSync!',
                    url: url
                });
                return;
            } catch (err) {
                // Share cancelled or failed, fall through to copy
                console.log('Share unavailable/cancelled, trying clipboard');
            }
        }

        // Clipboard with fallback
        try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            // Fallback for non-secure contexts (e.g. mobile HTTP)
            const textArea = document.createElement("textarea");
            textArea.value = url;
            textArea.style.position = "fixed"; // Avoid scrolling to bottom
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            try {
                document.execCommand('copy');
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
            } catch (fallbackErr) {
                console.error("Fallback copy failed", fallbackErr);
                alert("Copy failed. Please manually copy the URL from the address bar.");
            }
            document.body.removeChild(textArea);
        }
    };

    return (
        <header className="absolute top-0 left-0 right-0 h-16 bg-gradient-to-b from-black/80 to-transparent z-10 flex items-center justify-between px-4 md:px-6 pointer-events-none">
            <div className="pointer-events-auto flex items-center space-x-2 md:space-x-4">
                <h1 className="text-lg md:text-xl font-bold text-white tracking-wider">CINESYNC</h1>
                <div className="bg-white/10 backdrop-blur px-2 md:px-3 py-1 rounded-full flex items-center space-x-2 border border-white/10">
                    <span className="hidden md:inline text-xs text-gray-300">Room:</span>
                    <code className="text-xs font-mono text-blue-300 max-w-[80px] md:max-w-none truncate">{roomId.slice(0, 8)}...</code>
                    <button
                        onClick={handleCopy}
                        className="ml-1 md:ml-2 text-xs bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded transition-colors"
                    >
                        {copied ? 'Copied' : (typeof navigator !== 'undefined' && 'share' in navigator ? 'Share' : 'Copy')}
                    </button>
                </div>
            </div>

            <div className="pointer-events-auto bg-black/50 backdrop-blur px-3 py-1 rounded-full border border-white/10">
                <span className="text-sm text-gray-300">Users: {userCount} / 2</span>
            </div>
        </header>
    );
};

export default RoomHeader;
