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

// The plain device list is shared well beyond the Devices management page
// (Attendance's device filter, Employees' primary-device picker, the
// Dashboard's online count) so it stays open to analysts; everything that
// actually manages a device is admin-only, matching the Devices settings
// tab being admin-only in the UI.
router.get('/', authorize('admin', 'analyst'), asyncHandler(listDevices));
router.get('/discover', authorize('admin'), asyncHandler(discover));

router.post('/',
  authorize('admin'),
  body('name').notEmpty().isString(),
  body('ipAddress').isIP(),
  body('port').optional().isInt({ min: 1, max: 65535 }),
  validateRequest,
  audit('device.create', 'attendance_devices'),
  asyncHandler(createDevice)
);

router.patch('/:id',
  authorize('admin'),
  param('id').isUUID(),
  body('ipAddress').optional().isIP(),
  body('port').optional().isInt({ min: 1, max: 65535 }),
  validateRequest,
  audit('device.update', 'attendance_devices'),
  asyncHandler(updateDevice)
);

router.delete('/:id',
  authorize('admin'),
  param('id').isUUID(),
  validateRequest,
  audit('device.delete', 'attendance_devices'),
  asyncHandler(deleteDevice)
);

router.post('/:id/connect', authorize('admin'), param('id').isUUID(), validateRequest, asyncHandler(connectDevice));
router.post('/:id/sync-users', authorize('admin'), param('id').isUUID(), validateRequest, asyncHandler(syncDeviceUsers));
router.post('/:id/sync-logs', authorize('admin'), param('id').isUUID(), validateRequest, asyncHandler(syncDeviceLogs));

module.exports = router;
