require('dotenv').config();
const { pool } = require('./database');

const migrate = async () => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    console.log('🚀 Running migrations...');

    // ── Extensions ───────────────────────────────────────────────────────────
    await client.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`);

    // ── Roles ────────────────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS roles (
        id          SERIAL PRIMARY KEY,
        name        VARCHAR(50) UNIQUE NOT NULL,
        description TEXT,
        created_at  TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await client.query(`
      INSERT INTO roles (name, description)
      VALUES
        ('admin',   'Full system access'),
        ('analyst', 'Read & export reports'),
        ('viewer',  'Read-only access')
      ON CONFLICT (name) DO NOTHING;
    `);

    // ── Users ────────────────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        email         VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        first_name    VARCHAR(100),
        last_name     VARCHAR(100),
        role_id       INTEGER NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
        is_active     BOOLEAN DEFAULT TRUE,
        last_login_at TIMESTAMPTZ,
        created_at    TIMESTAMPTZ DEFAULT NOW(),
        updated_at    TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_users_email   ON users(email);
      CREATE INDEX IF NOT EXISTS idx_users_role_id ON users(role_id);
    `);

    // ── Refresh Tokens ───────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS refresh_tokens (
        id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token      TEXT UNIQUE NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);
      CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token   ON refresh_tokens(token);
    `);

    // ── Audit Log ────────────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
        action      VARCHAR(100) NOT NULL,
        resource    VARCHAR(100),
        resource_id VARCHAR(255),
        metadata    JSONB,
        ip_address  INET,
        created_at  TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id    ON audit_logs(user_id);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_action     ON audit_logs(action);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
    `);

    // ── Reports ──────────────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS reports (
        id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name        VARCHAR(255) NOT NULL,
        description TEXT,
        query_config JSONB NOT NULL DEFAULT '{}',
        created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
        is_public   BOOLEAN DEFAULT FALSE,
        created_at  TIMESTAMPTZ DEFAULT NOW(),
        updated_at  TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_reports_created_by ON reports(created_by);
      CREATE INDEX IF NOT EXISTS idx_reports_is_public  ON reports(is_public);
    `);

    // ── Dashboards ───────────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS dashboards (
        id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name        VARCHAR(255) NOT NULL,
        description TEXT,
        layout      JSONB NOT NULL DEFAULT '[]',
        created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
        is_default  BOOLEAN DEFAULT FALSE,
        created_at  TIMESTAMPTZ DEFAULT NOW(),
        updated_at  TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // ── Dashboard Widgets ────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS widgets (
        id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        dashboard_id UUID NOT NULL REFERENCES dashboards(id) ON DELETE CASCADE,
        report_id    UUID REFERENCES reports(id) ON DELETE SET NULL,
        title        VARCHAR(255) NOT NULL,
        widget_type  VARCHAR(50) NOT NULL,   -- 'chart', 'table', 'metric', 'text'
        config       JSONB NOT NULL DEFAULT '{}',
        position     JSONB NOT NULL DEFAULT '{"x":0,"y":0,"w":4,"h":3}',
        created_at   TIMESTAMPTZ DEFAULT NOW(),
        updated_at   TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_widgets_dashboard_id ON widgets(dashboard_id);
    `);

    // ── Metrics (time-series events) ──────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS metrics (
        id         BIGSERIAL PRIMARY KEY,
        name       VARCHAR(100) NOT NULL,
        value      NUMERIC NOT NULL,
        tags       JSONB NOT NULL DEFAULT '{}',
        recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_metrics_name        ON metrics(name);
      CREATE INDEX IF NOT EXISTS idx_metrics_recorded_at ON metrics(recorded_at DESC);
      CREATE INDEX IF NOT EXISTS idx_metrics_tags        ON metrics USING GIN(tags);
    `);

    // ── updated_at trigger function ───────────────────────────────────────────
    await client.query(`
      CREATE OR REPLACE FUNCTION update_updated_at()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    for (const table of ['users', 'reports', 'dashboards', 'widgets']) {
      await client.query(`
        DROP TRIGGER IF EXISTS trg_${table}_updated_at ON ${table};
        CREATE TRIGGER trg_${table}_updated_at
          BEFORE UPDATE ON ${table}
          FOR EACH ROW EXECUTE FUNCTION update_updated_at();
      `);
    }

    await client.query('COMMIT');
    console.log('✅ Migrations complete.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
};

migrate().catch(() => process.exit(1));
