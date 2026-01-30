# CPL - Class Premier League 🏏✋

A real-time multiplayer finger cricket game built with Node.js, Express, and Socket.IO. Play the classic classroom game online with friends!

## 🎮 Game Concept

CPL recreates the beloved finger cricket game played in classrooms:
- Each player chooses 1-5 fingers
- Batter scores runs equal to their finger choice
- If batter and bowler show the same number → **OUT!**
- Otherwise, batter scores the runs

## ✨ Features

### Core Gameplay
- **Real-time multiplayer** (2-12 players per room)
- **Automatic team balancing** (Team A vs Team B)
- **Leader system** with captain selection
- **Finger cricket rules** with OUT detection
- **Score tracking** with wickets and overs
- **Smooth animations** for runs, outs, and results

### Network Features
- **Room system** with random room matching
- **Reconnection support** - refresh without losing your spot
- **Duplicate prevention** - one player, one identity
- **Grace period** for temporary disconnects
- **Real-time chat** during gameplay

### UI/UX
- **Dark modern design** with glassmorphism
- **Responsive layout** (mobile + desktop)
- **Animated score** with rolling numbers
- **Result overlays** with finger emojis
- **Team displays** with active player highlighting
- **Chat sidebar** for spectators

## 🚀 Quick Start

### Prerequisites
- Node.js (v14 or higher)
- npm or yarn

### Installation

1. **Install dependencies:**
```bash
npm install
```

2. **Start the server:**
```bash
npm start
```

3. **Open your browser:**
```
http://localhost:3000
```

4. **For development with auto-restart:**
```bash
npm run dev
```

## 📁 Project Structure

```
cpl-game/
├── server/
│   ├── server.js       # Main server + Socket.IO handlers
│   ├── room.js         # Room & player management
│   └── gameLogic.js    # Finger cricket game rules
├── public/
│   ├── index.html      # Entry page (name + join)
│   ├── lobby.html      # Main game interface
│   └── lobby.js        # Client-side game logic
├── package.json
└── README.md
```

## 🎯 How to Play

### 1. Join a Room
- Enter your name on the home page
- Click "Join Random Room"
- You'll be auto-assigned to a team

### 2. Select Leaders
- Any player can click "Select Leaders"
- One captain is randomly chosen for each team

### 3. Start Game
- Leaders click "Start Game"
- Game enters WAITING_PLAYERS state

### 4. Select Players
- Leaders choose one batter and one bowler
- Must be from different teams

### 5. Play Rounds
- Batter and bowler choose fingers (1-5)
- If same → OUT
- If different → runs added
- Continue until overs end or all out

### 6. Chat & Spectate
- Spectators can chat during gameplay
- Active players (batter/bowler) cannot chat
- Everyone sees result animations

## 🔧 Technical Details

### Server Architecture
- **Express** for HTTP server
- **Socket.IO** for WebSocket communication
- **In-memory storage** for rooms and game state
- **Event-driven** architecture

### Key Socket Events

**Client → Server:**
- `join-random-room` - Join available room
- `rejoin-room` - Reconnect after disconnect
- `select-leaders` - Choose team captains
- `start-game` - Begin gameplay
- `select-players` - Pick batter & bowler
- `player-input` - Submit finger choice
- `chat-message` - Send chat message

**Server → Client:**
- `room-update` - Team lists updated
- `game-state` - Score, overs, state
- `leaders-selected` - Captains chosen
- `players-selected` - Batter/bowler set
- `round-result` - Finger choices & outcome
- `game-over` - Match ended
- `chat-message` - Chat broadcast

### Game State Machine
```
LOBBY → WAITING_PLAYERS → PLAYING → GAME_OVER
   ↑                          ↓
   └──────────────────────────┘
   (after OUT or game restart)
```

### Score Management
- Score is **authoritative** on server
- Client shows **animated rolling numbers**
- Never shows `NaN` (defaults to 0)
- Updates smoothly without jumps

### Player Identity
- Based on **player name**, not socket ID
- Socket IDs are temporary
- Reconnection preserves identity
- Prevents duplicate players

## 🎨 Customization

### Change Overs
Edit `createRoom()` in `server/room.js`:
```javascript
createRoom('random', 5); // Change 5 to desired overs
```

### Modify Team Size
Edit max players in `server/server.js`:
```javascript
if (room.players.length >= 12) // Change 12 to desired max
```

### Adjust Grace Period
Edit disconnect timeout in `server/server.js`:
```javascript
setTimeout(() => { ... }, 5000); // 5000 = 5 seconds
```

## 🐛 Troubleshooting

### Players Appearing Twice
- Clear browser localStorage
- Refresh the page
- Server implements duplicate prevention

### Can't Reconnect After Refresh
- Check if room still exists
- Verify player name matches
- Room is deleted if all players leave

### Score Shows NaN
- Should never happen (defaulted to 0)
- Check `gameLogic.js` for proper initialization

### Animations Not Working
- Verify JavaScript is enabled
- Check browser console for errors
- Ensure Socket.IO connection is active

## 🚧 Future Enhancements

- [ ] Custom room creation
- [ ] Configurable overs per room
- [ ] Manual leader selection
- [ ] Player statistics tracking
- [ ] Multiple innings
- [ ] Team names & avatars
- [ ] Sound effects
- [ ] Leaderboards
- [ ] Private rooms with codes

## 🤝 Contributing

Contributions welcome! Areas for improvement:
- Add tests (Jest + Supertest)
- Implement persistent storage (Redis/MongoDB)
- Add authentication
- Improve mobile UI
- Add more game modes

## 📄 License

MIT License - feel free to use and modify!

## 🎓 Credits

Inspired by the classic finger cricket game played in schools and colleges worldwide. Built with passion for nostalgic multiplayer gaming.

---

**Made with ❤️ for classroom gamers everywhere**

Enjoy playing CPL! 🏏
