const { DeviceProtocolError } = require('./errors');
const zkteco = require('./zkteco');
const httpGeneric = require('./httpGeneric');

// Adding a new vendor is: write one file exposing { fetchUsers(device), fetchLogs(device) }
// in the same normalized shapes as the adapters below, then register its protocol string
// here. Nothing else in the app needs to change -- devicesController.js and deviceSync.js
// only ever go through attendanceDeviceAdapter.js's fetchDeviceUsers/fetchAttendanceLogs.
const ADAPTERS = {
  zkteco: zkteco,
  'http-generic': httpGeneric,
};

const getAdapter = (protocol) => {
  const adapter = ADAPTERS[protocol];
  if (!adapter) {
    throw new DeviceProtocolError(`No adapter registered for protocol "${protocol}".`);
  }
  return adapter;
};

module.exports = { getAdapter, DeviceProtocolError };
