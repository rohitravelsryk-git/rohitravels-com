// Server-side Supabase client with the service role key - bypasses RLS.
// The project URL is not a secret (see client.ts for why), so it falls back
// to Rohi's known project URL if the env var isn't set. The service-role
// key IS secret and never has a fallback: fails closed if it's missing.
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const KNOWN_SUPABASE_URL = 'https://zxcenmkxxshnlawnwans.supabase.co';

function cleanEnv(val?: string): string | undefined {
  if (!val) return undefined;
  const trimmed = val.trim().replace(/^["']|["']$/g, '');
  if (!trimmed || trimmed === 'undefined' || trimmed === 'null') return undefined;
  return trimmed;
}

function createSupabaseFetch(supabaseKey: string): typeof fetch {
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
    if (supabaseKey.startsWith('sb_') || (auth && (auth.includes(supabaseKey) || auth === `Bearer ${supabaseKey}`))) {
      headers.delete('Authorization');
      headers.delete('authorization');
    }

    headers.set('apikey', supabaseKey);

    return fetch(input, { ...init, headers });
  };
}

function createSupabaseAdminClient() {
  const url = (typeof process !== 'undefined'
    ? cleanEnv(process.env.ROHI_SUPABASE_URL || process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL)
    : undefined) || KNOWN_SUPABASE_URL;

  const rawServiceKey = typeof process !== 'undefined'
    ? (
        process.env.ROHI_SERVICE_ROLE_KEY ||
        process.env.ROHI_SUPABASE_SERVICE_ROLE_KEY ||
        process.env.SERVICE_ROLE_KEY ||
        process.env.SUPABASE_SERVICE_ROLE_KEY
      )
    : undefined;

  const serviceKey = cleanEnv(rawServiceKey);

  if (!serviceKey) {
    throw new Error('Supabase service-role client is not configured: missing SUPABASE_SERVICE_ROLE_KEY.');
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
