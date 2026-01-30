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
const fs = require('fs');

// Store active rooms and their participants
const rooms = new Map();

// Serve static files from public directory if it exists
const publicPath = path.join(__dirname, 'public');
if (fs.existsSync(publicPath)) {
    app.use(express.static(publicPath));
} else {
    console.log('Public directory not found, serving HTML inline');
}

app.get('/', (req, res) => {
    const htmlPath = path.join(__dirname, 'public', 'index.html');
    
    // Check if public/index.html exists
    if (fs.existsSync(htmlPath)) {
        res.sendFile(htmlPath);
    } else {
        // Check if index.html exists in root
        const rootHtmlPath = path.join(__dirname, 'index.html');
        if (fs.existsSync(rootHtmlPath)) {
            res.sendFile(rootHtmlPath);
        } else {
            res.status(500).send(`
                <h1>Setup Error</h1>
                <p>The index.html file is missing. Please make sure to upload it.</p>
                <p>Expected location: ${htmlPath}</p>
                <p>Alternative location: ${rootHtmlPath}</p>
                <p>Current directory: ${__dirname}</p>
                <p>Files in current directory: ${fs.readdirSync(__dirname).join(', ')}</p>
            `);
        }
    }
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

    // Drawing mode handlers
    socket.on('drawing-data', ({ roomId, x0, y0, x1, y1, color, size, tool }) => {
        // Broadcast drawing data to all other users in the room
        socket.to(roomId).emit('drawing-data', {
            x0, y0, x1, y1, color, size, tool
        });
    });

    socket.on('clear-canvas', ({ roomId }) => {
        // Broadcast clear canvas to all users in the room
        io.to(roomId).emit('clear-canvas');
    });

    socket.on('drawing-mode-start', ({ roomId }) => {
        const room = rooms.get(roomId);
        if (room && room.has(socket.id)) {
            const user = room.get(socket.id);
            socket.to(roomId).emit('user-drawing-mode', {
                username: user.username,
                isActive: true
            });
        }
    });

    socket.on('drawing-mode-stop', ({ roomId }) => {
        const room = rooms.get(roomId);
        if (room && room.has(socket.id)) {
            const user = room.get(socket.id);
            socket.to(roomId).emit('user-drawing-mode', {
                username: user.username,
                isActive: false
            });
        }
    });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Open http://localhost:${PORT} in your browser`);
});
