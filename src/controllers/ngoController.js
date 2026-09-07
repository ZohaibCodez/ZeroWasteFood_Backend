const supabase = require('../config/supabase');

// GET /api/ngo/requests — full pickup history for the current NGO
exports.getRequests = async (req, res, next) => {
  try {
    const ngo_id = req.user.id;
    const { data, error } = await supabase
      .from('requests')
      .select(
        `id, status, accepted_at, picked_up_at, notes,
         food:food_listings(*, restaurant:users!food_listings_restaurant_id_fkey(id, name, address, phone, avatar_url))`
      )
      .eq('ngo_id', ngo_id)
      .order('accepted_at', { ascending: false });
    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

// GET /api/ngo/stats — quick dashboard KPIs
exports.getStats = async (req, res, next) => {
  try {
    const ngo_id = req.user.id;
    const { data, error } = await supabase
      .from('requests')
      .select('status, food:food_listings(quantity)')
      .eq('ngo_id', ngo_id);
    if (error) throw error;

    const init = { accepted: 0, picked_up: 0, cancelled: 0, mealsRescued: 0 };
    const stats = (data || []).reduce((acc, r) => {
      if (acc[r.status] !== undefined) acc[r.status]++;
      if (r.status === 'picked_up') acc.mealsRescued += r.food?.quantity || 0;
      return acc;
    }, init);
    res.json({ success: true, data: stats });
  } catch (err) {
    next(err);
  }
};
