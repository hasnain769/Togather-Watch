'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import Pusher, { PresenceChannel, Members } from 'pusher-js';

interface UsePusherProps {
    roomId: string;
    enabled?: boolean;
}

interface PusherMember {
    id: string;
    info: { name: string };
}

export const usePusher = ({ roomId, enabled = true }: UsePusherProps) => {
    const [isConnected, setIsConnected] = useState(false);
    const [members, setMembers] = useState<PusherMember[]>([]);
    const [myUserId, setMyUserId] = useState<string | null>(null);
    const [channel, setChannel] = useState<PresenceChannel | null>(null);
    const pusherRef = useRef<Pusher | null>(null);

    useEffect(() => {
        if (!enabled || !roomId) return;

        const pusherKey = process.env.NEXT_PUBLIC_PUSHER_KEY;
        const pusherCluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;

        if (!pusherKey || !pusherCluster) {
            console.error('Pusher credentials not configured');
            return;
        }

        // Initialize Pusher
        const pusher = new Pusher(pusherKey, {
            cluster: pusherCluster,
            authEndpoint: '/api/pusher/auth',
        });

        pusherRef.current = pusher;

        pusher.connection.bind('connected', () => {
            setIsConnected(true);
            console.log('Pusher connected');
        });

        pusher.connection.bind('disconnected', () => {
            setIsConnected(false);
            console.log('Pusher disconnected');
        });

        pusher.connection.bind('error', (err: any) => {
            // Rate limit errors are expected with client events, using warn
            console.warn('Pusher connection issue:', err?.data?.code || err);
        });

        // Subscribe to presence channel
        const channelName = `presence-room-${roomId}`;
        const presenceChannel = pusher.subscribe(channelName) as PresenceChannel;

        presenceChannel.bind('pusher:subscription_succeeded', (membersData: Members) => {
            console.log('Subscribed to channel, members:', membersData.count);
            setMyUserId(membersData.myID);
            const memberList: PusherMember[] = [];
            membersData.each((member: { id: string; info: { name: string } }) => {
                memberList.push({ id: member.id, info: member.info });
            });
            setMembers(memberList);
            setChannel(presenceChannel); // Set channel AFTER subscription succeeds
        });

        presenceChannel.bind('pusher:member_added', (member: { id: string; info: { name: string } }) => {
            console.log('Member joined:', member.id);
            setMembers(prev => [...prev, { id: member.id, info: member.info }]);
        });

        presenceChannel.bind('pusher:member_removed', (member: { id: string; info: { name: string } }) => {
            console.log('Member left:', member.id);
            setMembers(prev => prev.filter(m => m.id !== member.id));
        });

        presenceChannel.bind('pusher:subscription_error', (error: any) => {
            console.error('Pusher subscription error:', error);
        });

        return () => {
            presenceChannel.unbind_all();
            pusher.unsubscribe(channelName);
            pusher.disconnect();
            pusherRef.current = null;
            setChannel(null);
        };
    }, [roomId, enabled]);

    // Trigger client event - must be prefixed with 'client-'
    const trigger = useCallback((eventName: string, data: any) => {
        if (channel) {
            console.log('Triggering event:', eventName, data);
            channel.trigger(eventName, data);
        } else {
            console.warn('Cannot trigger, channel not ready');
        }
    }, [channel]);

    // Bind to client event
    const bind = useCallback((eventName: string, callback: (data: any) => void) => {
        if (channel) {
            channel.bind(eventName, callback);
        }
    }, [channel]);

    // Unbind from event
    const unbind = useCallback((eventName: string, callback?: (data: any) => void) => {
        if (channel) {
            channel.unbind(eventName, callback);
        }
    }, [channel]);

    return {
        isConnected,
        members,
        myUserId,
        memberCount: members.length,
        trigger,
        bind,
        unbind,
        channel,
    };
};
