const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { query } = require('../config/database');
const { signAccessToken, signRefreshToken, verifyRefreshToken } = require('../utils/jwt');
const { success, created, unauthorized, badRequest, serverError, error } = require('../utils/response');

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

// POST /api/auth/login
const login = async (req, res) => {
  const { username, password } = req.body;
  try {
    const { rows } = await query(
      `SELECT u.*, r.name AS role
       FROM users u JOIN roles r ON r.id = u.role_id
       WHERE u.username = $1 AND u.is_active = TRUE`,
      [username.toLowerCase().trim()]
    );

    const user = rows[0];
    if (!user) return unauthorized(res, 'Invalid username or password');

    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      const minutesLeft = Math.ceil((new Date(user.locked_until) - new Date()) / 60000);
      return error(res, `Account locked due to repeated failed logins. Try again in ${minutesLeft} minute(s).`, 423);
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      const attempts = user.failed_login_attempts + 1;
      const lockedUntil = attempts >= MAX_FAILED_ATTEMPTS
        ? new Date(Date.now() + LOCKOUT_MINUTES * 60000)
        : null;
      await query(
        `UPDATE users SET failed_login_attempts = $1, locked_until = $2 WHERE id = $3`,
        [attempts, lockedUntil, user.id]
      );
      if (lockedUntil) {
        return error(res, `Account locked due to repeated failed logins. Try again in ${LOCKOUT_MINUTES} minute(s).`, 423);
      }
      return unauthorized(res, 'Invalid username or password');
    }

    // Tokens
    const payload = { sub: user.id, role: user.role };
    const accessToken  = signAccessToken(payload);
    const refreshToken = signRefreshToken(payload);

    // Persist refresh token
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);
    await query(
      `INSERT INTO refresh_tokens (id, user_id, token, expires_at)
       VALUES ($1, $2, $3, $4)`,
      [uuidv4(), user.id, refreshToken, expiresAt]
    );

    // Update last_login, clear any lockout state
    await query(
      `UPDATE users SET last_login_at = NOW(), failed_login_attempts = 0, locked_until = NULL WHERE id = $1`,
      [user.id]
    );

    return success(res, {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        username: user.username,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    return serverError(res);
  }
};

// POST /api/auth/refresh
const refresh = async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return badRequest(res, 'Refresh token required');

  try {
    const decoded = verifyRefreshToken(refreshToken);

    const { rows } = await query(
      `SELECT rt.*, u.is_active, r.name AS role
       FROM refresh_tokens rt
       JOIN users u ON u.id = rt.user_id
       JOIN roles r ON r.id = u.role_id
       WHERE rt.token = $1 AND rt.expires_at > NOW()`,
      [refreshToken]
    );

    if (!rows.length || !rows[0].is_active) {
      return unauthorized(res, 'Invalid or expired refresh token');
    }

    // Rotate: delete old, issue new
    await query(`DELETE FROM refresh_tokens WHERE token = $1`, [refreshToken]);

    const payload = { sub: decoded.sub, role: rows[0].role };
    const newAccessToken  = signAccessToken(payload);
    const newRefreshToken = signRefreshToken(payload);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);
    await query(
      `INSERT INTO refresh_tokens (id, user_id, token, expires_at) VALUES ($1, $2, $3, $4)`,
      [uuidv4(), decoded.sub, newRefreshToken, expiresAt]
    );

    return success(res, { accessToken: newAccessToken, refreshToken: newRefreshToken });
  } catch (err) {
    return unauthorized(res, 'Invalid refresh token');
  }
};

// POST /api/auth/logout
const logout = async (req, res) => {
  const { refreshToken } = req.body;
  if (refreshToken) {
    await query(`DELETE FROM refresh_tokens WHERE token = $1`, [refreshToken]).catch(() => {});
  }
  return success(res, { message: 'Logged out' });
};

// GET /api/auth/me
const me = async (req, res) => {
  return success(res, {
    id: req.user.id,
    username: req.user.username,
    firstName: req.user.first_name,
    lastName: req.user.last_name,
    role: req.user.role,
  });
};

module.exports = { login, refresh, logout, me };
