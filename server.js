const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');

const PORT = process.env.PORT || 3000;

// Store active rooms and their users with metadata
const rooms = new Map();

// Store user profiles (username -> {password, profilePicture, theme})
// In production, use a real database and hash passwords!
const userProfiles = new Map();

// Middleware
app.use(express.json({ limit: '10mb' })); // Increased limit for profile pictures
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// API endpoint to register user
app.post('/api/register', (req, res) => {
    console.log('Register request:', req.body);
    const { username, password } = req.body;
    
    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password required' });
    }
    
    if (userProfiles.has(username.toLowerCase())) {
        return res.status(409).json({ error: 'Username already taken' });
    }
    
    // In production: hash the password with bcrypt!
    userProfiles.set(username.toLowerCase(), {
        username: username, // Store original case
        password: password, // INSECURE: hash this in production!
        profilePicture: null,
        theme: 'light',
        createdAt: Date.now()
    });
    
    console.log('User registered:', username);
    res.json({ success: true, message: 'User registered successfully' });
});

// API endpoint to login
app.post('/api/login', (req, res) => {
    console.log('Login request:', req.body);
    const { username, password } = req.body;
    
    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password required' });
    }
    
    const user = userProfiles.get(username.toLowerCase());
    if (!user || user.password !== password) {
        return res.status(401).json({ error: 'Invalid username or password' });
    }
    
    console.log('User logged in:', username);
    res.json({
        success: true,
        profile: {
            username: user.username,
            profilePicture: user.profilePicture,
            theme: user.theme
        }
    });
});

// API endpoint to update profile
app.post('/api/update-profile', (req, res) => {
    console.log('Update profile request');
    const { username, profilePicture, theme } = req.body;
    
    if (!username) {
        return res.status(400).json({ error: 'Username required' });
    }
    
    const user = userProfiles.get(username.toLowerCase());
    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }
    
    if (profilePicture !== undefined) {
        user.profilePicture = profilePicture;
    }
    if (theme !== undefined) {
        user.theme = theme;
    }
    
    console.log('Profile updated:', username);
    res.json({ success: true, message: 'Profile updated' });
});

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
    
    socket.on('join-room', (data) => {
        const { roomId, username } = data;
        console.log(`User ${username} (${socket.id}) joining room ${roomId}`);
        socket.join(roomId);
        
        // Initialize room if it doesn't exist
        if (!rooms.has(roomId)) {
            rooms.set(roomId, new Map());
        }
        
        // Store user info
        rooms.get(roomId).set(socket.id, { id: socket.id, username, isSharing: false });
        
        // Get existing users
        const existingUsers = Array.from(rooms.get(roomId).values()).filter(u => u.id !== socket.id);
        
        // Send existing users to new user
        socket.emit('existing-users', existingUsers);
        
        // Notify others about new user
        socket.to(roomId).emit('user-joined', { id: socket.id, username });
        
        // Send room info
        socket.emit('room-info', { roomId, userCount: rooms.get(roomId).size });
        
        console.log(`Room ${roomId} now has ${rooms.get(roomId).size} users`);
    });
    
    // Handle screen sharing start
    socket.on('start-sharing', (data) => {
        const { roomId } = data;
        console.log(`User ${socket.id} started sharing in room ${roomId}`);
        
        // Update user's sharing status
        if (rooms.has(roomId) && rooms.get(roomId).has(socket.id)) {
            const user = rooms.get(roomId).get(socket.id);
            user.isSharing = true;
            
            // Notify all users in room (including sender)
            io.to(roomId).emit('user-sharing', {
                id: socket.id,
                username: user.username,
                isSharing: true
            });
        }
    });
    
    // Handle screen sharing stop
    socket.on('stop-sharing', (data) => {
        const { roomId } = data;
        console.log(`User ${socket.id} stopped sharing in room ${roomId}`);
        
        // Update user's sharing status
        if (rooms.has(roomId) && rooms.get(roomId).has(socket.id)) {
            const user = rooms.get(roomId).get(socket.id);
            user.isSharing = false;
            
            // Notify all users in room
            io.to(roomId).emit('user-sharing', {
                id: socket.id,
                username: user.username,
                isSharing: false
            });
        }
    });
    
    // WebRTC signaling - updated to match frontend
    socket.on('webrtc-offer', (data) => {
        const { targetId, offer } = data;
        console.log(`Sending offer from ${socket.id} to ${targetId}`);
        io.to(targetId).emit('webrtc-offer', {
            fromId: socket.id,
            offer: offer
        });
    });
    
    socket.on('webrtc-answer', (data) => {
        const { targetId, answer } = data;
        console.log(`Sending answer from ${socket.id} to ${targetId}`);
        io.to(targetId).emit('webrtc-answer', {
            fromId: socket.id,
            answer: answer
        });
    });
    
    socket.on('webrtc-ice-candidate', (data) => {
        const { targetId, candidate } = data;
        console.log(`Sending ICE candidate from ${socket.id} to ${targetId}`);
        io.to(targetId).emit('webrtc-ice-candidate', {
            fromId: socket.id,
            candidate: candidate
        });
    });
    
    // Chat messages
    socket.on('chat-message', (data) => {
        console.log(`Chat message in room ${data.roomId}: ${data.message}`);
        io.to(data.roomId).emit('chat-message', {
            id: socket.id,
            username: data.username,
            message: data.message,
            timestamp: Date.now()
        });
    });
    
    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        
        // Remove user from all rooms
        rooms.forEach((users, roomId) => {
            if (users.has(socket.id)) {
                const user = users.get(socket.id);
                users.delete(socket.id);
                
                // Notify others
                io.to(roomId).emit('user-left', { id: socket.id, username: user.username });
                
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
