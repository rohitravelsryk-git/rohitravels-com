import { useSession } from "@tanstack/react-start/server";

const GOOGLE_AUTH = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN = "https://oauth2.googleapis.com/token";
const GOOGLE_SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets";
const GOOGLE_EMAIL_SCOPE = "https://www.googleapis.com/auth/userinfo.email";

type AdminSession = { unlocked?: boolean; staffUsername?: string | null; googleSheetsOauthState?: string };

function sessionConfig() {
  const password = process.env.SESSION_SECRET;
  if (!password) throw new Error("Server misconfigured: SESSION_SECRET is not set");
  return { password, name: "rohi-admin", maxAge: 60 * 60 * 24 * 365, cookie: { httpOnly: true, secure: true, sameSite: "none" as const, path: "/" } };
}

async function requireAdminSession() {
  const session = await useSession<AdminSession>(sessionConfig());
  if (!session.data.unlocked || session.data.staffUsername) throw new Error("Forbidden: admin role required");
  return session;
}

function oauthConfig() {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) throw new Error("Google OAuth is not configured. Set GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET and GOOGLE_OAUTH_REDIRECT_URI.");
  return { clientId, clientSecret, redirectUri };
}

function b64(bytes: Uint8Array) { let s = ""; for (const b of bytes) s += String.fromCharCode(b); return btoa(s); }
function keyBytes() {
  const raw = process.env.GOOGLE_OAUTH_TOKEN_ENCRYPTION_KEY;
  if (!raw) throw new Error("GOOGLE_OAUTH_TOKEN_ENCRYPTION_KEY is not configured");
  const bytes = Uint8Array.from(atob(raw), (c) => c.charCodeAt(0));
  if (bytes.byteLength !== 32) throw new Error("GOOGLE_OAUTH_TOKEN_ENCRYPTION_KEY must be base64 for exactly 32 bytes");
  return bytes;
}

async function encryptRefreshToken(value: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await crypto.subtle.importKey("raw", keyBytes(), "AES-GCM", false, ["encrypt"]);
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(value)));
  return `${b64(iv)}.${b64(ciphertext)}`;
}

async function decryptRefreshToken(value: string) {
  const [iv64, data64] = value.split(".");
  if (!iv64 || !data64) throw new Error("Stored Google OAuth token is invalid");
  const iv = Uint8Array.from(atob(iv64), (c) => c.charCodeAt(0));
  const data = Uint8Array.from(atob(data64), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey("raw", keyBytes(), "AES-GCM", false, ["decrypt"]);
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, data);
  return new TextDecoder().decode(plain);
}

async function adminDb() { const { supabaseAdmin } = await import("@/integrations/supabase/client.server"); return supabaseAdmin; }

export async function beginGoogleSheetsOAuth() {
  const session = await requireAdminSession();
  const { clientId, redirectUri } = oauthConfig();
  const state = crypto.randomUUID();
  await session.update({ googleSheetsOauthState: state });
  const url = new URL(GOOGLE_AUTH);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("scope", [GOOGLE_SHEETS_SCOPE, GOOGLE_EMAIL_SCOPE].join(" "));
  url.searchParams.set("state", state);
  return url.toString();
}

export async function completeGoogleSheetsOAuth(code: string, state: string) {
  const session = await requireAdminSession();
  if (!session.data.googleSheetsOauthState || session.data.googleSheetsOauthState !== state) throw new Error("Invalid Google OAuth state");
  await session.update({ googleSheetsOauthState: undefined });
  const { clientId, clientSecret, redirectUri } = oauthConfig();
  const tokenResponse = await fetch(GOOGLE_TOKEN, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: "authorization_code" }) });
  const token = await tokenResponse.json() as { access_token?: string; refresh_token?: string; error?: string; error_description?: string };
  if (!tokenResponse.ok || !token.refresh_token) throw new Error(token.error_description || token.error || "Google did not return a refresh token. Re-authorize with offline access.");
  const profileResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", { headers: { authorization: `Bearer ${token.access_token}` } });
  const profile = await profileResponse.json() as { email?: string };
  const allowedEmail = process.env.GOOGLE_SHEETS_ALLOWED_EMAIL?.trim().toLowerCase();
  const email = profile.email?.trim().toLowerCase();
  if (!email) throw new Error("Google did not return the authorized account email");
  if (allowedEmail && email !== allowedEmail) throw new Error(`Google account ${email} is not allowed for this integration`);
  const refreshToken = await encryptRefreshToken(token.refresh_token);
  const supabaseAdmin = await adminDb();
  const spreadsheetId = process.env.ROHI_GOOGLE_SHEETS_SPREADSHEET_ID?.trim() || null;
  const { error } = await (supabaseAdmin as unknown as import("@supabase/supabase-js").SupabaseClient).from("google_sheets_oauth_connections").upsert({ id: "default", google_email: email, refresh_token_ciphertext: refreshToken, spreadsheet_id: spreadsheetId, updated_at: new Date().toISOString() }, { onConflict: "id" });
  if (error) throw new Error(`Could not save Google connection: ${error.message}`);
  return { email, spreadsheetId };
}

export async function getGoogleSheetsOAuthStatus() {
  await requireAdminSession();
  const supabaseAdmin = await adminDb();
  const { data, error } = await (supabaseAdmin as unknown as import("@supabase/supabase-js").SupabaseClient).from("google_sheets_oauth_connections").select("google_email, spreadsheet_id, updated_at").eq("id", "default").maybeSingle();
  if (error) throw new Error(`Google connection status failed: ${error.message}`);
  return { configured: Boolean(process.env.GOOGLE_OAUTH_CLIENT_ID && process.env.GOOGLE_OAUTH_CLIENT_SECRET && process.env.GOOGLE_OAUTH_REDIRECT_URI && process.env.GOOGLE_OAUTH_TOKEN_ENCRYPTION_KEY), connected: Boolean(data?.google_email), email: data?.google_email ?? null, spreadsheetId: data?.spreadsheet_id ?? process.env.ROHI_GOOGLE_SHEETS_SPREADSHEET_ID ?? null, updatedAt: data?.updated_at ?? null };
}

export async function getGoogleSheetsAccessToken() {
  const supabaseAdmin = await adminDb();
  const { data, error } = await (supabaseAdmin as unknown as import("@supabase/supabase-js").SupabaseClient).from("google_sheets_oauth_connections").select("refresh_token_ciphertext").eq("id", "default").maybeSingle();
  if (error || !data?.refresh_token_ciphertext) throw new Error("Google Sheets is not connected");
  const refreshToken = await decryptRefreshToken(data.refresh_token_ciphertext);
  const { clientId, clientSecret } = oauthConfig();
  const response = await fetch(GOOGLE_TOKEN, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: "refresh_token" }) });
  const token = await response.json() as { access_token?: string; error?: string; error_description?: string };
  if (!response.ok || !token.access_token) throw new Error(token.error_description || token.error || "Google access token refresh failed");
  return token.access_token;
}

export async function getGoogleSheetsSpreadsheetId() {
  const supabaseAdmin = await adminDb();
  const { data } = await (supabaseAdmin as unknown as import("@supabase/supabase-js").SupabaseClient).from("google_sheets_oauth_connections").select("spreadsheet_id").eq("id", "default").maybeSingle();
  const id = data?.spreadsheet_id || process.env.ROHI_GOOGLE_SHEETS_SPREADSHEET_ID;
  if (!id) throw new Error("ROHI_GOOGLE_SHEETS_SPREADSHEET_ID is not configured");
  return id;
}
