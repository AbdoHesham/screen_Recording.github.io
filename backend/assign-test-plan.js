const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: process.env.DB_HOST?.includes('neon.tech') ? {
    rejectUnauthorized: false
  } : false
});

async function assignPlan() {
  try {
    // Get Free plan ID
    const freePlan = await pool.query("SELECT id FROM plans WHERE name = 'Free'");
    const planId = freePlan.rows[0].id;

    // Assign to test user
    await pool.query('UPDATE users SET plan_id = $1 WHERE email = $2', [planId, 'testuser@example.com']);

    console.log('✅ Assigned Free plan to testuser@example.com');
    await pool.end();
  } catch (err) {
    console.error('❌ Error:', err.message);
    await pool.end();
    process.exit(1);
  }
}

assignPlan();
