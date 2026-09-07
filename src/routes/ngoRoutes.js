const router = require('express').Router();
const { authenticate, requireRole } = require('../middleware/auth');
const c = require('../controllers/ngoController');

router.get('/requests', authenticate, requireRole('ngo'), c.getRequests);
router.get('/stats', authenticate, requireRole('ngo'), c.getStats);

module.exports = router;
