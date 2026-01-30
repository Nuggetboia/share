const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');

const PORT = process.env.PORT || 3000;

// Store rooms: roomCode -> { users: Map<socketId, userData>, sharers: Set<socketId> }
const rooms = new Map();

// Generate a random 6-character room code
function generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Avoiding ambiguous characters
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    // Make sure code is unique
    if (rooms.has(code)) {
        return generateRoomCode();
    }
    return code;
}

// Middleware
app.use(express.static(path.join(__dirname, 'public')));

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

io.on('connection', (socket) => {
    console.log('✅ User connected:', socket.id);
    let currentRoom = null;

    socket.on('create-room', () => {
        const roomCode = generateRoomCode();
        currentRoom = roomCode;

        // Initialize room
        rooms.set(roomCode, {
            users: new Map(),
            sharers: new Set(),
            createdAt: Date.now()
        });

        // Add creator to room
        rooms.get(roomCode).users.set(socket.id, {
            id: socket.id,
            username: `User-${socket.id.substring(0, 4)}`,
            isSharing: false
        });

        socket.join(roomCode);
        
        console.log(`📦 Room created: ${roomCode} by ${socket.id}`);
        
        socket.emit('room-created', {
            roomCode,
            userCount: rooms.get(roomCode).users.size
        });
    });

    socket.on('join-room', (data) => {
        const { roomCode } = data;

        if (!rooms.has(roomCode)) {
            socket.emit('room-error', { error: 'Room not found. Please check the code.' });
            return;
        }

        currentRoom = roomCode;
        const room = rooms.get(roomCode);

        // Add user to room
        room.users.set(socket.id, {
            id: socket.id,
            username: `User-${socket.id.substring(0, 4)}`,
            isSharing: false
        });

        socket.join(roomCode);

        console.log(`👋 ${socket.id} joined room: ${roomCode}`);

        // Get list of current sharers
        const sharers = Array.from(room.sharers).map(sharerId => {
            const user = room.users.get(sharerId);
            return {
                id: sharerId,
                username: user ? user.username : 'Unknown'
            };
        });

        // Tell the new user about the room
        socket.emit('room-joined', {
            roomCode,
            userCount: room.users.size,
            sharers
        });

        // Tell others about the new user
        socket.to(roomCode).emit('user-joined', {
            id: socket.id,
            username: `User-${socket.id.substring(0, 4)}`,
            userCount: room.users.size
        });
    });

    socket.on('start-sharing', (data) => {
        const { roomCode } = data;

        if (!rooms.has(roomCode)) {
            return;
        }

        const room = rooms.get(roomCode);
        room.sharers.add(socket.id);

        const user = room.users.get(socket.id);
        if (user) {
            user.isSharing = true;
        }

        console.log(`📺 ${socket.id} started sharing in ${roomCode}`);

        // Notify all users in the room
        io.to(roomCode).emit('user-sharing', {
            id: socket.id,
            username: user ? user.username : 'Unknown',
            isSharing: true
        });
    });

    socket.on('stop-sharing', (data) => {
        const { roomCode } = data;

        if (!rooms.has(roomCode)) {
            return;
        }

        const room = rooms.get(roomCode);
        room.sharers.delete(socket.id);

        const user = room.users.get(socket.id);
        if (user) {
            user.isSharing = false;
        }

        console.log(`🛑 ${socket.id} stopped sharing in ${roomCode}`);

        // Notify all users in the room
        io.to(roomCode).emit('user-sharing', {
            id: socket.id,
            username: user ? user.username : 'Unknown',
            isSharing: false
        });
    });

    socket.on('request-stream', (data) => {
        const { roomCode, targetId } = data;
        
        console.log(`📞 ${socket.id} requesting stream from ${targetId} in ${roomCode}`);
        
        // Forward request to the target
        io.to(targetId).emit('request-stream', {
            fromId: socket.id
        });
    });

    socket.on('webrtc-offer', (data) => {
        const { roomCode, targetId, offer } = data;
        
        console.log(`📤 Forwarding offer from ${socket.id} to ${targetId}`);
        
        io.to(targetId).emit('webrtc-offer', {
            fromId: socket.id,
            offer
        });
    });

    socket.on('webrtc-answer', (data) => {
        const { roomCode, targetId, answer } = data;
        
        console.log(`📤 Forwarding answer from ${socket.id} to ${targetId}`);
        
        io.to(targetId).emit('webrtc-answer', {
            fromId: socket.id,
            answer
        });
    });

    socket.on('webrtc-ice-candidate', (data) => {
        const { roomCode, targetId, candidate } = data;
        
        io.to(targetId).emit('webrtc-ice-candidate', {
            fromId: socket.id,
            candidate
        });
    });

    socket.on('disconnect', () => {
        console.log('❌ User disconnected:', socket.id);

        // Remove user from all rooms
        rooms.forEach((room, roomCode) => {
            if (room.users.has(socket.id)) {
                const user = room.users.get(socket.id);
                
                room.users.delete(socket.id);
                room.sharers.delete(socket.id);

                // Notify others
                io.to(roomCode).emit('user-left', {
                    id: socket.id,
                    username: user.username,
                    userCount: room.users.size
                });

                console.log(`   Removed from room ${roomCode}`);

                // Clean up empty rooms (older than 1 hour or empty)
                if (room.users.size === 0) {
                    rooms.delete(roomCode);
                    console.log(`   🗑️ Deleted empty room ${roomCode}`);
                }
            }
        });
    });
});

// Clean up old rooms every hour
setInterval(() => {
    const now = Date.now();
    const ONE_HOUR = 60 * 60 * 1000;

    rooms.forEach((room, roomCode) => {
        if (room.users.size === 0 && (now - room.createdAt) > ONE_HOUR) {
            rooms.delete(roomCode);
            console.log(`🗑️ Cleaned up old room: ${roomCode}`);
        }
    });
}, ONE_HOUR);

http.listen(PORT, () => {
    console.log('');
    console.log('🚀 ShareView Server Running');
    console.log('============================');
    console.log(`📍 URL: http://localhost:${PORT}`);
    console.log('');
    console.log('💡 How to use:');
    console.log('   1. Open http://localhost:' + PORT);
    console.log('   2. Click "Create Room" to get a 6-digit code');
    console.log('   3. Share the code with others');
    console.log('   4. Others click "Join Room" and enter the code');
    console.log('   5. Click "Start Sharing" to share your screen');
    console.log('   6. Others will see you in "Active Sharers" and can click to view');
    console.log('');
});

process.on('SIGTERM', () => {
    console.log('\n🛑 Shutting down gracefully...');
    http.close(() => {
        console.log('✅ Server closed');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down gracefully...');
    http.close(() => {
        console.log('✅ Server closed');
        process.exit(0);
    });
});
