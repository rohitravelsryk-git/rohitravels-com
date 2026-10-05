// Backup / disaster-recovery sync engine.
// SERVER ONLY — never import from browser code.
import {
  addSheet,
  appendRows,
  applyBrandFormatting,
  batchWrite,
  clearSheet,
  colLetter,
  createSpreadsheet,
  deleteSheet,
  getSpreadsheet,
  quoteSheet,
  readRange,
  writeRange,
} from "./sheets.server";

export const SPREADSHEET_TITLE = "ROHI INTERNATIONAL TRAVELS MASTER BACKUP";
// Pages keep running until the data runs out. This is only a runaway guard —
// reaching it fails the table loudly instead of quietly mirroring a slice.
const SAFETY_MAX_ROWS = 500_000;
const PAGE_SIZE = 500;

type Admin = Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];

async function admin(): Promise<Admin> {
  const mod = await import("@/integrations/supabase/client.server");
  return mod.supabaseAdmin;
}

// ---------- friendly worksheet names ----------

const SHEET_NAME_OVERRIDES: Record<string, string> = {
  fares: "Group Fares",
  airlines: "Airlines",
  locations: "Routes & Cities",
  vendors: "Vendors",
  agents: "Agents",
  agent_bookings: "Bookings",
  group_tickets: "Group Tickets",
  self_group_passengers: "Self Group Passengers",
  vouchers: "Vouchers",
  visa_verification_links: "Visa Verification Links",
  countries: "Countries",
  queries: "Customer Queries",
  inquiry_services: "Inquiry Services",
  luggage_options: "Luggage Options",
  site_settings: "Settings",
  user_roles: "User Roles",
  ticket_notifications: "Notifications",
  admin_credentials: "Admin Credentials",
  admin_password_resets: "Admin Password Resets",
};

export function sheetNameFor(table: string): string {
  const override = SHEET_NAME_OVERRIDES[table];
  if (override) return override;
  return table
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

// Routes each generic table to the one designated spreadsheet it clearly belongs to.
// A table not listed here still mirrors — into "Addons" as a catch-all — rather than
// being silently dropped, until there's a confirmed home for it.
const TABLE_SPREADSHEET: Record<string, keyof typeof DESIGNATED_SPREADSHEETS> = {
  // Agent Ledger Accounts
  agents: "agentLedger",
  agent_bookings: "agentLedger",

  // Airline Accounts
  airlines: "airlineAccounts",
  airline_ledger_airlines: "airlineAccounts",
  airline_ledger_agents: "airlineAccounts",
  airline_ledger_transactions: "airlineAccounts",
  airline_ledger_meta: "airlineAccounts",
  airline_ledger_audit: "airlineAccounts",

  // Group Fares & Inventory
  fares: "groupFares",
  group_tickets: "groupFares",

  // Dedicated operational workbooks
  vouchers: "vouchers",
  vendors: "vendors",
  vendor_ledger: "vendors",
  queries: "queries",

  // Accounts Book master account registry. Transaction projections are
  // handled separately below and routed to Banks & Wallets / Daily Cash /
  // Sales Accounts / Expenses.
  accounts_book_accounts: "banksWallets",

  // Remaining application/support tables intentionally live in Addons.
  accounts_book_services: "addons",
  b2b_sticky_notes: "addons",
  locations: "addons",
  luggage_options: "addons",
  inquiry_services: "addons",
  ticket_notifications: "addons",
  visa_verification_links: "addons",
};

const TABLE_SHEET_NAME: Record<string, string> = {
  // Visa Links intentionally use the existing Addons worksheet so adding them never creates a new tab.
  visa_verification_links: "Visa Verification Links",
  // Keep the generic mirror tab human-readable and stable.
  countries: "Countries",
  accounts_book_accounts: "Banks & Wallets",
};

const TABLE_ROW_FILTERS: Record<string, (row: Record<string, unknown>) => boolean> = {
  // Cash/bank/wallet master accounts belong in the designated Banks & Wallets workbook.
  accounts_book_accounts: (row) => row.kind === "bank" || row.kind === "wallet",
};

function spreadsheetKeyFor(table: string): keyof typeof DESIGNATED_SPREADSHEETS {
  return TABLE_SPREADSHEET[table] ?? "addons";
}

function sheetNameForTable(table: string): string {
  return TABLE_SHEET_NAME[table] ?? sheetNameFor(table);
}

function rowFilterFor(table: string): ((row: Record<string, unknown>) => boolean) | undefined {
  return TABLE_ROW_FILTERS[table];
}

const isSalesTransaction = (row: Record<string, unknown>) => row.source_type === "sale";
const isExpenseTransaction = (row: Record<string, unknown>) => row.source_type === "expense";
const isOfficeExpense = (row: Record<string, unknown>) => {
  if (!isExpenseTransaction(row)) return false;
  const category = String(row.category ?? "").toLowerCase();
  return category.includes("office");
};
const isHomeExpense = (row: Record<string, unknown>) => isExpenseTransaction(row) && !isOfficeExpense(row);

// Tables holding credentials/secrets are never mirrored to a spreadsheet.
const NEVER_BACKUP = new Set([
  "admin_credentials",
  "admin_password_resets",
  "accounts_book_transaction_sync_jobs",
  "rohi_financial_backup_meta",
  "rohi_financial_backup_sync",
]);

// ---------- spreadsheet bootstrap ----------

async function getSetting(key: string): Promise<string | null> {
  const db = await admin();
  const { data } = await db.from("backup_settings").select("value").eq("key", key).maybeSingle();
  return data?.value ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  const db = await admin();
  await db.from("backup_settings").upsert({ key, value, updated_at: new Date().toISOString() });
}

async function ensureSnapshotArchiveSpreadsheet(): Promise<{ id: string; url: string }> {
  // Never create a new spreadsheet here — always the one designated Rohi Snapshot Archive.
  const id = DESIGNATED_SPREADSHEETS.rohiSnapshotArchive;
  return { id, url: sheetUrl(id) };
}
export const DESIGNATED_SPREADSHEETS = {
  agentLedger: '1pjhTq_QSxMkOeWOjvJdxQOJZvWrc5Qspsbmuh4oiTxo',
  airlineAccounts: '1frL5ognuYHdtct0kHonvmORhUZm2IYestxUUCgKZD5Q',
  banksWallets: '1k0oqR8oykH6wQfvE7xaVqbpsWgdyuz5XDYZdemcSerY',
  dailyCashBook: '1eMeClR8JrIOokh9JtPWF2JdyB6uMb_m_GsE9H42hZw8',
  groupFares: '1bjt-0UOQ3wxGleUwHo2xRRjBcXBIeam_hQ2N9So2Zlc',
  salesAccounts: '1ur4nQHvL8lB9g_reF1VqLyJYcvOk9FlspLfJRehYASA',
  // Created lazily through the existing Google Sheets gateway and persisted in backup_settings.
  expenses: '',
  vouchers: '1Ug_wnLyipETa4NH6VRI4lhLw0YTyTpCuDc9J7v1nRqk',
  addons: '1QYY2RtXu3qxb9HpSanq5JSsjF_qgr9T05RbricOBGVM',
  vendors: '1d5aNDN0mIL7rRpWgDCOAd0l59M8s8EUaUBSpRydxjqw',
  queries: '19ag0ipLDcTxXiGQI0l4EM9NetFIML5draZ1wX79Z4W4',
  rohiSnapshotArchive: '1TkrRR5kISet35R69jC39L3-gnUEojM6jfHugzAsndF8'
};

export async function ensureSpreadsheet(
  key: keyof typeof DESIGNATED_SPREADSHEETS = "addons",
): Promise<{ id: string; url: string }> {
  if (key === "expenses") {
    const db = await admin();
    const { data } = await db
      .from("backup_settings")
      .select("value")
      .eq("key", "accounts_book_expenses_spreadsheet_id")
      .maybeSingle();
    const savedId = (data as { value?: string } | null)?.value?.trim();
    if (savedId) return { id: savedId, url: sheetUrl(savedId) };

    const created = await createSpreadsheet("Expenses");
    await db.from("backup_settings").upsert({
      key: "accounts_book_expenses_spreadsheet_id",
      value: created.spreadsheetId,
      updated_at: new Date().toISOString(),
    });
    return { id: created.spreadsheetId, url: created.spreadsheetUrl ?? sheetUrl(created.spreadsheetId) };
  }

  // All other workbooks are pre-designated and never created implicitly.
  const id = DESIGNATED_SPREADSHEETS[key];
  return { id, url: sheetUrl(id) };
}

export function sheetUrl(id: string): string {
  return `https://docs.google.com/spreadsheets/d/${id}/edit`;
}

// ---------- table discovery (auto-includes future tables) ----------

export type DiscoveredTable = {
  table_name: string;
  columns: string[];
  cursor_column: string | null;
  est_rows: number;
};

export async function discoverTables(): Promise<DiscoveredTable[]> {
  const db = await admin();
  const { data, error } = await (db as any).rpc("backup_list_tables");
  if (error) throw new Error(error.message);
  return ((data ?? []) as DiscoveredTable[]).filter((t) => !NEVER_BACKUP.has(t.table_name));
}

/** Registers any table not yet tracked. Existing rows keep their settings. */
export async function syncRegistry(): Promise<{ added: string[]; total: number }> {
  const db = await admin();
  const discovered = await discoverTables();
  const { data: known } = await db.from("backup_tables").select("table_name");
  const knownSet = new Set(((known ?? []) as { table_name: string }[]).map((k) => k.table_name));
  const added = discovered.filter((t) => !knownSet.has(t.table_name));
  if (added.length) {
    await db.from("backup_tables").insert(
      added.map((t) => ({
        table_name: t.table_name,
        sheet_name: sheetNameFor(t.table_name),
        cursor_column: t.cursor_column,
        enabled: true,
        direction: "push",
      })),
    );
  }
  return { added: added.map((t) => t.table_name), total: discovered.length };
}

// ---------- value serialisation ----------

// A cell over 50 000 characters makes Google reject the whole request, which used to
// fail every append for that table — Settings had been stuck since mid-August because
// of one row. Values are shortened instead, and the shortening is reported.
function formatSheetDate(value: unknown): unknown {
  const raw = String(value ?? "").trim();
  const match = /^(\\d{4})-(\\d{2})-(\\d{2})$/.exec(raw);
  if (!match) return value;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return value;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) return value;
  const months = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];
  return `${String(day).padStart(2, "0")}-${months[month - 1]}-${String(year).slice(-2)}`;
}

