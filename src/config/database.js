// ============================================
// DATABASE CONNECTION CONFIGURATION
// ============================================

const mongoose = require('mongoose');

/**
 * Connect to MongoDB with retry logic
 * 
 * Why we need this:
 * - Stores user accounts and stats
 * - Stores game history
 * - Leaderboard data
 * 
 * Features:
 * - Automatic reconnection
 * - Connection pooling
 * - Event listeners for monitoring
 */

class Database {
  constructor() {
    this.isConnected = false;
    this.retryCount = 0;
    this.maxRetries = 5;
  }

  /**
   * Connect to MongoDB
   */
  async connect() {
    // If already connected, skip
    if (this.isConnected) {
      console.log('✅ Database already connected');
      return;
    }

    try {
      const options = {
        // Connection pooling - reuse connections for better performance
        maxPoolSize: 10,
        minPoolSize: 2,
        
        // Timeouts
        serverSelectionTimeoutMS: 5000,  // Wait 5s for server selection
        socketTimeoutMS: 45000,           // Close inactive sockets after 45s
        
        // Automatic index creation
        autoIndex: process.env.NODE_ENV === 'development',
      };

      // Attempt connection
      await mongoose.connect(process.env.MONGODB_URI, options);

      this.isConnected = true;
      this.retryCount = 0;

      console.log(`
╔════════════════════════════════════════╗
║  ✅ MongoDB Connected Successfully!    ║
╠════════════════════════════════════════╣
║  Host: ${mongoose.connection.host.padEnd(29)}║
║  Database: ${mongoose.connection.name.padEnd(25)}║
╚════════════════════════════════════════╝
      `);

      // Set up event listeners
      this.setupEventListeners();

    } catch (error) {
      console.error('❌ MongoDB Connection Error:', error.message);
      
      // Retry logic
      if (this.retryCount < this.maxRetries) {
        this.retryCount++;
        const delay = 5000 * this.retryCount; // Exponential backoff
        
        console.log(`⏳ Retrying connection in ${delay/1000}s... (Attempt ${this.retryCount}/${this.maxRetries})`);
        
        setTimeout(() => this.connect(), delay);
      } else {
        console.error('❌ Max retries reached. Exiting...');
        process.exit(1);
      }
    }
  }

  /**
   * Setup MongoDB event listeners
   */
  setupEventListeners() {
    // Connection lost
    mongoose.connection.on('disconnected', () => {
      console.log('⚠️  MongoDB disconnected. Attempting to reconnect...');
      this.isConnected = false;
    });

    // Reconnected successfully
    mongoose.connection.on('reconnected', () => {
      console.log('✅ MongoDB reconnected successfully!');
      this.isConnected = true;
    });

    // Connection error
    mongoose.connection.on('error', (err) => {
      console.error('❌ MongoDB error:', err.message);
    });

    // Graceful shutdown
    process.on('SIGINT', async () => {
      await this.disconnect();
      process.exit(0);
    });
  }

  /**
   * Disconnect from MongoDB
   */
  async disconnect() {
    if (!this.isConnected) return;

    try {
      await mongoose.connection.close();
      this.isConnected = false;
      console.log('✅ MongoDB connection closed gracefully');
    } catch (error) {
      console.error('❌ Error closing MongoDB connection:', error);
    }
  }

  /**
   * Get connection status
   */
  getStatus() {
    return {
      isConnected: this.isConnected,
      readyState: mongoose.connection.readyState,
      host: mongoose.connection.host,
      name: mongoose.connection.name,
    };
  }
}

// Export singleton instance
module.exports = new Database();
