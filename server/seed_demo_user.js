/**
 * Simple script to seed a demo user into MongoDB for testing leaderboard/profile.
 * Usage:
 *   node server/seed_demo_user.js "<MONGODB_URI>" "Display Name" [email]
 * Example:
 *   node server/seed_demo_user.js "mongodb://.../sample_mflix?ssl=true&authSource=admin" "Demo Player" demo@example.com
 */

const mongoose = require('mongoose');
const User = require('./models/user');

async function main() {
  const argv = process.argv.slice(2);
  const uri = argv[0] || process.env.MONGODB_URI;
  const displayName = argv[1] || 'Demo Player';
  const email = argv[2] || null;

  if (!uri) {
    console.error('Usage: node server/seed_demo_user.js "<MONGODB_URI>" "Display Name" [email]');
    process.exit(1);
  }

  try {
    await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });
    console.log('Connected to MongoDB');

    const googleId = `seed-demo-${Date.now()}`;

    const user = await User.findOneAndUpdate(
      { displayName },
      {
        $set: {
          googleId,
          displayName,
          email,
          photoURL: null,
          updatedAt: new Date()
        },
        $setOnInsert: { createdAt: new Date() }
      },
      { upsert: true, new: true }
    );

    // Seed some demo stats
    user.stats = user.stats || {};
    user.stats.matchesPlayed = user.stats.matchesPlayed || 5;
    user.stats.matchesWon = user.stats.matchesWon || 3;
    user.stats.totalRuns = user.stats.totalRuns || 45;
    user.stats.totalWickets = user.stats.totalWickets || 2;
    user.stats.highestScore = Math.max(user.stats.highestScore || 0, 20);
    await user.save();

    console.log('Seeded user:', { id: user._id.toString(), displayName: user.displayName });
    console.log('You can now call /api/profile/:userId or /api/leaderboard to verify.');
  } catch (err) {
    console.error('Error seeding demo user:', err);
  } finally {
    mongoose.disconnect();
  }
}

main();
