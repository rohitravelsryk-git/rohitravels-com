import { useSession } from "@tanstack/react-start/server";

type BackupSheet = { title: string; values: unknown[][] };

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
  const key = await crypto.subtle.importKey("pkcs8", pemToDer(account.private_key), { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned));
  const jwt = `${unsigned}.${b64url(new Uint8Array(signature))}`;
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: jwt }),
  });
  if (!response.ok) throw new Error(`Google token request failed: ${response.status}`);
  const token = await response.json() as { access_token?: string };
  if (!token.access_token) throw new Error("Google did not return an access token");
  return token.access_token;
}

function sheetId() {
  // Fresh emergency workbook supplied by the owner.
  // Environment configuration can override this value in production.
  const id = process.env.ROHI_FINANCIAL_BACKUP_SHEET_ID || "10b0at_kDhAju9vs-PKpJnp9sp0pHODGTPePL6SwxiCI";
  return id;
}

async function request(path: string, token: string, init?: RequestInit) {
  const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId()}${path}`, {
    ...init,
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Google Sheets API ${response.status}: ${body.slice(0, 500)}`);
  }
  return response.json();
}

const value = (v: unknown) => v === null || v === undefined ? "" : v;
const rowData = (rows: unknown[][]) => rows.map((row) => ({
  values: row.map((v) => ({
    userEnteredValue: typeof v === "number" ? { numberValue: v } : { stringValue: String(value(v)) },
  })),
}));

async function batchUpdate(token: string, requests: unknown[]) {
  return request(":batchUpdate", token, { method: "POST", body: JSON.stringify({ requests }) });
}

async function ensureTabs(token: string, titles: string[]) {
  const spreadsheet = await request("?fields=sheets.properties", token);
  const existing = new Set<string>((spreadsheet.sheets ?? []).map((s: any) => s.properties?.title));
  const missing = titles.filter((title) => !existing.has(title));
  if (missing.length) {
    await batchUpdate(token, missing.map((title) => ({
      addSheet: { properties: { title, gridProperties: { rowCount: 2000, columnCount: 30 } } },
    })));
  }
}

async function writeWorkbook(token: string, sheets: BackupSheet[]) {
  const spreadsheet = await request("?fields=sheets.properties", token);
  const byTitle = new Map<string, any>((spreadsheet.sheets ?? []).map((s: any) => [s.properties?.title, s.properties]));
  const requests: unknown[] = [];

  for (const sheet of sheets) {
    const props = byTitle.get(sheet.title);
    if (!props?.sheetId) throw new Error(`Backup tab ${sheet.title} is missing`);
    requests.push({
      updateCells: {
        range: { sheetId: props.sheetId },
        fields: "userEnteredValue",
      },
    });
    requests.push({
      updateCells: {
        start: { sheetId: props.sheetId, rowIndex: 0, columnIndex: 0 },
        rows: rowData(sheet.values),
        fields: "userEnteredValue",
      },
    });
    requests.push({
      updateSheetProperties: {
        properties: { sheetId: props.sheetId, gridProperties: { frozenRowCount: 1 } },
        fields: "gridProperties.frozenRowCount",
      },
    });
    requests.push({
      repeatCell: {
        range: { sheetId: props.sheetId, startRowIndex: 0, endRowIndex: 1 },
        cell: {
          userEnteredFormat: {
            backgroundColor: { red: 0.04, green: 0.16, blue: 0.28 },
            foregroundColor: { red: 1, green: 1, blue: 1 },
            textFormat: { bold: true },
            horizontalAlignment: "CENTER",
          },
        },
        fields: "userEnteredFormat(backgroundColor,foregroundColor,textFormat,horizontalAlignment)",
      },
    });
    requests.push({
      autoResizeDimensions: {
        dimensions: { sheetId: props.sheetId, dimension: "COLUMNS", startIndex: 0, endIndex: 20 },
      },
    });
  }

  await batchUpdate(token, requests);
}

