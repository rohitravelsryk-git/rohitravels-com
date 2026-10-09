import React, { useState, useEffect, useMemo, useRef } from "react";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import {
  Home,
  Plus, Pencil, Trash2, Download, X, LayoutDashboard,
  TrendingUp, TrendingDown, Wallet, Search, Building2,
  AlertCircle, FileSpreadsheet, LoaderCircle, Save, FileText, Table, ChevronDown, LogOut,
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
import { getAirlineLedgerData, saveAirlineLedgerData, reorderAirlineLedger } from "@/lib/airline-ledger.functions";
import { listAgentsAdmin } from "@/lib/agent-admin.functions";
import { getAirlineLedgerGoogleSyncStatus, retryAirlineLedgerGoogleSync, syncAirlineLedgerGoogleSheetOnOpen } from "@/lib/airline-ledger-google-sync";
import { formatDateTimeShort } from "@/lib/date-format";
import { SimplePager, paginate } from "@/components/ui/simple-pager";
import { airlineIataCode, airlineLogoUrl } from "@/lib/airline-branding";
import { AirlineLogo } from "@/components/AirlineLogo";

export const Route = createFileRoute("/admin/airline-accounts")({
  component: AirlineLedgerRoute,
});

/* ---------- constants ---------- */


const DEFAULT_AGENTS: string[] = [];

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

function formatDisplayDate(val: any): string {
  if (!val) return "-";
  const s = String(val).trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) {
    const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
    const yr = m[1].slice(-2);
    const mo = months[parseInt(m[2], 10) - 1] || m[2];
    return `${m[3]}-${mo}-${yr}`;
  }
  return s;
}

