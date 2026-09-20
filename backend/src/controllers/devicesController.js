const { query } = require('../config/database');
const {
  success,
  created,
  noContent,
  notFound,
  badRequest,
  serverError,
} = require('../utils/response');
const {
  DEFAULT_PORT,
  probeTcp,
  discoverDevices,
} = require('../services/deviceDiscovery');
const {
  fetchDeviceUsers,
  DeviceProtocolError,
} = require('../services/attendanceDeviceAdapter');
const { syncDeviceAttendanceLogs } = require('../services/deviceSync');

const DEVICE_FIELDS = `
  id, name, brand, model, ip_address::text AS ip_address, port, protocol,
  serial_number, location, status, last_seen_at, last_sync_at, settings,
  created_at, updated_at
`;

const listDevices = async (req, res) => {
  const { rows } = await query(`SELECT ${DEVICE_FIELDS} FROM attendance_devices ORDER BY created_at DESC`);
  return success(res, rows);
};

const createDevice = async (req, res) => {
  const {
    name,
    brand = 'standard',
    model,
    ipAddress,
    port = DEFAULT_PORT,
    protocol = 'zkteco',
    serialNumber,
    location,
    settings = {},
  } = req.body;

  const { rows } = await query(
    `
    INSERT INTO attendance_devices
      (name, brand, model, ip_address, port, protocol, serial_number, location, settings)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
    RETURNING ${DEVICE_FIELDS}
  `,
    [name, brand, model, ipAddress, port, protocol, serialNumber, location, JSON.stringify(settings)]
  );

  return created(res, rows[0]);
};

const updateDevice = async (req, res) => {
  const { id } = req.params;
  const {
    name,
    brand,
    model,
    ipAddress,
    port,
    protocol,
    serialNumber,
    location,
    status,
    settings,
  } = req.body;

  const { rows } = await query(
    `
    UPDATE attendance_devices SET
      name = COALESCE($1, name),
      brand = COALESCE($2, brand),
      model = COALESCE($3, model),
      ip_address = COALESCE($4, ip_address),
      port = COALESCE($5, port),
      protocol = COALESCE($6, protocol),
      serial_number = COALESCE($7, serial_number),
      location = COALESCE($8, location),
      status = COALESCE($9, status),
      settings = COALESCE($10, settings)
    WHERE id = $11
    RETURNING ${DEVICE_FIELDS}
  `,
    [
      name,
      brand,
      model,
      ipAddress,
      port,
      protocol,
      serialNumber,
      location,
      status,
      settings ? JSON.stringify(settings) : null,
      id,
    ]
  );

  if (!rows.length) return notFound(res, 'Device not found');
  return success(res, rows[0]);
};

const deleteDevice = async (req, res) => {
  const { rowCount } = await query(`DELETE FROM attendance_devices WHERE id = $1`, [
    req.params.id,
  ]);
  if (!rowCount) return notFound(res, 'Device not found');
  return noContent(res);
};

const discover = async (req, res) => {
  const port = req.query.port ? parseInt(req.query.port, 10) : DEFAULT_PORT;
  const timeout = req.query.timeout ? parseInt(req.query.timeout, 10) : 350;
  const devices = await discoverDevices({
    port,
    prefix: req.query.prefix,
    timeout,
  });
  return success(res, devices);
};

const connectDevice = async (req, res) => {
  const { rows } = await query(`SELECT * FROM attendance_devices WHERE id = $1`, [
    req.params.id,
  ]);
  if (!rows.length) return notFound(res, 'Device not found');

  const device = rows[0];
  const online = await probeTcp(device.ip_address, device.port);
  const status = online ? 'online' : 'offline';

  const updated = await query(
    `
    UPDATE attendance_devices
    SET status = $1, last_seen_at = CASE WHEN $2 THEN NOW() ELSE last_seen_at END
    WHERE id = $3
    RETURNING ${DEVICE_FIELDS}
  `,
    [status, online, device.id]
  );

  return success(res, { device: updated.rows[0], online });
};

const syncDeviceUsers = async (req, res) => {
  const { rows } = await query(`SELECT * FROM attendance_devices WHERE id = $1`, [
    req.params.id,
  ]);
  if (!rows.length) return notFound(res, 'Device not found');

  try {
    const users = await fetchDeviceUsers(rows[0]);
    const imported = [];

    for (const user of users) {
      const saved = await query(
        `
        INSERT INTO employees
          (employee_code, primary_device_id, device_uid, device_user_id, device_role,
           card_number, first_name, last_name, metadata)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
        ON CONFLICT (employee_code) DO UPDATE SET
          primary_device_id = EXCLUDED.primary_device_id,
          device_uid = EXCLUDED.device_uid,
          device_user_id = EXCLUDED.device_user_id,
          device_role = EXCLUDED.device_role,
          card_number = EXCLUDED.card_number,
          first_name = COALESCE(NULLIF(EXCLUDED.first_name, 'Unknown'), employees.first_name),
          last_name = COALESCE(EXCLUDED.last_name, employees.last_name),
          metadata = employees.metadata || EXCLUDED.metadata,
          updated_at = NOW()
        RETURNING id, employee_code, first_name, last_name, device_user_id, device_uid, device_role, card_number
      `,
        [
          user.employeeCode,
          rows[0].id,
          user.deviceUid,
          user.deviceUserId,
          user.deviceRole,
          user.cardNumber,
          user.firstName,
          user.lastName,
          JSON.stringify(user.metadata),
        ]
      );
      imported.push(saved.rows[0]);
    }

    await query(
      `
      UPDATE attendance_devices
      SET status = 'online', last_seen_at = NOW(), last_sync_at = NOW()
      WHERE id = $1
    `,
      [rows[0].id]
    );

    return success(res, { imported: imported.length, employees: imported });
  } catch (err) {
    if (err instanceof DeviceProtocolError) return badRequest(res, err.message);
    return serverError(res, err.message);
  }
};

const syncDeviceLogs = async (req, res) => {
  const { rows } = await query(`SELECT * FROM attendance_devices WHERE id = $1`, [
    req.params.id,
  ]);
  if (!rows.length) return notFound(res, 'Device not found');

  try {
    const result = await syncDeviceAttendanceLogs(rows[0]);
    return success(res, result);
  } catch (err) {
    if (err instanceof DeviceProtocolError) return badRequest(res, err.message);
    return serverError(res, err.message);
  }
};

module.exports = {
  listDevices,
  createDevice,
  updateDevice,
  deleteDevice,
  discover,
  connectDevice,
  syncDeviceUsers,
  syncDeviceLogs,
};
