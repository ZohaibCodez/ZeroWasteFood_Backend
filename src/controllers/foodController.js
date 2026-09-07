const supabase = require('../config/supabase');
const locationService = require('../services/locationService');
const pushService = require('../services/pushService');

const RESTAURANT_SELECT =
  '*, restaurant:users!food_listings_restaurant_id_fkey(id, name, address, phone, avatar_url)';

// POST /api/food — restaurant creates a listing, NGOs in radius get notified.
// Returns `notifiedNgoCount` so the UI can show real reach (gap F14).
exports.createFoodListing = async (req, res, next) => {
  try {
    const restaurant_id = req.user.id;
    const {
      title,
      description = null,
      quantity,
      food_type = null,
      expiry_time,
      lat,
      lng,
      pickup_notes = null,
      image_url = null,
    } = req.body;

    const { data, error } = await supabase
      .from('food_listings')
      .insert([
        {
          restaurant_id,
          title,
          description,
          quantity,
          food_type,
          expiry_time,
          lat,
          lng,
          pickup_notes,
          image_url,
          status: 'available',
        },
      ])
      .select(RESTAURANT_SELECT)
      .single();
    if (error) throw error;

    // Resolve nearby NGOs first so we can report a real count; then push.
    let notifiedNgoCount = 0;
    try {
      const ngos = await locationService.findNearbyNGOs(lat, lng);
      notifiedNgoCount = ngos.length;
      // Push is fire-and-forget so the request returns quickly.
      pushService
        .notifyNGOs(ngos, data)
        .catch((e) => console.warn('[push] notify failed:', e.message));
    } catch (e) {
      console.warn('[location] findNearbyNGOs failed:', e.message);
    }

    res.status(201).json({ success: true, data: { ...data, notifiedNgoCount } });
  } catch (err) {
    next(err);
  }
};

