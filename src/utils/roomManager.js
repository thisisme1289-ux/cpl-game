// ============================================
// ROOM MANAGER - Multiplayer Room Management
// ============================================

const { LOBBY, ROOM_STATUS, MODES, TEAMS } = require('../config/game');
const GameEngine = require('./gameEngine');
const { generateRoomCode } = require('./helpers');

/**
 * Room Manager
 * 
 * Manages:
 * - Room creation and deletion
 * - Player joining/leaving
 * - Team assignment
 * - Room state
 */

class RoomManager {
  constructor() {
    // Store all active rooms
    // roomId => Room object
    this.rooms = new Map();
    
    // Random matchmaking queue
    this.randomQueue = [];
  }

  /**
   * Create a new room
   * 
   * @param {String} mode - Game mode (random, create, join, bot)
   * @param {Object} creator - User who created the room
   * @param {Object} options - Room options (overs, maxPlayers, etc.)
   * @returns {Object} Created room
   */
  createRoom(mode, creator, options = {}) {
    const roomId = mode === MODES.RANDOM ? 'random' : generateRoomCode();
    
    const room = {
      id: roomId,
      mode,
      status: ROOM_STATUS.WAITING,
      
      // Players
      players: [],
      maxPlayers: options.maxPlayers || LOBBY.MAX_PLAYERS,
      
      // Teams
      teams: {
        A: [],
        B: [],
      },
      
      // Creator
      creator: creator.id,
      
      // Game settings
      overs: options.overs || 5,
      
      // Countdown
      countdown: null,
      countdownInterval: null,
      
      // Game engine
      gameEngine: null,
      
      // Toss
      toss: null,
      
      // Timestamps
      createdAt: new Date(),
      startedAt: null,
      
      // Current playing
      currentBatter: null,
      currentBowler: null,
      
      // Innings data
      innings: [],
    };

    this.rooms.set(roomId, room);
    console.log(`✅ Room created: ${roomId} (${mode})`);
    
    return room;
  }

  /**
   * Get room by ID
   */
  getRoom(roomId) {
    return this.rooms.get(roomId);
  }

  /**
   * Add player to room
   * 
   * @param {String} roomId - Room ID
   * @param {Object} player - Player object
   * @returns {Object} Updated room
   */
  addPlayer(roomId, player) {
    const room = this.getRoom(roomId);
    
    if (!room) {
      throw new Error('Room not found');
    }

    if (room.players.length >= room.maxPlayers) {
      throw new Error('Room is full');
    }

    // Check if player already in room
    if (room.players.find(p => p.id === player.id)) {
      throw new Error('Player already in room');
    }

    // Add to players list
    room.players.push(player);

    // Auto-assign to team with fewer players
    const teamA = room.teams.A.length;
    const teamB = room.teams.B.length;
    
    const assignedTeam = teamA <= teamB ? 'A' : 'B';
    room.teams[assignedTeam].push(player.id);
    player.team = assignedTeam;

    console.log(`✅ Player ${player.name} joined room ${roomId} - Team ${assignedTeam}`);

    // Start countdown if minimum players reached
    if (room.players.length >= LOBBY.MIN_PLAYERS && !room.countdownInterval) {
      this.startCountdown(roomId);
    }

    return room;
  }

  /**
   * Remove player from room
   * 
   * @param {String} roomId - Room ID
   * @param {String} playerId - Player ID
   * @returns {Object} Updated room or null if room deleted
   */
  removePlayer(roomId, playerId) {
    const room = this.getRoom(roomId);
    
    if (!room) return null;

    // Remove from players
    room.players = room.players.filter(p => p.id !== playerId);

    // Remove from team
    const playerTeam = Object.keys(room.teams).find(team => 
      room.teams[team].includes(playerId)
    );
    
    if (playerTeam) {
      room.teams[playerTeam] = room.teams[playerTeam].filter(id => id !== playerId);
    }

    console.log(`❌ Player left room ${roomId}`);

    // Delete room if empty
    if (room.players.length === 0) {
      this.deleteRoom(roomId);
      return null;
    }

    // Stop countdown if below minimum players
    if (room.players.length < LOBBY.MIN_PLAYERS && room.countdownInterval) {
      this.stopCountdown(roomId);
    }

    return room;
  }

