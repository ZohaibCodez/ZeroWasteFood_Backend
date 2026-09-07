const supabase = require('../config/supabase');

// GET /api/auth/profile — current user's full profile
exports.getProfile = async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', req.user.id)
      .single();
    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/auth/profile — update editable profile fields
exports.updateProfile = async (req, res, next) => {
  try {
    const allowed = ['name', 'phone', 'address', 'lat', 'lng', 'about', 'avatar_url'];
    const update = {};
    for (const k of allowed) if (req.body[k] !== undefined) update[k] = req.body[k];

    const { data, error } = await supabase
      .from('users')
      .update(update)
      .eq('id', req.user.id)
      .select()
      .single();
    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};
