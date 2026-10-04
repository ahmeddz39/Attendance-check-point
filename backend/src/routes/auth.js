const { Router } = require('express');
const { body } = require('express-validator');
const rateLimit = require('express-rate-limit');
const { login, refresh, logout, me, changePassword } = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const { validateRequest } = require('../middleware/errorHandler');
const { asyncHandler } = require('../middleware/asyncHandler');
const { audit } = require('../middleware/audit');

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { message: 'Too many login attempts. Try again later.' } },
});

router.post('/login',
  loginLimiter,
  body('username').trim().notEmpty(),
  body('password').notEmpty(),
  validateRequest,
  login
);

router.post('/refresh',
  body('refreshToken').notEmpty(),
  validateRequest,
  refresh
);

router.post('/logout', logout);

router.get('/me', authenticate, me);

router.post('/change-password',
  authenticate,
  body('currentPassword').notEmpty(),
  body('newPassword').isLength({ min: 10 }),
  validateRequest,
  audit('user.change_password', 'users'),
  asyncHandler(changePassword)
);

module.exports = router;
