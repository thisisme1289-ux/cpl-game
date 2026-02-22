# 🚀 CPL Quick Setup Guide

Follow these steps to get your CPL game running in 15 minutes!

## ✅ Step 1: Install Node.js

1. Go to https://nodejs.org/
2. Download the LTS version (recommended)
3. Install it
4. Verify installation:
```bash
node --version
npm --version
```

Both commands should show version numbers.

## ✅ Step 2: Get MongoDB Database

### Option A: MongoDB Atlas (Recommended - Free Forever)

1. Go to https://www.mongodb.com/cloud/atlas
2. Click "Try Free" and sign up
3. Create a cluster:
   - Cloud Provider: AWS (or any)
   - Region: Choose closest to you
   - Cluster Tier: M0 Sandbox (FREE)
   - Cluster Name: CPL-Cluster
4. Wait 3-5 minutes for cluster creation
5. Click "Connect"
6. Add Connection IP:
   - Click "Add a Different IP Address"
   - Enter `0.0.0.0/0` (allows all IPs - good for testing)
   - Click "Add IP Address"
7. Create Database User:
   - Username: `cpluser`
   - Password: Create a strong password (e.g., `CPL@Game123`)
   - Click "Create Database User"
8. Click "Choose a connection method"
9. Click "Connect your application"
10. Copy the connection string (looks like):
```
mongodb+srv://cpluser:<password>@cpl-cluster.xxxxx.mongodb.net/?retryWrites=true&w=majority
```
11. Replace `<password>` with your actual password
12. Change `/?retryWrites` to `/cpl-game?retryWrites`

Final string should look like:
```
mongodb+srv://cpluser:CPL@Game123@cpl-cluster.xxxxx.mongodb.net/cpl-game?retryWrites=true&w=majority
```

**SAVE THIS STRING - You'll need it in Step 4!**

## ✅ Step 3: Setup Google OAuth

1. Go to https://console.cloud.google.com/
2. Sign in with your Google account
3. Create a new project:
   - Click "Select a project" (top bar)
   - Click "NEW PROJECT"
   - Project name: `CPL Game`
   - Click "CREATE"
4. Wait for project creation (30 seconds)
5. Select your project from the dropdown
6. Enable Google+ API:
   - Click "≡" menu → "APIs & Services" → "Library"
   - Search for "Google+ API"
   - Click on it
   - Click "ENABLE"
7. Create OAuth Consent Screen:
   - Click "≡" menu → "APIs & Services" → "OAuth consent screen"
   - User Type: External
   - Click "CREATE"
   - App name: `CPL - Class Premier League`
   - User support email: Your email
   - Developer contact: Your email
   - Click "SAVE AND CONTINUE"
   - Click "SAVE AND CONTINUE" (skip scopes)
   - Click "SAVE AND CONTINUE" (skip test users)
   - Click "BACK TO DASHBOARD"
8. Create Credentials:
   - Click "≡" menu → "APIs & Services" → "Credentials"
   - Click "+ CREATE CREDENTIALS" → "OAuth client ID"
   - Application type: "Web application"
   - Name: `CPL Web Client`
   - Authorized JavaScript origins:
     - Click "ADD URI"
     - Enter: `http://localhost:3000`
   - Authorized redirect URIs:
     - Click "ADD URI"
     - Enter: `http://localhost:3000`
   - Click "CREATE"
9. Copy the "Client ID" (looks like):
```
123456789012-abcdefghijklmnopqrstuvwxyz123456.apps.googleusercontent.com
```

**SAVE THIS CLIENT ID - You'll need it in Step 4!**

## ✅ Step 4: Configure the Project

1. Open the `cpl-new` folder
2. Find the `.env.example` file
3. Copy it and rename to `.env`
4. Open `.env` in any text editor
5. Fill in the values:

