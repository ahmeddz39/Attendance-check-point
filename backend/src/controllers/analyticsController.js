const { query } = require('../config/database');
const { success, badRequest } = require('../utils/response');

// GET /api/analytics/metrics
// ?name=active_users&from=2024-01-01&to=2024-12-31&interval=day
const getMetrics = async (req, res) => {
  const { name, from, to, interval = 'day' } = req.query;

  const validIntervals = ['hour', 'day', 'week', 'month'];
  if (!validIntervals.includes(interval)) {
    return badRequest(res, `interval must be one of: ${validIntervals.join(', ')}`);
  }

  const params = [];
  const conditions = ['1=1'];
  const nextParam = () => params.length + 2;

  if (name) { params.push(name); conditions.push(`name = $${nextParam() - 1}`); }
  if (from) { params.push(from); conditions.push(`recorded_at >= $${nextParam() - 1}`); }
  if (to)   { params.push(to);   conditions.push(`recorded_at <= $${nextParam() - 1}`); }

  const where = conditions.join(' AND ');

  const { rows } = await query(`
    SELECT
      date_trunc($1, recorded_at) AS period,
      name,
      ROUND(SUM(value)::numeric, 2) AS total,
      ROUND(AVG(value)::numeric, 2) AS average,
      MIN(value) AS min,
      MAX(value) AS max,
      COUNT(*) AS data_points
    FROM metrics
    WHERE ${where}
    GROUP BY period, name
    ORDER BY period ASC, name ASC
  `, [interval, ...params]);

  return success(res, rows);
};

// GET /api/analytics/summary
const getSummary = async (req, res) => {
  const { from, to } = req.query;
  const rangeStart = from || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const rangeEnd   = to   || new Date().toISOString();

  const [metrics, users, topMetrics] = await Promise.all([
    query(`
      SELECT name,
        ROUND(SUM(value)::numeric, 2) AS total,
        ROUND(AVG(value)::numeric, 2) AS average,
        COUNT(*) AS data_points
      FROM metrics
      WHERE recorded_at BETWEEN $1 AND $2
      GROUP BY name
    `, [rangeStart, rangeEnd]),

    query(`
      SELECT
        COUNT(*) FILTER (WHERE is_active)        AS active_users,
        COUNT(*) FILTER (WHERE NOT is_active)     AS inactive_users,
        COUNT(*) FILTER (WHERE created_at >= $1)  AS new_users
      FROM users
    `, [rangeStart]),

    query(`
      SELECT name, ROUND(SUM(value)::numeric, 2) AS total
      FROM metrics
      WHERE recorded_at BETWEEN $1 AND $2
      GROUP BY name
      ORDER BY total DESC
      LIMIT 5
    `, [rangeStart, rangeEnd]),
  ]);

  return success(res, {
    period: { from: rangeStart, to: rangeEnd },
    metrics: metrics.rows,
    users: users.rows[0],
    topMetrics: topMetrics.rows,
  });
};

// POST /api/analytics/metrics  (ingest a single metric)
const ingestMetric = async (req, res) => {
  const { name, value, tags = {}, recordedAt } = req.body;

  await query(
    `INSERT INTO metrics (name, value, tags, recorded_at)
     VALUES ($1, $2, $3, $4)`,
    [name, value, JSON.stringify(tags), recordedAt || new Date()]
  );

  return success(res, { message: 'Metric recorded' }, 201);
};

module.exports = { getMetrics, getSummary, ingestMetric };
