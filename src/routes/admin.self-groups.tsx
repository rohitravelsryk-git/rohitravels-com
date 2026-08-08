import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { LogOut, Users, Download } from "lucide-react";
import { AdminHeaderExtras } from "@/components/AdminHeaderExtras";
import { AdminTabs } from "@/components/AdminTabs";
import { GroupsAppliedPanel, fmtDate, fmtDateShort } from "@/components/GroupsAppliedDialog";

import {
  adminLogout,
  checkAdminUnlocked,
  listFaresAdmin,
  type Fare,
} from "@/lib/fares.functions";
import { listTickets, type GroupTicket } from "@/lib/tickets.functions";
import {
  listSelfGroupPassengers,
  listSelfGroupApplications,
  updateSelfGroupPassenger,
  type SelfGroupPassenger,
  type SelfGroupApplication,
} from "@/lib/self-groups.functions";

import { AirlineLogo } from "@/routes/index";

export const Route = createFileRoute("/admin/self-groups")({
  component: Page,
  head: () => ({
    meta: [
      { title: "Self Groups · Rohi Admin" },
      { name: "description", content: "Self-group dashboards and passenger manifests." },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
});

const TITLES = ["MR", "MRS", "MS", "MSTR", "MISS"];
const DOC_TYPES = ["PassPort", "CNIC", "ID Card"];

function Page() {
  const { data: status, isLoading } = useQuery({
    queryKey: ["admin", "status"],
    queryFn: () => checkAdminUnlocked(),
  });
  if (isLoading) return <div className="p-10 text-center text-muted-foreground">Loading…</div>;
  if (!status?.unlocked) {
    return (
      <div className="p-10 text-center">
        <p className="text-sm">Admin session required.</p>
        <Link to="/admin" className="mt-3 inline-block rounded bg-navy px-4 py-2 text-xs font-bold text-navy-foreground">Go to Admin</Link>
      </div>
    );
  }
  return <Panel />;
}

function Panel() {
  const qc = useQueryClient();
  const router = useRouter();
  const logout = useServerFn(adminLogout);

  const { data: fares = [] } = useQuery<Fare[]>({ queryKey: ["fares"], queryFn: () => listFaresAdmin() });
  const { data: tickets = [] } = useQuery<GroupTicket[]>({ queryKey: ["tickets"], queryFn: () => listTickets() });
  const { data: passengers = [] } = useQuery<SelfGroupPassenger[]>({
    queryKey: ["self-group-pax"],
    queryFn: () => listSelfGroupPassengers(),
  });

  const update = useServerFn(updateSelfGroupPassenger);


  const selfFares = useMemo(() => fares.filter((f) => f.group_type === "self"), [fares]);

  const ticketById = useMemo(() => {
    const m = new Map<string, GroupTicket>();
    for (const t of tickets) m.set(t.id, t);
    return m;
  }, [tickets]);

  // For each self fare: sector key like "KHI JED"
  function fareKey(f: Fare) {
    return `${f.origin_code} ${f.destination_code}`.toUpperCase();
  }

  function ticketsForFare(f: Fare) {
    const key = fareKey(f);
    return tickets.filter(
      (t) => t.group_type === "self" && (t.sector || "").toUpperCase().includes(key),
    );
  }

  function passengersForFare(f: Fare) {
    const o = (f.origin_code || "").toUpperCase();
    const d = (f.destination_code || "").toUpperCase();
    return passengers.filter((p) => {
      if (p.fare_id === f.id) return true;
      const t = p.ticket_id ? ticketById.get(p.ticket_id) : null;
      const sector = (t?.sector || p.sector || "").toUpperCase();
      if (!o || !d) return false;
      const tokens = sector.split(/[^A-Z0-9]+/).filter(Boolean);
      return tokens.includes(o) && tokens.includes(d);
    });
  }


  async function refetch() {
    await qc.invalidateQueries({ queryKey: ["self-group-pax"] });
  }

  async function onLogout() { await logout(); router.navigate({ to: "/admin" }); }

  const [showExport, setShowExport] = useState(false);
  const [tab, setTab] = useState<"dashboards" | "applied">("dashboards");
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const isSelected = (id: string) => selected.has(id);
  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  const visibleFares = selfFares.filter((f) => isSelected(f.id));

  const appliedPrefills = useMemo(
    () =>
      selfFares.map((f) => ({
        label: `${(f.origin_code || f.origin).toUpperCase()} → ${(f.destination_code || f.destination).toUpperCase()} · ${f.airline}`,
        airline: f.airline,
        origin: (f.origin_code || f.origin).toUpperCase(),
        destination: (f.destination_code || f.destination).toUpperCase(),
        flight_details: f.flight_details ?? "",
        luggage: f.baggage ?? "",
        meal: f.meal ?? "Not Included",
        seats: parseInt(String(f.seats || "").replace(/[^0-9]/g, ""), 10) || 0,
        fare_id: f.id,
      })),
    [selfFares],
  );

  const exportRows = (list: SelfGroupPassenger[]) => [
    ["Sr", "Title", "FirstName", "LastName", "DateOfBirth", "Nationality", "IssuedByCountry", "DocumentType", "DocumentNumber", "ExpireDate", "PNR", "Sector"],
    ...list.map((p, i) => [
      String(i + 1),
      p.title, p.first_name, p.last_name, p.dob ?? "",
      p.nationality, p.issued_by_country, p.doc_type, p.doc_number, p.expire_date ?? "",
      p.pnr, p.sector,
    ]),
  ];

  function downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function exportList(
    kind: "xlsx" | "csv" | "pdf",
    list: SelfGroupPassenger[],
    baseName: string,
    title: string,
  ) {
    const rows = exportRows(list);
    const date = new Date().toISOString().slice(0, 10);
    const base = `${baseName}-${date}`;
    if (kind === "csv") {
      const csv = rows.map((r) => r.map((c) => {
        const s = String(c ?? "");
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
      }).join(",")).join("\n");
      downloadBlob(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }), `${base}.csv`);
      return;
    }
    if (kind === "xlsx") {
      const XLSX = await import("xlsx");
      const ws = XLSX.utils.aoa_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Passengers");
      const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
      downloadBlob(new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `${base}.xlsx`);
      return;
    }
    const { default: jsPDF } = await import("jspdf");
    const autoTable = (await import("jspdf-autotable")).default;
    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    doc.setFontSize(14);
    doc.text(title, 40, 32);
    doc.setFontSize(9);
    doc.text(new Date().toLocaleString(), 40, 48);
    autoTable(doc, {
      head: [rows[0]],
      body: rows.slice(1),
      startY: 60,
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [11, 16, 36], textColor: 255 },
    });
    doc.save(`${base}.pdf`);
  }

  async function exportAs(kind: "xlsx" | "csv" | "pdf") {
    setShowExport(false);
    await exportList(kind, passengers, "self-group-passengers", "Self Group Passengers");
  }


  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-navy text-navy-foreground">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <Users className="h-5 w-5 text-gold" />
            <div>
              <p className="font-serif text-lg font-black">Self Groups</p>
              <p className="text-[10px] tracking-widest text-white/60">Live dashboards for self-owned group fares</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <AdminHeaderExtras />
            <div className="relative">
              <button onClick={() => setShowExport((v) => !v)} className="inline-flex items-center gap-2 rounded-md border border-white/20 px-3 py-2 text-xs font-semibold hover:bg-white/10">
                <Download className="h-3.5 w-3.5" /> Download
              </button>
              {showExport && (
                <div className="absolute right-0 top-full z-50 mt-1 w-44 overflow-hidden rounded-md bg-white text-navy shadow-xl ring-1 ring-black/10">
                  <p className="border-b border-border px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Save as…</p>
                  <button onClick={() => exportAs("xlsx")} className="block w-full px-3 py-2 text-left text-xs font-semibold hover:bg-secondary">📊 Excel (.xlsx)</button>
                  <button onClick={() => exportAs("csv")} className="block w-full px-3 py-2 text-left text-xs font-semibold hover:bg-secondary">📋 CSV (Google Sheets)</button>
                  <button onClick={() => exportAs("pdf")} className="block w-full px-3 py-2 text-left text-xs font-semibold hover:bg-secondary">📄 PDF (.pdf)</button>
                </div>
              )}
            </div>
            <a href="/" className="rounded-md border border-white/20 px-3 py-2 text-xs font-semibold hover:bg-white/10">View site</a>
            <button onClick={onLogout} className="inline-flex items-center gap-2 rounded-md bg-gold px-3 py-2 text-xs font-bold text-gold-foreground">
              <LogOut className="h-3.5 w-3.5" /> Logout
            </button>
          </div>
        </div>
        <AdminTabs />
      </header>

      <div className="mx-auto max-w-[1600px] px-4 py-6">
        <div className="mb-5 flex flex-wrap gap-2 rounded-xl bg-card p-2 ring-1 ring-border">
          {([
            ["dashboards", "Group Dashboards"],
            ["applied", "Groups Applied · Payment Status"],
          ] as const).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`rounded-lg px-4 py-2 text-xs font-bold uppercase tracking-widest transition ${
                tab === k
                  ? "bg-navy text-navy-foreground ring-1 ring-gold"
                  : "text-navy hover:bg-secondary"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "applied" && <GroupsAppliedPanel prefills={appliedPrefills} />}

        {tab === "dashboards" && selfFares.length === 0 && (
          <div className="rounded-xl bg-card p-8 text-center text-sm text-muted-foreground ring-1 ring-border">
            No <b>Self Group</b> fares yet. Open <Link to="/admin" className="text-navy underline">Group Fares</Link>, add a fare, and set <b>Group Type</b> to <b>Self Group</b>.
          </div>
        )}

        {tab === "dashboards" && selfFares.length > 0 && (
        <div className="flex flex-col gap-6 lg:flex-row">
          {/* Group selector */}
          <aside className="w-full shrink-0 lg:w-[280px]">
            <div className="overflow-hidden rounded-xl bg-card ring-1 ring-border">
              <div className="flex items-center justify-between gap-2 bg-[#0b1024] px-3 py-2 text-white">
                <p className="text-[11px] font-bold uppercase tracking-widest">Details</p>
                <div className="flex gap-1">
                  <button onClick={() => setSelected(new Set(selfFares.map((f) => f.id)))} className="rounded border border-white/20 px-2 py-0.5 text-[10px] font-semibold hover:bg-white/10">All</button>
                  <button onClick={() => setSelected(new Set())} className="rounded border border-white/20 px-2 py-0.5 text-[10px] font-semibold hover:bg-white/10">None</button>
                </div>
              </div>
              <ul className="max-h-[70vh] divide-y divide-border overflow-y-auto">
                {selfFares.map((f) => {
                  const lines = (f.flight_details || "")
                    .split(/\r?\n|\s*[,;/|]\s*/)
                    .map((s) => s.trim())
                    .filter(Boolean);
                  return (
                    <li key={f.id}>
                      <label className="flex cursor-pointer items-start gap-2 px-3 py-2 hover:bg-secondary/50">
                        <input type="checkbox" checked={isSelected(f.id)} onChange={() => toggle(f.id)} className="mt-1 h-3.5 w-3.5 accent-emerald-600" />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2">
                            <AirlineLogo name={f.airline} height={18} />
                            <span className="truncate font-serif text-sm font-black text-navy">
                              {(f.origin_code || f.origin).toUpperCase()} <span className="text-muted-foreground">→</span> {(f.destination_code || f.destination).toUpperCase()}
                            </span>
                          </span>
                          {lines.length > 0 && (
                            <span className="mt-0.5 block space-y-0.5">
                              {lines.map((l, i) => (
                                <span key={i} className="block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{l}</span>
                              ))}
                            </span>
                          )}
                          <span className="mt-0.5 block text-[10px] uppercase tracking-wider text-muted-foreground">{f.airline}</span>
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </div>
          </aside>

          <div className="min-w-0 flex-1 space-y-6">
            {visibleFares.length === 0 && (
              <div className="rounded-xl bg-card p-8 text-center text-sm text-muted-foreground ring-1 ring-border">
                Select a group on the left to view its dashboard and passengers.
              </div>
            )}
            {visibleFares.map((f) => {
              const fareTickets = ticketsForFare(f);
              const pax = passengersForFare(f);
              // Parse total from "9 out of 10", "1 of 10", or plain "10"
              const seatsStr = String(f.seats || "");
              const ofMatch = seatsStr.match(/of\s*(\d+)/i);
              const nums = (seatsStr.match(/\d+/g) || []).map((n) => parseInt(n, 10));
              const total = ofMatch
                ? parseInt(ofMatch[1], 10)
                : nums.length > 0
                  ? Math.max(...nums)
                  : 0;
              // Seats sold = sum of seats on confirmed group tickets for this sector
              // (a ticket may hold 1 seat, several, or the whole group).
              const sold = fareTickets.reduce((s, t) => s + (Number(t.seats) || 1), 0)
                || new Set(pax.map((p) => p.ticket_id).filter(Boolean) as string[]).size;
              const available = Math.max(total - sold, 0);
              const pnrs = Array.from(new Set(fareTickets.map((t) => t.pnr).filter(Boolean)));
              const slug = `${f.origin_code || f.origin}-${f.destination_code || f.destination}`
                .toLowerCase().replace(/[^a-z0-9]+/g, "-");
              return (
                <FareDashboard
                  key={f.id}
                  fare={f}
                  passengers={pax}
                  total={total}
                  sold={sold}
                  available={available}
                  pnrs={pnrs}
                  onSave={async (id, patch) => { await update({ data: { id, ...patch } }); await refetch(); }}
                  onExport={(kind) =>
                    exportList(
                      kind,
                      pax,
                      `self-group-${slug}`,
                      `${f.origin.toUpperCase()} → ${f.destination.toUpperCase()} · ${f.airline}`,
                    )
                  }
                />
              );
            })}

            {(() => {
              const matched = new Set<string>();
              for (const f of selfFares) for (const p of passengersForFare(f)) matched.add(p.id);
              const unlinked = passengers.filter((p) => !matched.has(p.id));
              if (unlinked.length === 0) return null;
              return (
                <section className="overflow-hidden rounded-xl bg-card ring-1 ring-border">
                  <div className="bg-[#0b1024] px-6 py-3 text-white">
                    <p className="font-serif text-lg font-black">Unlinked self-group passengers</p>
                    <p className="text-[11px] text-white/70">Ticket sector doesn't match any Self-Group fare route codes. Edit the fare's route codes or the ticket sector to link them.</p>
                  </div>
                  <PassengersTable
                    passengers={unlinked}
                    onSave={async (id, patch) => { await update({ data: { id, ...patch } }); await refetch(); }}
                  />
                </section>
              );
            })()}
          </div>
        </div>
        )}
      </div>


    </div>
  );
}

function FareDashboard({
  fare, passengers, total, sold, available, pnrs, onSave, onExport,
}: {
  fare: Fare;
  passengers: SelfGroupPassenger[];
  total: number;
  sold: number;
  available: number;
  pnrs: string[];
  onSave: (id: string, patch: Partial<SelfGroupPassenger>) => Promise<void>;
  onExport: (kind: "xlsx" | "csv" | "pdf") => Promise<void>;
}) {
  const [menu, setMenu] = useState(false);

  const flightLines = (fare.flight_details || "")
    .split(/\r?\n|\s*[,;/|]\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
  const fmt = (n: number | string) => {
    const num = typeof n === "number" ? n : parseInt(String(n).replace(/[^0-9]/g, ""), 10);
    return Number.isFinite(num) ? num.toLocaleString("en-US") : String(n);
  };
  return (
    <section className="overflow-hidden rounded-xl bg-card ring-1 ring-border">
      {/* Dashboard header */}
      <div className="bg-[#0b1024] px-6 py-5 text-white">
        <div className="flex flex-wrap items-start justify-between gap-6">
          {/* Left: big logo + airline + sector */}
          <div className="flex items-start gap-5">
            <div className="rounded-xl bg-white p-3 ring-1 ring-white/20 shadow-lg">
              <AirlineLogo name={fare.airline} height={64} />
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/70">{fare.airline}</p>
              <p className="font-serif text-3xl font-black tracking-wide leading-tight">
                {fare.origin.toUpperCase()} <span className="text-white/80">→</span> {fare.destination.toUpperCase()}
              </p>
              {flightLines.length > 0 && (
                <div className="mt-2 space-y-0.5">
                  {flightLines.map((l, i) => (
                    <p key={i} className="text-[13px] font-semibold uppercase tracking-wider text-white/90">{l}</p>
                  ))}
                </div>
              )}
              {fare.baggage && (
                <p className="mt-3 text-[13px] font-bold uppercase tracking-wider text-white/80">
                  Baggage {fare.baggage}
                </p>
              )}
              {pnrs.length > 0 && (
                <p className="mt-2 flex flex-wrap gap-1.5">
                  {pnrs.map((p) => (
                    <span key={p} className="rounded bg-gold/20 px-2 py-0.5 text-xs font-black tracking-wider text-gold ring-1 ring-gold/40">
                      PNR {p}
                    </span>
                  ))}
                </p>
              )}
            </div>
          </div>

          {/* Right: seat counters + vendor fare */}
          <div className="flex flex-wrap items-stretch gap-3">
            <Stat label="Total Seats" value={total || "—"} />
            <Stat label="Sold" value={sold} tone="warn" />
            <Stat label="Available" value={available} tone="ok" />
            <div className="rounded-lg bg-white/5 px-5 py-3 text-center ring-1 ring-white/15 min-w-[110px]">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/60">Vendor Fare</p>
              <p className="font-serif text-2xl font-black text-gold">{fare.vendor_fare ? fmt(fare.vendor_fare) : "—"}</p>
              {fare.vendor_name && <p className="mt-0.5 text-[10px] uppercase tracking-widest text-white/60">{fare.vendor_name}</p>}
            </div>
            <div className="relative self-center">
              <button onClick={() => setMenu((v) => !v)} className="inline-flex items-center gap-2 rounded-md border border-white/20 px-3 py-2 text-xs font-semibold hover:bg-white/10">
                <Download className="h-3.5 w-3.5" /> Download group
              </button>
              {menu && (
                <div className="absolute right-0 top-full z-50 mt-1 w-48 overflow-hidden rounded-md bg-white text-navy shadow-xl ring-1 ring-black/10">
                  <p className="border-b border-border px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">This group only</p>
                  <button onClick={async () => { setMenu(false); await onExport("xlsx"); }} className="block w-full px-3 py-2 text-left text-xs font-semibold hover:bg-secondary">📊 Excel (.xlsx)</button>
                  <button onClick={async () => { setMenu(false); await onExport("csv"); }} className="block w-full px-3 py-2 text-left text-xs font-semibold hover:bg-secondary">📋 CSV (Google Sheets)</button>
                  <button onClick={async () => { setMenu(false); await onExport("pdf"); }} className="block w-full px-3 py-2 text-left text-xs font-semibold hover:bg-secondary">📄 PDF (.pdf)</button>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>


      <PassengersTable passengers={passengers} onSave={onSave} />
    </section>
  );
}

function Stat({ label, value, tone }: { label: string; value: number | string; tone?: "ok" | "warn" }) {
  const color = tone === "ok" ? "text-emerald-300" : tone === "warn" ? "text-amber-300" : "text-white";
  return (
    <div className="rounded-md bg-white/10 px-3 py-2 text-center ring-1 ring-white/20 min-w-[86px]">
      <p className="text-[10px] uppercase tracking-widest text-white/60">{label}</p>
      <p className={`font-serif text-xl font-black ${color}`}>{value}</p>
    </div>
  );
}

function PassengersTable({
  passengers, onSave,
}: {
  passengers: SelfGroupPassenger[];
  onSave: (id: string, patch: Partial<SelfGroupPassenger>) => Promise<void>;
}) {

  return (
    <>
      <div className="border-y border-amber-300 bg-amber-50 px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-amber-900">
        ⚠ Reconfirm pax name as per passport and ticket print given
      </div>
    <div className="overflow-x-auto">

      <table className="w-full min-w-[1150px] border-collapse text-xs">
        <thead className="bg-emerald-700 text-white">
          <tr className="[&>th]:px-2 [&>th]:py-2 [&>th]:text-left [&>th]:font-bold [&>th]:uppercase [&>th]:tracking-wider [&>th]:border-r [&>th]:border-emerald-500/40">
            <th className="w-[50px] text-center">Sr #</th>
            <th className="w-[70px]">Title</th>
            <th>FirstName</th>
            <th>LastName</th>
            <th className="w-[130px]">DateOfBirth</th>
            <th className="w-[110px]">Nationality</th>
            <th className="w-[130px]">IssuedByCountry</th>
            <th className="w-[110px]">DocumentType</th>
            <th className="w-[150px]">DocumentNumber</th>
            <th className="w-[130px]">ExpireDate</th>
          </tr>
        </thead>
        <tbody>
          {passengers.length === 0 && (
            <tr><td colSpan={10} className="p-6 text-center text-muted-foreground">No passengers yet. Add a Self-Group Ticket in Group Tickets and it will land here automatically.</td></tr>
          )}
          {passengers.map((p, idx) => (
            <PaxRow key={p.id} p={p} sr={idx + 1} onSave={onSave} />
          ))}
        </tbody>
      </table>
    </div>
    </>
  );

}

function PaxRow({
  p, sr, onSave,
}: {
  p: SelfGroupPassenger;
  sr: number;
  onSave: (id: string, patch: Partial<SelfGroupPassenger>) => Promise<void>;
}) {

  const [row, setRow] = useState<SelfGroupPassenger>(p);
  const [saving, setSaving] = useState(false);

  function set<K extends keyof SelfGroupPassenger>(k: K, v: SelfGroupPassenger[K]) {
    setRow((r) => ({ ...r, [k]: v }));
  }
  async function commit() {
    setSaving(true);
    try {
      await onSave(p.id, {
        title: row.title, first_name: row.first_name, last_name: row.last_name,
        dob: row.dob, nationality: row.nationality, issued_by_country: row.issued_by_country,
        doc_type: row.doc_type, doc_number: row.doc_number, expire_date: row.expire_date,
        pnr: row.pnr, sector: row.sector, fare_id: row.fare_id, ticket_id: row.ticket_id,
      });
    } finally {
      setSaving(false);
    }
  }

  const cell = "w-full rounded border border-transparent bg-transparent px-1.5 py-1 text-xs outline-none focus:border-gold focus:bg-white focus:ring-1 focus:ring-gold/30";
  const lockedCell = "w-full rounded border border-transparent bg-transparent px-1.5 py-1 text-xs cursor-not-allowed select-none";
  const lockedClick = () => alert("Please change data from Group Tickets first — data here will update automatically.");
  return (
    <tr className={`border-b border-border hover:bg-secondary/40 ${saving ? "opacity-70" : ""}`}>
      <td className="p-1 text-center text-xs font-bold text-muted-foreground">{sr}</td>
      <td className="p-1" onClick={lockedClick}>
        <div className={`${lockedCell} font-semibold`}>{row.title}</div>
      </td>
      <td className="p-1" onClick={lockedClick}>
        <div className={`${lockedCell} font-semibold uppercase`}>{row.first_name}</div>
      </td>
      <td className="p-1" onClick={lockedClick}>
        <div className={`${lockedCell} font-semibold uppercase`}>{row.last_name}</div>
      </td>
      <td className="p-1"><input type="date" value={row.dob ?? ""} onChange={(e) => set("dob", e.target.value || null)} onBlur={commit} className={cell} /></td>
      <td className="p-1"><input value={row.nationality} onChange={(e) => set("nationality", e.target.value.toUpperCase())} onBlur={commit} className={cell} /></td>
      <td className="p-1"><input value={row.issued_by_country} onChange={(e) => set("issued_by_country", e.target.value.toUpperCase())} onBlur={commit} className={cell} /></td>
      <td className="p-1">
        <select value={row.doc_type} onChange={(e) => set("doc_type", e.target.value)} onBlur={commit} className={cell}>
          {DOC_TYPES.map((t) => <option key={t}>{t}</option>)}
        </select>
      </td>
      <td className="p-1"><input value={row.doc_number} onChange={(e) => set("doc_number", e.target.value.toUpperCase())} onBlur={commit} className={`${cell} font-mono`} /></td>
      <td className="p-1"><input type="date" value={row.expire_date ?? ""} onChange={(e) => set("expire_date", e.target.value || null)} onBlur={commit} className={cell} /></td>
    </tr>
  );
}