export async function syncRohiFinancialBackup(snapshot: {
  airlines: any[];
  airlineTransactions: any[];
  accounts: any[];
  accountTransactions: any[];
  services: any[];
}, revision: number) {
  const configured = Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  if (!configured) return { configured: false, synced: false };

  const token = await getGoogleAccessToken();
  const syncedAt = new Date().toISOString();
  const airlineHeaders = ["AIRLINE", "IATA", "OPENING BALANCE", "OPENING BALANCE DATE", "DATE", "AGENT", "PASSENGER", "SECTOR", "PNR", "TICKET SALES", "DEBIT IN", "CREDIT FROM", "CONTACT", "VOID CHARGES", "TRANSACTION ID"];


  const sheets: BackupSheet[] = [
    {
      title: "CONTROL",
      values: [
        ["ROHI INTERNATIONAL TRAVELS — FINANCIAL BACKUP"],
        ["SOURCE", "SUPABASE — AUTHORITATIVE DATABASE"],
        ["BACKUP REVISION", revision],
        ["LAST SYNC", syncedAt],
        ["MODE", "ONE-WAY: WEBSITE → SUPABASE → GOOGLE SHEETS"],
        ["IMPORTANT", "Do not edit this workbook to change website data."],
        ["NO SNAPSHOTS", "No repeated SNAP YYYY-MM-DD... tabs are generated."],
        [],
        ["QUICK ACCESS", "Use the tabs below for emergency viewing/sharing."],
      ],
    },
    {
      title: "AIRLINE_ACCOUNTS",
      values: [
        ["ROHI INTERNATIONAL TRAVELS — AIRLINE ACCOUNTS"],
        airlineHeaders,
        ...snapshot.airlines.flatMap((a) => {
          const tx = snapshot.airlineTransactions.filter((t) => t.airline_id === a.id);
          if (!tx.length) return [[value(a.name), value(a.code), value(a.opening_balance), value(a.opening_balance_date), "", "", "", "", "", "", "", "", "", "", ""]];
          return tx.map((t) => [
            value(a.name), value(a.code), value(a.opening_balance), value(a.opening_balance_date), value(t.date), value(t.agent_name),
            value(t.pax_name), value(t.sector), value(t.pnr), value(t.ticket_sales), value(t.debit_in_id), value(t.credit_from_id),
            value(t.pax_contact), value(t.void_charges), value(t.id),
          ]);
        }),
      ],
    },
    {
      title: "ACCOUNTS",
      values: [
        ["ROHI ACCOUNTS BOOK"],
        ["ID", "ACCOUNT", "TYPE", "OPENING BALANCE", "OPENING BALANCE DATE", "ACTIVE", "CREATED AT"],
        ...snapshot.accounts.map((a) => [value(a.id), value(a.name), value(a.kind), value(a.opening_balance), value(a.opening_balance_date), value(a.is_active), value(a.created_at)]),
      ],
    },
    {
      title: "ACCOUNT_TRANSACTIONS",
      values: [
        ["ROHI ACCOUNTS BOOK TRANSACTIONS"],
        ["ID", "ACCOUNT ID", "DATE", "TYPE", "CATEGORY", "PARTY", "DESCRIPTION", "AMOUNT", "DIRECT COST", "DIRECTION", "SOURCE TYPE", "SOURCE ID", "CREATED AT"],
        ...snapshot.accountTransactions.map((t) => [
          value(t.id), value(t.account_id), value(t.entry_date), value(t.entry_type), value(t.category), value(t.party),
          value(t.description), value(t.amount), value(t.direct_cost), value(t.direction), value(t.source_type),
          value(t.source_id), value(t.created_at),
        ]),
      ],
    },
    {
      title: "SERVICES",
      values: [
        ["ROHI ACCOUNTING SERVICES"],
        ["ID", "SERVICE", "ACTIVE", "CREATED AT"],
        ...snapshot.services.map((s) => [value(s.id), value(s.name), value(s.is_active), value(s.created_at)]),
      ],
    },
  ];

  await ensureTabs(token, sheets.map((s) => s.title));
  await writeWorkbook(token, sheets);
  return { configured: true, synced: true, revision, syncedAt };
}

export async function syncCurrentRohiFinancialBackup() {
  const configured = Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  if (!configured) return { configured: false, synced: false };

  const password = process.env.SESSION_SECRET;
  if (!password) throw new Error("SESSION_SECRET is not configured");
  const session = await useSession<{ unlocked?: boolean }>({
    password,
    name: "rohi-admin",
    maxAge: 60 * 60 * 8,
    cookie: { httpOnly: true, secure: true, sameSite: "none", path: "/" },
  });
  if (!session.data.unlocked) throw new Error("Unauthorized");

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const [airlines, airlineTransactions, accounts, accountTransactions, services, revision] = await Promise.all([
    supabaseAdmin.from("airline_ledger_airlines").select("*").order("sort_order"),
    supabaseAdmin.from("airline_ledger_transactions").select("*").order("sort_order"),
    supabaseAdmin.from("accounts_book_accounts").select("*").order("created_at"),
    supabaseAdmin.from("accounts_book_transactions").select("*").order("entry_date").order("created_at"),
    supabaseAdmin.from("accounts_book_services").select("*").order("name"),
    supabaseAdmin.rpc("get_rohi_financial_backup_revision"),
  ]);
  for (const result of [airlines, airlineTransactions, accounts, accountTransactions, services, revision]) {
    if (result.error) throw new Error(result.error.message);
  }
  return syncRohiFinancialBackup({
    airlines: airlines.data ?? [],
    airlineTransactions: airlineTransactions.data ?? [],
    accounts: accounts.data ?? [],
    accountTransactions: accountTransactions.data ?? [],
    services: services.data ?? [],
  }, Number(revision.data ?? 1));
}
