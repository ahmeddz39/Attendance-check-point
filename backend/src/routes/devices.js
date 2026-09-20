const { Router } = require('express');
const { body, param } = require('express-validator');
const { authenticate, authorize } = require('../middleware/auth');
const { validateRequest } = require('../middleware/errorHandler');
const { asyncHandler } = require('../middleware/asyncHandler');
const { audit } = require('../middleware/audit');
const {
  listDevices,
  createDevice,
  updateDevice,
  deleteDevice,
  discover,
  connectDevice,
  syncDeviceUsers,
  syncDeviceLogs,
} = require('../controllers/devicesController');

const router = Router();
router.use(authenticate);
router.use(authorize('admin', 'analyst'));

router.get('/', asyncHandler(listDevices));
router.get('/discover', asyncHandler(discover));

router.post('/',
  body('name').notEmpty().isString(),
  body('ipAddress').isIP(),
  body('port').optional().isInt({ min: 1, max: 65535 }),
  validateRequest,
  audit('device.create', 'attendance_devices'),
  asyncHandler(createDevice)
);

router.patch('/:id',
  param('id').isUUID(),
  body('ipAddress').optional().isIP(),
  body('port').optional().isInt({ min: 1, max: 65535 }),
  validateRequest,
  audit('device.update', 'attendance_devices'),
  asyncHandler(updateDevice)
);

router.delete('/:id',
  param('id').isUUID(),
  validateRequest,
  audit('device.delete', 'attendance_devices'),
  asyncHandler(deleteDevice)
);

router.post('/:id/connect', param('id').isUUID(), validateRequest, asyncHandler(connectDevice));
router.post('/:id/sync-users', param('id').isUUID(), validateRequest, asyncHandler(syncDeviceUsers));
router.post('/:id/sync-logs', param('id').isUUID(), validateRequest, asyncHandler(syncDeviceLogs));

module.exports = router;
