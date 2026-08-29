import React, { useState, useEffect, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import {
  Plane, Plus, Pencil, Trash2, Download, X, LayoutDashboard,
  TrendingUp, TrendingDown, Wallet, Search, Building2,
  AlertCircle, FileSpreadsheet, Users, Save,
} from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend,
} from "recharts";
import { AdminTabs } from "@/components/AdminTabs";
import { checkAdminUnlocked } from "@/lib/fares.functions";
import { getAirlineLedgerData, saveAirlineLedgerData } from "@/lib/airline-ledger.functions";
import { listAgentsAdmin } from "@/lib/agent-admin.functions";

export const Route = createFileRoute("/admin/airline-ledger")({
  component: AirlineLedgerRoute,
});

/* ---------- constants ---------- */

const DEFAULT_AIRLINES: any[] = [
  { id: "pia", name: "PIA", code: "PK", openingBalance: 0 },
  { id: "air-blue", name: "Air Blue", code: "PA", openingBalance: 0 },
  { id: "flydubai", name: "flydubai", code: "FZ", openingBalance: 0 },
  { id: "salamair", name: "SalamAir", code: "OV", openingBalance: 0 },
  { id: "air-arabia", name: "Air Arabia", code: "G9", openingBalance: 0 },
  { id: "flyjinnah", name: "FlyJinnah", code: "9P", openingBalance: 0 },
  { id: "jazeera", name: "Jazeera", code: "J9", openingBalance: 0 },
  { id: "flynas", name: "flynas", code: "XY", openingBalance: 0 },
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

function airlineBadgeColor(code: string) {
  const colors: Record<string, string> = {
    PK: "#2D7A52", PA: "#1D6FA5", FZ: "#E46B2E", OV: "#D84B43",
    G9: "#C7447A", "9P": "#315A9A", J9: "#3B6E9E", XY: "#159A9C",
  };
  return colors[code] || "#8A6A2F";
}

function AirlineLedgerRoute() {
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
    <div className="min-h-screen bg-[#F7F5EF]">
      <header className="bg-navy text-white border-b border-gold/20">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <Wallet className="h-5 w-5 text-gold" />
            <p className="font-serif text-lg font-black text-gold">Airline Ledger</p>
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

  const [airlines, setAirlines] = useState<any[]>(DEFAULT_AIRLINES);
  const [agents, setAgents] = useState<string[]>(DEFAULT_AGENTS);
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
  const [newAgent, setNewAgent] = useState("");
  const registeredAgentsQuery = useQuery({
    queryKey: ["admin-agents-for-ledger"],
    queryFn: () => loadRegisteredAgents(),
    refetchInterval: 30000,
  });
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
        if (data) {
          // Existing saved data — never overwrite it with sample defaults.
          setAirlines(data.airlines?.length ? data.airlines : []);
          setAgents(data.agents?.length ? data.agents : []);
          setTransactions(data.transactions || {});
        } else {
          // Genuine first-time/empty database state only.
          setAirlines(DEFAULT_AIRLINES);
          setAgents(DEFAULT_AGENTS);
          setTransactions({});
        }
        setLoaded(true);
      } catch (e) {
        // Load failed: keep autosave disabled so nothing can overwrite real data.
        console.error("Airline ledger load failed", e);
      }
    })();
  }, []);

  useEffect(() => {
    if (!loaded) return;
    setSavedFlash(true);
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        await save({ data: { airlines, agents, transactions } as any });
      } catch (e) {
        console.error("Airline ledger save failed", e);
      }
      if (!cancelled) setSavedFlash(false);
    }, 500);
    return () => { cancelled = true; clearTimeout(t); };
  }, [airlines, agents, transactions, loaded]);

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

  const addAirline = () => {
    if (!newAirline.name.trim()) return;
    const id = uid();
    setAirlines((prev) => [...prev, {
      id, name: newAirline.name.trim(),
      code: newAirline.code.trim().toUpperCase() || "--",
      openingBalance: 0,
    }]);
    setNewAirline({ name: "", code: "" });
    setAddAirlineOpen(false);
    setActiveTab(id);
  };

  const removeAirline = (id: string) => {
    setAirlines((prev) => prev.filter((a) => a.id !== id));
    setTransactions((prev) => { const next = { ...prev }; delete next[id]; return next; });
    if (activeTab === id) setActiveTab("dashboard");
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

  const exportAllCSV = () => {
    const headers = ["Airline", "Sr #", ...COLUMNS.map((c) => c.label)];
    const lines = [headers.join(",")];
    airlines.forEach((a) => {
      computeLedgerRows(transactions[a.id] || [], a).forEach((r, i) => {
        const vals = [a.name, i + 1, ...COLUMNS.map((c) => {
          const v = r[c.key] ?? "";
          const s = String(v).replace(/"/g, '""');
          return /[",\n]/.test(s) ? `"${s}"` : s;
        })];
        lines.push(vals.join(","));
      });
    });
    downloadCSV("rohi-international-travels-full-ledger.csv", lines.join("\n"));
  };

  return (
    <div style={styles.app}>
      <style>{`
        .airline-ledger * { box-sizing: border-box; }
        .airline-ledger input, .airline-ledger select { font-family: inherit; }
        .airline-ledger input:focus, .airline-ledger select:focus { outline: 2px solid #C89B3C; outline-offset: -1px; }
        .airline-ledger table { border-collapse: collapse; width: 100%; }
        .airline-ledger ::placeholder { color: #9AA0A8; }
        .airline-ledger .num { font-variant-numeric: tabular-nums; font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace; }
        .airline-ledger .cell-input { width: 100%; border: 1px solid transparent; background: transparent; padding: 6px 7px; border-radius: 6px; font-size: 12.5px; }
        .airline-ledger .cell-input:hover { border-color: #E7E4DB; }
        .airline-ledger .cell-input:focus { border-color: #C89B3C; background: #fff; }
      `}</style>

      <div className="airline-ledger">
        <Header savedFlash={savedFlash} />

        <div style={styles.body}>
          <TabStrip airlines={airlines} activeTab={activeTab} setActiveTab={setActiveTab} onAddAirline={() => setAddAirlineOpen(true)} />

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
                onExportAll={exportAllCSV}
                onEditAirline={setActiveTab}
                onRemoveAirline={removeAirline}
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
                onExport={() => downloadCSV(`${activeAirline?.code || "airline"}-ledger.csv`, rowsToCSV(filteredRows))}
                onOpeningBalance={(v: number) => updateOpeningBalance(activeTab, v)}
              />
            )}
          </main>
        </div>

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

function Header({ savedFlash }: any) {
  return (
    <header style={styles.header}>
      <div style={styles.headerLeft}>
        <div style={styles.logoBadge}><Plane size={20} color="#0F1B2D" /></div>
        <div>
          <div style={styles.title}>ROHI INTERNATIONAL TRAVELS</div>
          <div style={styles.subtitle}>Airline account ledgers &amp; balance dashboard</div>
        </div>
      </div>
      <div style={styles.savedTag}>
        <span style={{ ...styles.savedDot, opacity: savedFlash ? 1 : 0.35 }} />
        {savedFlash ? "Saving…" : "Saved"}
      </div>
    </header>
  );
}

function TabStrip({ airlines, activeTab, setActiveTab, onAddAirline }: any) {
  return (
    <nav style={styles.tabStrip}>
      <TabStub active={activeTab === "dashboard"} onClick={() => setActiveTab("dashboard")} code={<LayoutDashboard size={15} />} label="Dashboard" />
      <div style={styles.tabDivider} />
      {airlines.map((a: any) => (
        <TabStub key={a.id} active={activeTab === a.id} onClick={() => setActiveTab(a.id)} code={a.code} label={a.name} />
      ))}
      <button style={styles.addTabBtn} onClick={onAddAirline}><Plus size={16} /> Airline</button>
    </nav>
  );
}
function TabStub({ active, onClick, code, label }: any) {
  return (
    <button onClick={onClick} style={{ ...styles.tabStub, ...(active ? styles.tabStubActive : {}) }} title={label}>
      <span style={{ ...styles.tabCode, ...(active ? styles.tabCodeActive : {}) }}>{code}</span>
      <span style={styles.tabLabel}>{label}</span>
    </button>
  );
}

function LedgerTable({
  airline, rows, rawCount, search, setSearch, agents, newAgent, setNewAgent,
  onAddAgent, onRemoveAgent, onAdd, onEdit, onDelete, onExport, onOpeningBalance,
}: any) {
  const [agentsOpen, setAgentsOpen] = useState(false);

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
              type="number"
              className="cell-input num"
              style={{ width: 100, border: "1px solid #D8D5CB", background: "#fff" }}
              value={airline?.openingBalance ?? 0}
              onChange={(e) => onOpeningBalance(e.target.value === "" ? 0 : Number(e.target.value))}
            />
          </label>
          <div style={styles.searchBox}>
            <Search size={14} color="#767B84" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search this ledger" style={styles.searchInput} />
          </div>
          <button style={styles.ghostBtn} onClick={() => setAgentsOpen((v) => !v)}><Users size={15} /> Agents</button>
          <button style={styles.ghostBtn} onClick={onExport}><Download size={15} /> Export CSV</button>
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
            {rows.length === 0 && (
              <tr>
                <td colSpan={COLUMNS.length + 2} style={styles.emptyCell}>
                  No transactions yet. Click "Add record" to open the form for {airline?.name}.
                </td>
              </tr>
            )}
            {rows.map((r: any, i: number) => (
              <tr key={r.id} style={styles.tr}>
                <td style={styles.tdMuted}>{i + 1}</td>
                {COLUMNS.map((c) => (
                  <td
                    key={c.key}
                    style={c.type === "number" ? { ...styles.td, ...styles.numCell, color: c.key === "profit" && Number(r.profit) < 0 ? "#B23A2E" : undefined } : styles.td}
                    className={c.type === "number" ? "num" : ""}
                  >
                    {c.type === "number" ? fmt(r[c.key]) : (r[c.key] || <span style={{ color: "#B7BBC1" }}>-</span>)}
                  </td>
                ))}
                <td style={{ ...styles.td, textAlign: "right", whiteSpace: "nowrap" }}>
                  <button style={styles.iconBtn} onClick={() => onEdit(r)} title="Edit"><Pencil size={14} /></button>
                  <button style={{ ...styles.iconBtn, color: "#B23A2E" }} onClick={() => onDelete(r.id)} title="Delete"><Trash2 size={14} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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
          <div style={styles.previewItem}><span style={styles.previewLabel}>Profit <em>(auto)</em></span><span className="num" style={{ ...styles.previewValue, color: preview.profit < 0 ? "#B23A2E" : "#1F7A52" }}>{fmt(preview.profit)}</span></div>
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
  dashboardScope, setDashboardScope, onExportAll, onEditAirline, onRemoveAirline,
}: any) {
  const [removeConfirm, setRemoveConfirm] = useState<any>(null);

  return (
    <div>
      <div style={styles.panelHeader}>
        <div>
          <h2 style={styles.panelTitle}>Airline balance dashboard</h2>
          <div style={styles.panelMeta}>Multi-airline account overview for ROHI INTERNATIONAL TRAVELS</div>
        </div>
        <div style={styles.panelActions}>
          <button style={styles.ghostBtn} onClick={onExportAll}><Download size={15} /> Export all (CSV)</button>
        </div>
      </div>

      <div style={styles.metricGrid}>
        <MetricCard icon={<Wallet size={16} />} label="Combined balance" value={fmt(grandTotals.totalBalance)} tone="navy" />
        <MetricCard icon={<TrendingUp size={16} />} label="Total profit" value={fmt(grandTotals.totalProfit)} tone={grandTotals.totalProfit >= 0 ? "good" : "bad"} />
        <MetricCard icon={<TrendingDown size={16} />} label="Total ticket sales" value={fmt(grandTotals.totalSales)} tone="gold" />
        <MetricCard icon={<Building2 size={16} />} label="Airlines tracked" value={airlines.length} tone="navy" />
      </div>

      <section style={styles.balanceCardsSection}>
        <div style={styles.sectionHeaderRow}>
          <div>
            <h3 style={styles.sectionTitle}>Current balance by airline</h3>
            <div style={styles.panelMeta}>Select an airline to open its ledger</div>
          </div>
        </div>
        <div style={styles.balanceCardGrid}>
          {perAirlineSummary.map((a: any) => {
            const badgeColor = airlineBadgeColor(a.code);
            return (
              <button key={a.id} type="button" style={styles.balanceCard} onClick={() => onEditAirline(a.id)} title={`Open ${a.name} ledger`}>
                <span style={{ ...styles.airlineBadge, background: badgeColor }}>{a.code}</span>
                <span style={styles.balanceCardName}>{a.name}</span>
                <span style={styles.balanceCardLabel}>Current balance</span>
                <strong style={styles.balanceCardValue} className="num">{fmt(a.currentBalance)}</strong>
              </button>
            );
          })}
        </div>
      </section>

      <section style={styles.section}>
        <h3 style={styles.sectionTitle}>Account balances by airline</h3>
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
                  <td style={{ ...styles.td, ...styles.numCell, color: a.totalProfit >= 0 ? "#1F7A52" : "#B23A2E" }} className="num">{fmt(a.totalProfit)}</td>
                  <td style={{ ...styles.td, ...styles.numCell, fontWeight: 600 }} className="num">{fmt(a.currentBalance)}</td>
                  <td style={{ ...styles.td, textAlign: "right", whiteSpace: "nowrap" }}>
                    <button style={styles.ghostBtnSm} onClick={() => onEditAirline(a.id)}>Open ledger</button>
                    <button style={{ ...styles.iconBtn, color: "#B23A2E" }} onClick={() => setRemoveConfirm(a)} title="Remove airline"><Trash2 size={14} /></button>
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
                <CartesianGrid strokeDasharray="3 3" stroke="#E7E4DB" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#767B84" }} axisLine={{ stroke: "#D8D5CB" }} />
                <YAxis tick={{ fontSize: 12, fill: "#767B84" }} axisLine={{ stroke: "#D8D5CB" }} />
                <Tooltip formatter={(v: any) => fmt(v)} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="profit" name="Profit" fill="#1F7A52" radius={[3, 3, 0, 0]} />
                <Bar dataKey="voidCharges" name="VOID charges" fill="#B23A2E" radius={[3, 3, 0, 0]} />
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
                    <td style={{ ...styles.td, ...styles.numCell, color: y.profit >= 0 ? "#1F7A52" : "#B23A2E", fontWeight: 600 }} className="num">{fmt(y.profit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section style={styles.section}>
        <h3 style={styles.sectionTitle}>Google Sheets sync</h3>
        <div style={styles.syncNote}>
          <FileSpreadsheet size={16} color="#854F0B" style={{ flexShrink: 0, marginTop: 2 }} />
          <div>
            Every add, edit or delete is saved automatically to your secure backend database, so your data is
            here next time you open it. Use <strong>Export CSV</strong> (per airline) or
            <strong> Export all (CSV)</strong> above any time — both open directly in Google Sheets via
            File → Import. Ask and a step-by-step Google Sheets sync setup can be provided for one-click,
            always-on sync from a spreadsheet you control.
          </div>
        </div>
      </section>

      {removeConfirm && (
        <ConfirmDialog
          message={`Remove ${removeConfirm.name} and all of its transaction records? This can't be undone.`}
          onCancel={() => setRemoveConfirm(null)}
          onConfirm={() => { onRemoveAirline(removeConfirm.id); setRemoveConfirm(null); }}
        />
      )}
    </div>
  );
}

function MetricCard({ icon, label, value, tone }: any) {
  const toneColors = ({
    navy: { bg: "#EEF1F5", fg: "#0F1B2D" },
    gold: { bg: "#FBF3E1", fg: "#854F0B" },
    good: { bg: "#E7F3EC", fg: "#1F7A52" },
    bad: { bg: "#FBEAE8", fg: "#B23A2E" },
  } as any)[tone] || { bg: "#EEF1F5", fg: "#0F1B2D" };
  return (
    <div style={styles.metricCard}>
      <div style={{ ...styles.metricIcon, background: toneColors.bg, color: toneColors.fg }}>{icon}</div>
      <div>
        <div style={styles.metricLabel}>{label}</div>
        <div style={styles.metricValue} className="num">{value}</div>
      </div>
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
          <AlertCircle size={20} color="#B23A2E" style={{ flexShrink: 0 }} />
          <p style={{ margin: 0, fontSize: 14, color: "#2A2E35", lineHeight: 1.5 }}>{message}</p>
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
  app: { background: "#F7F5EF", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif", color: "#2A2E35" },
  header: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 28px", background: "#0F1B2D", color: "#F7F5EF" },
  headerLeft: { display: "flex", alignItems: "center", gap: 12 },
  logoBadge: { width: 36, height: 36, borderRadius: 8, background: "#C89B3C", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  title: { fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 18, letterSpacing: "0.03em", fontWeight: 700 },
  subtitle: { fontSize: 12, color: "#B7C0CC", marginTop: 2 },
  savedTag: { display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#B7C0CC" },
  savedDot: { width: 6, height: 6, borderRadius: "50%", background: "#5DCAA5", transition: "opacity .3s" },
  body: { display: "flex", maxWidth: 1400, margin: "0 auto" },
  tabStrip: { width: 216, flexShrink: 0, padding: "18px 10px", display: "flex", flexDirection: "column", gap: 4, borderRight: "1px dashed #D8D5CB", minHeight: "calc(100vh - 68px)" },
  tabDivider: { height: 1, background: "#E7E4DB", margin: "6px 4px" },
  tabStub: { display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 8, border: "1px solid transparent", background: "transparent", cursor: "pointer", textAlign: "left", fontSize: 13, color: "#4A4E56", width: "100%" },
  tabStubActive: { background: "#0F1B2D", color: "#F7F5EF" },
  tabCode: { fontFamily: "Georgia, serif", fontWeight: 700, fontSize: 11, minWidth: 30, textAlign: "center", padding: "3px 4px", borderRadius: 4, background: "#EEECE3", color: "#5F5E5A", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" },
  tabCodeActive: { background: "#C89B3C", color: "#0F1B2D" },
  tabLabel: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  addTabBtn: { marginTop: 10, display: "flex", alignItems: "center", gap: 6, justifyContent: "center", padding: "9px 12px", borderRadius: 8, border: "1px dashed #C3C2B7", background: "transparent", color: "#5F5E5A", fontSize: 13, cursor: "pointer" },
  main: { flex: 1, padding: "24px 28px 60px", minWidth: 0 },
  panelHeader: { display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, marginBottom: 14, flexWrap: "wrap" },
  panelTitle: { fontFamily: "Georgia, serif", fontSize: 22, margin: 0, color: "#0F1B2D" },
  panelMeta: { fontSize: 13, color: "#767B84", marginTop: 4 },
  panelActions: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" },
  openingBalanceBox: { display: "flex", flexDirection: "column", gap: 3, fontSize: 11, color: "#767B84", textTransform: "uppercase", letterSpacing: "0.03em" },
  searchBox: { display: "flex", alignItems: "center", gap: 6, background: "#fff", border: "1px solid #D8D5CB", borderRadius: 8, padding: "7px 10px" },
  searchInput: { border: "none", outline: "none", fontSize: 13, width: 150, background: "transparent" },
  ghostBtn: { display: "flex", alignItems: "center", gap: 6, padding: "9px 14px", borderRadius: 8, border: "1px solid #D8D5CB", background: "#fff", color: "#2A2E35", fontSize: 13, cursor: "pointer" },
  ghostBtnSm: { padding: "6px 10px", borderRadius: 6, border: "1px solid #D8D5CB", background: "#fff", color: "#2A2E35", fontSize: 12, cursor: "pointer", marginRight: 6, display: "inline-flex", alignItems: "center", gap: 4 },
  primaryBtn: { display: "flex", alignItems: "center", gap: 6, padding: "9px 14px", borderRadius: 8, border: "1px solid #0F1B2D", background: "#0F1B2D", color: "#fff", fontSize: 13, cursor: "pointer" },
  dangerBtn: { display: "flex", alignItems: "center", gap: 6, padding: "9px 14px", borderRadius: 8, border: "1px solid #B23A2E", background: "#B23A2E", color: "#fff", fontSize: 13, cursor: "pointer" },
  iconBtn: { display: "inline-flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, borderRadius: 6, border: "none", background: "transparent", color: "#5F5E5A", cursor: "pointer", marginLeft: 2 },
  agentBar: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", background: "#fff", border: "1px solid #E7E4DB", borderRadius: 10, padding: "10px 12px", marginBottom: 12 },
  agentBarLabel: { fontSize: 12, color: "#767B84", marginRight: 2 },
  agentChip: { display: "inline-flex", alignItems: "center", gap: 5, background: "#EEF1F5", color: "#0F1B2D", fontSize: 12, padding: "4px 6px 4px 10px", borderRadius: 999 },
  agentChipX: { border: "none", background: "transparent", cursor: "pointer", color: "#0F1B2D", display: "flex", alignItems: "center", padding: 2 },
  tableWrap: { background: "#fff", border: "1px solid #E7E4DB", borderRadius: 10, overflowX: "auto" },
  table: { fontSize: 13 },
  th: { textAlign: "left", padding: "10px 10px", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em", color: "#767B84", borderBottom: "1px solid #E7E4DB", whiteSpace: "nowrap", background: "#FAF9F5" },
  autoTag: { marginLeft: 5, fontSize: 9, background: "#FBF3E1", color: "#854F0B", padding: "1px 5px", borderRadius: 4, textTransform: "lowercase", letterSpacing: 0 },
  tr: { borderBottom: "1px solid #F1EFE8" },
  td: { padding: "8px 10px", whiteSpace: "nowrap" },
  tdCell: { padding: "3px 4px", whiteSpace: "nowrap" },
  tdMuted: { padding: "10px 12px", color: "#9AA0A8" },
  numCell: { textAlign: "right" },
  emptyCell: { padding: "36px 12px", textAlign: "center", color: "#9AA0A8", fontSize: 13 },
  emptyBlock: { padding: "28px 12px", textAlign: "center", color: "#9AA0A8", fontSize: 13, background: "#fff", border: "1px solid #E7E4DB", borderRadius: 10 },
  addRowBar: { display: "flex", alignItems: "center", gap: 6, justifyContent: "center", width: "100%", marginTop: 8, padding: "9px 12px", borderRadius: 8, border: "1px dashed #C3C2B7", background: "transparent", color: "#5F5E5A", fontSize: 13, cursor: "pointer" },
  metricGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, marginBottom: 26 },
  metricCard: { display: "flex", alignItems: "center", gap: 12, background: "#fff", border: "1px solid #E7E4DB", borderRadius: 12, padding: "14px 16px" },
  metricIcon: { width: 34, height: 34, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  metricLabel: { fontSize: 12, color: "#767B84" },
  metricValue: { fontSize: 20, fontWeight: 700, color: "#0F1B2D", marginTop: 2 },
  balanceCardsSection: { marginTop: 28 },
  balanceCardGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 },
  balanceCard: { display: "flex", flexDirection: "column", alignItems: "flex-start", minWidth: 0, textAlign: "left", background: "#fff", border: "1px solid #E7E4DB", borderRadius: 12, padding: "15px 16px", cursor: "pointer", color: "#2A2E35", transition: "border-color .2s, transform .2s" },
  airlineBadge: { color: "#fff", fontSize: 11, fontWeight: 800, letterSpacing: "0.04em", borderRadius: 6, padding: "5px 8px", marginBottom: 11 },
  balanceCardName: { width: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 13, fontWeight: 650, color: "#0F1B2D" },
  balanceCardLabel: { marginTop: 16, fontSize: 11, color: "#767B84", textTransform: "uppercase", letterSpacing: "0.03em" },
  balanceCardValue: { marginTop: 3, fontSize: 21, color: "#0F1B2D" },
  section: { marginTop: 30 },
  sectionHeaderRow: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  sectionTitle: { fontFamily: "Georgia, serif", fontSize: 16, margin: "0 0 12px", color: "#0F1B2D" },
  select: { padding: "7px 10px", borderRadius: 8, border: "1px solid #D8D5CB", background: "#fff", fontSize: 13 },
  syncNote: { display: "flex", gap: 10, background: "#FBF3E1", border: "1px solid #F0DDB3", borderRadius: 10, padding: "14px 16px", fontSize: 13, lineHeight: 1.55, color: "#5F4415" },
  overlay: { position: "fixed", inset: 0, background: "rgba(15,27,45,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 20 },
  modal: { background: "#fff", borderRadius: 14, padding: 22, width: "100%", maxWidth: 640, maxHeight: "88vh", overflowY: "auto" },
  modalHeader: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 },
  modalGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 },
  modalTitle: { fontFamily: "Georgia, serif", fontSize: 18, margin: 0, color: "#0F1B2D" },
  field: { display: "flex", flexDirection: "column", gap: 5 },
  radioGroup: { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 7, padding: "2px 0" },
  radioOption: { display: "flex", alignItems: "center", gap: 6, minHeight: 28, fontSize: 12.5, color: "#0F1B2D" },
  label: { fontSize: 11, textTransform: "uppercase", letterSpacing: "0.03em", color: "#767B84" },
  input: { padding: "9px 10px", borderRadius: 7, border: "1px solid #D8D5CB", fontSize: 13.5 },
  previewBox: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginTop: 16, background: "#FAF9F5", border: "1px solid #E7E4DB", borderRadius: 10, padding: "12px 14px" },
  previewItem: { display: "flex", flexDirection: "column", gap: 3 },
  previewLabel: { fontSize: 11, textTransform: "uppercase", letterSpacing: "0.03em", color: "#767B84" },
  previewValue: { fontSize: 14, fontWeight: 600, color: "#0F1B2D" },
  errorNote: { display: "flex", alignItems: "center", gap: 6, marginTop: 12, color: "#B23A2E", fontSize: 12.5 },
  modalFooter: { display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 20, borderTop: "1px solid #F1EFE8", paddingTop: 16 },
};
