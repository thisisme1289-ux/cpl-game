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
   // Send user data to frontend and persist to DB (upsert)
    const userData = {
       googleId: req.user.googleId || req.user.id,
      displayName: req.user.displayName,
      email: req.user.email,
      photoURL: req.user.photoURL
    };

    // Upsert to MongoDB (if available)
    try {
      const User = require('./models/user');
      (async () => {
        const user = await User.findOneAndUpdate(
          { googleId: userData.googleId },
          { $set: { displayName: userData.displayName, email: userData.email, photoURL: userData.photoURL, updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } },
          { upsert: true, new: true }
        );

        // Store minimal user info in session
        req.session.user = { id: user._id.toString(), displayName: user.displayName, photoURL: user.photoURL };

        // Redirect to home with session user (frontend will store in localStorage)
        res.redirect(`/?login=success&user=${encodeURIComponent(JSON.stringify(req.session.user))}`);
      })().catch(err => {
        console.error('User upsert failed:', err);
        // Fallback to session-only behavior
        req.session.user = userData;
        res.redirect(`/?login=success&user=${encodeURIComponent(JSON.stringify(userData))}`);
      });
    } catch (err) {
      // If models/db not available, fallback
      console.warn('MongoDB not available, falling back to session-only user save');
      req.session.user = userData;
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
