const { query } = require('../config/database');

// Paid leave balance is a pure computation, not a stored/incrementing counter:
// accrued = 2.5 days for every whole calendar month since company_settings'
// leave_accrual_start_date (flat rate, same for every employee), running forever
// (no annual reset -- unused balance carries over), minus everything ever taken.
const getBalance = async (employeeId) => {
  const { rows } = await query(
    `SELECT
       e.leave_balance_adjustment AS adjustment,
       2.5 * GREATEST(0,
         (EXTRACT(YEAR FROM AGE(CURRENT_DATE, c.leave_accrual_start_date)) * 12
          + EXTRACT(MONTH FROM AGE(CURRENT_DATE, c.leave_accrual_start_date)))
       ) AS accrued,
       COALESCE((
         SELECT SUM(lv.days_count) FROM leaves lv
         WHERE lv.employee_id = e.id AND lv.status = 'scheduled'
       ), 0) AS consumed
     FROM employees e
     CROSS JOIN company_settings c
     WHERE e.id = $1`,
    [employeeId]
  );

  if (!rows.length) return null;

  const { adjustment, accrued, consumed } = rows[0];
  const remaining = Number(adjustment) + Number(accrued) - Number(consumed);

  return {
    adjustment: Number(adjustment),
    accrued: Number(accrued),
    consumed: Number(consumed),
    remaining,
  };
};

module.exports = { getBalance };
