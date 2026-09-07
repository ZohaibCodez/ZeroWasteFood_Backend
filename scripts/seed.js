#!/usr/bin/env node
/**
 * seed.js — idempotent demo data for Zero-Waste Food Connect.
 *
 * Creates 3 restaurants + 3 NGOs + 1 admin + ~10 food listings across all statuses,
 * a few accepted/collected requests, and a few ratings — enough to exercise every UI surface.
 *
 * Re-running this script is safe: it upserts auth users by email, and all
 * domain rows are upserted by deterministic UUID.
 *
 * Usage:
 *   npm run seed              # full seed
 *   npm run seed -- --wipe    # wipe demo data first, then seed
 */
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const log = {
  step: (m) => console.log('\n\x1b[1m\x1b[36m▸ ' + m + '\x1b[0m'),
  ok: (m) => console.log('  \x1b[32m✓\x1b[0m', m),
  warn: (m) => console.log('  \x1b[33m!\x1b[0m', m),
  fail: (m) => console.log('  \x1b[31m✗\x1b[0m', m),
};

// =============================================================================
// DEMO ACCOUNTS — shown on the login page Test Credentials badge
// =============================================================================
const PASSWORD = 'Demo1234!'; // shared password for all demo accounts

const ACCOUNTS = [
  // RESTAURANTS — 3 different cuisines / areas in Lahore
  {
    email: 'restaurant@demo.zwfc.app',
    name: 'Spice Garden Restaurant',
    role: 'restaurant',
    address: 'MM Alam Road, Gulberg III, Lahore',
    lat: 31.5158, lng: 74.3526,
    phone: '+92 300 1234567',
    about: 'Family-run restaurant serving traditional Pakistani cuisine. Surplus usually at 10pm closing.',
    verified: true,
    primary: true, // shown first in test creds UI
  },
  {
    email: 'restaurant2@demo.zwfc.app',
    name: 'Green Bites Café',
    role: 'restaurant',
    address: 'DHA Phase 5, Block H, Lahore',
    lat: 31.4807, lng: 74.4111,
    phone: '+92 321 9876543',
    about: 'Healthy vegetarian café with daily salad/bowl surplus.',
    verified: true,
  },
  {
    email: 'restaurant3@demo.zwfc.app',
    name: 'Pizza Plaza Lahore',
    role: 'restaurant',
    address: 'Johar Town, Block C, Lahore',
    lat: 31.4683, lng: 74.2784,
    phone: '+92 333 5550101',
    about: 'Pizza & pasta — surplus dough and pizzas after dinner rush.',
    verified: true,
  },
  // NGOs — 3 different verified NGOs across the city
  {
    email: 'ngo@demo.zwfc.app',
    name: 'Helping Hands Foundation',
    role: 'ngo',
    address: 'Faisal Town, Block B, Lahore',
    lat: 31.4837, lng: 74.3050,
    phone: '+92 321 7654321',
    about: 'Distributing meals to ~400 people/week across Faisal Town and surrounding areas.',
    verified: true,
    primary: true,
  },
  {
    email: 'ngo2@demo.zwfc.app',
    name: 'Edhi Foundation Lahore',
    role: 'ngo',
    address: 'Cantt, Lahore',
    lat: 31.5497, lng: 74.3636,
    phone: '+92 300 1111000',
    about: 'Pakistan\'s largest welfare network. Citywide food distribution.',
    verified: true,
  },
  {
    email: 'ngo3@demo.zwfc.app',
    name: 'Saylani Welfare Trust',
    role: 'ngo',
    address: 'Allama Iqbal Town, Lahore',
    lat: 31.5050, lng: 74.2933,
    phone: '+92 321 4444555',
    about: 'Free meals program (Dastarkhwan) — accepts large surplus drops.',
    verified: false, // pending in admin queue — demonstrates moderation
  },
  // ADMIN
  {
    email: 'admin@demo.zwfc.app',
    name: 'Platform Admin',
    role: 'admin',
    address: 'Admin Office, Lahore',
    lat: 31.5204, lng: 74.3587,
    phone: '+92 300 0000000',
    verified: true,
    primary: true,
  },
];

// =============================================================================
// FOOD LISTINGS — deterministic UUIDs so re-seeding upserts cleanly
// =============================================================================
const HOUR = 60 * 60 * 1000;
const now = Date.now();
const inHours = (h) => new Date(now + h * HOUR).toISOString();
const hoursAgo = (h) => new Date(now - h * HOUR).toISOString();

