// ============================================
// USER MODEL - MongoDB Schema
// ============================================

const mongoose = require('mongoose');
const { POINTS } = require('../config/game');

/**
 * User Schema
 * 
 * Stores:
 * - Google OAuth info
 * - Game statistics
 * - Leaderboard points
 * - XP and level
 */

const userSchema = new mongoose.Schema({
  // === GOOGLE OAUTH INFO ===
  googleId: {
    type: String,
    required: true,
    unique: true,
    index: true,  // For fast lookups
  },

  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    index: true,
  },

  name: {
    type: String,
    required: true,
    trim: true,
  },

  avatar: {
    type: String,
    default: '',
  },

  // === GAME STATISTICS ===
  stats: {
    // Games
    gamesPlayed: { type: Number, default: 0, min: 0 },
    gamesWon: { type: Number, default: 0, min: 0 },
    gamesLost: { type: Number, default: 0, min: 0 },

    // Runs
    totalRuns: { type: Number, default: 0, min: 0 },
    highestScore: { type: Number, default: 0, min: 0 },

    // Wickets
    totalWickets: { type: Number, default: 0, min: 0 },
    bestBowling: { type: Number, default: 0, min: 0 },

    // Averages (calculated virtuals)
  },

  // === LEADERBOARD POINTS ===
  // Calculated based on wins, runs, wickets
  points: {
    type: Number,
    default: 0,
    index: -1,  // Descending index for leaderboard
  },

  // === LEVEL SYSTEM ===
  xp: {
    type: Number,
    default: 0,
    min: 0,
  },

  level: {
    type: Number,
    default: 1,
    min: 1,
  },

  // === RECENT GAMES ===
  // Store last 10 game IDs for history
  recentGames: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Game',
  }],

  // === ACCOUNT INFO ===
  createdAt: {
    type: Date,
    default: Date.now,
  },

  lastLogin: {
    type: Date,
    default: Date.now,
  },

  lastActive: {
    type: Date,
    default: Date.now,
  },

}, {
  timestamps: true,  // Adds createdAt and updatedAt
  collection: 'users',
});

// ===== INDEXES FOR OPTIMIZATION =====
// Composite index for leaderboard queries
userSchema.index({ points: -1, 'stats.gamesPlayed': -1 });

// ===== VIRTUAL PROPERTIES =====
// These are calculated on-the-fly, not stored in DB

// Win rate percentage
userSchema.virtual('winRate').get(function() {
  if (this.stats.gamesPlayed === 0) return 0;
  return ((this.stats.gamesWon / this.stats.gamesPlayed) * 100).toFixed(2);
});

// Average runs per game
userSchema.virtual('avgRuns').get(function() {
  if (this.stats.gamesPlayed === 0) return 0;
  return (this.stats.totalRuns / this.stats.gamesPlayed).toFixed(2);
});

// Average wickets per game
userSchema.virtual('avgWickets').get(function() {
  if (this.stats.gamesPlayed === 0) return 0;
  return (this.stats.totalWickets / this.stats.gamesPlayed).toFixed(2);
});

// Current rank (needs to be calculated via query)
userSchema.virtual('rank').get(function() {
  return this._rank || 0;
});

userSchema.virtual('rank').set(function(value) {
  this._rank = value;
});

// ===== INSTANCE METHODS =====

/**
 * Record a game result and update stats
 * @param {Boolean} won - Did the player win?
 * @param {Number} runs - Runs scored
 * @param {Number} wickets - Wickets taken
 */
userSchema.methods.recordGame = async function(won, runs = 0, wickets = 0) {
  // Update game counts
  this.stats.gamesPlayed += 1;
  
  if (won) {
    this.stats.gamesWon += 1;
  } else {
    this.stats.gamesLost += 1;
  }

  // Update runs
  if (runs > 0) {
    this.stats.totalRuns += runs;
    if (runs > this.stats.highestScore) {
      this.stats.highestScore = runs;
    }
  }

  // Update wickets
  if (wickets > 0) {
    this.stats.totalWickets += wickets;
    if (wickets > this.stats.bestBowling) {
      this.stats.bestBowling = wickets;
    }
  }

  // Update last active
  this.lastActive = new Date();

  // Save (will trigger pre-save hook to recalculate points and XP)
  await this.save();

  return this;
};

