const express = require('express');
const router = express.Router();

// Try to require passport/auth helper, but be defensive — project may not have OAuth deps installed
let passport = null;
try {
  passport = require('./auth');
} catch (e) {
  // Passport or auth helper not available — we'll provide safe fallbacks below
  passport = null;
}

// Helper to safely redirect when OAuth isn't configured
function oauthNotConfigured(req, res) {
  return res.redirect('/login.html?error=oauth_not_configured');
}

// @route   GET /auth/google
// @desc    Initiate Google OAuth (if available)
router.get('/google', (req, res, next) => {
  if (!passport || !process.env.GOOGLE_CLIENT_ID) return oauthNotConfigured(req, res);
  return passport.authenticate('google', { scope: ['profile', 'email'] })(req, res, next);
});

// @route   GET /auth/google/callback
// @desc    Google OAuth callback (if available)
if (passport) {
  router.get('/google/callback',
    passport.authenticate('google', { failureRedirect: '/login.html?error=auth_failed' }),
    async (req, res) => {
      // Send user data to frontend and persist to DB (upsert)
      const userData = {
        googleId: req.user && (req.user.googleId || req.user.id),
        displayName: req.user && req.user.displayName,
        email: req.user && req.user.email,
        photoURL: req.user && req.user.photoURL
      };

      // Try to upsert into DB if model exists
      try {
        const User = require('./models/user');
        try {
          const user = await User.findOneAndUpdate(
            { googleId: userData.googleId },
            { 
              $set: { 
                displayName: userData.displayName, 
                email: userData.email, 
                photoURL: userData.photoURL, 
                updatedAt: new Date() 
              }, 
              $setOnInsert: { createdAt: new Date() } 
            },
            { 
              upsert: true, 
              new: true,
              maxTimeMS: 30000 // 30-second timeout
            }
          );

          req.session.user = { id: user._id.toString(), displayName: user.displayName, photoURL: user.photoURL };
          return res.redirect(`/?login=success&user=${encodeURIComponent(JSON.stringify(req.session.user))}`);
        } catch (err) {
          console.error('User upsert failed:', err);
          req.session.user = userData;
          return res.redirect(`/?login=success&user=${encodeURIComponent(JSON.stringify(userData))}`);
        }
      } catch (err) {
        // If models/db not available, fallback
        console.warn('MongoDB model not available, falling back to session-only user save');
        req.session.user = userData;
        return res.redirect(`/?login=success&user=${encodeURIComponent(JSON.stringify(userData))}`);
      }
    }
  );
} else {
  // Provide a harmless fallback route when passport isn't installed/available
  router.get('/google/callback', (req, res) => oauthNotConfigured(req, res));
}

// @route   GET /auth/logout
// @desc    Logout user
router.get('/logout', (req, res) => {
  // If passport provides req.logout, use it; otherwise clear session
  if (typeof req.logout === 'function') {
    req.logout((err) => {
      if (err) return res.status(500).json({ error: 'Logout failed' });
      req.session && req.session.destroy && req.session.destroy();
      return res.redirect('/login.html');
    });
  } else {
    req.session && req.session.destroy && req.session.destroy();
    return res.redirect('/login.html');
  }
});

// @route   GET /auth/current
// @desc    Get current user
router.get('/current', (req, res) => {
  if (req.isAuthenticated && req.isAuthenticated()) {
    res.json({ authenticated: true, user: req.user });
  } else if (req.session && req.session.user) {
    res.json({ authenticated: true, user: req.session.user });
  } else {
    res.json({ authenticated: false });
  }
});

module.exports = router;
