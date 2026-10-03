const { query } = require('../config/database');
const { success, created, noContent, notFound, forbidden } = require('../utils/response');

// GET /api/reports
const listReports = async (req, res) => {
  const isAdmin = req.user.role === 'admin';
  const { rows } = await query(`
    SELECT r.*, u.username AS created_by_username
    FROM reports r
    LEFT JOIN users u ON u.id = r.created_by
    WHERE r.is_public = TRUE OR r.created_by = $1 ${isAdmin ? 'OR TRUE' : ''}
    ORDER BY r.created_at DESC
  `, [req.user.id]);
  return success(res, rows);
};

// GET /api/reports/:id
const getReport = async (req, res) => {
  const { rows } = await query(
    `SELECT r.*, u.username AS created_by_username FROM reports r
     LEFT JOIN users u ON u.id = r.created_by WHERE r.id = $1`,
    [req.params.id]
  );
  if (!rows.length) return notFound(res, 'Report not found');
  const report = rows[0];
  if (!report.is_public && report.created_by !== req.user.id && req.user.role !== 'admin') {
    return forbidden(res);
  }
  return success(res, report);
};

// POST /api/reports
const createReport = async (req, res) => {
  const { name, description, queryConfig, isPublic } = req.body;
  const { rows } = await query(
    `INSERT INTO reports (name, description, query_config, created_by, is_public)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [name, description, JSON.stringify(queryConfig || {}), req.user.id, isPublic ?? false]
  );
  return created(res, rows[0]);
};

// PATCH /api/reports/:id
const updateReport = async (req, res) => {
  const { name, description, queryConfig, isPublic } = req.body;
  const { rows: existing } = await query(`SELECT * FROM reports WHERE id = $1`, [req.params.id]);
  if (!existing.length) return notFound(res, 'Report not found');
  if (existing[0].created_by !== req.user.id && req.user.role !== 'admin') return forbidden(res);

  const { rows } = await query(`
    UPDATE reports SET
      name         = COALESCE($1, name),
      description  = COALESCE($2, description),
      query_config = COALESCE($3, query_config),
      is_public    = COALESCE($4, is_public)
    WHERE id = $5 RETURNING *`,
    [name, description, queryConfig ? JSON.stringify(queryConfig) : null, isPublic, req.params.id]
  );
  return success(res, rows[0]);
};

// DELETE /api/reports/:id
const deleteReport = async (req, res) => {
  const { rows } = await query(`SELECT created_by FROM reports WHERE id = $1`, [req.params.id]);
  if (!rows.length) return notFound(res, 'Report not found');
  if (rows[0].created_by !== req.user.id && req.user.role !== 'admin') return forbidden(res);
  await query(`DELETE FROM reports WHERE id = $1`, [req.params.id]);
  return noContent(res);
};

module.exports = { listReports, getReport, createReport, updateReport, deleteReport };
