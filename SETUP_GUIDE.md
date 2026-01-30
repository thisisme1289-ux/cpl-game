# CPL - Setup & Deployment Guide 🚀

## Quick Setup (5 minutes)

### Step 1: Extract Files
Extract the `cpl-game` folder to your desired location.

### Step 2: Install Dependencies
Open terminal/command prompt in the `cpl-game` folder:

```bash
npm install
```

This will install:
- express (web server)
- socket.io (real-time communication)

### Step 3: Start Server
```bash
npm start
```

You should see:
```
🏏 CPL Server running on http://localhost:3000
Ready for multiplayer finger cricket!
```

### Step 4: Play!
1. Open your browser: `http://localhost:3000`
2. Enter your name
3. Click "Join Random Room"
4. Share the URL with friends to join the same room!

## Testing with Multiple Players

### Option 1: Multiple Browser Windows
1. Open multiple browser windows (or incognito tabs)
2. Go to `http://localhost:3000` in each
3. Enter different names
4. All will join the same room automatically

### Option 2: Different Devices
1. Find your local IP address:
   - Windows: `ipconfig` (look for IPv4)
   - Mac/Linux: `ifconfig` or `ip addr`
2. Other devices connect to: `http://YOUR_IP:3000`
3. Make sure all devices are on same WiFi network

## Port Configuration

If port 3000 is already in use, you can change it:

1. Open `server/server.js`
2. Change line: `const PORT = process.env.PORT || 3000;`
3. Or set environment variable:
   ```bash
   PORT=8080 npm start
   ```

## Production Deployment

### Deploy to Heroku (Free)

1. Create `Procfile` in root:
   ```
   web: node server/server.js
   ```

2. Initialize git:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   ```

3. Deploy:
   ```bash
   heroku create your-cpl-game
   git push heroku main
   ```

### Deploy to Railway (Free)

1. Connect GitHub repo to Railway
2. Railway auto-detects Node.js
3. Set start command: `node server/server.js`
4. Deploy!

### Deploy to Render (Free)

1. Connect GitHub repo
2. Set build command: `npm install`
3. Set start command: `npm start`
4. Deploy!

### Deploy to Vercel

1. Install Vercel CLI: `npm i -g vercel`
2. Run: `vercel`
3. Follow prompts

Note: For Vercel, you may need to configure for WebSocket support.

## Environment Variables

For production, you can set:

```bash
PORT=3000              # Server port
NODE_ENV=production    # Environment
```

## Troubleshooting

### "Cannot find module 'express'"
```bash
npm install
```

### "Port 3000 is already in use"
```bash
PORT=8080 npm start
```

### Players can't connect from other devices
- Check firewall settings
- Ensure all devices on same network
- Use your computer's local IP, not localhost

### Game doesn't start
- Ensure at least 2 players joined
- Click "Select Leaders" first
- Then click "Start Game" (only leaders can)

### Score shows NaN
- This shouldn't happen (fixed in code)
- If it does, refresh page or restart server

## File Structure Overview

```
cpl-game/
│
├── server/                 # Backend
│   ├── server.js          # Main server + Socket.IO
│   ├── room.js            # Room management
│   └── gameLogic.js       # Game rules
│
├── public/                 # Frontend
│   ├── index.html         # Entry page
│   ├── lobby.html         # Game interface
│   └── lobby.js           # Client logic
│
├── package.json           # Dependencies
└── README.md             # Documentation
```

## Development Mode

For development with auto-reload:

```bash
npm run dev
```

This uses nodemon to restart server on file changes.

## Next Steps

1. **Test locally** with multiple browser windows
2. **Customize** game settings in code
3. **Deploy** to hosting service
4. **Share** with friends and enjoy!

## Support

For issues or questions:
- Check README.md for detailed info
- Review code comments
- Check browser console for errors
- Check server logs in terminal

---

**Happy Gaming! 🏏**
