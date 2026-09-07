const { body, param, query, validationResult } = require('express-validator');

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array().map((e) => ({ field: e.path, message: e.msg })),
    });
  }
  next();
};

const futureDate = (value) => {
  if (new Date(value) <= new Date()) throw new Error('Must be a future timestamp');
  return true;
};

// Reasonable bounding box for Pakistan (operating market) — keeps a typo
// from sending a restaurant to the Atlantic and silently breaking matching.
// Override with PK_BBOX=off to allow any coordinate.
const PK_BBOX = { latMin: 23.5, latMax: 37.5, lngMin: 60.5, lngMax: 77.5 };
const inBoundingBox = (value, { req, path }) => {
  if (process.env.PK_BBOX === 'off') return true;
  const lat = path === 'lat' ? parseFloat(value) : parseFloat(req.body.lat ?? req.query.lat);
  const lng = path === 'lng' ? parseFloat(value) : parseFloat(req.body.lng ?? req.query.lng);
  if (Number.isNaN(lat) || Number.isNaN(lng)) return true; // base validator catches this
  if (lat < PK_BBOX.latMin || lat > PK_BBOX.latMax || lng < PK_BBOX.lngMin || lng > PK_BBOX.lngMax) {
    throw new Error('Coordinates outside supported region');
  }
  return true;
};

// Only allow image URLs hosted on our Supabase Storage bucket — blocks
// arbitrary external image hosts being used as link previews (gap F16).
const SUPABASE_HOST = process.env.SUPABASE_URL
  ? new URL(process.env.SUPABASE_URL).host
  : null;
const allowedImageUrl = (value) => {
  if (!value) return true;
  try {
    const u = new URL(value);
    if (u.protocol !== 'https:') throw new Error('Image URL must use HTTPS');
    if (SUPABASE_HOST && u.host !== SUPABASE_HOST) {
      throw new Error('Image URL must be on the Supabase Storage host');
    }
    return true;
  } catch (e) {
    throw new Error(e.message || 'Invalid image URL');
  }
};

// ---- Profile ----
const updateProfileValidator = [
  body('name').optional().isString().trim().isLength({ min: 2, max: 120 }),
  body('phone').optional().isString().trim().isLength({ max: 32 }),
  body('address').optional().isString().trim().isLength({ max: 300 }),
  body('lat').optional({ nullable: true }).isFloat({ min: -90, max: 90 }).custom(inBoundingBox),
  body('lng').optional({ nullable: true }).isFloat({ min: -180, max: 180 }).custom(inBoundingBox),
  body('about').optional().isString().isLength({ max: 1000 }),
  body('avatar_url').optional().isURL(),
  body('service_radius_km').optional({ nullable: true }).isFloat({ min: 0.5, max: 100 }),
];

// ---- Food ----
const createFoodValidator = [
  body('title').notEmpty().withMessage('Title is required').isLength({ max: 200 }),
  body('description').optional().isString().isLength({ max: 2000 }),
  body('quantity').isInt({ min: 1, max: 10_000 }).withMessage('Quantity must be ≥1'),
  body('food_type').optional().isIn(['vegetarian', 'non-vegetarian', 'vegan']),
  body('expiry_time').isISO8601().withMessage('Invalid timestamp').custom(futureDate),
  body('lat').isFloat({ min: -90, max: 90 }).withMessage('Invalid latitude').custom(inBoundingBox),
  body('lng').isFloat({ min: -180, max: 180 }).withMessage('Invalid longitude').custom(inBoundingBox),
  body('pickup_notes').optional().isString().isLength({ max: 500 }),
  body('image_url').optional().custom(allowedImageUrl),
];

const idParamValidator = [param('id').isUUID().withMessage('Invalid id')];

const nearbyQueryValidator = [
  query('lat').isFloat({ min: -90, max: 90 }),
  query('lng').isFloat({ min: -180, max: 180 }),
  query('radius').optional().isFloat({ min: 0.1, max: 100 }),
];

// ---- Push ----
const subscribeValidator = [
  body('endpoint').isURL().withMessage('Invalid endpoint'),
  body('keys.auth').isString().notEmpty(),
  body('keys.p256dh').isString().notEmpty(),
];

// ---- Rating ----
const createRatingValidator = [
  body('food_id').isUUID(),
  body('ratee_id').isUUID(),
  body('stars').isInt({ min: 1, max: 5 }),
  body('comment').optional().isString().isLength({ max: 2000 }),
  body('tags').optional().isArray(),
  body('is_public').optional().isBoolean(),
];

module.exports = {
  validate,
  updateProfileValidator,
  createFoodValidator,
  idParamValidator,
  nearbyQueryValidator,
  subscribeValidator,
  createRatingValidator,
};
