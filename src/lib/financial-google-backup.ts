import { useSession } from "@tanstack/react-start/server";
import { inCreationOrder } from "@/lib/accounts-book-order";

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
  const id = process.env.ROHI_FINANCIAL_BACKUP_SHEET_ID || "1k0oqR8oykH6wQfvE7xaVqbpsWgdyuz5XDYZdemcSerY";
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

// Google Sheets date columns must be written in the requested display format as text;
// number-format rules do not change ISO strings that were already written as text.
function formatSheetDate(v: unknown): unknown {
  if (typeof v !== "string") return v;
  const raw = v.trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:[T\s].*)?$/.exec(raw);
  if (!match) return v;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return v;
  const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  return `${String(day).padStart(2, "0")}-${months[month - 1]}-${String(year).slice(-2)}`;
}

const rowData = (rows: unknown[][]) => rows.map((row) => ({
  values: row.map((raw) => {
    const v = formatSheetDate(raw);
    return { userEnteredValue: typeof v === "number" ? { numberValue: v } : { stringValue: String(value(v)) } };
  }),
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

  // EXACTLY five emergency-view tabs. Supabase remains the only source of truth.
  const tabs = [
    "AIRLINE_ACCOUNTS",
    "LEDGER_ACCOUNTS",
    "SALE_ACCOUNTS",
    "BANKS_AND_WALLETS",
    "CASH_BOOK",
  ];

  const genericTxnHeaders = [
    "DATE", "ACCOUNT", "TYPE", "CATEGORY", "PARTY", "DESCRIPTION",
    "AMOUNT", "DIRECT COST", "DIRECTION", "SOURCE TYPE", "SOURCE ID", "CREATED AT",
  ];

  const airlineRows = snapshot.airlines.flatMap((a) => {
    const tx = snapshot.airlineTransactions.filter((t) => t.airline_id === a.id);
    if (!tx.length) return [[a.name, a.code, a.opening_balance, a.opening_balance_date, "", "", "", "", "", "", "", "", "", "", ""]];
    return tx.map((t) => [
      a.name, a.code, a.opening_balance, a.opening_balance_date, t.date, t.agent_name,
      t.pax_name, t.sector, t.pnr, t.ticket_sales, t.debit_in_id, t.credit_from_id,
      t.pax_contact, t.void_charges, t.id,
    ]);
  });

  const ledgerRows = snapshot.airlineTransactions.map((t) => [
    t.date, t.agent_name, t.airline_id, t.pnr, t.pax_name, t.sector,
    t.ticket_sales, t.debit_in_id, t.credit_from_id, t.void_charges, t.pax_contact, t.id,
  ]);

  const saleRows = snapshot.accountTransactions
    .filter((t) => t.entry_type === "sale")
    .map((t) => [
      t.entry_date, t.account_id, t.entry_type, t.category, t.party, t.description,
      t.amount, t.direct_cost, t.direction, t.source_type, t.source_id, t.created_at,
    ]);

  const bankWalletRows = snapshot.accounts
    .filter((a) => a.kind === "bank" || a.kind === "wallet")
    .flatMap((a) => {
      const tx = snapshot.accountTransactions.filter((t) => t.account_id === a.id);
      if (!tx.length) return [[a.id, a.name, a.kind, a.opening_balance, a.opening_balance_date ?? "", a.is_active, "", "", "", "", "", ""]];
      return tx.map((t) => [
        a.id, a.name, a.kind, a.opening_balance, a.opening_balance_date ?? "", a.is_active,
        t.entry_date, t.entry_type, t.category, t.party, t.description, t.amount,
        t.direct_cost, t.direction, t.source_type, t.source_id, t.created_at,
      ]);
    });

  const cashRows = snapshot.accounts
    .filter((a) => a.kind === "cash")
    .flatMap((a) => {
      const tx = snapshot.accountTransactions.filter((t) => t.account_id === a.id);
      if (!tx.length) return [[a.id, a.name, a.opening_balance, a.opening_balance_date ?? "", a.is_active, "", "", "", "", "", "", ""]];
      return tx.map((t) => [
        a.id, a.name, a.opening_balance, a.opening_balance_date ?? "", a.is_active,
        t.entry_date, t.entry_type, t.category, t.party, t.description, t.amount,
        t.direct_cost, t.direction, t.source_type, t.source_id, t.created_at,
      ]);
    });

  const sheets: BackupSheet[] = [
    {
      title: "AIRLINE_ACCOUNTS",
      values: [
        ["ROHI INTERNATIONAL TRAVELS — AIRLINE ACCOUNTS"],
        ["SOURCE", "SUPABASE — AUTHORITATIVE DATABASE"],
        ["BACKUP REVISION", revision],
        ["LAST SYNC", syncedAt],
        [],
        ["AIRLINE", "IATA", "OPENING BALANCE", "OPENING BALANCE DATE", "DATE", "AGENT", "PASSENGER", "SECTOR", "PNR", "TICKET SALES", "DEBIT IN", "CREDIT FROM", "CONTACT", "VOID CHARGES", "TRANSACTION ID"],
        ...airlineRows,
      ],
    },
    {
      title: "LEDGER_ACCOUNTS",
      values: [
        ["ROHI INTERNATIONAL TRAVELS — LEDGER ACCOUNTS / AGENTS"],
        ["SOURCE", "SUPABASE — AUTHORITATIVE DATABASE"],
        ["BACKUP REVISION", revision],
        ["LAST SYNC", syncedAt],
        [],
        ["DATE", "AGENT", "AIRLINE ID", "PNR", "PASSENGER", "SECTOR", "TICKET SALES", "DEBIT IN", "CREDIT FROM", "VOID CHARGES", "CONTACT", "TRANSACTION ID"],
        ...ledgerRows,
      ],
    },
    {
      title: "SALE_ACCOUNTS",
      values: [
        ["ROHI INTERNATIONAL TRAVELS — SALE ACCOUNTS"],
        ["SOURCE", "SUPABASE — AUTHORITATIVE DATABASE"],
        ["BACKUP REVISION", revision],
        ["LAST SYNC", syncedAt],
        [],
        genericTxnHeaders,
        ...saleRows,
      ],
    },
    {
      title: "BANKS_AND_WALLETS",
      values: [
        ["ROHI INTERNATIONAL TRAVELS — BANKS & WALLETS"],
        ["SOURCE", "SUPABASE — AUTHORITATIVE DATABASE"],
        ["BACKUP REVISION", revision],
        ["LAST SYNC", syncedAt],
        [],
        ["ACCOUNT ID", "ACCOUNT", "TYPE", "OPENING BALANCE", "OPENING DATE", "ACTIVE", "DATE", "ENTRY TYPE", "CATEGORY", "PARTY", "DESCRIPTION", "AMOUNT", "DIRECT COST", "DIRECTION", "SOURCE TYPE", "SOURCE ID", "CREATED AT"],
        ...bankWalletRows,
      ],
    },
    {
      title: "CASH_BOOK",
      values: [
        ["ROHI INTERNATIONAL TRAVELS — CASH BOOK"],
        ["SOURCE", "SUPABASE — AUTHORITATIVE DATABASE"],
        ["BACKUP REVISION", revision],
        ["LAST SYNC", syncedAt],
        [],
        ["ACCOUNT ID", "ACCOUNT", "OPENING BALANCE", "OPENING DATE", "ACTIVE", "DATE", "ENTRY TYPE", "CATEGORY", "PARTY", "DESCRIPTION", "AMOUNT", "DIRECT COST", "DIRECTION", "SOURCE TYPE", "SOURCE ID", "CREATED AT"],
        ...cashRows,
      ],
    },
  ];

  await ensureTabs(token, tabs);

  // Remove all legacy tabs/data except the required five. This does not touch unrelated
  // Google Drive files. AIRLINE_ACCOUNTS is retained if it already exists.
  const spreadsheet = await request("?fields=sheets.properties", token);
  const existing = (spreadsheet.sheets ?? []).map((s: any) => s.properties).filter((p: any) => p?.sheetId && p?.title);
  const required = new Set(tabs);
  const obsolete = existing.filter((p: any) => !required.has(p.title));

  if (obsolete.length) {
    await batchUpdate(token, obsolete.map((p: any) => ({ deleteSheet: { sheetId: p.sheetId } })));
  }

  await writeWorkbook(token, sheets);
  return { configured: true, synced: true, revision, syncedAt, tabs };
}

export async function syncCurrentRohiFinancialBackup() {
  const configured = Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  if (!configured) return { configured: false, synced: false };

  const password = typeof process !== "undefined" ? (process.env.ROHI_SESSION_SECRET || process.env.SESSION_SECRET) : undefined;
  if (!password) throw new Error("ROHI_SESSION_SECRET is not configured");
  const session = await useSession<{ unlocked?: boolean }>({
    password,
    name: "rohi-admin",
    maxAge: 60 * 60 * 8,
    cookie: { httpOnly: true, secure: true, sameSite: "lax", path: "/" },
  });
  if (!session.data.unlocked) throw new Error("Unauthorized");

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const [airlines, airlineTransactions, accounts, accountTransactions, services, revision] = await Promise.all([
    supabaseAdmin.from("airline_ledger_airlines").select("*").order("sort_order"),
    supabaseAdmin.from("airline_ledger_transactions").select("*").order("sort_order"),
    supabaseAdmin.from("accounts_book_accounts").select("*").order("created_at"),
    supabaseAdmin.from("accounts_book_transactions").select("*").order("created_at"),
    supabaseAdmin.from("accounts_book_services").select("*").order("name"),
    supabaseAdmin.from("airline_ledger_meta").select("revision").eq("id", 1).maybeSingle(),
  ]);
  for (const result of [airlines, airlineTransactions, accounts, accountTransactions, services, revision]) {
    if (result.error) throw new Error(result.error.message);
  }
  return syncRohiFinancialBackup({
    airlines: airlines.data ?? [],
    airlineTransactions: airlineTransactions.data ?? [],
    accounts: accounts.data ?? [],
    accountTransactions: inCreationOrder(accountTransactions.data ?? []),
    services: services.data ?? [],
  }, Number(revision.data?.revision ?? 1));
}
