'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

// Player ready states
const HAVE_NOTHING = 0;
const HAVE_METADATA = 1;
const HAVE_CURRENT_DATA = 2;
const HAVE_FUTURE_DATA = 3;
const HAVE_ENOUGH_DATA = 4;

// Sync thresholds
const MICRO_DRIFT_THRESHOLD = 0.3; // 300ms - ignore
const SOFT_SYNC_THRESHOLD = 1.5;   // 1.5s - use playback rate
const HARD_SYNC_THRESHOLD = 1.5;   // Above this - hard seek

// Debounce timing
const DEBOUNCE_MS = 200;

type SyncState = 'idle' | 'requesting' | 'waiting-ack' | 'syncing' | 'playing' | 'paused';

interface UseSyncLogicProps {
    playerRef: React.RefObject<any>;
    trigger: (event: string, data: any) => void;
    bind: (event: string, callback: (data: any) => void) => void;
    unbind: (event: string, callback?: (data: any) => void) => void;
    isConnected: boolean;
    channel: any;
    myUserId: string | null;
}

export const useSyncLogic = ({
    playerRef,
    trigger,
    bind,
    unbind,
    isConnected,
    channel,
    myUserId,
}: UseSyncLogicProps) => {
    const [syncState, setSyncState] = useState<SyncState>('idle');
    const [url, setUrl] = useState('');
    const [isPlaying, setIsPlaying] = useState(false);

    // Sync Lock - prevents race conditions
    const syncLock = useRef(false);
    const isRemoteAction = useRef(false);

    // Pending sync data
    const pendingSync = useRef<{ time: number; initiator: string } | null>(null);

    // Debounce timers
    const debounceTimer = useRef<NodeJS.Timeout | null>(null);

    // Get internal player safely
    const getInternalPlayer = useCallback(() => {
        if (playerRef.current) {
            return playerRef.current.getInternalPlayer?.() || null;
        }
        return null;
    }, [playerRef]);

    // Get current time safely
    const getCurrentTime = useCallback(() => {
        if (playerRef.current && typeof playerRef.current.getCurrentTime === 'function') {
            return playerRef.current.getCurrentTime();
        }
        return 0;
    }, [playerRef]);

    // Seek player
    const seekTo = useCallback((time: number) => {
        if (playerRef.current && typeof playerRef.current.seekTo === 'function') {
            playerRef.current.seekTo(time, 'seconds');
        }
    }, [playerRef]);

    // Check if player is ready (readyState >= 3)
    const isPlayerReady = useCallback(() => {
        const player = getInternalPlayer();
        if (player && typeof player.readyState !== 'undefined') {
            return player.readyState >= HAVE_FUTURE_DATA;
        }
        // Fallback for non-video elements
        return true;
    }, [getInternalPlayer]);

    // ========== LOCAL ACTIONS ==========

    // Play request (Master initiates)
    const requestPlay = useCallback(() => {
        if (syncLock.current) {
            console.log('Sync locked, ignoring play request');
            return;
        }

        const time = getCurrentTime();
        console.log('Requesting play at time:', time);

        syncLock.current = true;
        setSyncState('requesting');
        pendingSync.current = { time, initiator: myUserId || 'self' };

        trigger('client-sync-request', {
            type: 'play',
            time,
            initiator: myUserId
        });

        // Set timeout for ACK
        setTimeout(() => {
            if (syncState === 'requesting' || syncState === 'waiting-ack') {
                console.log('Sync timeout, proceeding alone');
                executePlay();
            }
        }, 3000);
    }, [getCurrentTime, myUserId, trigger, syncState]);

    // Pause (immediate, no handshake needed)
    const requestPause = useCallback(() => {
        if (isRemoteAction.current) {
            isRemoteAction.current = false;
            return;
        }

        const time = getCurrentTime();
        console.log('Pausing at time:', time);

        setIsPlaying(false);
        setSyncState('paused');
        trigger('client-pause', { time });
    }, [getCurrentTime, trigger]);

    // Seek request
    const requestSeek = useCallback((time: number) => {
        if (syncLock.current) {
            console.log('Sync locked, ignoring seek');
            return;
        }
        if (isRemoteAction.current) {
            isRemoteAction.current = false;
            return;
        }

        console.log('Requesting seek to:', time);

        syncLock.current = true;
        setSyncState('syncing');
        pendingSync.current = { time, initiator: myUserId || 'self' };

        trigger('client-sync-request', {
            type: 'seek',
            time,
            initiator: myUserId
        });
    }, [myUserId, trigger]);

    // Execute play (called when both ready)
    const executePlay = useCallback(() => {
        console.log('Executing play');
        const player = getInternalPlayer();
        if (player && typeof player.play === 'function') {
            player.play().catch((e: Error) => console.error('Play failed:', e));
        }
        setIsPlaying(true);
        setSyncState('playing');
        syncLock.current = false;
        pendingSync.current = null;
    }, [getInternalPlayer]);

    // URL Change
    const handleUrlChange = useCallback((newUrl: string) => {
        console.log('URL change:', newUrl);
        setUrl(newUrl);
        setIsPlaying(false);
        setSyncState('idle');
        trigger('client-url', { url: newUrl });
    }, [trigger]);

    // ========== REMOTE EVENT HANDLERS ==========

    useEffect(() => {
        if (!isConnected || !channel) {
            console.log('Sync: Waiting for channel...');
            return;
        }

        console.log('Binding advanced sync events');

        // Handle sync request (Slave receives)
        const onSyncRequest = (data: { type: string; time: number; initiator: string }) => {
            if (data.initiator === myUserId) return; // Ignore own events

            console.log('Received sync request:', data);

            if (syncLock.current) {
                console.log('Already processing sync, ignoring request');
                return;
            }

            syncLock.current = true;
            setSyncState('syncing');
            isRemoteAction.current = true;

            const player = getInternalPlayer();

            // Pause and seek to target time
            if (player) {
                player.pause?.();
                seekTo(data.time);

                // Wait for seeked and ready
                const checkReady = () => {
                    if (isPlayerReady()) {
                        console.log('Ready at time:', data.time, 'sending ACK');
                        trigger('client-sync-ack', {
                            time: data.time,
                            responder: myUserId
                        });

                        if (data.type === 'play') {
                            setSyncState('waiting-ack');
                        } else {
                            syncLock.current = false;
                            setSyncState('paused');
                        }
                    } else {
                        setTimeout(checkReady, 50);
                    }
                };

                // Start checking after a frame
                setTimeout(checkReady, 100);
            }
        };

        // Handle ACK (Master receives)
        const onSyncAck = (data: { time: number; responder: string }) => {
            if (data.responder === myUserId) return;

            console.log('Received sync ACK from:', data.responder);

            if (pendingSync.current) {
                // Both ready, send GO signal
                console.log('Both ready, sending GO');
                trigger('client-sync-go', { time: pendingSync.current.time });
                executePlay();
            }
        };

        // Handle GO (All execute)
        const onSyncGo = (data: { time: number }) => {
            console.log('Received sync GO, playing');
            executePlay();
        };

        // Handle pause
        const onPause = (data: { time: number }) => {
            console.log('Received remote pause');
            isRemoteAction.current = true;
            const player = getInternalPlayer();
            player?.pause?.();
            setIsPlaying(false);
            setSyncState('paused');
        };

        // Handle URL change
        const onUrl = (data: { url: string }) => {
            console.log('Received remote URL:', data.url);
            setUrl(data.url);
            setIsPlaying(false);
            setSyncState('idle');
        };

        // Handle state request (new user asking for current state)
        const onStateRequest = (data: { requesterId: string }) => {
            if (data.requesterId === myUserId) return;

            console.log('Received state request from:', data.requesterId);

            // Send current state back
            trigger('client-state-response', {
                url: url,
                isPlaying: isPlaying,
                time: getCurrentTime(),
                responderId: myUserId,
                targetId: data.requesterId
            });
        };

        // Handle state response (receiving state from existing user)
        const onStateResponse = (data: { url: string; isPlaying: boolean; time: number; responderId: string; targetId: string }) => {
            // Only process if this response is for us
            if (data.targetId !== myUserId) return;

            console.log('Received state response:', data);

            if (data.url && data.url !== url) {
                setUrl(data.url);
            }
            if (data.time > 0) {
                seekTo(data.time);
            }
            setIsPlaying(data.isPlaying);
            setSyncState(data.isPlaying ? 'playing' : 'paused');
        };

        bind('client-sync-request', onSyncRequest);
        bind('client-sync-ack', onSyncAck);
        bind('client-sync-go', onSyncGo);
        bind('client-pause', onPause);
        bind('client-url', onUrl);
        bind('client-state-request', onStateRequest);
        bind('client-state-response', onStateResponse);

        // Request state from other users when we first connect
        console.log('Requesting initial state from room');
        trigger('client-state-request', { requesterId: myUserId });

        return () => {
            unbind('client-sync-request', onSyncRequest);
            unbind('client-sync-ack', onSyncAck);
            unbind('client-sync-go', onSyncGo);
            unbind('client-pause', onPause);
            unbind('client-url', onUrl);
            unbind('client-state-request', onStateRequest);
            unbind('client-state-response', onStateResponse);
        };
    }, [isConnected, channel, bind, unbind, myUserId, trigger, getInternalPlayer, seekTo, isPlayerReady, executePlay, url, isPlaying, getCurrentTime]);

    // ========== DRIFT CORRECTION ==========

    useEffect(() => {
        if (!isConnected || !channel || syncState !== 'playing') return;

        const interval = setInterval(() => {
            if (syncLock.current) return;

            const time = getCurrentTime();
            trigger('client-time-check', { time, sender: myUserId });
        }, 2000);

        const onTimeCheck = (data: { time: number; sender: string }) => {
            if (data.sender === myUserId) return;
            if (syncLock.current) return;

            const localTime = getCurrentTime();
            const diff = Math.abs(data.time - localTime);

            // Ignore micro-drifts
            if (diff < MICRO_DRIFT_THRESHOLD) {
                return;
            }

            const player = getInternalPlayer();

            if (diff > HARD_SYNC_THRESHOLD) {
                // Hard seek
                console.log('Hard seek correction:', diff);
                syncLock.current = true;
                isRemoteAction.current = true;
                seekTo(data.time);
                setTimeout(() => { syncLock.current = false; }, 500);
            } else if (diff > MICRO_DRIFT_THRESHOLD) {
                // Soft sync - adjust playback rate
                if (player && typeof player.playbackRate !== 'undefined') {
                    const rate = data.time > localTime ? 1.05 : 0.95;
                    console.log('Soft sync, rate:', rate);
                    player.playbackRate = rate;

                    // Reset after correction period
                    setTimeout(() => {
                        if (player) player.playbackRate = 1.0;
                    }, 1500);
                }
            }
        };

        bind('client-time-check', onTimeCheck);

        return () => {
            clearInterval(interval);
            unbind('client-time-check', onTimeCheck);
        };
    }, [isConnected, channel, syncState, bind, unbind, trigger, getCurrentTime, seekTo, getInternalPlayer, myUserId]);

    // ========== PLAYER EVENT HANDLERS (Debounced) ==========

    const handlePlayerPlay = useCallback(() => {
        // If triggered by us (remote action), ignore
        if (isRemoteAction.current) {
            isRemoteAction.current = false;
            return;
        }
        // If already syncing, ignore
        if (syncLock.current) return;

        // Debounce
        if (debounceTimer.current) clearTimeout(debounceTimer.current);
        debounceTimer.current = setTimeout(() => {
            requestPlay();
        }, DEBOUNCE_MS);
    }, [requestPlay]);

    const handlePlayerPause = useCallback(() => {
        if (isRemoteAction.current) {
            isRemoteAction.current = false;
            return;
        }
        if (syncLock.current) return;

        if (debounceTimer.current) clearTimeout(debounceTimer.current);
        debounceTimer.current = setTimeout(() => {
            requestPause();
        }, DEBOUNCE_MS);
    }, [requestPause]);

    const handlePlayerSeek = useCallback((time: number) => {
        if (isRemoteAction.current) {
            isRemoteAction.current = false;
            return;
        }
        if (syncLock.current) return;

        if (debounceTimer.current) clearTimeout(debounceTimer.current);
        debounceTimer.current = setTimeout(() => {
            requestSeek(time);
        }, DEBOUNCE_MS);
    }, [requestSeek]);

    const handlePlayerReady = useCallback(() => {
        console.log('Player ready');
        // If we're waiting to ACK, this might be the signal
    }, []);

    return {
        syncState,
        url,
        isPlaying,
        setUrl,
        handleLocalPlay: handlePlayerPlay,
        handleLocalPause: handlePlayerPause,
        handleLocalSeek: handlePlayerSeek,
        handleLocalReady: handlePlayerReady,
        handleUrlChange,
        isRemoteAction,
    };
};
