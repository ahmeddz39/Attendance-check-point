const { query } = require('../config/database');
const { success, created, noContent, notFound, conflict } = require('../utils/response');
const { getBalance } = require('../services/leaveBalance');

const listLeaves = async (req, res) => {
  const { employeeId, status, from, to } = req.query;
  const params = [];
  const conditions = [];

  if (employeeId) { params.push(employeeId); conditions.push(`lv.employee_id = $${params.length}`); }
  if (status) { params.push(status); conditions.push(`lv.status = $${params.length}`); }
  if (from) { params.push(from); conditions.push(`lv.end_date >= $${params.length}`); }
  if (to) { params.push(to); conditions.push(`lv.start_date <= $${params.length}`); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const { rows } = await query(
    `SELECT
       lv.*,
       e.employee_code, e.first_name AS employee_first_name, e.last_name AS employee_last_name,
       e.department, e.position,
       ce.first_name AS covering_first_name, ce.last_name AS covering_last_name
     FROM leaves lv
     JOIN employees e ON e.id = lv.employee_id
     LEFT JOIN employees ce ON ce.id = lv.covering_employee_id
     ${where}
     ORDER BY lv.start_date DESC`,
    params
  );
  return success(res, rows);
};

const getEmployeeBalance = async (req, res) => {
  const { rows } = await query(`SELECT id FROM employees WHERE id = $1`, [req.params.employeeId]);
  if (!rows.length) return notFound(res, 'Employee not found');

  const balance = await getBalance(req.params.employeeId);
  return success(res, balance);
};

const createLeave = async (req, res) => {
  const { employeeId, startDate, endDate, coveringEmployeeId, notes } = req.body;

  const { rows: empRows } = await query(`SELECT id FROM employees WHERE id = $1`, [employeeId]);
  if (!empRows.length) return notFound(res, 'Employee not found');

  const { rows: overlap } = await query(
    `SELECT id FROM leaves
     WHERE employee_id = $1 AND status = 'scheduled'
       AND start_date <= $3 AND end_date >= $2`,
    [employeeId, startDate, endDate]
  );
  if (overlap.length) return conflict(res, 'This employee already has a scheduled leave overlapping these dates');

  const { rows } = await query(
    `INSERT INTO leaves (employee_id, covering_employee_id, start_date, end_date, days_count, notes, created_by)
     VALUES ($1, $2, $3, $4, ($4::date - $3::date + 1), $5, $6)
     RETURNING *`,
    [employeeId, coveringEmployeeId || null, startDate, endDate, notes || null, req.user.id]
  );
  return created(res, rows[0]);
};

const updateLeave = async (req, res) => {
  const { id } = req.params;
  const { startDate, endDate, coveringEmployeeId, notes, status } = req.body;

  const { rows: existing } = await query(`SELECT * FROM leaves WHERE id = $1`, [id]);
  if (!existing.length) return notFound(res, 'Leave not found');
  const current = existing[0];

  const newStart = startDate || current.start_date;
  const newEnd = endDate || current.end_date;

  if (startDate || endDate) {
    const { rows: overlap } = await query(
      `SELECT id FROM leaves
       WHERE employee_id = $1 AND status = 'scheduled' AND id <> $2
         AND start_date <= $4 AND end_date >= $3`,
      [current.employee_id, id, newStart, newEnd]
    );
    if (overlap.length) return conflict(res, 'This employee already has a scheduled leave overlapping these dates');
  }

  const { rows } = await query(
    `UPDATE leaves SET
       start_date = $1,
       end_date = $2,
       days_count = ($2::date - $1::date + 1),
       covering_employee_id = COALESCE($3, covering_employee_id),
       notes = COALESCE($4, notes),
       status = COALESCE($5, status)
     WHERE id = $6
     RETURNING *`,
    [newStart, newEnd, coveringEmployeeId, notes, status, id]
  );
  return success(res, rows[0]);
};

const deleteLeave = async (req, res) => {
  const { rowCount } = await query(`DELETE FROM leaves WHERE id = $1`, [req.params.id]);
  if (!rowCount) return notFound(res, 'Leave not found');
  return noContent(res);
};

module.exports = { listLeaves, getEmployeeBalance, createLeave, updateLeave, deleteLeave };