/**
 * Get user's current rank
 */
userSchema.methods.getRank = async function() {
  const User = this.constructor;
  
  // Count users with higher points
  const usersAhead = await User.countDocuments({
    'stats.gamesPlayed': { $gt: 0 },
    points: { $gt: this.points },
  });

  return usersAhead + 1;
};

/**
 * Add game to recent history (keep last 10)
 */
userSchema.methods.addGameToHistory = function(gameId) {
  this.recentGames.unshift(gameId);
  
  // Keep only last 10
  if (this.recentGames.length > 10) {
    this.recentGames = this.recentGames.slice(0, 10);
  }
};

// ===== STATIC METHODS =====

/**
 * Get top N players for leaderboard
 */
userSchema.statics.getLeaderboard = async function(limit = 10) {
  return await this.find({
    'stats.gamesPlayed': { $gt: 0 },  // Only players who have played
  })
    .select('name avatar points stats xp level')
    .sort({ points: -1, 'stats.totalRuns': -1 })
    .limit(limit)
    .lean();
};

/**
 * Find or create user from Google profile
 */
userSchema.statics.findOrCreate = async function(googleProfile) {
  let user = await this.findOne({ googleId: googleProfile.id });

  if (!user) {
    // Create new user
    user = await this.create({
      googleId: googleProfile.id,
      email: googleProfile.email,
      name: googleProfile.name,
      avatar: googleProfile.picture || '',
      lastLogin: new Date(),
    });

    console.log(`🆕 New user created: ${user.email}`);
  } else {
    // Update existing user
    user.name = googleProfile.name;
    user.avatar = googleProfile.picture || user.avatar;
    user.lastLogin = new Date();
    await user.save();

    console.log(`✅ User logged in: ${user.email}`);
  }

  return user;
};

// ===== MIDDLEWARE HOOKS =====

/**
 * PRE-SAVE: Calculate points and level before saving
 */
userSchema.pre('save', function(next) {
  // Only recalculate if stats changed
  if (this.isModified('stats')) {
    // Calculate points
    const { gamesWon, gamesLost, totalRuns, totalWickets } = this.stats;
    
    this.points = 
      (gamesWon * POINTS.WIN) +
      (gamesLost * POINTS.LOSS) +
      (totalRuns * POINTS.RUN_MULTIPLIER) +
      (totalWickets * POINTS.WICKET_MULTIPLIER);

    // Calculate level from XP
    // Level up every 100 XP
    this.level = Math.floor(this.xp / 100) + 1;
  }

  next();
});

/**
 * POST-SAVE: Log achievements
 */
userSchema.post('save', function(doc) {
  // Log milestones
  if (doc.stats.gamesPlayed % 10 === 0 && doc.stats.gamesPlayed > 0) {
    console.log(`🎉 ${doc.name} played ${doc.stats.gamesPlayed} games!`);
  }

  if (doc.stats.gamesWon % 5 === 0 && doc.stats.gamesWon > 0) {
    console.log(`🏆 ${doc.name} won ${doc.stats.gamesWon} games!`);
  }

  if (doc.level > 1 && doc.isModified('level')) {
    console.log(`⭐ ${doc.name} reached Level ${doc.level}!`);
  }
});

// ===== JSON CONFIGURATION =====
userSchema.set('toJSON', {
  virtuals: true,
  transform: function(doc, ret) {
    delete ret.__v;
    delete ret._id;
    ret.id = doc._id;
    return ret;
  },
});

// ===== CREATE MODEL =====
const User = mongoose.model('User', userSchema);

module.exports = User;
