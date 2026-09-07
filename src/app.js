const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const errorHandler = require('./middleware/errorHandler');
const authRoutes = require('./routes/authRoutes');
const foodRoutes = require('./routes/foodRoutes');
const ngoRoutes = require('./routes/ngoRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const ratingRoutes = require('./routes/ratingRoutes');
const uploadRoutes = require('./routes/uploadRoutes');

const app = express();

app.set('trust proxy', 1);

app.use(helmet());

// Build the allowed-origin list from FRONTEND_URL (comma-separated for multi-origin).
// Falls back to localhost so local dev works without any .env change.
const corsOrigins = (process.env.FRONTEND_URL || 'http://localhost:5173')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Server-to-server requests (no Origin header) and health checks: allow.
      if (!origin) return callback(null, true);
      // Wildcard or exact-match: allow.
      if (corsOrigins.includes('*') || corsOrigins.includes(origin)) return callback(null, true);
      // Unknown origin: block cleanly — do NOT call callback(new Error(...))
      // because that throws a 500. Return false to send a proper CORS 403.
      return callback(null, false);
    },
    credentials: true,
  })
);

app.use(express.json({ limit: '2mb' }));

app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: 'Too many requests, slow down.' },
  })
);

// Request logger — prints method, path, status, and duration for every request.
// This makes it easy to see exactly which API calls are hitting the server and
// whether they succeed or fail (critical for debugging dashboard loading issues).
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - start;
    const color = res.statusCode >= 500 ? '\x1b[31m' : res.statusCode >= 400 ? '\x1b[33m' : '\x1b[32m';
    console.log(`${color}[API] ${req.method} ${req.originalUrl} → ${res.statusCode} (${ms}ms)\x1b[0m`);
  });
  next();
});

// Health
app.get('/health', (req, res) =>
  res.json({ status: 'ok', service: 'zero-waste-backend', timestamp: new Date().toISOString() })
);

// API v1
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/food', foodRoutes);
app.use('/api/v1/ngo', ngoRoutes);
app.use('/api/v1/notifications', notificationRoutes);
app.use('/api/v1/ratings', ratingRoutes);
app.use('/api/v1/upload', uploadRoutes);

// 404 + error
app.use((req, res) =>
  res.status(404).json({ success: false, error: `Route ${req.method} ${req.originalUrl} not found` })
);
app.use(errorHandler);

module.exports = app;
