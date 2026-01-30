const fs = require('fs');
const path = require('path');
const { pool } = require('./connection');
require('dotenv').config();

async function runMigrations() {
  console.log('🔄 Starting database migrations...\n');

  try {
    // Get all migration files
    const migrationsDir = path.join(__dirname, 'migrations');
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    if (files.length === 0) {
      console.log('ℹ️  No migration files found');
      return;
    }

    // Create migrations tracking table if it doesn't exist
    await pool.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) UNIQUE NOT NULL,
        executed_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Get already executed migrations
    const { rows: executedMigrations } = await pool.query(
      'SELECT filename FROM migrations'
    );
    const executed = new Set(executedMigrations.map(m => m.filename));

    // Run pending migrations
    for (const file of files) {
      if (executed.has(file)) {
        console.log(`⏭️  Skipping ${file} (already executed)`);
        continue;
      }

      console.log(`▶️  Running migration: ${file}`);

      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, 'utf8');

      // Start transaction
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        // Execute migration
        await client.query(sql);

        // Record migration
        await client.query(
          'INSERT INTO migrations (filename) VALUES ($1)',
          [file]
        );

        await client.query('COMMIT');
        console.log(`✅ Migration ${file} completed successfully\n`);
      } catch (error) {
        await client.query('ROLLBACK');
        console.error(`❌ Migration ${file} failed:`, error.message);
        throw error;
      } finally {
        client.release();
      }
    }

    console.log('🎉 All migrations completed successfully!');
  } catch (error) {
    console.error('❌ Migration process failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run migrations if this script is executed directly
if (require.main === module) {
  runMigrations();
}

module.exports = { runMigrations };
