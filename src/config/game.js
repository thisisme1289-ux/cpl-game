// ============================================
// GAME CONFIGURATION & CONSTANTS
// ============================================

/**
 * All game-related constants and settings
 * Change these values to customize your game
 */

module.exports = {
  // === MATCH SETTINGS ===
  MATCH: {
    OVERS: parseInt(process.env.MATCH_OVERS) || 5,
    BALLS_PER_OVER: 6,
    MAX_WICKETS: 10,
    
    // Scoring
    MIN_FINGER: 1,
    MAX_FINGER: 5,
    
    // Timers (in seconds)
    CHOICE_TIMEOUT: 30,      // Time to make a finger choice
    RESULT_DISPLAY: 3,       // How long to show result
  },

  // === LOBBY SETTINGS ===
  LOBBY: {
    TIMEOUT: parseInt(process.env.LOBBY_TIMEOUT) || 60,  // Seconds before auto-start
    MIN_PLAYERS: 2,
    MAX_PLAYERS: parseInt(process.env.MAX_PLAYERS_PER_ROOM) || 12,
    
    // Room expiry
    WAITING_ROOM_EXPIRY: 30 * 60 * 1000,   // 30 minutes
    ACTIVE_ROOM_EXPIRY: 2 * 60 * 60 * 1000, // 2 hours
  },

  // === GAME MODES ===
  MODES: {
    RANDOM: 'random',      // Quick match with random players
    CREATE: 'create',      // Create custom room
    JOIN: 'join',          // Join existing room
    BOT: 'bot',           // Practice with AI
  },

  // === PLAYER SETTINGS ===
  PLAYER: {
    DISCONNECT_GRACE: 10 * 1000,  // 10 seconds to reconnect
    BOT_DELAY: 2000,              // Bot thinking time (ms)
    
    // Levels & XP
    XP_PER_RUN: 1,
    XP_PER_WICKET: 10,
    XP_PER_WIN: 50,
    XP_PER_LOSS: 10,
  },

  // === LEADERBOARD ===
  LEADERBOARD: {
    TOP_COUNT: 10,
    CACHE_DURATION: parseInt(process.env.LEADERBOARD_CACHE_MINUTES) || 5, // minutes
  },

  // === POINTS CALCULATION ===
  POINTS: {
    WIN: 50,
    LOSS: 10,
    RUN_MULTIPLIER: 0.1,       // 0.1 point per run
    WICKET_MULTIPLIER: 20,     // 20 points per wicket
  },

  // === SOCKET EVENTS ===
  EVENTS: {
    // Connection
    CONNECT: 'connect',
    DISCONNECT: 'disconnect',
    
    // Authentication
    AUTH_REQUEST: 'auth:request',
    AUTH_SUCCESS: 'auth:success',
    AUTH_FAILED: 'auth:failed',
    
    // Lobby
    JOIN_LOBBY: 'lobby:join',
    LEAVE_LOBBY: 'lobby:leave',
    LOBBY_UPDATE: 'lobby:update',
    LOBBY_TIMER: 'lobby:timer',
    
    // Room
    ROOM_CREATED: 'room:created',
    ROOM_JOINED: 'room:joined',
    ROOM_FULL: 'room:full',
    ROOM_NOT_FOUND: 'room:not_found',
    ROOM_LOCKED: 'room:locked',
    PLAYER_LEFT: 'player:left',
    TEAM_SWITCHED: 'team:switched',
    
    // Captain & Lineup
    CAPTAINS_SELECTED: 'captains:selected',
    CHOOSE_ACTION: 'choose:action',
    ACTION_CHOSEN: 'action:chosen',
    SELECT_LINEUP: 'lineup:select',
    LINEUP_SELECTED: 'lineup:selected',
    
    // Game
    GAME_START: 'game:start',
    GAME_STATE: 'game:state',
    TOSS: 'game:toss',
    YOUR_TURN: 'game:your_turn',
    CHOICE_MADE: 'game:choice_made',
    ROUND_RESULT: 'game:round_result',
    OVER_COMPLETE: 'game:over_complete',
    INNINGS_CHANGE: 'game:innings_change',
    GAME_OVER: 'game:over',
    
    // Chat
    CHAT_MESSAGE: 'chat:message',
    CHAT_HISTORY: 'chat:history',
    
    // Stats
    STATS_UPDATE: 'stats:update',
    
    // Errors
    ERROR: 'error',
  },

  // === ROOM STATUS ===
  ROOM_STATUS: {
    WAITING: 'waiting',           // Waiting for players
    READY: 'ready',               // Ready to start (countdown)
    CAPTAIN_SELECTION: 'captain_selection',  // Selecting captains
    TOSS: 'toss',                // Toss in progress
    CHOOSE_ACTION: 'choose_action',  // Captain chooses bat/bowl
    LINEUP_SELECTION: 'lineup_selection',  // Selecting batting/bowling lineup
    PLAYING: 'playing',           // Match in progress
    INNINGS_BREAK: 'innings_break',  // Between innings
    COMPLETED: 'completed',       // Match finished
  },

  // === TEAM NAMES ===
  TEAMS: {
    A: 'Team A',
    B: 'Team B',
  },

  // === BOT PERSONALITY ===
  BOT: {
    NAMES: [
      'Virat Bot',
      'Dhoni AI',
      'Rohit Bot',
      'Sachin AI',
      'Kohli Bot',
      'Bumrah AI',
      'ABD Bot',
    ],
    
    // Bot difficulty levels
    DIFFICULTY: {
      EASY: 'easy',
      MEDIUM: 'medium',
      HARD: 'hard',
    },
    
    // Bot strategy (probability distribution)
    STRATEGY: {
      EASY: [0.30, 0.25, 0.20, 0.15, 0.10],      // More 1s and 2s (easier to get out)
      MEDIUM: [0.20, 0.20, 0.20, 0.20, 0.20],    // Equal distribution
      HARD: [0.10, 0.15, 0.20, 0.25, 0.30],      // More 4s and 5s (aggressive)
    },
  },

  // === ERROR MESSAGES ===
  ERRORS: {
    INVALID_TOKEN: 'Invalid authentication token',
    ROOM_NOT_FOUND: 'Room not found',
    ROOM_FULL: 'Room is full',
    NOT_YOUR_TURN: 'It is not your turn',
    INVALID_CHOICE: 'Invalid finger choice',
    GAME_NOT_ACTIVE: 'Game is not active',
    ALREADY_IN_ROOM: 'You are already in a room',
  },
};
