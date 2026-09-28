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

module.exports = { fetchUsers, fetchLogs };
