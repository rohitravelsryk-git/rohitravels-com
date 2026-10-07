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

const DEFAULT_AIRLINE_LEDGER_SHEET_ID = "1frL5ognuYHdtct0kHonvmORhUZm2IYestxUUCgKZD5Q";

function sheetId() {
  return process.env.ROHI_AIRLINE_LEDGER_SHEET_ID || DEFAULT_AIRLINE_LEDGER_SHEET_ID;
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

async function sheetsBatchUpdate(token: string, requests: unknown[]) {
  return sheetsRequest(":batchUpdate", token, {
    method: "POST",
    body: JSON.stringify({ requests }),
  });
}

async function ensureBackupTabs(token: string) {
  const spreadsheet = await sheetsRequest("?fields=sheets.properties", token, { method: "GET" });
  const existing = new Set<string>((spreadsheet.sheets ?? []).map((s: any) => s.properties?.title));
  const needed = ["AIRLINES", "AGENTS", "TRANSACTIONS"];
  const missing = needed.filter((name) => !existing.has(name));
  if (missing.length) {
    await sheetsBatchUpdate(token, missing.map((title) => ({
      addSheet: {
        properties: {
          title,
          gridProperties: { rowCount: 1000, columnCount: 20 },
        },
      },
    })));
  }
}

function toRowData(rows: unknown[][]) {
  return rows.map((row) => ({
    values: row.map((value) => ({
      userEnteredValue:
        typeof value === "number"
          ? { numberValue: value }
          : { stringValue: String(cellValue(value)) },
    })),
  }));
}

async function ensureAirlineTabs(token: string, airlines: Array<{ name: string }>) {
  const spreadsheet = await sheetsRequest("?fields=sheets.properties", token, { method: "GET" });
  const existing = new Set<string>((spreadsheet.sheets ?? []).map((s: any) => s.properties?.title));
  const clean = (raw: string) => String(raw || "Airline").replace(/[\\/:*?\\[\\]]/g, " ").replace(/\s+/g, " ").trim().slice(0, 90) || "Airline";
  const needed = Array.from(new Set(airlines.map((a) => clean(a.name)))).filter((name) => !existing.has(name));
  if (!needed.length) return;
  await sheetsBatchUpdate(token, needed.map((title) => ({
    addSheet: { properties: { title, gridProperties: { rowCount: 2000, columnCount: 11, frozenRowCount: 5 } } },
  })));
}

async function replaceAirlineTabs(
  token: string,
  airlines: Array<{ id: string; name: string; code: string; opening_balance: number; opening_balance_date: string }>,
  transactions: Array<Record<string, unknown>>,
) {
  const spreadsheet = await sheetsRequest("?fields=sheets.properties", token, { method: "GET" });
  const byTitle = new Map<string, any>((spreadsheet.sheets ?? []).map((s: any) => [s.properties?.title, s.properties]));
  const clean = (raw: string) => String(raw || "Airline").replace(/[\\/:*?\\[\\]]/g, " ").replace(/\s+/g, " ").trim().slice(0, 90) || "Airline";
  const requests: unknown[] = [];
  const currentTitles = new Set(airlines.map((air) => clean(air.name)));
  // These are the dedicated airline-account tabs created by this sync. Remove
  // any stale tab that no longer exists in Supabase, while never touching the
  // shared backup/summary tabs or unrelated user tabs.
  const knownAirlineTabs = new Set([
    "Air Arabia", "Airblue", "Emirates", "Etihad", "Flydubai", "Flynas",
    "Gulf Air", "Jazeera Airways", "Kuwait Airways", "Oman Air", "PIA",
    "Qatar Airways", "Salam Air", "Saudia", "Turkish Airlines",
  ]);
  for (const title of knownAirlineTabs) {
    if (!currentTitles.has(title)) {
      const stale = byTitle.get(title);
      if (stale?.sheetId) requests.push({ deleteSheet: { sheetId: stale.sheetId } });
    }
  }

  for (const air of airlines) {
    const title = clean(air.name);
    const props = byTitle.get(title);
    if (!props?.sheetId) continue;
    const rows = transactions.filter((r: any) => r.airline_id === air.id);
    let running = Number(air.opening_balance) || 0;
    const values: unknown[][] = [
      ["ROHI INTERNATIONAL TRAVELS — AIRLINE ACCOUNT"],
      [air.name, air.code || ""],
      ["Opening Balance", air.opening_balance, "Opening Date", air.opening_balance_date, "Entries", rows.length, "Current Balance", running],
      [],
      ["Date", "Agent", "Passenger", "Sector", "PNR", "Ticket Sales", "Credit From ID", "Void Charges", "Profit", "Running Balance", "Remarks"],
      [air.opening_balance_date, "", "", "", "", 0, "", 0, 0, running, "OPENING BALANCE"],
    ];
    for (const r of rows as any[]) {
      const credit = Number(r.credit_from_id) || 0;
      const sales = Number(r.ticket_sales) || 0;
      const voids = Number(r.void_charges) || 0;
      running -= credit;
      values.push([
        r.date || "", r.agent_name || "", r.pax_name || "", r.sector || "", r.pnr || "",
        sales, credit, voids, sales - credit, running,
        [r.pax_name, r.sector, r.pnr].map((v) => String(v || "").trim()).filter(Boolean).join(" - "),
      ]);
    }
    values[2][7] = running;
    requests.push({ updateCells: { range: { sheetId: props.sheetId }, fields: "userEnteredValue" } });
    requests.push({
      updateCells: {
        start: { sheetId: props.sheetId, rowIndex: 0, columnIndex: 0 },
        rows: toRowData(values),
        fields: "userEnteredValue",
      },
    });
    requests.push({
      repeatCell: {
        range: { sheetId: props.sheetId, startRowIndex: 0, endRowIndex: 1 },
        cell: { userEnteredFormat: { textFormat: { bold: true, fontSize: 14 } } },
        fields: "userEnteredFormat.textFormat",
      },
    });
    requests.push({
      repeatCell: {
        range: { sheetId: props.sheetId, startRowIndex: 4, endRowIndex: 5 },
        cell: { userEnteredFormat: { textFormat: { bold: true } } },
        fields: "userEnteredFormat.textFormat",
      },
    });
  }
  if (requests.length) await sheetsBatchUpdate(token, requests);
}

async function replaceBackupTabs(token: string, sheets: Array<{ title: string; values: unknown[][] }>) {
  const spreadsheet = await sheetsRequest("?fields=sheets.properties", token, { method: "GET" });
  const byTitle = new Map<string, any>(
    (spreadsheet.sheets ?? []).map((s: any) => [s.properties?.title, s.properties]),
  );

  const requests: unknown[] = [];
  for (const sheet of sheets) {
    const props = byTitle.get(sheet.title);
    if (!props?.sheetId) throw new Error(`Backup tab ${sheet.title} is missing`);
    // Clear every existing value and then write the complete current snapshot.
    // Both operations are in ONE atomic batchUpdate request.
    requests.push({
      updateCells: {
        range: { sheetId: props.sheetId },
        fields: "userEnteredValue",
      },
    });
    requests.push({
      updateCells: {
        start: { sheetId: props.sheetId, rowIndex: 0, columnIndex: 0 },
        rows: toRowData(sheet.values),
        fields: "userEnteredValue",
      },
    });
  }
  await sheetsBatchUpdate(token, requests);
}

export async function syncAirlineLedgerToGoogleSheet(
  snapshot: {
    airlines: Array<{ id: string; name: string; code: string; opening_balance: number; opening_balance_date: string; sort_order: number }>;
    agents: Array<{ name: string; sort_order: number }>;
    transactions: Array<Record<string, unknown>>;
  },
  revision: number,
) {
  const configured = Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  if (!configured) {
    // Production fallback: use the existing server-side Lovable Google Sheets
    // connector when a service-account credential is not configured. This does
    // not change the accounting source of truth: Supabase remains authoritative.
    try {
      const { syncAirlineAccountsSheet } = await import("@/lib/airline-accounts-sheet.server");
      const fallback = await syncAirlineAccountsSheet(revision);
      return { configured: true, synced: true, spreadsheetId: fallback.spreadsheetId, fallback: "lovable-google-connector" };
    } catch (fallbackError) {
      throw new Error(
        "Google Sheets sync is not configured: set GOOGLE_SERVICE_ACCOUNT_JSON or configure the existing server-side Google Sheets connector. " +
        String(fallbackError instanceof Error ? fallbackError.message : fallbackError),
      );
    }
  }

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
  await ensureBackupTabs(token);
  await replaceBackupTabs(token, [
    { title: "AIRLINES", values: airlines },
    { title: "AGENTS", values: agents },
    { title: "TRANSACTIONS", values: transactions },
  ]);
  await ensureAirlineTabs(token, snapshot.airlines);
  await replaceAirlineTabs(token, snapshot.airlines, snapshot.transactions);

  return { configured: true, synced: true, spreadsheetId: sheetId() };
}

async function requireUnlocked() {
  const password = typeof process !== "undefined" ? (process.env.ROHI_SESSION_SECRET || process.env.SESSION_SECRET) : undefined;
  if (!password) throw new Error("ROHI_SESSION_SECRET is not configured");
  const s = await useSession<{ unlocked?: boolean }>({
    password,
    name: "rohi-admin",
    maxAge: 60 * 60 * 8,
    cookie: { httpOnly: true, secure: true, sameSite: "lax", path: "/" },
  });
  if (!s.data.unlocked) throw new Error("Unauthorized");
}

export const getAirlineLedgerGoogleSyncStatus = createServerFn({ method: "GET" }).handler(async (): Promise<SyncStatus> => {
  await requireUnlocked();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await (supabaseAdmin as unknown as import("@supabase/supabase-js").SupabaseClient)
    .from("airline_ledger_google_sync")
    .select("*")
    .eq("id", 1)
    .maybeSingle();
  if (error) throw new Error(`Google Sheet sync status failed: ${error.message}`);
  return {
    configured: Boolean(
      process.env.GOOGLE_SERVICE_ACCOUNT_JSON ||
      (process.env.LOVABLE_API_KEY && process.env.GOOGLE_SHEETS_API_KEY),
    ),
    status: data?.status ?? "not_configured",
    lastSyncedRevision: data?.last_synced_revision ?? null,
    lastSyncedAt: data?.last_synced_at ?? null,
    errorMessage: data?.error_message ?? null,
  };
});
