const express = require('express');
const cors = require('cors');
require('dotenv').config();

const authRoutes = require('./routes/authRoutes');
const recordingRoutes = require('./routes/recordingRoutes');
const adminRoutes = require('./routes/adminRoutes');
const adminFeaturesRoutes = require('./routes/adminFeaturesRoutes');
const adminPlansRoutes = require('./routes/adminPlansRoutes');
const landingPageRoutes = require('./routes/landingPageRoutes');
const migrationRoutes = require('./routes/migrationRoutes');
const mockStorageRoutes = require('./routes/mockStorageRoutes');
const videoEditorRoutes = require('./routes/videoEditorRoutes');
const { pool } = require('./db/connection');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware (development only)
if (process.env.NODE_ENV === 'development') {
  app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
  });
}

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    // Check database connection
    await pool.query('SELECT 1');

    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development'
    });
  } catch (error) {
    console.error('Health check database error:', error);
    res.status(503).json({
      status: 'unhealthy',
      error: 'Database connection failed',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Mock storage routes (for development without AWS S3)
app.use('/mock-storage', mockStorageRoutes);

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/recordings', recordingRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/admin/plan-features', adminFeaturesRoutes);
app.use('/api/admin/plans', adminPlansRoutes);
app.use('/api/migrations', migrationRoutes);
app.use('/api/video-editor', videoEditorRoutes);
app.use('/api', landingPageRoutes);

// TODO: Add more routes as we build them
// app.use('/api/payment', paymentRoutes);
// app.use('/api/ai', aiRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Route not found',
    path: req.path,
    method: req.method
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Global error handler:', err);

  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM signal received: closing HTTP server');
  await pool.end();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT signal received: closing HTTP server');
  await pool.end();
  process.exit(0);
});

// Start server
app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════╗
║   ProScreen Recorder API Server              ║
║                                               ║
║   🚀 Server running on port ${PORT}            ║
║   🌍 Environment: ${process.env.NODE_ENV || 'development'}              ║
║   🔗 Health check: http://localhost:${PORT}/health  ║
║                                               ║
║   Available endpoints:                        ║
║   Auth:                                       ║
║   - POST /api/auth/register                   ║
║   - POST /api/auth/login                      ║
║   - GET  /api/auth/me                         ║
║   Recordings:                                 ║
║   - POST /api/recordings/presigned-url        ║
║   - GET  /api/recordings                      ║
║   Admin: (requires admin role)                ║
║   - GET  /api/admin/stats                     ║
║   - GET  /api/admin/users                     ║
║   - POST /api/admin/users                     ║
║                                               ║
╚═══════════════════════════════════════════════╝
  `);
});

module.exports = app;

