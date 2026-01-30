# CPL - Quick Start Guide

## Setup Instructions

### Step 1: Install Dependencies
Open terminal in the project folder and run:
```bash
npm install
```

This will install:
- express (web server)
- socket.io (real-time communication)
- nodemon (dev auto-restart - optional)

### Step 2: Start the Server
```bash
npm start
```

You should see:
```
CPL Server running on http://localhost:3000
```

### Step 3: Open in Browser
Open your browser and navigate to:
```
http://localhost:3000
```

### Step 4: Play!
1. Enter your name
2. Click "Join Random Room"
3. Share the room ID with friends (or open in multiple tabs for testing)
4. Leaders start the game
5. Enjoy finger cricket!

## Testing with Multiple Players

### Option 1: Multiple Browser Tabs
- Open 2-12 tabs
- Enter different names in each
- All join the same room
- Perfect for testing

### Option 2: Multiple Devices
- All devices on same WiFi
- Connect to server's IP address
- Example: `http://192.168.1.100:3000`
- Find your IP:
  - Windows: `ipconfig`
  - Mac/Linux: `ifconfig` or `ip addr`

### Option 3: Incognito Windows
- Regular + Incognito windows
- Different player names
- Simulates different users

## Game Flow

```
1. ENTRY PAGE
   ↓ (Enter name + Join Random Room)
   
2. LOBBY
   - Players join
   - Teams auto-assigned
   - Chat available
   ↓ (Leader starts game)
   
3. PLAYER SELECTION
   - Leaders pick batter & bowler
   ↓ (Players confirmed)
   
4. GAMEPLAY
   - Players choose fingers (1-5)
   - Match = OUT
   - Different = Runs
   ↓ (Continue for 5 overs)
   
5. INNINGS BREAK
   ↓ (Switch teams)
   
6. SECOND INNINGS
   ↓ (Chase the target)
   
7. GAME FINISHED
   - Winner announced
   - Final scores shown
```

## Troubleshooting

### "Cannot find module 'express'"
Run: `npm install`

### "Port 3000 already in use"
Option 1: Stop other app using port 3000
Option 2: Change port in server.js or use:
```bash
PORT=8080 npm start
```

### Page won't load
1. Check server is running
2. Check no errors in terminal
3. Try: http://localhost:3000 or http://127.0.0.1:3000

### Players not syncing
1. Check all players in same room
2. Refresh pages
3. Check browser console for errors (F12)

### Score shows NaN
Should not happen - refresh page if it does

## Developer Mode

For development with auto-restart:
```bash
npm run dev
```

Changes to files will auto-restart the server.

## Tips

1. **Leader Powers**: First player in each team becomes leader
2. **Spectator View**: Non-active players see animations but not finger choices
3. **Reconnection**: Refresh page = automatic rejoin (30 sec grace period)
4. **Chat**: Available in lobby and during gameplay (spectators only during game)
5. **Teams**: Balanced automatically based on join order

## Architecture Overview

```
CLIENT (Browser)
    ↕ WebSocket (Socket.IO)
SERVER (Node.js)
    ├── Room Management
    ├── Game Logic
    └── Event Handling
```

## Next Steps

- Customize colors in `public/css/style.css`
- Add features in `server/gameLogic.js`
- Modify rules in `server/gameLogic.js`
- Deploy to hosting service (Heroku, Railway, Render)

## Support

Check README.md for detailed documentation.

Happy Gaming! 🏏🎮
