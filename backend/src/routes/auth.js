const { Router } = require('express');
const { body } = require('express-validator');
const { login, refresh, logout, me } = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const { validateRequest } = require('../middleware/errorHandler');

const router = Router();

router.post('/login',
  body('email').isEmail().normalizeEmail(),
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

module.exports = router;
