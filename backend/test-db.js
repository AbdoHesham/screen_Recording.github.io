// Quick database connection test
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: process.env.DB_HOST?.includes('neon.tech') ? {
    rejectUnauthorized: false
  } : false,
});

async function testConnection() {
  console.log('Testing database connection...\n');
  console.log('Config:');
  console.log(`  Host: ${process.env.DB_HOST}`);
  console.log(`  Port: ${process.env.DB_PORT}`);
  console.log(`  Database: ${process.env.DB_NAME}`);
  console.log(`  User: ${process.env.DB_USER}`);
  console.log(`  Password: ${process.env.DB_PASSWORD ? '***' : 'NOT SET'}\n`);

  try {
    const result = await pool.query('SELECT NOW()');
    console.log('✅ Database connection successful!');
    console.log(`   Current time from database: ${result.rows[0].now}`);
    process.exit(0);
  } catch (error) {
    console.log('❌ Database connection failed!');
    console.log(`   Error: ${error.message}\n`);
    console.log('Next steps:');
    console.log('1. Set up a database using Neon (https://neon.tech)');
    console.log('2. Update backend/.env with your connection details');
    console.log('3. Run this test again: node backend/test-db.js');
    process.exit(1);
  } finally {
    await pool.end();
  }
}

testConnection();
