const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { validate, createRatingValidator, idParamValidator } = require('../middleware/validation');
const c = require('../controllers/ratingController');

router.post('/', authenticate, createRatingValidator, validate, c.createRating);
router.get('/mine', authenticate, c.getMine);
router.get('/user/:id', authenticate, idParamValidator, validate, c.getForUser);

module.exports = router;