const MAX_CELL_CHARS = 45_000;

// Announcement images are kept as base64 data URLs inside the settings JSON, so one
// value can be several megabytes. No spreadsheet cell can ever hold those, so the
// payload is dropped and only its size is noted.
function squeeze(text: string): string {
  let out = text;
  if (out.length > MAX_CELL_CHARS) {
    out = out.replace(/data:[^"'\\\s]{200,}/g, (m) => {
      const head = m.slice(0, m.indexOf(",") + 1);
      return `${head}[base64 payload of ${m.length.toLocaleString()} characters not mirrored]`;
    });
  }
  if (out.length > MAX_CELL_CHARS) {
    out = `${out.slice(0, MAX_CELL_CHARS)}…[shortened: ${out.length.toLocaleString()} characters in all]`;
  }
  return out;
}

function cell(value: unknown, onShortened?: (originalLength: number) => void): string | number | boolean {
  if (value === null || value === undefined) return "";
  if (typeof value === "number" || typeof value === "boolean") return value;
  const formattedDate = formatSheetDate(value);
  if (formattedDate !== value) return formattedDate as string;
  const raw = typeof value === "object" ? JSON.stringify(value) : String(value);
  const fitted = squeeze(raw);
  if (fitted !== raw) onShortened?.(raw.length);
  return fitted;
}

function pickKeyColumn(columns: string[]): string {
  if (columns.includes("id")) return "id";
  if (columns.includes("user_id")) return "user_id";
  if (columns.includes("key")) return "key";
  return columns[0]!;
}

function orderColumns(columns: string[]): string[] {
  const key = pickKeyColumn(columns);
  return [key, ...columns.filter((c) => c !== key)];
}

// ---------- per-table sync ----------

export type TableSyncOutcome = {
  table: string;
  sheet: string;
  rows: number;
  mode: "full" | "incremental";
  cursor: string | null;
  errors: { row_id: string; message: string }[];
};

async function fetchRows(
  table: string,
  since: string | null,
): Promise<Record<string, unknown>[]> {
  const db = await admin();
  const out: Record<string, unknown>[] = [];
  for (let offset = 0; offset < SAFETY_MAX_ROWS; offset += PAGE_SIZE) {
    const { data, error } = await (db as any).rpc("backup_fetch_rows", {
      _table: table,
      _since: since,
      _limit: PAGE_SIZE,
      _offset: offset,
    });
    if (error) throw new Error(error.message);
    const page = (data ?? []) as Record<string, unknown>[];
    out.push(...page);
    if (page.length < PAGE_SIZE) return out;
  }
  throw new Error(
    `${table} returned more than ${SAFETY_MAX_ROWS.toLocaleString()} rows, so the backup stopped instead of mirroring part of it`,
  );
}

async function countRows(table: string): Promise<number> {
  const db = await admin();
  const { data, error } = await (db as any).rpc("backup_count_rows", { _table: table });
  if (error) throw new Error(error.message);
  return Number(data ?? 0);
}

async function ensureSheetTab(spreadsheetId: string, sheet: string, existing: Map<string, number>): Promise<number | null> {
  const found = existing.get(sheet);
  if (found !== undefined) return found;
  const id = await addSheet(spreadsheetId, sheet);
  if (id !== null) existing.set(sheet, id);
  return id;
}

/** Best-effort brand styling — a formatting failure must never fail a data sync. */
async function tryFormat(spreadsheetId: string, sheetId: number | null, columnCount: number) {
  if (sheetId === null) return;
  try {
    await applyBrandFormatting(spreadsheetId, sheetId, { headerRowIndex: 0, columnCount });
  } catch (err) {
    console.error("[backup] brand formatting skipped:", err instanceof Error ? err.message : err);
  }
}

