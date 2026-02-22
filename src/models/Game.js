// ============================================
// GAME MODEL - Match History Storage
// ============================================

const mongoose = require('mongoose');

/**
 * Game Schema
 * 
 * Stores complete match history including:
 * - Players and teams
 * - Final scores
 * - Ball-by-ball data
 * - Match result
 */

const gameSchema = new mongoose.Schema({
  // === ROOM INFO ===
  roomId: {
    type: String,
    required: true,
    index: true,
  },

  mode: {
    type: String,
    enum: ['random', 'create', 'join', 'bot'],
    required: true,
  },

  // === PLAYERS ===
  players: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    name: String,
    avatar: String,
    team: {
      type: String,
      enum: ['A', 'B'],
    },
    isBot: {
      type: Boolean,
      default: false,
    },
  }],

  // === MATCH DETAILS ===
  overs: {
    type: Number,
    required: true,
  },

  toss: {
    winner: String,  // Team A or B
    decision: {
      type: String,
      enum: ['bat', 'bowl'],
    },
  },

  // === INNINGS DATA ===
  innings: [{
    team: String,
    runs: Number,
    wickets: Number,
    balls: Number,
    batting: [{
      playerId: mongoose.Schema.Types.ObjectId,
      runs: Number,
      balls: Number,
      wickets: Number,
    }],
  }],

  // === BALL-BY-BALL DATA ===
  // Stores every ball of the match
  ballByBall: [{
    over: Number,
    ball: Number,
    batter: {
      id: mongoose.Schema.Types.ObjectId,
      choice: Number,
    },
    bowler: {
      id: mongoose.Schema.Types.ObjectId,
      choice: Number,
    },
    result: {
      type: String,
      enum: ['runs', 'wicket'],
    },
    runs: Number,
    timestamp: {
      type: Date,
      default: Date.now,
    },
  }],

  // === RESULT ===
  winner: {
    type: String,
    enum: ['A', 'B', 'tie', 'abandoned'],
  },

  result: {
    type: String,  // "Team A won by 15 runs"
  },

  // === MATCH INFO ===
  status: {
    type: String,
    enum: ['in_progress', 'completed', 'abandoned'],
    default: 'in_progress',
  },

  startedAt: {
    type: Date,
    default: Date.now,
  },

  completedAt: Date,

  duration: Number,  // in seconds

}, {
  timestamps: true,
  collection: 'games',
});

// ===== INDEXES =====
gameSchema.index({ 'players.userId': 1, startedAt: -1 });  // For user game history
gameSchema.index({ status: 1, startedAt: -1 });            // For active games

// ===== INSTANCE METHODS =====

/**
 * Add a ball to the match
 */
gameSchema.methods.addBall = function(ballData) {
  this.ballByBall.push(ballData);
};

/**
 * Complete the match and calculate result
 */
gameSchema.methods.completeMatch = function() {
  this.status = 'completed';
  this.completedAt = new Date();
  
  // Calculate duration
  if (this.startedAt) {
    this.duration = Math.floor((this.completedAt - this.startedAt) / 1000);
  }

  // Determine winner and result text
  if (this.innings.length === 2) {
    const [first, second] = this.innings;
    
    if (second.runs > first.runs) {
      this.winner = second.team;
      const margin = second.runs - first.runs;
      this.result = `Team ${second.team} won by ${margin} run${margin > 1 ? 's' : ''}`;
    } else if (first.runs > second.runs) {
      this.winner = first.team;
      const wickets = 10 - second.wickets;
      this.result = `Team ${first.team} won by ${wickets} wicket${wickets > 1 ? 's' : ''}`;
    } else {
      this.winner = 'tie';
      this.result = 'Match tied';
    }
  }
};

/**
 * Mark match as abandoned
 */
gameSchema.methods.abandonMatch = function() {
  this.status = 'abandoned';
  this.winner = 'abandoned';
  this.result = 'Match abandoned';
  this.completedAt = new Date();
};

// ===== STATIC METHODS =====

/**
 * Get recent games for a user
 */
gameSchema.statics.getUserHistory = async function(userId, limit = 10) {
  return await this.find({
    'players.userId': userId,
    status: 'completed',
  })
    .select('roomId mode winner result innings startedAt')
    .sort({ startedAt: -1 })
    .limit(limit)
    .lean();
};

/**
 * Get active games count
 */
gameSchema.statics.getActiveGamesCount = async function() {
  return await this.countDocuments({ status: 'in_progress' });
};

/**
 * Cleanup old completed games (older than 30 days)
 */
gameSchema.statics.cleanupOldGames = async function() {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  
  const result = await this.deleteMany({
    status: { $in: ['completed', 'abandoned'] },
    completedAt: { $lt: thirtyDaysAgo },
  });

  console.log(`🗑️  Cleaned up ${result.deletedCount} old games`);
  return result.deletedCount;
};

// ===== CREATE MODEL =====
const Game = mongoose.model('Game', gameSchema);

module.exports = Game;
