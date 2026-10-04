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

    const { data: accounts, error: accountsError } = await db
      .from("accounts_book_accounts").select("id,name,kind").in("kind", ["bank", "wallet"]).eq("is_active", true).order("created_at");
    if (accountsError) throw new Error(accountsError.message);

    const accountOutcome = await syncTable(target.id, {
      table_name: "accounts_book_accounts", sheet_name: "Banks & Wallets", cursor_column: null, last_cursor: null,
    }, {
      full: true, existingSheets, rowFilter: (row) => row.kind === "bank" || row.kind === "wallet", verifyWrite: true,
    });
    outcomes.push(accountOutcome);

    for (const account of accounts ?? []) {
      const canonical = safeSheetPart(String(account.name)) + " Account";
      const legacy = safeSheetPart(String(account.name));
      if (legacy === canonical) continue;
      const legacyId = existingSheets.get(legacy);
      if (legacyId === undefined) continue;
      try {
        await deleteSheet(target.id, legacyId);
        existingSheets.delete(legacy);
      } catch (error) {
        failures.push({ table: "accounts_book_transactions", message: "Could not remove legacy Banks & Wallets tab \"" + legacy + "\": " + (error instanceof Error ? error.message : String(error)) });
      }
    }

    // Account names aren't unique in the DB (no constraint on accounts_book_accounts.name),
    // so naming a tab from the name alone can collide — two accounts sharing a name would
    // silently share (and overwrite) one tab's transaction history. Disambiguate every
    // repeat with a short suffix from its id, keeping the first occurrence name-only so
    // existing single-account tabs aren't needlessly renamed.
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
      sheetNameByAccountId.set(String(account.id), `${disambiguated} Account`);
    }
    if ([...nameCounts.values()].some((n) => n > 1)) {
      // Informational only — not a sync failure, so it doesn't flip the run to "partial".
      console.warn("[backup] Banks & Wallets: duplicate account names found; tabs disambiguated with an id suffix. Consider renaming the duplicates in the Accounts Book.");
    }

    const txConfig = (await db.from("backup_tables").select("cursor_column").eq("table_name", "accounts_book_transactions").maybeSingle()).data as { cursor_column?: string | null } | null;
    for (const account of accounts ?? []) {
      const sheet = sheetNameByAccountId.get(String(account.id)) ?? safeSheetPart(String(account.name)) + " Account";
      try {
        const outcome = await syncTable(target.id, {
          table_name: "accounts_book_transactions", sheet_name: sheet, cursor_column: txConfig?.cursor_column ?? "updated_at", last_cursor: null,
        }, {
          full: true, existingSheets, rowFilter: (row) => String(row.account_id ?? "") === String(account.id), verifyWrite: true,
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

    // Canonicalize bank/wallet ledger tabs. The current name is always
    // "<Account> Account". If an older "<Account>" tab exists, remove it even
    // when the canonical tab did not exist yet; otherwise every reconciliation
    // run could leave two tabs for the same account.
    const banksTarget = await sheetFor("banksWallets");
    for (const account of (moneyAccounts ?? []).filter((row) => row.kind === "bank" || row.kind === "wallet")) {
      const canonical = `${safeSheetPart(String(account.name))} Account`;
      const legacy = safeSheetPart(String(account.name));
      if (legacy === canonical) continue;
      const legacyId = banksTarget.existingSheets.get(legacy);
      if (legacyId === undefined) continue;
      try {
        await deleteSheet(banksTarget.id, legacyId);
        banksTarget.existingSheets.delete(legacy);
      } catch (err) {
        console.warn("[backup] could not remove legacy account tab", legacy, err);
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

    const expenseCategories = new Set<string>(
      (categoryServices ?? [])
        .map((s) => String(s.name ?? ""))
        .filter((name) => name.startsWith("EXP: "))
        .map((name) => name.slice(5).trim())
        .filter(Boolean),
    );

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
                  sheet: `Sales - ${safeSheetPart(category)}`,
                  filter: (row: Record<string, unknown>) => isSalesTransaction(row) && String(row.category ?? "") === category,
                  dynamic: true,
                })),
                ...Array.from(expenseCategories).flatMap((category) => {
                  const office = category.toLowerCase().includes("office");
                  const key = office ? "Office" : "Home";
                  return [{
                    key: "expenses" as const,
                    sheet: `${key} - ${safeSheetPart(category)}`,
                    filter: (row: Record<string, unknown>) => isExpenseTransaction(row) && String(row.category ?? "") === category,
                    dynamic: true,
                  }];
                }),
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
