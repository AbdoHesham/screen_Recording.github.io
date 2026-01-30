// Make a user an admin
require('dotenv').config();
const { query } = require('./src/db/connection');

async function makeAdmin() {
  const email = process.argv[2];

  if (!email) {
    console.log('Usage: node make-admin.js <email>');
    console.log('Example: node make-admin.js user@example.com');
    process.exit(1);
  }

  try {
    const result = await query(
      `UPDATE users SET role = 'admin' WHERE email = $1 RETURNING id, email, full_name, role`,
      [email]
    );

    if (result.rows.length === 0) {
      console.log(`❌ User not found: ${email}`);
      process.exit(1);
    }

    const user = result.rows[0];
    console.log('✅ User updated successfully!');
    console.log(`   Email: ${user.email}`);
    console.log(`   Name: ${user.full_name}`);
    console.log(`   Role: ${user.role}`);
    console.log('\n🔐 This user now has admin access to:');
    console.log('   - User management');
    console.log('   - Revenue analytics');
    console.log('   - System statistics');
    console.log('   - Activity logs');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

makeAdmin();
