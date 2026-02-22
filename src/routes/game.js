// ============================================
// GAME API ROUTES
// ============================================

const express = require('express');
const { verifyToken } = require('../middleware/auth');
const User = require('../models/User');
const Game = require('../models/Game');

const router = express.Router();

// All game routes require authentication
router.use(verifyToken);

/**
 * GET /api/game/stats
 * 
 * Get current user's stats
 */
router.get('/stats', async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select('name avatar stats points xp level')
      .lean();

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Get rank
    const usersAhead = await User.countDocuments({
      'stats.gamesPlayed': { $gt: 0 },
      points: { $gt: user.points },
    });

    res.json({
      success: true,
      stats: {
        ...user,
        rank: usersAhead + 1,
        winRate: user.stats.gamesPlayed > 0 
          ? ((user.stats.gamesWon / user.stats.gamesPlayed) * 100).toFixed(2)
          : 0,
      },
    });

  } catch (error) {
    console.error('❌ Get stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch stats',
    });
  }
});

/**
 * GET /api/game/leaderboard
 * 
 * Get top 10 leaderboard
 */
router.get('/leaderboard', async (req, res) => {
  try {
    const leaderboard = await User.getLeaderboard(10);

    // Add rank to each player
    const top10 = leaderboard.map((player, index) => ({
      rank: index + 1,
      ...player,
      winRate: player.stats.gamesPlayed > 0
        ? ((player.stats.gamesWon / player.stats.gamesPlayed) * 100).toFixed(2)
        : 0,
    }));

    // Get current user's rank if they have played
    let currentUser = null;
    const user = await User.findById(req.user._id).lean();
    
    if (user && user.stats.gamesPlayed > 0) {
      const usersAhead = await User.countDocuments({
        'stats.gamesPlayed': { $gt: 0 },
        points: { $gt: user.points },
      });

      currentUser = {
        rank: usersAhead + 1,
        name: user.name,
        avatar: user.avatar,
        points: user.points,
        stats: user.stats,
        winRate: ((user.stats.gamesWon / user.stats.gamesPlayed) * 100).toFixed(2),
      };
    }

    // Get total active players
    const totalPlayers = await User.countDocuments({
      'stats.gamesPlayed': { $gt: 0 },
    });

    res.json({
      success: true,
      leaderboard: top10,
      currentUser,
      totalPlayers,
    });

  } catch (error) {
    console.error('❌ Leaderboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch leaderboard',
    });
  }
});

/**
 * GET /api/game/history
 * 
 * Get user's recent game history
 */
router.get('/history', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;

    const history = await Game.getUserHistory(req.user._id, limit);

    res.json({
      success: true,
      history,
    });

  } catch (error) {
    console.error('❌ History error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch history',
    });
  }
});

/**
 * POST /api/game/complete
 * 
 * Record a completed game
 * 
 * Body: {
 *   won: true/false,
 *   runs: 45,
 *   wickets: 3,
 *   gameId: "game_id_here" (optional)
 * }
 */
router.post('/complete', async (req, res) => {
  try {
    const { won, runs = 0, wickets = 0, gameId } = req.body;

    if (typeof won !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'Invalid game result',
      });
    }

    // Get user
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Record game
    await user.recordGame(won, runs, wickets);

    // Add to history if gameId provided
    if (gameId) {
      user.addGameToHistory(gameId);
      await user.save();
    }

    console.log(`✅ Game recorded for ${user.name}: ${won ? 'WON' : 'LOST'}`);

    res.json({
      success: true,
      message: 'Game recorded successfully',
      stats: {
        gamesPlayed: user.stats.gamesPlayed,
        gamesWon: user.stats.gamesWon,
        gamesLost: user.stats.gamesLost,
        totalRuns: user.stats.totalRuns,
        totalWickets: user.stats.totalWickets,
        points: user.points,
        xp: user.xp,
        level: user.level,
      },
    });

  } catch (error) {
    console.error('❌ Complete game error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to record game',
    });
  }
});

/**
 * GET /api/game/active
 * 
 * Get count of active games
 */
router.get('/active', async (req, res) => {
  try {
    const count = await Game.getActiveGamesCount();

    res.json({
      success: true,
      activeGames: count,
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch active games',
    });
  }
});

module.exports = router;
