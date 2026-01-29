const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});
const path = require('path');

// Store active rooms and their participants
const rooms = new Map();

// Serve static files
app.use(express.static('public'));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // Join a room
    socket.on('join-room', ({ roomId, username }) => {
        socket.join(roomId);
        
        // Initialize room if it doesn't exist
        if (!rooms.has(roomId)) {
            rooms.set(roomId, new Map());
        }
        
        // Add user to room
        const room = rooms.get(roomId);
        room.set(socket.id, { username, isSharing: false });
        
        console.log(`${username} (${socket.id}) joined room ${roomId}`);
        
        // Get list of other users in the room
        const otherUsers = Array.from(room.entries())
            .filter(([id]) => id !== socket.id)
            .map(([id, data]) => ({ id, username: data.username, isSharing: data.isSharing }));
        
        // Send list of existing users to the new user
        socket.emit('existing-users', otherUsers);
        
        // Notify other users about the new user
        socket.to(roomId).emit('user-joined', {
            id: socket.id,
            username: username
        });
        
        // Send current room info
        socket.emit('room-info', {
            roomId,
            userCount: room.size
        });
        
        socket.to(roomId).emit('room-info', {
            roomId,
            userCount: room.size
        });
    });

    // Handle chat messages
    socket.on('chat-message', ({ roomId, message, username }) => {
        console.log(`Chat message in ${roomId} from ${username}: ${message}`);
        
        // Broadcast message to all users in the room including sender
        io.to(roomId).emit('chat-message', {
            id: socket.id,
            username,
            message,
            timestamp: Date.now()
        });
    });

    // Handle screen sharing start
    socket.on('start-sharing', ({ roomId }) => {
        const room = rooms.get(roomId);
        if (room && room.has(socket.id)) {
            const user = room.get(socket.id);
            user.isSharing = true;
            
            // Notify all users in the room
            io.to(roomId).emit('user-sharing', {
                id: socket.id,
                username: user.username,
                isSharing: true
            });
        }
    });

    // Handle screen sharing stop
    socket.on('stop-sharing', ({ roomId }) => {
        const room = rooms.get(roomId);
        if (room && room.has(socket.id)) {
            const user = room.get(socket.id);
            user.isSharing = false;
            
            // Notify all users in the room
            io.to(roomId).emit('user-sharing', {
                id: socket.id,
                username: user.username,
                isSharing: false
            });
        }
    });

    // WebRTC signaling
    socket.on('webrtc-offer', ({ roomId, targetId, offer }) => {
        console.log(`WebRTC offer from ${socket.id} to ${targetId}`);
        io.to(targetId).emit('webrtc-offer', {
            fromId: socket.id,
            offer
        });
    });

    socket.on('webrtc-answer', ({ roomId, targetId, answer }) => {
        console.log(`WebRTC answer from ${socket.id} to ${targetId}`);
        io.to(targetId).emit('webrtc-answer', {
            fromId: socket.id,
            answer
        });
    });

    socket.on('webrtc-ice-candidate', ({ roomId, targetId, candidate }) => {
        io.to(targetId).emit('webrtc-ice-candidate', {
            fromId: socket.id,
            candidate
        });
    });

    // Handle disconnection
    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        
        // Remove user from all rooms
        rooms.forEach((room, roomId) => {
            if (room.has(socket.id)) {
                const user = room.get(socket.id);
                room.delete(socket.id);
                
                // Notify other users
                socket.to(roomId).emit('user-left', {
                    id: socket.id,
                    username: user.username
                });
                
                socket.to(roomId).emit('room-info', {
                    roomId,
                    userCount: room.size
                });
                
                // Clean up empty rooms
                if (room.size === 0) {
                    rooms.delete(roomId);
                    console.log(`Room ${roomId} deleted (empty)`);
                }
            }
        });
    });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Open http://localhost:${PORT} in your browser`);
});
