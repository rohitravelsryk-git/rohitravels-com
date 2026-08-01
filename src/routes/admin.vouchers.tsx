import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import { Plane, LogOut, Plus, Edit3, Trash2, Check, X, Search, Ticket, Calendar, Upload, Stamp, FileSpreadsheet, FileDown } from "lucide-react";
import { downloadCsv, printPdf } from "@/lib/voucher-export";

import { adminLogout, adminUnlock, checkAdminUnlocked } from "@/lib/fares.functions";
import { AdminHeaderExtras } from "@/components/AdminHeaderExtras";
import { AdminTabs } from "@/components/AdminTabs";
import {
  listVouchersAdmin,
  createVoucher,
  createVouchersBulk,
  updateVoucher,
  deleteVoucher,
  type Voucher,
} from "@/lib/vouchers.functions";

export const Route = createFileRoute("/admin/vouchers")({
  component: Page,
  errorComponent: ({ error }) => (
    <div className="p-8 text-center text-destructive">{error.message}</div>
  ),
});

function Page() {
  const { data: status, isLoading } = useQuery({
    queryKey: ["admin", "status"],
    queryFn: () => checkAdminUnlocked(),
  });
  if (isLoading) return <div className="p-10 text-center text-muted-foreground">Loading…</div>;
  return status?.unlocked ? <Panel /> : <Unlock />;
}

function Unlock() {
  const unlock = useServerFn(adminUnlock);
  const qc = useQueryClient();
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    try {
      const res = await unlock({ data: { password } });
      if (!res.ok) setErr("Incorrect password");
      else await qc.invalidateQueries({ queryKey: ["admin", "status"] });
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-hero px-4">
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl bg-card p-8 ring-1 ring-border shadow-[var(--shadow-hero)]">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-navy">
          <Plane className="h-6 w-6 -rotate-45 text-gold" />
        </div>
        <h1 className="mt-4 text-center font-serif text-2xl font-black text-navy">Admin Access</h1>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Admin password"
          className="mt-6 w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-gold focus:ring-2 focus:ring-gold/30"
        />
        {err && <p className="mt-2 text-xs text-destructive">{err}</p>}
        <button className="mt-4 w-full rounded-md bg-navy py-2.5 text-sm font-bold text-navy-foreground">Unlock</button>
      </form>
    </div>
  );
}

type Draft = {
  agent_name: string;
  passenger_name: string;
  pnr: string;
  voucher_amount: string;
  airline: string;
  expiry_date: string;
};
const EMPTY: Draft = {
  agent_name: "",
  passenger_name: "",
  pnr: "",
  voucher_amount: "",
  airline: "",
  expiry_date: "",
};


const MONTHS: Record<string, number> = {
  JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5,
  JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11,
};
const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export function displayExpiry(s: string): string {
  const d = parseExpiry(s);
  return d ? formatExpiry(d) : (s || "");
}

export function parseExpiry(s: string): Date | null {
  if (!s) return null;
  const trimmed = s.trim();
  const m = trimmed.match(/^(\d{1,2})[-/\s]([A-Za-z]{3})[-/\s](\d{2}|\d{4})$/);
  if (m) {
    const mon = MONTHS[m[2].toUpperCase()];
    if (mon != null) {
      let y = Number(m[3]);
      if (y < 100) y += 2000;
      return new Date(y, mon, Number(m[1]));
    }
  }
  const d = new Date(trimmed);
  return isNaN(d.getTime()) ? null : d;
}

function formatExpiry(d: Date): string {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = MONTH_NAMES[d.getMonth()];
  const yy = String(d.getFullYear());
  return `${dd}-${mm}-${yy}`;
}

function toIsoDate(s: string): string {
  const d = parseExpiry(s);
  if (!d) return "";
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

export function daysUntil(s: string): number | null {
  const d = parseExpiry(s);
  if (!d) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - today.getTime()) / 86400000);
}

export function statusFor(days: number | null): { label: string; cls: string } {
  if (days == null) return { label: "—", cls: "bg-slate-300 text-slate-700" };
  if (days < 0) return { label: "EXPIRED", cls: "bg-rose-600 text-white" };
  if (days <= 10) return { label: "NEARLY EXPIRED", cls: "bg-amber-500 text-white" };
  return { label: "ACTIVE", cls: "bg-emerald-500 text-white" };
}

