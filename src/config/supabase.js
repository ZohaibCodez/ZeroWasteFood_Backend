const { createClient } = require('@supabase/supabase-js');
const ws = require('ws');

const url = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  // eslint-disable-next-line no-console
  console.warn(
    '[supabase] SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing — DB calls will fail.'
  );
}

// Admin client — bypasses RLS. NEVER expose this key to the browser.
// Pass the `ws` package as the WebSocket transport so this works on
// Node.js 20 which has no native globalThis.WebSocket.
const supabase = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
  realtime: { transport: ws },
});

module.exports = supabase;
