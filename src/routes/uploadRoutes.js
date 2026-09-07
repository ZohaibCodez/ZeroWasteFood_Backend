const router = require('express').Router();
const { authenticate, requireRole } = require('../middleware/auth');
const { upload, handleUploadErrors } = require('../middleware/upload');
const c = require('../controllers/uploadController');

// Restaurants upload food photos.
// `upload.single('file')` parses multipart/form-data and places file in req.file.
// `handleUploadErrors` catches Multer's own errors so they don't bubble to the
// global error handler as 500s.
router.post(
  '/food-image',
  authenticate,
  requireRole('restaurant'),
  upload.single('file'),
  handleUploadErrors,
  c.uploadFoodImage
);

router.delete('/food-image', authenticate, requireRole('restaurant', 'admin'), c.deleteFoodImage);

module.exports = router;
