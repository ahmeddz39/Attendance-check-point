const { Router } = require('express');
const { body, param } = require('express-validator');
const { listUsers, getUser, createUser, updateUser, deleteUser } = require('../controllers/usersController');
const { authenticate, authorize } = require('../middleware/auth');
const { validateRequest } = require('../middleware/errorHandler');
const { audit } = require('../middleware/audit');

const router = Router();
router.use(authenticate);

router.get('/',
  authorize('admin', 'analyst'),
  listUsers
);

router.get('/:id',
  authorize('admin', 'analyst'),
  param('id').isUUID(),
  validateRequest,
  getUser
);

router.post('/',
  authorize('admin'),
  body('username').trim().isLength({ min: 3 }).matches(/^[a-zA-Z0-9_.-]+$/),
  body('password').isLength({ min: 10 }),
  body('roleId').isInt(),
  validateRequest,
  audit('user.create', 'users'),
  createUser
);

router.patch('/:id',
  authorize('admin'),
  param('id').isUUID(),
  body('password').optional({ values: 'falsy' }).isLength({ min: 10 }),
  validateRequest,
  audit('user.update', 'users'),
  updateUser
);

router.delete('/:id',
  authorize('admin'),
  param('id').isUUID(),
  validateRequest,
  audit('user.delete', 'users'),
  deleteUser
);

module.exports = router;
