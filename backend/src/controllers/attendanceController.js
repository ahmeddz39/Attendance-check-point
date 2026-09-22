const { query } = require('../config/database');
const { success, created } = require('../utils/response');

const ATTENDANCE_RULES = {
  workWeek: 'Monday-Friday',
  presentRule: 'An employee is present on a scheduled workday when at least one punch exists.',
  absentRule: 'An active employee is absent on a scheduled workday when no punch exists.',
  incompleteRule: 'A day with exactly one punch is present but incomplete, so worked hours are 0 until checkout is imported.',
  lateRule: 'A present day is marked late when check-in is after the configured shift start plus grace period.',
  earlyRule: 'A present day is marked early leave when check-out is before the configured shift end minus grace period.',
  holidayRule: 'Scheduled workdays that fall on a registered public holiday are excluded from scheduled/absent counts.',
  leaveRule: 'A scheduled paid leave day with no punches shows as on leave instead of absent, and is paid as if worked (hourly employees are credited their normal shift hours for that day).',
  overtimeRule: 'Hours worked beyond the daily overtime threshold are paid at the overtime multiplier. Employees with a custom shift use their own scheduled shift length as that threshold instead of the company-wide default.',
  shiftRule: 'Each employee can override the company default shift (start/end, or a per-weekday schedule) from their Edit Employee form; days they are marked not-working on are excluded from scheduled/absent counts for them specifically.',
  monthlySalaryRule: 'Monthly salary is prorated by present scheduled workdays in the selected period, plus overtime pay.',
  hourlySalaryRule: 'Hourly salary is calculated from regular hours plus overtime pay.',
  currency: 'DZD',
};

const roundMoney = (value) => Number(Number(value || 0).toFixed(2));

const monthRange = (month) => {
  const value = month || new Date().toISOString().slice(0, 7);
  const [year, monthIndex] = value.split('-').map(Number);
  const start = new Date(year, monthIndex - 1, 1);
  const end = new Date(year, monthIndex, 1);
  const now = new Date();
  const effectiveEnd = start > now ? start : end > now ? now : end;
  return {
    month: value,
    from: start.toISOString(),
    to: effectiveEnd.toISOString(),
    monthEnd: end.toISOString(),
  };
};