export async function syncTable(
  spreadsheetId: string,
  cfg: { table_name: string; sheet_name: string; cursor_column: string | null; last_cursor: string | null },
  opts: {
    full: boolean;
    existingSheets: Map<string, number>;
    rowFilter?: (row: Record<string, unknown>) => boolean;
    verifyWrite?: boolean;
  },
): Promise<TableSyncOutcome> {
  const errors: { row_id: string; message: string }[] = [];
  const since = opts.full ? null : cfg.last_cursor;
  const fetchedRows = await fetchRows(cfg.table_name, since);
  const rowFilter = opts.rowFilter ?? rowFilterFor(cfg.table_name);
  const rows = rowFilter ? fetchedRows.filter(rowFilter) : fetchedRows;

  const sheetId = await ensureSheetTab(spreadsheetId, cfg.sheet_name, opts.existingSheets);

  // Even an empty filtered projection must be reconciled. Returning before the
  // clear below used to leave stale rows in worksheets after a transaction was
  // moved, deleted, or reclassified.
  if (!rows.length) {
    const existingHeader = await readRange(spreadsheetId, `${quoteSheet(cfg.sheet_name)}!1:1`);
    await clearSheet(spreadsheetId, cfg.sheet_name);
    if (existingHeader[0]?.length) {
      await writeRange(
        spreadsheetId,
        `${quoteSheet(cfg.sheet_name)}!A1:${colLetter(existingHeader[0].length - 1)}1`,
        existingHeader,
      );
    }
    return {
      table: cfg.table_name,
      sheet: cfg.sheet_name,
      rows: 0,
      mode: opts.full ? "full" : "incremental",
      cursor: cfg.last_cursor,
      errors,
    };
  }

  const columns = orderColumns(
    Array.from(new Set(rows.flatMap((r) => Object.keys(r)))),
  );
  const keyCol = columns[0]!;
  const quoted = quoteSheet(cfg.sheet_name);

  // Read the existing header so a schema change is detected and healed.
  const headerRow = opts.full ? [] : await readRange(spreadsheetId, `${quoted}!1:1`);
  const header = (headerRow[0] ?? []).map((h) => String(h));
  const headerMatches =
    header.length === columns.length && header.every((h, i) => h === columns[i]);

  let mode: "full" | "incremental" = opts.full || !headerMatches ? "full" : "incremental";

  // A schema/header change forces a complete rewrite of that worksheet.
  const allFetchedRows = mode === "full" && since !== null ? await fetchRows(cfg.table_name, null) : rows;
  const allRows = rowFilter ? allFetchedRows.filter(rowFilter) : allFetchedRows;

  const seen = new Set<string>();
  const toValues = (r: Record<string, unknown>): (string | number | boolean)[] => {
    const rowId = r[keyCol] === null || r[keyCol] === undefined ? "" : String(r[keyCol]);
    return columns.map((c) =>
      cell(r[c], (len) =>
        errors.push({
          row_id: rowId,
          message: `${c} holds ${len.toLocaleString()} characters, more than one spreadsheet cell can hold, so it was shortened in the backup`,
        }),
      ),
    );
  };

  const valid: Record<string, unknown>[] = [];
  for (const r of allRows) {
    const id = r[keyCol];
    const idStr = id === null || id === undefined ? "" : String(id);
    if (!idStr) {
      errors.push({ row_id: "", message: `Row in ${cfg.table_name} has no ${keyCol} value` });
      continue; // one bad row never stops the run
    }
    if (seen.has(idStr)) {
      errors.push({ row_id: idStr, message: `Duplicate ${keyCol} skipped` });
      continue;
    }
    seen.add(idStr);
    valid.push(r);
  }

  if (mode === "full") {
    await clearSheet(spreadsheetId, cfg.sheet_name);
    const lastCol = colLetter(columns.length - 1);
    await writeRange(spreadsheetId, `${quoted}!A1:${lastCol}1`, [columns]);
    await appendRows(spreadsheetId, cfg.sheet_name, valid.map(toValues));
    // Header gets (re)written on every full sync, so re-apply the brand look here —
    // it's idempotent and keeps a schema change from leaving a plain, unstyled header.
    await tryFormat(spreadsheetId, sheetId, columns.length);
  } else {
    // Incremental upsert: update rows already present, append the rest.
    const keyColumnValues = await readRange(spreadsheetId, `${quoted}!A2:A`);
    const rowIndexByKey = new Map<string, number>();
    keyColumnValues.forEach((r, i) => {
      const k = r?.[0] === undefined || r?.[0] === null ? "" : String(r[0]);
      if (k) rowIndexByKey.set(k, i + 2);
    });
    const lastCol = colLetter(columns.length - 1);
    const updates: { range: string; values: unknown[][] }[] = [];
    const appends: (string | number | boolean)[][] = [];
    for (const r of valid) {
      const idStr = String(r[keyCol]);
      const rowNum = rowIndexByKey.get(idStr);
      if (rowNum) updates.push({ range: `${quoted}!A${rowNum}:${lastCol}${rowNum}`, values: [toValues(r)] });
      else appends.push(toValues(r));
    }
    await batchWrite(spreadsheetId, updates);
    await appendRows(spreadsheetId, cfg.sheet_name, appends);
  }

  if (opts.verifyWrite) {
    const lastCol = colLetter(columns.length - 1);
    const readBack = await readRange(spreadsheetId, `${quoted}!A2:${lastCol}`);
    const actualByKey = new Map<string, string[]>();
    for (const row of readBack) {
      const key = row?.[0] === undefined || row?.[0] === null ? "" : String(row[0]);
      if (key) actualByKey.set(key, row.map((value) => String(value ?? "")));
    }
    for (const row of valid) {
      const expected = toValues(row).map((value) => String(value ?? ""));
      const key = String(row[keyCol]);
      const actual = actualByKey.get(key);
      if (!actual) {
        errors.push({ row_id: key, message: cfg.table_name + ": row was written but could not be read back from `" + cfg.sheet_name + "`" });
        continue;
      }
      if (actual.length !== expected.length || actual.some((value, index) => value !== expected[index])) {
        errors.push({ row_id: key, message: cfg.table_name + ": read-back verification failed for `" + cfg.sheet_name + "`" });
      }
    }
  }
  if (mode === "full") {
    // A full mirror must hold the whole table. Counting both sides turns a
    // silently partial write into a visible error instead of a green tick.
    try {
      const dbRows = rowFilter
        ? (await fetchRows(cfg.table_name, null)).filter(rowFilter).length
        : await countRows(cfg.table_name);
      if (dbRows !== valid.length) {
        errors.push({
          row_id: "",
          message: `${cfg.table_name}: ${dbRows.toLocaleString()} rows in the database but ${valid.length.toLocaleString()} mirrored to the ${cfg.sheet_name} worksheet`,
        });
      }
    } catch (err) {
      errors.push({
        row_id: "",
        message: `${cfg.table_name}: mirrored row count could not be verified (${err instanceof Error ? err.message : String(err)})`,
      });
    }
  }

  // Advance the incremental cursor to the newest timestamp we just wrote.
  let cursor = cfg.last_cursor;
  const cursorCol = cfg.cursor_column;
  if (cursorCol) {
    for (const r of valid) {
      const v = r[cursorCol];
      if (typeof v === "string" && (!cursor || v > cursor)) cursor = v;
    }
  }

  return {
    table: cfg.table_name,
    sheet: cfg.sheet_name,
    rows: valid.length,
    mode,
    cursor,
    errors,
  };
}

