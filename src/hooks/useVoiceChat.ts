'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import SimplePeer from 'simple-peer';

interface UseVoiceChatProps {
    trigger: (event: string, data: any) => void;
    bind: (event: string, callback: (data: any) => void) => void;
    unbind: (event: string, callback?: (data: any) => void) => void;
    isConnected: boolean;
    myUserId: string | null;
    onVideoVolumeChange?: (volume: number) => void;
}

const ICE_SERVERS = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:global.stun.twilio.com:3478' },
];

const AUDIO_CONSTRAINTS = {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
};

const DUCKING_THRESHOLD = 100;
const DUCKED_VOLUME = 0.2;

export const useVoiceChat = ({
    trigger,
    bind,
    unbind,
    isConnected,
    myUserId,
    onVideoVolumeChange,
}: UseVoiceChatProps) => {
    const [isMicEnabled, setIsMicEnabled] = useState(false);
    const [isVoiceConnected, setIsVoiceConnected] = useState(false);
    const [micVolume, setMicVolume] = useState(0);

    const peerRef = useRef<SimplePeer.Instance | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const animationFrameRef = useRef<number | null>(null);
    const remoteAudioRef = useRef<HTMLAudioElement | null>(null);

    // Cleanup
    const cleanup = useCallback(() => {
        if (peerRef.current) {
            peerRef.current.destroy();
            peerRef.current = null;
        }
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
        }
        if (audioContextRef.current) {
            audioContextRef.current.close();
            audioContextRef.current = null;
        }
        setIsVoiceConnected(false);
    }, []);

    // Audio Ducking - Monitor mic volume
    const startAudioDucking = useCallback((stream: MediaStream) => {
        try {
            const audioContext = new AudioContext();
            const analyser = audioContext.createAnalyser();
            const source = audioContext.createMediaStreamSource(stream);

            analyser.fftSize = 256;
            source.connect(analyser);

            audioContextRef.current = audioContext;
            analyserRef.current = analyser;

            const dataArray = new Uint8Array(analyser.frequencyBinCount);
            let userSetVolume = 1.0;

            const checkVolume = () => {
                if (!analyserRef.current) return;

                analyserRef.current.getByteFrequencyData(dataArray);
                const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
                setMicVolume(average);

                // Audio ducking
                if (onVideoVolumeChange) {
                    if (average > DUCKING_THRESHOLD) {
                        onVideoVolumeChange(DUCKED_VOLUME);
                    } else {
                        onVideoVolumeChange(userSetVolume);
                    }
                }

                animationFrameRef.current = requestAnimationFrame(checkVolume);
            };

            checkVolume();
        } catch (err) {
            console.error('Audio ducking setup failed:', err);
        }
    }, [onVideoVolumeChange]);

    // Initialize peer connection
    const initializePeer = useCallback(async (initiator: boolean) => {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            console.warn('getUserMedia not available (HTTPS required)');
            return;
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: AUDIO_CONSTRAINTS
            });
            streamRef.current = stream;

            // Start audio ducking
            startAudioDucking(stream);

            const peer = new SimplePeer({
                initiator,
                trickle: true,
                stream,
                config: { iceServers: ICE_SERVERS },
            });

            peer.on('signal', (signal) => {
                trigger('client-signal', {
                    signal,
                    userId: myUserId
                });
            });

            peer.on('stream', (remoteStream) => {
                console.log('Received remote stream');
                if (remoteAudioRef.current) {
                    remoteAudioRef.current.srcObject = remoteStream;
                    remoteAudioRef.current.play().catch(e => console.error('Remote audio play failed', e));
                }
                setIsVoiceConnected(true);
            });

            peer.on('connect', () => {
                console.log('Peer connected');
                setIsVoiceConnected(true);
            });

            peer.on('error', (err) => {
                console.error('Peer error:', err);
            });

            peer.on('close', () => {
                console.log('Peer closed');
                setIsVoiceConnected(false);
            });

            // Log ICE states for debugging
            peer.on('iceStateChange', (state: string) => {
                console.log('ICE state:', state);
            });

            peerRef.current = peer;
            setIsMicEnabled(true);

        } catch (err) {
            console.error('Failed to initialize voice:', err);
        }
    }, [trigger, myUserId, startAudioDucking]);

    // Handle incoming signals
    useEffect(() => {
        if (!isConnected) return;

        const onSignal = (data: { signal: any; userId: string }) => {
            // Ignore own signals
            if (data.userId === myUserId) return;

            if (peerRef.current) {
                // Already have a peer, just signal
                peerRef.current.signal(data.signal);
            } else {
                // No peer yet, create one as non-initiator
                initializePeer(false).then(() => {
                    if (peerRef.current) {
                        peerRef.current.signal(data.signal);
                    }
                });
            }
        };

        bind('client-signal', onSignal);

        return () => {
            unbind('client-signal', onSignal);
        };
    }, [isConnected, bind, unbind, myUserId, initializePeer]);

    // Toggle mic
    const toggleMic = useCallback(() => {
        if (streamRef.current) {
            const enabled = !isMicEnabled;
            streamRef.current.getAudioTracks().forEach(track => {
                track.enabled = enabled;
            });
            setIsMicEnabled(enabled);
        }
    }, [isMicEnabled]);

    // Start voice chat
    const startVoice = useCallback(() => {
        if (!peerRef.current) {
            initializePeer(true);
        }
    }, [initializePeer]);

    // End voice chat
    const endVoice = useCallback(() => {
        cleanup();
    }, [cleanup]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            cleanup();
        };
    }, [cleanup]);

    return {
        isMicEnabled,
        isVoiceConnected,
        micVolume,
        toggleMic,
        startVoice,
        endVoice,
        remoteAudioRef,
    };
};
