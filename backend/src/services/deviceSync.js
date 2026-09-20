const { query } = require('../config/database');
const { fetchAttendanceLogs } = require('./attendanceDeviceAdapter');

// Pulls new attendance logs from a device and stores them, updating the device's
// online/last-seen/last-sync bookkeeping. Shared by the manual "Import Logs" endpoint
// and the background poller so both take the same path.
const syncDeviceAttendanceLogs = async (device) => {
  let cutoff = null;
  if (device.last_sync_at) {
    cutoff = new Date(device.last_sync_at);
  } else {
    try {
      const { rows: latestRows } = await query(
        `SELECT MAX(event_time) AS max_time FROM attendance_logs WHERE device_id = $1`,
        [device.id]
      );
      cutoff = latestRows?.[0]?.max_time ? new Date(latestRows[0].max_time) : null;
    } catch {
      cutoff = null;
    }
  }

  const logs = await fetchAttendanceLogs(device);
  const incoming = logs
    .filter((log) => log.eventTime)
    .filter((log) => (cutoff ? new Date(log.eventTime) > cutoff : true));
  const imported = [];

  for (const log of incoming) {
    const employee = await query(
      `SELECT id FROM employees WHERE device_user_id = $1 AND (primary_device_id = $2 OR primary_device_id IS NULL) ORDER BY primary_device_id NULLS LAST LIMIT 1`,
      [log.deviceUserId, device.id]
    );
    const saved = await query(
      `INSERT INTO attendance_logs (device_id, employee_id, device_user_id, event_time, event_type, verify_mode, work_code, raw_payload)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (device_id, device_user_id, event_time, event_type) DO UPDATE SET
         employee_id = COALESCE(EXCLUDED.employee_id, attendance_logs.employee_id),
         verify_mode = COALESCE(EXCLUDED.verify_mode, attendance_logs.verify_mode),
         work_code = COALESCE(EXCLUDED.work_code, attendance_logs.work_code),
         raw_payload = EXCLUDED.raw_payload
       RETURNING id, employee_id, device_user_id, event_time, event_type`,
      [device.id, employee.rows[0]?.id || null, log.deviceUserId, log.eventTime, log.eventType, log.verifyMode, log.workCode, JSON.stringify(log.rawPayload)]
    );
    imported.push(saved.rows[0]);
  }

  // Advance the watermark only as far as the newest record we actually captured this
  // run (not to "now"): a transient/partial device read that returns fewer records than
  // the device really holds must never push the cutoff past logs it didn't fetch, or
  // they'd be silently skipped forever since every later poll only looks after cutoff.
  const newestImported = incoming.reduce(
    (max, log) => (new Date(log.eventTime) > max ? new Date(log.eventTime) : max),
    cutoff || new Date(0)
  );

  await query(
    `UPDATE attendance_devices SET status = 'online', last_seen_at = NOW(), last_sync_at = $2 WHERE id = $1`,
    [device.id, newestImported.toISOString()]
  );

  return { imported: imported.length, logs: imported };
};

module.exports = { syncDeviceAttendanceLogs };
