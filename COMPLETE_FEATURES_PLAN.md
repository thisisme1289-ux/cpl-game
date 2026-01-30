# 🎯 COMPLETE IMPLEMENTATION - Team Display, Settings, Auth & Leaderboard

## 📋 **Features to Implement**

### **1. Show Batting/Bowling Teams on Screen**
- Display which team is batting
- Display which team is bowling
- Show in scoreboard area
- Update on innings switch

### **2. Settings Page**
- Sound effects toggle
- Music toggle
- Volume controls
- Notifications toggle
- Theme selection (light/dark)
- Language selection
- Avatar selection
- Display name

### **3. Google Sign-In Authentication**
- Google OAuth integration
- User profile storage
- Game stats tracking
- Persistent login
- Profile picture from Google

### **4. Player Profile Page**
- User information
- Total matches played
- Matches won/lost
- Win rate percentage
- Total runs scored
- Total wickets taken
- Highest score
- Best bowling figures
- Achievements/badges
- Recent matches history

### **5. Leaderboard System**
- Top 10 players globally
- Ranking algorithm:
  * Win rate (40%)
  * Total matches (20%)
  * Average runs (20%)
  * Wickets taken (20%)
- Real-time updates
- Player rank display
- Filter options (weekly/monthly/all-time)

---

## 🏗️ **Architecture**

### **Backend (New Files Needed):**
```
server/
├── auth.js           (Google OAuth handling)
├── database.js       (MongoDB connection)
├── models/
│   ├── User.js       (User schema)
│   └── Match.js      (Match history schema)
├── routes/
│   ├── auth.js       (Auth routes)
│   ├── profile.js    (Profile routes)
│   └── leaderboard.js (Leaderboard routes)
└── middleware/
    └── authMiddleware.js
```

### **Frontend (New Files Needed):**
```
public/
├── settings.html     (Settings page)
├── profile.html      (Profile page)
├── leaderboard.html  (Leaderboard page)
├── login.html        (Login page)
└── js/
    ├── auth.js       (Google auth client)
    └── api.js        (API calls)
```

### **Database Schema:**

#### **User Model:**
```javascript
{
  _id: ObjectId,
  googleId: String,
  email: String,
  displayName: String,
  photoURL: String,
  stats: {
    matchesPlayed: Number,
    matchesWon: Number,
    matchesLost: Number,
    totalRuns: Number,
    totalWickets: Number,
    highestScore: Number,
    bestBowling: { wickets: Number, runs: Number },
    winRate: Number,
    rank: Number
  },
  settings: {
    soundEnabled: Boolean,
    musicEnabled: Boolean,
    soundVolume: Number,
    musicVolume: Number,
    notifications: Boolean,
    theme: String,
    language: String,
    avatar: String
  },
  createdAt: Date,
  lastLogin: Date
}
```

#### **Match Model:**
```javascript
{
  _id: ObjectId,
  roomId: String,
  players: [{ userId: String, team: String, stats: Object }],
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
  date: Date,
  duration: Number
}
```

---

## 📊 **Ranking Algorithm**

```javascript
function calculateRank(user) {
  const winRate = user.stats.matchesWon / user.stats.matchesPlayed;
  const avgRuns = user.stats.totalRuns / user.stats.matchesPlayed;
  const wicketsPerMatch = user.stats.totalWickets / user.stats.matchesPlayed;
  
  const score = 
    (winRate * 400) +           // 40% weight
    (matchesPlayed * 0.2) +     // 20% weight
    (avgRuns * 2) +             // 20% weight
    (wicketsPerMatch * 20);     // 20% weight
  
  return Math.floor(score);
}
```

---

## 🎨 **UI Implementations**

### **1. Team Display in Game (lobby.html)**

**Add to scoreboard:**
```html
<div class="team-status">
  <div class="batting-team">
    <span class="team-icon">🏏</span>
    <span>Team A Batting</span>
  </div>
  <div class="bowling-team">
    <span class="team-icon">⚾</span>
    <span>Team B Bowling</span>
  </div>
</div>
```

