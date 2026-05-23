const bcrypt = require('bcryptjs');
const { query } = require('../config/database');
const { success, created, noContent, notFound, conflict, badRequest } = require('../utils/response');

const USER_FIELDS = `
  u.id, u.email, u.first_name, u.last_name, u.is_active,
  u.last_login_at, u.created_at, r.name AS role, r.id AS role_id
`;

// GET /api/users
const listUsers = async (req, res) => {
  const { page = 1, limit = 20, role, search } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  const params = [];
  const conditions = [];

  if (role) { params.push(role); conditions.push(`r.name = $${params.length}`); }
  if (search) {
    params.push(`%${search}%`);
    conditions.push(`(u.email ILIKE $${params.length} OR u.first_name ILIKE $${params.length} OR u.last_name ILIKE $${params.length})`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  params.push(parseInt(limit), offset);

  const [{ rows: users }, { rows: countRow }] = await Promise.all([
    query(`SELECT ${USER_FIELDS} FROM users u JOIN roles r ON r.id = u.role_id ${where} ORDER BY u.created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`, params),
    query(`SELECT COUNT(*) FROM users u JOIN roles r ON r.id = u.role_id ${where}`, params.slice(0, -2)),
  ]);

  return success(res, users, 200, { meta: { total: parseInt(countRow[0].count), page: parseInt(page), limit: parseInt(limit) } });
};

// GET /api/users/:id
const getUser = async (req, res) => {
  const { rows } = await query(
    `SELECT ${USER_FIELDS} FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = $1`,
    [req.params.id]
  );
  if (!rows.length) return notFound(res, 'User not found');
  return success(res, rows[0]);
};

// POST /api/users
const createUser = async (req, res) => {
  const { email, password, firstName, lastName, roleId } = req.body;

  const existing = await query(`SELECT id FROM users WHERE email = $1`, [email.toLowerCase()]);
  if (existing.rows.length) return conflict(res, 'Email already in use');

  const hash = await bcrypt.hash(password, 12);
  const { rows } = await query(
    `INSERT INTO users (email, password_hash, first_name, last_name, role_id)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [email.toLowerCase(), hash, firstName, lastName, roleId]
  );

  const { rows: [user] } = await query(
    `SELECT ${USER_FIELDS} FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = $1`,
    [rows[0].id]
  );
  return created(res, user);
};

// PATCH /api/users/:id
const updateUser = async (req, res) => {
  const { firstName, lastName, roleId, isActive } = req.body;
  const { id } = req.params;

  const { rows: existing } = await query(`SELECT id FROM users WHERE id = $1`, [id]);
  if (!existing.length) return notFound(res, 'User not found');

  await query(
    `UPDATE users SET
      first_name = COALESCE($1, first_name),
      last_name  = COALESCE($2, last_name),
      role_id    = COALESCE($3, role_id),
      is_active  = COALESCE($4, is_active)
     WHERE id = $5`,
    [firstName, lastName, roleId, isActive, id]
  );

  const { rows: [user] } = await query(
    `SELECT ${USER_FIELDS} FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = $1`, [id]
  );
  return success(res, user);
};

// DELETE /api/users/:id
const deleteUser = async (req, res) => {
  if (req.params.id === req.user.id) return badRequest(res, 'Cannot delete your own account');
  const { rowCount } = await query(`DELETE FROM users WHERE id = $1`, [req.params.id]);
  if (!rowCount) return notFound(res, 'User not found');
  return noContent(res);
};

module.exports = { listUsers, getUser, createUser, updateUser, deleteUser };