function computeLedgerRows(rows: any[], airline: any) {
  const isServiceOnly = /other\s*service\s*providers/i.test(airline?.name);
  if (isServiceOnly) {
    return rows.map((r) => {
      const credit = Number(r.creditFromId) || 0;
      const profit = (Number(r.ticketSales) || 0) - credit;
      const ledgerEntry = [r.paxName, r.sector, r.pnr, airline?.code]
        .map((v) => (v || "").toString().trim())
        .filter(Boolean)
        .join(" - ");
      return {
        ...r,
        balance: 0,
        foreignBalance: null,
        txRoe: 1,
        txForeignCredit: 0,
        profit,
        ledgerEntry,
      };
    });
  }
  let running = Number(airline?.openingBalance) || 0;
  const isForeign = airline?.currency && airline.currency !== "PKR";
  const defaultRoe = Number(airline?.roe) || 1;
  let runningForeign = Number(airline?.openingBalanceForeign) || (isForeign && defaultRoe ? (running / defaultRoe) : 0);

  return rows.map((r) => {
    const credit = Number(r.creditFromId) || 0;
    running = running - credit;
    const profit = (Number(r.ticketSales) || 0) - credit;

    // Transaction ROE is immutable once recorded; defaults to airline active ROE
    const txRoe = Number(r.roe) || defaultRoe || 1;
    const txForeignCredit = r.foreignAmount !== undefined && r.foreignAmount !== null && r.foreignAmount !== ""
      ? Number(r.foreignAmount)
      : (isForeign ? (credit / txRoe) : 0);

    runningForeign = runningForeign - txForeignCredit;

    const ledgerEntry = [r.paxName, r.sector, r.pnr, airline?.code]
      .map((v) => (v || "").toString().trim())
      .filter(Boolean)
      .join(" - ");

    return {
      ...r,
      balance: running,
      foreignBalance: runningForeign,
      txRoe,
      txForeignCredit,
      profit,
      ledgerEntry,
    };
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
  subCell.font = { bold: true, size: 12, color: { argb: "FF0F1B2D" } };
  subCell.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(2).height = 24;

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

function AirlineLogoTile({ code, name = "", showIata = false }: { code?: string; name?: string; showIata?: boolean }) {
  const resolvedCode = airlineIataCode(name, code);
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <AirlineLogo name={name || resolvedCode} height={42} className="max-h-full max-w-full object-contain" />
    </div>
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
  const reorderSave = useServerFn(reorderAirlineLedger);
  const loadRegisteredAgents = useServerFn(listAgentsAdmin);
  const syncSheetOnOpen = useServerFn(syncAirlineLedgerGoogleSheetOnOpen);

  // Start empty: the database is the only source of financial records.
  const [airlines, setAirlines] = useState<any[]>([]);
  const [agents, setAgents] = useState<string[]>([]);
  const [transactions, setTransactions] = useState<Record<string, any[]>>({});
  const [activeTab, setActiveTab] = useState("dashboard");
  const [loaded, setLoaded] = useState(false);
  const [modal, setModal] = useState<any>(null);
  const [confirmDelete, setConfirmDelete] = useState<any>(null);
  const [addAirlineOpen, setAddAirlineOpen] = useState(false);
  const [newAirline, setNewAirline] = useState<any>({ name: "", code: "", currency: "PKR", roe: 1, openingBalance: 0, openingBalanceForeign: "" });
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
  const lastSavedDataRef = useRef<any>({ airlines: [], agents: [], transactions: {} });
  const conflictRef = useRef(false);
  const dirtyRef = useRef(false);
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
        lastSavedDataRef.current = {
          airlines: data.airlines ?? [],
          agents: data.agents ?? [],
          transactions: data.transactions ?? {},
        };
        lastSavedFingerprintRef.current = JSON.stringify(lastSavedDataRef.current);
        setSyncError(null);
        setLoaded(true);
        // Refresh the Google Sheet from the current Supabase order on page open.
        // This also catches safe admin-side ordering/configuration changes that
        // happened without a financial transaction edit.
        void syncSheetOnOpen().catch((error) => {
          console.warn("Airline Accounts Google Sheet open-sync failed", error);
        });
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

    // Dragging an airline changes only sort_order. Persist that through the
    // dedicated order path so the visible order is never tied to backup latency.
    // lightweight order RPC instead of the full financial snapshot + backup
    // pipeline. This prevents a slow Google Sheet/backup connection from
    // making a successful drag appear to roll back.
    const previous = lastSavedDataRef.current;
    const currentAirlineShape = airlines
      .map((a: any) => ({
        id: a.id,
        name: a.name,
        code: a.code,
        openingBalance: Number(a.openingBalance) || 0,
        openingBalanceDate: a.openingBalanceDate ?? "",
      }))
      .sort((a: any, b: any) => a.id.localeCompare(b.id));
    const previousAirlineShape = (previous.airlines ?? [])
      .map((a: any) => ({
        id: a.id,
        name: a.name,
        code: a.code,
        openingBalance: Number(a.openingBalance) || 0,
        openingBalanceDate: a.openingBalanceDate ?? "",
      }))
      .sort((a: any, b: any) => a.id.localeCompare(b.id));
    const orderOnlyChange =
      JSON.stringify(currentAirlineShape) === JSON.stringify(previousAirlineShape) &&
      JSON.stringify(agents) === JSON.stringify(previous.agents ?? []) &&
      JSON.stringify(transactions) === JSON.stringify(previous.transactions ?? {}) &&
      JSON.stringify(airlines.map((a: any) => a.id)) !== JSON.stringify((previous.airlines ?? []).map((a: any) => a.id));

    let cancelled = false;
    const t = setTimeout(() => {
      // Queue writes so rapid edits cannot complete out of order.
      savePendingRef.current += 1;
      saveQueueRef.current = saveQueueRef.current
        .catch(() => undefined)
        .then(() => orderOnlyChange
          ? reorderSave({
              data: {
                expectedRevision: revisionRef.current,
                airlineIds: airlines.map((a: any) => a.id),
              },
            } as any)
          : save({
              data: {
                expectedRevision: revisionRef.current,
                data: snapshot as any,
              },
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
          lastSavedDataRef.current = {
            airlines: airlines.map((a: any) => ({ ...a })),
            agents: [...agents],
            transactions: JSON.parse(JSON.stringify(transactions)),
          };
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

          // Do not endlessly retry deterministic validation/auth/schema failures.
          // Only transient transport/server failures should enter the retry loop.
          const retryable = /network|fetch|failed to fetch|load failed|timeout|timed out|connection|temporarily|\b5(?:02|03|04)\b|gateway/i.test(message);
          const permanent = /AIRLINE_LEDGER_|duplicate|violat|permission denied|unauthorized|forbidden|invalid|validation|schema|not configured|cannot be deleted|current ledger revision/i.test(message);
          if (permanent || !retryable) {
            setSyncError(`Save rejected: ${message}`);
            return;
          }

          saveRetryCountRef.current += 1;
          const attempt = saveRetryCountRef.current;
          const delay = Math.min(15000, Math.max(2000, attempt * 2000));
          setSyncError(`Saving connection interrupted (${message.slice(0, 140)}) — your entries are safe on screen. Retrying automatically…`);
          if (saveRetryTimerRef.current !== null) window.clearTimeout(saveRetryTimerRef.current);
          saveRetryTimerRef.current = window.setTimeout(() => {
            saveRetryTimerRef.current = null;
            if (!cancelled && dirtyRef.current && !conflictRef.current) {
              setSaveRetryTick((v) => v + 1);
            }
          }, delay);
        });
    }, 50);
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
        // Only ever move forward: an equal or older revision is a stale read,
        // and must never replace what is on screen.
        if (remoteRevision <= revisionRef.current) return;

        const localFingerprint = JSON.stringify({ airlines, agents, transactions });
        if (localFingerprint === lastSavedFingerprintRef.current) {
          setAirlines(remote.airlines ?? []);
          setAgents(remote.agents ?? []);
          setTransactions(remote.transactions ?? {});
          revisionRef.current = remoteRevision;
          lastSavedDataRef.current = {
            airlines: remote.airlines ?? [],
            agents: remote.agents ?? [],
            transactions: remote.transactions ?? {},
          };
          lastSavedFingerprintRef.current = JSON.stringify(lastSavedDataRef.current);
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

  const openAdd = (airlineId: string) => setModal({ mode: "add", airlineId, row: EMPTY_ROW(), recordType: "transaction" });
  const openEdit = (airlineId: string, row: any) => setModal({ mode: "edit", airlineId, row: { ...row }, recordType: "transaction" });

  const saveOpeningBalance = async (airlineId: string, openingBalanceDate: string, openingBalanceValue: number, openingBalanceForeignValue?: number | null) => {
    const amount = Number(openingBalanceValue);
    if (!openingBalanceDate || !Number.isFinite(amount)) {
      setSyncError("Opening balance date and a valid amount are required.");
      return false;
    }

    const nextAirlines = airlines.map((a: any) =>
      a.id === airlineId ? {
        ...a,
        openingBalance: amount,
        openingBalanceDate,
        ...(openingBalanceForeignValue !== undefined ? { openingBalanceForeign: openingBalanceForeignValue } : {}),
      } : a
    );
    const nextSnapshot = { airlines: nextAirlines, agents, transactions };

    setSaving(true);
    setSavedFlash(true);
    setSyncError(null);
    savePendingRef.current += 1;

    try {
      saveQueueRef.current = saveQueueRef.current
        .catch(() => undefined)
        .then(() => save({
          data: {
            expectedRevision: revisionRef.current,
            data: nextSnapshot as any,
          },
        } as any));

      const result: any = await saveQueueRef.current;
      if (!result?.success || !result?.persisted) {
        throw new Error("Opening balance save was not confirmed by the secure backend.");
      }

      revisionRef.current = Number(result.revision ?? revisionRef.current);
      lastSavedDataRef.current = {
        airlines: nextAirlines.map((a: any) => ({ ...a })),
        agents: [...agents],
        transactions: JSON.parse(JSON.stringify(transactions)),
      };
      lastSavedFingerprintRef.current = JSON.stringify(nextSnapshot);
      dirtyRef.current = false;
      conflictRef.current = false;
      setAirlines(nextAirlines);
      setSyncError(null);
      setSheetSyncStatus(result?.syncPending ? "pending" : "synced");
      setSheetSyncError(result?.syncError ?? null);
      setSavedFlash(false);
      return true;
    } catch (e) {
      const message = String(e instanceof Error ? e.message : e);
      console.error("Opening balance save failed", e);
      setSyncError(`Opening balance not saved: ${message}`);
      dirtyRef.current = true;
      return false;
    } finally {
      savePendingRef.current = Math.max(0, savePendingRef.current - 1);
      setSaving(false);
    }
  };

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

  const addAirline = () => {
    if (!newAirline.name.trim()) return;
    const id = uid();
    const isForeign = newAirline.currency && newAirline.currency !== "PKR";
    const roe = Number(newAirline.roe) || 1;
    const foreignBal = Number(newAirline.openingBalanceForeign) || 0;
    const pkrBal = isForeign ? (foreignBal ? Math.round(foreignBal * roe) : (Number(newAirline.openingBalance) || 0)) : (Number(newAirline.openingBalance) || 0);

    setAirlines((prev) => [...prev, {
      id,
      name: newAirline.name.trim(),
      code: newAirline.code.trim().toUpperCase() || "--",
      currency: newAirline.currency || "PKR",
      roe: isForeign ? roe : 1,
      openingBalance: pkrBal,
      openingBalanceForeign: isForeign ? (foreignBal || (roe ? pkrBal / roe : 0)) : null,
      openingBalanceDate: new Date().toISOString().slice(0, 10),
    }]);
    setNewAirline({ name: "", code: "", currency: "PKR", roe: 1, openingBalance: 0, openingBalanceForeign: "" });
    setAddAirlineOpen(false);
    setActiveTab(id);
  };

  const updateAirlineRoe = (airlineId: string, newRoe: number) => {
    if (!Number.isFinite(newRoe) || newRoe <= 0) return;
    setAirlines((prev) => prev.map((a) => a.id === airlineId ? { ...a, roe: newRoe } : a));
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 2000);
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

  const perAirlineSummary = useMemo(() => {
    return airlines.map((a) => {
      const list = computeLedgerRows(transactions[a.id] || [], a);
      const totalProfit = list.reduce((s, r) => s + (Number(r.profit) || 0), 0);
      const totalSales = list.reduce((s, r) => s + (Number(r.ticketSales) || 0), 0);
      const totalVoid = list.reduce((s, r) => s + (Number(r.voidCharges) || 0), 0);
      const currentBalance = list.length ? list[list.length - 1].balance : (Number(a.openingBalance) || 0);
      const isForeign = a.currency && a.currency !== "PKR";
      const currentForeignBalance = isForeign
        ? (list.length
            ? list[list.length - 1].foreignBalance
            : (Number(a.openingBalanceForeign) || (Number(a.roe) ? currentBalance / Number(a.roe) : 0)))
        : null;
      return {
        ...a,
        count: list.length,
        totalProfit,
        totalSales,
        totalVoid,
        currentBalance,
        currentForeignBalance,
        isForeign,
      };
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
    const totalBalance = perAirlineSummary
      .filter((a) => !/other\s*service\s*providers/i.test(a.name))
      .reduce((s, a) => s + a.currentBalance, 0);
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
                onUpdateRoe={updateAirlineRoe}
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
                onAdd={() => openAdd(activeTab)}
                onEdit={(row: any) => openEdit(activeTab, row)}
                onDelete={(id: string) => setConfirmDelete({ airlineId: activeTab, id })}
                onExportCSV={() => downloadCSV(`${activeAirline?.code || "airline"}-ledger.csv`, rowsToCSV(filteredRows))}
                onExportExcel={() => {
                  const { headers, body, isNumeric } = buildExportTable(filteredRows, false);
                  exportLedgerExcel(`${activeAirline?.name || "Airline"} - Airline Account Statement.xlsx`, `${activeAirline?.name || "Airline"} • ${activeAirline?.code || "—"} — Airline Account Statement`, headers, body, isNumeric);
                }}
                onExportPDF={() => {
                  const { headers, body, isNumeric } = buildExportTable(filteredRows, false);
                  exportLedgerPDF(`${activeAirline?.name || "Airline"} Ledger.pdf`, `${activeAirline?.name || "Airline"} Ledger`, headers, body, isNumeric);
                }}
              />
            )}
          </main>
        </div>

        <SavedFooter savedFlash={savedFlash} syncError={syncError} sheetSyncStatus={sheetSyncStatus} sheetSyncError={sheetSyncError} />

        {modal && (
          <RowModal
            modal={modal}
            agents={registeredAgencyNames.length ? registeredAgencyNames : agents}
            agentDirectory={registeredAgentsQuery.data ?? []}
            airline={airlines.find((a) => a.id === modal.airlineId)}
            priorRows={(transactions[modal.airlineId] || []).filter((r) => r.id !== modal.row.id)}
            onClose={() => setModal(null)}
            onSave={saveRow}
            onSaveOpeningBalance={saveOpeningBalance}
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
        const computed = computeLedgerRows(rows, a);
        const currentBalance = computed.length ? computed[computed.length - 1].balance : (Number(a.openingBalance) || 0);
        const isForeign = a.currency && a.currency !== "PKR";
        const currentForeignBalance = isForeign
          ? (computed.length ? computed[computed.length - 1].foreignBalance : (Number(a.openingBalanceForeign) || (Number(a.roe) ? currentBalance / Number(a.roe) : 0)))
          : null;
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
              foreignBalance={currentForeignBalance}
              isForeign={isForeign}
              currency={a.currency}
            />
          </div>
        );
      })}
      <button style={styles.addTabBtn} onClick={onAddAirline}><Plus size={16} /> Airline</button>
    </nav>
  );
}
function TabStub({ active, onClick, code, label, balance, foreignBalance, isForeign, currency }: any) {
  const displayBal = isForeign ? `${fmt(foreignBalance)} ${currency}` : fmt(balance);
  const hoverTitle = isForeign
    ? `${label} • Current Balance: ${fmt(foreignBalance)} ${currency} (PKR ${fmt(balance)})`
    : `${label} • Current Balance: ${fmt(balance)} PKR`;
  return (
    <button onClick={onClick} style={{ ...styles.tabStub, ...(active ? styles.tabStubActive : {}) }} title={hoverTitle}>
      <span style={styles.tabLogoMini}><AirlineLogoTile code={code} name={label} /></span>
      <span style={{ ...styles.tabLabel, minWidth: 0 }}>{label}</span>
      {typeof balance === "number" && (
        <span style={{ ...styles.tabBalanceMini, ...(isForeign ? { color: "var(--accent-clay, #d97757)" } : {}) }}>
          {displayBal}
        </span>
      )}
    </button>
  );
}

function LedgerTable({
  airline, rows, rawCount, search, setSearch, onAdd, onEdit, onDelete, onExportCSV, onExportExcel, onExportPDF,
}: any) {
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
          {!/other\s*service\s*providers/i.test(airline?.name) && (
          <div style={styles.openingBalanceBox}>
            <span>Opening balance</span>
            <strong style={{ fontSize: 14, color: "var(--foreground)", fontVariantNumeric: "tabular-nums" }}>
              {airline?.currency && airline.currency !== "PKR"
                ? `${fmt(airline.openingBalanceForeign ?? (Number(airline.openingBalance) / (Number(airline.roe) || 1)))} ${airline.currency} (PKR ${fmt(airline?.openingBalance ?? 0)})`
                : fmt(airline?.openingBalance ?? 0)}
            </strong>
            <span style={{ fontSize: 10, textTransform: "none", letterSpacing: 0 }}>
              {airline?.currency && airline.currency !== "PKR" ? `ROE: ${airline.roe || 1} · ` : ""}Saved date: {airline?.openingBalanceDate || "—"}
            </span>
          </div>
          )}
          <div style={styles.searchBox}>
            <Search size={14} color="var(--muted-foreground)" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search this ledger" style={styles.searchInput} />
          </div>
          <ExportMenu onExcel={onExportExcel} onSheets={onExportCSV} onPDF={onExportPDF} />
          <button style={styles.primaryBtn} onClick={onAdd}><Plus size={15} /> Add record</button>
        </div>
      </div>

remove agents panel      <div style={styles.tableWrap}>
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
            {ledgerSafePage === 1 && !/other\s*service\s*providers/i.test(airline?.name) && (
              <tr style={{ ...styles.tr, background: "rgba(217, 119, 87, 0.05)", fontWeight: 500 }}>
                <td style={{ ...styles.tdMuted, fontWeight: 700 }}>1</td>
                <td style={styles.td}>{formatDisplayDate(airline?.openingBalanceDate || new Date().toISOString().slice(0, 10))}</td>
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
                  <div>{fmt(airline?.openingBalance ?? 0)}</div>
                  {airline?.currency && airline.currency !== "PKR" && (
                    <div style={{ fontSize: 11, fontWeight: 500, color: "var(--accent-clay, #d97757)" }}>
                      {fmt(airline?.openingBalanceForeign ?? (Number(airline?.openingBalance) / (Number(airline?.roe) || 1)))} {airline.currency}
                    </div>
                  )}
                </td>
                <td style={styles.tdMuted}>-</td>
                <td style={{ ...styles.td, ...styles.numCell }}>-</td>
                <td style={{ ...styles.td, ...styles.numCell }}>-</td>
                <td style={{ ...styles.td, fontWeight: 600 }}>
                  {airline?.currency && airline.currency !== "PKR"
                    ? `OPENING BALANCE (${airline.currency} @ ROE ${airline.roe || 1})`
                    : "OPENING BALANCE"}
                </td>
                <td style={{ ...styles.td, textAlign: "right", color: "var(--muted-foreground)", fontSize: 11 }}>Starting</td>
              </tr>
            )}
            {rows.length === 0 && (
              <tr>
                <td colSpan={COLUMNS.length + 2} style={{ ...styles.emptyCell, paddingTop: 16, paddingBottom: 16 }}>
                  {/other\s*service\s*providers/i.test(airline?.name)
                    ? "No service provider ticket entries recorded yet."
                    : "No ticket sales or manual entries recorded yet. Starting balance is active above."}
                </td>
              </tr>
            )}
            {pagedRows.map((r: any, i: number) => (
              <tr key={r.id} style={styles.tr}>
                <td style={styles.tdMuted}>{i + 1}</td>
                {COLUMNS.map((c) => {
                  const isNum = c.type === "number";
                  const isBalance = c.key === "balance";
                  const isCredit = c.key === "creditFromId";
                  const isForeignAirline = airline?.currency && airline.currency !== "PKR";
                  const isServiceOnly = /other\s*service\s*providers/i.test(airline?.name);
                  const isDate = c.key === "date" || c.type === "date";

                  return (
                    <td
                      key={c.key}
                      style={isNum ? { ...styles.td, ...styles.numCell, color: c.key === "profit" && Number(r.profit) < 0 ? "var(--error)" : undefined } : styles.td}
                      className={isNum ? "num" : ""}
                    >
                      {isBalance && isServiceOnly ? (
                        <span style={{ color: "var(--foreground-muted, #78716C)" }}>-</span>
                      ) : isBalance && isForeignAirline ? (
                        <div>
                          <div>{fmt(r.balance)}</div>
                          <div style={{ fontSize: 11, fontWeight: 500, color: "var(--accent-clay, #d97757)" }}>
                            {fmt(r.foreignBalance)} {airline.currency}
                          </div>
                        </div>
                      ) : isCredit && isForeignAirline && Number(r.creditFromId) > 0 ? (
                        <div>
                          <div>{fmt(r.creditFromId)}</div>
                          <div style={{ fontSize: 10, color: "var(--muted-foreground)" }}>
                            {fmt(r.txForeignCredit)} {airline.currency} @ {r.txRoe}
                          </div>
                        </div>
                      ) : isDate ? (
                        formatDisplayDate(r[c.key])
                      ) : isNum ? (
                        fmt(r[c.key])
                      ) : (
                        r[c.key] || <span style={{ color: "var(--gray-400)" }}>-</span>
                      )}
                    </td>
                  );
                })}
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

function RowModal({ modal, agents, agentDirectory = [], airline, priorRows, onClose, onSave, onSaveOpeningBalance }: any) {
  const isForeignAirline = airline?.currency && airline.currency !== "PKR";
  const [form, setForm] = useState<any>(() => {
    const row = modal.row || {};
    const defaultRoe = Number(airline?.roe) || 1;
    const initialRoe = Number(row.roe) || defaultRoe;
    const initialForeign = row.foreignAmount !== undefined && row.foreignAmount !== null && row.foreignAmount !== ""
      ? String(row.foreignAmount)
      : (isForeignAirline && row.creditFromId ? (Number(row.creditFromId) / initialRoe).toFixed(2) : "");

    return {
      ...row,
      currency: airline?.currency || "PKR",
      roe: initialRoe,
      foreignAmount: initialForeign,
      openingBalanceForeign: airline?.openingBalanceForeign ?? (isForeignAirline && defaultRoe ? (Number(airline?.openingBalance || 0) / defaultRoe).toFixed(2) : ""),
    };
  });

  const [recordType, setRecordType] = useState<"transaction" | "openingBalance">(modal.recordType || "transaction");
  const [error, setError] = useState("");
  const [savingOpeningBalance, setSavingOpeningBalance] = useState(false);
  const [agentSearch, setAgentSearch] = useState(modal.row.agentName || "");

  const update = (key: string, val: any) => setForm((f: any) => ({ ...f, [key]: val }));
  const selectAgent = (value: string) => {
    setAgentSearch(value);
    update("agentName", value);
    if (value.trim().toLowerCase() === "abdul razzaq") { update("paxContact", ""); return; }
    const match = (agentDirectory ?? []).find((agent: any) => String(agent.agency_name ?? "").trim().toLowerCase() === value.trim().toLowerCase());
    if (match) update("paxContact", String(match.cell_number ?? "").trim());
  };

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
    const finalCredit = Number(form.creditFromId) || 0;
    const activeRoe = Number(form.roe || airline?.roe) || 1;
    const foreignCredit = form.foreignAmount !== undefined && form.foreignAmount !== null && form.foreignAmount !== ""
      ? Number(form.foreignAmount)
      : (isForeignAirline ? (finalCredit / activeRoe) : null);

    onSave(modal.airlineId, {
      ...form,
      creditFromId: finalCredit,
      currency: airline?.currency || "PKR",
      roe: isForeignAirline ? activeRoe : 1,
      foreignAmount: isForeignAirline ? foreignCredit : null,
    });
  };

  const handleOpeningBalanceSave = async () => {
    const date = String(form.openingBalanceDate || "").trim();
    const amount = Number(form.openingBalance);
    const foreignAmount = isForeignAirline && form.openingBalanceForeign !== "" ? Number(form.openingBalanceForeign) : null;

    if (!date) {
      setError("Opening balance date is required.");
      return;
    }
    if (!Number.isFinite(amount)) {
      setError("Enter a valid opening balance amount.");
      return;
    }

    setError("");
    setSavingOpeningBalance(true);
    try {
      const saved = await onSaveOpeningBalance(modal.airlineId, date, amount, foreignAmount);
      if (saved) onClose();
    } finally {
      setSavingOpeningBalance(false);
    }
  };

  const editableCols = COLUMNS.filter((c) => !c.computed && c.key !== "transactionType");

  return (
    <Overlay onClose={onClose}>
      <div style={styles.modal}>
        <div style={styles.modalHeader}>
          <div>
            <h3 style={styles.modalTitle}>Add Record</h3>
            <div style={{ marginTop: 4, fontSize: 12, color: "var(--muted-foreground)" }}>
              {airline?.name} · {recordType === "openingBalance" ? "Opening Balance" : modal.mode === "add" ? "Transaction" : "Edit Transaction"}
            </div>
          </div>
          <button style={styles.iconBtn} onClick={onClose} disabled={savingOpeningBalance}><X size={18} /></button>
        </div>

        {modal.mode === "add" && !/other\s*service\s*providers/i.test(airline?.name) && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
            <button
              type="button"
              style={{ ...styles.recordTypeBtn, ...(recordType === "transaction" ? styles.recordTypeBtnActive : {}) }}
              onClick={() => { setRecordType("transaction"); setError(""); }}
              disabled={savingOpeningBalance}
            >
              Transaction
            </button>
            <button
              type="button"
              style={{ ...styles.recordTypeBtn, ...(recordType === "openingBalance" ? styles.recordTypeBtnActive : {}) }}
              onClick={() => {
                setRecordType("openingBalance");
                setError("");
                setForm((f: any) => ({
                  ...f,
                  openingBalanceDate: airline?.openingBalanceDate ?? new Date().toISOString().slice(0, 10),
                  openingBalance: Number(airline?.openingBalance ?? 0),
                  openingBalanceForeign: airline?.openingBalanceForeign ?? (isForeignAirline && airline?.roe ? (Number(airline?.openingBalance || 0) / Number(airline?.roe)).toFixed(2) : ""),
                }));
              }}
              disabled={savingOpeningBalance}
            >
              Opening Balance
            </button>
          </div>
        )}

        {recordType === "openingBalance" ? (
          <div>
            <div style={{ background: "var(--warning-soft)", border: "1px solid var(--border)", borderRadius: 10, padding: "11px 13px", marginBottom: 14, fontSize: 12.5, lineHeight: 1.5, color: "var(--foreground)" }}>
              This saves the official opening balance for <strong>{airline?.name}</strong>. It is stored with the account and shown as the first ledger record. Saving here is explicit and does not depend on autosave timing.
            </div>
            <div style={styles.modalGrid}>
              <div style={styles.field}>
                <label style={styles.label}>Opening balance date</label>
                <input type="date" value={form.openingBalanceDate ?? new Date().toISOString().slice(0, 10)} onChange={(e) => update("openingBalanceDate", e.target.value)} style={styles.input} disabled={savingOpeningBalance} />
              </div>
              {isForeignAirline ? (
                <>
                  <div style={styles.field}>
                    <label style={styles.label}>Opening balance ({airline.currency})</label>
                    <input
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      value={form.openingBalanceForeign ?? ""}
                      placeholder={`e.g. ${airline.currency === "AED" ? "215.77" : airline.currency === "SAR" ? "3775.52" : "120.67"}`}
                      onChange={(e) => {
                        const foreignVal = e.target.value;
                        const num = Number(foreignVal);
                        const roe = Number(airline.roe) || 1;
                        update("openingBalanceForeign", foreignVal);
                        update("openingBalance", foreignVal !== "" && Number.isFinite(num) ? Math.round(num * roe) : "");
                      }}
                      style={styles.input}
                      disabled={savingOpeningBalance}
                      autoFocus
                    />
                  </div>
                  <div style={styles.field}>
                    <label style={styles.label}>Opening balance (PKR - Converted at ROE {airline.roe})</label>
                    <input
                      type="number"
                      inputMode="decimal"
                      step="1"
                      value={form.openingBalance ?? ""}
                      onChange={(e) => update("openingBalance", e.target.value)}
                      style={styles.input}
                      disabled={savingOpeningBalance}
                    />
                  </div>
                </>
              ) : (
                <div style={styles.field}>
                  <label style={styles.label}>Opening balance amount (PKR)</label>
                  <input type="number" inputMode="decimal" step="0.01" value={form.openingBalance ?? ""} onChange={(e) => update("openingBalance", e.target.value)} style={styles.input} disabled={savingOpeningBalance} autoFocus />
                </div>
              )}
            </div>
            <div style={styles.previewBox}>
              <div style={styles.previewItem}><span style={styles.previewLabel}>Current saved</span><span style={styles.previewValue}>{fmt(airline?.openingBalance ?? 0)} PKR</span></div>
              <div style={styles.previewItem}>
                <span style={styles.previewLabel}>New balance</span>
                <span style={styles.previewValue}>
                  {fmt(Number(form.openingBalance) || 0)} PKR
                  {isForeignAirline && form.openingBalanceForeign && (
                    <span style={{ fontSize: 11, fontWeight: 500, color: "var(--accent-clay, #d97757)", marginLeft: 6 }}>
                      ({fmt(Number(form.openingBalanceForeign))} {airline.currency})
                    </span>
                  )}
                </span>
              </div>
              <div style={styles.previewItem}><span style={styles.previewLabel}>Effective date</span><span style={styles.previewValue}>{form.openingBalanceDate || "—"}</span></div>
            </div>
            {error && <div style={styles.errorNote}><AlertCircle size={15} /> {error}</div>}
            <div style={styles.modalFooter}>
              <button style={styles.ghostBtn} onClick={onClose} disabled={savingOpeningBalance}>Cancel</button>
              <button style={styles.primaryBtn} onClick={handleOpeningBalanceSave} disabled={savingOpeningBalance}>
                {savingOpeningBalance ? <LoaderCircle size={15} className="animate-spin" /> : <Save size={15} />}
                {savingOpeningBalance ? "Saving opening balance…" : "Save Opening Balance"}
              </button>
            </div>
          </div>
        ) : (
        <>
        {isForeignAirline && (
          <div style={{
            background: "rgba(217, 119, 87, 0.08)",
            border: "1px solid var(--accent-clay, #d97757)",
            borderRadius: 8,
            padding: "11px 14px",
            marginBottom: 16,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "var(--accent-clay, #d97757)" }}>
                Foreign Currency ROE Helper ({airline.currency} @ ROE {form.roe ?? airline.roe ?? 1})
              </span>
              <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
                Locked on this entry permanently
              </span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
              <div style={styles.field}>
                <label style={{ ...styles.label, fontSize: 11 }}>Amount in {airline.currency}</label>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  placeholder={`e.g. ${airline.currency === "SAR" ? "850.50" : "100.00"}`}
                  value={form.foreignAmount ?? ""}
                  onChange={(e) => {
                    const fVal = e.target.value;
                    const num = Number(fVal);
                    const roe = Number(form.roe || airline.roe || 1);
                    update("foreignAmount", fVal);
                    if (fVal !== "" && Number.isFinite(num)) {
                      update("creditFromId", Math.round(num * roe));
                    }
                  }}
                  style={{ ...styles.input, padding: "6px 8px" }}
                />
              </div>
              <div style={styles.field}>
                <label style={{ ...styles.label, fontSize: 11 }}>ROE applied</label>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  value={form.roe ?? airline.roe ?? 1}
                  onChange={(e) => {
                    const roeVal = e.target.value;
                    const numRoe = Number(roeVal);
                    update("roe", roeVal);
                    if (form.foreignAmount && Number.isFinite(Number(form.foreignAmount)) && numRoe > 0) {
                      update("creditFromId", Math.round(Number(form.foreignAmount) * numRoe));
                    }
                  }}
                  style={{ ...styles.input, padding: "6px 8px" }}
                />
              </div>
              <div style={styles.field}>
                <label style={{ ...styles.label, fontSize: 11 }}>Credit in PKR</label>
                <div style={{
                  padding: "7px 10px",
                  borderRadius: 6,
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  fontSize: 13,
                  fontWeight: 700,
                  color: "var(--foreground)",
                }}>
                  {fmt(Number(form.creditFromId) || 0)} PKR
                </div>
              </div>
            </div>
          </div>
        )}

        <div style={{ marginBottom: 14 }}>
          <label style={{ ...styles.label, display: "block", marginBottom: 7 }}>Transaction Type</label>
          <div style={{ ...styles.radioGroup, gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 6 }}>
            {["Add Transaction", "Top Up", "Cancel/Refund", "Exchange"].map((type) => (
              <label key={type} style={{ ...styles.radioOption, justifyContent: "center", border: (form.transactionType || "Add Transaction") === type ? "1px solid var(--accent-ink)" : "1px solid var(--border)", borderRadius: 8, padding: "7px 6px", background: (form.transactionType || "Add Transaction") === type ? "rgba(217, 119, 87, 0.10)" : "var(--card)", fontWeight: (form.transactionType || "Add Transaction") === type ? 700 : 500, cursor: "pointer", whiteSpace: "nowrap" }}>
                <input type="radio" name="transactionType" value={type} checked={(form.transactionType || "Add Transaction") === type} onChange={() => update("transactionType", type)} />
                <span>{type}</span>
              </label>
            ))}
          </div>
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
                    onChange={(e) => selectAgent(e.target.value)}
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
                  onChange={(e) => {
                    const val = e.target.value;
                    update(c.key, val);
                    if (c.key === "creditFromId" && isForeignAirline) {
                      const num = Number(val);
                      const roe = Number(form.roe || airline.roe || 1);
                      if (val !== "" && Number.isFinite(num) && roe > 0) {
                        update("foreignAmount", (num / roe).toFixed(2));
                      }
                    }
                  }}
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
          <button style={styles.primaryBtn} onClick={handleSave}><Save size={15} /> {modal.mode === "add" ? "Save Record" : "Save Changes"}</button>
        </div>
        </>
        )}
      </div>
    </Overlay>
  );
}

function Dashboard({
  airlines, perAirlineSummary, grandTotals, monthlySummary, yearlySummary,
  dashboardScope, setDashboardScope, onExportAllCSV, onExportAllExcel, onExportAllPDF,
  syncError, sheetSyncStatus, sheetSyncError,
  onEditAirline, onRemoveAirline, saving, onUpdateRoe,
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
        <AdminStatCard icon={Wallet} label="Combined balance (PKR)" value={fmt(grandTotals.totalBalance)} tone="navy" />
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
            <button
              key={a.id}
              type="button"
              style={styles.balanceCard}
              onClick={() => onEditAirline(a.id)}
              title={`Open ${a.name} ledger`}
            >
              {/* Card Box: contains official logo, divider, and all balance data */}
              <div style={styles.balanceCardBox}>
                <div style={styles.balanceLogoSection}>
                  <AirlineLogo name={a.name} height={46} className="max-h-12 max-w-full object-contain" />
                </div>
                <div style={styles.balanceDivider} />
                {/other\s*service\s*providers/i.test(a.name) ? (
                  <div style={styles.balanceDataSection}>
                    <div style={styles.balanceCardBalanceLabel}>Statement &amp; Tickets</div>
                    <div style={{ ...styles.balanceCardValueBig, fontSize: 13, color: "var(--foreground-muted, #78716C)" }} className="num">
                      {a.count || 0} {(a.count === 1) ? "Ticket Entry" : "Ticket Entries"}
                    </div>
                    <div style={styles.balanceCardValueSub}>
                      All tickets record
                    </div>
                  </div>
                ) : (
                  <div style={styles.balanceDataSection}>
                    <div style={styles.balanceCardBalanceLabel}>Current Balance</div>
                    {a.isForeign ? (
                      <>
                        <div style={styles.balanceCardValueBig} className="num">
                          {fmt(a.currentForeignBalance)} <span style={styles.balanceCardCurrUnit}>{a.currency}</span>
                        </div>
                        <div style={styles.balanceCardValueSub} className="num">
                          (PKR {fmt(a.currentBalance)})
                        </div>
                      </>
                    ) : (
                      <div style={styles.balanceCardValueBig} className="num">
                        {fmt(a.currentBalance)} <span style={styles.balanceCardCurrUnit}>PKR</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
              {/* Only airline below this card */}
              <div style={styles.balanceAirlineNameBelow}>
                <span style={{ fontWeight: 700 }}>{a.name}</span>
              </div>
            </button>
          ))}
        </div>
      </section>

      {perAirlineSummary.some((a: any) => a.isForeign) && (
        <section style={{ ...styles.section, background: "rgba(217, 119, 87, 0.04)", border: "1px solid var(--accent-clay, #d97757)", borderRadius: 12, padding: "16px 20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
            <div>
              <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "var(--foreground)" }}>
                Foreign Currency ROE Helper &amp; Defaults
              </h4>
              <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 2 }}>
                Current rate of exchange used as default for future transactions. Historical transactions retain their locked ROE.
              </div>
            </div>
            <span style={{ fontSize: 11, padding: "3px 8px", borderRadius: 4, background: "var(--card)", border: "1px solid var(--border)", color: "var(--accent-clay, #d97757)", fontWeight: 600 }}>
              Future Transactions Only
            </span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
            {perAirlineSummary.filter((a: any) => a.isForeign).map((a: any) => (
              <RoeEditor key={a.id} airline={a} onUpdateRoe={onUpdateRoe} />
            ))}
          </div>
        </section>
      )}

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
                  <td style={styles.td}>
                    {a.name}
                    {a.isForeign && (
                      <span style={{ marginLeft: 6, fontSize: 10, padding: "1px 5px", borderRadius: 3, background: "rgba(217, 119, 87, 0.12)", color: "var(--accent-clay, #d97757)", fontWeight: 700 }}>
                        {a.currency}
                      </span>
                    )}
                  </td>
                  <td style={styles.tdMuted}>{a.code}</td>
                  <td style={{ ...styles.td, ...styles.numCell }} className="num">{a.count}</td>
                  <td style={{ ...styles.td, ...styles.numCell }} className="num">{fmt(a.totalSales)}</td>
                  <td style={{ ...styles.td, ...styles.numCell }} className="num">{fmt(a.totalVoid)}</td>
                  <td style={{ ...styles.td, ...styles.numCell, color: a.totalProfit >= 0 ? "var(--success)" : "var(--error)" }} className="num">{fmt(a.totalProfit)}</td>
                  <td style={{ ...styles.td, ...styles.numCell, fontWeight: 600 }} className="num">
                    <div>{fmt(a.currentBalance)} PKR</div>
                    {a.isForeign && (
                      <div style={{ fontSize: 11, fontWeight: 500, color: "var(--accent-clay, #d97757)" }}>
                        {fmt(a.currentForeignBalance)} {a.currency}
                      </div>
                    )}
                  </td>
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

function RoeEditor({ airline, onUpdateRoe }: any) {
  const [roeVal, setRoeVal] = useState(String(airline.roe || 1));
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setRoeVal(String(airline.roe || 1));
    setDirty(false);
  }, [airline.roe]);

  const handleSave = () => {
    const num = Number(roeVal);
    if (Number.isFinite(num) && num > 0) {
      onUpdateRoe(airline.id, num);
      setDirty(false);
    }
  };

  return (
    <div style={{ padding: "10px 14px", borderRadius: 8, background: "var(--card)", border: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <strong style={{ fontSize: 13, color: "var(--foreground)" }}>{airline.name}</strong>
        <span style={{ fontSize: 11, fontWeight: 700, color: "var(--accent-clay, #d97757)" }}>{airline.currency}</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>ROE:</span>
        <input
          type="number"
          step="0.01"
          value={roeVal}
          onChange={(e) => {
            setRoeVal(e.target.value);
            setDirty(true);
          }}
          onKeyDown={(e) => { if (e.key === "Enter") handleSave(); }}
          style={{ ...styles.input, width: 80, padding: "4px 6px", fontSize: 12, textAlign: "right" }}
        />
        <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>PKR</span>
        {dirty && (
          <button style={{ ...styles.primaryBtn, padding: "4px 8px", fontSize: 11 }} onClick={handleSave}>
            Save
          </button>
        )}
      </div>
    </div>
  );
}

function AddAirlineModal({ value, setValue, onClose, onSave }: any) {
  const [mode, setMode] = useState<"pkr" | "foreign">(value.currency && value.currency !== "PKR" ? "foreign" : "pkr");

  return (
    <Overlay onClose={onClose}>
      <div style={{ ...styles.modal, maxWidth: 420 }}>
        <div style={styles.modalHeader}>
          <h3 style={styles.modalTitle}>Add Airline Account</h3>
          <button style={styles.iconBtn} onClick={onClose}><X size={18} /></button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={styles.field}>
            <label style={styles.label}>Airline name</label>
            <input style={styles.input} placeholder="e.g. Flydubai" value={value.name} onChange={(e) => setValue((v: any) => ({ ...v, name: e.target.value }))} autoFocus />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>IATA code (optional)</label>
            <input style={styles.input} placeholder="e.g. FZ" maxLength={3} value={value.code} onChange={(e) => setValue((v: any) => ({ ...v, code: e.target.value }))} />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Account Currency</label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 4 }}>
              <button
                type="button"
                style={{ ...styles.recordTypeBtn, ...(mode === "pkr" ? styles.recordTypeBtnActive : {}) }}
                onClick={() => {
                  setMode("pkr");
                  setValue((v: any) => ({ ...v, currency: "PKR", roe: 1, openingBalanceForeign: "" }));
                }}
              >
                PKR (Standard)
              </button>
              <button
                type="button"
                style={{ ...styles.recordTypeBtn, ...(mode === "foreign" ? styles.recordTypeBtnActive : {}) }}
                onClick={() => {
                  setMode("foreign");
                  setValue((v: any) => ({ ...v, currency: v.currency && v.currency !== "PKR" ? v.currency : "SAR", roe: v.roe > 1 ? v.roe : 75.50 }));
                }}
              >
                Foreign Currency
              </button>
            </div>
          </div>

          {mode === "foreign" && (
            <div style={{ background: "rgba(217, 119, 87, 0.06)", border: "1px solid var(--accent-clay, #d97757)", borderRadius: 8, padding: "12px", display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={styles.field}>
                <label style={{ ...styles.label, fontSize: 11 }}>Select Foreign Currency</label>
                <div style={{ display: "flex", gap: 6 }}>
                  {["AED", "SAR", "USD", "OTHER"].map((curr) => (
                    <button
                      key={curr}
                      type="button"
                      style={{
                        padding: "5px 10px",
                        borderRadius: 6,
                        border: (value.currency || "SAR") === curr ? "1.5px solid var(--accent-clay, #d97757)" : "1px solid var(--border)",
                        background: (value.currency || "SAR") === curr ? "var(--accent-clay, #d97757)" : "var(--card)",
                        color: (value.currency || "SAR") === curr ? "#fff" : "var(--foreground)",
                        fontWeight: 600,
                        fontSize: 12,
                        cursor: "pointer",
                      }}
                      onClick={() => {
                        const defaultRoe = curr === "AED" ? 77.30 : curr === "SAR" ? 75.50 : curr === "USD" ? 284 : 1;
                        setValue((v: any) => ({ ...v, currency: curr, roe: defaultRoe }));
                      }}
                    >
                      {curr}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div style={styles.field}>
                  <label style={{ ...styles.label, fontSize: 11 }}>Active ROE (PKR / {value.currency || "SAR"})</label>
                  <input
                    type="number"
                    step="0.01"
                    value={value.roe ?? 1}
                    onChange={(e) => setValue((v: any) => ({ ...v, roe: Number(e.target.value) || 1 }))}
                    style={{ ...styles.input, padding: "6px 8px" }}
                  />
                </div>
                <div style={styles.field}>
                  <label style={{ ...styles.label, fontSize: 11 }}>Starting Balance ({value.currency || "SAR"})</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={value.openingBalanceForeign ?? ""}
                    onChange={(e) => {
                      const fVal = e.target.value;
                      const roe = Number(value.roe) || 1;
                      setValue((v: any) => ({
                        ...v,
                        openingBalanceForeign: fVal,
                        openingBalance: fVal ? Math.round(Number(fVal) * roe) : 0,
                      }));
                    }}
                    style={{ ...styles.input, padding: "6px 8px" }}
                  />
                </div>
              </div>
            </div>
          )}
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
  openingBalanceBox: { display: "flex", flexDirection: "column", gap: 3, fontSize: 11, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.03em", minWidth: 130 },
  recordTypeBtn: { display: "flex", alignItems: "center", justifyContent: "center", minHeight: 40, padding: "9px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--card)", color: "var(--foreground)", fontSize: 13, fontWeight: 700, cursor: "pointer" },
  recordTypeBtnActive: { borderColor: "var(--accent-ink)", background: "var(--accent-soft, var(--warning-soft))", color: "var(--foreground)" },
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
  balanceCardGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 16, marginTop: 12 },
  balanceCard: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    minWidth: 0,
    textAlign: "center",
    background: "transparent",
    border: "none",
    padding: 0,
    cursor: "pointer",
    color: "var(--foreground, #1C1917)",
    transition: "transform .18s ease, filter .18s ease",
  },
  balanceCardBox: {
    width: "100%",
    background: "#FFFFFF",
    border: "1px solid var(--border, #E7E5E4)",
    borderRadius: 14,
    padding: "16px 14px 18px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    boxShadow: "0 1px 4px rgba(0,0,0,0.05), 0 1px 2px rgba(0,0,0,0.02)",
    boxSizing: "border-box" as const,
    transition: "border-color .18s ease, box-shadow .18s ease",
  },
  balanceLogoSection: {
    width: "100%",
    height: 52,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "2px 6px",
    boxSizing: "border-box" as const,
  },
  balanceDivider: {
    width: "100%",
    height: 1,
    background: "var(--border, #E7E5E4)",
    margin: "12px 0 10px",
  },
  balanceDataSection: {
    width: "100%",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 2,
  },
  balanceCardBalanceLabel: {
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase" as const,
    color: "var(--muted-foreground, #78716C)",
  },
  balanceCardValueBig: {
    marginTop: 4,
    fontSize: 20,
    fontWeight: 800,
    color: "var(--foreground, #141413)",
    fontVariantNumeric: "tabular-nums",
    lineHeight: 1.2,
  },
  balanceCardCurrUnit: {
    fontSize: 13,
    fontWeight: 700,
    color: "var(--accent-clay, #D97757)",
    marginLeft: 3,
  },
  balanceCardValueSub: {
    marginTop: 3,
    fontSize: 12,
    fontWeight: 600,
    color: "var(--muted-foreground, #78716C)",
    fontVariantNumeric: "tabular-nums",
  },
  balanceAirlineNameBelow: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: 700,
    color: "var(--foreground, #1C1917)",
    textAlign: "center" as const,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap" as const,
    maxWidth: "100%",
    padding: "0 4px",
  },
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
