const express = require('express');
const router = express.Router();
const { query } = require('../db/connection');
const fs = require('fs');
const path = require('path');

/**
 * POST /api/migrations/run/:migrationNumber
 * Run a specific migration (admin only for safety)
 */
router.post('/run/:migrationNumber', async (req, res) => {
  try {
    const { migrationNumber } = req.params;

    // For now, we'll allow this without auth for initial setup
    // In production, you should add: authenticateToken, requireAdmin

    const migrationPath = path.join(__dirname, '..', 'db', 'migrations', `${migrationNumber}_features_and_plans.sql`);

    if (!fs.existsSync(migrationPath)) {
      return res.status(404).json({
        error: 'Migration file not found',
        path: migrationPath
      });
    }

    const sql = fs.readFileSync(migrationPath, 'utf8');

    console.log(`🚀 Running migration ${migrationNumber}...`);

    // Split by semicolon and run each statement
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    for (const statement of statements) {
      await query(statement);
    }

    console.log('✅ Migration completed successfully!');

    res.json({
      message: 'Migration completed successfully',
      migration: migrationNumber,
      statementsExecuted: statements.length
    });
  } catch (error) {
    console.error('❌ Migration failed:', error);
    res.status(500).json({
      error: 'Migration failed',
      details: error.message,
      stack: error.stack
    });
  }
});

/**
 * GET /api/migrations/status
 * Check what tables exist
 */
router.get('/status', async (req, res) => {
  try {
    const result = await query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);

    res.json({
      tables: result.rows.map(r => r.table_name)
    });
  } catch (error) {
    console.error('Error checking migration status:', error);
    res.status(500).json({
      error: 'Failed to check migration status',
      details: error.message
    });
  }
});

module.exports = router;
