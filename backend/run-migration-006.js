const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function runMigration() {
  try {
    const migrationPath = path.join(__dirname, 'src', 'db', 'migrations', '006_features_and_plans.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    console.log('🚀 Running migration 006_features_and_plans.sql...');
    await pool.query(sql);
    console.log('✅ Migration completed successfully!');

    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:');
    console.error(error);
    await pool.end();
    process.exit(1);
  }
}

runMigration();
