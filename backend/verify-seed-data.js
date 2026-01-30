// Verify seed data in database
require('dotenv').config();
const { query } = require('./src/db/connection');

async function verifySeedData() {
  console.log('📊 Verifying Database Setup...\n');

  try {
    // Check credit packages
    const packages = await query('SELECT * FROM credit_packages ORDER BY credits');
    console.log('💰 Credit Packages:');
    packages.rows.forEach(p => {
      console.log(`  ✅ ${p.name}: ${p.credits} credits for $${(p.price_cents / 100).toFixed(2)}`);
    });

    // Check AI agent personas
    const personas = await query('SELECT * FROM agent_personas ORDER BY name');
    console.log('\n🤖 AI Agent Personas:');
    personas.rows.forEach(p => {
      console.log(`  ✅ ${p.name}`);
      console.log(`     ${p.description}`);
      console.log(`     Capabilities: ${p.capabilities}`);
    });

    // Check tables
    const tables = await query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);
    console.log('\n📋 Database Tables:');
    tables.rows.forEach(t => {
      console.log(`  ✅ ${t.table_name}`);
    });

    console.log('\n✅ Database is ready for user registration!');
    console.log('\n📝 Next Steps:');
    console.log('  1. Test registration: POST http://localhost:3001/api/auth/register');
    console.log('  2. You will receive 100 free welcome credits');
    console.log('  3. Login and access your dashboard');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

verifySeedData();
