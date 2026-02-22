// ============================================
// AUTHENTICATION ROUTES
// ============================================

const express = require('express');
const authService = require('../services/authService');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

/**
 * POST /api/auth/google
 * 
 * Authenticate user with Google ID token
 * 
 * Body: { idToken: "google_id_token_here" }
 * Returns: { success, user, token }
 */
router.post('/google', async (req, res) => {
  try {
    const { idToken } = req.body;

    if (!idToken) {
      return res.status(400).json({
        success: false,
        message: 'ID token is required',
      });
    }

    // Authenticate user
    const result = await authService.authenticateUser(idToken);

    console.log(`✅ User authenticated: ${result.user.email}`);

    res.json({
      success: true,
      message: 'Authentication successful',
      user: result.user,
      token: result.token,
    });

  } catch (error) {
    console.error('❌ Google auth error:', error.message);

    res.status(401).json({
      success: false,
      message: 'Authentication failed',
      error: error.message,
    });
  }
});

/**
 * GET /api/auth/verify
 * 
 * Verify if JWT token is valid
 * 
 * Headers: Authorization: Bearer <token>
 * Returns: { success, user }
 */
router.get('/verify', verifyToken, async (req, res) => {
  try {
    // Get fresh user stats
    const stats = await authService.refreshUserStats(req.user._id);

    res.json({
      success: true,
      message: 'Token is valid',
      user: stats,
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to verify token',
      error: error.message,
    });
  }
});

/**
 * POST /api/auth/refresh
 * 
 * Refresh user stats (without re-authentication)
 * 
 * Headers: Authorization: Bearer <token>
 * Returns: { success, stats }
 */
router.post('/refresh', verifyToken, async (req, res) => {
  try {
    const stats = await authService.refreshUserStats(req.user._id);

    res.json({
      success: true,
      stats,
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to refresh stats',
      error: error.message,
    });
  }
});

module.exports = router;
