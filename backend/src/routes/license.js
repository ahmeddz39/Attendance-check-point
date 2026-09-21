const { Router } = require('express');
const { body } = require('express-validator');
const { fingerprint, status, activateLicense } = require('../controllers/licenseController');
const { authenticate, authorize } = require('../middleware/auth');
const { validateRequest } = require('../middleware/errorHandler');
const { asyncHandler } = require('../middleware/asyncHandler');
const { audit } = require('../middleware/audit');

const router = Router();
router.use(authenticate);

router.get('/fingerprint', asyncHandler(fingerprint));
router.get('/status', asyncHandler(status));

router.post('/activate',
  authorize('admin'),
  body('licenseBlob').isString().notEmpty(),
  validateRequest,
  audit('license.activate', 'license'),
  asyncHandler(activateLicense)
);

module.exports = router;
