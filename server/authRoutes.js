const express = require('express');
const router = express.Router();
const passport = require('./auth');

// @route   GET /auth/google
// @desc    Initiate Google OAuth
router.get('/google', (req, res, next) => {
  if (!process.env.GOOGLE_CLIENT_ID) {
    return res.redirect('/login.html?error=oauth_not_configured');
  }
  passport.authenticate('google', { 
    scope: ['profile', 'email'] 
  })(req, res, next);
});

// @route   GET /auth/google/callback
// @desc    Google OAuth callback
router.get('/google/callback',
  passport.authenticate('google', { failureRedirect: '/login.html?error=auth_failed' }),
  (req, res) => {
    // Send user data to frontend
    const userData = {
      id: req.user.googleId,
      displayName: req.user.displayName,
      email: req.user.email,
      photoURL: req.user.photoURL
    };
    
    // Store in session
    req.session.user = userData;
    
    // Redirect to home with user data
    res.redirect(`/?login=success&user=${encodeURIComponent(JSON.stringify(userData))}`);
  }
);

// @route   GET /auth/logout
// @desc    Logout user
router.get('/logout', (req, res) => {
  req.logout((err) => {
    if (err) return res.status(500).json({ error: 'Logout failed' });
    req.session.destroy();
    res.redirect('/login.html');
  });
});

// @route   GET /auth/current
// @desc    Get current user
router.get('/current', (req, res) => {
  if (req.isAuthenticated && req.isAuthenticated()) {
    res.json({
      authenticated: true,
      user: req.user
    });
  } else {
    res.json({ authenticated: false });
  }
});

module.exports = router;