export function daysPill(days: number | null): string {
  if (days == null) return "bg-slate-100 text-slate-600 ring-1 ring-slate-200";
  if (days < 0) return "bg-rose-100 text-rose-800 ring-1 ring-rose-300 font-black";
  if (days <= 10) return "bg-amber-50 text-amber-800 ring-1 ring-amber-300 font-black";
  if (days <= 30) return "bg-orange-50 text-orange-700 ring-1 ring-orange-200 font-bold";
  return "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 font-semibold";
}

function ExpiryPicker({ v, onChange }: { v: string; onChange: (s: string) => void }) {
  const dateRef = useRef<HTMLInputElement>(null);
  return (
    <div className="flex items-center gap-1">
      <input
        value={v}
        onChange={(e) => onChange(e.target.value)}
        placeholder="DD-MMM-YYYY"
        className="w-full rounded border border-input bg-background px-2 py-1.5 text-xs outline-none focus:border-gold focus:ring-1 focus:ring-gold/40"
      />
      <button
        type="button"
        onClick={() => {
          const el = dateRef.current;
          if (!el) return;
          const anyEl = el as HTMLInputElement & { showPicker?: () => void };
          if (typeof anyEl.showPicker === "function") anyEl.showPicker();
          else el.click();
        }}
        className="rounded border border-input bg-background p-1.5 hover:bg-secondary"
        title="Pick a date"
      >
        <Calendar className="h-3 w-3" />
      </button>
      <input
        ref={dateRef}
        type="date"
        value={toIsoDate(v)}
        onChange={(e) => {
          const [y, m, d] = e.target.value.split("-").map(Number);
          if (!y || !m || !d) return;
          onChange(formatExpiry(new Date(y, m - 1, d)));
        }}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
      />
    </div>
  );
}

