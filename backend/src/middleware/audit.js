const { query } = require('../config/database');

const audit = (action, resource) => async (req, res, next) => {
  // Run audit log write after response is sent
  res.on('finish', async () => {
    try {
      if (res.statusCode >= 400) return; // Don't log failed requests
      await query(
        `INSERT INTO audit_logs (user_id, action, resource, resource_id, metadata, ip_address)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          req.user?.id || null,
          action,
          resource,
          req.params?.id || null,
          JSON.stringify({ method: req.method, path: req.path, body: req.auditBody }),
          req.ip,
        ]
      );
    } catch (err) {
      console.warn('Audit log write failed:', err.message);
    }
  });
  next();
};

module.exports = { audit };
