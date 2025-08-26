// Lightweight loader for Supabase config + client
// - Fetches /api/config (no-store)
// - Initializes supabase-js v2 (ESM from esm.sh)

let supabasePromise = null;

export async function getSupabase() {
  if (supabasePromise) return supabasePromise;
  supabasePromise = (async () => {
    const cfgRes = await fetch('/api/config', { cache: 'no-store' });
    if (!cfgRes.ok) throw new Error('Cannot load /api/config');
    const { SUPABASE_URL, SUPABASE_ANON_KEY } = await cfgRes.json();
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) throw new Error('Missing Supabase env');

    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        autoRefreshToken: true,
        detectSessionInUrl: true,
        persistSession: true,
      },
      global: {
        fetch: (url, options={}) => {
          const o = { ...options, cache: 'no-store' };
          return fetch(url, o);
        }
      }
    });
    return client;
  })();
  return supabasePromise;
}