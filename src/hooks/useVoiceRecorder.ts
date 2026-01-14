import { useState, useRef, useCallback } from 'react';

interface UseVoiceRecorderReturn {
    isRecording: boolean;
    startRecording: () => Promise<void>;
    stopRecording: () => Promise<Blob | null>;
    isSupported: boolean;
}

export const useVoiceRecorder = (): UseVoiceRecorderReturn => {
    const [isRecording, setIsRecording] = useState(false);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);

    const startRecording = useCallback(async () => {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            console.warn("Audio recording not supported (HTTPS required)");
            return;
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            mediaRecorder.start();
            setIsRecording(true);
        } catch (err) {
            console.error("Error starting recording:", err);
        }
    }, []);

    const stopRecording = useCallback((): Promise<Blob | null> => {
        return new Promise((resolve) => {
            const mediaRecorder = mediaRecorderRef.current;
            if (!mediaRecorder || mediaRecorder.state === 'inactive') {
                resolve(null);
                return;
            }

            mediaRecorder.onstop = () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                // Stop all tracks to release microphone
                mediaRecorder.stream.getTracks().forEach(track => track.stop());
                resolve(audioBlob);
            };

            mediaRecorder.stop();
            setIsRecording(false);
        });
    }, []);

    return {
        isRecording,
        startRecording,
        stopRecording,
        isSupported: (typeof navigator !== 'undefined' && !!navigator.mediaDevices && !!navigator.mediaDevices.getUserMedia)
    };
};
