const router = require('express').Router();
const { authenticate, requireRole } = require('../middleware/auth');
const {
  validate,
  createFoodValidator,
  idParamValidator,
  nearbyQueryValidator,
} = require('../middleware/validation');
const c = require('../controllers/foodController');

router.get('/', authenticate, c.listAvailable);
router.get('/mine', authenticate, requireRole('restaurant'), c.getMine);
router.get('/stats', authenticate, requireRole('restaurant'), c.getStats);
router.get('/nearby', authenticate, requireRole('ngo'), nearbyQueryValidator, validate, c.getNearby);
router.get('/:id', authenticate, idParamValidator, validate, c.getOne);

router.post(
  '/',
  authenticate,
  requireRole('restaurant'),
  createFoodValidator,
  validate,
  c.createFoodListing
);

router.patch(
  '/:id/accept',
  authenticate,
  requireRole('ngo'),
  idParamValidator,
  validate,
  c.acceptFoodListing
);

router.patch(
  '/:id/release',
  authenticate,
  requireRole('ngo'),
  idParamValidator,
  validate,
  c.releaseFoodListing
);

router.patch(
  '/:id/collect',
  authenticate,
  requireRole('ngo'),
  idParamValidator,
  validate,
  c.markCollected
);

router.delete(
  '/:id',
  authenticate,
  requireRole('restaurant'),
  idParamValidator,
  validate,
  c.cancelListing
);

module.exports = router;
