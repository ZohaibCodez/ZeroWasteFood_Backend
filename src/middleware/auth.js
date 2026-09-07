const supabase = require('../config/supabase');

const authenticate = async (req, res, next) => {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) {
      console.warn('[auth] Request rejected: no Bearer token on', req.method, req.originalUrl);
      return res.status(401).json({ success: false, error: 'No auth token' });
    }

    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      console.warn('[auth] Token invalid/expired on', req.method, req.originalUrl, '—', error?.message || 'no user');
      return res.status(401).json({ success: false, error: 'Invalid or expired token' });
    }

    // Load role from public.users — authoritative source.
    // Use maybeSingle() instead of single() so a missing row returns
    // { data: null, error: null } rather than throwing PGRST116, which
    // previously caused a noisy 500-logged error for a routine "no profile" case.
    const { data: profile, error: profileErr } = await supabase
      .from('users')
      .select('id, email, role, name, lat, lng, address, phone, avatar_url, verified')
      .eq('id', user.id)
      .maybeSingle();

    if (profileErr || !profile) {
      console.error('[auth] Profile not found for user', user.id, 'on', req.method, req.originalUrl, '—', profileErr?.message || 'no row in public.users');
      return res.status(401).json({ success: false, error: 'Profile not found — please sign out and sign in again.' });
    }

    req.user = { ...user, ...profile };
    next();
  } catch (err) {
    next(err);
  }
};

const requireRole = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      error: `Forbidden — requires role: ${roles.join(' or ')}`,
    });
  }
  next();
};

module.exports = { authenticate, requireRole };
