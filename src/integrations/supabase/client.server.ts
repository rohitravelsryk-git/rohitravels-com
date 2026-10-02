// Server-side Supabase client with service role key - bypasses RLS.
// Production deployment trigger to sync ROHI_SERVICE_ROLE_KEY & ROHI_SESSION_SECRET runtime secrets.
// Use this for admin operations in server functions and server routes only.
// For user-authenticated queries (with RLS), use the auth middleware instead.
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

function isNewSupabaseApiKey(value: string): boolean {
  return value.startsWith('sb_publishable_') || value.startsWith('sb_secret_');
}

function createSupabaseFetch(supabaseKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== 'undefined' && input instanceof Request ? input.headers : undefined,
    );

    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    }

    // New Supabase API keys are opaque strings, not bearer JWTs.
    const authHeader = headers.get('Authorization');
    if (isNewSupabaseApiKey(supabaseKey) && authHeader && authHeader.startsWith('Bearer sb_')) {
      headers.delete('Authorization');
    }

    headers.set('apikey', supabaseKey);
    return fetch(input, { ...init, headers });
  };
}

const DEFAULT_SUPABASE_URL = 'https://zxcenmkxxshnlawnwans.supabase.co';
const DEFAULT_SUPABASE_KEY = 'sb_publishable_X6BMOYisMY_WPOwdW_g4uA_idu3Gmit';

function createSupabaseAdminClient() {
  const envUrl = typeof process !== 'undefined' ? (process.env.ROHI_SUPABASE_URL || process.env.SUPABASE_URL) : undefined;
  const envServiceKey = typeof process !== 'undefined' ? (
    process.env.ROHI_SERVICE_ROLE_KEY || 
    process.env.ROHI_SUPABASE_SERVICE_ROLE_KEY || 
    process.env.SERVICE_ROLE_KEY || 
    process.env.SUPABASE_SERVICE_ROLE_KEY
  ) : undefined;
  const envPubKey = typeof process !== 'undefined' ? (process.env.ROHI_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY) : undefined;

  const url = envUrl || DEFAULT_SUPABASE_URL;
  const key = envServiceKey || envPubKey || DEFAULT_SUPABASE_KEY;

  return createClient<Database>(url, key, {
    global: {
      fetch: createSupabaseFetch(key),
    },
    auth: {
      storage: undefined,
      persistSession: false,
      autoRefreshToken: false,
    }
  });
}

let _supabaseAdmin: ReturnType<typeof createSupabaseAdminClient> | undefined;

export const supabaseAdmin = new Proxy({} as ReturnType<typeof createSupabaseAdminClient>, {
  get(_, prop, receiver) {
    if (!_supabaseAdmin) _supabaseAdmin = createSupabaseAdminClient();
    return Reflect.get(_supabaseAdmin, prop, receiver);
  },
});
