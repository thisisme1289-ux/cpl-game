// ============================================
// AUTHENTICATION MIDDLEWARE
// ============================================

const authService = require('../services/authService');

/**
 * Verify JWT token in request
 * 
 * Checks for token in:
 * 1. Authorization header (Bearer token)
 * 2. Query parameter (?token=xxx)
 * 3. Body parameter
 */
const verifyToken = async (req, res, next) => {
  try {
    // Extract token from different sources
    let token = null;

    // 1. Authorization header: "Bearer <token>"
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }

    // 2. Query parameter
    if (!token && req.query.token) {
      token = req.query.token;
    }

    // 3. Body parameter
    if (!token && req.body.token) {
      token = req.body.token;
    }

    // No token found
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'No authentication token provided',
      });
    }

    // Verify token and get user
    const user = await authService.getUserFromToken(token);

    // Attach user to request
    req.user = user;
    req.token = token;

    next();
    
  } catch (error) {
    console.error('❌ Token verification failed:', error.message);
    
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired token',
      error: error.message,
    });
  }
};

/**
 * Optional authentication
 * Doesn't fail if no token provided, just doesn't attach user
 */
const optionalAuth = async (req, res, next) => {
  try {
    // Try to get token
    let token = null;

    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }

    if (!token && req.query.token) {
      token = req.query.token;
    }

    // If token exists, verify it
    if (token) {
      const user = await authService.getUserFromToken(token);
      req.user = user;
      req.token = token;
    }

    next();
    
  } catch (error) {
    // If verification fails, just continue without user
    console.warn('⚠️  Optional auth failed:', error.message);
    next();
  }
};

/**
 * Check if user is authenticated
 */
const isAuthenticated = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required',
    });
  }
  next();
};

module.exports = {
  verifyToken,
  optionalAuth,
  isAuthenticated,
};