function Panel() {
  const qc = useQueryClient();
  const logout = useServerFn(adminLogout);
  const create = useServerFn(createVoucher);
  const bulk = useServerFn(createVouchersBulk);
  const update = useServerFn(updateVoucher);
  const remove = useServerFn(deleteVoucher);

  const { data: vouchers = [] } = useQuery<Voucher[]>({ queryKey: ["vouchers", "admin"], queryFn: () => listVouchersAdmin() });

  const [q, setQ] = useState("");
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Draft>(EMPTY);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [bulkMsg, setBulkMsg] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [showAdd, setShowAdd] = useState(false);

  const rows: Voucher[] = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return vouchers;
    return vouchers.filter((v) =>
      [v.agent_name, v.passenger_name, v.pnr, v.airline, v.voucher_amount, v.expiry_date]
        .join(" ").toLowerCase().includes(t),
    );
  }, [vouchers, q]);

  function toPayload(d: Draft) {
    return {
      sr: 0,
      agent_name: d.agent_name,
      passenger_name: d.passenger_name,
      pnr: d.pnr,
      voucher_amount: d.voucher_amount,
      airline: d.airline,
      expiry_date: d.expiry_date,
    };
  }
  async function add() {
    await create({ data: toPayload(draft) });
    await qc.invalidateQueries({ queryKey: ["vouchers"] });
    setDraft(EMPTY);
    setShowAdd(false);
  }
  function startEdit(v: Voucher) {
    setEditingId(v.id);
    setEditDraft({
      agent_name: v.agent_name || "",
      passenger_name: v.passenger_name || v.name || "",
      pnr: v.pnr || "",
      voucher_amount: v.voucher_amount || "",
      airline: v.airline || "",
      expiry_date: v.expiry_date || "",
    });
  }

  async function save() {
    if (!editingId) return;
    await update({ data: { id: editingId, ...toPayload(editDraft) } });
    await qc.invalidateQueries({ queryKey: ["vouchers"] });
    setEditingId(null);
  }
  async function del(id: string) {
    if (!confirm("Delete this voucher?")) return;
    await remove({ data: { id } });
    await qc.invalidateQueries({ queryKey: ["vouchers"] });
  }
  async function onLogout() {
    await logout();
    await qc.invalidateQueries({ queryKey: ["admin", "status"] });
  }

  function exportData() {
    return {
      title: "Discount Vouchers — Admin",
      headers: ["Sr", "Agent Name", "Passenger Name", "PNR", "Amount", "PNR Expiry", "Days Left", "Status"],
      rows: rows.map((v, i) => {
        const days = daysUntil(v.expiry_date);
        return [
          i + 1,
          v.agent_name || "",
          v.passenger_name || v.name || "",
          v.pnr || "",
          v.voucher_amount || "",
          displayExpiry(v.expiry_date),
          days == null ? "—" : days,
          statusFor(days).label,
        ];
      }),
    };
  }



  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-navy text-navy-foreground">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <Plane className="h-5 w-5 -rotate-45 text-gold" />
            <div>
              <p className="font-serif text-lg font-black">Admin Panel</p>
              <p className="text-[10px] tracking-widest text-white/60">Manage voucher inventory</p>
            </div>
          </div>
          <div className="flex gap-2">
            <AdminHeaderExtras />
            <a href="/" className="rounded-md border border-white/20 px-3 py-2 text-xs font-semibold hover:bg-white/10">View site</a>
            <button onClick={onLogout} className="inline-flex items-center gap-2 rounded-md bg-gold px-3 py-2 text-xs font-bold text-gold-foreground">
              <LogOut className="h-3.5 w-3.5" /> Logout
            </button>
          </div>
        </div>
        <AdminTabs />
      </header>

      <div className="mx-auto max-w-[1600px] px-4 py-6">
        <div className="mb-4 flex items-center gap-3 rounded-xl bg-card p-3 ring-1 ring-border">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search vouchers…"
              className="w-full rounded-md border border-input bg-background py-2 pl-9 pr-3 text-sm outline-none focus:border-gold focus:ring-2 focus:ring-gold/30"
            />
          </div>
          <button
            onClick={() => { setDraft(EMPTY); setShowAdd((s) => !s); }}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-xs font-bold transition ${showAdd ? "bg-muted text-foreground ring-1 ring-border hover:bg-muted/80" : "bg-navy text-navy-foreground hover:bg-navy/90"}`}
          >
            <Plus className="h-3.5 w-3.5" /> {showAdd ? "Cancel" : "Add Voucher"}
          </button>
          <button
            onClick={() => { setBulkOpen(true); setBulkMsg(null); }}
            className="inline-flex items-center gap-1.5 rounded-md bg-gold px-3 py-2 text-xs font-bold text-gold-foreground hover:opacity-90"
          >
            <Upload className="h-3.5 w-3.5" /> Bulk Upload
          </button>
          <button
            onClick={() => downloadCsv(exportData())}
            className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700"
            title="Download as Excel / Google Sheets (CSV)"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" /> Excel
          </button>
          <button
            onClick={() => printPdf(exportData())}
            className="inline-flex items-center gap-1.5 rounded-md bg-rose-600 px-3 py-2 text-xs font-bold text-white hover:bg-rose-700"
            title="Download / print as PDF"
          >
            <FileDown className="h-3.5 w-3.5" /> PDF
          </button>
          <span className="text-xs font-semibold text-muted-foreground">{rows.length} / {vouchers.length}</span>
        </div>


        <div className="overflow-x-auto rounded-xl bg-card ring-1 ring-border">
          <table className="w-full min-w-[1300px] text-sm">
            <thead className="bg-navy text-[10px] font-bold uppercase tracking-widest text-navy-foreground">
              <tr>
                <th className="px-2 py-3 text-left">Agent Name</th>
                <th className="px-2 py-3 text-left">Passenger Name</th>
                <th className="px-2 py-3 text-left w-28">PNR</th>
                <th className="px-2 py-3 text-left w-28">Amount</th>
                <th className="px-2 py-3 text-left w-32">Airline</th>
                <th className="px-2 py-3 text-left w-44">PNR Expiry</th>
                <th className="px-2 py-3 text-center w-20">Days Left</th>
                <th className="px-2 py-3 text-center w-36">Status</th>
                
                <th className="px-2 py-3 text-center w-24">Actions</th>
              </tr>
            </thead>
            <tbody>
              {showAdd && (
              <tr className="bg-gold/10 [&>td]:p-1.5">
                <td><Input v={draft.agent_name} onChange={(v) => setDraft({ ...draft, agent_name: v })} placeholder="Agent" /></td>
                <td><Input v={draft.passenger_name} onChange={(v) => setDraft({ ...draft, passenger_name: v })} placeholder="Passenger" /></td>
                <td><Input v={draft.pnr} onChange={(v) => setDraft({ ...draft, pnr: v.toUpperCase() })} placeholder="PNR" /></td>
                <td><Input v={draft.voucher_amount} onChange={(v) => setDraft({ ...draft, voucher_amount: v })} placeholder="Amount" /></td>
                <td><Input v={draft.airline} onChange={(v) => setDraft({ ...draft, airline: v })} placeholder="Airline" /></td>
                <td><ExpiryPicker v={draft.expiry_date} onChange={(v) => setDraft({ ...draft, expiry_date: v })} /></td>
                <td className="text-center text-[11px] text-muted-foreground">
                  {(() => { const d = daysUntil(draft.expiry_date); return d == null ? "—" : d; })()}
                </td>
                <td className="text-center">
                  {(() => {
                    const st = statusFor(daysUntil(draft.expiry_date));
                    return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest ${st.cls}`}>{st.label}</span>;
                  })()}
                </td>
                <td className="text-center">
                  <button onClick={add} className="inline-flex items-center gap-1 rounded-md bg-navy px-3 py-1.5 text-xs font-bold text-navy-foreground hover:bg-navy/90">
                    <Plus className="h-3.5 w-3.5" /> Save
                  </button>
                </td>
              </tr>
              )}
              {rows.map((v, i) => {
                const isEdit = editingId === v.id;
                const src = isEdit ? editDraft.expiry_date : v.expiry_date;
                const days = daysUntil(src);
                const st = statusFor(days);
                return (
                  <tr key={v.id} className={i % 2 === 0 ? "bg-background" : "bg-secondary/40"}>
                    <td className="px-2 py-2.5 text-xs">
                      {isEdit ? <Input v={editDraft.agent_name} onChange={(x) => setEditDraft({ ...editDraft, agent_name: x })} /> : v.agent_name}
                    </td>
                    <td className="px-2 py-2.5 font-bold text-navy text-xs">
                      {isEdit ? <Input v={editDraft.passenger_name} onChange={(x) => setEditDraft({ ...editDraft, passenger_name: x })} /> : (v.passenger_name || v.name)}
                    </td>
                    <td className="px-2 py-2.5 font-mono text-xs uppercase">
                      {isEdit ? <Input v={editDraft.pnr} onChange={(x) => setEditDraft({ ...editDraft, pnr: x.toUpperCase() })} /> : v.pnr}
                    </td>
                    <td className="px-2 py-2.5 font-mono text-xs">
                      {isEdit ? <Input v={editDraft.voucher_amount} onChange={(x) => setEditDraft({ ...editDraft, voucher_amount: x })} /> : v.voucher_amount}
                    </td>
                    <td className="px-2 py-2.5 text-xs">
                      {isEdit ? <Input v={editDraft.airline} onChange={(x) => setEditDraft({ ...editDraft, airline: x })} /> : v.airline}
                    </td>
                    <td className="px-2 py-2.5 font-mono text-xs">
                      {isEdit ? <ExpiryPicker v={editDraft.expiry_date} onChange={(x) => setEditDraft({ ...editDraft, expiry_date: x })} /> : displayExpiry(v.expiry_date)}
                    </td>
                    <td className="px-2 py-2.5 text-center">
                      <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] ${daysPill(days)}`}>
                        {days == null ? "—" : days}
                      </span>
                    </td>
                    <td className="px-2 py-2.5 text-center">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest ${st.cls}`}>
                        {st.label}
                      </span>
                    </td>
                    <td className="px-2 py-2.5 text-center">
                      {isEdit ? (
                        <div className="flex justify-center gap-1">
                          <button onClick={save} className="rounded bg-emerald-500 p-1.5 text-white"><Check className="h-3 w-3" /></button>
                          <button onClick={() => setEditingId(null)} className="rounded border border-border p-1.5"><X className="h-3 w-3" /></button>
                        </div>
                      ) : (
                        <div className="flex justify-center gap-1">
                          <button onClick={() => startEdit(v)} className="rounded border border-border p-1.5 hover:bg-secondary" title="Edit"><Edit3 className="h-3 w-3" /></button>
                          <button onClick={() => del(v.id)} className="rounded border border-destructive/30 bg-destructive/5 p-1.5 text-destructive" title="Delete"><Trash2 className="h-3 w-3" /></button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-sm text-muted-foreground">
                    {vouchers.length === 0 ? "No vouchers yet. Add one above." : "No vouchers match your search."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {bulkOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setBulkOpen(false)}>
          <div className="w-full max-w-3xl rounded-xl bg-card p-6 ring-1 ring-border shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-serif text-xl font-black text-navy">Bulk Upload Vouchers</h2>
              <button onClick={() => setBulkOpen(false)} className="rounded p-1 hover:bg-secondary"><X className="h-4 w-4" /></button>
            </div>
            <p className="text-xs text-muted-foreground">
              Paste rows from Excel / Google Sheets or CSV. One voucher per line, columns in this exact order (tab or comma separated). Header row is optional.
            </p>
            <p className="mt-2 font-mono text-[11px] text-navy">
              Agent Name • Passenger Name • PNR • Amount • Airline • Expiry (DD-MMM-YYYY)
            </p>
            <textarea
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              placeholder={"Ali\tJohn Doe\tABC123\t1500\tPIA\t27-MAR-2027\nSara\tJane Smith\tXYZ789\t2000\tEmirates\t15-JUN-2026"}

              className="mt-3 h-64 w-full rounded-md border border-input bg-background p-3 font-mono text-xs outline-none focus:border-gold focus:ring-2 focus:ring-gold/30"
            />
            {bulkMsg && <p className="mt-2 text-xs text-destructive">{bulkMsg}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setBulkOpen(false)} className="rounded-md border border-border px-4 py-2 text-xs font-semibold">Cancel</button>
              <button
                disabled={bulkBusy || !bulkText.trim()}
                onClick={async () => {
                  setBulkBusy(true);
                  setBulkMsg(null);
                  try {
                    const items = parseBulk(bulkText);
                    if (items.length === 0) { setBulkMsg("No rows detected"); return; }
                    const res = await bulk({ data: { items } });
                    await qc.invalidateQueries({ queryKey: ["vouchers"] });
                    setBulkText("");
                    setBulkOpen(false);
                    setBulkMsg(null);
                    alert(`Uploaded ${res.count} vouchers`);
                  } catch (err) {
                    setBulkMsg((err as Error).message);
                  } finally {
                    setBulkBusy(false);
                  }
                }}
                className="inline-flex items-center gap-1.5 rounded-md bg-navy px-4 py-2 text-xs font-bold text-navy-foreground disabled:opacity-40"
              >
                <Upload className="h-3.5 w-3.5" /> {bulkBusy ? "Uploading…" : "Upload"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function parseBulk(text: string) {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const HEADER_KEYS = ["agent", "passenger", "pnr", "amount", "airline", "expiry"];
  const first = lines[0]?.toLowerCase() ?? "";
  const hasHeader = HEADER_KEYS.some((k) => first.includes(k));
  const dataLines = hasHeader ? lines.slice(1) : lines;
  return dataLines.map((line) => {
    const cols = (line.includes("\t") ? line.split("\t") : line.split(",")).map((c) => c.trim());
    return {
      agent_name: cols[0] ?? "",
      passenger_name: cols[1] ?? "",
      pnr: (cols[2] ?? "").toUpperCase(),
      voucher_amount: cols[3] ?? "",
      airline: cols[4] ?? "",
      expiry_date: cols[5] ?? "",
    };
  });
}


function Input({ v, onChange, placeholder }: { v: string; onChange: (s: string) => void; placeholder?: string }) {
  return (
    <input
      value={v}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded border border-input bg-background px-2 py-1.5 text-xs outline-none focus:border-gold focus:ring-1 focus:ring-gold/40"
    />
  );
}
