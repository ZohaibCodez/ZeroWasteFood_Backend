const crypto = require('crypto');
const path = require('path');
const supabase = require('../config/supabase');

const BUCKET = 'food-images';

// Map mime → safe file extension (avoid trusting the original filename)
const EXT_FOR = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

// POST /api/upload/food-image — multer puts the file in req.file
exports.uploadFoodImage = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded (field name must be "file")' });
    }

    const ext = EXT_FOR[req.file.mimetype] || path.extname(req.file.originalname).slice(1) || 'jpg';
    const filename = `${req.user.id}/${crypto.randomUUID()}.${ext}`;

    const { error: upErr } = await supabase.storage.from(BUCKET).upload(filename, req.file.buffer, {
      contentType: req.file.mimetype,
      cacheControl: '3600',
      upsert: false,
    });
    if (upErr) {
      // Surface a useful message for common errors
      const msg = /exceed.*size/i.test(upErr.message)
        ? 'File too large for bucket'
        : /mime/i.test(upErr.message)
        ? 'File type rejected by storage'
        : upErr.message;
      return res.status(500).json({ success: false, error: msg });
    }

    const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(filename);

    res.status(201).json({
      success: true,
      data: {
        url: publicUrl,
        path: filename,
        size: req.file.size,
        type: req.file.mimetype,
      },
    });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/upload/food-image — remove a previously-uploaded image
// Accepts { path } in body. Only the owning user (folder-prefix match) can delete.
exports.deleteFoodImage = async (req, res, next) => {
  try {
    const { path: objectPath } = req.body || {};
    if (!objectPath || typeof objectPath !== 'string') {
      return res.status(400).json({ success: false, error: 'Missing "path"' });
    }
    const ownerPrefix = `${req.user.id}/`;
    if (!objectPath.startsWith(ownerPrefix) && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Not your image' });
    }
    const { error } = await supabase.storage.from(BUCKET).remove([objectPath]);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};
