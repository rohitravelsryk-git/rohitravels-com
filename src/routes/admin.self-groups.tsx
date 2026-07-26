import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { LogOut, Trash2, Users, Download } from "lucide-react";
import { AdminHeaderExtras } from "@/components/AdminHeaderExtras";
import { AdminTabs } from "@/components/AdminTabs";
import {
  adminLogout,
  checkAdminUnlocked,
  listFaresAdmin,
  type Fare,
} from "@/lib/fares.functions";
import { listTickets, type GroupTicket } from "@/lib/tickets.functions";
import {
  listSelfGroupPassengers,
  updateSelfGroupPassenger,
  deleteSelfGroupPassenger,
  type SelfGroupPassenger,
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
  const remove = useServerFn(deleteSelfGroupPassenger);

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

  function exportCsv() {
    const rows = [
      ["Sr", "Title", "FirstName", "LastName", "DateOfBirth", "Nationality", "IssuedByCountry", "DocumentType", "DocumentNumber", "ExpireDate", "PNR", "Sector"],
      ...passengers.map((p, i) => [
        String(i + 1),
        p.title, p.first_name, p.last_name, p.dob ?? "",
        p.nationality, p.issued_by_country, p.doc_type, p.doc_number, p.expire_date ?? "",
        p.pnr, p.sector,
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => {
      const s = String(c ?? "");
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(",")).join("\n");
    // Prepend BOM so Excel opens UTF-8 correctly
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `self-group-passengers-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
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
            <button onClick={exportCsv} className="inline-flex items-center gap-2 rounded-md border border-white/20 px-3 py-2 text-xs font-semibold hover:bg-white/10">
              <Download className="h-3.5 w-3.5" /> Download Excel
            </button>
            <a href="/" className="rounded-md border border-white/20 px-3 py-2 text-xs font-semibold hover:bg-white/10">View site</a>
            <button onClick={onLogout} className="inline-flex items-center gap-2 rounded-md bg-gold px-3 py-2 text-xs font-bold text-gold-foreground">
              <LogOut className="h-3.5 w-3.5" /> Logout
            </button>
          </div>
        </div>
        <AdminTabs />
      </header>

      <div className="mx-auto max-w-[1600px] px-4 py-6 space-y-6">
        {selfFares.length === 0 && (
          <div className="rounded-xl bg-card p-8 text-center text-sm text-muted-foreground ring-1 ring-border">
            No <b>Self Group</b> fares yet. Open <Link to="/admin" className="text-navy underline">Group Fares</Link>, add a fare, and set <b>Group Type</b> to <b>Self Group</b>.
          </div>
        )}

        {selfFares.map((f) => {
          const fareTickets = ticketsForFare(f);
          const pax = passengersForFare(f);
          const total = parseInt(f.seats || "0", 10) || 0;
          const sold = fareTickets.length;
          const available = Math.max(total - sold, 0);
          const pnrs = Array.from(new Set(fareTickets.map((t) => t.pnr).filter(Boolean)));
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
              onDelete={async (id) => { if (!confirm("Delete this passenger?")) return; await remove({ data: { id } }); await refetch(); }}
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
                onDelete={async (id) => { if (!confirm("Delete this passenger?")) return; await remove({ data: { id } }); await refetch(); }}
              />
            </section>
          );
        })()}
      </div>

    </div>
  );
}

function FareDashboard({
  fare, passengers, total, sold, available, pnrs, onSave, onDelete,
}: {
  fare: Fare;
  passengers: SelfGroupPassenger[];
  total: number;
  sold: number;
  available: number;
  pnrs: string[];
  onSave: (id: string, patch: Partial<SelfGroupPassenger>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
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
          </div>
        </div>
      </div>


      <PassengersTable passengers={passengers} onSave={onSave} onDelete={onDelete} />
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
  passengers, onSave, onDelete,
}: {
  passengers: SelfGroupPassenger[];
  onSave: (id: string, patch: Partial<SelfGroupPassenger>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
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

