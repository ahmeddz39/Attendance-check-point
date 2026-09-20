require('dotenv').config();
const path    = require('path');
const express = require('express');
const cors    = require('cors');
const helmet  = require('helmet');
const morgan  = require('morgan');

const authRoutes      = require('./routes/auth');
const usersRoutes     = require('./routes/users');
const analyticsRoutes = require('./routes/analytics');
const reportsRoutes   = require('./routes/reports');
const devicesRoutes   = require('./routes/devices');
const employeesRoutes = require('./routes/employees');
const attendanceRoutes = require('./routes/attendance');
const settingsRoutes   = require('./routes/settings');
const holidaysRoutes   = require('./routes/holidays');
const { errorHandler } = require('./middleware/errorHandler');

const app = express();

// ── Security & Parsing ──────────────────────────────────────────────────────
// This app is served plain HTTP over the LAN (no TLS). Helmet's default CSP
// includes upgrade-insecure-requests, which Chrome ignores on localhost (a
// trusted secure context) but enforces on a real LAN IP -- rewriting the JS/
// CSS/favicon requests to https:// against a server that never speaks TLS,
// which surfaces as a blank page for every LAN client. Drop just that
// directive; everything else helmet sets stays on.
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      ...helmet.contentSecurityPolicy.getDefaultDirectives(),
      'upgrade-insecure-requests': null,
    },
  },
}));
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Logging ─────────────────────────────────────────────────────────────────
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// ── Health ───────────────────────────────────────────────────────────────────
app.get('/health', (req, res) =>
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
);

// ── API Routes ───────────────────────────────────────────────────────────────
app.use('/api/auth',      authRoutes);
app.use('/api/users',     usersRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/reports',   reportsRoutes);
app.use('/api/devices',   devicesRoutes);
app.use('/api/employees', employeesRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/settings',  settingsRoutes);
app.use('/api/holidays',  holidaysRoutes);

// ── Uploaded assets (company logo, etc.) ──────────────────────────────────────
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// ── Frontend (production build) ───────────────────────────────────────────────
if (process.env.NODE_ENV === 'production') {
  const frontendDist = path.join(__dirname, '..', '..', 'frontend', 'dist');
  app.use(express.static(frontendDist));
  app.get(/^(?!\/api).*/, (req, res) => {
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}

// ── 404 ──────────────────────────────────────────────────────────────────────
app.use((req, res) => res.status(404).json({ success: false, error: { message: 'Route not found' } }));

// ── Global Error Handler ─────────────────────────────────────────────────────
app.use(errorHandler);

module.exports = app;
