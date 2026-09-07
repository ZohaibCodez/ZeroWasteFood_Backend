require('dotenv').config();

const REQUIRED_ENV = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
const missing = REQUIRED_ENV.filter((k) => !process.env[k]);
if (missing.length) {
  console.error(`[server] Missing required environment variables: ${missing.join(', ')}`);
  process.exit(1);
}

const app = require('./src/app');
const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`[server] zero-waste-backend listening on :${PORT} (${process.env.NODE_ENV || 'development'})`);
});

// FIX: Increase Keep-Alive timeouts to prevent Railway load balancer from dropping connections
server.keepAliveTimeout = 65000;
server.headersTimeout = 66000;

const shutdown = (signal) => {
  console.log(`[server] received ${signal}, closing gracefully…`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 5000).unref();
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
