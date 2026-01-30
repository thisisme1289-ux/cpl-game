// Keep-Alive System to prevent Render free tier from sleeping

const https = require('https');

class KeepAlive {
  constructor(url, intervalMinutes = 14) {
    this.url = url;
    this.interval = intervalMinutes * 60 * 1000; // Convert to milliseconds
    this.timer = null;
    this.lastPing = null;
    this.pingCount = 0;
  }

  // Start keep-alive pings
  start() {
    if (this.timer) {
      console.log('⏰ Keep-alive already running');
      return;
    }

    console.log(`⏰ Starting keep-alive: pinging every ${this.interval / 60000} minutes`);
    console.log(`🌐 URL: ${this.url}`);

    // Initial ping after 1 minute
    setTimeout(() => this.ping(), 60000);

    // Then ping every interval
    this.timer = setInterval(() => {
      this.ping();
    }, this.interval);
  }

  // Stop keep-alive pings
  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      console.log('⏰ Keep-alive stopped');
    }
  }

  // Ping the server
  ping() {
    this.pingCount++;
    const startTime = Date.now();

    https.get(this.url, (res) => {
      const duration = Date.now() - startTime;
      this.lastPing = new Date();

      console.log(`✅ Keep-alive ping #${this.pingCount} successful (${duration}ms)`);
      console.log(`   Status: ${res.statusCode}`);
      console.log(`   Next ping: ${new Date(Date.now() + this.interval).toLocaleTimeString()}`);
    }).on('error', (err) => {
      console.error(`❌ Keep-alive ping failed:`, err.message);
    });
  }

  // Get status
  getStatus() {
    return {
      running: !!this.timer,
      pingCount: this.pingCount,
      lastPing: this.lastPing,
      intervalMinutes: this.interval / 60000,
      nextPing: this.timer ? new Date(Date.now() + this.interval) : null
    };
  }
}

module.exports = KeepAlive;
