const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');

const PORT = process.env.PORT || 3000;

// Store active rooms and their users
const rooms = new Map();

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Handle root route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Handle room routes
app.get('/:roomId', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);
    
    socket.on('join-room', (roomId, userId) => {
        console.log(`User ${userId} joining room ${roomId}`);
        socket.join(roomId);
        
        // Initialize room if it doesn't exist
        if (!rooms.has(roomId)) {
            rooms.set(roomId, new Set());
        }
        
        rooms.get(roomId).add(socket.id);
        
        // Notify others in the room
        socket.to(roomId).emit('user-connected', userId);
        
        // Send list of existing users to the new user
        const existingUsers = Array.from(rooms.get(roomId)).filter(id => id !== socket.id);
        socket.emit('existing-users', existingUsers);
        
        console.log(`Room ${roomId} now has ${rooms.get(roomId).size} users`);
    });
    
    // Handle screen sharing start
    socket.on('start-sharing', (roomId) => {
        console.log(`User ${socket.id} started sharing in room ${roomId}`);
        socket.to(roomId).emit('user-started-sharing', socket.id);
    });
    
    // Handle screen sharing stop
    socket.on('stop-sharing', (roomId) => {
        console.log(`User ${socket.id} stopped sharing in room ${roomId}`);
        socket.to(roomId).emit('user-stopped-sharing', socket.id);
    });
    
    // WebRTC signaling
    socket.on('offer', (data) => {
        console.log(`Sending offer from ${socket.id} to ${data.to}`);
        io.to(data.to).emit('offer', {
            offer: data.offer,
            from: socket.id
        });
    });
    
    socket.on('answer', (data) => {
        console.log(`Sending answer from ${socket.id} to ${data.to}`);
        io.to(data.to).emit('answer', {
            answer: data.answer,
            from: socket.id
        });
    });
    
    socket.on('ice-candidate', (data) => {
        console.log(`Sending ICE candidate from ${socket.id} to ${data.to}`);
        io.to(data.to).emit('ice-candidate', {
            candidate: data.candidate,
            from: socket.id
        });
    });
    
    // Chat messages
    socket.on('chat-message', (data) => {
        console.log(`Chat message in room ${data.roomId}: ${data.message}`);
        io.to(data.roomId).emit('chat-message', {
            message: data.message,
            sender: data.sender,
            timestamp: Date.now()
        });
    });
    
    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        
        // Remove user from all rooms
        rooms.forEach((users, roomId) => {
            if (users.has(socket.id)) {
                users.delete(socket.id);
                socket.to(roomId).emit('user-disconnected', socket.id);
                
                // Clean up empty rooms
                if (users.size === 0) {
                    rooms.delete(roomId);
                }
            }
        });
    });
});

http.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Visit http://localhost:${PORT} to start sharing`);
});
