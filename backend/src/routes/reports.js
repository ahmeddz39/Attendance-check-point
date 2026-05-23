const { Router } = require('express');
const { param } = require('express-validator');
const { listReports, getReport, createReport, updateReport, deleteReport } = require('../controllers/reportsController');
const { authenticate, authorize } = require('../middleware/auth');
const { validateRequest } = require('../middleware/errorHandler');
const { audit } = require('../middleware/audit');

const router = Router();
router.use(authenticate);

router.get('/',    authorize('admin', 'analyst', 'viewer'), listReports);
router.post('/',   authorize('admin', 'analyst'), audit('report.create', 'reports'), createReport);
router.get('/:id',    param('id').isUUID(), validateRequest, getReport);
router.patch('/:id',  authorize('admin', 'analyst'), param('id').isUUID(), validateRequest, audit('report.update', 'reports'), updateReport);
router.delete('/:id', authorize('admin', 'analyst'), param('id').isUUID(), validateRequest, audit('report.delete', 'reports'), deleteReport);

module.exports = router;
