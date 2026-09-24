const { query } = require('../config/database');
const { success, badRequest, noContent } = require('../utils/response');

const listJustifications = async (req, res) => {
  const { employeeId, from, to } = req.query;
  const params = [];
  const conditions = [];

  if (employeeId) { params.push(employeeId); conditions.push(`aj.employee_id = $${params.length}`); }
  if (from) { params.push(from); conditions.push(`aj.date >= $${params.length}`); }
  if (to) { params.push(to); conditions.push(`aj.date <= $${params.length}`); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const { rows } = await query(
    `SELECT aj.*, e.employee_code, e.first_name, e.last_name
     FROM absence_justifications aj
     JOIN employees e ON e.id = aj.employee_id
     ${where}
     ORDER BY aj.date DESC`,
    params
  );
  return success(res, rows);
};

const upsertJustification = async (req, res) => {
  const { employeeId, date, reason, paid, notes } = req.body;

  // Compare as SQL dates, not JS Date objects -- the server and the browser
  // can disagree on "today" once JS Date's UTC-based arithmetic gets
  // involved, the same class of bug already hit once in this feature.
  const { rows: dateCheck } = await query(`SELECT ($1::date > CURRENT_DATE) AS is_future`, [date]);
  if (dateCheck[0].is_future) {
    return badRequest(res, 'Cannot justify a date in the future');
  }

  const { rows: empRows } = await query(`SELECT id FROM employees WHERE id = $1`, [employeeId]);
  if (!empRows.length) return badRequest(res, 'Employee not found');

  const { rows: punchRows } = await query(
    `SELECT COUNT(*)::int AS count FROM attendance_logs
     WHERE employee_id = $1 AND event_time >= $2::date AND event_time < ($2::date + interval '1 day')`,
    [employeeId, date]
  );
  if (punchRows[0].count > 0) {
    return badRequest(res, 'This day is not absent -- the employee has punches on it');
  }

  const { rows } = await query(
    `INSERT INTO absence_justifications (employee_id, date, reason, paid, notes, created_by)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (employee_id, date) DO UPDATE SET
       reason = EXCLUDED.reason,
       paid = EXCLUDED.paid,
       notes = EXCLUDED.notes,
       created_by = EXCLUDED.created_by,
       updated_at = NOW()
     RETURNING *`,
    [employeeId, date, reason, Boolean(paid), notes || null, req.user.id]
  );
  return success(res, rows[0]);
};

const deleteJustification = async (req, res) => {
  const { employeeId, date } = req.query;
  if (!employeeId || !date) return badRequest(res, 'employeeId and date are required');

  await query(`DELETE FROM absence_justifications WHERE employee_id = $1 AND date = $2`, [employeeId, date]);
  return noContent(res);
};

module.exports = { listJustifications, upsertJustification, deleteJustification };
