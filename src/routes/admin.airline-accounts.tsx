import React, { useState, useEffect, useMemo, useRef } from "react";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import {
  Home,
  Plus, Pencil, Trash2, Download, X, LayoutDashboard,
  TrendingUp, TrendingDown, Wallet, Search, Building2,
  AlertCircle, FileSpreadsheet, LoaderCircle, Users, Save, FileText, Table, ChevronDown, LogOut,
} from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend,
} from "recharts";
import ExcelJS from "exceljs";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { AdminHeaderExtras } from "@/components/AdminHeaderExtras";import { AdminTabs } from "@/components/AdminTabs";
import { AdminPageHeading } from "@/components/AdminPageHeading";
import { AdminStatCard } from "@/components/AdminStatCard";
import { checkAdminUnlocked, adminLogout } from "@/lib/fares.functions";
import { getAirlineLedgerData, saveAirlineLedgerData } from "@/lib/airline-ledger.functions";
import { listAgentsAdmin } from "@/lib/agent-admin.functions";
import { getAirlineLedgerGoogleSyncStatus, retryAirlineLedgerGoogleSync } from "@/lib/airline-ledger-google-sync";
import { formatDateTimeShort } from "@/lib/date-format";
import { SimplePager, paginate } from "@/components/ui/simple-pager";
import { airlineLogoUrl } from "@/lib/airline-branding";

export const Route = createFileRoute("/admin/airline-accounts")({
  component: AirlineLedgerRoute,
});

/* ---------- constants ---------- */

const DEFAULT_AIRLINES: any[] = [
  { id: "pia", name: "PIA", code: "PK", openingBalance: 0, openingBalanceDate: new Date().toISOString().slice(0, 10) },
  { id: "air-blue", name: "Air Blue", code: "PA", openingBalance: 0, openingBalanceDate: new Date().toISOString().slice(0, 10) },
  { id: "flydubai", name: "flydubai", code: "FZ", openingBalance: 0, openingBalanceDate: new Date().toISOString().slice(0, 10) },
  { id: "salamair", name: "SalamAir", code: "OV", openingBalance: 0, openingBalanceDate: new Date().toISOString().slice(0, 10) },
  { id: "air-arabia", name: "Air Arabia", code: "G9", openingBalance: 0, openingBalanceDate: new Date().toISOString().slice(0, 10) },
  { id: "flyjinnah", name: "FlyJinnah", code: "9P", openingBalance: 0, openingBalanceDate: new Date().toISOString().slice(0, 10) },
  { id: "jazeera", name: "Jazeera", code: "J9", openingBalance: 0, openingBalanceDate: new Date().toISOString().slice(0, 10) },
  { id: "flynas", name: "flynas", code: "XY", openingBalance: 0, openingBalanceDate: new Date().toISOString().slice(0, 10) },
];

const DEFAULT_AGENTS = ["Ali Raza", "Sana Khan", "Bilal Ahmed"];

const COLUMNS: any[] = [
  { key: "date", label: "Date", type: "date", width: 130, computed: false },
  { key: "transactionType", label: "Transaction Type", type: "transactionType", width: 150, computed: false },
  { key: "agentName", label: "Agent Name", type: "select", width: 140, computed: false },
  { key: "paxName", label: "Pax Name", type: "text", width: 140, computed: false },
  { key: "sector", label: "Sector", type: "text", width: 90, computed: false },
  { key: "pnr", label: "PNR", type: "text", width: 90, computed: false },
  { key: "ticketSales", label: "Ticket Sales", type: "number", width: 110, computed: false },
  { key: "debitInId", label: "Debit In ID", type: "text", width: 100, computed: false },
  { key: "creditFromId", label: "Credit From ID", type: "number", width: 120, computed: false },
  { key: "balance", label: "Balance", type: "number", width: 110, computed: true },
  { key: "paxContact", label: "Pax Contact #", type: "text", width: 130, computed: false },
  { key: "voidCharges", label: "VOID Charges", type: "number", width: 110, computed: false },
  { key: "profit", label: "Profit", type: "number", width: 100, computed: true },
  { key: "ledgerEntry", label: "Ledger Entry", type: "text", width: 190, computed: true },
];

const EMPTY_ROW = (): any => ({
  date: new Date().toISOString().slice(0, 10),
  transactionType: "Add Transaction",
  agentName: "", paxName: "", sector: "", pnr: "",
  ticketSales: "", debitInId: "", creditFromId: "",
  paxContact: "", voidCharges: "",
});

const fmt = (n: any) => {
  const v = Number(n);
  if (n === "" || n === null || n === undefined) return "-";
  if (Number.isNaN(v)) return n;
  return v.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
};

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
const monthKey = (d: string) => (d ? d.slice(0, 7) : "unknown");
const yearKey = (d: string) => (d ? d.slice(0, 4) : "unknown");

function computeLedgerRows(rows: any[], airline: any) {
  let running = Number(airline?.openingBalance) || 0;
  return rows.map((r) => {
    const credit = Number(r.creditFromId) || 0;
    running = running - credit;
    const profit = (Number(r.ticketSales) || 0) - credit;
    const ledgerEntry = [r.paxName, r.sector, r.pnr, airline?.code]
      .map((v) => (v || "").toString().trim())
      .filter(Boolean)
      .join(" - ");
    return { ...r, balance: running, profit, ledgerEntry };
  });
}

function rowsToCSV(rows: any[]) {
  const headers = ["Sr #", ...COLUMNS.map((c) => c.label)];
  const lines = [headers.join(",")];
  rows.forEach((r, i) => {
    const vals = [i + 1, ...COLUMNS.map((c) => {
      const v = r[c.key] ?? "";
      const s = String(v).replace(/"/g, '""');
      return /[",\n]/.test(s) ? `"${s}"` : s;
    })];
    lines.push(vals.join(","));
  });
  return lines.join("\n");
}
function downloadCSV(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* ---------- professional Excel / PDF export ---------- */

function fmtExportTimestamp(d: Date) {
  return formatDateTimeShort(d);
}

function buildExportTable(rowsList: any[], includeAirlineCol: boolean) {
  const headers = [...(includeAirlineCol ? ["Airline"] : []), "Sr #", ...COLUMNS.map((c) => c.label)];
  const isNumeric = headers.map((_, i) => {
    if (includeAirlineCol && i === 0) return false;
    if (i === (includeAirlineCol ? 1 : 0)) return true; // Sr #
    const colIdx = i - (includeAirlineCol ? 2 : 1);
    return COLUMNS[colIdx]?.type === "number";
  });
  const body = rowsList.map((entry, i) => {
    const r = includeAirlineCol ? entry.row : entry;
    const sr = includeAirlineCol ? entry.sr : i + 1;
    const vals = COLUMNS.map((c) => {
      const v = r[c.key];
      if (c.type === "number") {
        const n = Number(v);
        return v !== "" && v !== null && v !== undefined && Number.isFinite(n) ? n : "";
      }
      return v ?? "";
    });
    return [...(includeAirlineCol ? [entry.airlineName] : []), sr, ...vals];
  });
  return { headers, body, isNumeric };
}

async function exportLedgerExcel(filename: string, reportTitle: string, headers: string[], body: any[][], isNumeric: boolean[]) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "ROHI INTERNATIONAL TRAVELS";
  wb.created = new Date();
  const ws = wb.addWorksheet("Ledger", { views: [{ state: "frozen", ySplit: 4 }] });
  const colCount = headers.length;

  ws.mergeCells(1, 1, 1, colCount);
  const titleCell = ws.getCell(1, 1);
  titleCell.value = "ROHI INTERNATIONAL TRAVELS";
  titleCell.font = { bold: true, size: 16, color: { argb: "FF0F1B2D" } };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };

  ws.mergeCells(2, 1, 2, colCount);
  const subCell = ws.getCell(2, 1);
  subCell.value = `${reportTitle}  •  Generated ${fmtExportTimestamp(new Date())}`;
  subCell.font = { italic: true, size: 10, color: { argb: "FF767B84" } };
  subCell.alignment = { horizontal: "center", vertical: "middle" };

  ws.addRow([]);

  const headerRow = ws.addRow(headers);
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, size: 11, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F1B2D" } };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = { top: { style: "thin" }, left: { style: "thin" }, bottom: { style: "thin" }, right: { style: "thin" } };
  });

  body.forEach((r, i) => {
    const row = ws.addRow(r);
    row.eachCell((cell, colNumber) => {
      cell.border = {
        top: { style: "thin", color: { argb: "FFE7E4DB" } },
        left: { style: "thin", color: { argb: "FFE7E4DB" } },
        bottom: { style: "thin", color: { argb: "FFE7E4DB" } },
        right: { style: "thin", color: { argb: "FFE7E4DB" } },
      };
      if (i % 2 === 1) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFAF9F5" } };
      if (isNumeric[colNumber - 1]) {
        cell.alignment = { horizontal: "right", vertical: "middle" };
        if (typeof cell.value === "number") cell.numFmt = "#,##0.00";
      } else {
        cell.alignment = { horizontal: "left", vertical: "middle" };
      }
    });
  });

  ws.columns.forEach((col, idx) => {
    let max = (headers[idx] || "").length;
    col.eachCell?.({ includeEmpty: true }, (cell) => {
      const len = cell.value ? String(cell.value).length : 0;
      if (len > max) max = len;
    });
    col.width = Math.min(Math.max(max + 3, 10), 38);
  });

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function exportLedgerPDF(filename: string, reportTitle: string, headers: string[], body: any[][], isNumeric: boolean[]) {
  const doc = new jsPDF({ orientation: "landscape" });
  doc.setFontSize(18);
  doc.setTextColor(200, 155, 60);
  doc.setFont("helvetica", "bold");
  doc.text("ROHI INTERNATIONAL TRAVELS", 14, 15);

  doc.setFontSize(9);
  doc.setTextColor(110);
  doc.setFont("helvetica", "normal");
  doc.text(reportTitle, 14, 21);
  doc.text(`Generated: ${fmtExportTimestamp(new Date())}`, 14, 26);

  const displayBody = body.map((r) => r.map((v, i) => (isNumeric[i] && v !== "" ? Number(v).toLocaleString(undefined, { maximumFractionDigits: 2 }) : v)));

  autoTable(doc, {
    startY: 31,
    head: [headers],
    body: displayBody,
    theme: "grid",
    styles: { fontSize: 7, cellPadding: 2 },
    headStyles: { fillColor: [15, 27, 45], textColor: [255, 255, 255], fontStyle: "bold" },
    alternateRowStyles: { fillColor: [250, 249, 245] },
    columnStyles: Object.fromEntries(isNumeric.map((n, i) => [i, n ? { halign: "right" } : {}])),
  });

  doc.save(filename);
}

