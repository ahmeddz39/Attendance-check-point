const { Router } = require('express');
const { body, query } = require('express-validator');
const { getMetrics, getSummary, ingestMetric } = require('../controllers/analyticsController');
const { authenticate, authorize } = require('../middleware/auth');
const { validateRequest } = require('../middleware/errorHandler');

const router = Router();
router.use(authenticate);

router.get('/metrics',
  authorize('admin', 'analyst', 'viewer'),
  getMetrics
);

router.get('/summary',
  authorize('admin', 'analyst', 'viewer'),
  getSummary
);

router.post('/metrics',
  authorize('admin', 'analyst'),
  body('name').notEmpty().isString(),
  body('value').isNumeric(),
  validateRequest,
  ingestMetric
);

module.exports = router;
