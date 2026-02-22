// ============================================
// CPL - CLASS PREMIER LEAGUE
// Main Server File
// ============================================

require('dotenv').config();

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const path = require('path');
const rateLimit = require('express-rate-limit');

// Import configurations
const database = require('./src/config/database');
const { initializeSocketHandlers } = require('./src/socket/gameHandler');

// Import routes
const authRoutes = require('./src/routes/auth');
const gameRoutes = require('./src/routes/game');

// ===== INITIALIZE EXPRESS APP =====
const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;

// ===== SECURITY MIDDLEWARE =====
// Helmet adds various HTTP headers for security
app.use(helmet({
  contentSecurityPolicy: false,  // Disable for Socket.IO
  crossOriginEmbedderPolicy: false,
}));

// CORS - Allow frontend to access API
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true,
}));

// ===== PERFORMANCE MIDDLEWARE =====
// Compression - Compress responses
app.use(compression());

// Logging - HTTP request logger (only in development)
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// ===== BODY PARSING MIDDLEWARE =====
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ===== RATE LIMITING =====
// Limit repeated requests to API endpoints
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 100,  // Limit each IP to 100 requests per windowMs
  message: 'Too many requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply to all API routes
app.use('/api/', apiLimiter);

// ===== STATIC FILES =====
// Serve frontend files
app.use(express.static(path.join(__dirname, 'public')));

// ===== API ROUTES =====
app.use('/api/auth', authRoutes);
app.use('/api/game', gameRoutes);

// ===== HEALTH CHECK ENDPOINT =====
app.get('/health', async (req, res) => {
  const dbStatus = database.getStatus();
  
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    database: {
      connected: dbStatus.isConnected,
      readyState: dbStatus.readyState,
    },
    memory: process.memoryUsage(),
  });
});

// ===== ROOT ROUTE =====
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'views', 'login.html'));
});

// ===== DASHBOARD ROUTE =====
app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'views', 'dashboard.html'));
});

// ===== GAME ROUTE =====
app.get('/game', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'views', 'game.html'));
});

// ===== LEADERBOARD ROUTE =====
app.get('/leaderboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'views', 'leaderboard.html'));
});

// ===== 404 HANDLER =====
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
  });
});

// ===== ERROR HANDLER =====
app.use((err, req, res, next) => {
  console.error('❌ Error:', err);
  
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

// ===== SOCKET.IO SETUP =====
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || '*',
    methods: ['GET', 'POST'],
    credentials: true,
  },
  pingTimeout: 60000,
  pingInterval: 25000,
});

// Initialize Socket.IO handlers
initializeSocketHandlers(io);

// ===== START SERVER =====
async function startServer() {
  try {
    // Connect to database
    await database.connect();

    // Start server
    server.listen(PORT, () => {
      console.log(`
╔════════════════════════════════════════╗
║  🏏 CPL SERVER RUNNING SUCCESSFULLY!   ║
╠════════════════════════════════════════╣
║  Port: ${PORT.toString().padEnd(33)}║
║  Environment: ${(process.env.NODE_ENV || 'development').padEnd(25)}║
║  URL: http://localhost:${PORT}           ║
║                                        ║
║  Features:                             ║
║  ✅ Database Connected                 ║
║  ✅ Socket.IO Ready                    ║
║  ✅ Authentication Active              ║
║  ✅ Game Engine Loaded                 ║
╚════════════════════════════════════════╝
      `);

      console.log('📡 API Endpoints:');
      console.log('   POST   /api/auth/google');
      console.log('   GET    /api/auth/verify');
      console.log('   GET    /api/game/stats');
      console.log('   GET    /api/game/leaderboard');
      console.log('   POST   /api/game/complete');
      console.log('   GET    /health');
      console.log('');
      console.log('🎮 Socket.IO Events Ready');
      console.log('');
      console.log('Ready to play! 🏏✨');
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// ===== GRACEFUL SHUTDOWN =====
process.on('SIGTERM', async () => {
  console.log('⏹️  SIGTERM received. Shutting down gracefully...');
  
  server.close(async () => {
    await database.disconnect();
    console.log('✅ Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  console.log('⏹️  SIGINT received. Shutting down gracefully...');
  
  server.close(async () => {
    await database.disconnect();
    console.log('✅ Server closed');
    process.exit(0);
  });
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start the server
startServer();
