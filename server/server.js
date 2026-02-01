const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');
const session = require('express-session');
const passport = require('./auth');
const authRoutes = require('./authRoutes');
const { BotManager } = require('./botPlayer');
const KeepAlive = require('./keepAlive');
const { 
  createRoom, 
  addPlayerToRoom, 
  removePlayerFromRoom, 
  getRoom, 
  findRoomForPlayer,
  rejoinRoom,
  getAllRooms
} = require('./room');
const { 
  GAME_STATES,
  startGame, 
  selectPlayers,
  recordPlayerInput,
  areBothInputsReceived,
  processRound,
  isInningsOver,
  switchInnings,
  isMatchOver,
  transitionToNextState,
  getAvailableBatters
} = require('./gameLogic');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

// MongoDB connection (optional)
const mongoose = require('mongoose');
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/cpl';
mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('✅ Connected to MongoDB');
}).catch(err => {
  console.warn('⚠️ MongoDB connection failed:', err.message || err);
});

// Require User model for API endpoints
let User;
try { User = require('./models/user'); } catch (err) { /* optional */ }

// Initialize Bot Manager
const botManager = new BotManager();

// Session middleware
app.use(session({
  secret: process.env.SESSION_SECRET || 'cpl-cricket-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production'
  }
}));

// Passport middleware
app.use(passport.initialize());
app.use(passport.session());

// JSON body parser
app.use(express.json());

// Auth routes
app.use('/auth', authRoutes);

const PORT = process.env.PORT || 3000;

// Serve static files
app.use(express.static(path.join(__dirname, '../public')));

// Health check endpoint (for keep-alive)
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    rooms: getAllRooms().length
  });
});

