const { Router } = require('express');
const { body, query: queryValidator } = require('express-validator');
const {
  listJustifications, upsertJustification, deleteJustification,
} = require('../controllers/absenceJustificationsController');
const { authenticate, authorize } = require('../middleware/auth');
const { validateRequest } = require('../middleware/errorHandler');
const { asyncHandler } = require('../middleware/asyncHandler');
const { audit } = require('../middleware/audit');

const router = Router();
router.use(authenticate);
router.use(authorize('admin', 'analyst'));

router.get('/',
  queryValidator('employeeId').optional().isUUID(),
  validateRequest,
  asyncHandler(listJustifications)
);

router.put('/',
  body('employeeId').isUUID(),
  body('date').isISO8601(),
  body('reason').isIn(['sick', 'unjustified']),
  body('paid').isBoolean(),
  body('notes').optional({ nullable: true }).isString(),
  validateRequest,
  audit('absence.justify', 'absence_justifications'),
  asyncHandler(upsertJustification)
);

router.delete('/',
  authorize('admin'),
  queryValidator('employeeId').isUUID(),
  queryValidator('date').isISO8601(),
  validateRequest,
  audit('absence.unjustify', 'absence_justifications'),
  asyncHandler(deleteJustification)
);

module.exports = router;