function ExportMenu({ onExcel, onSheets, onPDF, label = "Export" }: { onExcel: () => void; onSheets: () => void; onPDF: () => void; label?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      <button style={styles.ghostBtn} onClick={() => setOpen((o) => !o)}>
        <Download size={15} /> {label} <ChevronDown size={13} style={{ marginLeft: -2 }} />
      </button>
      {open && (
        <>
          <div style={{ position: "fixed", inset: 0, zIndex: 40 }} onClick={() => setOpen(false)} />
          <div style={styles.exportMenu}>
            <button style={styles.exportMenuItem} onClick={() => { onExcel(); setOpen(false); }}>
              <FileSpreadsheet size={15} color="#1D6F3E" /> Excel (.xlsx)
            </button>
            <button style={styles.exportMenuItem} onClick={() => { onSheets(); setOpen(false); }}>
              <Table size={15} color="#1D6FA5" /> Google Sheets (.csv)
            </button>
            <button style={styles.exportMenuItem} onClick={() => { onPDF(); setOpen(false); }}>
              <FileText size={15} color="var(--error)" /> PDF
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function AirlineLogoTile({ code }: { code: string }) {
  const src = airlineLogoUrl(code);
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [code]);
  if (!src || failed) {
    return <span style={{ fontSize: 13, fontWeight: 800, color: airlineBadgeColor(code) }}>{code || "✈"}</span>;
  }
  return (
    <img
      src={src}
      alt={`${code || "Airline"} official logo`}
      width={128}
      height={64}
      loading="lazy"
      decoding="async"
      style={{ width: "100%", height: "100%", objectFit: "contain" }}
      onError={() => setFailed(true)}
    />
  );
}

function airlineBadgeColor(code: string) {
  const colors: Record<string, string> = {
    PK: "#2D7A52", PA: "#1D6FA5", FZ: "#E46B2E", OV: "#D84B43",
    G9: "#C7447A", "9P": "#315A9A", J9: "#3B6E9E", XY: "#159A9C",
    PF: "#4C8B4A", ER: "#4C6E9A", F3: "#6B45A5",
  };
  return colors[String(code || "").toUpperCase()] || "#8A6A2F";
}

function AirlineLedgerRoute() {
  const router = useRouter();
  const logout = useServerFn(adminLogout);
  async function onLogout() {
    await logout();
    router.navigate({ to: "/admin" });
  }
  const { data: status, isLoading } = useQuery({
    queryKey: ["admin", "status"],
    queryFn: () => checkAdminUnlocked(),
  });

  if (isLoading) return <div className="p-10 text-center text-muted-foreground">Loading…</div>;
  if (!status?.unlocked) {
    return (
      <div className="p-10 text-center text-sm text-muted-foreground">
        Admin access required. Please unlock the admin panel first.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background animate-premium-fade">
      <header className="border-b border-[rgba(255,255,255,0.10)] bg-navy text-white">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-3 px-4 py-4">
          <div className="flex items-center gap-3">
            <Wallet className="h-5 w-5 text-white" />
            <p className="font-sans text-lg font-semibold text-white">Airline Accounts</p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <AdminHeaderExtras />
            <a href="/" className="inline-flex items-center gap-1.5 rounded-full border border-[#3d3d3a] bg-[#262624] px-3 py-1.5 text-[13px] font-medium text-white transition-colors hover:border-[#55554f] hover:bg-[#34342f]"><Home className="h-3.5 w-3.5" /> Home</a>
            <button onClick={onLogout} className="inline-flex items-center gap-2 rounded-lg bg-[var(--accent)] px-3 py-1.5 text-[13px] font-medium text-white transition-colors hover:bg-[var(--accent-hover)]">
              <LogOut className="h-3.5 w-3.5" /> Logout
            </button>
          </div>
        </div>
        <AdminTabs />
      </header>
      <AirlineLedgerApp />
    </div>
  );
}

function AirlineLedgerApp() {
  const load = useServerFn(getAirlineLedgerData);
  const save = useServerFn(saveAirlineLedgerData);
  const loadRegisteredAgents = useServerFn(listAgentsAdmin);

  // Start empty: the database is the only source of financial records.
  const [airlines, setAirlines] = useState<any[]>([]);
  const [agents, setAgents] = useState<string[]>([]);
  const [transactions, setTransactions] = useState<Record<string, any[]>>({});
  const [activeTab, setActiveTab] = useState("dashboard");
  const [loaded, setLoaded] = useState(false);
  const [modal, setModal] = useState<any>(null);
  const [confirmDelete, setConfirmDelete] = useState<any>(null);
  const [addAirlineOpen, setAddAirlineOpen] = useState(false);
  const [newAirline, setNewAirline] = useState({ name: "", code: "" });
  const [search, setSearch] = useState("");
  const [dashboardScope, setDashboardScope] = useState("all");
  const [savedFlash, setSavedFlash] = useState(false);
  const [saving, setSaving] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [sheetSyncStatus, setSheetSyncStatus] = useState<"synced" | "pending" | "error" | "not_configured">("synced");
  const [sheetSyncError, setSheetSyncError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveRetryTick, setSaveRetryTick] = useState(0);
  const saveRetryTimerRef = useRef<number | null>(null);
  const saveRetryCountRef = useRef(0);
  const saveQueueRef = useRef(Promise.resolve());
  const savePendingRef = useRef(0);
  const revisionRef = useRef(1);
  const lastSavedFingerprintRef = useRef("");
  const conflictRef = useRef(false);
  const dirtyRef = useRef(false);
  const [newAgent, setNewAgent] = useState("");
  const registeredAgentsQuery = useQuery({
    queryKey: ["admin-agents-for-ledger"],
    queryFn: () => loadRegisteredAgents(),
    refetchInterval: 30000,
  });
  useEffect(() => {
    if (!loaded) return;
    let cancelled = false;
    let retryInFlight = false;

    const refreshSheetStatus = async () => {
      try {
        const status: any = await getAirlineLedgerGoogleSyncStatus();
        if (cancelled) return;
        const currentRevision = revisionRef.current;
        const lastSynced = Number(status?.lastSyncedRevision ?? 0);
        const rawStatus = String(status?.status ?? "not_configured");
        const needsSync = currentRevision > 0 && lastSynced < currentRevision;

        setSheetSyncError(status?.errorMessage ?? null);
        setSheetSyncStatus(
          needsSync
            ? (rawStatus === "error" ? "error" : "pending")
            : rawStatus === "synced"
              ? "synced"
              : rawStatus === "not_configured"
                ? "not_configured"
                : "pending",
        );

        if (needsSync && (rawStatus === "error" || rawStatus === "pending") && savePendingRef.current === 0 && !retryInFlight) {
          retryInFlight = true;
          try {
            const result: any = await retryAirlineLedgerGoogleSync();
            if (cancelled) return;
            setSheetSyncStatus(result?.synced ? "synced" : "error");
            setSheetSyncError(result?.error ?? null);
          } finally {
            retryInFlight = false;
          }
        }
      } catch (e) {
        if (!cancelled) console.error("Airline Google Sheet sync status check failed", e);
      }
    };

    void refreshSheetStatus();
    const timer = window.setInterval(() => void refreshSheetStatus(), 30000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [loaded]);

  const registeredAgencyNames = useMemo(() => {
    const names = (registeredAgentsQuery.data ?? [])
      .map((agent: any) => String(agent.agency_name ?? "").trim())
      .filter(Boolean);
    return Array.from(new Set(names));
  }, [registeredAgentsQuery.data]);

  useEffect(() => {
    (async () => {
      try {
        const data: any = await load();
        // Never seed financial data with demo/default records. The database is
        // the source of truth, including when it is legitimately empty.
        setAirlines(Array.isArray(data.airlines) ? data.airlines : []);
        setAgents(Array.isArray(data.agents) ? data.agents : []);
        setTransactions(data.transactions && typeof data.transactions === "object" ? data.transactions : {});
        revisionRef.current = Number(data.revision ?? 1);
        lastSavedFingerprintRef.current = JSON.stringify({
          airlines: data.airlines ?? [],
          agents: data.agents ?? [],
          transactions: data.transactions ?? {},
        });
        setSyncError(null);
        setLoaded(true);
      } catch (e) {
        // Never render or save demo/default financial data after a database load failure.
        console.error("Airline ledger load failed", e);
        setLoadError(String(e instanceof Error ? e.message : e));
        setLoaded(false);
      }
    })();
  }, []);

  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (!dirtyRef.current && savePendingRef.current === 0 && !saving) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [saving]);

  useEffect(() => {
    if (!loaded || conflictRef.current) return;
    const snapshot = { airlines, agents, transactions };
    const fingerprint = JSON.stringify(snapshot);
    // Nothing changed since the last load/save: never re-write the ledger.
    if (fingerprint === lastSavedFingerprintRef.current) {
      dirtyRef.current = false;
      return;
    }
    dirtyRef.current = true;
    setSaving(true);
    setSavedFlash(true);
    let cancelled = false;
    const t = setTimeout(() => {
      // Queue writes so rapid edits cannot complete out of order.
      savePendingRef.current += 1;
      saveQueueRef.current = saveQueueRef.current
        .catch(() => undefined)
        .then(() => save({
          expectedRevision: revisionRef.current,
          data: snapshot as any,
        } as any))
        .then((result: any) => {
          savePendingRef.current = Math.max(0, savePendingRef.current - 1);
          if (cancelled) return;
          if (!result?.success || !result?.persisted) {
            throw new Error("Ledger save was not confirmed by the secure backend.");
          }
          saveRetryCountRef.current = 0;
          if (saveRetryTimerRef.current !== null) {
            window.clearTimeout(saveRetryTimerRef.current);
            saveRetryTimerRef.current = null;
          }
          revisionRef.current = Number(result.revision ?? revisionRef.current);
          lastSavedFingerprintRef.current = fingerprint;
          dirtyRef.current = false;
          setSyncError(null);
          setSheetSyncStatus(result?.syncPending ? "pending" : "synced");
          setSheetSyncError(result?.syncError ?? null);
          setSavedFlash(false);
          setSaving(false);
        })
        .catch(async (e) => {
          savePendingRef.current = Math.max(0, savePendingRef.current - 1);
          setSaving(false);
          const message = String(e?.message ?? e);
          console.error("Airline ledger save failed", e);

          if (cancelled) return;

          setSavedFlash(false);
          if (message.includes("AIRLINE_LEDGER_CONFLICT")) {
            conflictRef.current = true;
            if (saveRetryTimerRef.current !== null) {
              window.clearTimeout(saveRetryTimerRef.current);
              saveRetryTimerRef.current = null;
            }
            setSyncError("This ledger changed elsewhere. Your current screen was NOT written over it. Reload before making more financial entries.");
            return;
          }

          // Never permanently pause autosave for a transient network/server
          // response. Re-read the authoritative revision first; only retry the
          // exact snapshot automatically when nobody else has changed the ledger.
          try {
            const remote: any = await load();
            if (cancelled) return;
            const remoteRevision = Number(remote?.revision ?? 0);
            if (remoteRevision !== Number(revisionRef.current)) {
              conflictRef.current = true;
              setSyncError("This ledger changed elsewhere. Your current screen was NOT written over it. Reload before making more financial entries.");
              return;
            }
          } catch (loadError) {
            console.warn("Airline ledger retry check failed", loadError);
          }

          saveRetryCountRef.current += 1;
          const attempt = saveRetryCountRef.current;
          const delay = Math.min(15000, Math.max(2000, attempt * 2000));
          setSyncError("Saving connection interrupted — your entries are safe on screen. Retrying automatically…");
          if (saveRetryTimerRef.current !== null) window.clearTimeout(saveRetryTimerRef.current);
          saveRetryTimerRef.current = window.setTimeout(() => {
            saveRetryTimerRef.current = null;
            if (!cancelled && dirtyRef.current && !conflictRef.current) {
              setSaveRetryTick((v) => v + 1);
            }
          }, delay);
        });
    }, 500);
    return () => { cancelled = true; clearTimeout(t); };
  }, [airlines, agents, transactions, loaded, saveRetryTick]);

  useEffect(() => {
    if (!loaded || conflictRef.current) return;
    let cancelled = false;
    const timer = window.setInterval(async () => {
      try {
        if (savePendingRef.current > 0) return;
        const remote: any = await load();
        if (cancelled) return;
        const remoteRevision = Number(remote?.revision ?? revisionRef.current);
        if (remoteRevision === revisionRef.current) return;

        const localFingerprint = JSON.stringify({ airlines, agents, transactions });
        if (localFingerprint === lastSavedFingerprintRef.current) {
          setAirlines(remote.airlines ?? []);
          setAgents(remote.agents ?? []);
          setTransactions(remote.transactions ?? {});
          revisionRef.current = remoteRevision;
          lastSavedFingerprintRef.current = JSON.stringify({
            airlines: remote.airlines ?? [],
            agents: remote.agents ?? [],
            transactions: remote.transactions ?? {},
          });
          setSyncError(null);
        } else {
          conflictRef.current = true;
          setSyncError("Another session changed the ledger. Auto-merge is disabled for financial safety; no remote data was overwritten.");
        }
      } catch (e) {
        console.error("Airline ledger live-sync check failed", e);
      }
    }, 5000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [loaded, airlines, agents, transactions, load]);

  let gateScreen: React.ReactNode = null;
  if (!loaded && !loadError) {
    gateScreen = <div style={{ ...styles.app, padding: 24 }}><div style={{ padding: 40, textAlign: "center", color: "var(--muted-foreground)" }}>Loading secure airline accounts…</div></div>;
  } else if (loadError && !loaded) {
    gateScreen = (
      <div style={{ ...styles.app, padding: 24 }}>
        <div style={{ maxWidth: 760, margin: "40px auto", background: "var(--card)", border: "1px solid var(--error)", borderRadius: 12, padding: 20 }}>
          <div style={{ fontWeight: 800, color: "var(--error)", fontSize: 16, marginBottom: 8 }}>AIRLINE ACCOUNTS SAFETY LOCK</div>
          <div style={{ fontSize: 13, lineHeight: 1.6, color: "var(--foreground)" }}>
            The financial ledger database could not be loaded. The page is intentionally blocked and no default/demo records will be shown or saved.
          </div>
          <div style={{ marginTop: 10, fontSize: 12, color: "var(--muted-foreground)", wordBreak: "break-word" }}>{loadError}</div>
          <button style={{ ...styles.primaryBtn, marginTop: 16 }} onClick={() => window.location.reload()}>Retry</button>
        </div>
      </div>
    );
  }

  const activeAirline = airlines.find((a) => a.id === activeTab);
  const rawRows = transactions[activeTab] || [];
  const computedRows = useMemo(
    () => computeLedgerRows(rawRows, activeAirline),
    [rawRows, activeAirline]
  );

  const filteredRows = useMemo(() => {
    if (!search.trim()) return computedRows;
    const q = search.toLowerCase();
    return computedRows.filter((r) =>
      Object.values(r).some((v) => String(v ?? "").toLowerCase().includes(q))
    );
  }, [computedRows, search]);

  const openAdd = (airlineId: string) => setModal({ mode: "add", airlineId, row: EMPTY_ROW() });
  const openEdit = (airlineId: string, row: any) => setModal({ mode: "edit", airlineId, row: { ...row } });

  const saveRow = (airlineId: string, row: any) => {
    setTransactions((prev) => {
      const list = prev[airlineId] ? [...prev[airlineId]] : [];
      if (row.id) {
        const idx = list.findIndex((r) => r.id === row.id);
        if (idx >= 0) list[idx] = row;
      } else {
        list.push({ ...row, id: uid() });
      }
      return { ...prev, [airlineId]: list };
    });
    setModal(null);
  };

  const deleteRow = (airlineId: string, id: string) => {
    setTransactions((prev) => ({
      ...prev,
      [airlineId]: (prev[airlineId] || []).filter((r) => r.id !== id),
    }));
    setConfirmDelete(null);
  };

  const updateOpeningBalance = (airlineId: string, value: number) => {
    setAirlines((prev) => prev.map((a) => (a.id === airlineId ? { ...a, openingBalance: value } : a)));
  };
  const updateOpeningBalanceDate = (airlineId: string, value: string) => {
    setAirlines((prev) => prev.map((a) => (a.id === airlineId ? { ...a, openingBalanceDate: value } : a)));
  };

  const addAirline = () => {
    if (!newAirline.name.trim()) return;
    const id = uid();
    setAirlines((prev) => [...prev, {
      id, name: newAirline.name.trim(),
      code: newAirline.code.trim().toUpperCase() || "--",
      openingBalance: 0,
      openingBalanceDate: new Date().toISOString().slice(0, 10),
    }]);
    setNewAirline({ name: "", code: "" });
    setAddAirlineOpen(false);
    setActiveTab(id);
  };

  const removeAirline = (id: string) => {
    const transactionCount = (transactions[id] || []).length;
    if (transactionCount > 0) {
      setSyncError("This airline account has financial transactions and cannot be deleted.");
      return;
    }
    setAirlines((prev) => prev.filter((a) => a.id !== id));
    setTransactions((prev) => { const next = { ...prev }; delete next[id]; return next; });
    if (activeTab === id) setActiveTab("dashboard");
  };

  const reorderAirlines = (draggedId: string, targetId: string) => {
    if (!draggedId || !targetId || draggedId === targetId) return;
    setAirlines((prev) => {
      const from = prev.findIndex((a) => a.id === draggedId);
      const to = prev.findIndex((a) => a.id === targetId);
      if (from < 0 || to < 0) return prev;
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  };

  const addAgent = () => {
    const name = newAgent.trim();
    if (!name || agents.includes(name)) return;
    setAgents((prev) => [...prev, name]);
    setNewAgent("");
  };
  const removeAgent = (name: string) => setAgents((prev) => prev.filter((a) => a !== name));

  const perAirlineSummary = useMemo(() => {
    return airlines.map((a) => {
      const list = computeLedgerRows(transactions[a.id] || [], a);
      const totalProfit = list.reduce((s, r) => s + (Number(r.profit) || 0), 0);
      const totalSales = list.reduce((s, r) => s + (Number(r.ticketSales) || 0), 0);
      const totalVoid = list.reduce((s, r) => s + (Number(r.voidCharges) || 0), 0);
      const currentBalance = list.length ? list[list.length - 1].balance : (Number(a.openingBalance) || 0);
      return { ...a, count: list.length, totalProfit, totalSales, totalVoid, currentBalance };
    });
  }, [airlines, transactions]);

  const allComputedRows = useMemo(() => {
    const scope = dashboardScope === "all" ? airlines.map((a) => a.id) : [dashboardScope];
    let out: any[] = [];
    scope.forEach((id) => {
      const a = airlines.find((x) => x.id === id);
      computeLedgerRows(transactions[id] || [], a).forEach((r) => out.push(r));
    });
    return out;
  }, [transactions, dashboardScope, airlines]);

  const monthlySummary = useMemo(() => {
    const map: any = {};
    allComputedRows.forEach((r) => {
      const k = monthKey(r.date);
      if (!map[k]) map[k] = { month: k, profit: 0, voidCharges: 0 };
      map[k].profit += Number(r.profit) || 0;
      map[k].voidCharges += Number(r.voidCharges) || 0;
    });
    return Object.values(map).sort((a: any, b: any) => a.month.localeCompare(b.month)) as any[];
  }, [allComputedRows]);

  const yearlySummary = useMemo(() => {
    const map: any = {};
    allComputedRows.forEach((r) => {
      const k = yearKey(r.date);
      if (!map[k]) map[k] = { year: k, sales: 0, voidCharges: 0, profit: 0 };
      map[k].sales += Number(r.ticketSales) || 0;
      map[k].voidCharges += Number(r.voidCharges) || 0;
      map[k].profit += Number(r.profit) || 0;
    });
    return Object.values(map).sort((a: any, b: any) => a.year.localeCompare(b.year)) as any[];
  }, [allComputedRows]);

  const grandTotals = useMemo(() => {
    const totalBalance = perAirlineSummary.reduce((s, a) => s + a.currentBalance, 0);
    const totalProfit = perAirlineSummary.reduce((s, a) => s + a.totalProfit, 0);
    const totalSales = perAirlineSummary.reduce((s, a) => s + a.totalSales, 0);
    return { totalBalance, totalProfit, totalSales };
  }, [perAirlineSummary]);

  const allExportRows = useMemo(() => {
    const out: { airlineName: string; sr: number; row: any }[] = [];
    airlines.forEach((a) => {
      computeLedgerRows(transactions[a.id] || [], a).forEach((r, i) => out.push({ airlineName: a.name, sr: i + 1, row: r }));
    });
    return out;
  }, [airlines, transactions]);

  const exportAllCSV = () => {
    const headers = ["Airline", "Sr #", ...COLUMNS.map((c) => c.label)];
    const lines = [headers.join(",")];
    allExportRows.forEach((entry) => {
      const vals = [entry.airlineName, entry.sr, ...COLUMNS.map((c) => {
        const v = entry.row[c.key] ?? "";
        const s = String(v).replace(/"/g, '""');
        return /[",\n]/.test(s) ? `"${s}"` : s;
      })];
      lines.push(vals.join(","));
    });
    downloadCSV("rohi-international-travels-full-ledger.csv", lines.join("\n"));
  };

  const exportAllExcel = () => {
    const { headers, body, isNumeric } = buildExportTable(allExportRows, true);
    exportLedgerExcel("ROHI International Travels - Full Airline Accounts.xlsx", "Full Airline Accounts — All Airlines", headers, body, isNumeric);
  };

  const exportAllPDF = () => {
    const { headers, body, isNumeric } = buildExportTable(allExportRows, true);
    exportLedgerPDF("ROHI International Travels - Full Airline Accounts.pdf", "Full Airline Accounts — All Airlines", headers, body, isNumeric);
  };

  if (gateScreen) return gateScreen;

  return (
    <div style={styles.app}>
      <style>{`
        .airline-ledger * { box-sizing: border-box; }
        .airline-ledger input, .airline-ledger select { font-family: var(--font-sans); }
        .airline-ledger input:focus, .airline-ledger select:focus { outline: 2px solid var(--accent-ink); outline-offset: -1px; }
        .airline-ledger table { border-collapse: collapse; width: 100%; }
        .airline-ledger ::placeholder { color: var(--muted-foreground); }
        .airline-ledger .num { font-variant-numeric: tabular-nums; }
        .airline-ledger .cell-input { width: 100%; border: 1px solid transparent; background: transparent; padding: 6px 7px; border-radius: 6px; font-size: 12.5px; }
        .airline-ledger .cell-input:hover { border-color: var(--border); }
        .airline-ledger .cell-input:focus { border-color: var(--accent-ink); background: var(--card); }
      `}</style>

      <div className="airline-ledger">
        <div style={styles.body}>
          <TabStrip
            airlines={airlines}
            transactions={transactions}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            onAddAirline={() => setAddAirlineOpen(true)}
            onReorder={reorderAirlines}
          />

          <main style={styles.main}>
            {activeTab === "dashboard" ? (
              <Dashboard
                airlines={airlines}
                perAirlineSummary={perAirlineSummary}
                grandTotals={grandTotals}
                monthlySummary={monthlySummary}
                yearlySummary={yearlySummary}
                dashboardScope={dashboardScope}
                setDashboardScope={setDashboardScope}
                onExportAllCSV={exportAllCSV}
                onExportAllExcel={exportAllExcel}
                onExportAllPDF={exportAllPDF}
                syncError={syncError}
                sheetSyncStatus={sheetSyncStatus}
                sheetSyncError={sheetSyncError}
                onEditAirline={setActiveTab}
                onRemoveAirline={removeAirline}
                saving={saving}
              />
            ) : (
              <LedgerTable
                airline={activeAirline}
                rows={filteredRows}
                rawCount={rawRows.length}
                search={search}
                setSearch={setSearch}
                agents={agents}
                newAgent={newAgent}
                setNewAgent={setNewAgent}
                onAddAgent={addAgent}
                onRemoveAgent={removeAgent}
                onAdd={() => openAdd(activeTab)}
                onEdit={(row: any) => openEdit(activeTab, row)}
                onDelete={(id: string) => setConfirmDelete({ airlineId: activeTab, id })}
                onExportCSV={() => downloadCSV(`${activeAirline?.code || "airline"}-ledger.csv`, rowsToCSV(filteredRows))}
                onExportExcel={() => {
                  const { headers, body, isNumeric } = buildExportTable(filteredRows, false);
                  exportLedgerExcel(`${activeAirline?.name || "Airline"} Ledger.xlsx`, `${activeAirline?.name || "Airline"} Ledger`, headers, body, isNumeric);
                }}
                onExportPDF={() => {
                  const { headers, body, isNumeric } = buildExportTable(filteredRows, false);
                  exportLedgerPDF(`${activeAirline?.name || "Airline"} Ledger.pdf`, `${activeAirline?.name || "Airline"} Ledger`, headers, body, isNumeric);
                }}
                onOpeningBalance={(v: number) => updateOpeningBalance(activeTab, v)}
                onOpeningBalanceDate={(v: string) => updateOpeningBalanceDate(activeTab, v)}
              />
            )}
          </main>
        </div>

        <SavedFooter savedFlash={savedFlash} syncError={syncError} sheetSyncStatus={sheetSyncStatus} sheetSyncError={sheetSyncError} />

        {modal && (
          <RowModal
            modal={modal}
            agents={registeredAgencyNames.length ? registeredAgencyNames : agents}
            airline={airlines.find((a) => a.id === modal.airlineId)}
            priorRows={(transactions[modal.airlineId] || []).filter((r) => r.id !== modal.row.id)}
            onClose={() => setModal(null)}
            onSave={saveRow}
          />
        )}

        {confirmDelete && (
          <ConfirmDialog
            message="Delete this transaction record? This can't be undone."
            onCancel={() => setConfirmDelete(null)}
            onConfirm={() => deleteRow(confirmDelete.airlineId, confirmDelete.id)}
          />
        )}

        {addAirlineOpen && (
          <AddAirlineModal value={newAirline} setValue={setNewAirline} onClose={() => setAddAirlineOpen(false)} onSave={addAirline} />
        )}
      </div>
    </div>
  );
}

function SavedFooter({ savedFlash, syncError, sheetSyncStatus, sheetSyncError }: any) {
  const label = syncError
    ? syncError
    : savedFlash
      ? "Saving securely to Supabase…"
      : sheetSyncStatus === "pending"
        ? "Saved to Supabase • Updating Google Sheet automatically…"
        : sheetSyncStatus === "error"
          ? "Saved to Supabase • Google Sheet backup is retrying automatically"
          : sheetSyncStatus === "not_configured"
            ? "Saved to Supabase • Google Sheet backup is not configured"
            : "Saved to Supabase • Google Sheet backup synced";
  return (
    <div style={{ ...styles.savedFooter, minHeight: syncError || sheetSyncError ? 44 : undefined }}>
      <span style={{ ...styles.savedDot, opacity: savedFlash ? 1 : 0.35 }} />
      {label}
    </div>
  );
}

function TabStrip({ airlines, transactions, activeTab, setActiveTab, onAddAirline, onReorder }: any) {
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  return (
    <nav style={styles.tabStrip} aria-label="Airline navigation">
      <TabStub active={activeTab === "dashboard"} onClick={() => setActiveTab("dashboard")} code={<LayoutDashboard size={15} />} label="Dashboard" />
      <div style={styles.tabDivider} />
      {airlines.map((a: any) => {
        const rows = transactions?.[a.id] ?? [];
        const currentBalance = rows.reduce(
          (running: number, row: any) => running - (Number(row.creditFromId) || 0),
          Number(a.openingBalance) || 0,
        );
        return (
          <div
            key={a.id}
            draggable
            onDragStart={(event) => {
              setDraggedId(a.id);
              event.dataTransfer.effectAllowed = "move";
              event.dataTransfer.setData("text/plain", a.id);
            }}
            onClick={() => setActiveTab(a.id)}
            onDragOver={(event) => {
              event.preventDefault();
              event.dataTransfer.dropEffect = "move";
              if (draggedId !== a.id) setDragOverId(a.id);
            }}
            onDragLeave={() => setDragOverId((id) => id === a.id ? null : id)}
            onDrop={(event) => {
              event.preventDefault();
              const sourceId = event.dataTransfer.getData("text/plain") || draggedId;
              if (sourceId) onReorder(sourceId, a.id);
              setDraggedId(null);
              setDragOverId(null);
            }}
            onDragEnd={() => {
              setDraggedId(null);
              setDragOverId(null);
            }}
            title="Drag to change airline order"
            style={{
              opacity: draggedId === a.id ? 0.55 : 1,
              transform: dragOverId === a.id ? "translateY(-2px)" : "none",
              transition: "transform 120ms ease, opacity 120ms ease",
              cursor: "grab",
            }}
          >
            <TabStub
              active={activeTab === a.id}
              onClick={() => setActiveTab(a.id)}
              code={a.code}
              label={a.name}
              balance={currentBalance}
            />
          </div>
        );
      })}
      <button style={styles.addTabBtn} onClick={onAddAirline}><Plus size={16} /> Airline</button>
    </nav>
  );
}
function TabStub({ active, onClick, code, label, balance }: any) {
  return (
    <button onClick={onClick} style={{ ...styles.tabStub, ...(active ? styles.tabStubActive : {}) }} title={`${label} • Current Balance: ${fmt(balance)}`}>
      <span style={styles.tabLogoMini}><AirlineLogoTile code={code} /></span>
      <span style={{ ...styles.tabLabel, minWidth: 0 }}>{label}</span>
      {typeof balance === "number" && <span style={styles.tabBalanceMini}>{fmt(balance)}</span>}
    </button>
  );
}

function LedgerTable({
  airline, rows, rawCount, search, setSearch, agents, newAgent, setNewAgent,
  onAddAgent, onRemoveAgent, onAdd, onEdit, onDelete, onExportCSV, onExportExcel, onExportPDF,
  onOpeningBalance, onOpeningBalanceDate,
}: any) {
  const [agentsOpen, setAgentsOpen] = useState(false);
  const [ledgerPage, setLedgerPage] = useState(1);
  useEffect(() => {
    setLedgerPage(1);
  }, [airline?.id, search]);
  const { pageItems: pagedRows, totalPages: ledgerTotalPages, safePage: ledgerSafePage } = paginate(rows, ledgerPage, 25);

  return (
    <div>
      <div style={styles.panelHeader}>
        <div>
          <h2 style={styles.panelTitle}>{airline?.name}</h2>
          <div style={styles.panelMeta}>{rawCount} transaction{rawCount === 1 ? "" : "s"} · IATA code {airline?.code}</div>
        </div>
        <div style={styles.panelActions}>
          <label style={styles.openingBalanceBox}>
            Opening balance
            <input
              type="date"
              value={airline?.openingBalanceDate ?? new Date().toISOString().slice(0, 10)}
              onChange={(e) => onOpeningBalanceDate(e.target.value)}
              title="Opening balance date"
            />
            <input
              type="number"
              className="cell-input num"
              style={{ width: 100, border: "1px solid var(--border)", background: "var(--card)" }}
              value={airline?.openingBalance ?? 0}
              onChange={(e) => onOpeningBalance(e.target.value === "" ? 0 : Number(e.target.value))}
            />
          </label>
          <div style={styles.searchBox}>
            <Search size={14} color="var(--muted-foreground)" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search this ledger" style={styles.searchInput} />
          </div>
          <button style={styles.ghostBtn} onClick={() => setAgentsOpen((v) => !v)}><Users size={15} /> Agents</button>
          <ExportMenu onExcel={onExportExcel} onSheets={onExportCSV} onPDF={onExportPDF} />
          <button style={styles.primaryBtn} onClick={onAdd}><Plus size={15} /> Add record</button>
        </div>
      </div>

      {agentsOpen && (
        <div style={styles.agentBar}>
          <span style={styles.agentBarLabel}>Agent list:</span>
          {agents.map((a: string) => (
            <span key={a} style={styles.agentChip}>
              {a}
              <button style={styles.agentChipX} onClick={() => onRemoveAgent(a)} title="Remove agent"><X size={11} /></button>
            </span>
          ))}
          <input
            value={newAgent}
            onChange={(e) => setNewAgent(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") onAddAgent(); }}
            placeholder="New agent name"
            style={{ ...styles.input, width: 150, padding: "5px 8px" }}
          />
          <button style={styles.ghostBtnSm} onClick={onAddAgent}><Plus size={12} /> Add</button>
        </div>
      )}

      <div style={styles.tableWrap}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={{ ...styles.th, width: 44 }}>Sr #</th>
              {COLUMNS.map((c) => (
                <th key={c.key} style={{ ...styles.th, minWidth: c.width }}>
                  {c.label}{c.computed && <span style={styles.autoTag}>auto</span>}
                </th>
              ))}
              <th style={{ ...styles.th, width: 84, textAlign: "right" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {ledgerSafePage === 1 && (
              <tr style={{ ...styles.tr, background: "rgba(217, 119, 87, 0.05)", fontWeight: 500 }}>
                <td style={{ ...styles.tdMuted, fontWeight: 700 }}>0</td>
                <td style={styles.td}>{airline?.openingBalanceDate || new Date().toISOString().slice(0, 10)}</td>
                <td style={styles.td}>
                  <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 4, background: "var(--card)", border: "1px solid var(--border)", fontSize: 11, fontWeight: 700, color: "var(--accent-clay, #d97757)" }}>
                    Opening Balance
                  </span>
                </td>
                <td style={styles.tdMuted}>-</td>
                <td style={styles.tdMuted}>-</td>
                <td style={styles.tdMuted}>-</td>
                <td style={styles.tdMuted}>-</td>
                <td style={{ ...styles.td, ...styles.numCell }}>-</td>
                <td style={styles.tdMuted}>-</td>
                <td style={{ ...styles.td, ...styles.numCell }}>-</td>
                <td style={{ ...styles.td, ...styles.numCell, fontWeight: 800, color: "var(--ledger-red, var(--error))" }} className="num">
                  {fmt(airline?.openingBalance ?? 0)}
                </td>
                <td style={styles.tdMuted}>-</td>
                <td style={{ ...styles.td, ...styles.numCell }}>-</td>
                <td style={{ ...styles.td, ...styles.numCell }}>-</td>
                <td style={{ ...styles.td, fontWeight: 600 }}>OPENING BALANCE</td>
                <td style={{ ...styles.td, textAlign: "right", color: "var(--muted-foreground)", fontSize: 11 }}>Starting</td>
              </tr>
            )}
            {rows.length === 0 && (
              <tr>
                <td colSpan={COLUMNS.length + 2} style={{ ...styles.emptyCell, paddingTop: 16, paddingBottom: 16 }}>
                  No ticket sales or manual entries recorded yet. Starting balance is active above.
                </td>
              </tr>
            )}
            {pagedRows.map((r: any, i: number) => (
              <tr key={r.id} style={styles.tr}>
                <td style={styles.tdMuted}>{i + 1}</td>
                {COLUMNS.map((c) => (
                  <td
                    key={c.key}
                    style={c.type === "number" ? { ...styles.td, ...styles.numCell, color: c.key === "profit" && Number(r.profit) < 0 ? "var(--error)" : undefined } : styles.td}
                    className={c.type === "number" ? "num" : ""}
                  >
                    {c.type === "number" ? fmt(r[c.key]) : (r[c.key] || <span style={{ color: "var(--gray-400)" }}>-</span>)}
                  </td>
                ))}
                <td style={{ ...styles.td, textAlign: "right", whiteSpace: "nowrap" }}>
                  <button style={styles.iconBtn} onClick={() => onEdit(r)} title="Edit"><Pencil size={14} /></button>
                  <button style={{ ...styles.iconBtn, color: "var(--error)" }} onClick={() => onDelete(r.id)} title="Delete"><Trash2 size={14} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "12px 0" }}>
          <SimplePager
            page={ledgerSafePage}
            totalPages={ledgerTotalPages}
            onPrev={() => setLedgerPage((p: number) => Math.max(1, p - 1))}
            onNext={() => setLedgerPage((p: number) => Math.min(ledgerTotalPages, p + 1))}
          />
        </div>
      )}
    </div>
  );
}

function RowModal({ modal, agents, airline, priorRows, onClose, onSave }: any) {
  const [form, setForm] = useState<any>(modal.row);
  const [error, setError] = useState("");
  const [agentSearch, setAgentSearch] = useState(modal.row.agentName || "");

  const update = (key: string, val: any) => setForm((f: any) => ({ ...f, [key]: val }));

  const preview = useMemo(() => {
    const openingBalance = Number(airline?.openingBalance) || 0;
    const priorBalance = priorRows.length
      ? computeLedgerRows(priorRows, airline)[priorRows.length - 1].balance
      : openingBalance;
    const credit = Number(form.creditFromId) || 0;
    const balance = priorBalance - credit;
    const profit = (Number(form.ticketSales) || 0) - credit;
    const ledgerEntry = [form.paxName, form.sector, form.pnr, airline?.code]
      .map((v: any) => (v || "").toString().trim())
      .filter(Boolean)
      .join(" - ");
    return { balance, profit, ledgerEntry };
  }, [form, airline, priorRows]);

  const handleSave = () => {
    if (!form.date || !String(form.paxName || "").trim()) {
      setError("Date and Pax Name are required.");
      return;
    }
    onSave(modal.airlineId, form);
  };

  const editableCols = COLUMNS.filter((c) => !c.computed);

  return (
    <Overlay onClose={onClose}>
      <div style={styles.modal}>
        <div style={styles.modalHeader}>
          <h3 style={styles.modalTitle}>{modal.mode === "add" ? "Add transaction" : "Edit transaction"}</h3>
          <button style={styles.iconBtn} onClick={onClose}><X size={18} /></button>
        </div>
        <div style={styles.modalGrid}>
          {editableCols.map((c) => (
            <div key={c.key} style={styles.field}>
              <label style={styles.label}>{c.label}</label>
              {c.type === "select" ? (
                <div style={{ position: "relative" }}>
                  <input
                    style={styles.input}
                    value={agentSearch}
                    placeholder="Search agency name"
                    onChange={(e) => { setAgentSearch(e.target.value); update(c.key, e.target.value); }}
                    list="registered-agency-names"
                  />
                  <datalist id="registered-agency-names">
                    {agents.map((a: string) => <option key={a} value={a} />)}
                  </datalist>
                </div>
              ) : c.type === "transactionType" ? (
                <div style={styles.radioGroup} role="radiogroup" aria-label="Transaction type">
                  {["Add Transaction", "Top Up", "Cancel/Refund", "Exchange"].map((type) => (
                    <label key={type} style={styles.radioOption}>
                      <input
                        type="radio"
                        name="transactionType"
                        value={type}
                        checked={(form[c.key] || "Add Transaction") === type}
                        onChange={(e) => update(c.key, e.target.value)}
                      />
                      <span>{type}</span>
                    </label>
                  ))}
                </div>
              ) : (
                <input
                  type={c.type === "date" ? "date" : c.type === "number" ? "number" : "text"}
                  value={form[c.key] ?? ""}
                  onChange={(e) => update(c.key, e.target.value)}
                  style={styles.input}
                />
              )}
            </div>
          ))}
        </div>

        <div style={styles.previewBox}>
          <div style={styles.previewItem}><span style={styles.previewLabel}>Balance <em>(auto)</em></span><span className="num" style={styles.previewValue}>{fmt(preview.balance)}</span></div>
          <div style={styles.previewItem}><span style={styles.previewLabel}>Profit <em>(auto)</em></span><span className="num" style={{ ...styles.previewValue, color: preview.profit < 0 ? "var(--error)" : "var(--success)" }}>{fmt(preview.profit)}</span></div>
          <div style={styles.previewItem}><span style={styles.previewLabel}>Ledger Entry <em>(auto)</em></span><span style={styles.previewValue}>{preview.ledgerEntry || "-"}</span></div>
        </div>

        {error && (<div style={styles.errorNote}><AlertCircle size={14} /> {error}</div>)}

        <div style={styles.modalFooter}>
          <button style={styles.ghostBtn} onClick={onClose}>Cancel</button>
          <button style={styles.primaryBtn} onClick={handleSave}><Save size={15} /> Save record</button>
        </div>
      </div>
    </Overlay>
  );
}

function Dashboard({
  airlines, perAirlineSummary, grandTotals, monthlySummary, yearlySummary,
  dashboardScope, setDashboardScope, onExportAllCSV, onExportAllExcel, onExportAllPDF,
  syncError, sheetSyncStatus, sheetSyncError,
  onEditAirline, onRemoveAirline, saving,
}: any) {
  const [removeConfirm, setRemoveConfirm] = useState<any>(null);

  return (
    <div>
      <div style={styles.panelHeader}>
        <div>
          <AdminPageHeading icon={Building2} label="Airline Balance Dashboard" count={airlines.length} countLabel="Airlines tracked" />
          <div style={styles.panelMeta}>Multi-airline account overview for ROHI INTERNATIONAL TRAVELS</div>
        </div>
        <div style={styles.panelActions}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 7,
              minHeight: 34,
              padding: "7px 10px",
              borderRadius: 8,
              border: "1px solid var(--border)",
              background: "var(--card)",
              fontSize: 11,
              color: sheetSyncStatus === "error" ? "var(--destructive)" : "var(--muted-foreground)",
              whiteSpace: "nowrap",
            }}
            title={sheetSyncError || "Supabase is the source of truth. Google Sheet is an automatic read-only backup."}
          >
            {saving ? (
              <>
                <LoaderCircle size={14} className="animate-spin" />
                Saving securely…
              </>
            ) : sheetSyncStatus === "pending" ? (
              <>
                <LoaderCircle size={14} className="animate-spin" />
                Updating Sheet…
              </>
            ) : sheetSyncStatus === "error" ? (
              <>
                <AlertCircle size={14} />
                Sheet backup retrying automatically
              </>
            ) : sheetSyncStatus === "not_configured" ? (
              <>
                <FileSpreadsheet size={14} />
                Sheet backup not configured
              </>
            ) : (
              <>
                <FileSpreadsheet size={14} />
                Auto-synced to Google Sheet
              </>
            )}
          </div>
          <ExportMenu label="Export all" onExcel={onExportAllExcel} onSheets={onExportAllCSV} onPDF={onExportAllPDF} />
        </div>
        {syncError && (
          <div style={{ ...styles.errorNote, marginTop: 8, justifyContent: "flex-end" }}>
            <AlertCircle size={14} /> {syncError}
          </div>
        )}
      </div>

      <div style={styles.metricGrid}>
        <AdminStatCard icon={Wallet} label="Combined balance" value={fmt(grandTotals.totalBalance)} tone="navy" />
        <AdminStatCard icon={TrendingUp} label="Total profit" value={fmt(grandTotals.totalProfit)} tone={grandTotals.totalProfit >= 0 ? "green" : "muted"} />
        <AdminStatCard icon={TrendingDown} label="Total ticket sales" value={fmt(grandTotals.totalSales)} tone="amber" />
        <AdminStatCard icon={Building2} label="Airlines tracked" value={airlines.length} tone="navy" />
      </div>

      <section style={styles.balanceCardsSection}>
        <div style={styles.sectionHeaderRow}>
          <div>
            <h3 style={styles.sectionTitle}>Current Balance By Airline</h3>
            <div style={styles.panelMeta}>Select an airline to open its ledger</div>
          </div>
        </div>
        <div style={styles.balanceCardGrid}>
          {perAirlineSummary.map((a: any) => (
            <button key={a.id} type="button" style={styles.balanceCard} onClick={() => onEditAirline(a.id)} title={a.name}>
              <div style={styles.balanceLogoBox}>
                <AirlineLogoTile code={a.code} />
              </div>
              <strong style={styles.balanceCardValueBig} className="num">{fmt(a.currentBalance)}</strong>
            </button>
          ))}
        </div>
      </section>

      <section style={styles.section}>
        <h3 style={styles.sectionTitle}>Account Balances By Airline</h3>
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Airline</th>
                <th style={styles.th}>Code</th>
                <th style={{ ...styles.th, textAlign: "right" }}>Records</th>
                <th style={{ ...styles.th, textAlign: "right" }}>Ticket sales</th>
                <th style={{ ...styles.th, textAlign: "right" }}>VOID charges</th>
                <th style={{ ...styles.th, textAlign: "right" }}>Profit</th>
                <th style={{ ...styles.th, textAlign: "right" }}>Current balance</th>
                <th style={{ ...styles.th, width: 130, textAlign: "right" }}>Manage</th>
              </tr>
            </thead>
            <tbody>
              {perAirlineSummary.map((a: any) => (
                <tr key={a.id} style={styles.tr}>
                  <td style={styles.td}>{a.name}</td>
                  <td style={styles.tdMuted}>{a.code}</td>
                  <td style={{ ...styles.td, ...styles.numCell }} className="num">{a.count}</td>
                  <td style={{ ...styles.td, ...styles.numCell }} className="num">{fmt(a.totalSales)}</td>
                  <td style={{ ...styles.td, ...styles.numCell }} className="num">{fmt(a.totalVoid)}</td>
                  <td style={{ ...styles.td, ...styles.numCell, color: a.totalProfit >= 0 ? "var(--success)" : "var(--error)" }} className="num">{fmt(a.totalProfit)}</td>
                  <td style={{ ...styles.td, ...styles.numCell, fontWeight: 600 }} className="num">{fmt(a.currentBalance)}</td>
                  <td style={{ ...styles.td, textAlign: "right", whiteSpace: "nowrap" }}>
                    <button style={styles.ghostBtnSm} onClick={() => onEditAirline(a.id)}>Open ledger</button>
                    <button style={{ ...styles.iconBtn, color: a.count > 0 ? "var(--muted-foreground)" : "var(--error)", opacity: a.count > 0 ? 0.45 : 1, cursor: a.count > 0 ? "not-allowed" : "pointer" }} onClick={() => a.count === 0 && setRemoveConfirm(a)} disabled={a.count > 0} title={a.count > 0 ? "Cannot delete an account with financial transactions" : "Remove empty airline account"}><Trash2 size={14} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section style={styles.section}>
        <div style={styles.sectionHeaderRow}>
          <h3 style={styles.sectionTitle}>Monthly profit / loss</h3>
          <select value={dashboardScope} onChange={(e) => setDashboardScope(e.target.value)} style={styles.select}>
            <option value="all">All airlines</option>
            {airlines.map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
        {monthlySummary.length === 0 ? (
          <div style={styles.emptyBlock}>No dated transactions yet — add records to see monthly trends.</div>
        ) : (
          <div style={{ width: "100%", height: 260 }}>
            <ResponsiveContainer>
              <BarChart data={monthlySummary} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} axisLine={{ stroke: "var(--border)" }} />
                <YAxis tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} axisLine={{ stroke: "var(--border)" }} />
                <Tooltip formatter={(v: any) => fmt(v)} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="profit" name="Profit" fill="var(--success)" radius={[3, 3, 0, 0]} />
                <Bar dataKey="voidCharges" name="VOID charges" fill="var(--error)" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      <section style={styles.section}>
        <h3 style={styles.sectionTitle}>Yearly summary</h3>
        {yearlySummary.length === 0 ? (
          <div style={styles.emptyBlock}>No dated transactions yet.</div>
        ) : (
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Year</th>
                  <th style={{ ...styles.th, textAlign: "right" }}>Ticket sales</th>
                  <th style={{ ...styles.th, textAlign: "right" }}>VOID charges</th>
                  <th style={{ ...styles.th, textAlign: "right" }}>Profit / loss</th>
                </tr>
              </thead>
              <tbody>
                {yearlySummary.map((y: any) => (
                  <tr key={y.year} style={styles.tr}>
                    <td style={{ ...styles.td, fontWeight: 600 }}>{y.year}</td>
                    <td style={{ ...styles.td, ...styles.numCell }} className="num">{fmt(y.sales)}</td>
                    <td style={{ ...styles.td, ...styles.numCell }} className="num">{fmt(y.voidCharges)}</td>
                    <td style={{ ...styles.td, ...styles.numCell, color: y.profit >= 0 ? "var(--success)" : "var(--error)", fontWeight: 600 }} className="num">{fmt(y.profit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section style={styles.section}>
        <h3 style={styles.sectionTitle}>Export &amp; Sync</h3>
        <div style={styles.syncNote}>
          <FileSpreadsheet size={16} color="var(--warning)" style={{ flexShrink: 0, marginTop: 2 }} />
          <div>
            Every add, edit or delete is saved automatically to your secure backend database, so your data is
            here next time you open it. Use the <strong>Export</strong> button above (per airline) or
            <strong> Export all</strong> on the dashboard any time — each offers a professionally formatted
            <strong> Excel (.xlsx)</strong> workbook, a <strong> Google Sheets</strong>-ready CSV (File → Import in
            Google Sheets), or a branded <strong> PDF</strong> report. Ask and a step-by-step Google Sheets
            one-click, always-on sync setup can be provided.
          </div>
        </div>
      </section>

      {removeConfirm && (
        <ConfirmDialog
          message={`Remove ${removeConfirm.name}? This account has no financial transactions, so only the empty account will be removed.`}
          onCancel={() => setRemoveConfirm(null)}
          onConfirm={() => { onRemoveAirline(removeConfirm.id); setRemoveConfirm(null); }}
        />
      )}
    </div>
  );
}

function AddAirlineModal({ value, setValue, onClose, onSave }: any) {
  return (
    <Overlay onClose={onClose}>
      <div style={{ ...styles.modal, maxWidth: 380 }}>
        <div style={styles.modalHeader}>
          <h3 style={styles.modalTitle}>Add airline</h3>
          <button style={styles.iconBtn} onClick={onClose}><X size={18} /></button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={styles.field}>
            <label style={styles.label}>Airline name</label>
            <input style={styles.input} placeholder="e.g. Turkish Airlines" value={value.name} onChange={(e) => setValue((v: any) => ({ ...v, name: e.target.value }))} />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>IATA code (optional)</label>
            <input style={styles.input} placeholder="e.g. TK" maxLength={3} value={value.code} onChange={(e) => setValue((v: any) => ({ ...v, code: e.target.value }))} />
          </div>
        </div>
        <div style={styles.modalFooter}>
          <button style={styles.ghostBtn} onClick={onClose}>Cancel</button>
          <button style={styles.primaryBtn} onClick={onSave}><Plus size={15} /> Add airline</button>
        </div>
      </div>
    </Overlay>
  );
}

function ConfirmDialog({ message, onCancel, onConfirm }: any) {
  return (
    <Overlay onClose={onCancel}>
      <div style={{ ...styles.modal, maxWidth: 380 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 20 }}>
          <AlertCircle size={20} color="var(--error)" style={{ flexShrink: 0 }} />
          <p style={{ margin: 0, fontSize: 14, color: "var(--foreground)", lineHeight: 1.5 }}>{message}</p>
        </div>
        <div style={styles.modalFooter}>
          <button style={styles.ghostBtn} onClick={onCancel}>Cancel</button>
          <button style={styles.dangerBtn} onClick={onConfirm}><Trash2 size={15} /> Delete</button>
        </div>
      </div>
    </Overlay>
  );
}

function Overlay({ children, onClose }: any) {
  return (
    <div style={styles.overlay} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      {children}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  app: { background: "var(--background)", fontFamily: 'var(--font-sans)', color: "var(--foreground)" },
  savedFooter: { display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontSize: 12, color: "var(--muted-foreground)", padding: "14px 0 24px" },
  savedDot: { width: 6, height: 6, borderRadius: "50%", background: "var(--success)", transition: "opacity .3s" },
  body: { display: "flex", maxWidth: 1400, margin: "0 auto" },
  tabStrip: { width: 216, flexShrink: 0, padding: "18px 10px", display: "flex", flexDirection: "column", gap: 4, borderRight: "1px dashed var(--border)", minHeight: "calc(100vh - 68px)" },
  tabDivider: { height: 1, background: "var(--border)", margin: "6px 4px" },
  tabStub: { display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 8, border: "1px solid transparent", background: "transparent", cursor: "pointer", textAlign: "left", fontSize: 13, color: "var(--foreground)", width: "100%" },
  tabStubActive: { background: "var(--foreground)", color: "var(--background)" },
  tabCode: { fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 11, minWidth: 30, textAlign: "center", padding: "3px 4px", borderRadius: 4, background: "var(--muted)", color: "var(--muted-foreground)", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" },
  tabLogoMini: { width: 28, height: 22, borderRadius: 5, background: "#fff", border: "1px solid var(--border)", display: "inline-flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0, padding: 2 },
  tabBalanceMini: { marginLeft: "auto", fontSize: 11, fontWeight: 700, color: "var(--accent-ink)", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" },
  tabCodeActive: { background: "var(--accent-ink)", color: "var(--foreground)" },
  tabLabel: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  addTabBtn: { marginTop: 10, display: "flex", alignItems: "center", gap: 6, justifyContent: "center", padding: "9px 12px", borderRadius: 8, border: "1px dashed var(--border)", background: "transparent", color: "var(--muted-foreground)", fontSize: 13, cursor: "pointer" },
  main: { flex: 1, padding: "24px 28px 60px", minWidth: 0 },
  panelHeader: { display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, marginBottom: 14, flexWrap: "wrap" },
  panelTitle: { fontFamily: 'var(--font-sans)', fontSize: 22, margin: 0, color: "var(--foreground)" },
  panelMeta: { fontSize: 13, color: "var(--muted-foreground)", marginTop: 4 },
  panelActions: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" },
  openingBalanceBox: { display: "flex", flexDirection: "column", gap: 3, fontSize: 11, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.03em" },
  searchBox: { display: "flex", alignItems: "center", gap: 6, background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, padding: "7px 10px" },
  searchInput: { border: "none", outline: "none", fontSize: 13, width: 150, background: "transparent" },
  ghostBtn: { display: "flex", alignItems: "center", gap: 6, padding: "9px 14px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--card)", color: "var(--foreground)", fontSize: 13, cursor: "pointer" },
  exportMenu: { position: "absolute", top: "calc(100% + 6px)", right: 0, background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, boxShadow: "0 8px 24px rgba(15,27,45,0.14)", zIndex: 50, minWidth: 190, overflow: "hidden" },
  exportMenuItem: { display: "flex", alignItems: "center", gap: 9, width: "100%", padding: "10px 14px", border: "none", background: "transparent", color: "var(--foreground)", fontSize: 13, cursor: "pointer", textAlign: "left" },
  ghostBtnSm: { padding: "6px 10px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--card)", color: "var(--foreground)", fontSize: 12, cursor: "pointer", marginRight: 6, display: "inline-flex", alignItems: "center", gap: 4 },
  primaryBtn: { display: "flex", alignItems: "center", gap: 6, padding: "9px 14px", borderRadius: 8, border: "1px solid var(--foreground)", background: "var(--foreground)", color: "var(--text-inverse)", fontSize: 13, cursor: "pointer" },
  dangerBtn: { display: "flex", alignItems: "center", gap: 6, padding: "9px 14px", borderRadius: 8, border: "1px solid var(--error)", background: "var(--error)", color: "var(--text-inverse)", fontSize: 13, cursor: "pointer" },
  iconBtn: { display: "inline-flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, borderRadius: 6, border: "none", background: "transparent", color: "var(--muted-foreground)", cursor: "pointer", marginLeft: 2 },
  agentBar: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, padding: "10px 12px", marginBottom: 12 },
  agentBarLabel: { fontSize: 12, color: "var(--muted-foreground)", marginRight: 2 },
  agentChip: { display: "inline-flex", alignItems: "center", gap: 5, background: "var(--info-soft)", color: "var(--foreground)", fontSize: 12, padding: "4px 6px 4px 10px", borderRadius: 999 },
  agentChipX: { border: "none", background: "transparent", cursor: "pointer", color: "var(--foreground)", display: "flex", alignItems: "center", padding: 2 },
  tableWrap: { background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, overflowX: "auto" },
  table: { fontSize: 13 },
  th: { textAlign: "left", padding: "10px 10px", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--muted-foreground)", borderBottom: "1px solid var(--border)", whiteSpace: "nowrap", background: "var(--background)" },
  autoTag: { marginLeft: 5, fontSize: 9, background: "var(--warning-soft)", color: "var(--warning)", padding: "1px 5px", borderRadius: 4, textTransform: "lowercase", letterSpacing: 0 },
  tr: { borderBottom: "1px solid var(--border)" },
  td: { padding: "8px 10px", whiteSpace: "nowrap" },
  tdCell: { padding: "3px 4px", whiteSpace: "nowrap" },
  tdMuted: { padding: "10px 12px", color: "var(--muted-foreground)" },
  numCell: { textAlign: "right" },
  emptyCell: { padding: "36px 12px", textAlign: "center", color: "var(--muted-foreground)", fontSize: 13 },
  emptyBlock: { padding: "28px 12px", textAlign: "center", color: "var(--muted-foreground)", fontSize: 13, background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10 },
  addRowBar: { display: "flex", alignItems: "center", gap: 6, justifyContent: "center", width: "100%", marginTop: 8, padding: "9px 12px", borderRadius: 8, border: "1px dashed var(--border)", background: "transparent", color: "var(--muted-foreground)", fontSize: 13, cursor: "pointer" },
  metricGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, marginBottom: 26 },
  metricCard: { display: "flex", alignItems: "center", gap: 12, background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, padding: "14px 16px" },
  metricIcon: { width: 34, height: 34, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  metricLabel: { fontSize: 12, color: "var(--muted-foreground)" },
  metricValue: { fontSize: 20, fontWeight: 700, color: "var(--foreground)", marginTop: 2 },
  balanceCardsSection: { marginTop: 28 },
  balanceCardGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 },
  balanceCard: { display: "flex", flexDirection: "column", alignItems: "center", minWidth: 0, textAlign: "center", background: "transparent", border: "none", padding: 0, cursor: "pointer", color: "var(--foreground)", transition: "transform .2s" },
  balanceLogoBox: { width: "100%", aspectRatio: "3 / 2", background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", padding: 14, boxSizing: "border-box" },
  airlineBadge: { color: "var(--text-inverse)", fontSize: 11, fontWeight: 800, letterSpacing: "0.04em", borderRadius: 6, padding: "5px 8px" },
  balanceCardValueBig: { marginTop: 10, fontSize: 24, fontWeight: 800, color: "var(--ledger-red, var(--error))" },
  section: { marginTop: 30 },
  sectionHeaderRow: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  sectionTitle: { fontFamily: 'var(--font-sans)', fontSize: 16, margin: "0 0 12px", color: "var(--foreground)" },
  select: { padding: "7px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--card)", fontSize: 13 },
  syncNote: { display: "flex", gap: 10, background: "var(--warning-soft)", border: "1px solid var(--warning)", borderRadius: 10, padding: "14px 16px", fontSize: 13, lineHeight: 1.55, color: "var(--warning)" },
  overlay: { position: "fixed", inset: 0, background: "rgba(15,27,45,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 20 },
  modal: { background: "var(--card)", borderRadius: 14, padding: 22, width: "100%", maxWidth: 640, maxHeight: "88vh", overflowY: "auto" },
  modalHeader: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 },
  modalGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 },
  modalTitle: { fontFamily: 'var(--font-sans)', fontSize: 18, margin: 0, color: "var(--foreground)" },
  field: { display: "flex", flexDirection: "column", gap: 5 },
  radioGroup: { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 7, padding: "2px 0" },
  radioOption: { display: "flex", alignItems: "center", gap: 6, minHeight: 28, fontSize: 12.5, color: "var(--foreground)" },
  label: { fontSize: 11, textTransform: "uppercase", letterSpacing: "0.03em", color: "var(--muted-foreground)" },
  input: { padding: "9px 10px", borderRadius: 7, border: "1px solid var(--border)", fontSize: 13.5 },
  previewBox: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginTop: 16, background: "var(--background)", border: "1px solid var(--border)", borderRadius: 10, padding: "12px 14px" },
  previewItem: { display: "flex", flexDirection: "column", gap: 3 },
  previewLabel: { fontSize: 11, textTransform: "uppercase", letterSpacing: "0.03em", color: "var(--muted-foreground)" },
  previewValue: { fontSize: 14, fontWeight: 600, color: "var(--foreground)" },
  errorNote: { display: "flex", alignItems: "center", gap: 6, marginTop: 12, color: "var(--error)", fontSize: 12.5 },
  modalFooter: { display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 20, borderTop: "1px solid var(--border)", paddingTop: 16 },
};
