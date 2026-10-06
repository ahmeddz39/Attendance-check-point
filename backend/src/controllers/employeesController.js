const { query, getClient } = require('../config/database');
const { success, created, noContent, notFound, badRequest, serverError } = require('../utils/response');
const { pushEmployeeToDevice } = require('../services/employeeDevicePush');
const { DeviceProtocolError } = require('../services/attendanceDeviceAdapter');

const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7]; // ISODOW: 1=Mon..7=Sun

// Salary data is admin-only -- strip it from anything a non-admin reads back,
// on top of the route only letting an admin set it in the first place.
const SALARY_FIELDS = ['salary_type', 'hourly_rate', 'monthly_salary'];
const sanitizeForRole = (row, role) => {
  if (role === 'admin' || !row) return row;
  const copy = { ...row };
  for (const field of SALARY_FIELDS) delete copy[field];
  return copy;
};

const EMPLOYEE_FIELDS = `
  id, employee_code, primary_device_id, device_uid, device_user_id,
  device_role, card_number, first_name, last_name, email, phone,
  department, position, salary_type, hourly_rate, monthly_salary,
  standard_hours, is_active, metadata, leave_balance_adjustment, created_at, updated_at
`;

const listEmployees = async (req, res) => {
  const { search, active } = req.query;
  const params = [];
  const conditions = [];

  if (search) {
    params.push(`%${search}%`);
    conditions.push(`(
      employee_code ILIKE $${params.length}
      OR first_name ILIKE $${params.length}
      OR last_name ILIKE $${params.length}
      OR department ILIKE $${params.length}
    )`);
  }
  if (active !== undefined) {
    params.push(active === 'true');
    conditions.push(`is_active = $${params.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const { rows } = await query(`SELECT ${EMPLOYEE_FIELDS} FROM employees ${where} ORDER BY first_name, last_name`, params);
  return success(res, rows.map((row) => sanitizeForRole(row, req.user.role)));
};

const createEmployee = async (req, res) => {
  const isAdmin = req.user.role === 'admin';
  const {
    employeeCode, deviceUserId, firstName, lastName, email, phone,
    deviceUid, deviceRole, cardNumber, primaryDeviceId,
    department, position, standardHours = 160, isActive = true, metadata = {},
    leaveBalanceAdjustment = 0,
  } = req.body;
  const salaryType = isAdmin ? (req.body.salaryType || 'hourly') : 'hourly';
  const hourlyRate = isAdmin ? (req.body.hourlyRate || 0) : 0;
  const monthlySalary = isAdmin ? (req.body.monthlySalary || 0) : 0;

  const { rows } = await query(`
    INSERT INTO employees
      (employee_code, primary_device_id, device_uid, device_user_id, device_role, card_number,
       first_name, last_name, email, phone, department, position, salary_type,
       hourly_rate, monthly_salary, standard_hours, is_active, metadata, leave_balance_adjustment)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
    RETURNING ${EMPLOYEE_FIELDS}
  `, [employeeCode, primaryDeviceId, deviceUid, deviceUserId, deviceRole, cardNumber, firstName, lastName, email, phone, department, position, salaryType, hourlyRate, monthlySalary, standardHours, isActive, JSON.stringify(metadata), leaveBalanceAdjustment]);

  return created(res, sanitizeForRole(rows[0], req.user.role));
};

const updateEmployee = async (req, res) => {
  const isAdmin = req.user.role === 'admin';
  const {
    employeeCode, deviceUserId, firstName, lastName, email, phone,
    deviceUid, deviceRole, cardNumber, primaryDeviceId, metadata,
    department, position, standardHours, isActive, leaveBalanceAdjustment,
  } = req.body;
  const salaryType = isAdmin ? req.body.salaryType : undefined;
  const hourlyRate = isAdmin ? req.body.hourlyRate : undefined;
  const monthlySalary = isAdmin ? req.body.monthlySalary : undefined;

  const { rows } = await query(`
    UPDATE employees SET
      employee_code = COALESCE($1, employee_code),
      primary_device_id = COALESCE($2, primary_device_id),
      device_uid = COALESCE($3, device_uid),
      device_user_id = COALESCE($4, device_user_id),
      device_role = COALESCE($5, device_role),
      card_number = COALESCE($6, card_number),
      first_name = COALESCE($7, first_name),
      last_name = COALESCE($8, last_name),
      email = COALESCE($9, email),
      phone = COALESCE($10, phone),
      department = COALESCE($11, department),
      position = COALESCE($12, position),
      salary_type = COALESCE($13, salary_type),
      hourly_rate = COALESCE($14, hourly_rate),
      monthly_salary = COALESCE($15, monthly_salary),
      standard_hours = COALESCE($16, standard_hours),
      is_active = COALESCE($17, is_active),
      metadata = COALESCE($18, metadata),
      leave_balance_adjustment = COALESCE($19, leave_balance_adjustment)
    WHERE id = $20
    RETURNING ${EMPLOYEE_FIELDS}
  `, [employeeCode, primaryDeviceId, deviceUid, deviceUserId, deviceRole, cardNumber, firstName, lastName, email, phone, department, position, salaryType, hourlyRate, monthlySalary, standardHours, isActive, metadata ? JSON.stringify(metadata) : null, leaveBalanceAdjustment, req.params.id]);

  if (!rows.length) return notFound(res, 'Employee not found');
  return success(res, sanitizeForRole(rows[0], req.user.role));
};

const deleteEmployee = async (req, res) => {
  const { rowCount } = await query(`DELETE FROM employees WHERE id = $1`, [req.params.id]);
  if (!rowCount) return notFound(res, 'Employee not found');
  return noContent(res);
};

const getEmployeeShifts = async (req, res) => {
  const { id } = req.params;

  const employeeCheck = await query(`SELECT id FROM employees WHERE id = $1`, [id]);
  if (!employeeCheck.rows.length) return notFound(res, 'Employee not found');

  const { rows: custom } = await query(`
    SELECT weekday, is_working, shift_start::text AS shift_start, shift_end::text AS shift_end
    FROM employee_shifts WHERE employee_id = $1
  `, [id]);

  const { rows: companyRows } = await query(`
    SELECT shift_start::text AS shift_start, shift_end::text AS shift_end FROM company_settings WHERE id = 1
  `);
  const company = companyRows[0] || { shift_start: '08:00', shift_end: '17:00' };
  const byWeekday = new Map(custom.map((row) => [row.weekday, row]));

  const days = WEEKDAYS.map((weekday) => {
    const row = byWeekday.get(weekday);
    return row
      ? { weekday, isWorking: row.is_working, shiftStart: row.shift_start.slice(0, 5), shiftEnd: row.shift_end.slice(0, 5) }
      : { weekday, isWorking: weekday <= 5, shiftStart: company.shift_start.slice(0, 5), shiftEnd: company.shift_end.slice(0, 5) };
  });

  return success(res, { usesCompanyDefault: custom.length === 0, days });
};

const updateEmployeeShifts = async (req, res) => {
  const { id } = req.params;
  const { useCompanyDefault, days } = req.body;

  const employeeCheck = await query(`SELECT id FROM employees WHERE id = $1`, [id]);
  if (!employeeCheck.rows.length) return notFound(res, 'Employee not found');

  const client = await getClient();
  try {
    await client.query('BEGIN');
    await client.query(`DELETE FROM employee_shifts WHERE employee_id = $1`, [id]);

    if (!useCompanyDefault) {
      if (!Array.isArray(days) || days.length !== 7) {
        await client.query('ROLLBACK');
        return badRequest(res, 'days must contain all 7 weekdays');
      }
      for (const day of days) {
        const { weekday, isWorking, shiftStart, shiftEnd } = day;
        if (!WEEKDAYS.includes(weekday) || !shiftStart || !shiftEnd) {
          await client.query('ROLLBACK');
          return badRequest(res, `Invalid shift entry for weekday ${weekday}`);
        }
        await client.query(`
          INSERT INTO employee_shifts (employee_id, weekday, is_working, shift_start, shift_end)
          VALUES ($1, $2, $3, $4, $5)
        `, [id, weekday, isWorking !== false, shiftStart, shiftEnd]);
      }
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  req.params.id = id;
  return getEmployeeShifts(req, res);
};

const pushEmployeeDevice = async (req, res) => {
  const { id } = req.params;
  const { rows } = await query(`SELECT * FROM employees WHERE id = $1`, [id]);
  if (!rows.length) return notFound(res, 'Employee not found');

  try {
    const devicePush = await pushEmployeeToDevice(rows[0]);
    const { rows: refreshed } = await query(`SELECT ${EMPLOYEE_FIELDS} FROM employees WHERE id = $1`, [id]);
    return success(res, { ...sanitizeForRole(refreshed[0], req.user.role), devicePush });
  } catch (err) {
    if (err instanceof DeviceProtocolError) return badRequest(res, err.message);
    return serverError(res, err.message);
  }
};

module.exports = {
  listEmployees, createEmployee, updateEmployee, deleteEmployee,
  getEmployeeShifts, updateEmployeeShifts, pushEmployeeDevice,
};
