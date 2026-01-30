const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;

// Configure Google Strategy
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(new GoogleStrategy({
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.CALLBACK_URL || '/auth/google/callback'
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        // Create user object from Google profile
        const user = {
          googleId: profile.id,
          email: profile.emails[0].value,
          displayName: profile.displayName,
          photoURL: profile.photos[0]?.value || null,
          createdAt: new Date()
        };
        
        return done(null, user);
      } catch (err) {
        return done(err, null);
      }
    }
  ));

  // Serialize user
  passport.serializeUser((user, done) => {
    done(null, user);
  });

  // Deserialize user
  passport.deserializeUser((user, done) => {
    done(null, user);
  });
}

module.exports = passport;
