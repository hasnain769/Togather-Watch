import { createServer } from "http";
import next from "next";
import { Server } from "socket.io";
import { parse } from "url";

const dev = process.env.NODE_ENV !== "production";
const app = next({ dev });
const handle = app.getRequestHandler();

const port = process.env.PORT || 3000;

app.prepare().then(() => {
    const server = createServer((req, res) => {
        const parsedUrl = parse(req.url!, true);
        handle(req, res, parsedUrl);
    });

    const io = new Server(server, {
        cors: {
            origin: "*",
            methods: ["GET", "POST"]
        }
    });

    interface Room {
        users: Set<string>;
        videoState?: {
            playing: boolean;
            timestamp: number;
            url?: string;
        };
    }

    const rooms = new Map<string, Room>();

    io.on("connection", (socket: any) => {
        console.log("Client connected:", socket.id);

        socket.on("join-room", (roomId: string) => {
            let room = rooms.get(roomId);

            if (!room) {
                room = { users: new Set() };
                rooms.set(roomId, room);
            }

            if (room.users.size >= 2) {
                const usersArray = Array.from(room.users);
                if (!usersArray.includes(socket.id)) {
                    socket.emit("room-full");
                    return;
                }
            }

            socket.join(roomId);
            room.users.add(socket.id);
            console.log(`Socket ${socket.id} joined room ${roomId}`);

            // Notify others in room
            socket.to(roomId).emit("user-joined", socket.id);

            // Send current state if available
            if (room.videoState) {
                socket.emit("video-sync", room.videoState);
            }

            // Send list of existing users to the new user (for WebRTC init)
            const usersInRoom = Array.from(room.users).filter((id: string) => id !== socket.id);
            socket.emit("all-users", usersInRoom);
        });

        socket.on("video-update", ({ roomId, playing, timestamp, url }: { roomId: string; playing: boolean; timestamp: number; url?: string }) => {
            // console.log(`Video update in ${roomId}:`, { playing, timestamp, url });
            const room = rooms.get(roomId);
            if (room) {
                room.videoState = { playing, timestamp, url };
                socket.to(roomId).emit("video-update", { playing, timestamp, url });
            }
        });

        socket.on("signal", (payload: { target: string; signal: any; callerID: string }) => {
            // Payload: { target: string, signal: any, callerID: string }
            // Relay signal to specific target
            io.to(payload.target).emit("signal", {
                signal: payload.signal,
                callerID: payload.callerID
            });
        });

        socket.on("voice-note", (payload: { audioBlob: Buffer; duration: number }) => {
            const socketRooms = Array.from(socket.rooms) as string[];
            socketRooms.forEach((roomId) => {
                if (roomId !== socket.id) {
                    socket.to(roomId).emit("voice-note", {
                        senderId: socket.id,
                        audioBlob: payload.audioBlob,
                        duration: payload.duration
                    });
                }
            });
        });

        socket.on("disconnecting", () => {
            const socketRooms = Array.from(socket.rooms) as string[];
            socketRooms.forEach((roomId) => {
                const room = rooms.get(roomId);
                if (room) {
                    room.users.delete(socket.id);
                    socket.to(roomId).emit("user-disconnected", socket.id);
                    if (room.users.size === 0) {
                        rooms.delete(roomId);
                    }
                }
            });
        });

        socket.on("disconnect", () => {
            console.log("Client disconnected:", socket.id);
        });
    });

    server.listen(port, () => {
        console.log(`> Ready on http://localhost:${port}`);
    });
});
