const supabase = require('../config/supabase');

// POST /api/ratings — submit a rating after a pickup
exports.createRating = async (req, res, next) => {
  try {
    const rater_id = req.user.id;
    const { food_id, ratee_id, stars, comment, tags, is_public = true } = req.body;

    const { data, error } = await supabase
      .from('ratings')
      .insert([{ food_id, rater_id, ratee_id, stars, comment, tags, is_public }])
      .select()
      .single();
    if (error) {
      if (error.code === '23505')
        return res.status(409).json({ success: false, error: 'Already rated' });
      throw error;
    }
    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

// GET /api/ratings/user/:id — public ratings + aggregate for a user
exports.getForUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabase
      .from('ratings')
      .select(`*, rater:users!ratings_rater_id_fkey(id, name, avatar_url)`)
      .eq('ratee_id', id)
      .eq('is_public', true)
      .order('created_at', { ascending: false });
    if (error) throw error;

    const total = data.length;
    const avg =
      total === 0 ? 0 : data.reduce((s, r) => s + r.stars, 0) / total;
    const breakdown = [5, 4, 3, 2, 1].reduce((acc, n) => {
      acc[n] = data.filter((r) => r.stars === n).length;
      return acc;
    }, {});

    res.json({ success: true, data: { ratings: data, total, avg: Number(avg.toFixed(2)), breakdown } });
  } catch (err) {
    next(err);
  }
};

// GET /api/ratings/mine — ratings I've given (so UI can dedupe "already rated")
exports.getMine = async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('ratings')
      .select('food_id, stars, created_at')
      .eq('rater_id', req.user.id);
    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};
