const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { validate, subscribeValidator } = require('../middleware/validation');
const c = require('../controllers/notificationController');

router.get('/vapid-key', c.getVapidPublicKey);
router.post('/subscribe', authenticate, subscribeValidator, validate, c.subscribe);
router.delete('/unsubscribe', authenticate, c.unsubscribe);

module.exports = router;