```env
# Server
PORT=3000
NODE_ENV=development

# MongoDB - Paste your MongoDB connection string here
MONGODB_URI=mongodb+srv://cpluser:CPL@Game123@cpl-cluster.xxxxx.mongodb.net/cpl-game?retryWrites=true&w=majority

# JWT Secret - Generate a random secret
JWT_SECRET=your_super_secret_jwt_key_here

# Google OAuth - Paste your Google Client ID here
GOOGLE_CLIENT_ID=123456789012-abcdefghijklmnopqrstuvwxyz123456.apps.googleusercontent.com

# Frontend URL
FRONTEND_URL=http://localhost:3000

# Game Settings (Optional - can leave as is)
MATCH_OVERS=5
LOBBY_TIMEOUT=60
MAX_PLAYERS_PER_ROOM=12
LEADERBOARD_CACHE_MINUTES=5
```

### Generate JWT Secret:

Open terminal/command prompt and run:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Copy the output and paste as `JWT_SECRET`.

6. **Update Frontend Files**:

Edit `public/js/login.js`:
- Line 8: Replace `YOUR_GOOGLE_CLIENT_ID` with your actual Client ID

Edit `public/views/login.html`:
- Line 41: Replace `YOUR_GOOGLE_CLIENT_ID` with your actual Client ID

## ✅ Step 5: Install & Run

1. Open terminal/command prompt
2. Navigate to project folder:
```bash
cd path/to/cpl-new
```

3. Install dependencies:
```bash
npm install
```

This will take 1-2 minutes.

4. Start the server:
```bash
npm start
```

You should see:
```
╔════════════════════════════════════════╗
║  🏏 CPL SERVER RUNNING SUCCESSFULLY!   ║
╠════════════════════════════════════════╣
║  Port: 3000                            ║
║  Environment: development              ║
║  URL: http://localhost:3000            ║
║                                        ║
║  Features:                             ║
║  ✅ Database Connected                 ║
║  ✅ Socket.IO Ready                    ║
║  ✅ Authentication Active              ║
║  ✅ Game Engine Loaded                 ║
╚════════════════════════════════════════╝
```

5. Open your browser and go to:
```
http://localhost:3000
```

## ✅ Step 6: Test Login

1. Click "Continue with Google"
2. Sign in with your Google account
3. Allow permissions
4. You should be redirected to the dashboard!

## 🎉 Success!

Your CPL game is now running! You can:
- Play with friends by sharing room codes
- Practice against bots
- View leaderboards
- Track your stats

## 🐛 Troubleshooting

### "MongoDB connection failed"
- Double-check your MongoDB URI in `.env`
- Make sure password is correct
- Ensure you replaced `<password>` in the connection string
- Check if you added `0.0.0.0/0` to IP whitelist

### "Google authentication failed"
- Verify Google Client ID in both `.env` and frontend files
- Check if you added `http://localhost:3000` to authorized origins
- Make sure OAuth consent screen is configured

### "Port 3000 already in use"
- Another app is using port 3000
- Change `PORT=3001` in `.env`
- Or kill the process:
  - Mac/Linux: `lsof -ti:3000 | xargs kill -9`
  - Windows: `netstat -ano | findstr :3000` then `taskkill /PID <PID> /F`

### Can't install npm packages
- Make sure Node.js is installed correctly
- Try: `npm cache clean --force`
- Then: `npm install` again

## 📱 Next Steps

### For Development:
```bash
npm run dev
```
This auto-restarts server when you make changes.

### Deploy to Internet (Render.com):
1. Push code to GitHub
2. Go to https://render.com/
3. Connect GitHub repo
4. Add all environment variables from `.env`
5. Deploy!

## 💡 Tips

1. **Keep `.env` file secret** - Never share it or commit to GitHub
2. **Use strong passwords** - For MongoDB and JWT secret
3. **Test locally first** - Make sure everything works before deploying
4. **Read README.md** - For more detailed information

## 🆘 Need Help?

If you're stuck:
1. Check error messages in terminal
2. Check browser console (F12)
3. Re-read this guide carefully
4. Check README.md for more details

## 🎮 Have Fun!

You're all set to enjoy CPL! Challenge your friends and climb the leaderboard! 🏆

Made with ❤️ for cricket fans 🏏