**CSS:**
```css
.team-status {
  display: flex;
  justify-content: space-around;
  margin: 20px 0;
  gap: 20px;
}

.batting-team {
  background: linear-gradient(135deg, #4CAF50 0%, #8BC34A 100%);
  padding: 12px 24px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  gap: 10px;
}

.bowling-team {
  background: linear-gradient(135deg, #2196F3 0%, #03A9F4 100%);
  padding: 12px 24px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  gap: 10px;
}
```

---

### **2. Settings Page (settings.html)**

```html
<!DOCTYPE html>
<html>
<head>
  <title>CPL - Settings</title>
  <link rel="stylesheet" href="/styles/main.css">
</head>
<body>
  <div class="settings-container">
    <h1>⚙️ Settings</h1>
    
    <!-- Audio Settings -->
    <section class="settings-section">
      <h2>🔊 Audio</h2>
      
      <div class="setting-item">
        <label>Sound Effects</label>
        <toggle-switch id="soundToggle"></toggle-switch>
      </div>
      
      <div class="setting-item">
        <label>Sound Volume</label>
        <input type="range" min="0" max="100" value="75">
      </div>
      
      <div class="setting-item">
        <label>Background Music</label>
        <toggle-switch id="musicToggle"></toggle-switch>
      </div>
      
      <div class="setting-item">
        <label>Music Volume</label>
        <input type="range" min="0" max="100" value="50">
      </div>
    </section>
    
    <!-- Display Settings -->
    <section class="settings-section">
      <h2>🎨 Display</h2>
      
      <div class="setting-item">
        <label>Theme</label>
        <select>
          <option value="dark">Dark Mode</option>
          <option value="light">Light Mode</option>
        </select>
      </div>
      
      <div class="setting-item">
        <label>Chat Position</label>
        <select>
          <option value="right">Right</option>
          <option value="left">Left</option>
        </select>
      </div>
    </section>
    
    <!-- Notifications -->
    <section class="settings-section">
      <h2>🔔 Notifications</h2>
      
      <div class="setting-item">
        <label>Push Notifications</label>
        <toggle-switch id="notifToggle"></toggle-switch>
      </div>
      
      <div class="setting-item">
        <label>Match Reminders</label>
        <toggle-switch></toggle-switch>
      </div>
    </section>
    
    <!-- Account -->
    <section class="settings-section">
      <h2>👤 Account</h2>
      
      <div class="setting-item">
        <label>Display Name</label>
        <input type="text" placeholder="Your name">
      </div>
      
      <div class="setting-item">
        <label>Avatar</label>
        <avatar-selector></avatar-selector>
      </div>
      
      <button class="btn-danger">Sign Out</button>
    </section>
  </div>
</body>
</html>
```

---

### **3. Profile Page (profile.html)**

