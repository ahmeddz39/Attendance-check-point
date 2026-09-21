const crypto = require('crypto');
const { query } = require('../config/database');
const { getMachineId } = require('../utils/machineId');
const { PUBLIC_KEY_PEM } = require('../config/license-public-key');

// Cached in memory so every request doesn't hit the DB; invalidated on
// activate() and re-checked lazily by isLicensed().
let cached = null;

const parseBlob = (blob) => {
  const [payloadB64, sigB64] = String(blob).trim().split('.');
  if (!payloadB64 || !sigB64) throw new Error('Malformed license blob');

  const payloadJson = Buffer.from(payloadB64, 'base64').toString('utf8');
  const payload = JSON.parse(payloadJson);
  const signature = Buffer.from(sigB64, 'base64');

  return { payloadJson, payload, signature };
};

// Verifies a blob's signature and machine binding. Does not touch the DB.
const verifyBlob = (blob) => {
  let parsed;
  try {
    parsed = parseBlob(blob);
  } catch {
    return { valid: false, reason: 'Malformed license file' };
  }

  if (!PUBLIC_KEY_PEM) {
    return { valid: false, reason: 'This build has no vendor public key configured' };
  }

  const verified = crypto.verify(
    null, // Ed25519: algorithm is implied by the key type
    Buffer.from(parsed.payloadJson, 'utf8'),
    PUBLIC_KEY_PEM,
    parsed.signature
  );
  if (!verified) return { valid: false, reason: 'Invalid signature' };

  if (parsed.payload.machineId !== getMachineId()) {
    return { valid: false, reason: 'License does not match this machine' };
  }

  return { valid: true, payload: parsed.payload };
};

const loadActive = async () => {
  const { rows } = await query(`SELECT * FROM license WHERE id = 'current'`);
  return rows[0] || null;
};

// Re-validates the currently stored license (if any) against this machine
// and the embedded public key -- catches DB tampering/copy-to-new-machine
// without requiring a restart.
const getStatus = async () => {
  const row = await loadActive();
  if (!row) return { activated: false };

  const { valid, reason } = verifyBlob(row.license_blob);
  if (!valid) return { activated: false, reason };

  return {
    activated: true,
    licensee: row.licensee,
    activatedAt: row.activated_at,
  };
};

const isLicensed = async () => {
  if (cached && cached.machineId === getMachineId()) return true;
  const status = await getStatus();
  cached = status.activated ? { machineId: getMachineId() } : null;
  return status.activated;
};

const activate = async (blob, userId) => {
  const { valid, reason, payload } = verifyBlob(blob);
  if (!valid) {
    const err = new Error(reason || 'Invalid license');
    err.code = 'LICENSE_INVALID';
    throw err;
  }

  await query(
    `INSERT INTO license (id, license_blob, licensee, machine_id, activated_at, activated_by)
     VALUES ('current', $1, $2, $3, NOW(), $4)
     ON CONFLICT (id) DO UPDATE SET
       license_blob = EXCLUDED.license_blob,
       licensee     = EXCLUDED.licensee,
       machine_id   = EXCLUDED.machine_id,
       activated_at = NOW(),
       activated_by = EXCLUDED.activated_by`,
    [blob, payload.licensee, payload.machineId, userId]
  );

  cached = { machineId: getMachineId() };
  return { licensee: payload.licensee };
};

module.exports = { isLicensed, getStatus, activate, getMachineId };
