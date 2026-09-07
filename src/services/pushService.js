const webpush = require('web-push');
const supabase = require('../config/supabase');

const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_CONTACT_EMAIL } = process.env;

let pushConfigured = false;
if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    VAPID_CONTACT_EMAIL || 'mailto:noreply@zerowastefood.app',
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
  );
  pushConfigured = true;
} else {
  // eslint-disable-next-line no-console
  console.warn('[push] VAPID keys missing — push notifications disabled.');
}

// Notify a list of NGO users about a new food listing.
// Skips silently if push isn't configured; cleans up dead 410/404 endpoints.
exports.notifyNGOs = async (ngos, foodListing) => {
  if (!pushConfigured || !ngos?.length) return { sent: 0, removed: 0 };

  const userIds = ngos.map((n) => n.id);
  const { data: subs, error } = await supabase
    .from('push_subscriptions')
    .select('*')
    .in('user_id', userIds);
  if (error || !subs?.length) return { sent: 0, removed: 0 };

  const payload = JSON.stringify({
    title: '🍽️ New food nearby',
    body: `${foodListing.title} · ${foodListing.quantity} meals available`,
    url: '/ngo/browse',
    food_id: foodListing.id,
  });

  const removed = [];
  const results = await Promise.allSettled(
    subs.map((s) =>
      webpush.sendNotification(
        { endpoint: s.endpoint, keys: { auth: s.auth_key, p256dh: s.p256dh_key } },
        payload
      )
    )
  );

  results.forEach((r, i) => {
    if (r.status === 'rejected') {
      const code = r.reason?.statusCode;
      if (code === 410 || code === 404) removed.push(subs[i].endpoint);
    }
  });

  if (removed.length) {
    await supabase.from('push_subscriptions').delete().in('endpoint', removed);
  }

  const sent = results.filter((r) => r.status === 'fulfilled').length;
  return { sent, removed: removed.length };
};

exports.publicKey = VAPID_PUBLIC_KEY || null;
