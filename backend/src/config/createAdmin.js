require('dotenv').config();
const bcrypt = require('bcryptjs');
const { pool } = require('./database');

const createAdmin = async () => {
  const email = process.env.ADMIN_EMAIL || process.argv[2];
  const password = process.env.ADMIN_PASSWORD || process.argv[3];

  if (!email || !password) {
    console.error('Usage: ADMIN_EMAIL=... ADMIN_PASSWORD=... npm run db:create-admin');
    console.error('   or: npm run db:create-admin -- admin@company.com StrongPassword!');
    process.exit(1);
  }

  const client = await pool.connect();
  try {
    const { rows: [adminRole] } = await client.query(`SELECT id FROM roles WHERE name = 'admin'`);
    if (!adminRole) {
      throw new Error("Role 'admin' not found — run `npm run db:migrate` first.");
    }

    const passwordHash = await bcrypt.hash(password, 12);
    await client.query(`
      INSERT INTO users (email, password_hash, first_name, last_name, role_id)
      VALUES ($1, $2, 'Admin', 'User', $3)
      ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash
    `, [email.toLowerCase().trim(), passwordHash, adminRole.id]);

    console.log(`✅ Admin account ready: ${email}`);
  } finally {
    client.release();
    await pool.end();
  }
};

createAdmin().catch((err) => {
  console.error('❌ Failed to create admin:', err.message);
  process.exit(1);
});