const LISTINGS = [
  // Spice Garden — mix of statuses
  {
    id: 'aaaaaaaa-0001-4000-8000-000000000001',
    owner: 'restaurant@demo.zwfc.app',
    title: 'Biryani & Chicken Karahi',
    description: 'Freshly cooked chicken biryani and karahi. Sealed in food-grade containers.',
    quantity: 25,
    food_type: 'non-vegetarian',
    expiry_in_hours: 24,
    status: 'available',
    pickup_notes: 'Use side entrance — staff will hand it over.',
  },
  {
    id: 'aaaaaaaa-0001-4000-8000-000000000002',
    owner: 'restaurant@demo.zwfc.app',
    title: 'Dal Chawal (mixed)',
    description: 'Yellow daal and basmati rice. Hot at pickup.',
    quantity: 15,
    food_type: 'vegetarian',
    expiry_in_hours: 20,
    status: 'accepted', // → request created below
    acceptedBy: 'ngo@demo.zwfc.app',
    pickup_notes: 'Bring sealed containers.',
  },
  {
    id: 'aaaaaaaa-0001-4000-8000-000000000003',
    owner: 'restaurant@demo.zwfc.app',
    title: 'Mixed Sabzi',
    description: 'Aloo gobi + bhindi + chickpea curry.',
    quantity: 8,
    food_type: 'vegetarian',
    expiry_in_hours: 18,
    status: 'available',
  },
  {
    id: 'aaaaaaaa-0001-4000-8000-000000000004',
    owner: 'restaurant@demo.zwfc.app',
    title: 'Roti & Naan',
    description: 'Fresh bread — naan and tandoori roti.',
    quantity: 40,
    food_type: 'vegetarian',
    expiry_in_hours: -24, // collected yesterday
    status: 'collected',
    acceptedBy: 'ngo2@demo.zwfc.app',
    acceptedHoursAgo: 25,
    pickedUpHoursAgo: 24,
    rating: { stars: 5, comment: 'Excellent partnership — well-packed and on time.', tags: ['On-time pickup', 'Hygienic packing'] },
  },
  // Green Bites — vegetarian / vegan
  {
    id: 'aaaaaaaa-0002-4000-8000-000000000005',
    owner: 'restaurant2@demo.zwfc.app',
    title: 'Salad bowls (vegan)',
    description: 'Mixed greens, quinoa, chickpeas. Dressing on the side.',
    quantity: 12,
    food_type: 'vegan',
    expiry_in_hours: 22,
    status: 'available',
  },
  {
    id: 'aaaaaaaa-0002-4000-8000-000000000006',
    owner: 'restaurant2@demo.zwfc.app',
    title: 'Vegetable wraps',
    description: 'Spinach, paneer, hummus wraps. Best within 2h.',
    quantity: 18,
    food_type: 'vegetarian',
    expiry_in_hours: -48,
    status: 'collected',
    acceptedBy: 'ngo@demo.zwfc.app',
    acceptedHoursAgo: 50,
    pickedUpHoursAgo: 48,
    rating: { stars: 4, comment: 'Punctual and friendly team.', tags: ['Friendly staff'] },
  },
  // Pizza Plaza — non-veg surplus
  {
    id: 'aaaaaaaa-0003-4000-8000-000000000007',
    owner: 'restaurant3@demo.zwfc.app',
    title: 'Pepperoni & Margherita pizzas',
    description: 'Whole pizzas, 12 inch. Hot.',
    quantity: 8,
    food_type: 'non-vegetarian',
    expiry_in_hours: 16,
    status: 'available',
  },
  {
    id: 'aaaaaaaa-0003-4000-8000-000000000008',
    owner: 'restaurant3@demo.zwfc.app',
    title: 'Garlic bread sticks',
    description: 'Bulk garlic bread from tonight\'s dinner service.',
    quantity: 30,
    food_type: 'vegetarian',
    expiry_in_hours: -3, // expired - no one accepted
    status: 'expired',
  },
];

