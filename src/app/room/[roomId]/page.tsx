'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useParams } from 'next/navigation';
import { useSocket } from '@/hooks/useSocket';
import { useVoiceRecorder } from '@/hooks/useVoiceRecorder';
import VideoPlayer from '@/components/VideoPlayer';
import ControlBar from '@/components/ControlBar';
import RoomHeader from '@/components/RoomHeader';
import { VideoUpdatePayload, VideoState } from '@/lib/types';

export default function RoomPage() {
    const { roomId } = useParams() as { roomId: string };
    const { socket, isConnected } = useSocket();
    const { isRecording, startRecording, stopRecording } = useVoiceRecorder();

    // Logic refs
    const isVoiceInterruption = useRef(false);
    const audioRef = useRef<HTMLAudioElement>(null);

    const [videoState, setVideoState] = useState<VideoState>({
        playing: false,
        timestamp: 0,
        url: ''
    });
    const [seekCmd, setSeekCmd] = useState<number | null>(null);
    const [volume, setVolume] = useState(0.8);
    const [userCount, setUserCount] = useState(1);

    // Audio Unlock State
    const [isAudioUnlocked, setIsAudioUnlocked] = useState(false);

    // Sync Logic
    useEffect(() => {
        if (!socket || !isConnected) return;

        socket.emit('join-room', roomId);

        socket.on('video-sync', (state: VideoState) => {
            setVideoState(state);
            setSeekCmd(state.timestamp);
        });

        socket.on('video-update', (payload: VideoUpdatePayload) => {
            if (!isVoiceInterruption.current) {
                setVideoState(prev => ({ ...prev, playing: payload.playing, url: payload.url }));
            } else {
                setVideoState(prev => ({ ...prev, url: payload.url }));
            }

            if (Math.abs(payload.timestamp - videoState.timestamp) > 1.0) {
                setSeekCmd(payload.timestamp);
            }
        });

        socket.on('room-full', () => {
            alert('Room is full!');
            window.location.href = '/';
        });

        socket.on('user-joined', () => setUserCount(prev => Math.min(prev + 1, 2)));
        socket.on('user-disconnected', () => setUserCount(prev => Math.max(prev - 1, 1)));

        // Voice Note Handler (Receiver)
        socket.on('voice-note', async (payload: { senderId: string, audioBlob: ArrayBuffer, duration: number }) => {
            console.log("Received voice note from", payload.senderId);

            // 1. Pause Video
            isVoiceInterruption.current = true;
            setVideoState(prev => ({ ...prev, playing: false }));

            // 2. Play Audio via Persisted Element
            if (audioRef.current) {
                try {
                    const blob = new Blob([payload.audioBlob], { type: 'audio/webm' });
                    const audioUrl = URL.createObjectURL(blob);

                    audioRef.current.src = audioUrl;
                    audioRef.current.volume = 1.0;

                    await audioRef.current.play();
                } catch (e) {
                    console.error("Audio play error", e);
                    // If play fails, we should probably resume video to avoid stuck state
                    isVoiceInterruption.current = false;
                    // We don't auto resume here if it failed, maybe user has to click play
                }
            } else {
                console.error("Audio ref not defined");
            }
        });

        return () => {
            socket.off('video-sync');
            socket.off('video-update');
            socket.off('room-full');
            socket.off('user-joined');
            socket.off('user-disconnected');
            socket.off('voice-note');
        };
    }, [socket, isConnected, roomId, videoState.timestamp]);

    // Handlers
    const handleAudioEnded = () => {
        // 3. Resume Video
        if (isVoiceInterruption.current) {
            isVoiceInterruption.current = false;
            setVideoState(prev => ({ ...prev, playing: true }));
        }
    };

    const handleUnlockAudio = () => {
        if (audioRef.current) {
            // Play a silent logic or just init
            audioRef.current.play().catch(() => { });
            setIsAudioUnlocked(true);
        }
    };

    const handlePlay = (time: number) => {
        if (!socket) return;
        socket.emit('video-update', { roomId, playing: true, timestamp: time, url: videoState.url });
        setVideoState(prev => ({ ...prev, playing: true }));
    };

    const handlePause = (time: number) => {
        if (!socket) return;
        socket.emit('video-update', { roomId, playing: false, timestamp: time, url: videoState.url });
        setVideoState(prev => ({ ...prev, playing: false }));
    };

    const handleTogglePlay = () => {
        if (videoState.playing) {
            handlePause(videoState.timestamp);
        } else {
            handlePlay(videoState.timestamp);
        }
    };

    const handleSeek = (time: number) => {
        if (!socket) return;
        socket.emit('video-update', { roomId, playing: videoState.playing, timestamp: time, url: videoState.url });
        setVideoState(prev => ({ ...prev, timestamp: time }));
    };

    const handleUrlChange = (newUrl: string) => {
        if (!socket) return;
        const newState = { roomId, playing: false, timestamp: 0, url: newUrl };
        socket.emit('video-update', newState);
        setVideoState({ playing: false, timestamp: 0, url: newUrl });
    };

    // Voice Handling (Sender)
    const handleRecordStart = async () => {
        isVoiceInterruption.current = true;
        setVideoState(prev => ({ ...prev, playing: false }));
        await startRecording();
    };

    const handleRecordStop = async () => {
        const audioBlob = await stopRecording();
        if (audioBlob && socket) {
            const tempUrl = URL.createObjectURL(audioBlob);
            const tempAudio = new Audio(tempUrl);

            tempAudio.onloadedmetadata = () => {
                const duration = tempAudio.duration;

                socket.emit('voice-note', {
                    audioBlob: audioBlob,
                    duration: duration || 0
                });

                // Sender wait
                if (duration && isFinite(duration)) {
                    setTimeout(() => {
                        isVoiceInterruption.current = false;
                        handlePlay(videoState.timestamp);
                    }, duration * 1000);
                } else {
                    isVoiceInterruption.current = false;
                    handlePlay(videoState.timestamp);
                }
            };

            tempAudio.onerror = () => {
                socket.emit('voice-note', { audioBlob, duration: 0 });
                isVoiceInterruption.current = false;
                handlePlay(videoState.timestamp);
            };

            tempAudio.volume = 0;
            tempAudio.currentTime = 1e101;
        } else {
            isVoiceInterruption.current = false;
        }
    };

    const [hasMounted, setHasMounted] = useState(false);
    useEffect(() => setHasMounted(true), []);

    if (!hasMounted) return <div className="h-screen w-full bg-black flex items-center justify-center text-white">Loading Room...</div>;

    if (!isAudioUnlocked) {
        return (
            <div className="fixed inset-0 bg-black flex flex-col items-center justify-center z-50 p-4">
                <div className="max-w-md w-full text-center space-y-6">
                    <h1 className="text-3xl font-bold text-white tracking-wider">CINESYNC</h1>
                    <p className="text-gray-400">Join the room to start watching and talking.</p>
                    <button
                        onClick={handleUnlockAudio}
                        className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-xl text-lg shadow-lg shadow-blue-900/20 transition-all transform hover:scale-105 active:scale-95"
                    >
                        Tap to Join Room
                    </button>
                    <p className="text-gray-600 text-xs">Audio playback requires user interaction.</p>
                </div>
                {/* Hidden audio element to initialize ref */}
                <audio ref={audioRef} className="hidden" />
            </div>
        );
    }

    return (
        <div className="flex flex-col h-screen w-full bg-black overflow-hidden relative">
            <RoomHeader roomId={roomId} userCount={userCount} />

            <div className="flex-1 w-full relative flex items-center justify-center bg-black pb-24">
                <div className="w-full h-full max-w-6xl max-h-[80vh] aspect-video shadow-2xl bg-black rounded-lg overflow-hidden border border-white/5">
                    <VideoPlayer
                        url={videoState.url || ''}
                        playing={videoState.playing}
                        volume={volume}
                        onPlay={handlePlay}
                        onPause={handlePause}
                        onSeek={handleSeek}
                        onProgress={(p) => {
                            setVideoState(prev => ({ ...prev, timestamp: p.playedSeconds }));
                        }}
                        seekToTimestamp={seekCmd}
                    />
                </div>
            </div>

            <ControlBar
                isPlaying={videoState.playing}
                onPlayPause={handleTogglePlay}
                isRecording={isRecording}
                onRecordStart={handleRecordStart}
                onRecordStop={handleRecordStop}
                volume={volume}
                onVolumeChange={setVolume}
                currentUrl={videoState.url || ''}
                onUrlChange={handleUrlChange}
            />

            <audio
                ref={audioRef}
                className="hidden"
                onEnded={handleAudioEnded}
            />
        </div>
    );
}
