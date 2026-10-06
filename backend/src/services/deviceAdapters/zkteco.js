const ZKLib = require('zklib-js');
const { DeviceProtocolError } = require('./errors');

// ZKTeco's own "Pull SDK" -- a binary protocol over TCP/UDP, default port 4370.
// This is the protocol every device in this app spoke before the adapter registry
// existed; moved here unchanged.

const splitName = (name = '') => {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] || 'Unknown',
    lastName: parts.slice(1).join(' ') || null,
  };
};

const normalizeUser = (user) => {
  const { firstName, lastName } = splitName(user.name);
  const deviceUserId = String(user.userId || user.uid || '').trim();

  return {
    employeeCode: deviceUserId || `device-${user.uid}`,
    deviceUserId,
    deviceUid: user.uid ?? null,
    deviceRole: user.role ?? null,
    cardNumber: user.cardno ? String(user.cardno) : null,
    firstName,
    lastName,
    metadata: {
      source: 'device',
      rawName: user.name || '',
      hasDevicePassword: Boolean(user.password),
      importedFields: Object.keys(user || {}),
    },
    raw: user,
  };
};

const normalizeAttendanceLog = (record) => {
  const deviceUserId = String(record.deviceUserId || record.userId || record.userSn || '').trim();
  const eventTime = record.recordTime || record.attTime || record.timestamp || record.time;

  return {
    deviceUserId,
    eventTime: eventTime ? new Date(eventTime).toISOString() : new Date().toISOString(),
    eventType: record.eventType || 'check',
    verifyMode: record.verifyMode || record.verify || null,
    workCode: record.workCode || null,
    rawPayload: record,
  };
};

const withDevice = async (device, action) => {
  const timeout = Number(device.settings?.timeout || 8000);
  const inPort = Number(device.settings?.inPort || 5200);
  const zk = new ZKLib(String(device.ip_address), Number(device.port || 4370), timeout, inPort);

  try {
    await zk.createSocket();
    return await action(zk);
  } catch (err) {
    throw new DeviceProtocolError(`Could not communicate with ${device.name} at ${device.ip_address}:${device.port}. ${err.message || err}`, err);
  } finally {
    try {
      await zk.disconnect();
    } catch (err) {
      // Ignore disconnect cleanup errors.
    }
  }
};

const fetchUsers = async (device) => {
  const result = await withDevice(device, (zk) => zk.getUsers());
  const users = Array.isArray(result?.data) ? result.data : Array.isArray(result) ? result : [];
  return users.map(normalizeUser);
};

const fetchLogs = async (device) => {
  const result = await withDevice(device, (zk) => zk.getAttendances());
  const logs = Array.isArray(result?.data) ? result.data : Array.isArray(result) ? result : [];
  return logs.map(normalizeAttendanceLog).filter((log) => log.deviceUserId);
};

// zklib-js's setUser() has two quirks it does not surface as errors:
// - its own validation (uid range, userid/name length) returns `false` instead of throwing
// - on a hardware write failure it logs and resolves `undefined` instead of rejecting
// So any `false`/`undefined`/`null` result here must be treated as a failure ourselves.
const pushUser = async (device, user) => {
  const uid = Number(user.deviceUid);
  const userid = String(user.deviceUserId || '').trim();
  const name = String(user.name || '').trim().slice(0, 24);
  const password = ''; // no device_password column; this deployment authenticates by fingerprint/face, not PIN
  const role = Number(user.deviceRole || 0);
  const cardno = Number(user.cardNumber || 0);

  if (!Number.isInteger(uid) || uid < 1 || uid > 3000) {
    throw new DeviceProtocolError(`Device UID must be an integer between 1 and 3000 (got "${user.deviceUid}").`);
  }
  if (!userid || userid.length > 9) {
    throw new DeviceProtocolError('Device user ID (PIN) is required and must be 9 characters or fewer.');
  }
  if (!name) {
    throw new DeviceProtocolError('Employee name is required to push to the device.');
  }

  const result = await withDevice(device, async (zk) => {
    // setUser() only wires up a tcpCallback; on a UDP-fallback connection it throws a
    // confusing low-level TypeError instead of failing cleanly, so pre-empt that here.
    if (zk.connectionType !== 'tcp') {
      throw new Error('writing a user record requires a TCP connection; this device is reachable only over UDP.');
    }
    return zk.setUser(uid, userid, name, password, role, cardno);
  });

  if (result === false || result == null) {
    throw new DeviceProtocolError(`Device ${device.name} rejected the user record for UID ${uid}.`);
  }
  return { deviceUid: uid };
};

module.exports = { fetchUsers, fetchLogs, pushUser };