const listLogs = async (req, res) => {
  const { from, to, employeeId, deviceId } = req.query;
  const params = [];
  const conditions = [];

  if (from) { params.push(from); conditions.push(`al.event_time >= $${params.length}`); }
  if (to) { params.push(to); conditions.push(`al.event_time <= $${params.length}`); }
  if (employeeId) { params.push(employeeId); conditions.push(`al.employee_id = $${params.length}`); }
  if (deviceId) { params.push(deviceId); conditions.push(`al.device_id = $${params.length}`); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const { rows } = await query(`
    SELECT al.*, ad.name AS device_name,
      e.employee_code, e.first_name, e.last_name
    FROM attendance_logs al
    LEFT JOIN attendance_devices ad ON ad.id = al.device_id
    LEFT JOIN employees e ON e.id = al.employee_id
    ${where}
    ORDER BY al.event_time DESC
    LIMIT 500
  `, params);

  return success(res, rows);
};

const createLog = async (req, res) => {
  const { deviceId, employeeId, deviceUserId, eventTime, eventType = 'check', verifyMode, workCode, rawPayload = {} } = req.body;
  const { rows } = await query(`
    INSERT INTO attendance_logs
      (device_id, employee_id, device_user_id, event_time, event_type, verify_mode, work_code, raw_payload)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
    ON CONFLICT (device_id, device_user_id, event_time, event_type) DO UPDATE
      SET raw_payload = EXCLUDED.raw_payload
    RETURNING *
  `, [deviceId, employeeId, deviceUserId, eventTime, eventType, verifyMode, workCode, JSON.stringify(rawPayload)]);

  return created(res, rows[0]);
};

const listDailyAttendance = async (req, res) => {
  const { from, to, employeeId, deviceId, search } = req.query;
  const params = [];
  const employeeConditions = ['e.is_active = TRUE'];
  const logConditions = ['al.event_time >= $1', 'al.event_time < $2'];

  params.push(from || new Date(new Date().setHours(0, 0, 0, 0)).toISOString());
  params.push(to || new Date().toISOString());

  if (employeeId) {
    params.push(employeeId);
    employeeConditions.push(`e.id = $${params.length}`);
    logConditions.push(`al.employee_id = $${params.length}`);
  }
  if (deviceId) {
    // Device filtering scopes the employee roster (who is "assigned" to this
    // device), not individual punches -- an employee's full attendance still
    // counts even if a given punch happened to land on a different device.
    params.push(deviceId);
    employeeConditions.push(`e.primary_device_id = $${params.length}`);
  }
  if (search) {
    params.push(`%${search}%`);
    employeeConditions.push(`(
      e.employee_code ILIKE $${params.length}
      OR e.first_name ILIKE $${params.length}
      OR e.last_name ILIKE $${params.length}
      OR e.device_user_id ILIKE $${params.length}
    )`);
    logConditions.push(`(
      e.employee_code ILIKE $${params.length}
      OR e.first_name ILIKE $${params.length}
      OR e.last_name ILIKE $${params.length}
      OR al.device_user_id ILIKE $${params.length}
    )`);
  }

  const employeeWhere = employeeConditions.join(' AND ');
  const logWhere = logConditions.join(' AND ');
  const { rows } = await query(`
    WITH days AS (
      SELECT generate_series(
        date_trunc('day', $1::timestamptz),
        date_trunc('day', ($2::timestamptz - interval '1 second')),
        interval '1 day'
      ) AS work_day
    ),
    scheduled_days AS (
      SELECT work_day
      FROM days
      WHERE EXTRACT(ISODOW FROM work_day) BETWEEN 1 AND 5
        AND NOT EXISTS (SELECT 1 FROM holidays h WHERE h.date = work_day::date)
    ),
    company AS (
      SELECT shift_start, shift_end, grace_minutes FROM company_settings WHERE id = 1
    ),
    active_employees AS (
      SELECT e.id, e.employee_code, e.first_name, e.last_name, e.department, e.position
      FROM employees e
      WHERE ${employeeWhere}
    ),
    grouped AS (
      SELECT
        al.employee_id,
        al.device_user_id,
        date_trunc('day', al.event_time) AS work_day,
        MIN(al.event_time) AS check_in_at,
        CASE WHEN COUNT(*) > 1 THEN MAX(al.event_time) ELSE NULL END AS check_out_at,
        COUNT(*) AS punch_count,
        ARRAY_AGG(DISTINCT ad.name) FILTER (WHERE ad.name IS NOT NULL) AS devices
      FROM attendance_logs al
      LEFT JOIN attendance_devices ad ON ad.id = al.device_id
      LEFT JOIN employees e ON e.id = al.employee_id
      WHERE ${logWhere}
      GROUP BY al.employee_id, al.device_user_id, date_trunc('day', al.event_time)
    ),
    employee_days AS (
      -- Scheduled workdays: every active employee gets a row, real punch or a
      -- synthetic "absent" placeholder when there isn't one. An employee's own
      -- shift (employee_shifts, per weekday) overrides the company default when
      -- set; a day they're marked not-working on is skipped entirely here (no
      -- phantom "absent") and picked up by the branch below only if they
      -- actually punched in anyway.
      SELECT
        e.id AS employee_id,
        e.employee_code,
        e.first_name,
        e.last_name,
        e.department,
        e.position,
        d.work_day,
        g.device_user_id,
        g.check_in_at,
        g.check_out_at,
        COALESCE(g.punch_count, 0) AS punch_count,
        g.devices,
        COALESCE(es.shift_start, c.shift_start) AS eff_shift_start,
        COALESCE(es.shift_end, c.shift_end) AS eff_shift_end
      FROM active_employees e
      CROSS JOIN scheduled_days d
      LEFT JOIN employee_shifts es ON es.employee_id = e.id AND es.weekday = EXTRACT(ISODOW FROM d.work_day)
      LEFT JOIN grouped g ON g.employee_id = e.id AND g.work_day = d.work_day
      CROSS JOIN company c
      WHERE COALESCE(es.is_working, TRUE)

      UNION ALL

      -- Real punches on a day outside this employee's effective scheduled week
      -- (a global weekend/holiday, or a weekday they're personally marked off)
      -- still need to show up here -- this view is a log of what actually
      -- happened, not a payroll schedule. No placeholder rows are manufactured
      -- for employees who didn't punch on an unscheduled day.
      SELECT
        e.id AS employee_id,
        e.employee_code,
        e.first_name,
        e.last_name,
        e.department,
        e.position,
        g.work_day,
        g.device_user_id,
        g.check_in_at,
        g.check_out_at,
        g.punch_count,
        g.devices,
        COALESCE(es.shift_start, c.shift_start) AS eff_shift_start,
        COALESCE(es.shift_end, c.shift_end) AS eff_shift_end
      FROM grouped g
      JOIN active_employees e ON e.id = g.employee_id
      LEFT JOIN employee_shifts es ON es.employee_id = e.id AND es.weekday = EXTRACT(ISODOW FROM g.work_day)
      CROSS JOIN company c
      WHERE NOT EXISTS (SELECT 1 FROM scheduled_days sd WHERE sd.work_day = g.work_day)
         OR NOT COALESCE(es.is_working, TRUE)
    ),
    unmatched AS (
      SELECT
        NULL::uuid AS employee_id,
        NULL::varchar AS employee_code,
        NULL::varchar AS first_name,
        NULL::varchar AS last_name,
        NULL::varchar AS department,
        NULL::varchar AS position,
        g.work_day,
        g.device_user_id,
        g.check_in_at,
        g.check_out_at,
        g.punch_count,
        g.devices,
        NULL::time AS eff_shift_start,
        NULL::time AS eff_shift_end
      FROM grouped g
      WHERE g.employee_id IS NULL
    )
    SELECT
      COALESCE(employee_id::text, 'device:' || device_user_id) AS group_key,
      employee_id,
      device_user_id,
      work_day,
      check_in_at,
      check_out_at,
      CASE
        WHEN check_out_at IS NULL THEN 0
        ELSE ROUND((EXTRACT(EPOCH FROM (check_out_at - check_in_at)) / 3600)::numeric, 2)
      END AS worked_hours,
      punch_count,
      devices,
      employee_code,
      first_name,
      last_name,
      department,
      position,
      CASE
        WHEN employee_id IS NULL THEN 'unmatched'
        WHEN punch_count = 0 AND EXISTS (
          SELECT 1 FROM leaves lv
          WHERE lv.employee_id = combined.employee_id AND lv.status = 'scheduled'
            AND combined.work_day::date BETWEEN lv.start_date AND lv.end_date
        ) THEN 'on_leave'
        WHEN punch_count = 0 THEN 'absent'
        WHEN punch_count = 1 THEN 'incomplete'
        WHEN check_in_at::time > (eff_shift_start + (c.grace_minutes || ' minutes')::interval) THEN 'late'
        WHEN check_out_at::time < (eff_shift_end - (c.grace_minutes || ' minutes')::interval) THEN 'early'
        ELSE 'present'
      END AS attendance_status
    FROM (
      SELECT * FROM employee_days
      UNION ALL
      SELECT * FROM unmatched
    ) combined
    CROSS JOIN company c
    ORDER BY work_day DESC, first_name, last_name, device_user_id
    LIMIT 500
  `, params);

  return success(res, { rules: ATTENDANCE_RULES, rows });
};

const salarySummary = async (req, res) => {
  const range = req.query.month
    ? monthRange(req.query.month)
    : {
        from: req.query.from || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString(),
        to: req.query.to || new Date().toISOString(),
      };
  const { search, deviceId } = req.query;
  const params = [range.from, range.to];
  const employeeConditions = ['e.is_active = TRUE'];

  if (deviceId) {
    params.push(deviceId);
    employeeConditions.push(`e.primary_device_id = $${params.length}`);
  }
  if (search) {
    params.push(`%${search}%`);
    employeeConditions.push(`(
      e.employee_code ILIKE $${params.length}
      OR e.first_name ILIKE $${params.length}
      OR e.last_name ILIKE $${params.length}
      OR e.department ILIKE $${params.length}
      OR e.device_user_id ILIKE $${params.length}
    )`);
  }

  const { rows } = await query(`
    WITH scheduled_days AS (
      SELECT generate_series(
        date_trunc('day', $1::timestamptz),
        date_trunc('day', ($2::timestamptz - interval '1 second')),
        interval '1 day'
      ) AS work_day
    ),
    period AS (
      SELECT COUNT(*)::numeric AS scheduled_days
      FROM scheduled_days
      WHERE EXTRACT(ISODOW FROM work_day) BETWEEN 1 AND 5
        AND NOT EXISTS (SELECT 1 FROM holidays h WHERE h.date = work_day::date)
    ),
    company AS (
      SELECT shift_start, shift_end, grace_minutes, overtime_daily_threshold_hours, overtime_multiplier
      FROM company_settings WHERE id = 1
    ),
    daily_bounds AS (
      -- Every real worked day counts here, scheduled or not (weekend/holiday
      -- overtime shouldn't vanish from pay just because it fell outside the
      -- configured work week). "period"/"scheduled_days" above stays Mon-Fri-only
      -- since that's the expected-days denominator, not the worked-days numerator.
      SELECT
        employee_id,
        date_trunc('day', event_time) AS work_day,
        MIN(event_time) AS first_event,
        MAX(event_time) AS last_event,
        COUNT(*) AS punch_count
      FROM attendance_logs
      WHERE employee_id IS NOT NULL
        AND event_time >= $1
        AND event_time < $2
      GROUP BY employee_id, date_trunc('day', event_time)
    ),
    day_calc AS (
      -- An employee's own shift (employee_shifts) overrides the company default
      -- for that weekday when set. Overtime threshold follows the same rule: a
      -- custom shift's own length is the threshold, not the flat company number
      -- -- otherwise a half-day employee would rarely earn overtime at all.
      SELECT
        db.employee_id,
        db.punch_count,
        CASE
          WHEN db.punch_count < 2 THEN 0
          ELSE GREATEST(EXTRACT(EPOCH FROM (db.last_event - db.first_event)) / 3600, 0)
        END AS day_hours,
        (db.punch_count >= 2 AND db.first_event::time > (COALESCE(es.shift_start, c.shift_start) + (c.grace_minutes || ' minutes')::interval)) AS is_late,
        CASE
          WHEN es.employee_id IS NOT NULL THEN GREATEST(EXTRACT(EPOCH FROM (es.shift_end - es.shift_start)) / 3600, 0)
          ELSE c.overtime_daily_threshold_hours
        END AS ot_threshold
      FROM daily_bounds db
      CROSS JOIN company c
      LEFT JOIN employee_shifts es ON es.employee_id = db.employee_id AND es.weekday = EXTRACT(ISODOW FROM db.work_day)
    ),
    hours AS (
      SELECT
        employee_id,
        ROUND(SUM(LEAST(day_hours, ot_threshold))::numeric, 2) AS regular_hours,
        ROUND(SUM(GREATEST(day_hours - ot_threshold, 0))::numeric, 2) AS overtime_hours,
        ROUND(SUM(day_hours)::numeric, 2) AS worked_hours,
        COUNT(*) AS present_days,
        COUNT(*) FILTER (WHERE punch_count = 1) AS incomplete_days,
        COUNT(*) FILTER (WHERE is_late) AS late_days
      FROM day_calc
      GROUP BY employee_id
    ),
    leave_days AS (
      -- A scheduled leave only counts against attendance on days the employee was
      -- actually going to work that day (own shift override, else company default,
      -- minus holidays) and only when they didn't punch in anyway (real attendance
      -- wins, same precedent as holidays). leave_hours is what an hourly employee's
      -- normal shift on that day would have paid, credited below so paid leave
      -- doesn't zero out their pay.
      SELECT
        lv.employee_id,
        COUNT(*) AS leave_day_count,
        SUM(GREATEST(EXTRACT(EPOCH FROM (COALESCE(es.shift_end, c.shift_end) - COALESCE(es.shift_start, c.shift_start))) / 3600, 0)) AS leave_hours
      FROM leaves lv
      CROSS JOIN company c
      CROSS JOIN LATERAL generate_series(
        GREATEST(lv.start_date::timestamptz, $1::timestamptz),
        LEAST(lv.end_date::timestamptz, ($2::timestamptz - interval '1 second')),
        interval '1 day'
      ) AS gs(work_day)
      LEFT JOIN employee_shifts es ON es.employee_id = lv.employee_id AND es.weekday = EXTRACT(ISODOW FROM gs.work_day)
      LEFT JOIN daily_bounds db ON db.employee_id = lv.employee_id AND db.work_day = gs.work_day
      WHERE lv.status = 'scheduled'
        AND (CASE WHEN es.employee_id IS NOT NULL THEN es.is_working ELSE EXTRACT(ISODOW FROM gs.work_day) BETWEEN 1 AND 5 END)
        AND NOT EXISTS (SELECT 1 FROM holidays h WHERE h.date = gs.work_day::date)
        AND db.employee_id IS NULL
      GROUP BY lv.employee_id
    )
    SELECT
      e.id,
      e.employee_code,
      e.first_name,
      e.last_name,
      e.department,
      COALESCE(e.salary_type, 'hourly') AS salary_type,
      COALESCE(e.hourly_rate, 0) AS hourly_rate,
      COALESCE(e.monthly_salary, 0) AS monthly_salary,
      COALESCE(NULLIF(e.standard_hours, 0), 160) AS standard_hours,
      COALESCE(p.scheduled_days, 0) AS scheduled_days,
      COALESCE(h.worked_hours, 0) AS worked_hours,
      COALESCE(h.regular_hours, 0) AS regular_hours,
      COALESCE(h.overtime_hours, 0) AS overtime_hours,
      COALESCE(h.present_days, 0) AS present_days,
      COALESCE(ld.leave_day_count, 0) AS leave_days,
      GREATEST(COALESCE(p.scheduled_days, 0) - COALESCE(h.present_days, 0) - COALESCE(ld.leave_day_count, 0), 0) AS absent_days,
      COALESCE(h.incomplete_days, 0) AS incomplete_days,
      COALESCE(h.late_days, 0) AS late_days,
      ROUND((
        (CASE
          WHEN COALESCE(e.salary_type, 'hourly') = 'monthly'
            THEN COALESCE(e.monthly_salary, 0) / NULLIF(COALESCE(NULLIF(e.standard_hours, 0), 160), 0)
          ELSE COALESCE(e.hourly_rate, 0)
        END) * comp.overtime_multiplier * COALESCE(h.overtime_hours, 0)
      )::numeric, 2) AS overtime_pay,
      CASE
        WHEN COALESCE(e.salary_type, 'hourly') = 'monthly'
          THEN ROUND((
            COALESCE(e.monthly_salary, 0) * (COALESCE(h.present_days, 0) + COALESCE(ld.leave_day_count, 0)) / NULLIF(COALESCE(p.scheduled_days, 0), 0)
            + (COALESCE(e.monthly_salary, 0) / NULLIF(COALESCE(NULLIF(e.standard_hours, 0), 160), 0)) * comp.overtime_multiplier * COALESCE(h.overtime_hours, 0)
          )::numeric, 2)
        ELSE ROUND((
          COALESCE(e.hourly_rate, 0) * (COALESCE(h.regular_hours, 0) + COALESCE(ld.leave_hours, 0))
          + COALESCE(e.hourly_rate, 0) * comp.overtime_multiplier * COALESCE(h.overtime_hours, 0)
        )::numeric, 2)
      END AS estimated_salary
    FROM employees e
    LEFT JOIN hours h ON h.employee_id = e.id
    LEFT JOIN leave_days ld ON ld.employee_id = e.id
    CROSS JOIN period p
    CROSS JOIN company comp
    WHERE ${employeeConditions.join(' AND ')}
    ORDER BY e.first_name, e.last_name
  `, params);

  const totals = rows.reduce((acc, row) => ({
    employees: acc.employees + 1,
    scheduledDays: Math.max(acc.scheduledDays, Number(row.scheduled_days || 0)),
    presentDays: acc.presentDays + Number(row.present_days || 0),
    leaveDays: acc.leaveDays + Number(row.leave_days || 0),
    absentDays: acc.absentDays + Number(row.absent_days || 0),
    incompleteDays: acc.incompleteDays + Number(row.incomplete_days || 0),
    lateDays: acc.lateDays + Number(row.late_days || 0),
    workedHours: acc.workedHours + Number(row.worked_hours || 0),
    regularHours: acc.regularHours + Number(row.regular_hours || 0),
    overtimeHours: acc.overtimeHours + Number(row.overtime_hours || 0),
    overtimePay: acc.overtimePay + Number(row.overtime_pay || 0),
    estimatedSalary: acc.estimatedSalary + Number(row.estimated_salary || 0),
  }), { employees: 0, scheduledDays: 0, presentDays: 0, leaveDays: 0, absentDays: 0, incompleteDays: 0, lateDays: 0, workedHours: 0, regularHours: 0, overtimeHours: 0, overtimePay: 0, estimatedSalary: 0 });

  return success(res, {
    period: range,
    rules: ATTENDANCE_RULES,
    totals: {
      ...totals,
      workedHours: roundMoney(totals.workedHours),
      regularHours: roundMoney(totals.regularHours),
      overtimeHours: roundMoney(totals.overtimeHours),
      overtimePay: roundMoney(totals.overtimePay),
      estimatedSalary: roundMoney(totals.estimatedSalary),
    },
    rows,
  });
};

const monthlyReport = async (req, res) => {
  const range = monthRange(req.query.month);
  const { deviceId } = req.query;
  const params = [range.from, range.to];
  const employeeConditions = ['e.is_active = TRUE'];

  if (deviceId) {
    params.push(deviceId);
    employeeConditions.push(`e.primary_device_id = $${params.length}`);
  }

  const { rows } = await query(`
    WITH scheduled_days AS (
      SELECT generate_series($1::timestamptz, ($2::timestamptz - interval '1 second'), interval '1 day') AS work_day
    ),
    period AS (
      SELECT COUNT(*)::numeric AS scheduled_days
      FROM scheduled_days
      WHERE EXTRACT(ISODOW FROM work_day) BETWEEN 1 AND 5
        AND NOT EXISTS (SELECT 1 FROM holidays h WHERE h.date = work_day::date)
    ),
    company AS (
      SELECT shift_start, shift_end, grace_minutes, overtime_daily_threshold_hours, overtime_multiplier
      FROM company_settings WHERE id = 1
    ),
    daily_bounds AS (
      -- Every real worked day counts here, scheduled or not -- see the matching
      -- comment in salarySummary above for why.
      SELECT
        employee_id,
        date_trunc('day', event_time) AS work_day,
        MIN(event_time) AS check_in_at,
        CASE WHEN COUNT(*) > 1 THEN MAX(event_time) ELSE NULL END AS check_out_at,
        COUNT(*) AS punch_count
      FROM attendance_logs
      WHERE employee_id IS NOT NULL
        AND event_time >= $1
        AND event_time < $2
      GROUP BY employee_id, date_trunc('day', event_time)
    ),
    day_calc AS (
      -- See salarySummary for why late-detection and the overtime threshold both
      -- resolve to the employee's own shift (employee_shifts) when they have one.
      SELECT
        db.employee_id,
        db.punch_count,
        CASE
          WHEN db.check_out_at IS NULL THEN 0
          ELSE GREATEST(EXTRACT(EPOCH FROM (db.check_out_at - db.check_in_at)) / 3600, 0)
        END AS day_hours,
        (db.punch_count >= 2 AND db.check_in_at::time > (COALESCE(es.shift_start, c.shift_start) + (c.grace_minutes || ' minutes')::interval)) AS is_late,
        CASE
          WHEN es.employee_id IS NOT NULL THEN GREATEST(EXTRACT(EPOCH FROM (es.shift_end - es.shift_start)) / 3600, 0)
          ELSE c.overtime_daily_threshold_hours
        END AS ot_threshold
      FROM daily_bounds db
      CROSS JOIN company c
      LEFT JOIN employee_shifts es ON es.employee_id = db.employee_id AND es.weekday = EXTRACT(ISODOW FROM db.work_day)
    ),
    hours AS (
      SELECT
        employee_id,
        COUNT(*) AS present_days,
        COUNT(*) FILTER (WHERE punch_count = 1) AS incomplete_days,
        COUNT(*) FILTER (WHERE is_late) AS late_days,
        SUM(punch_count) AS punches,
        ROUND(SUM(day_hours)::numeric, 2) AS worked_hours,
        ROUND(SUM(LEAST(day_hours, ot_threshold))::numeric, 2) AS regular_hours,
        ROUND(SUM(GREATEST(day_hours - ot_threshold, 0))::numeric, 2) AS overtime_hours
      FROM day_calc
      GROUP BY employee_id
    ),
    leave_days AS (
      -- See the matching CTE in salarySummary for why: only scheduled-work,
      -- no-punch days within a leave range count, and hourly employees are
      -- credited their normal shift hours for those days below.
      SELECT
        lv.employee_id,
        COUNT(*) AS leave_day_count,
        SUM(GREATEST(EXTRACT(EPOCH FROM (COALESCE(es.shift_end, c.shift_end) - COALESCE(es.shift_start, c.shift_start))) / 3600, 0)) AS leave_hours
      FROM leaves lv
      CROSS JOIN company c
      CROSS JOIN LATERAL generate_series(
        GREATEST(lv.start_date::timestamptz, $1::timestamptz),
        LEAST(lv.end_date::timestamptz, ($2::timestamptz - interval '1 second')),
        interval '1 day'
      ) AS gs(work_day)
      LEFT JOIN employee_shifts es ON es.employee_id = lv.employee_id AND es.weekday = EXTRACT(ISODOW FROM gs.work_day)
      LEFT JOIN daily_bounds db ON db.employee_id = lv.employee_id AND db.work_day = gs.work_day
      WHERE lv.status = 'scheduled'
        AND (CASE WHEN es.employee_id IS NOT NULL THEN es.is_working ELSE EXTRACT(ISODOW FROM gs.work_day) BETWEEN 1 AND 5 END)
        AND NOT EXISTS (SELECT 1 FROM holidays h WHERE h.date = gs.work_day::date)
        AND db.employee_id IS NULL
      GROUP BY lv.employee_id
    )
    SELECT
      e.id,
      e.employee_code,
      e.first_name,
      e.last_name,
      e.department,
      e.position,
      e.salary_type,
      e.hourly_rate,
      e.monthly_salary,
      e.standard_hours,
      COALESCE(p.scheduled_days, 0) AS scheduled_days,
      COALESCE(h.present_days, 0) AS present_days,
      COALESCE(ld.leave_day_count, 0) AS leave_days,
      GREATEST(COALESCE(p.scheduled_days, 0) - COALESCE(h.present_days, 0) - COALESCE(ld.leave_day_count, 0), 0) AS absent_days,
      COALESCE(h.incomplete_days, 0) AS incomplete_days,
      COALESCE(h.late_days, 0) AS late_days,
      COALESCE(h.punches, 0) AS punches,
      COALESCE(h.worked_hours, 0) AS worked_hours,
      COALESCE(h.regular_hours, 0) AS regular_hours,
      COALESCE(h.overtime_hours, 0) AS overtime_hours,
      ROUND((
        (CASE
          WHEN e.salary_type = 'monthly' THEN e.monthly_salary / NULLIF(COALESCE(NULLIF(e.standard_hours, 0), 160), 0)
          ELSE e.hourly_rate
        END) * comp.overtime_multiplier * COALESCE(h.overtime_hours, 0)
      )::numeric, 2) AS overtime_pay,
      CASE
        WHEN e.salary_type = 'monthly'
          THEN ROUND((
            e.monthly_salary * (COALESCE(h.present_days, 0) + COALESCE(ld.leave_day_count, 0)) / NULLIF(COALESCE(p.scheduled_days, 0), 0)
            + (e.monthly_salary / NULLIF(COALESCE(NULLIF(e.standard_hours, 0), 160), 0)) * comp.overtime_multiplier * COALESCE(h.overtime_hours, 0)
          )::numeric, 2)
        ELSE ROUND((
          e.hourly_rate * (COALESCE(h.regular_hours, 0) + COALESCE(ld.leave_hours, 0))
          + e.hourly_rate * comp.overtime_multiplier * COALESCE(h.overtime_hours, 0)
        )::numeric, 2)
      END AS final_salary
    FROM employees e
    LEFT JOIN hours h ON h.employee_id = e.id
    LEFT JOIN leave_days ld ON ld.employee_id = e.id
    CROSS JOIN period p
    CROSS JOIN company comp
    WHERE ${employeeConditions.join(' AND ')}
    ORDER BY e.first_name, e.last_name
  `, params);

  const totals = rows.reduce((acc, row) => ({
    employees: acc.employees + 1,
    scheduledDays: Math.max(acc.scheduledDays, Number(row.scheduled_days || 0)),
    presentDays: acc.presentDays + Number(row.present_days || 0),
    leaveDays: acc.leaveDays + Number(row.leave_days || 0),
    absentDays: acc.absentDays + Number(row.absent_days || 0),
    incompleteDays: acc.incompleteDays + Number(row.incomplete_days || 0),
    lateDays: acc.lateDays + Number(row.late_days || 0),
    workedHours: acc.workedHours + Number(row.worked_hours || 0),
    regularHours: acc.regularHours + Number(row.regular_hours || 0),
    overtimeHours: acc.overtimeHours + Number(row.overtime_hours || 0),
    overtimePay: acc.overtimePay + Number(row.overtime_pay || 0),
    finalSalary: acc.finalSalary + Number(row.final_salary || 0),
  }), { employees: 0, scheduledDays: 0, presentDays: 0, leaveDays: 0, absentDays: 0, incompleteDays: 0, lateDays: 0, workedHours: 0, regularHours: 0, overtimeHours: 0, overtimePay: 0, finalSalary: 0 });

  return success(res, {
    period: range,
    rules: ATTENDANCE_RULES,
    totals: {
      ...totals,
      workedHours: roundMoney(totals.workedHours),
      regularHours: roundMoney(totals.regularHours),
      overtimeHours: roundMoney(totals.overtimeHours),
      overtimePay: roundMoney(totals.overtimePay),
      finalSalary: roundMoney(totals.finalSalary),
    },
    rows,
  });
};

const employeeReport = async (req, res) => {
  const range = monthRange(req.query.month);
  const { employeeId } = req.params;

  const employeeResult = await query(`
    SELECT id, employee_code, first_name, last_name, department, position,
      COALESCE(salary_type, 'hourly') AS salary_type,
      COALESCE(hourly_rate, 0) AS hourly_rate,
      COALESCE(monthly_salary, 0) AS monthly_salary,
      COALESCE(NULLIF(standard_hours, 0), 160) AS standard_hours
    FROM employees
    WHERE id = $1
  `, [employeeId]);

  if (!employeeResult.rows.length) {
    return success(res, { period: range, employee: null, summary: null, rows: [] });
  }

  const settingsResult = await query(`
    SELECT overtime_daily_threshold_hours, overtime_multiplier
    FROM company_settings WHERE id = 1
  `);
  const settings = settingsResult.rows[0] || { overtime_daily_threshold_hours: 8, overtime_multiplier: 1.5 };
  const otThreshold = Number(settings.overtime_daily_threshold_hours || 8);
  const otMultiplier = Number(settings.overtime_multiplier || 1.5);

  const { rows } = await query(`
    WITH scheduled_days AS (
      SELECT generate_series($2::timestamptz, ($3::timestamptz - interval '1 second'), interval '1 day') AS work_day
    ),
    company AS (
      SELECT shift_start, shift_end, grace_minutes, overtime_daily_threshold_hours FROM company_settings WHERE id = 1
    ),
    daily AS (
      -- Every real worked day counts, scheduled or not -- see salarySummary for why.
      SELECT
        date_trunc('day', al.event_time) AS work_day,
        MIN(al.event_time) AS check_in_at,
        CASE WHEN COUNT(*) > 1 THEN MAX(al.event_time) ELSE NULL END AS check_out_at,
        COUNT(*) AS punch_count,
        ARRAY_AGG(DISTINCT ad.name) FILTER (WHERE ad.name IS NOT NULL) AS devices
      FROM attendance_logs al
      LEFT JOIN attendance_devices ad ON ad.id = al.device_id
      WHERE al.employee_id = $1
        AND al.event_time >= $2
        AND al.event_time < $3
      GROUP BY date_trunc('day', al.event_time)
    )
    SELECT
      s.work_day,
      d.check_in_at,
      d.check_out_at,
      CASE
        WHEN d.check_out_at IS NULL THEN 0
        ELSE ROUND((EXTRACT(EPOCH FROM (d.check_out_at - d.check_in_at)) / 3600)::numeric, 2)
      END AS worked_hours,
      COALESCE(d.punch_count, 0) AS punch_count,
      d.devices,
      CASE
        WHEN d.punch_count IS NULL AND EXISTS (
          SELECT 1 FROM leaves lv
          WHERE lv.employee_id = $1 AND lv.status = 'scheduled'
            AND s.work_day::date BETWEEN lv.start_date AND lv.end_date
        ) THEN 'on_leave'
        WHEN d.punch_count IS NULL THEN 'absent'
        WHEN d.punch_count = 1 THEN 'incomplete'
        WHEN d.check_in_at::time > (COALESCE(es.shift_start, c.shift_start) + (c.grace_minutes || ' minutes')::interval) THEN 'late'
        WHEN d.check_out_at::time < (COALESCE(es.shift_end, c.shift_end) - (c.grace_minutes || ' minutes')::interval) THEN 'early'
        ELSE 'present'
      END AS attendance_status,
      (
        CASE WHEN es.employee_id IS NOT NULL THEN es.is_working
             ELSE EXTRACT(ISODOW FROM s.work_day) BETWEEN 1 AND 5 END
        AND NOT EXISTS (SELECT 1 FROM holidays h WHERE h.date = s.work_day::date)
      ) AS is_scheduled,
      CASE
        WHEN es.employee_id IS NOT NULL THEN GREATEST(EXTRACT(EPOCH FROM (es.shift_end - es.shift_start)) / 3600, 0)
        ELSE c.overtime_daily_threshold_hours
      END AS ot_threshold
    FROM scheduled_days s
    LEFT JOIN employee_shifts es ON es.employee_id = $1 AND es.weekday = EXTRACT(ISODOW FROM s.work_day)
    LEFT JOIN daily d ON d.work_day = s.work_day
    CROSS JOIN company c
    WHERE (
      CASE WHEN es.employee_id IS NOT NULL THEN es.is_working
           ELSE EXTRACT(ISODOW FROM s.work_day) BETWEEN 1 AND 5 END
      AND NOT EXISTS (SELECT 1 FROM holidays h WHERE h.date = s.work_day::date)
    )
    OR d.work_day IS NOT NULL
    ORDER BY s.work_day ASC
  `, [employeeId, range.from, range.to]);

  const employee = employeeResult.rows[0];
  const totalWorkingHours = rows.reduce((sum, row) => sum + Number(row.worked_hours || 0), 0);
  const regularHours = rows.reduce((sum, row) => sum + Math.min(Number(row.worked_hours || 0), Number(row.ot_threshold ?? otThreshold)), 0);
  const overtimeHours = rows.reduce((sum, row) => sum + Math.max(Number(row.worked_hours || 0) - Number(row.ot_threshold ?? otThreshold), 0), 0);
  // rows.length now also includes real punches on unscheduled days (see the query
  // above), so the scheduled-days denominator must be counted explicitly.
  const scheduledDays = rows.filter(row => row.is_scheduled).length;
  const leaveDays = rows.filter(row => row.attendance_status === 'on_leave').length;
  const presentDays = rows.filter(row => row.attendance_status !== 'absent' && row.attendance_status !== 'on_leave').length;
  const absentDays = rows.filter(row => row.attendance_status === 'absent').length;
  const incompleteDays = rows.filter(row => row.attendance_status === 'incomplete').length;
  const lateDays = rows.filter(row => row.attendance_status === 'late').length;
  const earlyDays = rows.filter(row => row.attendance_status === 'early').length;
  // A leave day has no punches, so it contributes 0 to worked/regular hours above --
  // for hourly employees, credit their normal scheduled shift length per leave day
  // (row.ot_threshold is already that employee's effective shift length for that
  // day) so paid leave doesn't zero out their pay, matching monthly employees who
  // are unaffected by construction (paid regardless of days worked).
  const leaveCreditHours = rows
    .filter(row => row.attendance_status === 'on_leave')
    .reduce((sum, row) => sum + Number(row.ot_threshold ?? otThreshold), 0);

  const impliedHourlyRate = employee.salary_type === 'monthly'
    ? Number(employee.monthly_salary || 0) / Math.max(Number(employee.standard_hours || 160), 1)
    : Number(employee.hourly_rate || 0);
  const overtimePay = roundMoney(impliedHourlyRate * otMultiplier * overtimeHours);

  const baseSalary = employee.salary_type === 'monthly'
    ? roundMoney(Number(employee.monthly_salary || 0) * (presentDays + leaveDays) / Math.max(scheduledDays, 1))
    : roundMoney(Number(employee.hourly_rate || 0) * (regularHours + leaveCreditHours));

  const finalSalary = roundMoney(baseSalary + overtimePay);

  return success(res, {
    period: range,
    rules: ATTENDANCE_RULES,
    employee,
    summary: {
      scheduledDays,
      presentDays,
      leaveDays,
      absentDays,
      incompleteDays,
      lateDays,
      earlyDays,
      totalWorkingHours: Number(totalWorkingHours.toFixed(2)),
      regularHours: Number(regularHours.toFixed(2)),
      overtimeHours: Number(overtimeHours.toFixed(2)),
      overtimePay,
      finalSalary,
      salaryType: employee.salary_type,
      rate: employee.salary_type === 'monthly' ? employee.monthly_salary : employee.hourly_rate,
    },
    rows,
  });
};

const attendanceTrend = async (req, res) => {
  const days = Math.min(Math.max(parseInt(req.query.days, 10) || 30, 1), 90);
  const to = new Date();
  const from = new Date(to);
  from.setDate(from.getDate() - (days - 1));
  from.setHours(0, 0, 0, 0);

  const { rows } = await query(`
    WITH days AS (
      SELECT generate_series(
        date_trunc('day', $1::timestamptz),
        date_trunc('day', $2::timestamptz),
        interval '1 day'
      ) AS work_day
    ),
    -- Every day in range gets a data point (so "today" is never silently dropped
    -- from the chart on a weekend/holiday), but "scheduled"/"absent" only make
    -- sense on an actual scheduled day -- nobody is "absent" from a day nobody
    -- had to work. Real punches still count toward present/incomplete regardless.
    day_flags AS (
      SELECT work_day,
        (EXTRACT(ISODOW FROM work_day) BETWEEN 1 AND 5
          AND NOT EXISTS (SELECT 1 FROM holidays h WHERE h.date = work_day::date)) AS is_scheduled
      FROM days
    ),
    active_employees AS (
      SELECT id FROM employees WHERE is_active = TRUE
    ),
    punches AS (
      SELECT employee_id, date_trunc('day', event_time) AS work_day, COUNT(*) AS punch_count
      FROM attendance_logs
      WHERE employee_id IS NOT NULL AND event_time >= $1 AND event_time < ($2::timestamptz + interval '1 day')
      GROUP BY employee_id, date_trunc('day', event_time)
    )
    SELECT
      d.work_day,
      CASE WHEN d.is_scheduled THEN COUNT(e.id) ELSE 0 END AS scheduled,
      COUNT(*) FILTER (WHERE COALESCE(p.punch_count, 0) >= 2) AS present,
      COUNT(*) FILTER (WHERE COALESCE(p.punch_count, 0) = 1) AS incomplete,
      CASE WHEN d.is_scheduled THEN COUNT(*) FILTER (
        WHERE COALESCE(p.punch_count, 0) = 0 AND NOT EXISTS (
          SELECT 1 FROM leaves lv
          WHERE lv.employee_id = e.id AND lv.status = 'scheduled'
            AND d.work_day::date BETWEEN lv.start_date AND lv.end_date
        )
      ) ELSE 0 END AS absent
    FROM day_flags d
    CROSS JOIN active_employees e
    LEFT JOIN punches p ON p.employee_id = e.id AND p.work_day = d.work_day
    GROUP BY d.work_day, d.is_scheduled
    ORDER BY d.work_day ASC
  `, [from.toISOString(), to.toISOString()]);

  const trend = rows.map((row) => {
    const scheduled = Number(row.scheduled);
    const present = Number(row.present);
    const incomplete = Number(row.incomplete);
    const absent = Number(row.absent);
    return {
      workDay: row.work_day,
      scheduled,
      present,
      incomplete,
      absent,
      rate: scheduled > 0 ? Number((((present + incomplete) / scheduled) * 100).toFixed(1)) : 0,
    };
  });

  return success(res, {
    period: { from: from.toISOString(), to: to.toISOString(), days },
    rows: trend,
  });
};

module.exports = {
  listLogs,
  createLog,
  listDailyAttendance,
  salarySummary,
  monthlyReport,
  employeeReport,
  attendanceTrend,
};
