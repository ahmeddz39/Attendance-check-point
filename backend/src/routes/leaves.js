const { Router } = require('express');
const { body, param, query: queryValidator } = require('express-validator');
const {
  listLeaves, getEmployeeBalance, createLeave, updateLeave, deleteLeave,
} = require('../controllers/leavesController');
const { authenticate, authorize } = require('../middleware/auth');
const { validateRequest } = require('../middleware/errorHandler');
const { asyncHandler } = require('../middleware/asyncHandler');
const { audit } = require('../middleware/audit');

const router = Router();
router.use(authenticate);
router.use(authorize('admin', 'analyst'));

router.get('/',
  queryValidator('employeeId').optional().isUUID(),
  queryValidator('status').optional().isIn(['scheduled', 'cancelled']),
  validateRequest,
  asyncHandler(listLeaves)
);

router.get('/balance/:employeeId',
  param('employeeId').isUUID(),
  validateRequest,
  asyncHandler(getEmployeeBalance)
);

router.post('/',
  body('employeeId').isUUID(),
  body('startDate').isISO8601(),
  body('endDate').isISO8601(),
  body('coveringEmployeeId').optional({ nullable: true }).isUUID(),
  body('notes').optional({ nullable: true }).isString(),
  validateRequest,
  audit('leave.create', 'leaves'),
  asyncHandler(createLeave)
);

router.patch('/:id',
  param('id').isUUID(),
  body('startDate').optional().isISO8601(),
  body('endDate').optional().isISO8601(),
  body('coveringEmployeeId').optional({ nullable: true }).isUUID(),
  body('status').optional().isIn(['scheduled', 'cancelled']),
  validateRequest,
  audit('leave.update', 'leaves'),
  asyncHandler(updateLeave)
);

router.delete('/:id',
  authorize('admin'),
  param('id').isUUID(),
  validateRequest,
  audit('leave.delete', 'leaves'),
  asyncHandler(deleteLeave)
);

module.exports = router;
