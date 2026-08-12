import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AdminResetButton } from "@/components/AdminResetButton";
import { useEffect, useState } from "react";
import {
  Plane,
  LogOut,
  RefreshCw,
  ShieldCheck,
  Database,
  Camera,
  ExternalLink,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Table2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { adminLogout } from "@/lib/fares.functions";
import { AdminHeaderExtras } from "@/components/AdminHeaderExtras";
import { AdminTabs } from "@/components/AdminTabs";
import {
  getBackupDashboard,
  runBackupSync,
  createBackupSnapshot,
  initializeBackup,
  setBackupTableEnabled,
  resetBackupTableCursor,
  type BackupDashboard,
} from "@/lib/backup.functions";

export const Route = createFileRoute("/admin/backup")({
  head: () => ({
    meta: [
      { title: "Backup & Disaster Recovery — Rohi Admin" },
      {
        name: "description",
        content:
          "Monitor the automatic Google Sheets backup of every Rohi International Travels record, run manual syncs and create restorable snapshots.",
      },
      { property: "og:title", content: "Backup & Disaster Recovery — Rohi Admin" },
      {
        property: "og:description",
        content: "Live backup health, sync history and snapshot management for the Rohi admin panel.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  errorComponent: ({ error, reset }) => (
    <div className="p-8 text-center">
      <p className="mb-4 text-destructive">{error.message}</p>
      <button onClick={reset} className="rounded bg-navy px-4 py-2 text-white">
        Retry
      </button>
    </div>
  ),
  notFoundComponent: () => <div className="p-8">Not found</div>,
  component: BackupPage,
});

function fmt(ts: string | null | undefined) {
  if (!ts) return "—";
  const d = new Date(ts);
  return d.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
}

function BackupPage() {
  const router = useRouter();
  const load = useServerFn(getBackupDashboard);
  const sync = useServerFn(runBackupSync);
  const snapshot = useServerFn(createBackupSnapshot);
  const init = useServerFn(initializeBackup);
  const toggle = useServerFn(setBackupTableEnabled);
  const resetCursor = useServerFn(resetBackupTableCursor);

  const { data, refetch } = useSuspenseQuery<BackupDashboard>({
    queryKey: ["backup-dashboard"],
    queryFn: () => load(),
    refetchInterval: 30000,
  });

  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string>("");
  const [liveAt, setLiveAt] = useState<string | null>(null);

  /**
   * Live protection: any insert/update/delete in the app instantly triggers a
   * debounced changed-rows sync, so nothing sits unbacked-up between the
   * scheduled every-minute runs.
   */
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let running = false;
    const kick = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(async () => {
        if (running) return;
        running = true;
        try {
          await sync({ data: { full: false } });
          setLiveAt(new Date().toISOString());
          await refetch();
        } catch {
          /* the scheduled job retries */
        } finally {
          running = false;
        }
      }, 4000);
    };

    const channel = supabase
      .channel("backup-live")
      .on("postgres_changes", { event: "*", schema: "public" }, (payload: { table?: string }) => {
        const table = payload.table ?? "";
        if (table.startsWith("backup_")) return;
        kick();
      })
      .subscribe();

    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, []);


  async function act(label: string, fn: () => Promise<any>) {
    setBusy(label);
    setNote("");
    try {
      const res = await fn();
      if (res?.status === "failed" || res?.ok === false) {
        setNote(`${label} finished with errors. Check the error log below.`);
      } else if (typeof res?.rowsSynced === "number") {
        setNote(`${label} complete — ${res.rowsSynced} rows across ${res.tablesSynced} tables.`);
      } else if (typeof res?.total === "number") {
        setNote(`Snapshot complete — ${res.total} rows captured.`);
      } else {
        setNote(`${label} complete.`);
      }
      await refetch();
      router.invalidate();
    } catch (e: any) {
      setNote(e?.message ?? String(e));
    } finally {
      setBusy(null);
    }
  }

  const healthColor =
    data.health >= 90 ? "text-emerald-600" : data.health >= 60 ? "text-amber-600" : "text-red-600";

  const lastRun = data.runs[0] ?? null;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-navy text-navy-foreground">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <Plane className="h-5 w-5 -rotate-45 text-gold" />
            <div>
              <p className="font-serif text-lg font-black">Admin Panel</p>
              <p className="text-[10px] tracking-widest text-white/60">
                Backup &amp; disaster recovery
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <AdminHeaderExtras />
            <a
              href="/"
              className="rounded-md border border-white/20 px-3 py-2 text-xs font-semibold hover:bg-white/10"
            >
              View site
            </a>
            <LogoutButton />
          </div>
        </div>
        <AdminTabs />
      </header>

      <main className="mx-auto max-w-[1600px] px-4 py-6">
        <h1 className="mb-1 font-serif text-2xl font-black text-navy">
          Backup &amp; Disaster Recovery
        </h1>
        <p className="mb-5 text-xs text-navy/60">
          Every table in the database is mirrored into the Google Sheet{" "}
          <strong>ROHI INTERNATIONAL TRAVELS MASTER BACKUP</strong>. New tables are picked up
          automatically.
        </p>

        {/* Status cards */}
        <section className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Card
            icon={ShieldCheck}
            label="Backup health"
            value={<span className={healthColor}>{data.health}%</span>}
            sub={`${data.runs.length} recent runs`}
          />
          <Card
            icon={Clock}
            label="Last successful backup"
            value={<span className="text-sm">{fmt(data.lastSuccessAt)}</span>}
            sub={lastRun ? `Last run: ${lastRun.status}` : "No runs yet"}
          />
          <Card
            icon={Table2}
            label="Tables tracked"
            value={data.totals.tables}
            sub={
              data.totals.untracked.length
                ? `${data.totals.untracked.length} new table(s) pending`
                : "All tables registered"
            }
          />
          <Card
            icon={Database}
            label="Connections"
            value={
              <span className="text-sm">
                <StatusDot ok={data.googleConnected} /> Google &nbsp;
                <StatusDot ok={data.databaseConnected} /> Database
              </span>
            }
            sub={data.spreadsheetUrl ? "Spreadsheet linked" : "Spreadsheet not created yet"}
          />
        </section>

        {/* Actions */}
        <section className="mb-5 flex flex-wrap items-center gap-2 rounded-lg border border-navy/10 bg-white p-4 shadow-sm">
          <button
            disabled={Boolean(busy)}
            onClick={() => act("Incremental sync", () => sync({ data: { full: false } }))}
            className="inline-flex items-center gap-2 rounded-md bg-navy px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${busy === "Incremental sync" ? "animate-spin" : ""}`} />
            Sync now
          </button>
          <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-50 px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-emerald-700 ring-1 ring-emerald-200">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
            Live auto-backup {liveAt ? `· ${fmt(liveAt)}` : "· every minute"}
          </span>

          <button
            disabled={Boolean(busy)}
            onClick={() => act("Full backup", () => sync({ data: { full: true } }))}
            className="inline-flex items-center gap-2 rounded-md bg-gold px-4 py-2 text-xs font-bold text-gold-foreground disabled:opacity-50"
          >
            <Database className={`h-3.5 w-3.5 ${busy === "Full backup" ? "animate-pulse" : ""}`} />
            Full backup (all history)
          </button>
          <button
            disabled={Boolean(busy)}
            onClick={() => act("Snapshot", () => snapshot({ data: {} }))}
            className="inline-flex items-center gap-2 rounded-md border border-navy/20 px-4 py-2 text-xs font-bold text-navy disabled:opacity-50"
          >
            <Camera className="h-3.5 w-3.5" /> Create snapshot
          </button>
          <button
            disabled={Boolean(busy)}
            onClick={() => act("Setup", () => init())}
            className="inline-flex items-center gap-2 rounded-md border border-navy/20 px-4 py-2 text-xs font-bold text-navy disabled:opacity-50"
          >
            <ShieldCheck className="h-3.5 w-3.5" /> Detect new tables
          </button>
          {data.spreadsheetUrl && (
            <a
              href={data.spreadsheetUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-md border border-emerald-500/40 bg-emerald-50 px-4 py-2 text-xs font-bold text-emerald-700"
            >
              <ExternalLink className="h-3.5 w-3.5" /> Open master backup sheet
            </a>
          )}
          <div className="flex gap-2 border-l border-navy/10 pl-2">
            <AdminResetButton
              target="group_tickets"
              label="Group Tickets Confirmed"
              numbering="SR #"
              onDone={() => { void qc.invalidateQueries({ queryKey: ["tickets"] }); }}
            />
            <AdminResetButton
              target="agent_bookings"
              label="Agent Group Bookings"
              numbering="Booking IDs"
              onDone={() => { void qc.invalidateQueries({ queryKey: ["admin-bookings"] }); }}
            />
            <AdminResetButton
              target="queries"
              label="Queries"
              numbering="Q#"
              onDone={() => { void qc.invalidateQueries({ queryKey: ["admin-queries"] }); }}
            />
          </div>
          {note && <span className="text-xs font-semibold text-navy">{note}</span>}
        </section>

        {/* Tables */}
        <section className="mb-5 overflow-hidden rounded-lg border border-navy/10 bg-white shadow-sm">
          <div className="border-b border-navy/10 px-4 py-3 text-xs font-bold uppercase tracking-widest text-navy">
            Tables in backup
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-navy/5 text-navy">
                <tr>
                  <Th>Table</Th>
                  <Th>Worksheet</Th>
                  <Th>Change column</Th>
                  <Th>Last synced</Th>
                  <Th>Rows last run</Th>
                  <Th>Included</Th>
                  <Th>Actions</Th>
                </tr>
              </thead>
              <tbody>
                {data.tables.map((t) => (
                  <tr key={t.table_name} className="border-t border-navy/5">
                    <Td className="font-mono">{t.table_name}</Td>
                    <Td className="font-semibold">{t.sheet_name}</Td>
                    <Td>{t.cursor_column ?? "—"}</Td>
                    <Td>{fmt(t.last_synced_at)}</Td>
                    <Td>{t.last_row_count}</Td>
                    <Td>
                      <button
                        disabled={Boolean(busy)}
                        onClick={() =>
                          act("Update", () =>
                            toggle({ data: { table_name: t.table_name, enabled: !t.enabled } }),
                          )
                        }
                        className={`rounded px-2 py-1 text-[10px] font-bold ${
                          t.enabled
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-neutral-200 text-neutral-600"
                        }`}
                      >
                        {t.enabled ? "ON" : "OFF"}
                      </button>
                    </Td>
                    <Td>
                      <button
                        disabled={Boolean(busy)}
                        onClick={() =>
                          act("Rebuild queued", () =>
                            resetCursor({ data: { table_name: t.table_name } }),
                          )
                        }
                        className="rounded border border-navy/20 px-2 py-1 text-[10px] font-bold text-navy"
                      >
                        Rebuild next run
                      </button>
                    </Td>
                  </tr>
                ))}
                {!data.tables.length && (
                  <tr>
                    <Td colSpan={7}>
                      No tables registered yet — press <strong>Detect new tables</strong>.
                    </Td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {/* Run history */}
          <section className="overflow-hidden rounded-lg border border-navy/10 bg-white shadow-sm">
            <div className="border-b border-navy/10 px-4 py-3 text-xs font-bold uppercase tracking-widest text-navy">
              Backup history
            </div>
            <div className="max-h-[420px] overflow-auto">
              <table className="w-full text-xs">
                <thead className="bg-navy/5 text-navy">
                  <tr>
                    <Th>Started</Th>
                    <Th>Kind</Th>
                    <Th>Status</Th>
                    <Th>Tables</Th>
                    <Th>Rows</Th>
                  </tr>
                </thead>
                <tbody>
                  {data.runs.map((r) => (
                    <tr key={r.id} className="border-t border-navy/5">
                      <Td>{fmt(r.started_at)}</Td>
                      <Td>{r.kind}</Td>
                      <Td>
                        <StatusPill status={r.status} />
                      </Td>
                      <Td>{r.tables_synced}</Td>
                      <Td>{r.rows_synced}</Td>
                    </tr>
                  ))}
                  {!data.runs.length && (
                    <tr>
                      <Td colSpan={5}>No backups run yet.</Td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* Snapshots */}
          <section className="overflow-hidden rounded-lg border border-navy/10 bg-white shadow-sm">
            <div className="border-b border-navy/10 px-4 py-3 text-xs font-bold uppercase tracking-widest text-navy">
              Snapshots (restorable point-in-time copies)
            </div>
            <div className="max-h-[420px] overflow-auto">
              <table className="w-full text-xs">
                <thead className="bg-navy/5 text-navy">
                  <tr>
                    <Th>Label</Th>
                    <Th>Taken</Th>
                    <Th>Status</Th>
                    <Th>Rows</Th>
                  </tr>
                </thead>
                <tbody>
                  {data.snapshots.map((s) => (
                    <tr key={s.id} className="border-t border-navy/5">
                      <Td className="font-semibold">{s.label}</Td>
                      <Td>{fmt(s.taken_at)}</Td>
                      <Td>
                        <StatusPill status={s.status} />
                      </Td>
                      <Td>{s.total_rows}</Td>
                    </tr>
                  ))}
                  {!data.snapshots.length && (
                    <tr>
                      <Td colSpan={4}>No snapshots yet.</Td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        {/* Errors */}
        <section className="mt-5 overflow-hidden rounded-lg border border-navy/10 bg-white shadow-sm">
          <div className="border-b border-navy/10 px-4 py-3 text-xs font-bold uppercase tracking-widest text-navy">
            Errors &amp; warnings
          </div>
          <div className="max-h-[320px] overflow-auto">
            <table className="w-full text-xs">
              <thead className="bg-navy/5 text-navy">
                <tr>
                  <Th>When</Th>
                  <Th>Table</Th>
                  <Th>Severity</Th>
                  <Th>Message</Th>
                </tr>
              </thead>
              <tbody>
                {data.errors.map((e) => (
                  <tr key={e.id} className="border-t border-navy/5">
                    <Td>{fmt(e.created_at)}</Td>
                    <Td className="font-mono">{e.table_name || "—"}</Td>
                    <Td>
                      <span
                        className={`inline-flex items-center gap-1 font-bold ${
                          e.severity === "error" ? "text-red-600" : "text-amber-600"
                        }`}
                      >
                        <AlertTriangle className="h-3 w-3" /> {e.severity}
                      </span>
                    </Td>
                    <Td className="max-w-[600px] truncate" title={e.message}>
                      {e.message}
                    </Td>
                  </tr>
                ))}
                {!data.errors.length && (
                  <tr>
                    <Td colSpan={4}>
                      <span className="inline-flex items-center gap-1 text-emerald-700">
                        <CheckCircle2 className="h-3.5 w-3.5" /> No errors logged.
                      </span>
                    </Td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}

function LogoutButton() {
  const router = useRouter();
  const logout = useServerFn(adminLogout);
  return (
    <button
      onClick={async () => {
        try {
          await logout();
        } catch {}
        router.navigate({ to: "/admin" });
      }}
      className="inline-flex items-center gap-2 rounded-md bg-gold px-3 py-2 text-xs font-bold text-gold-foreground"
    >
      <LogOut className="h-3.5 w-3.5" /> Logout
    </button>
  );
}

function Card({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: React.ReactNode;
  sub?: string;
}) {
  return (
    <div className="rounded-lg border border-navy/10 bg-white p-4 shadow-sm">
      <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-navy/60">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <div className="font-serif text-2xl font-black text-navy">{value}</div>
      {sub && <p className="mt-1 text-[10px] text-navy/50">{sub}</p>}
    </div>
  );
}

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span
      className={`mr-1 inline-block h-2 w-2 rounded-full ${ok ? "bg-emerald-500" : "bg-red-500"}`}
    />
  );
}

function StatusPill({ status }: { status: string }) {
  const cls =
    status === "success"
      ? "bg-emerald-100 text-emerald-700"
      : status === "running"
        ? "bg-sky-100 text-sky-700"
        : status === "partial"
          ? "bg-amber-100 text-amber-700"
          : "bg-red-100 text-red-700";
  return <span className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${cls}`}>{status}</span>;
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-widest">
      {children}
    </th>
  );
}

function Td({
  children,
  className = "",
  colSpan,
  title,
}: {
  children: React.ReactNode;
  className?: string;
  colSpan?: number;
  title?: string;
}) {
  return (
    <td colSpan={colSpan} title={title} className={`px-3 py-2 align-middle ${className}`}>
      {children}
    </td>
  );
}
