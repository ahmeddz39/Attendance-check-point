// Stable entry point for device I/O -- devicesController.js and deviceSync.js only
// ever import from this module. It dispatches to the right adapter for the device's
// `protocol` (see ./deviceAdapters), so neither of those callers needs to know or
// care which vendor/wire-protocol actually produced the data.
const { getAdapter, DeviceProtocolError } = require('./deviceAdapters');

const fetchDeviceUsers = (device) => getAdapter(device.protocol).fetchUsers(device);
const fetchAttendanceLogs = (device) => getAdapter(device.protocol).fetchLogs(device);
const pushDeviceUser = (device, user) => getAdapter(device.protocol).pushUser(device, user);

module.exports = {
  DeviceProtocolError,
  fetchDeviceUsers,
  fetchAttendanceLogs,
  pushDeviceUser,
};
