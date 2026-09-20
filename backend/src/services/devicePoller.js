const { query } = require('../config/database');
const { probeTcp } = require('./deviceDiscovery');
const { syncDeviceAttendanceLogs } = require('./deviceSync');

const DEFAULT_INTERVAL_MS = 5 * 60 * 1000;

let timer = null;
let isPolling = false;

const pollOnce = async () => {
  if (isPolling) {
    console.warn('⏱️  Device poll skipped — previous poll still running');
    return;
  }
  isPolling = true;

  try {
    const { rows: devices } = await query(`SELECT * FROM attendance_devices`);

    for (const device of devices) {
      const online = await probeTcp(device.ip_address, device.port);

      if (!online) {
        await query(`UPDATE attendance_devices SET status = 'offline' WHERE id = $1`, [device.id]);
        continue;
      }

      try {
        const { imported } = await syncDeviceAttendanceLogs(device);
        if (imported > 0) {
          console.log(`📥 Synced ${imported} attendance log(s) from ${device.name} (${device.ip_address})`);
        }
      } catch (err) {
        console.error(`⚠️  Device poll failed for ${device.name} (${device.ip_address}): ${err.message}`);
      }
    }
  } catch (err) {
    console.error('⚠️  Device poll cycle failed:', err.message);
  } finally {
    isPolling = false;
  }
};

const startDevicePolling = () => {
  if (process.env.DEVICE_POLL_ENABLED === 'false') {
    console.log('⏸️  Device polling disabled (DEVICE_POLL_ENABLED=false)');
    return;
  }
  if (timer) return;

  const interval = Number(process.env.DEVICE_POLL_INTERVAL_MS) || DEFAULT_INTERVAL_MS;
  console.log(`⏱️  Device polling enabled — every ${Math.round(interval / 1000)}s`);

  timer = setInterval(pollOnce, interval);
  timer.unref?.();
  pollOnce();
};

const stopDevicePolling = () => {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
};

module.exports = { startDevicePolling, stopDevicePolling };
