import { createServerFn } from "@tanstack/react-start";
import { useSession } from "@tanstack/react-start/server";

type SyncStatus = {
  configured: boolean;
  status: string;
  lastSyncedRevision: number | null;
  lastSyncedAt: string | null;
  errorMessage: string | null;
};

function b64url(value: Uint8Array | string) {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : value;
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function pemToDer(pem: string) {
  const clean = pem.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, "");
  const binary = atob(clean);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

async function getGoogleAccessToken() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is not configured");
  const account = JSON.parse(raw);
  if (!account.client_email || !account.private_key) throw new Error("Google service-account JSON is incomplete");

  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = b64url(JSON.stringify({
    iss: account.client_email,
    scope: "https://www.googleapis.com/auth/spreadsheets",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  }));
  const unsigned = `${header}.${claim}`;
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToDer(account.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned));
  const jwt = `${unsigned}.${b64url(new Uint8Array(signature))}`;

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  if (!tokenResponse.ok) throw new Error(`Google token request failed: ${tokenResponse.status}`);
  const token = await tokenResponse.json() as { access_token?: string };
  if (!token.access_token) throw new Error("Google did not return an access token");
  return token.access_token;
}

function sheetId() {
  const id = process.env.ROHI_AIRLINE_LEDGER_SHEET_ID;
  if (!id) throw new Error("ROHI_AIRLINE_LEDGER_SHEET_ID is not configured");
  return id;
}

async function sheetsRequest(path: string, token: string, init?: RequestInit) {
  const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId()}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Google Sheets API ${response.status}: ${body.slice(0, 500)}`);
  }
  return response.json();
}

function cellValue(value: unknown) {
  return value === null || value === undefined ? "" : value;
}

export async function syncAirlineLedgerToGoogleSheet(
  snapshot: {
    airlines: Array<{ id: string; name: string; code: string; opening_balance: number; opening_balance_date: string; sort_order: number }>;
    agents: Array<{ name: string; sort_order: number }>;
    transactions: Array<Record<string, unknown>>;
  },
  revision: number,
) {
  const configured = Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_JSON && process.env.ROHI_AIRLINE_LEDGER_SHEET_ID);
  if (!configured) return { configured: false, synced: false };

  const token = await getGoogleAccessToken();

  const airlines = [
    ["ROHI INTERNATIONAL TRAVELS — AIRLINE LEDGER BACKUP"],
    ["SOURCE", "SUPABASE (READ-ONLY MIRROR)"],
    ["REVISION", revision],
    ["SYNCED AT", new Date().toISOString()],
    [],
    ["ID", "AIRLINE", "CODE", "OPENING BALANCE", "OPENING BALANCE DATE", "SORT ORDER"],
    ...snapshot.airlines.map((a) => [a.id, a.name, a.code, a.opening_balance, a.opening_balance_date, a.sort_order]),
  ];
  const agents = [
    ["AGENTS"],
    ["REVISION", revision],
    ["SYNCED AT", new Date().toISOString()],
    [],
    ["AGENT", "SORT ORDER"],
    ...snapshot.agents.map((a) => [a.name, a.sort_order]),
  ];
  const transactions = [
    ["TRANSACTIONS"],
    ["SOURCE", "SUPABASE (READ-ONLY MIRROR)"],
    ["REVISION", revision],
    ["SYNCED AT", new Date().toISOString()],
    [],
    ["ID", "AIRLINE ID", "DATE", "AGENT", "PASSENGER", "SECTOR", "PNR", "TICKET SALES", "DEBIT IN", "CREDIT FROM", "CONTACT", "VOID CHARGES", "SORT ORDER"],
    ...snapshot.transactions.map((t: any) => [
      cellValue(t.id), cellValue(t.airline_id), cellValue(t.date), cellValue(t.agent_name),
      cellValue(t.pax_name), cellValue(t.sector), cellValue(t.pnr), cellValue(t.ticket_sales),
      cellValue(t.debit_in_id), cellValue(t.credit_from_id), cellValue(t.pax_contact),
      cellValue(t.void_charges), cellValue(t.sort_order),
    ]),
  ];

  // These ranges are written only to the dedicated backup tabs. The API
  // credentials are server-side and the website never accepts Sheet writes.
  await sheetsRequest("/values:batchUpdate", token, {
    method: "POST",
    body: JSON.stringify({
      valueInputOption: "USER_ENTERED",
      data: [
        { range: "AIRLINES!A1", values: airlines },
        { range: "AGENTS!A1", values: agents },
        { range: "TRANSACTIONS!A1", values: transactions },
      ],
    }),
  });

  return { configured: true, synced: true };
}

async function requireUnlocked() {
  const password = typeof process !== "undefined" ? process.env.SESSION_SECRET : undefined;
  if (!password) throw new Error("Server misconfigured: SESSION_SECRET is not set");
  const s = await useSession<{ unlocked?: boolean }>({
    password,
    name: "rohi-admin",
    maxAge: 60 * 60 * 8,
    cookie: { httpOnly: true, secure: true, sameSite: "none", path: "/" },
  });
  if (!s.data.unlocked) throw new Error("Unauthorized");
}

export const getAirlineLedgerGoogleSyncStatus = createServerFn({ method: "GET" }).handler(async (): Promise<SyncStatus> => {
  await requireUnlocked();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("airline_ledger_google_sync")
    .select("*")
    .eq("id", 1)
    .maybeSingle();
  if (error) throw new Error(`Google Sheet sync status failed: ${error.message}`);
  return {
    configured: Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_JSON && process.env.ROHI_AIRLINE_LEDGER_SHEET_ID),
    status: data?.status ?? "not_configured",
    lastSyncedRevision: data?.last_synced_revision ?? null,
    lastSyncedAt: data?.last_synced_at ?? null,
    errorMessage: data?.error_message ?? null,
  };
});
