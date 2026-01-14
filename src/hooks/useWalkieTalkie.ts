'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

const MAX_RECORD_SECONDS = 3; // Keep short for Pusher 10KB limit
const AUDIO_BITRATE = 24000; // 24kbps for small file size
const SEND_COOLDOWN_MS = 1000; // 1 second cooldown between sends to avoid Pusher rate limits

interface UseWalkieTalkieProps {
    trigger: (event: string, data: any) => void;
    bind: (event: string, callback: (data: any) => void) => void;
    unbind: (event: string, callback?: (data: any) => void) => void;
    isConnected: boolean;
    channel: any;
    myUserId: string | null;
    onAudioReceived: (audioBlob: Blob) => void;
}

export const useWalkieTalkie = ({
    trigger,
    bind,
    unbind,
    isConnected,
    channel,
    myUserId,
    onAudioReceived,
}: UseWalkieTalkieProps) => {
    // State
    const [isRecording, setIsRecording] = useState(false);
    const [countdown, setCountdown] = useState(MAX_RECORD_SECONDS);
    const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');

    // Refs
    const streamRef = useRef<MediaStream | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const countdownInterval = useRef<NodeJS.Timeout | null>(null);
    const autoStopTimeout = useRef<NodeJS.Timeout | null>(null);
    const isHoldingRef = useRef(false); // Track if button is still held
    const lastSendTimeRef = useRef(0);

    // Update connection status based on channel
    useEffect(() => {
        if (isConnected && channel) {
            setConnectionStatus('connected');
        } else if (isConnected) {
            setConnectionStatus('connecting');
        } else {
            setConnectionStatus('disconnected');
        }
    }, [isConnected, channel]);

    // Send audio chunk via Pusher
    const sendAudioChunk = useCallback(async (blob: Blob) => {
        // Rate limiting
        const now = Date.now();
        const timeSinceLastSend = now - lastSendTimeRef.current;
        if (timeSinceLastSend < SEND_COOLDOWN_MS) {
            await new Promise(resolve => setTimeout(resolve, SEND_COOLDOWN_MS - timeSinceLastSend));
        }

        const buffer = await blob.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.length; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        const base64Audio = btoa(binary);

        console.log('Sending audio chunk. Size:', buffer.byteLength, 'bytes');

        try {
            trigger('client-audio', {
                audio: base64Audio,
                senderId: myUserId
            });
            lastSendTimeRef.current = Date.now();
            console.log('Audio chunk sent successfully');
        } catch (err) {
            console.error('Send error:', err);
        }
    }, [trigger, myUserId]);

    // Cleanup timers only (keep stream alive for continuous recording)
    const cleanupTimers = useCallback(() => {
        if (countdownInterval.current) {
            clearInterval(countdownInterval.current);
            countdownInterval.current = null;
        }
        if (autoStopTimeout.current) {
            clearTimeout(autoStopTimeout.current);
            autoStopTimeout.current = null;
        }
    }, []);

    // Full cleanup
    const cleanup = useCallback(() => {
        cleanupTimers();
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        chunksRef.current = [];
        setIsRecording(false);
        setCountdown(MAX_RECORD_SECONDS);
        isHoldingRef.current = false;
    }, [cleanupTimers]);

    // Handle incoming audio via Pusher
    useEffect(() => {
        if (!isConnected || !channel) return;

        const onAudioMessage = (data: { audio: string; senderId: string }) => {
            if (data.senderId === myUserId) return;

            console.log('Received audio message from:', data.senderId);

            try {
                const binaryString = atob(data.audio);
                const bytes = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                    bytes[i] = binaryString.charCodeAt(i);
                }
                const blob = new Blob([bytes], { type: 'audio/webm' });
                onAudioReceived(blob);
            } catch (err) {
                console.error('Failed to decode audio:', err);
            }
        };

        bind('client-audio', onAudioMessage);

        return () => {
            unbind('client-audio', onAudioMessage);
        };
    }, [isConnected, channel, bind, unbind, myUserId, onAudioReceived]);

    // Start a single recording session (3 seconds)
    const startRecordingSession = useCallback(async (existingStream?: MediaStream) => {
        if (!isConnected || !channel) {
            console.warn('Not connected, cannot record');
            return;
        }

        try {
            // Use existing stream or get new one
            const stream = existingStream || await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                }
            });

            if (!existingStream) {
                console.log('Microphone access granted');
            }

            streamRef.current = stream;
            chunksRef.current = [];

            const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
                ? 'audio/webm;codecs=opus'
                : 'audio/webm';

            const recorder = new MediaRecorder(stream, {
                mimeType,
                audioBitsPerSecond: AUDIO_BITRATE,
            });

            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    chunksRef.current.push(e.data);
                }
            };

            recorder.onstop = async () => {
                if (chunksRef.current.length > 0) {
                    const blob = new Blob(chunksRef.current, { type: mimeType });
                    await sendAudioChunk(blob);
                }
                chunksRef.current = [];

                // If still holding, start a new session
                if (isHoldingRef.current && streamRef.current) {
                    console.log('Still holding, starting new 3s session');
                    setCountdown(MAX_RECORD_SECONDS);
                    startRecordingSession(streamRef.current);
                } else {
                    // Fully cleanup
                    cleanup();
                }
            };

            mediaRecorderRef.current = recorder;
            recorder.start();
            setIsRecording(true);
            setCountdown(MAX_RECORD_SECONDS);

            // Start countdown
            countdownInterval.current = setInterval(() => {
                setCountdown(prev => {
                    if (prev <= 1) return 0;
                    return prev - 1;
                });
            }, 1000);

            // Auto-stop this session after max time
            autoStopTimeout.current = setTimeout(() => {
                console.log('Auto-stopping 3s session');
                cleanupTimers();
                if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
                    mediaRecorderRef.current.stop();
                }
            }, MAX_RECORD_SECONDS * 1000);

        } catch (err) {
            console.error('Failed to start recording:', err);
            cleanup();
        }
    }, [isConnected, channel, cleanup, cleanupTimers, sendAudioChunk]);

    // Start recording (called on button press)
    const startRecording = useCallback(async () => {
        console.log('startRecording - button pressed');
        isHoldingRef.current = true;
        startRecordingSession();
    }, [startRecordingSession]);

    // Stop recording (called on button release)
    const stopRecording = useCallback(() => {
        console.log('stopRecording - button released');
        isHoldingRef.current = false;
        cleanupTimers();
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            mediaRecorderRef.current.stop();
        }
    }, [cleanupTimers]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            cleanup();
        };
    }, [cleanup]);

    return {
        isRecording,
        countdown,
        isChannelOpen: isConnected && !!channel,
        connectionStatus,
        startRecording,
        stopRecording,
        maxSeconds: MAX_RECORD_SECONDS,
    };
};
