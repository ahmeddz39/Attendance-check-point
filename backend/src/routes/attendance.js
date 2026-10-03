const { Router } = require('express');
const { body } = require('express-validator');
const { authenticate, authorize } = require('../middleware/auth');
const { validateRequest } = require('../middleware/errorHandler');
const { asyncHandler } = require('../middleware/asyncHandler');
const {
  listLogs,
  createLog,
  listDailyAttendance,
  salarySummary,
  monthlyReport,
  employeeReport,
  attendanceTrend,
} = require('../controllers/attendanceController');

const router = Router();
router.use(authenticate);
router.use(authorize('admin', 'analyst'));

router.get('/logs', asyncHandler(listLogs));
router.get('/daily', asyncHandler(listDailyAttendance));
router.get('/salary', authorize('admin'), asyncHandler(salarySummary));
router.get('/reports/monthly', asyncHandler(monthlyReport));
router.get('/reports/trend', asyncHandler(attendanceTrend));
router.get('/reports/employees/:employeeId', asyncHandler(employeeReport));

router.post('/logs',
  body('deviceUserId').notEmpty(),
  body('eventTime').isISO8601(),
  validateRequest,
  asyncHandler(createLog)
);

module.exports = router;
