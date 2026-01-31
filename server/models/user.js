const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  googleId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  displayName: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: false
  },
  photoURL: {
    type: String,
    required: false
  },
  stats: {
    matchesPlayed: { type: Number, default: 0 },
    matchesWon: { type: Number, default: 0 },
    totalRuns: { type: Number, default: 0 },
    totalWickets: { type: Number, default: 0 },
    highestScore: { type: Number, default: 0 },
    winRate: { type: Number, default: 0 },
    rank: { type: Number, default: 0 }
  },
  settings: {
    avatar: { type: String, default: '🏏' },
    theme: { type: String, default: 'dark' },
    soundEnabled: { type: Boolean, default: true },
    notifications: { type: Boolean, default: true }
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Index for leaderboard queries
userSchema.index({ 'stats.rank': -1 });
userSchema.index({ 'stats.matchesWon': -1 });

// Update timestamp on save
userSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Calculate win rate
userSchema.pre('save', function(next) {
  if (this.stats.matchesPlayed > 0) {
    this.stats.winRate = Math.round((this.stats.matchesWon / this.stats.matchesPlayed) * 100);
  }
  next();
});

const User = mongoose.model('User', userSchema);

module.exports = User;
