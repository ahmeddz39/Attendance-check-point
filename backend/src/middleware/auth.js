const { verifyAccessToken } = require('../utils/jwt');
const { unauthorized, forbidden } = require('../utils/response');
const { query } = require('../config/database');

// Verify JWT and load user from DB
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return unauthorized(res, 'Missing or malformed token');
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyAccessToken(token);

    const { rows } = await query(
      `SELECT u.id, u.username, u.first_name, u.last_name, u.is_active,
              r.name AS role, r.id AS role_id
       FROM users u
       JOIN roles r ON r.id = u.role_id
       WHERE u.id = $1`,
      [decoded.sub]
    );

    if (!rows.length || !rows[0].is_active) {
      return unauthorized(res, 'User not found or inactive');
    }

    req.user = rows[0];
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return unauthorized(res, 'Token expired');
    }
    return unauthorized(res, 'Invalid token');
  }
};

// Restrict to specific roles
const authorize = (...roles) => (req, res, next) => {
  if (!req.user) return unauthorized(res);
  if (!roles.includes(req.user.role)) {
    return forbidden(res, `Requires one of: ${roles.join(', ')}`);
  }
  next();
};

module.exports = { authenticate, authorize };
