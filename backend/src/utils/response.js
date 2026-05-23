const success = (res, data, statusCode = 200, meta = {}) =>
  res.status(statusCode).json({ success: true, data, ...meta });

const created = (res, data) => success(res, data, 201);

const noContent = (res) => res.status(204).send();

const error = (res, message, statusCode = 500, details = null) =>
  res.status(statusCode).json({
    success: false,
    error: { message, ...(details && { details }) },
  });

const badRequest    = (res, message, details) => error(res, message, 400, details);
const unauthorized  = (res, message = 'Unauthorized')  => error(res, message, 401);
const forbidden     = (res, message = 'Forbidden')     => error(res, message, 403);
const notFound      = (res, message = 'Not found')     => error(res, message, 404);
const conflict      = (res, message)                   => error(res, message, 409);
const serverError   = (res, message = 'Internal server error') => error(res, message, 500);

module.exports = {
  success, created, noContent,
  error, badRequest, unauthorized, forbidden, notFound, conflict, serverError,
};
