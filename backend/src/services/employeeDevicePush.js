const { query } = require('../config/database');
const { fetchDeviceUsers, pushDeviceUser, DeviceProtocolError } = require('./attendanceDeviceAdapter');

const MAX_UID = 3000;

const nextFreeUid = (occupied) => {
  for (let uid = 1; uid <= MAX_UID; uid++) {
    if (!occupied.has(uid)) return uid;
  }
  return null;
};

// Pushes an employee's basic info (not a biometric -- that always requires the
// person to touch the device's own sensor) to their assigned device. When no
// device_uid is set yet, picks the lowest free slot by reading the device's
// current user list, then writes it back so later edits reuse the same slot.
const pushEmployeeToDevice = async (employee) => {
  if (!employee.primary_device_id) return { attempted: false, reason: 'no-primary-device' };
  if (!employee.device_user_id) return { attempted: false, reason: 'no-device-user-id' };

  const { rows } = await query(`SELECT * FROM attendance_devices WHERE id = $1`, [employee.primary_device_id]);
  if (!rows.length) return { attempted: false, reason: 'device-not-found' };
  const device = rows[0];

  let deviceUid = employee.device_uid;
  let autoAssigned = false;
  if (!deviceUid) {
    const existing = await fetchDeviceUsers(device);
    const occupied = new Set(existing.map((u) => Number(u.deviceUid)).filter(Number.isInteger));
    deviceUid = nextFreeUid(occupied);
    if (!deviceUid) {
      throw new DeviceProtocolError(`Device ${device.name} has no free slots left (1-3000 all in use).`);
    }
    autoAssigned = true;
  }

  const name = `${employee.first_name || ''} ${employee.last_name || ''}`.trim() || employee.employee_code;
  await pushDeviceUser(device, {
    deviceUid,
    deviceUserId: employee.device_user_id,
    name,
    deviceRole: employee.device_role || 0,
    cardNumber: employee.card_number || 0,
  });

  if (autoAssigned) {
    await query(`UPDATE employees SET device_uid = $1 WHERE id = $2`, [deviceUid, employee.id]);
  }

  return { attempted: true, deviceUid, autoAssigned };
};

module.exports = { pushEmployeeToDevice };
