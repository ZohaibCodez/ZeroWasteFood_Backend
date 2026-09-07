const supabase = require('../config/supabase');
const pushService = require('../services/pushService');

// GET /api/notifications/vapid-key
exports.getVapidPublicKey = (req, res) => {
  res.json({ success: true, data: { publicKey: pushService.publicKey } });
};

// POST /api/notifications/subscribe
exports.subscribe = async (req, res, next) => {
  try {
    const user_id = req.user.id;
    const { endpoint, keys, user_agent } = req.body;

    const { data, error } = await supabase
      .from('push_subscriptions')
      .upsert(
        {
          user_id,
          endpoint,
          auth_key: keys.auth,
          p256dh_key: keys.p256dh,
          user_agent: user_agent || req.get('user-agent') || null,
        },
        { onConflict: 'endpoint' }
      )
      .select()
      .single();
    if (error) throw error;

    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/notifications/unsubscribe?endpoint=
exports.unsubscribe = async (req, res, next) => {
  try {
    const user_id = req.user.id;
    const { endpoint } = req.query;
    let q = supabase.from('push_subscriptions').delete().eq('user_id', user_id);
    if (endpoint) q = q.eq('endpoint', endpoint);
    const { error } = await q;
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};
