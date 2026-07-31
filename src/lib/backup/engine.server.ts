// Backup / disaster-recovery sync engine.
// SERVER ONLY — never import from browser code.
import {
  addSheet,
  appendRows,
  batchWrite,
  clearSheet,
  colLetter,
  createSpreadsheet,
  getSpreadsheet,
  quoteSheet,
  readRange,
  writeRange,
} from "./sheets.server";

export const SPREADSHEET_TITLE = "ROHI INTERNATIONAL TRAVELS MASTER BACKUP";
const MAX_ROWS_PER_TABLE = 20000;
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
  visa_verification_links: "Visa Services",
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

// Tables holding credentials/secrets are never mirrored to a spreadsheet.
const NEVER_BACKUP = new Set(["admin_credentials", "admin_password_resets"]);

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

export async function ensureSpreadsheet(): Promise<{ id: string; url: string }> {
  const existing = await getSetting("spreadsheet_id");
  if (existing) {
    const info = await getSpreadsheet(existing);
    return { id: info.spreadsheetId, url: info.spreadsheetUrl ?? sheetUrl(info.spreadsheetId) };
  }
  const created = await createSpreadsheet(SPREADSHEET_TITLE);
  await setSetting("spreadsheet_id", created.spreadsheetId);
  await writeRange(created.spreadsheetId, "README!A1", [
    [SPREADSHEET_TITLE],
    ["Automated backup of the Rohi International Travels database."],
    ["Each worksheet mirrors one database table. Row 1 holds the exact database field names."],
    ["Column A always holds the record's unique id — do not change it."],
    ["Created", new Date().toISOString()],
  ]);
  return {
    id: created.spreadsheetId,
    url: created.spreadsheetUrl ?? sheetUrl(created.spreadsheetId),
  };
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

function cell(value: unknown): string | number | boolean {
  if (value === null || value === undefined) return "";
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
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
  for (let offset = 0; offset < MAX_ROWS_PER_TABLE; offset += PAGE_SIZE) {
    const { data, error } = await (db as any).rpc("backup_fetch_rows", {
      _table: table,
      _since: since,
      _limit: PAGE_SIZE,
      _offset: offset,
    });
    if (error) throw new Error(error.message);
    const page = (data ?? []) as Record<string, unknown>[];
    out.push(...page);
    if (page.length < PAGE_SIZE) break;
  }
  return out;
}

async function ensureSheetTab(spreadsheetId: string, sheet: string, existing: Set<string>) {
  if (existing.has(sheet)) return;
  await addSheet(spreadsheetId, sheet);
  existing.add(sheet);
}

export async function syncTable(
  spreadsheetId: string,
  cfg: { table_name: string; sheet_name: string; cursor_column: string | null; last_cursor: string | null },
  opts: { full: boolean; existingSheets: Set<string> },
): Promise<TableSyncOutcome> {
  const errors: { row_id: string; message: string }[] = [];
  const since = opts.full ? null : cfg.last_cursor;
  const rows = await fetchRows(cfg.table_name, since);

  await ensureSheetTab(spreadsheetId, cfg.sheet_name, opts.existingSheets);

  if (!rows.length) {
    return {
      table: cfg.table_name,
      sheet: cfg.sheet_name,
      rows: 0,
      mode: opts.full ? "full" : "incremental",
      cursor: cfg.last_cursor,
      errors,
    };
  }

  const columns = orderColumns(Array.from(new Set(rows.flatMap((r) => Object.keys(r)))));
  const keyCol = columns[0]!;
  const quoted = quoteSheet(cfg.sheet_name);

  // Read the existing header so a schema change is detected and healed.
  const headerRow = opts.full ? [] : await readRange(spreadsheetId, `${quoted}!1:1`);
  const header = (headerRow[0] ?? []).map((h) => String(h));
  const headerMatches =
    header.length === columns.length && header.every((h, i) => h === columns[i]);

  let mode: "full" | "incremental" = opts.full || !headerMatches ? "full" : "incremental";

  // A schema/header change forces a complete rewrite of that worksheet.
  const allRows = mode === "full" && since !== null ? await fetchRows(cfg.table_name, null) : rows;

  const seen = new Set<string>();
  const toValues = (r: Record<string, unknown>): (string | number | boolean)[] =>
    columns.map((c) => cell(r[c]));

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
  let spreadsheet: { id: string; url: string } | null = null;

  try {
    spreadsheet = await ensureSpreadsheet();
    await syncRegistry();

    const info = await getSpreadsheet(spreadsheet.id);
    const existingSheets = new Set((info.sheets ?? []).map((s) => s.properties.title));

    let query = db.from("backup_tables").select("*").eq("enabled", true).order("table_name");
    if (opts.tables?.length) query = query.in("table_name", opts.tables);
    const { data: configs, error } = await query;
    if (error) throw new Error(error.message);

    for (const cfg of (configs ?? []) as any[]) {
      if (NEVER_BACKUP.has(cfg.table_name)) continue;
      try {
        const outcome = await syncTable(
          spreadsheet.id,
          {
            table_name: cfg.table_name,
            sheet_name: cfg.sheet_name,
            cursor_column: cfg.cursor_column,
            last_cursor: opts.full ? null : cfg.last_cursor,
          },
          { full: Boolean(opts.full), existingSheets },
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
  const spreadsheet = await ensureSpreadsheet();

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
    const existingSheets = new Set((info.sheets ?? []).map((s) => s.properties.title));
    const tables = await discoverTables();
    const shortStamp = new Date().toISOString().replace(/[:.]/g, "").slice(0, 13);

    for (const t of tables) {
      const rows = await fetchRows(t.table_name, null);
      const sheet = `SNAP ${shortStamp} ${sheetNameFor(t.table_name)}`.slice(0, 95);
      await ensureSheetTab(spreadsheet.id, sheet, existingSheets);
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
