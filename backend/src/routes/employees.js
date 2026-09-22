const { Router } = require('express');
const { body, param } = require('express-validator');
const { authenticate, authorize } = require('../middleware/auth');
const { validateRequest } = require('../middleware/errorHandler');
const { asyncHandler } = require('../middleware/asyncHandler');
const { audit } = require('../middleware/audit');
const {
  listEmployees, createEmployee, updateEmployee, deleteEmployee,
  getEmployeeShifts, updateEmployeeShifts,
} = require('../controllers/employeesController');

const router = Router();
router.use(authenticate);
router.use(authorize('admin', 'analyst'));

router.get('/', asyncHandler(listEmployees));

router.post('/',
  body('employeeCode').notEmpty(),
  body('firstName').notEmpty(),
  body('salaryType').optional().isIn(['hourly', 'monthly']),
  body('leaveBalanceAdjustment').optional().isFloat(),
  validateRequest,
  audit('employee.create', 'employees'),
  asyncHandler(createEmployee)
);

router.patch('/:id',
  param('id').isUUID(),
  body('salaryType').optional().isIn(['hourly', 'monthly']),
  body('leaveBalanceAdjustment').optional().isFloat(),
  validateRequest,
  audit('employee.update', 'employees'),
  asyncHandler(updateEmployee)
);

router.delete('/:id',
  param('id').isUUID(),
  validateRequest,
  audit('employee.delete', 'employees'),
  asyncHandler(deleteEmployee)
);

router.get('/:id/shifts', param('id').isUUID(), validateRequest, asyncHandler(getEmployeeShifts));

router.put('/:id/shifts',
  param('id').isUUID(),
  validateRequest,
  audit('employee.shifts.update', 'employees'),
  asyncHandler(updateEmployeeShifts)
);

module.exports = router;
