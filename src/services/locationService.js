const supabase = require('../config/supabase');
const { haversineDistance } = require('../utils/distance');

const DEFAULT_RADIUS = parseFloat(process.env.DEFAULT_RADIUS_KM) || 10;
const MAX_RADIUS = parseFloat(process.env.MAX_RADIUS_KM) || 50;

// Lazily expires stale 'available' listings before any read. Fail-open: if
// the RPC isn't installed yet (e.g. 0004 migration not applied), the caller
// gets the unfiltered list — the frontend already hides expired rows via
// `gt('expiry_time', now())`.
const expireStaleFood = async () => {
  try {
    await supabase.rpc('expire_stale_food');
  } catch {
    // ignore — RPC may not exist on cold projects
  }
};

// Find all NGOs within their preferred service radius of (lat, lng).
// Each NGO can set `service_radius_km`; falls back to DEFAULT_RADIUS.
exports.findNearbyNGOs = async (lat, lng, radiusKm = DEFAULT_RADIUS) => {
  const { data, error } = await supabase
    .from('users')
    .select('id, name, lat, lng, service_radius_km, verified')
    .eq('role', 'ngo')
    .not('lat', 'is', null)
    .not('lng', 'is', null);
  if (error) throw error;
  return (data || [])
    .map((ngo) => ({
      ...ngo,
      distance: haversineDistance(lat, lng, ngo.lat, ngo.lng),
      effectiveRadius: ngo.service_radius_km || radiusKm,
    }))
    .filter((ngo) => ngo.distance <= ngo.effectiveRadius)
    .sort((a, b) => a.distance - b.distance);
};

// Find available food within `radiusKm` of (lat, lng), sorted by distance.
// Clamped to MAX_RADIUS to keep the response sensible.
exports.findNearbyFood = async (lat, lng, radiusKm = DEFAULT_RADIUS) => {
  await expireStaleFood();

  const r = Math.min(Math.max(parseFloat(radiusKm) || DEFAULT_RADIUS, 0.1), MAX_RADIUS);

  const { data, error } = await supabase
    .from('food_listings')
    .select('*, restaurant:users!food_listings_restaurant_id_fkey(id, name, address, phone, avatar_url)')
    .eq('status', 'available')
    .gt('expiry_time', new Date().toISOString())
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || [])
    .map((f) => ({ ...f, distance: haversineDistance(lat, lng, f.lat, f.lng) }))
    .filter((f) => f.distance <= r)
    .sort((a, b) => a.distance - b.distance);
};

exports.expireStaleFood = expireStaleFood;