// =============================================================================
// RUNNER
// =============================================================================
(async () => {
  console.log('\nZero-Waste Food Connect — Database Seeder\n');

  // --- preflight ---
  log.step('Preflight: verifying schema');
  for (const t of ['users', 'food_listings', 'requests', 'ratings']) {
    const { error } = await supabase.from(t).select('id').limit(1);
    if (error) {
      log.fail(`Table public.${t} not accessible: ${error.message}`);
      console.log('\n→ Apply migrations first (supabase/APPLY_ALL.sql) then re-run.\n');
      process.exit(1);
    }
  }
  log.ok('All 4 core tables accessible');

  // --- optional wipe ---
  if (process.argv.includes('--wipe')) {
    log.step('Wiping existing demo data');
    const demoEmails = ACCOUNTS.map((a) => a.email);
    const { data: existing } = await supabase.from('users').select('id, email').in('email', demoEmails);
    if (existing?.length) {
      const ids = existing.map((u) => u.id);
      await supabase.from('ratings').delete().or(`rater_id.in.(${ids.join(',')}),ratee_id.in.(${ids.join(',')})`);
      await supabase.from('requests').delete().in('ngo_id', ids);
      await supabase.from('food_listings').delete().in('restaurant_id', ids);
      // Delete auth users (cascade nukes public.users via FK)
      for (const u of existing) {
        await supabase.auth.admin.deleteUser(u.id).catch(() => {});
      }
      log.ok(`Wiped ${existing.length} demo users + their data`);
    } else {
      log.ok('Nothing to wipe');
    }
  }

  // --- 1. Create / refresh users via auth admin ---
  log.step('Seeding users (auth + profile)');
  const emailToId = new Map();
  for (const acc of ACCOUNTS) {
    // Try to create. If email exists, look up.
    const { data: created, error: cErr } = await supabase.auth.admin.createUser({
      email: acc.email,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: {
        name: acc.name,
        role: acc.role,
        address: acc.address,
        lat: String(acc.lat),
        lng: String(acc.lng),
        phone: acc.phone,
      },
    });

    let id = created?.user?.id;

    if (cErr) {
      if (/already (been )?registered/i.test(cErr.message) || cErr.code === 'email_exists') {
        // Look up existing by listing all and finding email match (paginated)
        let page = 1, found = null;
        while (!found) {
          const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
          if (error || !data.users.length) break;
          found = data.users.find((u) => u.email === acc.email);
          if (data.users.length < 1000) break;
          page++;
        }
        if (!found) { log.fail(`Could not find existing ${acc.email}`); continue; }
        id = found.id;
        // Refresh password so it always matches PASSWORD
        await supabase.auth.admin.updateUserById(id, { password: PASSWORD, email_confirm: true });
        log.ok(`refreshed ${acc.email}`);
      } else {
        log.fail(`${acc.email}: ${cErr.message}`);
        continue;
      }
    } else {
      log.ok(`created ${acc.email}`);
    }

    // Upsert public.users row with all fields (trigger may have inserted minimal version)
    const { error: upErr } = await supabase
      .from('users')
      .upsert(
        {
          id,
          email: acc.email,
          role: acc.role,
          name: acc.name,
          address: acc.address,
          lat: acc.lat,
          lng: acc.lng,
          phone: acc.phone,
          about: acc.about || null,
          verified: !!acc.verified,
        },
        { onConflict: 'id' }
      );
    if (upErr) log.fail(`profile upsert ${acc.email}: ${upErr.message}`);

    emailToId.set(acc.email, id);
  }
  log.ok(`Total users seeded: ${emailToId.size}`);

  // --- 2. Food listings ---
  log.step('Seeding food listings');
  const listingRows = LISTINGS.map((l) => ({
    id: l.id,
    restaurant_id: emailToId.get(l.owner),
    title: l.title,
    description: l.description,
    quantity: l.quantity,
    food_type: l.food_type,
    expiry_time: inHours(l.expiry_in_hours),
    status: l.status,
    lat: ACCOUNTS.find((a) => a.email === l.owner).lat,
    lng: ACCOUNTS.find((a) => a.email === l.owner).lng,
    pickup_notes: l.pickup_notes || null,
  }));
  const { error: lErr } = await supabase.from('food_listings').upsert(listingRows, { onConflict: 'id' });
  if (lErr) { log.fail(lErr.message); process.exit(1); }
  log.ok(`${listingRows.length} listings upserted`);

  // --- 3. Requests (acceptances) ---
  log.step('Seeding requests');
  const requestRows = LISTINGS.filter((l) => l.acceptedBy).map((l) => ({
    food_id: l.id,
    ngo_id: emailToId.get(l.acceptedBy),
    status: l.status === 'collected' ? 'picked_up' : 'accepted',
    accepted_at: l.acceptedHoursAgo != null ? hoursAgo(l.acceptedHoursAgo) : new Date().toISOString(),
    picked_up_at: l.pickedUpHoursAgo != null ? hoursAgo(l.pickedUpHoursAgo) : null,
  }));
  const { error: rErr } = await supabase.from('requests').upsert(requestRows, { onConflict: 'food_id,ngo_id' });
  if (rErr) log.fail(rErr.message);
  else log.ok(`${requestRows.length} requests upserted`);

  // --- 4. Ratings ---
  log.step('Seeding ratings');
  const ratingRows = LISTINGS.filter((l) => l.rating).map((l) => ({
    food_id: l.id,
    rater_id: emailToId.get(l.acceptedBy), // NGO rates the restaurant
    ratee_id: emailToId.get(l.owner),
    stars: l.rating.stars,
    comment: l.rating.comment,
    tags: l.rating.tags,
    is_public: true,
  }));
  const { error: ratErr } = await supabase.from('ratings').upsert(ratingRows, { onConflict: 'food_id,rater_id' });
  if (ratErr) log.fail(ratErr.message);
  else log.ok(`${ratingRows.length} ratings upserted`);

  // --- Summary ---
  console.log('\n\x1b[1m\x1b[32m✓ Seed complete\x1b[0m\n');
  console.log('Test credentials (all use password \x1b[1m' + PASSWORD + '\x1b[0m):');
  for (const acc of ACCOUNTS) {
    const tag = acc.primary ? ' \x1b[33m(primary)\x1b[0m' : '';
    console.log(`  • ${acc.role.padEnd(10)} ${acc.email}${tag}`);
  }
  console.log('');
})().catch((e) => { console.error('\n', e); process.exit(1); });
