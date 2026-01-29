# ShareView - Screen Sharing Web App

A modern, real-time screen sharing application with chat functionality, built with WebRTC, Socket.IO, and Express.

## Features

- 🖥️ **Real-time Screen Sharing** - Share your screen with multiple users using WebRTC
- 💬 **Live Chat** - Built-in chat functionality with toggleable sidebar
- 🔗 **Shareable Room Links** - Generate unique room URLs to invite others
- 🌓 **Dark/Light Theme** - Toggle between dark and light modes (preference saved)
- 📱 **Responsive Design** - Works on desktop and mobile devices
- 🎨 **Clean, Modern UI** - Minimalist Apple-inspired design

## Tech Stack

### Frontend
- Vanilla JavaScript (no framework dependencies)
- WebRTC for peer-to-peer video streaming
- Socket.IO client for real-time communication
- CSS3 with smooth animations

### Backend
- Node.js
- Express.js
- Socket.IO for WebSocket communication
- In-memory room management

## Installation

### Prerequisites
- Node.js (v14 or higher)
- npm or yarn

### Setup Steps

1. **Clone or download the project files**

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Create the public folder**
   ```bash
   mkdir public
   ```

4. **Move the HTML file**
   ```bash
   mv screen-share-app.html public/index.html
   ```

5. **Start the server**
   ```bash
   npm start
   ```

   Or for development with auto-reload:
   ```bash
   npm run dev
   ```

6. **Open your browser**
   Navigate to `http://localhost:3000`

## Project Structure

```
shareview-app/
├── server.js              # Express + Socket.IO server
├── package.json           # Dependencies and scripts
├── public/
│   └── index.html        # Main application (frontend)
└── README.md             # This file
```

## How to Use

### Starting a Session

1. Open the app in your browser
2. You'll automatically be assigned to a room (or join via URL)
3. Click "Start Sharing" to begin screen sharing
4. Click "Share Link" to get the room URL
5. Send the link to others to invite them

### Joining a Session

1. Click on the shared link
2. You'll join the room automatically
3. If someone is sharing, you'll see their screen
4. Use the chat to communicate

### Using Chat

1. Click the chat icon in the header to open the chat panel
2. Type your message and press Enter or click Send
3. Click the X or chat icon again to close the panel

### Theme Toggle

- Click the sun/moon icon to switch between light and dark themes
- Your preference is saved automatically

## WebRTC Connection Flow

1. User starts screen sharing
2. Server notifies all other users in the room
3. Peer connections are established using WebRTC
4. Screen stream is shared via RTCPeerConnection
5. STUN servers help with NAT traversal

## Deployment

### Deploy to Heroku

1. Install Heroku CLI and login:
   ```bash
   heroku login
   ```

2. Create a new Heroku app:
   ```bash
   heroku create your-app-name
   ```

3. Push to Heroku:
   ```bash
   git push heroku main
   ```

### Deploy to Railway

1. Push your code to GitHub
2. Go to [Railway](https://railway.app)
3. Click "New Project" → "Deploy from GitHub"
4. Select your repository
5. Railway will auto-detect Node.js and deploy

### Deploy to Render

1. Push your code to GitHub
2. Go to [Render](https://render.com)
3. Click "New Web Service"
4. Connect your repository
5. Set build command: `npm install`
6. Set start command: `npm start`

### Environment Variables

For production, you may want to set:
- `PORT` - Server port (default: 3000)
- `NODE_ENV` - Set to 'production'

## Browser Compatibility

- Chrome/Edge (recommended) - Full support
- Firefox - Full support
- Safari - Requires HTTPS for screen sharing
- Mobile browsers - Limited screen sharing support

## HTTPS Requirement

**Important:** Screen sharing requires HTTPS in production. Most deployment platforms (Heroku, Railway, Render) provide free SSL certificates.

For local development, you can use:
- `localhost` (treated as secure)
- ngrok for HTTPS tunneling

## Limitations

- Screen sharing quality depends on network bandwidth
- Maximum recommended users per room: 10
- Mobile browsers have limited screen sharing capabilities
- Rooms are stored in memory (will reset on server restart)

## Future Enhancements

- [ ] User authentication
- [ ] Persistent room history
- [ ] Recording functionality
- [ ] File sharing
- [ ] Virtual backgrounds
- [ ] Screen annotation tools
- [ ] Mobile app version
- [ ] Video call mode (camera sharing)

## Troubleshooting

### Screen sharing not working
- Ensure you're using HTTPS (or localhost)
- Check browser permissions
- Try a different browser (Chrome recommended)

### Chat messages not sending
- Check server connection in browser console
- Ensure Socket.IO is connected
- Verify server is running

### Can't see other user's screen
- Check WebRTC connection in console
- Ensure both users are in the same room
- Check firewall/network settings

## Contributing

Feel free to submit issues and enhancement requests!

## License

MIT License - feel free to use this project for personal or commercial purposes.
