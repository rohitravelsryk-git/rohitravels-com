// Server-side Supabase client with the service role key - bypasses RLS.
// The project URL is not a secret (see client.ts for why), so it falls back
// to Rohi's known project URL if the env var isn't set. The service-role
// key IS secret and never has a fallback: fails closed if it's missing.
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const KNOWN_SUPABASE_URL = 'https://zxcenmkxxshnlawnwans.supabase.co';

function projectRef(url: string): string | null {
  return url.match(/^https?:\/\/([a-z0-9]+)\.supabase\.co/i)?.[1] ?? null;
}

// Legacy JWT keys name the project they belong to; a key for another project is always rejected.
function keyRef(key: string): string | null {
  const parts = key.split('.');
  if (parts.length !== 3) return null;
  try {
    return JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'))).ref ?? null;
  } catch {
    return null;
  }
}

function cleanEnv(val?: string): string | undefined {
  if (!val) return undefined;
  const trimmed = val.trim().replace(/^["']|["']$/g, '');
  if (!trimmed || trimmed === 'undefined' || trimmed === 'null') return undefined;
  return trimmed;
}

// A key that authenticates as `anon` instead of `service_role` only ever shows up
// as "permission denied for table accounts_book_accounts" on a financial page, with
// no hint that the configured credential is the wrong type. Say so once, clearly.
function keyRoleIfIdentifiable(key: string): string | null {
  if (key.startsWith('sb_publishable')) return 'anon (publishable)';
  const parts = key.split('.');
  // Legacy service-role keys are JWTs that carry their role in the payload.
  if (parts.length !== 3) return null;
  try {
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    return payload.role === 'service_role' ? null : `role "${payload.role ?? 'unknown'}"`;
  } catch {
    return null;
  }
}

function createSupabaseFetch(supabaseKey: string): typeof fetch {
  return async (input, init) => {
    const headers = new Headers(
      typeof Request !== 'undefined' && input instanceof Request ? input.headers : undefined,
    );

    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    }

    // New Supabase sb_secret_ keys authenticate through the apikey header.
    // Do not send the opaque secret as Authorization: Bearer <key>; PostgREST
    // expects Authorization to contain a JWT. Legacy service_role JWTs must
    // keep their Authorization header so they retain the service_role role.
    if (supabaseKey.startsWith('sb_secret_')) {
      headers.delete('Authorization');
      headers.delete('authorization');
    }
    headers.set('apikey', supabaseKey);

    return fetch(input, { ...init, headers });
  };
}

function createSupabaseAdminClient() {
  // The active Lovable Cloud project's URL comes from the environment.
  let rawUrl = (typeof process !== 'undefined'
    ? cleanEnv(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || process.env.ROHI_SUPABASE_URL)
    : undefined) || KNOWN_SUPABASE_URL;
  const url = rawUrl.includes('jqanltwhgdmckrlltdnh') ? KNOWN_SUPABASE_URL : rawUrl;
  const urlRef = projectRef(url);

  const SERVICE_KEY_VARS = [
    'ROHI_SERVICE_ROLE_KEY',
    'ROHI_SUPABASE_SERVICE_ROLE_KEY',
    'ROHI_SUPABASE_SECRET_KEY',
    'SERVICE_ROLE_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'SUPABASE_SERVICE_KEY',
    'SUPABASE_SECRET_KEY',
  ] as const;
  const candidates: { name: string; key: string }[] = [];
  for (const name of SERVICE_KEY_VARS) {
    const found = typeof process !== 'undefined' ? cleanEnv(process.env[name]) : undefined;
    if (found) candidates.push({ name, key: found });
  }
  // A deploy can end up holding both a stale publishable key and the real
  // service-role key under different names; picking the first one that merely
  // exists would then authenticate every admin read as `anon`.
  const matchesProject = (key: string) => {
    const ref = keyRef(key);
    return !ref || !urlRef || ref === urlRef;
  };
  // Skip stale keys left over from an older project: they are rejected as "Invalid API key".
  const chosen =
    candidates.find((c) => keyRoleIfIdentifiable(c.key) === null && matchesProject(c.key)) ??
    candidates.find((c) => keyRoleIfIdentifiable(c.key) === null) ??
    candidates[0];

  if (!chosen) {
    throw new Error(`Supabase service-role client is not configured: ${SERVICE_KEY_VARS.join(' / ')} are all unset.`);
  }

  const { key: serviceKey, name: serviceKeyVar } = chosen;
  const wrongRole = keyRoleIfIdentifiable(serviceKey);
  if (wrongRole) {
    throw new Error(
      `Supabase service-role client is misconfigured: ${serviceKeyVar} holds a ${wrongRole} key, so the admin and financial tables reject it. Set it to the secret service-role key from Supabase > Project Settings > API Keys (starts with sb_secret_, or a legacy JWT whose role is service_role).`,
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
