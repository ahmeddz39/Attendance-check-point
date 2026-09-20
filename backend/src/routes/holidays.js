const { Router } = require('express');
const { param, body } = require('express-validator');
const { authenticate, authorize } = require('../middleware/auth');
const { validateRequest } = require('../middleware/errorHandler');
const { asyncHandler } = require('../middleware/asyncHandler');
const { listHolidays, createHoliday, deleteHoliday } = require('../controllers/holidaysController');

const router = Router();
router.use(authenticate);
router.use(authorize('admin', 'analyst'));

router.get('/', asyncHandler(listHolidays));

router.post('/',
  body('date').isISO8601(),
  body('name').notEmpty().isString(),
  validateRequest,
  asyncHandler(createHoliday)
);

router.delete('/:id',
  param('id').isUUID(),
  validateRequest,
  asyncHandler(deleteHoliday)
);

module.exports = router;
