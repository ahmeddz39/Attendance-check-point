const path = require('path');
const { Router } = require('express');
const multer = require('multer');
const { authenticate, authorize } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/asyncHandler');
const { getSettings, updateSettings, uploadLogo, removeLogo } = require('../controllers/settingsController');

const storage = multer.diskStorage({
  destination: path.join(__dirname, '..', '..', 'uploads'),
  filename: (req, file, cb) => cb(null, `logo-${Date.now()}${path.extname(file.originalname)}`),
});

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => cb(null, file.mimetype.startsWith('image/')),
});

const router = Router();
router.use(authenticate);

router.get('/', authorize('admin', 'analyst'), asyncHandler(getSettings));
router.patch('/', authorize('admin'), asyncHandler(updateSettings));
router.post('/logo', authorize('admin'), upload.single('logo'), asyncHandler(uploadLogo));
router.delete('/logo', authorize('admin'), asyncHandler(removeLogo));

module.exports = router;
