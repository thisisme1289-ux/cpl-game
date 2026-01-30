# 🔐 BACKEND SETUP GUIDE - Google Auth & Database

## 📋 **Complete Implementation Guide**

This guide will help you set up Google Authentication, MongoDB database, and user statistics tracking.

---

## ⚙️ **Step 1: Install Required Packages**

```bash
cd cpl-game
npm install passport passport-google-oauth20 express-session mongoose connect-mongo dotenv bcrypt jsonwebtoken
```

**Package purposes:**
- `passport` - Authentication middleware
- `passport-google-oauth20` - Google OAuth strategy
- `express-session` - Session management
- `mongoose` - MongoDB ODM
- `connect-mongo` - MongoDB session store
- `dotenv` - Environment variables
- `jsonwebtoken` - JWT tokens
- `bcrypt` - Password hashing (for future features)

---

## 🔑 **Step 2: Setup Google Cloud Console**

### **2.1 Create Google Cloud Project**

1. Go to https://console.cloud.google.com/
2. Click "Create Project"
3. Project name: "CPL Game"
4. Click "Create"

### **2.2 Enable Google+ API**

1. In your project, go to "APIs & Services" → "Library"
2. Search for "Google+ API"
3. Click "Enable"

### **2.3 Create OAuth 2.0 Credentials**

1. Go to "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "OAuth 2.0 Client ID"
3. Application type: "Web application"
4. Name: "CPL Game Web Client"
5. Authorized JavaScript origins:
   - http://localhost:3000
   - https://yourdomain.com (for production)
6. Authorized redirect URIs:
   - http://localhost:3000/auth/google/callback
   - https://yourdomain.com/auth/google/callback
7. Click "Create"
8. **IMPORTANT:** Copy your Client ID and Client Secret

---

## 📝 **Step 3: Create .env File**

Create `.env` file in project root:

```env
# Server Configuration
PORT=3000
NODE_ENV=development

# Google OAuth
GOOGLE_CLIENT_ID=your_client_id_here
GOOGLE_CLIENT_SECRET=your_client_secret_here
CALLBACK_URL=http://localhost:3000/auth/google/callback

# MongoDB
MONGODB_URI=mongodb://localhost:27017/cpl-game
# OR for MongoDB Atlas:
# MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/cpl-game

# Session Secret (generate random string)
SESSION_SECRET=your_very_long_random_secret_here_minimum_32_characters

# JWT Secret (generate random string)
JWT_SECRET=another_very_long_random_secret_for_jwt_tokens

# Frontend URL
CLIENT_URL=http://localhost:3000
```

**Generate random secrets:**
```bash
# In terminal
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## 🗄️ **Step 4: Setup MongoDB**

### **Option A: Local MongoDB**

1. Install MongoDB:
```bash
# macOS
brew tap mongodb/brew
brew install mongodb-community

# Ubuntu
sudo apt-get install mongodb

# Windows
# Download from https://www.mongodb.com/try/download/community
```

2. Start MongoDB:
```bash
# macOS/Linux
mongod

# Windows
# MongoDB should start automatically as a service
```

3. Verify connection:
```bash
mongosh
# Should connect successfully
```

### **Option B: MongoDB Atlas (Cloud)**

1. Go to https://www.mongodb.com/cloud/atlas
2. Sign up / Log in
3. Create a cluster (Free tier available)
4. Create database user
5. Whitelist your IP address (or use 0.0.0.0/0 for development)
6. Get connection string → Update MONGODB_URI in .env

---

## 📁 **Step 5: Create Database Models**

Create `server/models/User.js`:

```javascript
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  googleId: {
    type: String,
    unique: true,
    sparse: true
  },
  email: {
    type: String,
    required: true,
    unique: true
  },
  displayName: {
    type: String,
    required: true
  },
  photoURL: {
    type: String,
    default: null
  },
  stats: {
    matchesPlayed: { type: Number, default: 0 },
    matchesWon: { type: Number, default: 0 },
    matchesLost: { type: Number, default: 0 },
    totalRuns: { type: Number, default: 0 },
    totalWickets: { type: Number, default: 0 },
    highestScore: { type: Number, default: 0 },
    bestBowling: {
      wickets: { type: Number, default: 0 },
      runs: { type: Number, default: 0 }
    },
    winRate: { type: Number, default: 0 },
    rank: { type: Number, default: 999 },
    totalFours: { type: Number, default: 0 },
    totalSixes: { type: Number, default: 0 },
    currentStreak: { type: Number, default: 0 }
  },
  settings: {
    soundEnabled: { type: Boolean, default: true },
    musicEnabled: { type: Boolean, default: false },
    soundVolume: { type: Number, default: 75 },
    musicVolume: { type: Number, default: 50 },
    notifications: { type: Boolean, default: true },
    theme: { type: String, default: 'dark' },
    language: { type: String, default: 'en' },
    avatar: { type: String, default: '🏏' }
  },
  createdAt: { type: Date, default: Date.now },
  lastLogin: { type: Date, default: Date.now }
});

