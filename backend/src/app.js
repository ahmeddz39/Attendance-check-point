require('dotenv').config();
const path    = require('path');
const express = require('express');
const cors    = require('cors');
const helmet  = require('helmet');
const morgan  = require('morgan');
const rateLimit = require('express-rate-limit');

const authRoutes      = require('./routes/auth');
const licenseRoutes   = require('./routes/license');
const usersRoutes     = require('./routes/users');
const analyticsRoutes = require('./routes/analytics');
const reportsRoutes   = require('./routes/reports');
const devicesRoutes   = require('./routes/devices');
const employeesRoutes = require('./routes/employees');
const attendanceRoutes = require('./routes/attendance');
const settingsRoutes   = require('./routes/settings');
const holidaysRoutes   = require('./routes/holidays');
const leavesRoutes     = require('./routes/leaves');
const { errorHandler } = require('./middleware/errorHandler');
const { requireLicense } = require('./middleware/license');
const { authenticate } = require('./middleware/auth');

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

// General defense-in-depth rate limit on top of the stricter per-route ones
// (e.g. the login limiter in routes/auth.js).
app.use('/api', rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
}));

// ── Logging ─────────────────────────────────────────────────────────────────
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// ── Health ───────────────────────────────────────────────────────────────────
app.get('/health', (req, res) =>
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
);

// ── API Routes ───────────────────────────────────────────────────────────────
// /api/auth and /api/license stay outside the license gate: an admin must be
// able to log in and activate a fresh, unlicensed install. `authenticate`
// runs before `requireLicense` on every other route so an unauthenticated
// caller gets a plain 401 instead of learning this install's license state
// (the routers below also call `authenticate` internally -- redundant but
// harmless, and far simpler than threading the gate through each router).
app.use('/api/auth',      authRoutes);
app.use('/api/license',   licenseRoutes);
app.use('/api/users',     authenticate, requireLicense, usersRoutes);
app.use('/api/analytics', authenticate, requireLicense, analyticsRoutes);
app.use('/api/reports',   authenticate, requireLicense, reportsRoutes);
app.use('/api/devices',   authenticate, requireLicense, devicesRoutes);
app.use('/api/employees', authenticate, requireLicense, employeesRoutes);
app.use('/api/attendance', authenticate, requireLicense, attendanceRoutes);
app.use('/api/settings',  authenticate, requireLicense, settingsRoutes);
app.use('/api/holidays',  authenticate, requireLicense, holidaysRoutes);
app.use('/api/leaves',    authenticate, requireLicense, leavesRoutes);

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