// API endpoints
app.get('/api/profile/:userId', async (req, res) => {
  const userId = req.params.userId;
  if (!User) {
    return res.json({ user: { stats: {} }, recentMatches: [] });
  }

  try {
    // Try by MongoDB _id first, fall back to googleId
    let user = null;
    if (mongoose.Types.ObjectId.isValid(userId)) {
      user = await User.findById(userId).lean();
    }
    if (!user) {
      user = await User.findOne({ googleId: userId }).lean();
    }

    if (!user) {
      return res.json({ user: { stats: {} }, recentMatches: [] });
    }

    return res.json({ user: { stats: user.stats || {} , displayName: user.displayName, photoURL: user.photoURL }, recentMatches: user.recentMatches || [] });
  } catch (err) {
    console.error('Error fetching profile:', err);
    return res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

app.get('/api/leaderboard', async (req, res) => {
  if (!User) {
    return res.json({ leaderboard: [] });
  }

  try {
    // Simple leaderboard: sort by matchesWon desc, then totalRuns desc
    const users = await User.find({}).sort({ 'stats.matchesWon': -1, 'stats.totalRuns': -1 }).limit(100).lean();

    const leaderboard = users.map(u => ({ displayName: u.displayName, photoURL: u.photoURL, stats: u.stats || {}, settings: u.settings || {} }));
    return res.json({ leaderboard });
  } catch (err) {
    console.error('Error fetching leaderboard:', err);
    return res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

// Root route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.get('/lobby', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/lobby.html'));
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log(`New connection: ${socket.id}`);

  // Set player name
  socket.on('set-name', (name) => {
    if (!name || typeof name !== 'string') return;
    socket.playerName = name.trim();
    console.log(`Socket ${socket.id} set name: ${socket.playerName}`);
  });

  // Join random room
  socket.on('join-random-room', (playerName) => {
    if (!playerName || typeof playerName !== 'string') return;
    
    const name = playerName.trim();
    socket.playerName = name;

    // Find available room or create new one
    const rooms = getAllRooms();
    let targetRoom = null;

    // CRITICAL: Look for available room that is:
    // 1. Not full (< 12 players)
    // 2. In LOBBY state (game hasn't started)
    // 3. Type is 'random'
    for (const roomId in rooms) {
      const room = rooms[roomId];
      if (room.type === 'random' && 
          room.players.length < 12 && 
          room.game.state === 'LOBBY') {
        targetRoom = roomId;
        console.log(`Reusing existing room: ${targetRoom} (${room.players.length}/12 players)`);
        break;
      }
    }

    // Create new room ONLY if no suitable room found
    if (!targetRoom) {
      targetRoom = createRoom('random', 5);
      console.log(`Created new random room: ${targetRoom}`);
    }

    // Add player to room
    const result = addPlayerToRoom(targetRoom, socket.id, name);
    
    if (result.success) {
      socket.join(targetRoom);
      socket.currentRoom = targetRoom;
      
      const room = getRoom(targetRoom);
      
      // Send room data to all players in room
      io.to(targetRoom).emit('room-update', {
        roomId: targetRoom,
        teamA: room.teamA.map(sid => room.playerNames[sid]),
        teamB: room.teamB.map(sid => room.playerNames[sid]),
        players: room.players.map(sid => room.playerNames[sid]),
        leaderA: room.leaderA ? room.playerNames[room.leaderA] : null,
        leaderB: room.leaderB ? room.playerNames[room.leaderB] : null
      });

      io.to(targetRoom).emit('game-state', {
        state: room.game.state,
        score: room.game.score || 0,
        wickets: room.game.wickets || 0,
        overs: room.game.overs || 0,
        balls: room.game.balls || 0,
        totalOvers: room.totalOvers,
        currentBatter: room.game.currentBatter ? room.playerNames[room.game.currentBatter] : null,
        currentBowler: room.game.currentBowler ? room.playerNames[room.game.currentBowler] : null,
        battingTeam: room.game.battingTeam
      });

      // Send join confirmation
      socket.emit('joined-room', {
        roomId: targetRoom,
        playerName: name,
        team: result.team,
        roomType: room.type
      });

      console.log(`${name} joined ${targetRoom} (${room.type}) in Team ${result.team}`);
      
      // 🤖 START BOT TIMER: Add bot after 30 seconds if alone
      setTimeout(() => {
        const currentRoom = getRoom(targetRoom);
        if (currentRoom && botManager.shouldAddBot(currentRoom)) {
          console.log(`⏰ 30 seconds passed - checking if bot needed in ${targetRoom}`);
          const bot = botManager.addBot(targetRoom, io, currentRoom);
          if (bot) {
            // Update room display
            io.to(targetRoom).emit('room-update', {
              roomId: targetRoom,
              teamA: currentRoom.teamA.map(sid => currentRoom.playerNames[sid]),
              teamB: currentRoom.teamB.map(sid => currentRoom.playerNames[sid]),
              players: currentRoom.players.map(sid => currentRoom.playerNames[sid]),
              leaderA: currentRoom.leaderA ? currentRoom.playerNames[currentRoom.leaderA] : null,
              leaderB: currentRoom.leaderB ? currentRoom.playerNames[currentRoom.leaderB] : null
            });
            
            io.to(targetRoom).emit('chat-message', {
              type: 'system',
              message: `🤖 ${bot.name} joined to help you play!`
            });
            
            console.log(`✅ Bot ${bot.name} joined ${targetRoom}`);
          }
        }
      }, 30000); // 30 seconds
      
    } else {
      socket.emit('error', { message: result.message });
    }
  });

  // Create custom room
  socket.on('create-custom-room', (data) => {
    const { playerName, overs } = data;
    
    if (!playerName || typeof playerName !== 'string') return;
    if (!overs || overs < 1 || overs > 20) {
      socket.emit('error', { message: 'Overs must be between 1 and 20' });
      return;
    }
    
    const name = playerName.trim();
    socket.playerName = name;

    // Create new custom room
    const roomId = createRoom('custom', overs);
    console.log(`Created custom room: ${roomId} with ${overs} overs`);

    // Add creator to room
    const result = addPlayerToRoom(roomId, socket.id, name);
    
    if (result.success) {
      socket.join(roomId);
      socket.currentRoom = roomId;
      
      const room = getRoom(roomId);
      
      // Send room data
      io.to(roomId).emit('room-update', {
        roomId: roomId,
        teamA: room.teamA.map(sid => room.playerNames[sid]),
        teamB: room.teamB.map(sid => room.playerNames[sid]),
        players: room.players.map(sid => room.playerNames[sid]),
        leaderA: room.leaderA ? room.playerNames[room.leaderA] : null,
        leaderB: room.leaderB ? room.playerNames[room.leaderB] : null
      });

      io.to(roomId).emit('game-state', {
        state: room.game.state,
        score: room.game.score || 0,
        wickets: room.game.wickets || 0,
        overs: room.game.overs || 0,
        balls: room.game.balls || 0,
        totalOvers: room.totalOvers,
        currentBatter: null,
        currentBowler: null,
        battingTeam: null
      });

      // Send join confirmation with room code
      socket.emit('custom-room-created', {
        roomId: roomId,
        playerName: name,
        team: result.team,
        overs: overs,
        roomType: 'custom'
      });

      console.log(`${name} created custom room ${roomId} with ${overs} overs`);
      
      // 🤖 START BOT TIMER: Add bot after 30 seconds if alone
      setTimeout(() => {
        const currentRoom = getRoom(roomId);
        if (currentRoom && botManager.shouldAddBot(currentRoom)) {
          console.log(`⏰ 30 seconds passed - checking if bot needed in ${roomId}`);
          const bot = botManager.addBot(roomId, io, currentRoom);
          if (bot) {
            // Update room display
            io.to(roomId).emit('room-update', {
              roomId: roomId,
              teamA: currentRoom.teamA.map(sid => currentRoom.playerNames[sid]),
              teamB: currentRoom.teamB.map(sid => currentRoom.playerNames[sid]),
              players: currentRoom.players.map(sid => currentRoom.playerNames[sid]),
              leaderA: currentRoom.leaderA ? currentRoom.playerNames[currentRoom.leaderA] : null,
              leaderB: currentRoom.leaderB ? currentRoom.playerNames[currentRoom.leaderB] : null
            });
            
            io.to(roomId).emit('chat-message', {
              type: 'system',
              message: `🤖 ${bot.name} joined to help you play!`
            });
            
            console.log(`✅ Bot ${bot.name} joined ${roomId}`);
          }
        }
      }, 30000); // 30 seconds
      
    } else {
      socket.emit('error', { message: result.message });
    }
  });

  // Join custom room by code
  socket.on('join-custom-room', (data) => {
    const { playerName, roomCode } = data;
    
    if (!playerName || typeof playerName !== 'string') return;
    if (!roomCode || typeof roomCode !== 'string') return;
    
    const name = playerName.trim();
    const roomId = roomCode.trim();
    socket.playerName = name;

    // Check if room exists
    const room = getRoom(roomId);
    if (!room) {
      socket.emit('error', { message: 'Room not found. Check the room code.' });
      return;
    }

    // Check if room is custom
    if (room.type !== 'custom') {
      socket.emit('error', { message: 'Invalid room code' });
      return;
    }

    // Check if room is full
    if (room.players.length >= 12) {
      socket.emit('error', { message: 'Room is full' });
      return;
    }

    // Check if game already started
    if (room.game.state !== 'LOBBY') {
      socket.emit('error', { message: 'Game already in progress' });
      return;
    }

    // Add player to room
    const result = addPlayerToRoom(roomId, socket.id, name);
    
    if (result.success) {
      socket.join(roomId);
      socket.currentRoom = roomId;
      
      // Send room data to all players
      io.to(roomId).emit('room-update', {
        roomId: roomId,
        teamA: room.teamA.map(sid => room.playerNames[sid]),
        teamB: room.teamB.map(sid => room.playerNames[sid]),
        players: room.players.map(sid => room.playerNames[sid]),
        leaderA: room.leaderA ? room.playerNames[room.leaderA] : null,
        leaderB: room.leaderB ? room.playerNames[room.leaderB] : null
      });

      io.to(roomId).emit('game-state', {
        state: room.game.state,
        score: room.game.score || 0,
        wickets: room.game.wickets || 0,
        overs: room.game.overs || 0,
        balls: room.game.balls || 0,
        totalOvers: room.totalOvers,
        currentBatter: room.game.currentBatter ? room.playerNames[room.game.currentBatter] : null,
        currentBowler: room.game.currentBowler ? room.playerNames[room.game.currentBowler] : null,
        battingTeam: room.game.battingTeam
      });

      // Send join confirmation
      socket.emit('joined-room', {
        roomId: roomId,
        playerName: name,
        team: result.team,
        roomType: room.type
      });

      console.log(`${name} joined custom room ${roomId} in Team ${result.team}`);
    } else {
      socket.emit('error', { message: result.message });
    }
  });

  // Rejoin room after disconnect/refresh
  socket.on('rejoin-room', (data) => {
    const { playerName, roomId } = data;
    
    if (!playerName || !roomId) return;

    const result = rejoinRoom(roomId, socket.id, playerName.trim());
    
    if (result.success) {
      socket.join(roomId);
      socket.currentRoom = roomId;
      socket.playerName = playerName.trim();
      
      const room = getRoom(roomId);
      
      // Send room update to all
      io.to(roomId).emit('room-update', {
        roomId: roomId,
        teamA: room.teamA.map(sid => room.playerNames[sid]),
        teamB: room.teamB.map(sid => room.playerNames[sid]),
        players: room.players.map(sid => room.playerNames[sid]),
        leaderA: room.leaderA ? room.playerNames[room.leaderA] : null,
        leaderB: room.leaderB ? room.playerNames[room.leaderB] : null
      });

      io.to(roomId).emit('game-state', {
        state: room.game.state,
        score: room.game.score || 0,
        wickets: room.game.wickets || 0,
        overs: room.game.overs || 0,
        balls: room.game.balls || 0,
        totalOvers: room.totalOvers,
        currentBatter: room.game.currentBatter ? room.playerNames[room.game.currentBatter] : null,
        currentBowler: room.game.currentBowler ? room.playerNames[room.game.currentBowler] : null,
        battingTeam: room.game.battingTeam
      });

      socket.emit('rejoin-success', {
        roomId: roomId,
        team: result.team
      });

      console.log(`${playerName} rejoined ${roomId}`);
    } else {
      socket.emit('error', { message: result.message });
    }
  });

  // Select leaders (auto or manual)
  socket.on('select-leaders', (roomId) => {
    const room = getRoom(roomId);
    if (!room) return;

    // Auto-select random leaders from each team
    if (room.teamA.length > 0 && room.teamB.length > 0) {
      room.leaderA = room.teamA[Math.floor(Math.random() * room.teamA.length)];
      room.leaderB = room.teamB[Math.floor(Math.random() * room.teamB.length)];

      io.to(roomId).emit('leaders-selected', {
        leaderA: room.playerNames[room.leaderA],
        leaderB: room.playerNames[room.leaderB]
      });

      io.to(roomId).emit('room-update', {
        roomId: roomId,
        teamA: room.teamA.map(sid => room.playerNames[sid]),
        teamB: room.teamB.map(sid => room.playerNames[sid]),
        players: room.players.map(sid => room.playerNames[sid]),
        leaderA: room.playerNames[room.leaderA],
        leaderB: room.playerNames[room.leaderB]
      });

      console.log(`Leaders selected for ${roomId}: ${room.playerNames[room.leaderA]} and ${room.playerNames[room.leaderB]}`);
    }
  });

  // Leader submits their player selection (batter OR bowler)
  socket.on('submit-player-selection', (data) => {
    const { roomId, role, playerName } = data;
    const room = getRoom(roomId);
    
    if (!room) return;

    // Verify requester is a leader
    if (socket.id !== room.leaderA && socket.id !== room.leaderB) {
      socket.emit('error', { message: 'Only leaders can select players' });
      return;
    }

    console.log(`[SELECTION SUBMITTED] ${roomId}: ${role} = ${playerName}`);

    // Store the selection temporarily
    if (role === 'batter') {
      room.game.pendingBatter = playerName;
    } else if (role === 'bowler') {
      room.game.pendingBowler = playerName;
    }

    // Check if we have BOTH selections now
    if (room.game.pendingBatter && room.game.pendingBowler) {
      // Both selected! Now actually set the players
      const batterName = room.game.pendingBatter;
      const bowlerName = room.game.pendingBowler;

      // Find socket IDs
      let batterSocket = null;
      let bowlerSocket = null;

      for (const sid in room.playerNames) {
        if (room.playerNames[sid] === batterName) batterSocket = sid;
        if (room.playerNames[sid] === bowlerName) bowlerSocket = sid;
      }

      if (batterSocket && bowlerSocket) {
        const result = selectPlayers(roomId, batterSocket, bowlerSocket);
        
        if (result.success) {
          // Clear pending selections
          room.game.pendingBatter = null;
          room.game.pendingBowler = null;

          // Broadcast players selected
          io.to(roomId).emit('players-selected', {
            batter: batterName,
            bowler: bowlerName
          });

          // Send updated game state
          io.to(roomId).emit('game-state', {
            state: result.state,
            score: room.game.score || 0,
            wickets: room.game.wickets || 0,
            overs: room.game.overs || 0,
            balls: room.game.balls || 0,
            totalOvers: room.totalOvers,
            currentBatter: batterName,
            currentBowler: bowlerName,
            battingTeam: room.game.battingTeam,
            bowlingTeam: room.game.bowlingTeam
          });

          console.log(`[PLAYERS SET] ${roomId}: ${batterName} vs ${bowlerName}, State → ${result.state}`);
        } else {
          io.to(roomId).emit('error', { message: result.message });
        }
      }
    } else {
      // Only one selected so far, waiting for the other
      const waiting = role === 'batter' ? 'bowler' : 'batter';
      io.to(roomId).emit('waiting-for-selection', {
        message: `Waiting for ${waiting} selection...`
      });
    }
  });

  // Leader selects batter and bowler (DEPRECATED - kept for compatibility)
  socket.on('select-players', (data) => {
    const { roomId, batterName, bowlerName } = data;
    const room = getRoom(roomId);
    
    if (!room) return;

    // Verify requester is a leader
    if (socket.id !== room.leaderA && socket.id !== room.leaderB) {
      socket.emit('error', { message: 'Only leaders can select players' });
      return;
    }

    // Find socket IDs for selected players
    let batterSocket = null;
    let bowlerSocket = null;

    for (const sid in room.playerNames) {
      if (room.playerNames[sid] === batterName) batterSocket = sid;
      if (room.playerNames[sid] === bowlerName) bowlerSocket = sid;
    }

    // Both must be selected to proceed
    if (!batterSocket || !bowlerSocket) {
      socket.emit('error', { message: 'Both batter and bowler must be selected' });
      return;
    }

    const result = selectPlayers(roomId, batterSocket, bowlerSocket);
    
    if (result.success) {
      io.to(roomId).emit('players-selected', {
        batter: batterName,
        bowler: bowlerName
      });

      io.to(roomId).emit('game-state', {
        state: result.state,
        score: room.game.score || 0,
        wickets: room.game.wickets || 0,
        overs: room.game.overs || 0,
        balls: room.game.balls || 0,
        totalOvers: room.totalOvers,
        currentBatter: batterName,
        currentBowler: bowlerName,
        battingTeam: room.game.battingTeam,
        bowlingTeam: room.game.bowlingTeam
      });

      console.log(`[PLAYERS SELECTED] ${roomId}: ${batterName} (batter) vs ${bowlerName} (bowler)`);
    } else {
      socket.emit('error', { message: result.message });
    }
  });

  // Start game
  socket.on('start-game', (roomId) => {
    const room = getRoom(roomId);
    if (!room) return;

    // Verify requester is a leader
    if (socket.id !== room.leaderA && socket.id !== room.leaderB) {
      socket.emit('error', { message: 'Only leaders can start game' });
      return;
    }

    // Ensure leaders are selected
    if (!room.leaderA || !room.leaderB) {
      socket.emit('error', { message: 'Leaders must be selected first' });
      return;
    }

    const result = startGame(roomId);
    
    if (result.success) {
      // Broadcast game started
      io.to(roomId).emit('game-started', {
        message: 'Game Started! Leaders are selecting players...',
        state: result.state
      });

      // Send updated game state
      io.to(roomId).emit('game-state', {
        state: result.state,
        score: 0,
        wickets: 0,
        overs: 0,
        balls: 0,
        totalOvers: room.totalOvers,
        currentBatter: null,
        currentBowler: null,
        battingTeam: room.game.battingTeam,
        bowlingTeam: room.game.bowlingTeam
      });

      // CRITICAL: Store which team each leader controls
      const battingLeader = room.game.battingTeam === 'A' ? room.leaderA : room.leaderB;
      const bowlingLeader = room.game.bowlingTeam === 'A' ? room.leaderA : room.leaderB;
      const battingTeamPlayers = room.game.battingTeam === 'A' ? room.teamA : room.teamB;
      const bowlingTeamPlayers = room.game.bowlingTeam === 'A' ? room.teamA : room.teamB;

      // Request BOTH leaders to select players (they'll see modals simultaneously)
      io.to(battingLeader).emit('request-player-selection', {
        role: 'batter',
        team: room.game.battingTeam,
        availablePlayers: battingTeamPlayers.map(sid => room.playerNames[sid]),
        reason: 'start'
      });

      io.to(bowlingLeader).emit('request-player-selection', {
        role: 'bowler',
        team: room.game.bowlingTeam,
        availablePlayers: bowlingTeamPlayers.map(sid => room.playerNames[sid]),
        reason: 'start'
      });

      console.log(`[GAME START] ${roomId}: Requesting player selections`);
    } else {
      socket.emit('error', { message: result.message });
    }
  });

  // Player input (finger choice)
  socket.on('player-input', (data) => {
    const { roomId, fingers } = data;
    const room = getRoom(roomId);
    
    if (!room) return;

    // Record the input
    const inputResult = recordPlayerInput(roomId, socket.id, fingers);
    
    if (!inputResult.success) {
      socket.emit('error', { message: inputResult.message });
      return;
    }

    console.log(`[INPUT] ${roomId}: ${room.playerNames[socket.id]} chose ${fingers}`);
    
    // Notify player that input was received
    socket.emit('input-confirmed', { fingers });

    // Check if both inputs received
    if (areBothInputsReceived(roomId)) {
      // Process the round
      const result = processRound(roomId);
      
      if (result.success) {
        // Send result to all players
        io.to(roomId).emit('round-result', {
          batterFingers: result.batterFingers,
          bowlerFingers: result.bowlerFingers,
          runs: result.runs,
          isOut: result.isOut,
          isOverComplete: result.isOverComplete,
          batter: room.playerNames[room.game.currentBatter],
          bowler: room.playerNames[room.game.currentBowler],
          score: result.score,
          wickets: result.wickets
        });

        console.log(`[ROUND] ${roomId}: ${result.batterFingers} vs ${result.bowlerFingers} = ${result.isOut ? 'OUT' : result.runs + ' runs'}`);

        // Wait for result animation (3 seconds)
        setTimeout(() => {
          // Check if innings is switching
          if (result.switchingInnings) {
            // Innings switching!
            io.to(roomId).emit('innings-complete', {
              innings: 1,
              score: room.game.innings1Score,
              wickets: room.game.innings1Wickets,
              target: room.game.innings1Score + 1,
              message: `Innings 1 Complete! Team ${room.game.battingTeam} needs ${room.game.innings1Score + 1} runs to win!`
            });
            
            // Wait 5 seconds to show innings break message
            setTimeout(() => {
              // Transition to next state
              transitionToNextState(roomId, result.nextState);
              
              // Send updated game state for innings 2
              io.to(roomId).emit('game-state', {
                state: result.nextState,
                innings: room.game.innings,
                score: room.game.score,
                wickets: room.game.wickets,
                overs: room.game.overs,
                balls: room.game.balls,
                totalOvers: room.totalOvers,
                target: room.game.innings1Score + 1,
                currentBatter: null,
                currentBowler: null,
                battingTeam: room.game.battingTeam,
                bowlingTeam: room.game.bowlingTeam
              });
              
              // Request player selection for innings 2
              const battingLeader = room.game.battingTeam === 'A' ? room.leaderA : room.leaderB;
              const bowlingLeader = room.game.bowlingTeam === 'A' ? room.leaderA : room.leaderB;
              const battingTeamPlayers = room.game.battingTeam === 'A' ? room.teamA : room.teamB;
              const bowlingTeamPlayers = room.game.bowlingTeam === 'A' ? room.teamA : room.teamB;
              
              io.to(battingLeader).emit('request-player-selection', {
                role: 'batter',
                team: room.game.battingTeam,
                availablePlayers: battingTeamPlayers.map(sid => room.playerNames[sid]),
                reason: 'innings2'
              });
              
              io.to(bowlingLeader).emit('request-player-selection', {
                role: 'bowler',
                team: room.game.bowlingTeam,
                availablePlayers: bowlingTeamPlayers.map(sid => room.playerNames[sid]),
                reason: 'innings2'
              });
            }, 5000); // 5 second innings break
            
            return; // Don't continue with normal flow
          }
          
          // Normal flow (not innings switch)
          transitionToNextState(roomId, result.nextState);
          
          // Send updated game state
          io.to(roomId).emit('game-state', {
            state: result.nextState,
            innings: result.innings,
            score: result.score,
            wickets: result.wickets,
            overs: result.overs,
            balls: result.balls,
            totalOvers: room.totalOvers,
            target: result.target,
            currentBatter: room.game.currentBatter ? room.playerNames[room.game.currentBatter] : null,
            currentBowler: room.game.currentBowler ? room.playerNames[room.game.currentBowler] : null,
            battingTeam: room.game.battingTeam,
            bowlingTeam: room.game.bowlingTeam
          });

          // Handle next state
          if (result.nextState === GAME_STATES.MATCH_END) {
            // Game over - send both innings scores
            io.to(roomId).emit('game-over', {
              innings1Score: room.game.innings1Score || 0,
              innings1Wickets: room.game.innings1Wickets || 0,
              innings2Score: room.game.innings2Score || 0,
              innings2Wickets: room.game.innings2Wickets || 0,
              reason: result.gameOverReason
            });
            console.log(`[MATCH END] ${roomId}: ${result.gameOverReason}`);
            
          } else if (result.nextState === GAME_STATES.PLAYER_SELECTION) {
            // Need to select new players
            if (result.isOut) {
              // Batter is out - select new batter ONLY, keep same bowler
              const availableBatters = getAvailableBatters(roomId);
              
              if (availableBatters.length > 0) {
                const battingLeader = room.game.battingTeam === 'A' ? room.leaderA : room.leaderB;
                
                // CRITICAL FIX: Auto-fill current bowler so we only wait for batter
                const currentBowlerName = room.playerNames[room.game.currentBowler];
                room.game.pendingBowler = currentBowlerName;
                
                // Request batting leader to select new batter
                io.to(battingLeader).emit('request-player-selection', {
                  role: 'batter',
                  reason: 'out',
                  team: room.game.battingTeam,
                  availablePlayers: availableBatters.map(sid => room.playerNames[sid])
                });
                
                io.to(roomId).emit('waiting-for-selection', {
                  message: `Batter is OUT! Leader selecting new batter... (Bowler: ${currentBowlerName})`
                });
                
                console.log(`[OUT] ${roomId}: Keeping bowler ${currentBowlerName}, requesting new batter`);
              } else {
                // All out
                io.to(roomId).emit('game-over', {
                  finalScore: result.score,
                  wickets: result.wickets,
                  overs: result.overs,
                  reason: 'All wickets down'
                });
              }
            } else if (result.isOverComplete) {
              // Over complete - can change bowler if needed
              io.to(roomId).emit('over-complete', {
                over: result.overs,
                message: `Over ${result.overs} complete!`
              });
              
              // Request both leaders to select next players
              const battingLeader = room.game.battingTeam === 'A' ? room.leaderA : room.leaderB;
              const bowlingLeader = room.game.bowlingTeam === 'A' ? room.leaderA : room.leaderB;
              
              const availableBatters = getAvailableBatters(roomId);
              const bowlingTeam = room.game.bowlingTeam === 'A' ? room.teamA : room.teamB;
              
              io.to(battingLeader).emit('request-player-selection', {
                role: 'batter',
                reason: 'over-complete',
                team: room.game.battingTeam,
                availablePlayers: availableBatters.map(sid => room.playerNames[sid])
              });
              
              io.to(bowlingLeader).emit('request-player-selection', {
                role: 'bowler',
                reason: 'over-complete',
                team: room.game.bowlingTeam,
                availablePlayers: bowlingTeam.map(sid => room.playerNames[sid])
              });
            }
          } else if (result.nextState === GAME_STATES.PLAYING) {
            // Continue with same players
            io.to(roomId).emit('next-ball', {
              message: 'Next ball!'
            });
          }
        }, 3000); // 3 second animation delay
      }
    }
  });

  // Chat message
  socket.on('chat-message', (data) => {
    const { roomId, message } = data;
    const room = getRoom(roomId);
    
    if (!room || !socket.playerName) return;

    // Check if player can chat (spectators can always chat)
    const canChat = socket.id !== room.game.currentBatter && socket.id !== room.game.currentBowler;
    
    if (room.game.state === 'LOBBY' || canChat) {
      io.to(roomId).emit('chat-message', {
        playerName: socket.playerName,
        message: message.trim(),
        timestamp: Date.now()
      });
    }
  });

  // NEW: Request new game
  socket.on('request-new-game', (data) => {
    const { roomId } = data;
    const room = getRoom(roomId);
    
    if (!room) return;

    console.log(`[NEW GAME] ${roomId}: Resetting game`);

    // Reset game state
    room.game.state = 'LOBBY';
    room.game.score = 0;
    room.game.wickets = 0;
    room.game.overs = 0;
    room.game.balls = 0;
    room.game.currentBatter = null;
    room.game.currentBowler = null;
    room.game.batterInput = null;
    room.game.bowlerInput = null;
    room.game.battingTeam = null;
    room.game.bowlingTeam = null;
    room.game.outPlayers = [];
    room.game.pendingBatter = null;
    room.game.pendingBowler = null;
    room.game.history = [];

    // Keep leaders
    // Keep players
    // Keep teams

    // Broadcast game reset
    io.to(roomId).emit('game-reset', {
      message: 'New game starting!'
    });

    io.to(roomId).emit('game-state', {
      state: 'LOBBY',
      score: 0,
      wickets: 0,
      overs: 0,
      balls: 0,
      totalOvers: room.totalOvers,
      currentBatter: null,
      currentBowler: null,
      battingTeam: null
    });

    io.to(roomId).emit('room-update', {
      roomId: roomId,
      teamA: room.teamA.map(sid => room.playerNames[sid]),
      teamB: room.teamB.map(sid => room.playerNames[sid]),
      players: room.players.map(sid => room.playerNames[sid]),
      leaderA: room.leaderA ? room.playerNames[room.leaderA] : null,
      leaderB: room.leaderB ? room.playerNames[room.leaderB] : null
    });
  });

  // Disconnect handling with grace period
  socket.on('disconnect', () => {
    console.log(`Disconnect: ${socket.id} (${socket.playerName || 'unknown'})`);
    
    if (socket.currentRoom) {
      const room = getRoom(socket.currentRoom);
      
      if (room) {
        // Don't immediately remove - wait for potential reconnect
        setTimeout(() => {
          const stillExists = getRoom(socket.currentRoom);
          if (stillExists && stillExists.players.includes(socket.id)) {
            // Player didn't reconnect - remove them
            const playerName = socket.playerName;
            removePlayerFromRoom(socket.currentRoom, socket.id);
            
            const updatedRoom = getRoom(socket.currentRoom);
            if (updatedRoom) {
              io.to(socket.currentRoom).emit('room-update', {
                roomId: socket.currentRoom,
                teamA: updatedRoom.teamA.map(sid => updatedRoom.playerNames[sid]),
                teamB: updatedRoom.teamB.map(sid => updatedRoom.playerNames[sid]),
                players: updatedRoom.players.map(sid => updatedRoom.playerNames[sid]),
                leaderA: updatedRoom.leaderA ? updatedRoom.playerNames[updatedRoom.leaderA] : null,
                leaderB: updatedRoom.leaderB ? updatedRoom.playerNames[updatedRoom.leaderB] : null
              });

              io.to(socket.currentRoom).emit('player-left', {
                playerName: playerName
              });

              console.log(`${playerName} left ${socket.currentRoom} (timeout)`);
            }
          }
        }, 5000); // 5 second grace period for reconnect
      }
    }
  });
});

server.listen(PORT, () => {
  console.log(`🏏 CPL Server running on http://localhost:${PORT}`);
  console.log(`Ready for multiplayer finger cricket!`);
  
  // Start keep-alive system (only in production)
  if (process.env.NODE_ENV === 'production' && process.env.CLIENT_URL) {
    const keepAlive = new KeepAlive(process.env.CLIENT_URL + '/health', 14);
    keepAlive.start();
    console.log(`⏰ Keep-alive system started`);
  }
});
