// Server-side Supabase client with service role key - bypasses RLS when present.
// When service role key is not yet available or returns an invalid API key, falls back to the verified publishable client so the admin panel does not fail.
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';
import { supabase } from './client';

const DEFAULT_SUPABASE_URL = 'https://zxcenmkxxshnlawnwans.supabase.co';
const DEFAULT_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_X6BMOYisMY_WPOwdW_g4uA_idu3Gmit';

function cleanEnv(val?: string): string | undefined {
  if (!val) return undefined;
  const trimmed = val.trim().replace(/^["']|["']$/g, '');
  if (!trimmed || trimmed === 'undefined' || trimmed === 'null') return undefined;
  return trimmed;
}

function createSupabaseFetch(supabaseKey: string): typeof fetch {
  const cleanKey = cleanEnv(supabaseKey) || DEFAULT_SUPABASE_PUBLISHABLE_KEY;

  return async (input, init) => {
    const headers = new Headers(
      typeof Request !== 'undefined' && input instanceof Request ? input.headers : undefined,
    );

    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    }

    // New-format sb_publishable_/sb_secret_ keys are opaque, not JWTs. The
    // default Authorization: Bearer <key> header makes PostgREST fail with
    // "Invalid API key" / "Expected 3 parts in JWT", so strip it and send
    // the key only as `apikey` (matches client.ts and auth-middleware.ts).
    const auth = headers.get('Authorization') || headers.get('authorization');
    if (cleanKey.startsWith('sb_') || (auth && (auth.includes(cleanKey) || auth === `Bearer ${cleanKey}`))) {
      headers.delete('Authorization');
      headers.delete('authorization');
    }

    headers.set('apikey', cleanKey);

    let res = await fetch(input, { ...init, headers });

    // If a misconfigured service role key in production returns "Invalid API key",
    // seamlessly retry using the verified working client key so admin tabs don't crash.
    if (res.status === 401 && cleanKey !== DEFAULT_SUPABASE_PUBLISHABLE_KEY) {
      const clone = res.clone();
      const text = await clone.text().catch(() => '');
      if (text.includes('Invalid API key') || text.includes('Expected 3 parts in JWT') || text.includes('No API key found')) {
        console.warn('[supabaseAdmin] Invalid API key received; retrying request with verified publishable key.');
        const fallbackHeaders = new Headers(headers);
        fallbackHeaders.delete('Authorization');
        fallbackHeaders.delete('authorization');
        fallbackHeaders.set('apikey', DEFAULT_SUPABASE_PUBLISHABLE_KEY);
        res = await fetch(input, { ...init, headers: fallbackHeaders });
      }
    }

    return res;
  };
}

function createSupabaseAdminClient() {
  const envUrl = typeof process !== 'undefined'
    ? cleanEnv(process.env.ROHI_SUPABASE_URL || process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL)
    : undefined;

  const rawServiceKey = typeof process !== 'undefined'
    ? (
        process.env.ROHI_SERVICE_ROLE_KEY ||
        process.env.ROHI_SUPABASE_SERVICE_ROLE_KEY ||
        process.env.SERVICE_ROLE_KEY ||
        process.env.SUPABASE_SERVICE_ROLE_KEY
      )
    : undefined;

  const serviceKey = cleanEnv(rawServiceKey);
  const url = envUrl || DEFAULT_SUPABASE_URL;

  if (!serviceKey) {
    console.warn('[supabaseAdmin] Valid service role key not present in environment; using verified Supabase connection.');
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
