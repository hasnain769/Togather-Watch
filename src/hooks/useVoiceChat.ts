import { useEffect, useRef, useState } from 'react';
import SimplePeer from 'simple-peer';
import { Socket } from 'socket.io-client';
import { SignalPayload } from '@/lib/types';

interface UseVoiceChatProps {
    socket: Socket | null;
    roomId: string;
    userId: string;
}

export const useVoiceChat = ({ socket, roomId, userId }: UseVoiceChatProps) => {
    const [peers, setPeers] = useState<SimplePeer.Instance[]>([]);
    const [stream, setStream] = useState<MediaStream | null>(null);
    const [isMicEnabled, setIsMicEnabled] = useState(false);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const peersRef = useRef<{ peerID: string; peer: SimplePeer.Instance }[]>([]);

    useEffect(() => {
        // Initialize local audio stream
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            navigator.mediaDevices.getUserMedia({ audio: true })
                .then((currentStream) => {
                    setStream(currentStream);
                    currentStream.getAudioTracks().forEach(track => track.enabled = false);
                    setIsMicEnabled(false);
                })
                .catch(err => console.error('Error accessing media devices:', err));
        } else {
            console.warn("navigator.mediaDevices.getUserMedia is not defined. Ensure you are using HTTPS or localhost.");
        }
    }, []);

    const toggleMic = () => {
        if (stream) {
            const enabled = !isMicEnabled;
            stream.getAudioTracks().forEach(track => track.enabled = enabled);
            setIsMicEnabled(enabled);
        }
    };

    const createPeer = (userToSignal: string, callerID: string, stream: MediaStream) => {
        const peer = new SimplePeer({
            initiator: true,
            trickle: false,
            stream,
        });

        peer.on('signal', (signal) => {
            socket?.emit('signal', {
                target: userToSignal,
                callerID,
                signal,
            });
        });

        peer.on('stream', (remoteStream) => {
            // Assume single peer for MVP, set to audio ref
            if (audioRef.current) {
                audioRef.current.srcObject = remoteStream;
                audioRef.current.play().catch(e => console.error("Auto-play failed", e));
            }
        });

        return peer;
    };

    const addPeer = (incomingSignal: any, callerID: string, stream: MediaStream) => {
        const peer = new SimplePeer({
            initiator: false,
            trickle: false,
            stream,
        });

        peer.on('signal', (signal) => {
            socket?.emit('signal', {
                target: callerID,
                callerID: userId, // I am sending back
                signal,
            });
        });

        peer.on('stream', (remoteStream) => {
            if (audioRef.current) {
                audioRef.current.srcObject = remoteStream;
                audioRef.current.play().catch(e => console.error("Auto-play failed", e));
            }
        });

        peer.signal(incomingSignal);

        return peer;
    };

    useEffect(() => {
        if (!socket || !stream) return;

        socket.on('all-users', (users: string[]) => {
            const peersList: SimplePeer.Instance[] = [];
            users.forEach((userID) => {
                const peer = createPeer(userID, socket.id!, stream);
                peersRef.current.push({
                    peerID: userID,
                    peer,
                });
                peersList.push(peer);
            });
            setPeers(peersList);
        });

        socket.on('signal', (payload: any) => {
            // payload: { signal, callerID }
            // Check if we already have a peer for this caller
            const item = peersRef.current.find(p => p.peerID === payload.callerID);
            if (item) {
                item.peer.signal(payload.signal);
            } else {
                // Incoming call
                const peer = addPeer(payload.signal, payload.callerID, stream);
                peersRef.current.push({
                    peerID: payload.callerID,
                    peer,
                });
                setPeers(prev => [...prev, peer]);
            }
        });

        socket.on('user-disconnected', (id: string) => {
            const peerObj = peersRef.current.find(p => p.peerID === id);
            if (peerObj) {
                peerObj.peer.destroy();
            }
            peersRef.current = peersRef.current.filter(p => p.peerID !== id);
            setPeers(peersRef.current.map(p => p.peer));
        });

        return () => {
            socket.off('all-users');
            socket.off('signal');
            socket.off('user-disconnected');
        };
    }, [socket, stream, roomId]);

    return {
        isMicEnabled,
        toggleMic,
        audioRef // Ref to attach to <audio> element in UI
    };
};
