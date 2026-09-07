// Multer config — keeps files in RAM (Buffer) so we can pipe them straight
// to Supabase Storage without touching the local filesystem.
const multer = require('multer');

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB — matches the bucket file_size_limit
const ALLOWED_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp']);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIMES.has(file.mimetype)) cb(null, true);
    else cb(new Error('Only JPG, PNG or WebP images are allowed'), false);
  },
});

// Translate multer errors into the same { success: false, error } envelope
// the rest of the API uses. Fits in front of any multer middleware.
const handleUploadErrors = (err, _req, res, next) => {
  if (!err) return next();
  if (err instanceof multer.MulterError) {
    const map = {
      LIMIT_FILE_SIZE: { status: 413, msg: `Image too large (max ${MAX_BYTES / 1024 / 1024} MB)` },
      LIMIT_FILE_COUNT: { status: 400, msg: 'Only one file at a time' },
      LIMIT_UNEXPECTED_FILE: { status: 400, msg: 'Wrong field name — use "file"' },
    };
    const m = map[err.code] || { status: 400, msg: err.message };
    return res.status(m.status).json({ success: false, error: m.msg });
  }
  return res.status(400).json({ success: false, error: err.message });
};

module.exports = { upload, handleUploadErrors, MAX_BYTES, ALLOWED_MIMES };