/**
 * Reconcile only the Banks & Wallets workbook.
 * This intentionally bypasses the broad Accounts Book mirror so a manual repair
 * cannot touch Daily Cash Book, Sales Accounts, Expenses, or other workbooks.
 */
export async function reconcileBanksWalletsToSheets() {
  const db = await admin();
  const startedAt = new Date().toISOString();
  const { data: runRow, error: runInsertError } = await db
    .from("backup_runs")
    .insert({ kind: "banks-wallets-reconciliation", status: "running" })
    .select("id")
    .single();
  if (runInsertError) throw new Error(runInsertError.message);
  const runId = (runRow as { id: string }).id;
  const outcomes: TableSyncOutcome[] = [];
  const failures: { table: string; message: string }[] = [];

  try {
    const target = await ensureSpreadsheet("banksWallets");
    const info = await getSpreadsheet(target.id);
    const existingSheets = new Map((info.sheets ?? []).map((s) => [s.properties.title, s.properties.sheetId] as const));
    const safeSheetPart = (value: string) => value.replace(/[\\/:*?\[\]]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80) || "Uncategorized";

    const { data: allBankWalletAccounts, error: accountsError } = await db
      .from("accounts_book_accounts").select("id,name,kind,opening_balance,opening_balance_date,created_at,is_active").in("kind", ["bank", "wallet"]).order("created_at");
    if (accountsError) throw new Error(accountsError.message);

    // Standardized provisioning: EVERY active bank/wallet account gets a
    // canonical "<Name> Account" tab and a master-tab row automatically —
    // whether it is an initial account or newly added from the admin panel.
    // Inactive or deleted accounts and their tabs are removed automatically,
    // so no account ever needs manual design or manual cleanup again.
    const activeAccounts = (allBankWalletAccounts ?? []).filter((account) => account.is_active !== false);
    const inactiveAccounts = (allBankWalletAccounts ?? []).filter((account) => account.is_active === false);
    const accounts = activeAccounts;

    // Banks & Wallets master tab: keep opening position visible alongside each account.
    const accountRows: (string | number)[][] = [
      ["Account", "Type", "Opening Balance", "Opening Date", "Current Balance"]
    ];
    for (const account of accounts ?? []) {
      const opening = Number((account as any).opening_balance ?? 0);
      const txns = (await db
        .from("accounts_book_transactions")
        .select("amount,direction")
        .eq("account_id", account.id)
        .order("entry_date", { ascending: true })
        .order("created_at", { ascending: true })).data ?? [];
      const current = txns.reduce((balance, t) => balance + (t.direction === "in" ? Number(t.amount || 0) : -Number(t.amount || 0)), opening);
      accountRows.push([
        String(account.name),
        String(account.kind),
        opening,
        String(formatSheetDate((account as any).opening_balance_date) || ""),
        current
      ]);
    }
    await ensureSheetTab(target.id, "Banks & Wallets", existingSheets);
    await clearSheet(target.id, "Banks & Wallets");
    await writeRange(target.id, "'Banks & Wallets'!A1:E" + accountRows.length, accountRows);
    outcomes.push({
      table: "accounts_book_accounts",
      sheet: "Banks & Wallets",
      rows: accountRows.length - 1,
      mode: "full",
      cursor: null,
      errors: []
    });

    // Clean account tab names. Keep exactly one canonical "<Account> Account"
    // worksheet per account and remove spacing/numbered duplicates such as
    // "Jazz Cash Account" and "Jazz Cash 2".
    const normalizeAccountTab = (value: string) =>
      value.toLowerCase().replace(/\s+/g, " ").trim().replace(/\s+\d+$/, "").replace(/ account$/, "").replace(/\s+/g, "");

    const removedBaseKeys = new Set(inactiveAccounts.map((account) => normalizeAccountTab(safeSheetPart(String(account.name)))));
    const nameCounts = new Map<string, number>();
    for (const account of accounts ?? []) {
      const base = safeSheetPart(String(account.name));
      nameCounts.set(base, (nameCounts.get(base) ?? 0) + 1);
    }
    const seenNames = new Set<string>();
    const sheetNameByAccountId = new Map<string, string>();
    for (const account of accounts ?? []) {
      const base = safeSheetPart(String(account.name));
      const isDuplicateName = (nameCounts.get(base) ?? 0) > 1;
      const disambiguated = isDuplicateName && seenNames.has(base)
        ? `${base} (${String(account.id).slice(0, 6)})`
        : base;
      seenNames.add(base);
      const canonical = `${disambiguated} Account`;
      sheetNameByAccountId.set(String(account.id), canonical);
    }

    for (const account of accounts ?? []) {
      const base = safeSheetPart(String(account.name));
      const canonical = sheetNameByAccountId.get(String(account.id)) ?? `${base} Account`;
      const baseKey = normalizeAccountTab(base);
      for (const title of Array.from(existingSheets.keys())) {
        if (title === canonical) continue;
        const titleKey = normalizeAccountTab(title);
        const legacyPrefix = title.startsWith("Bank - ") || title.startsWith("Wallet - ");
        if (titleKey !== baseKey && !removedBaseKeys.has(titleKey) && !legacyPrefix) continue;
        const legacyId = existingSheets.get(title);
        if (legacyId === undefined) continue;
        try {
          await deleteSheet(target.id, legacyId);
          existingSheets.delete(title);
        } catch (error) {
          failures.push({
            table: "accounts_book_transactions",
            message: "Could not remove duplicate/legacy Banks & Wallets tab \"" + title + "\": " + (error instanceof Error ? error.message : String(error)),
          });
        }
      }
    }
    // Remove orphaned account tabs whose account row was fully deleted.
    const activeBaseKeys = new Set(activeAccounts.map((account) => normalizeAccountTab(safeSheetPart(String(account.name)))));
    for (const title of Array.from(existingSheets.keys())) {
      if (title === "Banks & Wallets") continue;
      if (!title.endsWith(" Account")) continue;
      const titleKey = normalizeAccountTab(title);
      if (activeBaseKeys.has(titleKey)) continue;
      const orphanId = existingSheets.get(title);
      if (orphanId === undefined) continue;
      try {
        await deleteSheet(target.id, orphanId);
        existingSheets.delete(title);
      } catch (error) {
        failures.push({
          table: "accounts_book_accounts",
          message: "Could not remove orphaned tab \"" + title + "\": " + (error instanceof Error ? error.message : String(error)),
        });
      }
    }
    if ([...nameCounts.values()].some((n) => n > 1)) {
      // Informational only — not a sync failure, so it doesn't flip the run to "partial".
      console.warn("[backup] Banks & Wallets: duplicate account names found; tabs disambiguated with an id suffix. Consider renaming the duplicates in the Accounts Book.");
    }

    // Fetch all active transactions for these accounts to build clean (Date, Description, Debit, Credit, Balance) ledgers
    const { data: allAccountTxns, error: txError } = await db
      .from("accounts_book_transactions")
      .select("id,account_id,entry_date,created_at,description,category,party,amount,direction")
      .order("entry_date", { ascending: true })
      .order("created_at", { ascending: true });
    if (txError) throw new Error(txError.message);

    for (const account of accounts ?? []) {
      const sheet = sheetNameByAccountId.get(String(account.id)) ?? safeSheetPart(String(account.name));
      try {
        await ensureSheetTab(target.id, sheet, existingSheets);
        const txns = (allAccountTxns ?? []).filter((t) => String(t.account_id ?? "") === String(account.id));
        
        const openingBalance = Number((account as any).opening_balance ?? 0);
        let runningBalance = openingBalance;
        const opDate = String((account as any).opening_balance_date || ((account as any).created_at ? String((account as any).created_at).split("T")[0] : ""));
        
        const txRows: (string | number)[][] = [
          [
            opDate,
            "Opening Balance",
            openingBalance > 0 ? openingBalance : "",
            openingBalance < 0 ? Math.abs(openingBalance) : "",
            openingBalance
          ]
        ];

        for (const t of txns) {
          const amt = Number(t.amount || 0);
          const isDebit = t.direction === "out";
          if (isDebit) runningBalance -= amt;
          else runningBalance += amt;

          const descParts: string[] = [];
          if (t.category) descParts.push("[" + t.category + "]");
          if (t.description) descParts.push(String(t.description));
          if (t.party) descParts.push("(" + t.party + ")");
          const formattedDesc = descParts.join(" ") || "Transaction";

          txRows.push([
            String(formatSheetDate(t.entry_date) || ""),
            formattedDesc,
            isDebit ? amt : "",
            !isDebit ? amt : "",
            runningBalance
          ]);
        }

        const rows: (string | number)[][] = [
          ["Date", "Description", "Debit", "Credit", "Balance"],
          ...txRows
        ];

        await clearSheet(target.id, sheet);
        await writeRange(target.id, `'${sheet}'!A1:E${rows.length}`, rows);
        outcomes.push({
          table: "accounts_book_transactions",
          sheet,
          rows: rows.length - 1,
          mode: "full",
          cursor: null,
          errors: []
        });
      } catch (error) {
        failures.push({ table: "accounts_book_transactions", message: sheet + ": " + (error instanceof Error ? error.message : String(error)) });
      }
    }

    const warnings = outcomes.flatMap((o) => o.errors);
    if (warnings.length) await db.from("backup_errors").insert(warnings.slice(0, 100).map((warning) => ({ run_id: runId, table_name: "accounts_book_transactions", row_id: warning.row_id, severity: "warning", message: warning.message })));
    if (failures.length) await db.from("backup_errors").insert(failures.map((failure) => ({ run_id: runId, table_name: failure.table || "accounts_book_transactions", severity: "error", message: failure.message })));

    const status = failures.length || warnings.length ? "partial" : "success";
    const finishedAt = new Date().toISOString();
    await db.from("backup_runs").update({ status, finished_at: finishedAt, tables_synced: outcomes.length, rows_synced: outcomes.reduce((sum, outcome) => sum + outcome.rows, 0), error_count: failures.length, message: failures.length ? failures.map((failure) => failure.message).join(" | ").slice(0, 1000) : "", details: { scope: "banksWallets", spreadsheetId: target.id, startedAt, outcomes, failures } as any }).eq("id", runId);
    return { runId, status, spreadsheetId: target.id, spreadsheetUrl: target.url, accounts: (accounts ?? []).map((account) => account.name), outcomes, failures, warningCount: warnings.length };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    failures.push({ table: "banksWallets", message });
    await db.from("backup_errors").insert({ run_id: runId, table_name: "banksWallets", severity: "error", message });
    await db.from("backup_runs").update({ status: "failed", finished_at: new Date().toISOString(), tables_synced: outcomes.length, rows_synced: outcomes.reduce((sum, outcome) => sum + outcome.rows, 0), error_count: 1, message: message.slice(0, 1000), details: { scope: "banksWallets", failures } as any }).eq("id", runId);
    return { runId, status: "failed", spreadsheetId: DESIGNATED_SPREADSHEETS.banksWallets, spreadsheetUrl: sheetUrl(DESIGNATED_SPREADSHEETS.banksWallets), accounts: [], outcomes, failures, warningCount: 0 };
  }
}