// Calculate rank based on stats
userSchema.methods.calculateRank = function() {
  const winRate = this.stats.matchesPlayed > 0 
    ? this.stats.matchesWon / this.stats.matchesPlayed 
    : 0;
  const avgRuns = this.stats.matchesPlayed > 0
    ? this.stats.totalRuns / this.stats.matchesPlayed
    : 0;
  const wicketsPerMatch = this.stats.matchesPlayed > 0
    ? this.stats.totalWickets / this.stats.matchesPlayed
    : 0;
  
  // Ranking algorithm
  const score = 
    (winRate * 400) +           // 40% weight
    (this.stats.matchesPlayed * 0.2) +     // 20% weight
    (avgRuns * 2) +             // 20% weight
    (wicketsPerMatch * 20);     // 20% weight
  
  return Math.floor(score);
};

module.exports = mongoose.model('User', userSchema);
```

Create `server/models/Match.js`:

```javascript
const mongoose = require('mongoose');

const matchSchema = new mongoose.Schema({
  roomId: { type: String, required: true },
  players: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    displayName: String,
    team: String,
    stats: {
      runsScored: { type: Number, default: 0 },
      ballsFaced: { type: Number, default: 0 },
      wicketsTaken: { type: Number, default: 0 },
      oversBowled: { type: Number, default: 0 },
      runsConceded: { type: Number, default: 0 }
    }
  }],
  innings1: {
    battingTeam: String,
    score: Number,
    wickets: Number,
    overs: Number
  },
  innings2: {
    battingTeam: String,
    score: Number,
    wickets: Number,
    overs: Number
  },
  winner: String,
  winMargin: String,
  date: { type: Date, default: Date.now },
  duration: Number // in seconds
});

module.exports = mongoose.model('Match', matchSchema);
```

---

## 🔐 **Step 6: Setup Passport Authentication**

Create `server/config/passport.js`:

```javascript
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/User');

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.CALLBACK_URL
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      // Check if user exists
      let user = await User.findOne({ googleId: profile.id });
      
      if (user) {
        // Update last login
        user.lastLogin = new Date();
        await user.save();
        return done(null, user);
      }
      
      // Create new user
      user = await User.create({
        googleId: profile.id,
        email: profile.emails[0].value,
        displayName: profile.displayName,
        photoURL: profile.photos[0]?.value || null,
        stats: {
          matchesPlayed: 0,
          matchesWon: 0,
          matchesLost: 0,
          totalRuns: 0,
          totalWickets: 0,
          highestScore: 0,
          bestBowling: { wickets: 0, runs: 0 },
          winRate: 0,
          rank: 999,
          totalFours: 0,
          totalSixes: 0,
          currentStreak: 0
        }
      });
      
      return done(null, user);
    } catch (err) {
      return done(err, null);
    }
  }
));

// Serialize user
passport.serializeUser((user, done) => {
  done(null, user.id);
});

// Deserialize user
passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    done(err, null);
  }
});

module.exports = passport;
```

---

## 🛣️ **Step 7: Create Auth Routes**

Create `server/routes/auth.js`:

```javascript
const express = require('express');
const router = express.Router();
const passport = require('passport');
const jwt = require('jsonwebtoken');

// @route   GET /auth/google
// @desc    Initiate Google OAuth
router.get('/google',
  passport.authenticate('google', { 
    scope: ['profile', 'email'] 
  })
);

// @route   GET /auth/google/callback
// @desc    Google OAuth callback
router.get('/google/callback',
  passport.authenticate('google', { failureRedirect: '/login.html' }),
  (req, res) => {
    // Generate JWT token
    const token = jwt.sign(
      { userId: req.user.id },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    // Send user data to frontend
    const userData = {
      id: req.user.id,
      displayName: req.user.displayName,
      email: req.user.email,
      photoURL: req.user.photoURL
    };
    
    // Redirect to home with token and user data
    res.redirect(`/?token=${token}&user=${encodeURIComponent(JSON.stringify(userData))}`);
  }
);

// @route   GET /auth/logout
// @desc    Logout user
router.get('/logout', (req, res) => {
  req.logout((err) => {
    if (err) return res.status(500).json({ error: 'Logout failed' });
    res.redirect('/login.html');
  });
});

// @route   GET /auth/current
// @desc    Get current user
router.get('/current', (req, res) => {
  if (req.isAuthenticated()) {
    res.json({
      authenticated: true,
      user: {
        id: req.user.id,
        displayName: req.user.displayName,
        email: req.user.email,
        photoURL: req.user.photoURL,
        stats: req.user.stats
      }
    });
  } else {
    res.json({ authenticated: false });
  }
});

module.exports = router;
```

---

## 📊 **Step 8: Create API Routes**

Create `server/routes/api.js`:

```javascript
const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Match = require('../models/Match');

// Middleware to check authentication
const isAuthenticated = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ error: 'Not authenticated' });
};

