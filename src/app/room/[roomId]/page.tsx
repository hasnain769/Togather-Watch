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

    const [videoState, setVideoState] = useState<VideoState>({
        playing: false,
        timestamp: 0,
        url: ''
    });
    const [seekCmd, setSeekCmd] = useState<number | null>(null);
    const [volume, setVolume] = useState(0.8);
    const [userCount, setUserCount] = useState(1);

    // Sync Logic
    useEffect(() => {
        if (!socket || !isConnected) return;

        socket.emit('join-room', roomId);

        socket.on('video-sync', (state: VideoState) => {
            setVideoState(state);
            setSeekCmd(state.timestamp);
        });

        socket.on('video-update', (payload: VideoUpdatePayload) => {
            // Standard sync; if we are in voice interruption, we might ignore playing=true unless manual
            if (!isVoiceInterruption.current) {
                setVideoState(prev => ({ ...prev, playing: payload.playing, url: payload.url }));
            } else {
                // Update URL/Ts but keep playing status controlled by interruption logic unless seek
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

            // 2. Play Audio
            try {
                const blob = new Blob([payload.audioBlob], { type: 'audio/webm' });
                const audioUrl = URL.createObjectURL(blob);
                const audio = new Audio(audioUrl);
                audio.volume = 1.0;

                audio.onended = () => {
                    // 3. Resume
                    isVoiceInterruption.current = false;
                    setVideoState(prev => ({ ...prev, playing: true }));
                };

                await audio.play();
            } catch (e) {
                console.error("Audio play error", e);
                isVoiceInterruption.current = false;
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

    // Toggle Play/Pause from Control Bar
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
        // Pause video locally immediately
        isVoiceInterruption.current = true;
        setVideoState(prev => ({ ...prev, playing: false }));
        await startRecording();
    };

    const handleRecordStop = async () => {
        const audioBlob = await stopRecording();
        if (audioBlob && socket) {
            // We need to estimate duration to pause sender video too
            const tempUrl = URL.createObjectURL(audioBlob);
            const tempAudio = new Audio(tempUrl);

            tempAudio.onloadedmetadata = () => {
                const duration = tempAudio.duration;

                // Send note
                socket.emit('voice-note', {
                    audioBlob: audioBlob,
                    duration: duration || 0
                });

                // Sender waits for duration too if valid
                if (duration && isFinite(duration)) {
                    setTimeout(() => {
                        isVoiceInterruption.current = false;
                        handlePlay(videoState.timestamp);
                    }, duration * 1000);
                } else {
                    // Fallback
                    isVoiceInterruption.current = false;
                    handlePlay(videoState.timestamp);
                }
            };

            tempAudio.onerror = () => {
                // Fallback if audio load fails
                socket.emit('voice-note', { audioBlob, duration: 0 });
                isVoiceInterruption.current = false;
                handlePlay(videoState.timestamp);
            };

            // Trigger load
            tempAudio.volume = 0;
            // Hack to trigger metadata load in some envs
            tempAudio.currentTime = 1e101;
        } else {
            isVoiceInterruption.current = false;
        }
    };

    const [hasMounted, setHasMounted] = useState(false);
    useEffect(() => setHasMounted(true), []);

    if (!hasMounted) return <div className="h-screen w-full bg-black flex items-center justify-center text-white">Loading Room...</div>;

    return (
        <div className="flex flex-col h-screen w-full bg-black overflow-hidden relative">
            <RoomHeader roomId={roomId} userCount={userCount} />

            {/* Main Player Area - Centered */}
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
        </div>
    );
}
