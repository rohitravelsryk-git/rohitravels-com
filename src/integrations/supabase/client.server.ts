// Server-side Supabase client with service role key - bypasses RLS.
// Admin/server data must never silently fall back to a publishable key.
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

function createSupabaseFetch(supabaseKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== 'undefined' && input instanceof Request ? input.headers : undefined,
    );

    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    }

    headers.set('apikey', supabaseKey);
    return fetch(input, { ...init, headers });
  };
}

const DEFAULT_SUPABASE_URL = 'https://zxcenmkxxshnlawnwans.supabase.co';

function createSupabaseAdminClient() {
  const envUrl = typeof process !== 'undefined'
    ? (process.env.ROHI_SUPABASE_URL || process.env.SUPABASE_URL)
    : undefined;

  const serviceKey = typeof process !== 'undefined'
    ? (
        process.env.ROHI_SERVICE_ROLE_KEY ||
        process.env.ROHI_SUPABASE_SERVICE_ROLE_KEY ||
        process.env.SERVICE_ROLE_KEY ||
        process.env.SUPABASE_SERVICE_ROLE_KEY
      )
    : undefined;

  const url = envUrl || DEFAULT_SUPABASE_URL;

  // Never use a publishable/anon key for admin/server data. A silent fallback
  // here makes every admin page appear empty when the deployment secret is
  // missing because RLS correctly hides the production rows.
  if (!serviceKey) {
    throw new Error(
      'Server Supabase service-role key is not configured. Set ROHI_SERVICE_ROLE_KEY (preferred) or SUPABASE_SERVICE_ROLE_KEY in the production server environment.'
    );
  }

  return createClient<Database>(url, serviceKey, {
    global: {
      fetch: createSupabaseFetch(serviceKey),
    },
    auth: {
      storage: undefined,
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

let _supabaseAdmin: ReturnType<typeof createSupabaseAdminClient> | undefined;

export const supabaseAdmin = new Proxy({} as ReturnType<typeof createSupabaseAdminClient>, {
  get(_, prop, receiver) {
    if (!_supabaseAdmin) _supabaseAdmin = createSupabaseAdminClient();
    return Reflect.get(_supabaseAdmin, prop, receiver);
  },
});
