const { isLicensed } = require('../services/licenseService');
const { error } = require('../utils/response');

// Gates every route it's applied to behind an active license. Mounted on
// everything except /api/auth and /api/license so an admin can still log in
// and reach the activation screen on a fresh, unlicensed install.
const requireLicense = async (req, res, next) => {
  try {
    if (await isLicensed()) return next();
    return error(res, 'This installation is not licensed.', 403, { code: 'LICENSE_REQUIRED' });
  } catch (err) {
    console.error('License check failed:', err.message);
    return error(res, 'License check failed', 500);
  }
};

module.exports = { requireLicense };
