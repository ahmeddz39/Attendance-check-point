const { validationResult } = require('express-validator');
const { badRequest, serverError } = require('../utils/response');

// express-validator result handler — call after validators in route
const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return badRequest(res, 'Validation failed', errors.array());
  }
  next();
};

// Global error handler (register last in app)
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  console.error(`[${new Date().toISOString()}] ${err.stack}`);

  // Postgres unique violation
  if (err.code === '23505') {
    return badRequest(res, 'A record with that value already exists.');
  }
  // Postgres foreign key violation
  if (err.code === '23503') {
    return badRequest(res, 'Referenced resource does not exist.');
  }

  return serverError(res, err.message || 'Internal server error');
};

module.exports = { validateRequest, errorHandler };
