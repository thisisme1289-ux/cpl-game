// ============================================
// GOOGLE AUTH SERVICE
// ============================================

const { OAuth2Client } = require('google-auth-library');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

/**
 * Google Authentication Service
 * 
 * Handles:
 * - Google ID token verification
 * - JWT generation for sessions
 * - Token validation
 */

class AuthService {
  /**
   * Verify Google ID token
   * 
   * @param {String} idToken - Google ID token from frontend
   * @returns {Object} User profile data
   */
  async verifyGoogleToken(idToken) {
    try {
      const ticket = await client.verifyIdToken({
        idToken,
        audience: process.env.GOOGLE_CLIENT_ID,
      });

      const payload = ticket.getPayload();
      
      // Extract user info
      return {
        id: payload.sub,            // Google User ID
        email: payload.email,
        name: payload.name,
        picture: payload.picture,
        emailVerified: payload.email_verified,
      };
      
    } catch (error) {
      console.error('❌ Google token verification failed:', error.message);
      throw new Error('Invalid Google token');
    }
  }

  /**
   * Authenticate user and create JWT
   * 
   * Steps:
   * 1. Verify Google token
   * 2. Find or create user in database
   * 3. Generate JWT for session
   * 
   * @param {String} idToken - Google ID token
   * @returns {Object} { user, token }
   */
  async authenticateUser(idToken) {
    try {
      // Step 1: Verify Google token
      const googleProfile = await this.verifyGoogleToken(idToken);
      
      // Step 2: Find or create user
      const user = await User.findOrCreate(googleProfile);
      
      // Step 3: Generate JWT
      const token = this.generateJWT(user);
      
      return {
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
          avatar: user.avatar,
          stats: user.stats,
          points: user.points,
          xp: user.xp,
          level: user.level,
        },
        token,
      };
      
    } catch (error) {
      console.error('❌ Authentication failed:', error.message);
      throw error;
    }
  }

  /**
   * Generate JWT token for user
   * 
   * @param {Object} user - User document
   * @returns {String} JWT token
   */
  generateJWT(user) {
    const payload = {
      userId: user._id.toString(),
      email: user.email,
      name: user.name,
    };

    const options = {
      expiresIn: '7d',  // Token valid for 7 days
      issuer: 'cpl-game',
    };

    return jwt.sign(payload, process.env.JWT_SECRET, options);
  }

  /**
   * Verify JWT token
   * 
   * @param {String} token - JWT token
   * @returns {Object} Decoded payload
   */
  verifyJWT(token) {
    try {
      return jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
      throw new Error('Invalid or expired token');
    }
  }

  /**
   * Get user from JWT token
   * 
   * @param {String} token - JWT token
   * @returns {Object} User document
   */
  async getUserFromToken(token) {
    try {
      const decoded = this.verifyJWT(token);
      
      const user = await User.findById(decoded.userId)
        .select('-__v')
        .lean();

      if (!user) {
        throw new Error('User not found');
      }

      return user;
      
    } catch (error) {
      throw new Error('Invalid authentication token');
    }
  }

  /**
   * Refresh user stats (for socket connections)
   * 
   * @param {String} userId - User ID
   * @returns {Object} Updated user stats
   */
  async refreshUserStats(userId) {
    try {
      const user = await User.findById(userId)
        .select('name avatar stats points xp level')
        .lean();

      if (!user) {
        throw new Error('User not found');
      }

      // Get current rank
      const usersAhead = await User.countDocuments({
        'stats.gamesPlayed': { $gt: 0 },
        points: { $gt: user.points },
      });

      return {
        ...user,
        rank: usersAhead + 1,
      };
      
    } catch (error) {
      console.error('❌ Failed to refresh user stats:', error);
      throw error;
    }
  }
}

// Export singleton instance
module.exports = new AuthService();
