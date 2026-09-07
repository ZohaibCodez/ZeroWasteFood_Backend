const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const { authenticate } = require('../middleware/auth');
const { validate, updateProfileValidator } = require('../middleware/validation');
const c = require('../controllers/authController');

// Stricter rate limiting for auth endpoints to prevent brute force/scraping
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // Limit each IP to 20 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many authentication attempts, please try again later.' },
});

router.use(authLimiter);

router.get('/profile', authenticate, c.getProfile);
router.patch('/profile', authenticate, updateProfileValidator, validate, c.updateProfile);

module.exports = router;