```html
<!DOCTYPE html>
<html>
<head>
  <title>CPL - Profile</title>
</head>
<body>
  <div class="profile-container">
    <!-- Profile Header -->
    <div class="profile-header">
      <img src="" id="profilePic" class="profile-pic">
      <div class="profile-info">
        <h1 id="playerName">Player Name</h1>
        <p class="rank">🏆 Rank #42</p>
        <p class="member-since">Member since Jan 2026</p>
      </div>
    </div>
    
    <!-- Stats Overview -->
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-value" id="matchesPlayed">45</div>
        <div class="stat-label">Matches</div>
      </div>
      
      <div class="stat-card">
        <div class="stat-value" id="wins">32</div>
        <div class="stat-label">Wins</div>
      </div>
      
      <div class="stat-card">
        <div class="stat-value" id="winRate">71%</div>
        <div class="stat-label">Win Rate</div>
      </div>
      
      <div class="stat-card">
        <div class="stat-value" id="highScore">156</div>
        <div class="stat-label">High Score</div>
      </div>
    </div>
    
    <!-- Detailed Stats -->
    <section class="detailed-stats">
      <h2>📊 Detailed Statistics</h2>
      
      <div class="stat-row">
        <span>Total Runs Scored</span>
        <span id="totalRuns">2,345</span>
      </div>
      
      <div class="stat-row">
        <span>Total Wickets</span>
        <span id="totalWickets">87</span>
      </div>
      
      <div class="stat-row">
        <span>Average Runs/Match</span>
        <span id="avgRuns">52.1</span>
      </div>
      
      <div class="stat-row">
        <span>Best Bowling</span>
        <span id="bestBowling">5/12</span>
      </div>
    </section>
    
    <!-- Achievements -->
    <section class="achievements">
      <h2>🏅 Achievements</h2>
      
      <div class="achievement-grid">
        <div class="achievement unlocked">
          <div class="achievement-icon">🎯</div>
          <div class="achievement-name">Century Master</div>
          <div class="achievement-desc">Score 100+ runs</div>
        </div>
        
        <div class="achievement unlocked">
          <div class="achievement-icon">🔥</div>
          <div class="achievement-name">Winning Streak</div>
          <div class="achievement-desc">Win 5 in a row</div>
        </div>
        
        <div class="achievement locked">
          <div class="achievement-icon">👑</div>
          <div class="achievement-name">Champion</div>
          <div class="achievement-desc">Reach Rank #1</div>
        </div>
      </div>
    </section>
    
    <!-- Recent Matches -->
    <section class="recent-matches">
      <h2>📅 Recent Matches</h2>
      
      <div class="match-history">
        <div class="match-item won">
          <div class="match-result">WON</div>
          <div class="match-details">
            <div>vs Phoenix Riders</div>
            <div class="match-score">148/6 vs 145/8</div>
          </div>
          <div class="match-date">2 days ago</div>
        </div>
        
        <div class="match-item lost">
          <div class="match-result">LOST</div>
          <div class="match-details">
            <div>vs Thunder Kings</div>
            <div class="match-score">134/8 vs 145/6</div>
          </div>
          <div class="match-date">1 week ago</div>
        </div>
      </div>
    </section>
  </div>
</body>
</html>
```

---

### **4. Leaderboard Page (leaderboard.html)**

```html
<!DOCTYPE html>
<html>
<head>
  <title>CPL - Leaderboard</title>
</head>
<body>
  <div class="leaderboard-container">
    <h1>🏆 Leaderboard 🏆</h1>
    <p class="subtitle">Top Players in CPL</p>
    
    <!-- Filters -->
    <div class="leaderboard-filters">
      <button class="filter-btn active">All Time</button>
      <button class="filter-btn">This Month</button>
      <button class="filter-btn">This Week</button>
    </div>
    
    <!-- Top 3 Podium -->
    <div class="podium">
      <div class="podium-2">
        <div class="player-card">
          <img src="" class="player-avatar">
          <div class="player-name">Royal Warrior</div>
          <div class="player-stats">52 Wins</div>
        </div>
        <div class="podium-rank">2</div>
      </div>
      
      <div class="podium-1">
        <div class="player-card winner">
          <div class="crown">👑</div>
          <img src="" class="player-avatar">
          <div class="player-name">Thunder King</div>
          <div class="player-stats">58 Wins</div>
        </div>
        <div class="podium-rank gold">1</div>
      </div>
      
      <div class="podium-3">
        <div class="player-card">
          <img src="" class="player-avatar">
          <div class="player-name">Phoenix Rider</div>
          <div class="player-stats">48 Wins</div>
        </div>
        <div class="podium-rank">3</div>
      </div>
    </div>
    
    <!-- Leaderboard Table -->
    <div class="leaderboard-table">
      <table>
        <thead>
          <tr>
            <th>Rank</th>
            <th>Player</th>
            <th>Matches</th>
            <th>Wins</th>
            <th>Win Rate</th>
            <th>Avg Score</th>
          </tr>
        </thead>
        <tbody id="leaderboardBody">
          <!-- Rows 4-10 -->
          <tr>
            <td>4</td>
            <td>
              <div class="player-cell">
                <img src="" class="mini-avatar">
                <span>Player One</span>
              </div>
            </td>
            <td>45</td>
            <td>32</td>
            <td>71%</td>
            <td>128</td>
          </tr>
        </tbody>
      </table>
    </div>
    
    <!-- Your Rank -->
    <div class="your-rank">
      <h3>Your Ranking</h3>
      <div class="rank-card">
        <div class="rank-number">#42</div>
        <div class="rank-info">
          <p>You're in the top 15%!</p>
          <p class="rank-tip">Win 3 more matches to reach top 10</p>
        </div>
      </div>
    </div>
  </div>
</body>
</html>
```