/**
 * Reconcile only the Sales Accounts workbook.
 * Syncs the master Sales Accounts sheet and individual category tabs (e.g. Saudia Visa Process).
 */
export async function reconcileSalesAccountsToSheets() {
  const db = await admin();
  const startedAt = new Date().toISOString();
  const { data: runRow, error: runInsertError } = await db
    .from("backup_runs")
    .insert({ kind: "sales-accounts-reconciliation", status: "running" })
    .select("id")
    .single();
  if (runInsertError) throw new Error(runInsertError.message);
  const runId = (runRow as { id: string }).id;
  const outcomes: TableSyncOutcome[] = [];
  const failures: { table: string; message: string }[] = [];

  try {
    const target = await ensureSpreadsheet("salesAccounts");
    const info = await getSpreadsheet(target.id);
    const existingSheets = new Map((info.sheets ?? []).map((s) => [s.properties.title, s.properties.sheetId] as const));
    const safeSheetPart = (value: string) => value.replace(/[\/:*?\[\]]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80) || "Uncategorized";

    // 1. Sync master Sales Accounts sheet
    const masterOutcome = await syncTable(target.id, {
      table_name: "accounts_book_transactions", sheet_name: "Sales Accounts", cursor_column: null, last_cursor: null,
    }, {
      full: true, existingSheets, rowFilter: isSalesTransaction, verifyWrite: true,
    });
    outcomes.push(masterOutcome);

    // 2. Discover categories from accounts_book_services and existing sale transactions
    const { data: categoryServices } = await db
      .from("accounts_book_services")
      .select("name")
      .eq("is_active", true);

    const salesCategories = new Set<string>(
      (categoryServices ?? [])
        .map((s) => String(s.name ?? ""))
        .filter((name) => name && !name.startsWith("EXP: "))
    );

    const { data: transactionCategories } = await db
      .from("accounts_book_transactions")
      .select("category")
      .eq("source_type", "sale");

    for (const row of transactionCategories ?? []) {
      const cat = String(row.category ?? "").trim();
      if (cat) salesCategories.add(cat);
    }

    // Clean up any old prefixed tabs like 'Sales - <Category>'
    for (const category of salesCategories) {
      const legacy = `Sales - ${safeSheetPart(category)}`;
      const legacyId = existingSheets.get(legacy);
      if (legacyId !== undefined && legacy !== safeSheetPart(category)) {
        try {
          await deleteSheet(target.id, legacyId);
          existingSheets.delete(legacy);
        } catch (err) {
          console.warn("[backup] could not delete legacy sales tab", legacy, err);
        }
      }
    }

    // 3. Sync each category tab (e.g. Saudia Visa Process, Appointments, Umrah, etc.)
    const txConfig = (await db.from("backup_tables").select("cursor_column").eq("table_name", "accounts_book_transactions").maybeSingle()).data as { cursor_column?: string | null } | null;
    for (const category of salesCategories) {
      const sheet = safeSheetPart(category);
      try {
        const outcome = await syncTable(target.id, {
          table_name: "accounts_book_transactions", sheet_name: sheet, cursor_column: txConfig?.cursor_column ?? "updated_at", last_cursor: null,
        }, {
          full: true,
          existingSheets,
          rowFilter: (row) => isSalesTransaction(row) && String(row.category ?? "").trim().toLowerCase() === category.toLowerCase(),
          verifyWrite: true,
        });
        outcomes.push(outcome);
      } catch (error) {
        failures.push({ table: "accounts_book_transactions", message: sheet + ": " + (error instanceof Error ? error.message : String(error)) });
      }
    }

    const warnings = outcomes.flatMap((o) => o.errors);
    if (warnings.length) await db.from("backup_errors").insert(warnings.slice(0, 100).map((warning) => ({ run_id: runId, table_name: "accounts_book_transactions", row_id: warning.row_id, severity: "warning", message: warning.message })));
    if (failures.length) await db.from("backup_errors").insert(failures.map((failure) => ({ run_id: runId, table_name: failure.table || "accounts_book_transactions", severity: "error", message: failure.message })));

    const status = failures.length || warnings.length ? "partial" : "success";
    const finishedAt = new Date().toISOString();
    await db.from("backup_runs").update({ status, finished_at: finishedAt, tables_synced: outcomes.length, rows_synced: outcomes.reduce((sum, outcome) => sum + outcome.rows, 0), error_count: failures.length, message: failures.length ? failures.map((failure) => failure.message).join(" | ").slice(0, 1000) : "", details: { scope: "salesAccounts", spreadsheetId: target.id, startedAt, outcomes, failures } as any }).eq("id", runId);
    return { runId, status, spreadsheetId: target.id, spreadsheetUrl: target.url, categories: Array.from(salesCategories), outcomes, failures, warningCount: warnings.length };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    failures.push({ table: "salesAccounts", message });
    await db.from("backup_errors").insert({ run_id: runId, table_name: "salesAccounts", severity: "error", message });
    await db.from("backup_runs").update({ status: "failed", finished_at: new Date().toISOString(), tables_synced: outcomes.length, rows_synced: outcomes.reduce((sum, outcome) => sum + outcome.rows, 0), error_count: 1, message: message.slice(0, 1000), details: { scope: "salesAccounts", failures } as any }).eq("id", runId);
    return { runId, status: "failed", spreadsheetId: DESIGNATED_SPREADSHEETS.salesAccounts, spreadsheetUrl: sheetUrl(DESIGNATED_SPREADSHEETS.salesAccounts), categories: [], outcomes, failures, warningCount: 0 };
  }
}


