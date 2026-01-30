const express = require('express');
const { ExpressPeerServer } = require('peer');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS
app.use(cors());

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// Handle all routes by serving index.html
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start HTTP server
const server = app.listen(PORT, () => {
    console.log('');
    console.log('🚀 ShareView Server Running');
    console.log('============================');
    console.log(`📍 Server: http://localhost:${PORT}`);
    console.log(`🔗 PeerJS: http://localhost:${PORT}/peerjs`);
    console.log('');
    console.log('💡 How to use:');
    console.log('   1. Open http://localhost:' + PORT + ' in your browser');
    console.log('   2. Click "Start Sharing" and select your screen');
    console.log('   3. Share the Session ID with others');
    console.log('   4. Others click "Join Session by ID" and enter your ID');
    console.log('');
});

// Create PeerJS server with better configuration
const peerServer = ExpressPeerServer(server, {
    debug: true,
    path: '/peerjs',
    allow_discovery: true,
    proxied: false,
    concurrent_limit: 100,
    alive_timeout: 60000,
    // Allow larger payloads for screen sharing
    key: 'peerjs',
    sslkey: null,
    sslcert: null
});

app.use('/peerjs', peerServer);

// Track connected peers
const activePeers = new Map();

peerServer.on('connection', (client) => {
    const clientId = client.getId();
    console.log('✅ Peer connected:', clientId);
    activePeers.set(clientId, {
        id: clientId,
        connectedAt: new Date(),
        isSharing: false
    });
    console.log(`   Active peers: ${activePeers.size}`);
});

peerServer.on('disconnect', (client) => {
    const clientId = client.getId();
    console.log('❌ Peer disconnected:', clientId);
    activePeers.delete(clientId);
    console.log(`   Active peers: ${activePeers.size}`);
});

// Optional: Add endpoint to get active peers (for future enhancement)
app.get('/api/peers', (req, res) => {
    const peers = Array.from(activePeers.values());
    res.json({ count: peers.length, peers });
});

// Error handling
process.on('uncaughtException', (err) => {
    console.error('❌ Uncaught Exception:', err);
});

process.on('unhandledRejection', (err) => {
    console.error('❌ Unhandled Rejection:', err);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('\n🛑 SIGTERM received, shutting down gracefully...');
    server.close(() => {
        console.log('✅ Server closed');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('\n🛑 SIGINT received, shutting down gracefully...');
    server.close(() => {
        console.log('✅ Server closed');
        process.exit(0);
    });
});