---

## 🔐 **Google Authentication Implementation**

### **Step 1: Install Dependencies**
```bash
npm install passport passport-google-oauth20 express-session mongoose dotenv
```

### **Step 2: Create .env file**
```env
GOOGLE_CLIENT_ID=your_client_id_here
GOOGLE_CLIENT_SECRET=your_client_secret_here
MONGODB_URI=mongodb://localhost:27017/cpl-game
SESSION_SECRET=your_random_secret_here
```

### **Step 3: Setup Google OAuth (server/auth.js)**
```javascript
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('./models/User');

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: "/auth/google/callback"
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      let user = await User.findOne({ googleId: profile.id });
      
      if (!user) {
        user = await User.create({
          googleId: profile.id,
          email: profile.emails[0].value,
          displayName: profile.displayName,
          photoURL: profile.photos[0].value,
          stats: {
            matchesPlayed: 0,
            matchesWon: 0,
            matchesLost: 0,
            totalRuns: 0,
            totalWickets: 0,
            highestScore: 0,
            bestBowling: { wickets: 0, runs: 0 },
            winRate: 0,
            rank: 0
          }
        });
      }
      
      user.lastLogin = new Date();
      await user.save();
      
      return done(null, user);
    } catch (err) {
      return done(err, null);
    }
  }
));
```

### **Step 4: Frontend Google Sign-In Button**
```html
<button onclick="signInWithGoogle()" class="google-signin-btn">
  <img src="/assets/google-icon.svg">
  Sign in with Google
</button>

<script>
function signInWithGoogle() {
  window.location.href = '/auth/google';
}
</script>
```

---

## 📊 **Stats Tracking After Match**

```javascript
// When match ends (server-side)
async function updatePlayerStats(userId, matchData, won) {
  const user = await User.findById(userId);
  
  user.stats.matchesPlayed++;
  if (won) user.stats.matchesWon++;
  else user.stats.matchesLost++;
  
  user.stats.totalRuns += matchData.runsScored;
  user.stats.totalWickets += matchData.wicketsTaken;
  
  if (matchData.runsScored > user.stats.highestScore) {
    user.stats.highestScore = matchData.runsScored;
  }
  
  user.stats.winRate = (user.stats.matchesWon / user.stats.matchesPlayed) * 100;
  
  await user.save();
  await updateLeaderboard();
}
```

---

## ✅ **Implementation Checklist**

### **Phase 1: Team Display** (1-2 hours)
- [ ] Add team status UI to lobby.html
- [ ] Update CSS for team badges
- [ ] Update JS to show batting/bowling teams
- [ ] Test innings switch

### **Phase 2: Settings Page** (3-4 hours)
- [ ] Create settings.html
- [ ] Add all settings options
- [ ] Implement save/load settings
- [ ] Connect to localStorage
- [ ] Test all toggles

### **Phase 3: Google Auth** (4-6 hours)
- [ ] Setup Google Cloud Console project
- [ ] Install npm packages
- [ ] Create User model
- [ ] Setup Passport.js
- [ ] Create login page
- [ ] Test authentication flow

### **Phase 4: Profile Page** (3-4 hours)
- [ ] Create profile.html
- [ ] Fetch user data from API
- [ ] Display stats
- [ ] Show achievements
- [ ] Add recent matches

### **Phase 5: Leaderboard** (4-5 hours)
- [ ] Create leaderboard.html
- [ ] Implement ranking algorithm
- [ ] Create API endpoint
- [ ] Display top 10
- [ ] Add filters
- [ ] Show user rank

### **Phase 6: Stats Tracking** (3-4 hours)
- [ ] Track match results
- [ ] Update user stats
- [ ] Save match history
- [ ] Calculate rankings
- [ ] Update leaderboard

**Total Estimated Time: 18-25 hours**

---

**This is the complete plan! Ready to implement?** 🚀