/**
 * Reconcile the Daily Cash Book workbook.
 * Syncs all cash, bank, and wallet transactions (including transfers)
 * to the official Daily Cash Book sheet.
 */
export async function reconcileDailyCashBookToSheets() {
  const db = await admin();
  const startedAt = new Date().toISOString();
  const { data: runRow, error: runInsertError } = await db
    .from("backup_runs")
    .insert({ kind: "daily-cash-book-reconciliation", status: "running" })
    .select("id")
    .single();
  if (runInsertError) throw new Error(runInsertError.message);
  const runId = (runRow as { id: string }).id;
  const outcomes: TableSyncOutcome[] = [];
  const failures: { table: string; message: string }[] = [];

  try {
    const target = await ensureSpreadsheet("dailyCashBook");
    const info = await getSpreadsheet(target.id);
    const existingSheets = new Map((info.sheets ?? []).map((s) => [s.properties.title, s.properties.sheetId] as const));
    const sheet = "Daily Cash Book";
    await ensureSheetTab(target.id, sheet, existingSheets);

    // Fetch all active cash, bank, and wallet accounts
    const { data: accounts, error: accError } = await db
      .from("accounts_book_accounts")
      .select("id,name,kind")
      .in("kind", ["cash", "bank", "wallet"])
      .eq("is_active", true);
    if (accError) throw new Error(accError.message);

    const accountMap = new Map((accounts ?? []).map((a) => [String(a.id), String(a.name)]));
    const accountIds = Array.from(accountMap.keys());

    // Fetch transactions for money accounts
    const { data: txns, error: txError } = await db
      .from("accounts_book_transactions")
      .select("id,account_id,entry_date,created_at,description,category,party,amount,direction")
      .in("account_id", accountIds)
      .order("entry_date", { ascending: true })
      .order("created_at", { ascending: true });
    if (txError) throw new Error(txError.message);

    let runningBalance = 0;
    const dataRows: (string | number)[][] = [];
    let sr = 1;

    for (const t of txns ?? []) {
      const amt = Number(t.amount || 0);
      const isCashIn = t.direction === "in";
      if (isCashIn) runningBalance += amt;
      else runningBalance -= amt;

      const accName = accountMap.get(String(t.account_id)) || "Account";
      const descParts: string[] = ["[" + accName + "]"];
      if (t.description) descParts.push(String(t.description));
      if (t.party) descParts.push("(" + t.party + ")");
      const fullDesc = descParts.join(" ");

      dataRows.push([
        sr++,
        String(t.entry_date || ""),
        fullDesc,
        String(t.category || "General"),
        isCashIn ? amt : "",
        !isCashIn ? amt : "",
        runningBalance
      ]);
    }

    const rows: (string | number)[][] = [
      ["SR", "Date", "Description / Particulars", "Category", "Cash In (PKR)", "Cash Out (PKR)", "Balance (PKR)"],
      ...dataRows
    ];

    await clearSheet(target.id, sheet);
    await writeRange(target.id, `'${sheet}'!A1:G${rows.length}`, rows);

    outcomes.push({
      table: "accounts_book_transactions",
      sheet,
      rows: dataRows.length,
      mode: "full",
      cursor: null,
      errors: []
    });

    const finishedAt = new Date().toISOString();
    await db.from("backup_runs").update({
      status: "success",
      finished_at: finishedAt,
      tables_synced: outcomes.length,
      rows_synced: dataRows.length,
      error_count: 0,
      details: { scope: "dailyCashBook", spreadsheetId: target.id, startedAt, outcomes, failures } as any
    }).eq("id", runId);

    return { runId, status: "success", spreadsheetId: target.id, spreadsheetUrl: target.url, outcomes, failures, warningCount: 0 };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    failures.push({ table: "dailyCashBook", message });
    await db.from("backup_errors").insert({ run_id: runId, table_name: "dailyCashBook", severity: "error", message });
    await db.from("backup_runs").update({ status: "failed", finished_at: new Date().toISOString(), tables_synced: 0, rows_synced: 0, error_count: 1, message: message.slice(0, 1000) }).eq("id", runId);
    return { runId, status: "failed", spreadsheetId: DESIGNATED_SPREADSHEETS.dailyCashBook, spreadsheetUrl: sheetUrl(DESIGNATED_SPREADSHEETS.dailyCashBook), outcomes, failures, warningCount: 0 };
  }
}

// ---------- run orchestration ----------

export type RunOptions = { kind?: string; full?: boolean; tables?: string[] };

