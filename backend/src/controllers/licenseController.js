const { getStatus, activate, getMachineId } = require('../services/licenseService');
const { success, badRequest } = require('../utils/response');

// GET /api/license/fingerprint
const fingerprint = async (req, res) => {
  return success(res, { machineId: getMachineId() });
};

// GET /api/license/status
const status = async (req, res) => {
  return success(res, await getStatus());
};

// POST /api/license/activate
const activateLicense = async (req, res) => {
  const { licenseBlob } = req.body;
  if (!licenseBlob) return badRequest(res, 'licenseBlob is required');

  try {
    const result = await activate(licenseBlob, req.user.id);
    return success(res, result);
  } catch (err) {
    if (err.code === 'LICENSE_INVALID') return badRequest(res, err.message);
    throw err;
  }
};

module.exports = { fingerprint, status, activateLicense };
