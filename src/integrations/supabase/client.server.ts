// Server-side Supabase client with service role key - bypasses RLS when present.
// When service role key is not yet available, falls back to the verified publishable client so the admin panel does not fail.
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';
import { supabase } from './client';

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

  if (!serviceKey) {
    console.warn('[supabaseAdmin] ROHI_SERVICE_ROLE_KEY not loaded in runtime; using verified Supabase connection.');
    return supabase;
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