export async function runSync(opts: RunOptions = {}) {
  const db = await admin();
  const kind = opts.kind ?? (opts.full ? "full" : "incremental");

  const { data: runRow } = await db
    .from("backup_runs")
    .insert({ kind, status: "running" })
    .select("id")
    .single();
  const runId = (runRow as { id: string } | null)?.id ?? null;

  const outcomes: TableSyncOutcome[] = [];
  const failures: { table: string; message: string }[] = [];
  // The default/primary spreadsheet reported back to the caller (shown as "the" link in
  // the admin UI) — individual tables may still route to their own designated spreadsheet.
  let spreadsheet: { id: string; url: string } | null = null;

  // One getSpreadsheet() lookup per distinct designated spreadsheet actually touched this run.
  const sheetCache = new Map<string, { id: string; existingSheets: Map<string, number> }>();
  async function sheetFor(key: keyof typeof DESIGNATED_SPREADSHEETS) {
    const cached = sheetCache.get(key);
    if (cached) return cached;
    const sp = await ensureSpreadsheet(key);
    const info = await getSpreadsheet(sp.id);
    const existingSheets = new Map((info.sheets ?? []).map((s) => [s.properties.title, s.properties.sheetId] as const));
    const entry = { id: sp.id, existingSheets };
    sheetCache.set(key, entry);
    return entry;
  }

  try {
    spreadsheet = await ensureSpreadsheet("addons");
    await syncRegistry();

    let query = db.from("backup_tables").select("*").eq("enabled", true).order("table_name");
    if (opts.tables?.length) query = query.in("table_name", opts.tables);
    const { data: configs, error } = await query;
    if (error) throw new Error(error.message);

    // Daily Cash Book is the complete daily money-movement view of Accounts Book.
    // It must include cash, bank and wallet payments (for example a Home Expense
    // paid from JazzCash), while the separate expense worksheets classify the same
    // transaction as Office Expenses or Home Expenses.
    const { data: moneyAccounts, error: moneyAccountsError } = await db
      .from("accounts_book_accounts")
      .select("id,name,kind")
      .in("kind", ["cash", "bank", "wallet"])
      .eq("is_active", true);
    if (moneyAccountsError) throw new Error(moneyAccountsError.message);
    const moneyAccountIds = new Set((moneyAccounts ?? []).map((row) => String(row.id)));

    const { data: categoryServices, error: categoryServicesError } = await db
      .from("accounts_book_services")
      .select("name")
      .eq("is_active", true)
      .order("name");
    if (categoryServicesError) throw new Error(categoryServicesError.message);

    const safeSheetPart = (value: string) =>
      value.replace(/[\\/:*?\[\]]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80) || "Uncategorized";

    // Canonicalize bank/wallet ledger tabs. Keep exactly one
    // "<Account> Account" worksheet per account and remove numbered/spacing
    // duplicates left by earlier naming schemes.
    const banksTarget = await sheetFor("banksWallets");
    const normalizeAccountTab = (value: string) =>
      value.toLowerCase().replace(/\s+/g, " ").trim().replace(/\s+\d+$/, "").replace(/ account$/, "").replace(/\s+/g, "");
    for (const account of (moneyAccounts ?? []).filter((row) => row.kind === "bank" || row.kind === "wallet")) {
      const base = safeSheetPart(String(account.name));
      const canonical = `${base} Account`;
      const baseKey = normalizeAccountTab(base);
      for (const title of Array.from(banksTarget.existingSheets.keys())) {
        if (title === canonical) continue;
        const titleKey = normalizeAccountTab(title);
        const legacyPrefix = title.startsWith("Bank - ") || title.startsWith("Wallet - ");
        if (titleKey !== baseKey && !legacyPrefix) continue;
        const legacyId = banksTarget.existingSheets.get(title);
        if (legacyId === undefined) continue;
        try {
          await deleteSheet(banksTarget.id, legacyId);
          banksTarget.existingSheets.delete(title);
        } catch (err) {
          console.warn("[backup] could not remove duplicate/legacy account tab", title, err);
        }
      }
    }

    const accountJobs = (moneyAccounts ?? []).map((account) => {
      return {
        key: account.kind === "cash" ? "dailyCashBook" as const : "banksWallets" as const,
        sheet: `${safeSheetPart(String(account.name))} Account`,
        filter: (row: Record<string, unknown>) => String(row.account_id ?? "") === String(account.id),
      };
    });

    const salesCategories = new Set<string>(
      (categoryServices ?? [])
        .map((s) => String(s.name ?? ""))
        .filter((name) => name && !name.startsWith("EXP: ")),
    );

    // Sales category tabs are named from the category alone (e.g. "Appointments"),
    // no "Sales - " prefix. Clean up any tab still using the old prefixed name so a
    // rerun doesn't leave both "Sales - Appointments" and "Appointments" side by side.
    const salesTargetForCleanup = await sheetFor("salesAccounts");
    for (const category of salesCategories) {
      const legacy = `Sales - ${safeSheetPart(category)}`;
      const legacyId = salesTargetForCleanup.existingSheets.get(legacy);
      if (legacyId === undefined) continue;
      try {
        await deleteSheet(salesTargetForCleanup.id, legacyId);
        salesTargetForCleanup.existingSheets.delete(legacy);
      } catch (err) {
        console.warn("[backup] could not remove legacy sales category tab", legacy, err);
      }
    }

    const expenseCategories = new Set<string>(
      (categoryServices ?? [])
        .map((s) => String(s.name ?? ""))
        .filter((name) => name.startsWith("EXP: "))
        .map((name) => name.slice(5).trim())
        .filter(Boolean),
    );

    const expensesTargetForCleanup = await sheetFor("expenses");
    for (const category of expenseCategories) {
      for (const prefix of ["Home - ", "Office - "]) {
        const legacy = `${prefix}${safeSheetPart(category)}`;
        const legacyId = expensesTargetForCleanup.existingSheets.get(legacy);
        if (legacyId !== undefined) {
          try {
            await deleteSheet(expensesTargetForCleanup.id, legacyId);
            expensesTargetForCleanup.existingSheets.delete(legacy);
          } catch (err) {
            console.warn("[backup] could not remove legacy expense category tab", legacy, err);
          }
        }
      }
    }

    const { data: transactionCategories, error: transactionCategoriesError } = await db
      .from("accounts_book_transactions")
      .select("category,source_type");
    if (transactionCategoriesError) throw new Error(transactionCategoriesError.message);
    for (const row of transactionCategories ?? []) {
      const category = String(row.category ?? "").trim();
      if (!category) continue;
      if (row.source_type === "sale") salesCategories.add(category);
      if (row.source_type === "expense") expenseCategories.add(category);
    }

    for (const cfg of (configs ?? []) as any[]) {
      if (NEVER_BACKUP.has(cfg.table_name)) continue;
      try {
        const syncOpts = { full: Boolean(opts.full), existingSheets: new Map<string, number>() };
        const primaryTarget = await sheetFor(spreadsheetKeyFor(cfg.table_name));
        syncOpts.existingSheets = primaryTarget.existingSheets;

        const mirrorJobs =
          cfg.table_name === "accounts_book_transactions"
            ? [
                { key: "dailyCashBook" as const, sheet: "Daily Cash Book", filter: (row: Record<string, unknown>) => moneyAccountIds.has(String(row.account_id ?? "")), dynamic: false },
                { key: "salesAccounts" as const, sheet: "Sales Accounts", filter: isSalesTransaction, dynamic: false },
                { key: "expenses" as const, sheet: "Office Expenses", filter: isOfficeExpense, dynamic: false },
                { key: "expenses" as const, sheet: "Home Expenses", filter: isHomeExpense, dynamic: false },
                ...accountJobs.map((job) => ({ ...job, dynamic: true })),
                ...Array.from(salesCategories).map((category) => ({
                  key: "salesAccounts" as const,
                  // Plain category name, no "Sales - " prefix — this is the standard
                  // format for category-based Google Sheet tab names going forward.
                  sheet: safeSheetPart(category),
                  filter: (row: Record<string, unknown>) => isSalesTransaction(row) && String(row.category ?? "") === category,
                  dynamic: true,
                })),
                // Expenses are strictly partitioned into Office Expenses and Home Expenses only
              ]
            : null;

        if (mirrorJobs) {
          const jobOutcomes: TableSyncOutcome[] = [];
          let latestCursor = cfg.last_cursor;
          for (const job of mirrorJobs) {
            const target = await sheetFor(job.key);
            const wasExisting = target.existingSheets.has(job.sheet);
            const jobFull = Boolean(opts.full) || (job.dynamic && (!wasExisting || job.sheet.endsWith(" Account")));
            const outcome = await syncTable(
              target.id,
              {
                table_name: cfg.table_name,
                sheet_name: job.sheet,
                cursor_column: cfg.cursor_column,
                last_cursor: jobFull ? null : cfg.last_cursor,
              },
              { full: jobFull, existingSheets: target.existingSheets, rowFilter: job.filter, verifyWrite: cfg.table_name === "accounts_book_transactions" },
            );
            jobOutcomes.push(outcome);
            if (outcome.cursor && (!latestCursor || outcome.cursor > latestCursor)) latestCursor = outcome.cursor;
          }

          const mergedErrors = jobOutcomes.flatMap((o) => o.errors);
          const totalRows = jobOutcomes.reduce((sum, o) => sum + o.rows, 0);
          outcomes.push({
            table: cfg.table_name,
            sheet: jobOutcomes.map((job) => job.sheet).join(" / "),
            rows: totalRows,
            mode: opts.full ? "full" : "incremental",
            cursor: latestCursor,
            errors: mergedErrors,
          });

          await db
            .from("backup_tables")
            .update({
              last_synced_at: new Date().toISOString(),
              last_cursor: latestCursor,
              last_row_count: totalRows,
            })
            .eq("table_name", cfg.table_name);

          if (mergedErrors.length && runId) {
            await db.from("backup_errors").insert(
              mergedErrors.slice(0, 100).map((e) => ({
                run_id: runId,
                table_name: cfg.table_name,
                row_id: e.row_id,
                severity: "warning",
                message: e.message,
              })),
            );
          }
        } else {
          const target = await sheetFor(spreadsheetKeyFor(cfg.table_name));
          const outcome = await syncTable(
            target.id,
            {
              table_name: cfg.table_name,
              sheet_name: sheetNameForTable(cfg.table_name),
              cursor_column: cfg.cursor_column,
              last_cursor: opts.full ? null : cfg.last_cursor,
            },
            syncOpts,
          );
          outcomes.push(outcome);

          await db
            .from("backup_tables")
            .update({
              last_synced_at: new Date().toISOString(),
              last_cursor: outcome.cursor,
              last_row_count: outcome.rows,
            })
            .eq("table_name", cfg.table_name);

          if (outcome.errors.length && runId) {
            await db.from("backup_errors").insert(
              outcome.errors.slice(0, 50).map((e) => ({
                run_id: runId,
                table_name: cfg.table_name,
                row_id: e.row_id,
                severity: "warning",
                message: e.message,
              })),
            );
          }
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        failures.push({ table: cfg.table_name, message });
        if (runId) {
          await db.from("backup_errors").insert({
            run_id: runId,
            table_name: cfg.table_name,
            severity: "error",
            message,
          });
        }
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    failures.push({ table: "", message });
    if (runId) {
      await db.from("backup_errors").insert({ run_id: runId, severity: "error", message });
    }
  }

  const rowsSynced = outcomes.reduce((a, o) => a + o.rows, 0);
  const warningCount = outcomes.reduce((a, o) => a + o.errors.length, 0);
  const status = failures.length ? (outcomes.length ? "partial" : "failed") : "success";

  if (runId) {
    await db
      .from("backup_runs")
      .update({
        status,
        finished_at: new Date().toISOString(),
        tables_synced: outcomes.length,
        rows_synced: rowsSynced,
        error_count: failures.length,
        message: failures.length ? failures.map((f) => `${f.table}: ${f.message}`).join(" | ").slice(0, 1000) : "",
        details: { outcomes, failures, warningCount } as any,
      })
      .eq("id", runId);
  }

  return {
    runId,
    status,
    spreadsheetUrl: spreadsheet?.url ?? null,
    tablesSynced: outcomes.length,
    rowsSynced,
    warningCount,
    failures,
    outcomes,
  };
}

/** Point-in-time snapshot: a timestamped copy of every table in its own tab set. */
export async function createSnapshot(label?: string, kind = "manual") {
  const db = await admin();
  const stamp = new Date().toISOString().replace("T", " ").slice(0, 16);
  const title = label?.trim() || `Snapshot ${stamp}`;
  const spreadsheet = await ensureSnapshotArchiveSpreadsheet();

  // Snapshots are deliberately stored in a separate workbook and never mixed into
  // the five-tab emergency financial workbook.
  // A snapshot interrupted by the request timeout never writes its status back, so
  // it would sit marked as running forever. Close those off before starting a new one.
  const { error: reaped } = await db
    .from("backup_snapshots")
    .update({
      status: "failed",
      message: "The backup process was cut off before it could finish.",
      finished_at: new Date().toISOString(),
    })
    .eq("status", "running")
    .lt("taken_at", new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString());
  if (reaped) console.error("[backup] could not close off abandoned snapshots:", reaped.message);

  const { data: snapRow } = await db
    .from("backup_snapshots")
    .insert({ label: title, kind, spreadsheet_id: spreadsheet.id, status: "running" })
    .select("id")
    .single();
  const snapshotId = (snapRow as { id: string } | null)?.id ?? null;

  const rowCounts: Record<string, number> = {};
  let total = 0;
  let message = "";
  let status = "success";

  try {
    const info = await getSpreadsheet(spreadsheet.id);
    const existingSheets = new Map((info.sheets ?? []).map((s) => [s.properties.title, s.properties.sheetId] as const));
    const tables = await discoverTables();
    const shortStamp = new Date().toISOString().replace(/[:.]/g, "").slice(0, 13);

    for (const t of tables) {
      const rows = await fetchRows(t.table_name, null);
      const sheet = `SNAP ${shortStamp} ${sheetNameFor(t.table_name)}`.slice(0, 95);
      const sheetId = await ensureSheetTab(spreadsheet.id, sheet, existingSheets);
      const columns = orderColumns(
        rows.length ? Array.from(new Set(rows.flatMap((r) => Object.keys(r)))) : t.columns,
      );
      await writeRange(spreadsheet.id, `${quoteSheet(sheet)}!A1`, [columns]);
      if (rows.length) {
        await appendRows(
          spreadsheet.id,
          sheet,
          rows.map((r) => columns.map((c) => cell(r[c]))),
        );
      }
      await tryFormat(spreadsheet.id, sheetId, columns.length);
      rowCounts[t.table_name] = rows.length;
      total += rows.length;
    }
  } catch (err) {
    status = "failed";
    message = err instanceof Error ? err.message : String(err);
  }

  if (snapshotId) {
    await db
      .from("backup_snapshots")
      .update({
        status,
        row_counts: rowCounts as any,
        total_rows: total,
        finished_at: new Date().toISOString(),
        message,
      })
      .eq("id", snapshotId);
  }

  return { snapshotId, status, total, rowCounts, message, spreadsheetUrl: spreadsheet.url };
}