  /**
   * Start lobby countdown
   */
  startCountdown(roomId) {
    const room = this.getRoom(roomId);
    if (!room) return;

    room.countdown = LOBBY.TIMEOUT;
    
    console.log(`⏱️  Countdown started for room ${roomId}`);

    room.countdownInterval = setInterval(() => {
      room.countdown--;

      if (room.countdown <= 0) {
        this.stopCountdown(roomId);
        this.startGame(roomId);
      }
    }, 1000);
  }

  /**
   * Stop lobby countdown
   */
  stopCountdown(roomId) {
    const room = this.getRoom(roomId);
    if (!room) return;

    if (room.countdownInterval) {
      clearInterval(room.countdownInterval);
      room.countdownInterval = null;
      room.countdown = null;
      console.log(`⏱️  Countdown stopped for room ${roomId}`);
    }
  }

  /**
   * Start the game
   */
  startGame(roomId) {
    const room = this.getRoom(roomId);
    if (!room) return;

    // Balance teams if odd number of players
    this.balanceTeams(roomId);

    // Change status
    room.status = ROOM_STATUS.TOSS;
    room.startedAt = new Date();

    // Initialize game engine
    room.gameEngine = new GameEngine(roomId, room.overs);

    console.log(`🎮 Game starting in room ${roomId}`);

    return room;
  }

  /**
   * Balance teams (add bot if needed)
   */
  balanceTeams(roomId) {
    const room = this.getRoom(roomId);
    if (!room) return;

    const totalPlayers = room.players.length;

    // If odd, add a bot to the smaller team
    if (totalPlayers % 2 !== 0) {
      const teamA = room.teams.A.length;
      const teamB = room.teams.B.length;
      
      const botTeam = teamA < teamB ? 'A' : 'B';
      
      const bot = {
        id: `bot-${Date.now()}`,
        name: this.generateBotName(),
        avatar: '',
        isBot: true,
        team: botTeam,
      };

      room.players.push(bot);
      room.teams[botTeam].push(bot.id);

      console.log(`🤖 Bot added to Team ${botTeam}`);
    }
  }

  /**
   * Generate random bot name
   */
  generateBotName() {
    const { NAMES } = require('../config/game').BOT;
    return NAMES[Math.floor(Math.random() * NAMES.length)];
  }

  /**
   * Perform toss
   */
  performToss(roomId) {
    const room = this.getRoom(roomId);
    if (!room) return null;

    // Random team wins toss
    const winner = Math.random() < 0.5 ? 'A' : 'B';
    
    // Random decision
    const decision = Math.random() < 0.5 ? 'bat' : 'bowl';

    room.toss = { winner, decision };
    
    console.log(`🪙 Toss: Team ${winner} won and chose to ${decision}`);

    return room.toss;
  }

  /**
   * Delete room
   */
  deleteRoom(roomId) {
    const room = this.getRoom(roomId);
    
    if (room && room.countdownInterval) {
      clearInterval(room.countdownInterval);
    }

    this.rooms.delete(roomId);
    console.log(`🗑️  Room deleted: ${roomId}`);
  }

  /**
   * Get all active rooms
   */
  getAllRooms() {
    return Array.from(this.rooms.values());
  }

  /**
   * Get rooms by mode
   */
  getRoomsByMode(mode) {
    return this.getAllRooms().filter(room => room.mode === mode);
  }

  /**
   * Clean up old rooms
   */
  cleanupOldRooms() {
    const now = Date.now();
    let cleaned = 0;

    for (const [roomId, room] of this.rooms.entries()) {
      const age = now - room.createdAt.getTime();

      // Delete old waiting rooms
      if (room.status === ROOM_STATUS.WAITING && age > LOBBY.WAITING_ROOM_EXPIRY) {
        this.deleteRoom(roomId);
        cleaned++;
      }

      // Delete old active rooms
      if (room.status === ROOM_STATUS.PLAYING && age > LOBBY.ACTIVE_ROOM_EXPIRY) {
        this.deleteRoom(roomId);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(`🧹 Cleaned up ${cleaned} old rooms`);
    }
  }
}

// Export singleton instance
module.exports = new RoomManager();
