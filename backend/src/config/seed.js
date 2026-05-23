require('dotenv').config();
const bcrypt = require('bcryptjs');
const { pool } = require('./database');

const seed = async () => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    console.log('🌱 Seeding database...');

    // Admin user
    const adminHash = await bcrypt.hash('Admin1234!', 12);
    const { rows: [adminRole] } = await client.query(
      `SELECT id FROM roles WHERE name = 'admin'`
    );
    const { rows: [admin] } = await client.query(`
      INSERT INTO users (email, password_hash, first_name, last_name, role_id)
      VALUES ($1, $2, 'Admin', 'User', $3)
      ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash
      RETURNING id
    `, ['admin@dashboard.local', adminHash, adminRole.id]);

    // Analyst user
    const analystHash = await bcrypt.hash('Analyst1234!', 12);
    const { rows: [analystRole] } = await client.query(
      `SELECT id FROM roles WHERE name = 'analyst'`
    );
    await client.query(`
      INSERT INTO users (email, password_hash, first_name, last_name, role_id)
      VALUES ($1, $2, 'Jane', 'Analyst', $3)
      ON CONFLICT (email) DO NOTHING
    `, ['analyst@dashboard.local', analystHash, analystRole.id]);

    // Viewer user
    const viewerHash = await bcrypt.hash('Viewer1234!', 12);
    const { rows: [viewerRole] } = await client.query(
      `SELECT id FROM roles WHERE name = 'viewer'`
    );
    await client.query(`
      INSERT INTO users (email, password_hash, first_name, last_name, role_id)
      VALUES ($1, $2, 'Bob', 'Viewer', $3)
      ON CONFLICT (email) DO NOTHING
    `, ['viewer@dashboard.local', viewerHash, viewerRole.id]);

    // Sample report
    const { rows: [report] } = await client.query(`
      INSERT INTO reports (name, description, query_config, created_by, is_public)
      VALUES ($1, $2, $3, $4, TRUE)
      ON CONFLICT DO NOTHING
      RETURNING id
    `, [
      'Monthly Active Users',
      'Tracks unique active users per month',
      JSON.stringify({ metric: 'active_users', interval: 'month', aggregation: 'count' }),
      admin.id
    ]);

    // Sample dashboard
    if (report) {
      const { rows: [dash] } = await client.query(`
        INSERT INTO dashboards (name, description, created_by, is_default)
        VALUES ('Overview', 'Main analytics overview', $1, TRUE)
        RETURNING id
      `, [admin.id]);

      await client.query(`
        INSERT INTO widgets (dashboard_id, report_id, title, widget_type, config, position)
        VALUES
          ($1, $2, 'Monthly Active Users', 'chart',
           '{"chartType":"line","color":"#6366f1"}',
           '{"x":0,"y":0,"w":8,"h":4}'),
          ($1, NULL, 'Total Revenue', 'metric',
           '{"metric":"revenue","format":"currency","trend":true}',
           '{"x":8,"y":0,"w":4,"h":2}'),
          ($1, NULL, 'New Signups', 'metric',
           '{"metric":"signups","format":"number","trend":true}',
           '{"x":8,"y":2,"w":4,"h":2}')
      `, [dash.id, report.id]);
    }

    // Sample metrics (last 30 days)
    const now = new Date();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      await client.query(
        `INSERT INTO metrics (name, value, tags, recorded_at) VALUES ($1,$2,$3,$4)`,
        ['active_users', Math.floor(800 + Math.random() * 400), JSON.stringify({ env: 'production' }), d]
      );
      await client.query(
        `INSERT INTO metrics (name, value, tags, recorded_at) VALUES ($1,$2,$3,$4)`,
        ['revenue', parseFloat((4000 + Math.random() * 2000).toFixed(2)), JSON.stringify({ env: 'production', currency: 'USD' }), d]
      );
      await client.query(
        `INSERT INTO metrics (name, value, tags, recorded_at) VALUES ($1,$2,$3,$4)`,
        ['signups', Math.floor(20 + Math.random() * 60), JSON.stringify({ env: 'production' }), d]
      );
    }

    await client.query('COMMIT');
    console.log('✅ Seed complete.');
    console.log('\n🔑 Test credentials:');
    console.log('   admin@dashboard.local   / Admin1234!');
    console.log('   analyst@dashboard.local / Analyst1234!');
    console.log('   viewer@dashboard.local  / Viewer1234!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Seed failed:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
};

seed().catch(() => process.exit(1));
