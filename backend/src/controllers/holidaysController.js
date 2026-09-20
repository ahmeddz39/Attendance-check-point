const { query } = require('../config/database');
const { success, created, noContent, notFound, badRequest } = require('../utils/response');

const listHolidays = async (req, res) => {
  const { year } = req.query;
  const params = [];
  let where = '';
  if (year) {
    params.push(`${year}-01-01`, `${year}-12-31`);
    where = `WHERE date BETWEEN $1 AND $2`;
  }

  const { rows } = await query(
    `SELECT id, date, name FROM holidays ${where} ORDER BY date ASC`,
    params
  );
  return success(res, rows);
};

const createHoliday = async (req, res) => {
  const { date, name } = req.body;
  if (!date || !name) return badRequest(res, 'date and name are required');

  const { rows } = await query(
    `INSERT INTO holidays (date, name) VALUES ($1, $2)
     ON CONFLICT (date) DO UPDATE SET name = EXCLUDED.name
     RETURNING id, date, name`,
    [date, name]
  );
  return created(res, rows[0]);
};

const deleteHoliday = async (req, res) => {
  const { rowCount } = await query(`DELETE FROM holidays WHERE id = $1`, [req.params.id]);
  if (!rowCount) return notFound(res, 'Holiday not found');
  return noContent(res);
};

module.exports = { listHolidays, createHoliday, deleteHoliday };