// @route   GET /api/profile/:userId
// @desc    Get user profile
router.get('/profile/:userId', async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Get recent matches
    const matches = await Match.find({
      'players.userId': user._id
    })
    .sort({ date: -1 })
    .limit(5);
    
    res.json({
      user: {
        displayName: user.displayName,
        photoURL: user.photoURL,
        stats: user.stats,
        createdAt: user.createdAt
      },
      recentMatches: matches
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// @route   GET /api/leaderboard
// @desc    Get leaderboard
router.get('/leaderboard', async (req, res) => {
  try {
    const filter = req.query.filter || 'all'; // all, month, week
    
    let dateFilter = {};
    if (filter === 'month') {
      dateFilter = {
        lastLogin: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
      };
    } else if (filter === 'week') {
      dateFilter = {
        lastLogin: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
      };
    }
    
    const users = await User.find(dateFilter)
      .sort({ 'stats.rank': 1 })
      .limit(10)
      .select('displayName photoURL stats settings.avatar');
    
    res.json({ leaderboard: users });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// @route   POST /api/match/complete
// @desc    Save match result and update stats
router.post('/match/complete', isAuthenticated, async (req, res) => {
  try {
    const { roomId, players, innings1, innings2, winner, winMargin } = req.body;
    
    // Save match
    const match = await Match.create({
      roomId,
      players,
      innings1,
      innings2,
      winner,
      winMargin
    });
    
    // Update player stats
    for (const player of players) {
      if (player.userId) {
        const user = await User.findById(player.userId);
        if (user) {
          user.stats.matchesPlayed++;
          user.stats.totalRuns += player.stats.runsScored;
          user.stats.totalWickets += player.stats.wicketsTaken;
          
          if (player.team === winner) {
            user.stats.matchesWon++;
            user.stats.currentStreak++;
          } else {
            user.stats.matchesLost++;
            user.stats.currentStreak = 0;
          }
          
          if (player.stats.runsScored > user.stats.highestScore) {
            user.stats.highestScore = player.stats.runsScored;
          }
          
          user.stats.winRate = (user.stats.matchesWon / user.stats.matchesPlayed) * 100;
          
          await user.save();
        }
      }
    }
    
    // Recalculate all ranks
    await recalculateRanks();
    
    res.json({ success: true, matchId: match._id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Helper function to recalculate ranks
async function recalculateRanks() {
  const users = await User.find().sort({ 'stats.matchesPlayed': -1 });
  
  // Calculate score for each user
  const scoredUsers = users.map(user => ({
    user,
    score: user.calculateRank()
  }));
  
  // Sort by score
  scoredUsers.sort((a, b) => b.score - a.score);
  
  // Update ranks
  for (let i = 0; i < scoredUsers.length; i++) {
    scoredUsers[i].user.stats.rank = i + 1;
    await scoredUsers[i].user.save();
  }
}

module.exports = router;
```

---

## 🔧 **Step 9: Update Main Server File**

Update `server/server.js` to include authentication:

Add at the top (after requires):

```javascript
require('dotenv').config();
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const passport = require('./config/passport');

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('✅ MongoDB Connected'))
.catch(err => console.error('❌ MongoDB Connection Error:', err));

// Session middleware
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGODB_URI,
    touchAfter: 24 * 3600 // 24 hours
  }),
  cookie: {
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production'
  }
}));

// Passport middleware
app.use(passport.initialize());
app.use(passport.session());

// Routes
const authRoutes = require('./routes/auth');
const apiRoutes = require('./routes/api');

app.use('/auth', authRoutes);
app.use('/api', apiRoutes);
```

---

## ✅ **Step 10: Test the Setup**

### **10.1 Start MongoDB**
```bash
mongod
```

### **10.2 Start Server**
```bash
npm start
```

### **10.3 Test Google Auth**
1. Go to http://localhost:3000/login.html
2. Click "Sign in with Google"
3. Should redirect to Google OAuth
4. After authentication, should redirect back to homepage

### **10.4 Test Profile**
1. Go to http://localhost:3000/profile.html
2. Should show your stats

### **10.5 Test Leaderboard**
1. Go to http://localhost:3000/leaderboard.html
2. Should show top 10 players

---

## 🎉 **You're Done!**

Your CPL game now has:
- ✅ Google Authentication
- ✅ MongoDB Database
- ✅ User Profiles
- ✅ Statistics Tracking
- ✅ Leaderboard System
- ✅ Settings Page

---

## 📚 **Additional Resources**

- [Passport.js Documentation](http://www.passportjs.org/)
- [MongoDB Documentation](https://docs.mongodb.com/)
- [Mongoose Documentation](https://mongoosejs.com/)
- [Google OAuth 2.0](https://developers.google.com/identity/protocols/oauth2)

---

**Total Implementation Time: 18-25 hours**

**Need help? Check the troubleshooting section in TROUBLESHOOTING.md**
