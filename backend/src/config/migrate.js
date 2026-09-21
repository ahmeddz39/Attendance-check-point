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

    await client.query(`
      CREATE TABLE IF NOT EXISTS attendance_devices (
        id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name           VARCHAR(120) NOT NULL,
        brand          VARCHAR(80) NOT NULL DEFAULT 'standard',
        model          VARCHAR(80),
        ip_address     INET NOT NULL,
        port           INTEGER NOT NULL DEFAULT 4370,
        protocol       VARCHAR(50) NOT NULL DEFAULT 'zkteco',
        serial_number  VARCHAR(120),
        location       VARCHAR(120),
        status         VARCHAR(30) NOT NULL DEFAULT 'unknown',
        last_seen_at   TIMESTAMPTZ,
        last_sync_at   TIMESTAMPTZ,
        settings       JSONB NOT NULL DEFAULT '{}',
        created_at     TIMESTAMPTZ DEFAULT NOW(),
        updated_at     TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE (ip_address, port)
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_attendance_devices_status ON attendance_devices(status);
      CREATE INDEX IF NOT EXISTS idx_attendance_devices_protocol ON attendance_devices(protocol);
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS employees (
        id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        employee_code     VARCHAR(80) UNIQUE NOT NULL,
        primary_device_id UUID REFERENCES attendance_devices(id) ON DELETE SET NULL,
        device_uid        INTEGER,
        device_user_id    VARCHAR(80),
        device_role       INTEGER,
        card_number       VARCHAR(80),
        first_name        VARCHAR(100) NOT NULL,
        last_name         VARCHAR(100),
        email             VARCHAR(255),
        phone             VARCHAR(50),
        department        VARCHAR(120),
        position          VARCHAR(120),
        salary_type       VARCHAR(20) NOT NULL DEFAULT 'hourly',
        hourly_rate       NUMERIC(12,2) NOT NULL DEFAULT 0,
        monthly_salary    NUMERIC(12,2) NOT NULL DEFAULT 0,
        standard_hours    NUMERIC(8,2) NOT NULL DEFAULT 160,
        is_active         BOOLEAN DEFAULT TRUE,
        metadata          JSONB NOT NULL DEFAULT '{}',
        created_at        TIMESTAMPTZ DEFAULT NOW(),
        updated_at        TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await client.query(`
      ALTER TABLE employees
        ADD COLUMN IF NOT EXISTS primary_device_id UUID REFERENCES attendance_devices(id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS device_uid INTEGER,
        ADD COLUMN IF NOT EXISTS device_role INTEGER,
        ADD COLUMN IF NOT EXISTS card_number VARCHAR(80),
        ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}';
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_employees_primary_device_id ON employees(primary_device_id);
      CREATE INDEX IF NOT EXISTS idx_employees_device_user_id ON employees(device_user_id);
      CREATE INDEX IF NOT EXISTS idx_employees_department ON employees(department);
      CREATE INDEX IF NOT EXISTS idx_employees_is_active ON employees(is_active);
    `);

    await client.query(`
      UPDATE employees SET
        salary_type = COALESCE(salary_type, 'hourly'),
        hourly_rate = COALESCE(hourly_rate, 0),
        monthly_salary = COALESCE(monthly_salary, 0),
        standard_hours = COALESCE(NULLIF(standard_hours, 0), 160)
      WHERE salary_type IS NULL
         OR hourly_rate IS NULL
         OR monthly_salary IS NULL
         OR standard_hours IS NULL
         OR standard_hours = 0;
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS attendance_logs (
        id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        device_id       UUID REFERENCES attendance_devices(id) ON DELETE SET NULL,
        employee_id     UUID REFERENCES employees(id) ON DELETE SET NULL,
        device_user_id  VARCHAR(80) NOT NULL,
        event_time      TIMESTAMPTZ NOT NULL,
        event_type      VARCHAR(30) NOT NULL DEFAULT 'check',
        verify_mode     VARCHAR(50),
        work_code       VARCHAR(80),
        raw_payload     JSONB NOT NULL DEFAULT '{}',
        created_at      TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE (device_id, device_user_id, event_time, event_type)
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_attendance_logs_employee_time ON attendance_logs(employee_id, event_time DESC);
      CREATE INDEX IF NOT EXISTS idx_attendance_logs_device_time ON attendance_logs(device_id, event_time DESC);
      CREATE INDEX IF NOT EXISTS idx_attendance_logs_event_time ON attendance_logs(event_time DESC);
    `);

    // ── Company settings (single-row config: shift & overtime rules) ──────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS company_settings (
        id                             INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
        shift_start                    TIME NOT NULL DEFAULT '08:00',
        grace_minutes                  INTEGER NOT NULL DEFAULT 10,
        overtime_daily_threshold_hours NUMERIC(5,2) NOT NULL DEFAULT 8,
        overtime_multiplier            NUMERIC(4,2) NOT NULL DEFAULT 1.5,
        updated_at                     TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await client.query(`
      INSERT INTO company_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
    `);

    await client.query(`
      ALTER TABLE company_settings
        ADD COLUMN IF NOT EXISTS company_name VARCHAR(200) NOT NULL DEFAULT 'Attendance Checkpoint',
        ADD COLUMN IF NOT EXISTS logo_path VARCHAR(255);
    `);

    await client.query(`
      ALTER TABLE company_settings
        ADD COLUMN IF NOT EXISTS shift_end TIME NOT NULL DEFAULT '17:00';
    `);

    // ── Per-employee shift schedule (overrides company_settings per weekday) ──
    await client.query(`
      CREATE TABLE IF NOT EXISTS employee_shifts (
        id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
        weekday     SMALLINT NOT NULL CHECK (weekday BETWEEN 1 AND 7),
        is_working  BOOLEAN NOT NULL DEFAULT TRUE,
        shift_start TIME NOT NULL,
        shift_end   TIME NOT NULL,
        UNIQUE (employee_id, weekday)
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_employee_shifts_employee_id ON employee_shifts(employee_id);
    `);

    // ── Public holidays ─────────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS holidays (
        id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        date       DATE UNIQUE NOT NULL,
        name       VARCHAR(160) NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_holidays_date ON holidays(date);
    `);

    // ── Account lockout (brute-force protection alongside IP rate limiting) ──
    await client.query(`
      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ;
    `);

    // ── License (offline, hardware-locked, singleton row) ─────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS license (
        id           TEXT PRIMARY KEY DEFAULT 'current' CHECK (id = 'current'),
        license_blob TEXT NOT NULL,
        licensee     TEXT NOT NULL,
        machine_id   TEXT NOT NULL,
        activated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        activated_by UUID REFERENCES users(id)
      );
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

    for (const table of ['users', 'reports', 'dashboards', 'widgets', 'attendance_devices', 'employees']) {
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
