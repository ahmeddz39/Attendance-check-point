const fs = require('fs');
const path = require('path');
const { query } = require('../config/database');
const { success } = require('../utils/response');

const SETTINGS_FIELDS = `
  shift_start::text AS shift_start, shift_end::text AS shift_end, grace_minutes,
  overtime_daily_threshold_hours, overtime_multiplier,
  company_name, logo_path, updated_at
`;

const withLogoUrl = (row) => row && ({
  ...row,
  logo_url: row.logo_path ? `/uploads/${row.logo_path}` : null,
});

const getSettings = async (req, res) => {
  const { rows } = await query(`SELECT ${SETTINGS_FIELDS} FROM company_settings WHERE id = 1`);
  return success(res, withLogoUrl(rows[0]));
};

const updateSettings = async (req, res) => {
  // Shift/overtime fields are shared with analysts (the "Shift & Holidays" tab);
  // company_name is only ever shown on the admin-only General tab, so an
  // analyst's request silently can't touch it even if crafted by hand.
  const { shiftStart, shiftEnd, graceMinutes, overtimeDailyThresholdHours, overtimeMultiplier } = req.body;
  const companyName = req.user.role === 'admin' ? req.body.companyName : undefined;

  const { rows } = await query(`
    UPDATE company_settings SET
      shift_start = COALESCE($1, shift_start),
      shift_end = COALESCE($2, shift_end),
      grace_minutes = COALESCE($3, grace_minutes),
      overtime_daily_threshold_hours = COALESCE($4, overtime_daily_threshold_hours),
      overtime_multiplier = COALESCE($5, overtime_multiplier),
      company_name = COALESCE($6, company_name),
      updated_at = NOW()
    WHERE id = 1
    RETURNING ${SETTINGS_FIELDS}
  `, [shiftStart, shiftEnd, graceMinutes, overtimeDailyThresholdHours, overtimeMultiplier, companyName]);

  return success(res, withLogoUrl(rows[0]));
};

const uploadsDir = path.join(__dirname, '..', '..', 'uploads');

const uploadLogo = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, error: { message: 'No file uploaded' } });
  }

  const { rows: existing } = await query('SELECT logo_path FROM company_settings WHERE id = 1');
  const previous = existing[0]?.logo_path;

  const { rows } = await query(`
    UPDATE company_settings SET logo_path = $1, updated_at = NOW()
    WHERE id = 1
    RETURNING ${SETTINGS_FIELDS}
  `, [req.file.filename]);

  if (previous && previous !== req.file.filename) {
    fs.unlink(path.join(uploadsDir, previous), () => {});
  }

  return success(res, withLogoUrl(rows[0]));
};

const removeLogo = async (req, res) => {
  const { rows: existing } = await query('SELECT logo_path FROM company_settings WHERE id = 1');
  const previous = existing[0]?.logo_path;

  const { rows } = await query(`
    UPDATE company_settings SET logo_path = NULL, updated_at = NOW()
    WHERE id = 1
    RETURNING ${SETTINGS_FIELDS}
  `);

  if (previous) {
    fs.unlink(path.join(uploadsDir, previous), () => {});
  }

  return success(res, withLogoUrl(rows[0]));
};

module.exports = { getSettings, updateSettings, uploadLogo, removeLogo };
