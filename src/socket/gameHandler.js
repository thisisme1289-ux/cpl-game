// ============================================
// SOCKET.IO HANDLER - Real-time Gameplay
// ============================================

const { EVENTS, ROOM_STATUS, PLAYER } = require('../config/game');
const authService = require('../services/authService');
const roomManager = require('../utils/roomManager');
const GameEngine = require('../utils/gameEngine');
const Game = require('../models/Game');
const User = require('../models/User');

/**
 * Initialize Socket.IO handlers
 * 
 * @param {Object} io - Socket.IO server instance
 */
function initializeSocketHandlers(io) {
  
  // Track connected users
  const connectedUsers = new Map();  // socketId => user data

  io.on('connection', async (socket) => {
    console.log(`🔌 Socket connected: ${socket.id}`);

    /**
     * AUTH: Authenticate socket connection
     */
    socket.on(EVENTS.AUTH_REQUEST, async (data) => {
      try {
        const { token } = data;

        if (!token) {
          socket.emit(EVENTS.AUTH_FAILED, { message: 'No token provided' });
          return;
        }

        // Verify token and get user
        const user = await authService.getUserFromToken(token);

        // Store user data
        connectedUsers.set(socket.id, {
          id: user._id.toString(),
          name: user.name,
          avatar: user.avatar,
          socketId: socket.id,
        });

        // Send success
        socket.emit(EVENTS.AUTH_SUCCESS, {
          message: 'Authentication successful',
          user: {
            id: user._id,
            name: user.name,
            avatar: user.avatar,
          },
        });

        // Send updated stats
        const stats = await authService.refreshUserStats(user._id);
        socket.emit(EVENTS.STATS_UPDATE, stats);

        console.log(`✅ Socket authenticated: ${user.name}`);

      } catch (error) {
        console.error('❌ Socket auth error:', error);
        socket.emit(EVENTS.AUTH_FAILED, { message: 'Authentication failed' });
      }
    });

    /**
     * JOIN LOBBY: Join random matchmaking or specific room
     */
    socket.on(EVENTS.JOIN_LOBBY, async (data) => {
      try {
        const user = connectedUsers.get(socket.id);
        
        if (!user) {
          socket.emit(EVENTS.ERROR, { message: 'Not authenticated' });
          return;
        }

        const { mode, roomId } = data;

        let room;

        if (mode === 'random') {
          // Join or create random room
          const randomRooms = roomManager.getRoomsByMode('random');
          const availableRoom = randomRooms.find(r => 
            r.status === ROOM_STATUS.WAITING && 
            r.players.length < r.maxPlayers
          );

          if (availableRoom) {
            room = roomManager.addPlayer(availableRoom.id, user);
          } else {
            room = roomManager.createRoom('random', user);
            room = roomManager.addPlayer(room.id, user);
          }

        } else if (roomId) {
          // Join specific room
          room = roomManager.getRoom(roomId);
          
          if (!room) {
            socket.emit(EVENTS.ROOM_NOT_FOUND, { message: 'Room not found' });
            return;
          }

          if (room.players.length >= room.maxPlayers) {
            socket.emit(EVENTS.ROOM_FULL, { message: 'Room is full' });
            return;
          }

          room = roomManager.addPlayer(roomId, user);
        }

        // Join socket room
        socket.join(room.id);

        // Send room joined confirmation
        socket.emit(EVENTS.ROOM_JOINED, {
          roomId: room.id,
          players: room.players,
          teams: room.teams,
          status: room.status,
          countdown: room.countdown,
        });

        // Broadcast to all in room
        io.to(room.id).emit(EVENTS.LOBBY_UPDATE, {
          players: room.players,
          teams: room.teams,
          countdown: room.countdown,
        });

        console.log(`✅ ${user.name} joined room ${room.id}`);

      } catch (error) {
        console.error('❌ Join lobby error:', error);
        socket.emit(EVENTS.ERROR, { message: error.message });
      }
    });

    /**
     * LEAVE LOBBY: Leave current room
     */
    socket.on(EVENTS.LEAVE_LOBBY, (data) => {
      try {
        const user = connectedUsers.get(socket.id);
        if (!user) return;

        const { roomId } = data;
        const room = roomManager.removePlayer(roomId, user.id);

        socket.leave(roomId);

        if (room) {
          // Update remaining players
          io.to(roomId).emit(EVENTS.LOBBY_UPDATE, {
            players: room.players,
            teams: room.teams,
          });
        }

        console.log(`❌ ${user.name} left room ${roomId}`);

      } catch (error) {
        console.error('❌ Leave lobby error:', error);
      }
    });

    /**
     * START GAME: Begin the match (from countdown)
     */
    socket.on(EVENTS.GAME_START, async (data) => {
      try {
        const { roomId } = data;
        const room = roomManager.getRoom(roomId);

        if (!room) return;

        // Start game
        roomManager.startGame(roomId);

        // Perform toss
        const toss = roomManager.performToss(roomId);

        // Emit game start
        io.to(roomId).emit(EVENTS.GAME_START, {
          message: 'Game starting!',
          toss,
        });

        // Wait 3 seconds then start first ball
        setTimeout(() => {
          room.status = ROOM_STATUS.PLAYING;
          
          // Start first innings
          room.gameEngine.startInnings(1);

          // Emit game state
          io.to(roomId).emit(EVENTS.GAME_STATE, {
            status: ROOM_STATUS.PLAYING,
            ...room.gameEngine.getState(),
          });

          // Request first players
          io.to(roomId).emit(EVENTS.YOUR_TURN, {
            message: 'Select batter and bowler',
          });

        }, 3000);

      } catch (error) {
        console.error('❌ Start game error:', error);
      }
    });

    /**
     * PLAYER CHOICE: Submit finger choice
     */
    socket.on(EVENTS.CHOICE_MADE, async (data) => {
      try {
        const user = connectedUsers.get(socket.id);
        if (!user) return;

        const { roomId, choice, role } = data;
        const room = roomManager.getRoom(roomId);

        if (!room || room.status !== ROOM_STATUS.PLAYING) return;

        // Submit choice to game engine
        const bothSubmitted = room.gameEngine.submitChoice(role, choice);

        if (bothSubmitted) {
          // Process the ball
          const result = room.gameEngine.processBall();

          // Emit result
          io.to(roomId).emit(EVENTS.ROUND_RESULT, result);

          // Wait 3 seconds then check if innings complete
          setTimeout(() => {
            const state = room.gameEngine.getState();

            if (state.isComplete) {
              handleInningsComplete(io, roomId, room);
            } else {
              // Next ball
              io.to(roomId).emit(EVENTS.GAME_STATE, state);
            }
          }, 3000);
        }

      } catch (error) {
        console.error('❌ Player choice error:', error);
        socket.emit(EVENTS.ERROR, { message: error.message });
      }
    });

    /**
     * CHAT MESSAGE: Send message in room
     */
    socket.on(EVENTS.CHAT_MESSAGE, (data) => {
      try {
        const user = connectedUsers.get(socket.id);
        if (!user) return;

        const { roomId, message } = data;

        io.to(roomId).emit(EVENTS.CHAT_MESSAGE, {
          sender: {
            id: user.id,
            name: user.name,
            avatar: user.avatar,
          },
          message,
          timestamp: new Date(),
        });

      } catch (error) {
        console.error('❌ Chat error:', error);
      }
    });

    /**
     * DISCONNECT: Handle disconnection
     */
    socket.on('disconnect', () => {
      const user = connectedUsers.get(socket.id);
      
      if (user) {
        console.log(`🔌 Socket disconnected: ${user.name}`);

        // Give grace period to reconnect
        setTimeout(() => {
          // TODO: Remove player from room if still disconnected
        }, PLAYER.DISCONNECT_GRACE);

        connectedUsers.delete(socket.id);
      }
    });
  });

  /**
   * Handle innings complete
   */
  async function handleInningsComplete(io, roomId, room) {
    const engine = room.gameEngine;
    const state = engine.getState();

    if (state.innings === 1) {
      // First innings complete, start second
      const firstInningsRuns = state.runs;
      
      // Save first innings data
      room.innings.push({
        team: room.toss.decision === 'bat' ? room.toss.winner : (room.toss.winner === 'A' ? 'B' : 'A'),
        runs: firstInningsRuns,
        wickets: state.wickets,
        balls: state.balls,
      });

      // Set target
      engine.setTarget(firstInningsRuns);

      // Emit innings change
      io.to(roomId).emit(EVENTS.INNINGS_CHANGE, {
        message: `First innings complete!`,
        target: firstInningsRuns + 1,
      });

      // Wait 5 seconds then start second innings
      setTimeout(() => {
        engine.startInnings(2);
        
        io.to(roomId).emit(EVENTS.GAME_STATE, engine.getState());
      }, 5000);

    } else {
      // Second innings complete, game over
      const secondInningsRuns = state.runs;

      // Save second innings
      room.innings.push({
        team: room.innings[0].team === 'A' ? 'B' : 'A',
        runs: secondInningsRuns,
        wickets: state.wickets,
        balls: state.balls,
      });

      // Calculate result
      const result = GameEngine.calculateMatchResult(
        room.innings[0].runs,
        room.innings[1].runs,
        room.innings[1].wickets,
        room.innings[0].team
      );

      // Save game to database
      await saveGameToDatabase(room, result);

      // Update player stats
      await updatePlayerStats(room, result);

      // Emit game over
      io.to(roomId).emit(EVENTS.GAME_OVER, {
        result,
        innings: room.innings,
      });

      // Clean up room after 30 seconds
      setTimeout(() => {
        roomManager.deleteRoom(roomId);
      }, 30000);
    }
  }

  /**
   * Save game to database
   */
  async function saveGameToDatabase(room, result) {
    try {
      const game = await Game.create({
        roomId: room.id,
        mode: room.mode,
        players: room.players.map(p => ({
          userId: p.isBot ? null : p.id,
          name: p.name,
          avatar: p.avatar,
          team: p.team,
          isBot: p.isBot || false,
        })),
        overs: room.overs,
        toss: room.toss,
        innings: room.innings,
        ballByBall: room.gameEngine.ballHistory,
        winner: result.winner,
        result: result.result,
        status: 'completed',
        startedAt: room.startedAt,
      });

      game.completeMatch();
      await game.save();

      console.log(`💾 Game saved: ${room.id}`);

    } catch (error) {
      console.error('❌ Save game error:', error);
    }
  }

  /**
   * Update player statistics
   */
  async function updatePlayerStats(room, result) {
    try {
      for (const player of room.players) {
        if (player.isBot) continue;

        const won = player.team === result.winner;
        
        // Find player's batting stats
        const batting = room.innings.find(i => i.team === player.team);
        const runs = batting ? batting.runs : 0;
        const wickets = 0;  // TODO: Calculate individual wickets

        const user = await User.findById(player.id);
        if (user) {
          await user.recordGame(won, runs, wickets);
        }
      }

      console.log(`✅ Player stats updated`);

    } catch (error) {
      console.error('❌ Update stats error:', error);
    }
  }

  // Periodic cleanup
  setInterval(() => {
    roomManager.cleanupOldRooms();
  }, 10 * 60 * 1000);  // Every 10 minutes
}

module.exports = { initializeSocketHandlers };
