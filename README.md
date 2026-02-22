# CPL - Class Premier League 🏏

A professional, production-ready multiplayer finger cricket game built with Node.js, Socket.IO, and MongoDB. Features real-time gameplay, Google authentication, leaderboards, and beautiful modern UI.

## 🎮 Features

### Core Gameplay
- **Real-time Multiplayer** - Play with friends or random opponents
- **Finger Cricket Rules** - Classic 1-5 finger choice mechanic
- **Four Game Modes**:
  - 🔴 Random - Quick match with random players
  - 🔵 Create - Create custom room
  - 🟢 Join - Join existing room by code
  - ⚪ Bot - Practice with AI opponents

### Technical Features
- **Google OAuth 2.0** - Secure one-click login
- **JWT Authentication** - Stateless session management
- **WebSocket (Socket.IO)** - Real-time game updates
- **MongoDB** - Persistent data storage
- **Leaderboard System** - Global rankings with caching
- **XP & Leveling** - Player progression system
- **Game History** - Track all your matches
- **Responsive Design** - Works on mobile and desktop

## 🚀 Quick Start

### Prerequisites

Before you begin, ensure you have:
- **Node.js** (v18 or higher) - [Download](https://nodejs.org/)
- **MongoDB Atlas Account** (free) - [Sign up](https://www.mongodb.com/cloud/atlas)
- **Google Cloud Project** - [Console](https://console.cloud.google.com/)

### Installation

1. **Clone or Download the Project**
```bash
cd cpl-new
```

2. **Install Dependencies**
```bash
npm install
```

3. **Set Up Environment Variables**

Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

Edit `.env` file with your credentials:
```env
# Server
PORT=3000
NODE_ENV=development

# MongoDB (from MongoDB Atlas)
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/cpl-game

# JWT Secret (generate with: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))")
JWT_SECRET=your_super_secret_jwt_key_here

# Google OAuth (from Google Cloud Console)
GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com

# Frontend URL
FRONTEND_URL=http://localhost:3000
```

4. **Update Google Client ID in Frontend**

Edit `public/js/login.js`:
```javascript
const GOOGLE_CLIENT_ID = 'your_google_client_id.apps.googleusercontent.com';
```

Also update `public/views/login.html`:
```html
<div id="g_id_onload"
     data-client_id="your_google_client_id.apps.googleusercontent.com"
     ...>
</div>
```

5. **Start the Server**
```bash
npm start
```

For development with auto-restart:
```bash
npm run dev
```

6. **Open in Browser**
```
http://localhost:3000
```

## 📋 Detailed Setup Guide

### 1. MongoDB Setup

1. Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Create a free account
3. Create a new cluster (free tier is fine)
4. Click "Connect" → "Connect your application"
5. Copy the connection string
6. Replace `<password>` with your database password
7. Replace `<dbname>` with `cpl-game`

Example:
```
mongodb+srv://cpluser:mypassword123@cluster0.xxxxx.mongodb.net/cpl-game
```

### 2. Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or select existing)
3. Enable "Google+ API"
4. Go to "Credentials" → "Create Credentials" → "OAuth client ID"
5. Configure OAuth consent screen:
   - User Type: External
   - App name: CPL - Class Premier League
   - Add your email
6. Create OAuth Client ID:
   - Application type: Web application
   - Authorized JavaScript origins: `http://localhost:3000`
   - Authorized redirect URIs: `http://localhost:3000`
7. Copy the Client ID

### 3. Generate JWT Secret

Run this command:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Copy the output and use it as your `JWT_SECRET`.

## 📁 Project Structure

```
cpl-new/
├── src/
│   ├── config/              # Configuration files
│   │   ├── database.js      # MongoDB connection
│   │   └── game.js          # Game constants
│   ├── controllers/         # Business logic (future)
│   ├── middleware/          # Express middleware
│   │   └── auth.js          # JWT verification
│   ├── models/              # MongoDB models
│   │   ├── User.js          # User schema
│   │   └── Game.js          # Game history schema
│   ├── routes/              # API routes
│   │   ├── auth.js          # Authentication endpoints
│   │   └── game.js          # Game API endpoints
│   ├── services/            # External services
│   │   └── authService.js   # Google Auth & JWT
│   ├── socket/              # Socket.IO handlers
│   │   └── gameHandler.js   # Real-time game logic
│   └── utils/               # Utility functions
│       ├── gameEngine.js    # Cricket game logic
│       ├── roomManager.js   # Multiplayer rooms
│       └── helpers.js       # Helper functions
├── public/                  # Frontend files
│   ├── css/                 # Stylesheets
│   │   ├── login.css
│   │   ├── dashboard.css
│   │   └── game.css
│   ├── js/                  # JavaScript files
│   │   ├── login.js
│   │   ├── dashboard.js
│   │   └── game.js
│   └── views/               # HTML pages
│       ├── login.html
│       ├── dashboard.html
│       ├── game.html
│       └── leaderboard.html
├── server.js                # Main entry point
├── package.json             # Dependencies
├── .env.example             # Environment template
└── README.md               # This file
```

## 🎯 How to Play

1. **Login** - Click "Continue with Google"
2. **Choose Mode**:
   - Random: Jump into quick match
   - Create: Make custom room
   - Join: Enter room code
   - Bot: Practice offline
3. **Wait for Players** - Countdown starts when 2+ players join
4. **Toss** - Random toss decides batting/bowling
5. **Play** - Choose finger (1-5):
   - Same number = OUT
   - Different = Runs scored
6. **Win** - Score more runs to win!

## 🔧 API Endpoints

### Authentication
```
POST   /api/auth/google      - Login with Google
GET    /api/auth/verify      - Verify JWT token
POST   /api/auth/refresh     - Refresh user stats
```

### Game
```
GET    /api/game/stats       - Get user stats
GET    /api/game/leaderboard - Get top 10 players
GET    /api/game/history     - Get match history
POST   /api/game/complete    - Record game result
GET    /api/game/active      - Get active games count
```

### Health
```
GET    /health               - Server health check
```

## 🌐 Socket.IO Events

### Client → Server
- `auth:request` - Authenticate socket
- `lobby:join` - Join game lobby
- `lobby:leave` - Leave lobby
- `game:start` - Start match
- `game:choice_made` - Submit finger choice
- `chat:message` - Send chat message

### Server → Client
- `auth:success` - Authentication successful
- `lobby:update` - Lobby state changed
- `lobby:timer` - Countdown tick
- `game:start` - Match starting
- `game:state` - Game state update
- `game:round_result` - Ball result
- `game:over` - Match ended
- `stats:update` - Stats refreshed

## 🚢 Deployment

### Render.com (Free Tier)

1. Push code to GitHub
2. Go to [Render](https://render.com/)
3. Create new "Web Service"
4. Connect your GitHub repo
5. Configure:
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Environment Variables: Add all from `.env`
6. Deploy!

Your app will be at: `https://your-app-name.onrender.com`

**Important**: Update these after deployment:
- `FRONTEND_URL` in Render environment variables
- Google OAuth authorized origins in Google Cloud Console
- `GOOGLE_CLIENT_ID` in frontend files

## 🛠️ Development Tips

### Run in Development Mode
```bash
npm run dev
```

### Check Health
```bash
curl http://localhost:3000/health
```

### View Logs
```bash
# Server logs show in console
# Look for:
# ✅ MongoDB Connected
# ✅ CPL SERVER RUNNING
```

### Debug Socket.IO
Add this to browser console:
```javascript
localStorage.debug = 'socket.io-client:socket';
```

## 📊 Game Configuration

Edit `src/config/game.js` to customize:

```javascript
MATCH: {
  OVERS: 5,               // Overs per innings
  BALLS_PER_OVER: 6,      // Balls per over
  MAX_WICKETS: 10,        // Wickets before all out
}

LOBBY: {
  TIMEOUT: 60,            // Countdown seconds
  MIN_PLAYERS: 2,         // Minimum players
  MAX_PLAYERS: 12,        // Maximum players
}

POINTS: {
  WIN: 50,                // Points for winning
  LOSS: 10,               // Points for losing
  RUN_MULTIPLIER: 0.1,    // Points per run
  WICKET_MULTIPLIER: 20,  // Points per wicket
}
```

## 🐛 Troubleshooting

### "MongoDB connection failed"
- Check `MONGODB_URI` in `.env`
- Ensure IP is whitelisted in MongoDB Atlas
- Check database password

### "Google authentication failed"
- Verify `GOOGLE_CLIENT_ID` in both `.env` and frontend files
- Check authorized origins in Google Cloud Console
- Ensure OAuth consent screen is configured

### "Socket connection failed"
- Check if server is running
- Verify `FRONTEND_URL` matches your domain
- Check CORS settings in `server.js`

### Port already in use
```bash
# Kill process on port 3000 (Mac/Linux)
lsof -ti:3000 | xargs kill -9

# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F
```

## 🔒 Security Best Practices

1. **Never commit `.env` file** - Already in `.gitignore`
2. **Use strong JWT secret** - 64+ random characters
3. **Enable MongoDB IP whitelist** - Don't use 0.0.0.0/0
4. **Use HTTPS in production** - Enable SSL on Render
5. **Rate limit API endpoints** - Already implemented
6. **Validate all inputs** - Server-side validation exists

## 📈 Scaling Tips

### Free Tier (Good for 100-1000 users)
- ✅ Render free tier
- ✅ MongoDB Atlas free tier (512MB)
- ✅ Current implementation

### Growth (1000-10000 users)
- Upgrade MongoDB to M2 tier
- Use Render paid tier for better performance
- Add Redis for caching
- Implement horizontal scaling

### Production (10000+ users)
- Use AWS/GCP/Azure
- Add CDN for static files
- Implement microservices
- Add monitoring (DataDog, New Relic)

## 🤝 Contributing

This is a hobby project, but improvements are welcome!

Areas for contribution:
- Add more game modes
- Improve bot AI
- Add tournaments
- Add achievements
- Improve mobile UI
- Add sound effects

## 📄 License

MIT License - Feel free to use and modify!

## 🙏 Credits

Built with:
- Express.js - Web framework
- Socket.IO - Real-time communication
- MongoDB - Database
- Google OAuth - Authentication
- JWT - Session management

Made with ❤️ for cricket lovers worldwide 🏏

## 💬 Support

Having issues? Check:
1. This README
2. `.env.example` file
3. Server console logs
4. Browser console (F12)

Still stuck? Create an issue on GitHub or contact the dev team.

---

**Happy Gaming! May your fingers never clash! 🎯🏏**
