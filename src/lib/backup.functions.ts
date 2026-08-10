import { createServerFn } from "@tanstack/react-start";
import { useSession } from "@tanstack/react-start/server";
import { z } from "zod";

type GateSession = { unlocked?: boolean; staffUsername?: string | null };

function sessionConfig() {
  const password = process.env["SESSION_SECRET"];
  if (!password) throw new Error("SESSION_SECRET not set");
  return {
    password,
    name: "rohi-admin",
    maxAge: 60 * 60 * 8,
    cookie: { httpOnly: true, secure: true, sameSite: "none" as const, path: "/" },
  };
}

async function requireUnlocked() {
  const session = await useSession<GateSession>(sessionConfig());
  if (!session.data.unlocked) throw new Error("Unauthorized");
  if (session.data.staffUsername) throw new Error("Forbidden: admin role required");
}

export type BackupTableRow = {
  table_name: string;
  sheet_name: string;
  enabled: boolean;
  direction: string;
  cursor_column: string | null;
  last_cursor: string | null;
  last_synced_at: string | null;
  last_row_count: number;
};

export type BackupRunRow = {
  id: string;
  kind: string;
  status: string;
  started_at: string;
  finished_at: string | null;
  tables_synced: number;
  rows_synced: number;
  error_count: number;
  message: string;
};

export type BackupSnapshotRow = {
  id: string;
  label: string;
  kind: string;
  status: string;
  total_rows: number;
  taken_at: string;
  finished_at: string | null;
  message: string;
};

export type BackupDashboard = {
  spreadsheetUrl: string | null;
  googleConnected: boolean;
  databaseConnected: boolean;
  tables: BackupTableRow[];
  runs: BackupRunRow[];
  snapshots: BackupSnapshotRow[];
  errors: { id: string; table_name: string; severity: string; message: string; created_at: string }[];
  totals: { tables: number; rowsTracked: number; untracked: string[] };
  health: number;
  lastSuccessAt: string | null;
};

export const getBackupDashboard = createServerFn({ method: "GET" }).handler(
  async (): Promise<BackupDashboard> => {
    await requireUnlocked();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const engine = await import("./backup/engine.server");

    const googleConnected = Boolean(
      process.env["LOVABLE_API_KEY"] && process.env["GOOGLE_SHEETS_API_KEY"],
    );

    const [{ data: tables }, { data: runs }, { data: snapshots }, { data: errors }, { data: setting }] =
      await Promise.all([
        supabaseAdmin.from("backup_tables").select("*").order("table_name"),
        supabaseAdmin.from("backup_runs").select("*").order("started_at", { ascending: false }).limit(20),
        supabaseAdmin.from("backup_snapshots").select("*").order("taken_at", { ascending: false }).limit(20),
        supabaseAdmin
          .from("backup_errors")
          .select("id, table_name, severity, message, created_at")
          .order("created_at", { ascending: false })
          .limit(25),
        supabaseAdmin.from("backup_settings").select("value").eq("key", "spreadsheet_id").maybeSingle(),
      ]);

    let untracked: string[] = [];
    let databaseConnected = true;
    try {
      const discovered = await engine.discoverTables();
      const known = new Set(((tables ?? []) as BackupTableRow[]).map((t) => t.table_name));
      untracked = discovered.filter((d) => !known.has(d.table_name)).map((d) => d.table_name);
    } catch {
      databaseConnected = false;
    }

    const runList = (runs ?? []) as BackupRunRow[];
    const lastSuccess = runList.find((r) => r.status === "success") ?? null;
    const recent = runList.slice(0, 10);
    const okCount = recent.filter((r) => r.status === "success").length;
    const health = recent.length ? Math.round((okCount / recent.length) * 100) : googleConnected ? 100 : 0;

    return {
      spreadsheetUrl: (setting as { value: string } | null)?.value
        ? engine.sheetUrl((setting as { value: string }).value)
        : null,
      googleConnected,
      databaseConnected,
      tables: (tables ?? []) as BackupTableRow[],
      runs: runList,
      snapshots: (snapshots ?? []) as BackupSnapshotRow[],
      errors: (errors ?? []) as BackupDashboard["errors"],
      totals: {
        tables: (tables ?? []).length,
        rowsTracked: ((tables ?? []) as BackupTableRow[]).reduce((a, t) => a + (t.last_row_count || 0), 0),
        untracked,
      },
      health,
      lastSuccessAt: lastSuccess?.finished_at ?? lastSuccess?.started_at ?? null,
    };
  },
);

export const runBackupSync = createServerFn({ method: "POST" })
  .validator((d: { full?: boolean; tables?: string[] } | undefined) =>
    z
      .object({ full: z.boolean().optional(), tables: z.array(z.string()).optional() })
      .default({})
      .parse(d ?? {}),
  )
  .handler(async ({ data }) => {
    await requireUnlocked();
    const engine = await import("./backup/engine.server");
    const result = await engine.runSync({
      full: data.full ?? false,
      kind: data.full ? "full" : "manual",
      ...(data.tables ? { tables: data.tables } : {}),
    });
    return result;
  });

export const createBackupSnapshot = createServerFn({ method: "POST" })
  .validator((d: { label?: string } | undefined) =>
    z.object({ label: z.string().max(120).optional() }).default({}).parse(d ?? {}),
  )
  .handler(async ({ data }) => {
    await requireUnlocked();
    const engine = await import("./backup/engine.server");
    return engine.createSnapshot(data.label, "manual");
  });

export const initializeBackup = createServerFn({ method: "POST" }).handler(async () => {
  await requireUnlocked();
  const engine = await import("./backup/engine.server");
  const spreadsheet = await engine.ensureSpreadsheet();
  const registry = await engine.syncRegistry();
  return { ...spreadsheet, ...registry };
});

export const setBackupTableEnabled = createServerFn({ method: "POST" })
  .validator((d: { table_name: string; enabled: boolean }) =>
    z.object({ table_name: z.string().min(1), enabled: z.boolean() }).parse(d),
  )
  .handler(async ({ data }) => {
    await requireUnlocked();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("backup_tables")
      .update({ enabled: data.enabled })
      .eq("table_name", data.table_name);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/** Clears the incremental cursor so the next run rewrites that worksheet from scratch. */
export const resetBackupTableCursor = createServerFn({ method: "POST" })
  .validator((d: { table_name: string }) => z.object({ table_name: z.string().min(1) }).parse(d))
  .handler(async ({ data }) => {
    await requireUnlocked();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("backup_tables")
      .update({ last_cursor: null })
      .eq("table_name", data.table_name);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
