import { NextRequest, NextResponse } from 'next/server';
import pusherServer from '@/lib/pusher';

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const socketId = formData.get('socket_id') as string;
        const channelName = formData.get('channel_name') as string;

        if (!socketId || !channelName) {
            return NextResponse.json({ error: 'Missing socket_id or channel_name' }, { status: 400 });
        }

        // For presence channels, we need to provide user data
        if (channelName.startsWith('presence-')) {
            // Generate a simple user ID (in production, use actual auth)
            const uniqueId = `user-${Math.random().toString(36).substring(7)}`;
            const presenceData = {
                user_id: uniqueId,
                user_info: {
                    name: `Guest-${uniqueId.slice(-4)}`,
                },
            };
            const authResponse = pusherServer.authorizeChannel(socketId, channelName, presenceData);
            return NextResponse.json(authResponse);
        }

        // For private channels
        const authResponse = pusherServer.authorizeChannel(socketId, channelName);
        return NextResponse.json(authResponse);

    } catch (error) {
        console.error('Pusher auth error:', error);
        return NextResponse.json({ error: 'Auth failed' }, { status: 500 });
    }
}
