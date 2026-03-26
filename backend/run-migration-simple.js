const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function runMigration() {
  const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'proscreen_db',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
    ssl: process.env.DB_HOST?.includes('neon.tech') ? {
      rejectUnauthorized: false
    } : false,
  });

  try {
    console.log('🔌 Connecting to database...');
    console.log('DB_HOST:', process.env.DB_HOST || 'NOT SET');
    console.log('DB_NAME:', process.env.DB_NAME || 'NOT SET');

    await pool.query('SELECT NOW()');
    console.log('✅ Database connection successful\n');

    const migrationNumber = process.argv[2] || '006';
    const migrationFiles = {
      '006': '006_features_and_plans.sql',
      '007': '007_add_sort_order.sql',
      '008': '008_access_control_and_audit.sql'
    };

    const migrationFile = migrationFiles[migrationNumber];
    if (!migrationFile) {
      console.error(`❌ Unknown migration number: ${migrationNumber}`);
      process.exit(1);
    }

    const migrationPath = path.join(__dirname, 'src', 'db', 'migrations', migrationFile);
    console.log('📄 Reading migration file:', migrationPath);

    const sql = fs.readFileSync(migrationPath, 'utf8');
    console.log('📝 Migration file loaded\n');

    console.log('🚀 Executing migration...');
    await pool.query(sql);

    console.log('\n✅ Migration completed successfully!');

    // Verify tables were created
    console.log('\n🔍 Verifying tables...');
    const tablesResult = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name IN ('features', 'plans', 'plan_features', 'landing_page_content',
                          'user_plan_history', 'feature_usage', 'video_jobs', 'feature_audit_log')
      ORDER BY table_name
    `);

    console.log('Created tables:');
    tablesResult.rows.forEach(row => {
      console.log('  ✓', row.table_name);
    });

    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Migration failed:');
    console.error('Error message:', error.message);
    console.error('Error code:', error.code);
    if (error.position) {
      console.error('Error position:', error.position);
    }
    console.error('\nFull error:', error);

    await pool.end();
    process.exit(1);
  }
}

runMigration();
