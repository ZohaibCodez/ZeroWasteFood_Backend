// Centralised JSON error handler. All controllers do `try { … } catch (e) { next(e); }`.

// Postgres / PostgREST error codes → HTTP mapping.
// Reference: https://www.postgresql.org/docs/current/errcodes-appendix.html
const PG_CODE_TO_HTTP = {
  '23505': 409, // unique_violation       → conflict
  '23503': 400, // foreign_key_violation  → bad request
  '23502': 400, // not_null_violation     → bad request
  '23514': 400, // check_violation        → bad request
  '23P01': 400, // exclusion_violation    → bad request
  '22P02': 400, // invalid_text_representation → bad request
  '42501': 403, // insufficient_privilege (RLS) → forbidden
  PGRST116: 404, // PostgREST: row not found
};

const statusFor = (err) => {
  if (err.statusCode) return err.statusCode;
  if (err.status) return err.status;
  if (err.code && PG_CODE_TO_HTTP[err.code]) return PG_CODE_TO_HTTP[err.code];
  return 500;
};

module.exports = function errorHandler(err, req, res, _next) {
  const isProd = process.env.NODE_ENV === 'production';
  const status = statusFor(err);

  // eslint-disable-next-line no-console
  console.error(
    `[${new Date().toISOString()}] ${req.method} ${req.originalUrl} → ${status}: ${err.message}${
      err.code ? ` (pg=${err.code})` : ''
    }`
  );

  res.status(status).json({
    success: false,
    error: isProd && status === 500 ? 'Internal server error' : err.message,
    ...(isProd ? {} : { stack: err.stack }),
  });
};