// GET /api/food — all available, not expired
exports.listAvailable = async (req, res, next) => {
  try {
    await locationService.expireStaleFood();
    const { data, error } = await supabase
      .from('food_listings')
      .select(RESTAURANT_SELECT)
      .eq('status', 'available')
      .gt('expiry_time', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

// GET /api/food/nearby?lat=&lng=&radius=
exports.getNearby = async (req, res, next) => {
  try {
    const lat = parseFloat(req.query.lat);
    const lng = parseFloat(req.query.lng);
    const radius = req.query.radius ? parseFloat(req.query.radius) : undefined;
    const data = await locationService.findNearbyFood(lat, lng, radius);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

// GET /api/food/mine — restaurant's own listings (with accepting NGO when applicable)
exports.getMine = async (req, res, next) => {
  try {
    await locationService.expireStaleFood();
    const { data, error } = await supabase
      .from('food_listings')
      .select(
        `*, requests(ngo_id, status, accepted_at, picked_up_at, ngo:users!requests_ngo_id_fkey(id, name, phone, avatar_url))`
      )
      .eq('restaurant_id', req.user.id)
      .order('created_at', { ascending: false });
    if (error) throw error;

    // Flatten — surface the most-recent accepted request as `acceptedBy`,
    // and keep accepted_at / picked_up_at separately so the UI timeline
    // shows the real moments instead of falling back to updated_at (gap U5).
    const enriched = (data || []).map((l) => {
      const r = (l.requests || []).find((x) => x.status === 'accepted' || x.status === 'picked_up');
      return {
        ...l,
        acceptedBy: r?.ngo || null,
        acceptedAt: r?.accepted_at || null,
        pickedUpAt: r?.picked_up_at || null,
      };
    });
    res.json({ success: true, data: enriched });
  } catch (err) {
    next(err);
  }
};

// GET /api/food/:id — single listing detail
exports.getOne = async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('food_listings')
      .select(RESTAURANT_SELECT)
      .eq('id', req.params.id)
      .maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ success: false, error: 'Listing not found' });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/food/:id/accept — NGO claims (atomic: only succeeds if still available).
// Verified NGOs only (gap F6).
exports.acceptFoodListing = async (req, res, next) => {
  try {
    const { id } = req.params;
    const ngo_id = req.user.id;

    // Gate on verification — admin queue exists for a reason.
    const { data: ngo, error: ngoErr } = await supabase
      .from('users')
      .select('verified')
      .eq('id', ngo_id)
      .single();
    if (ngoErr) throw ngoErr;
    if (!ngo?.verified) {
      return res.status(403).json({
        success: false,
        error: 'Your NGO account is pending verification by an administrator.',
      });
    }

    const { data, error } = await supabase
      .from('food_listings')
      .update({ status: 'accepted' })
      .eq('id', id)
      .eq('status', 'available')
      .gt('expiry_time', new Date().toISOString())
      .select(RESTAURANT_SELECT)
      .maybeSingle();
    if (error) throw error;

    if (!data) {
      return res
        .status(409)
        .json({ success: false, error: 'Listing no longer available' });
    }

    const { error: reqErr } = await supabase.from('requests').upsert(
      [{ food_id: id, ngo_id, status: 'accepted', accepted_at: new Date().toISOString() }],
      { onConflict: 'food_id,ngo_id' }
    );
    if (reqErr && reqErr.code !== '23505') throw reqErr;

    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/food/:id/release — NGO releases an accepted listing back to the
// pool so other NGOs can claim it (gap F3). Calls the SECURITY DEFINER RPC
// installed by migration 0004; falls back to a manual two-step on cold DBs.
exports.releaseFoodListing = async (req, res, next) => {
  try {
    const { id } = req.params;
    const ngo_id = req.user.id;

    // Preferred path — atomic RPC validates ownership + state.
    const rpc = await supabase.rpc('release_food_listing', { p_food_id: id });

    if (!rpc.error) {
      return res.json({ success: true, data: rpc.data });
    }

    // RPC missing (migration not applied yet) — degrade gracefully.
    if (rpc.error.code !== '42883' && rpc.error.code !== 'PGRST202') {
      // Real failure (permissions, race, etc.) — surface mapped status.
      if (rpc.error.code === '42501') {
        return res.status(403).json({ success: false, error: 'You did not accept this listing' });
      }
      if (rpc.error.code === '40001') {
        return res.status(409).json({ success: false, error: 'Listing can no longer be released' });
      }
      throw rpc.error;
    }

    // Fallback path
    const { data: reqRow, error: reqErr } = await supabase
      .from('requests')
      .select('id')
      .eq('food_id', id)
      .eq('ngo_id', ngo_id)
      .eq('status', 'accepted')
      .maybeSingle();
    if (reqErr) throw reqErr;
    if (!reqRow) {
      return res.status(403).json({ success: false, error: 'You did not accept this listing' });
    }

    const { data, error } = await supabase
      .from('food_listings')
      .update({ status: 'available' })
      .eq('id', id)
      .eq('status', 'accepted')
      .gt('expiry_time', new Date().toISOString())
      .select(RESTAURANT_SELECT)
      .maybeSingle();
    if (error) throw error;
    if (!data) {
      return res.status(409).json({ success: false, error: 'Listing can no longer be released' });
    }

    await supabase.from('requests').update({ status: 'cancelled' }).eq('id', reqRow.id);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/food/:id/collect — NGO confirms pickup
exports.markCollected = async (req, res, next) => {
  try {
    const { id } = req.params;
    const ngo_id = req.user.id;

    // Only the NGO who accepted may mark collected.
    const { data: reqRow, error: reqErr } = await supabase
      .from('requests')
      .select('id')
      .eq('food_id', id)
      .eq('ngo_id', ngo_id)
      .eq('status', 'accepted')
      .maybeSingle();
    if (reqErr) throw reqErr;
    if (!reqRow)
      return res
        .status(403)
        .json({ success: false, error: 'You did not accept this listing' });

    const { data, error } = await supabase
      .from('food_listings')
      .update({ status: 'collected' })
      .eq('id', id)
      .eq('status', 'accepted')
      .select(RESTAURANT_SELECT)
      .maybeSingle();
    if (error) throw error;
    if (!data)
      return res
        .status(409)
        .json({ success: false, error: 'Listing is not in accepted state' });

    await supabase
      .from('requests')
      .update({ status: 'picked_up', picked_up_at: new Date().toISOString() })
      .eq('id', reqRow.id);

    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/food/:id — restaurant cancels their own listing.
// A DB trigger (cascade_cancel_requests) marks the accepting NGO's request
// as 'cancelled' too, so it disappears from their pickup list (gap F2). On
// cold DBs without the migration, we mirror the update from the app side.
exports.cancelListing = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabase
      .from('food_listings')
      .update({ status: 'cancelled' })
      .eq('id', id)
      .eq('restaurant_id', req.user.id)
      .in('status', ['available', 'accepted'])
      .select()
      .maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ success: false, error: 'Cannot cancel' });

    // Belt-and-braces: ensure dependent requests row is cancelled even if
    // the 0004 trigger isn't installed.
    await supabase
      .from('requests')
      .update({ status: 'cancelled' })
      .eq('food_id', id)
      .eq('status', 'accepted');

    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

// GET /api/food/stats — restaurant dashboard KPIs
exports.getStats = async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('food_listings')
      .select('status, quantity')
      .eq('restaurant_id', req.user.id);
    if (error) throw error;

    const init = { available: 0, accepted: 0, collected: 0, expired: 0, cancelled: 0, mealsDonated: 0 };
    const stats = (data || []).reduce((acc, r) => {
      if (acc[r.status] !== undefined) acc[r.status]++;
      if (r.status === 'collected') acc.mealsDonated += r.quantity || 0;
      return acc;
    }, init);
    res.json({ success: true, data: stats });
  } catch (err) {
    next(err);
  }
};
