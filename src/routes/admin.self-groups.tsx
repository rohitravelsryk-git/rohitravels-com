import { createFileRoute, Link, useRouter, useNavigate } from "@tanstack/react-router";
import { useServerFn, createServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { LogOut, Users, Download, Trash2, KeyRound } from "lucide-react";
import { AdminHeaderExtras } from "@/components/AdminHeaderExtras";
import { AdminTabs } from "@/components/AdminTabs";
import { GroupsAppliedPanel, fmtDate, fmtDateShort } from "@/components/GroupsAppliedDialog";

import {
  adminLogout,
  checkAdminUnlocked,
  listFaresAdmin,
  type Fare,
  verifyAdminPassword,
  deleteFare,
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

function Page() {
  const { data: status, isLoading } = useQuery({
    queryKey: ["admin", "status"],
    queryFn: () => checkAdminUnlocked(),
  });
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; type: "self" | "party" } | null>(null);
  const [deletePassword, setDeletePassword] = useState("");
  const [busyDelete, setBusyDelete] = useState(false);
  const [deleteErr, setDeleteErr] = useState<string | null>(null);
  const checkPw = useServerFn(verifyAdminPassword);
  const deleteFareFn = useServerFn(deleteFare);
  const qc = useQueryClient();
  const router = useRouter();

  async function doDelete() {
    if (!confirmDelete || !deletePassword) return;
    setBusyDelete(true);
    setDeleteErr(null);
    try {
      const { ok } = await checkPw({ data: { password: deletePassword } });
      if (!ok) {
        setDeleteErr("Incorrect admin password.");
        return;
      }
      await deleteFareFn({ data: { id: confirmDelete.id } });
      await qc.invalidateQueries({ queryKey: ["fares", "admin"] });
      setConfirmDelete(null);
      setDeletePassword("");
    } catch (e: any) {
      setDeleteErr(e.message || "Deletion failed.");
    } finally {
      setBusyDelete(false);
    }
  }

  if (isLoading) return <div className="p-10 text-center text-muted-foreground">Loading…</div>;
  if (!status?.unlocked) {
    return (
      <div className="p-10 text-center">
        <p className="text-sm">Admin session required.</p>
        <Link to="/admin" className="mt-3 inline-block rounded bg-navy px-4 py-2 text-xs font-bold text-navy-foreground">Go to Admin</Link>
      </div>
    );
  }
  return (
    <>
      <Panel onConfirmDelete={(id, type) => setConfirmDelete({ id, type })} />
      {confirmDelete && (
        <DeleteModal 
          confirmDelete={confirmDelete}
          setConfirmDelete={setConfirmDelete}
          deletePassword={deletePassword}
          setDeletePassword={setDeletePassword}
          deleteErr={deleteErr}
          setDeleteErr={setDeleteErr}
          busyDelete={busyDelete}
          doDelete={doDelete}
        />
      )}
    </>
  );
}

function DeleteModal({ 
  confirmDelete, setConfirmDelete, deletePassword, setDeletePassword, 
  deleteErr, setDeleteErr, busyDelete, doDelete 
}: any) {
  
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-navy/80 p-4 backdrop-blur-md">
      <div className="w-full max-w-md rounded-2xl bg-background p-6 shadow-2xl ring-1 ring-gold/30">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <Trash2 className="h-8 w-8" />
          </div>
          <h3 className="font-serif text-2xl font-black text-navy">Confirm Deletion</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            You are about to delete a <span className="font-bold uppercase text-navy">{confirmDelete.type}</span> fare.
            Please enter the <span className="font-bold text-navy">Admin Password</span> to proceed.
          </p>
        </div>
        <div className="space-y-4">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">
              <KeyRound className="h-4 w-4" />
            </div>
            <input
              type="password"
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
              placeholder="Admin Password"
              className="w-full rounded-xl border border-border bg-card py-3 pl-10 pr-4 text-sm font-semibold focus:border-gold focus:ring-1 focus:ring-gold/30"
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && doDelete()}
            />
          </div>
          {deleteErr && (
            <div className="rounded-lg bg-destructive/10 px-3 py-2 text-center text-xs font-bold text-destructive ring-1 ring-destructive/20">
              {deleteErr}
            </div>
          )}
          <div className="flex gap-3">
            <button
              onClick={() => { setConfirmDelete(null); setDeletePassword(""); setDeleteErr(null); }}
              className="flex-1 rounded-xl border border-border bg-card py-3 text-sm font-black uppercase tracking-wider text-muted-foreground hover:bg-secondary"
            >
              Cancel
            </button>
            <button
              onClick={doDelete}
              disabled={busyDelete || !deletePassword}
              className="flex-1 rounded-xl bg-destructive py-3 text-sm font-black uppercase tracking-wider text-white shadow-lg hover:opacity-90 disabled:opacity-50"
            >
              {busyDelete ? "Deleting…" : "Delete Fare"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Panel({ onConfirmDelete }: { onConfirmDelete: (id: string, type: "self" | "party") => void }) {
  const qc = useQueryClient();
  const router = useRouter();
  const logout = useServerFn(adminLogout);

  const { data: fares = [] } = useQuery<Fare[]>({ queryKey: ["fares", "admin", "all"], queryFn: () => listFaresAdmin({ data: { includeDeleted: true } }) });
  const { data: tickets = [] } = useQuery<GroupTicket[]>({ queryKey: ["tickets"], queryFn: () => listTickets() });
  const { data: passengers = [] } = useQuery<SelfGroupPassenger[]>({
    queryKey: ["self-group-pax"],
    queryFn: () => listSelfGroupPassengers(),
  });
  const { data: applications = [] } = useQuery<SelfGroupApplication[]>({
    queryKey: ["self-group-applications"],
    queryFn: () => listSelfGroupApplications(),
  });
  const appByFare = useMemo(() => {
    const m = new Map<string, SelfGroupApplication>();
    for (const a of applications) if (a.fare_id) m.set(a.fare_id, a);
    return m;
  }, [applications]);

  const update = useServerFn(updateSelfGroupPassenger);


  const selfFares = useMemo(() => {
    // Current logic uses includeDeleted: true in the listFaresAdmin call at line 169
    // We sort such that fully sold groups go to the bottom (or could be moved to a "Sold" section)
    return fares.filter((f) => f.group_type === "self");
  }, [fares]);

  const sortedFares = useMemo(() => {
    const active: Fare[] = [];
    const soldOut: Fare[] = [];
    
    for (const f of selfFares) {
      const ft = tickets.filter(t => t.group_type === "self" && t.fare_id === f.id);
      const sold = ft.reduce((s, t) => s + (Number(t.seats) || 1), 0);
      const total = parseSeatsTotal(f.seats);
      if (total > 0 && sold >= total) soldOut.push(f);
      else active.push(f);
    }
    return [...active, ...soldOut];
  }, [selfFares, tickets]);

  // Add helper for parsing total seats if not already available in this scope
  function parseSeatsTotal(seats: string | null | undefined): number {
    if (!seats) return 0;
    const m = String(seats).match(/(\d+)\s*(?:out of|of|\/)\s*(\d+)/i);
    if (m) return parseInt(m[2], 10) || 0;
    const n = parseInt(String(seats).replace(/[^0-9]/g, ""), 10);
    return Number.isFinite(n) ? n : 0;
  }

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
    const o = (f.origin_code || f.origin).toUpperCase();
    const d = (f.destination_code || f.destination).toUpperCase();
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
  const visibleFares = sortedFares.filter((f) => isSelected(f.id));

  const appliedPrefills = useMemo(
    () =>
      selfFares.map((f) => ({
        label: `${(f.origin_code || f.origin).toUpperCase()} → ${(f.destination_code || f.destination).toUpperCase()} · ${f.airline}`,
        airline: f.airline,
        origin: (f.origin || f.origin_code).toUpperCase(),
        destination: (f.destination || f.destination_code).toUpperCase(),
        flight_details: f.flight_details ?? "",
        luggage: f.baggage ?? "",
        meal: f.meal ?? "Not Included",
        seats: parseInt(String(f.seats || "").replace(/[^0-9]/g, ""), 10) || 0,
        fare_id: f.id,
      })),
    [selfFares],
  );

  const exportRows = (list: SelfGroupPassenger[]) => [
    ["SR NO", "TITLE", "GIVEN NAME", "SURNAME", "DATE OF BIRTH", "DOCUMENT NUMBER", "EXPIRE DATE"],
    ...list.map((p, i) => [
      String(i + 1),
      p.title, p.first_name, p.last_name, fmtDate(p.dob),
      p.doc_number, fmtDate(p.expire_date),
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

  type ExportMeta = {
    airline: string;
    route: string;
    flightLines: string[];
    baggage: string;
    pnr: string;
    total: number | string;
    sold: number | string;
    available: number | string;
    fare: string;
  };

  async function exportList(
    kind: "xlsx" | "csv" | "pdf",
    list: SelfGroupPassenger[],
    fileName: string,
    title: string,
    meta?: ExportMeta,
  ) {
    const rows = exportRows(list);
    const infoRows: string[][] = meta
      ? [
          ["ROHI INTERNATIONAL TRAVELS — SELF GROUP"],
          [meta.airline],
          [meta.route],
          ...meta.flightLines.map((l) => [l]),
          [meta.baggage ? `BAGGAGE ${meta.baggage}` : ""],
          [`PNR: ${meta.pnr || "—"}`],
          [`TOTAL SEATS: ${meta.total}`, `SOLD: ${meta.sold}`, `AVAILABLE: ${meta.available}`, `FARE: ${meta.fare}`],
          ["⚠ RECONFIRM PAX NAME AS PER PASSPORT AND TICKET PRINT GIVEN"],
          [""],
        ].filter((r) => r.join("").trim() !== "")
      : [];

    if (kind === "csv") {
      const csv = [...infoRows, ...rows].map((r) => r.map((c) => {
        const s = String(c ?? "");
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
      }).join(",")).join("\n");
      downloadBlob(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }), `${fileName}.csv`);
      return;
    }
    if (kind === "xlsx") {
      const XLSX = await import("xlsx");
      const ws = XLSX.utils.aoa_to_sheet([...infoRows, ...rows]);
      ws["!cols"] = rows[0].map((_, i) => ({ wch: i === 0 ? 7 : i === 2 || i === 3 ? 18 : 16 }));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Passengers");
      const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
      downloadBlob(new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `${fileName}.xlsx`);
      return;
    }

    const { default: jsPDF } = await import("jspdf");
    const autoTable = (await import("jspdf-autotable")).default;
    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    const W = doc.internal.pageSize.getWidth();
    let y = 24;

    if (meta) {
      // Dark navy header block, mirroring the on-screen dashboard card.
      const h = 118;
      doc.setFillColor(11, 16, 36);
      doc.roundedRect(24, y, W - 48, h, 6, 6, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(8);
      doc.text(meta.airline.toUpperCase(), 44, y + 24);
      doc.setFontSize(20);
      doc.setFont("times", "bold");
      doc.text(meta.route, 44, y + 48);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      let ly = y + 66;
      for (const l of meta.flightLines) { doc.text(l.toUpperCase(), 44, ly); ly += 13; }
      if (meta.baggage) { doc.text(`BAGGAGE ${meta.baggage.toUpperCase()}`, 44, ly + 4); }

      // Right side stats
      const stats: [string, string][] = [
        ["TOTAL SEATS", String(meta.total)],
        ["SOLD", String(meta.sold)],
        ["AVAILABLE", String(meta.available)],
        ["FARE", meta.fare],
      ];
      let sx = W - 48 - stats.length * 92;
      for (const [label, value] of stats) {
        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(255, 255, 255);
        doc.roundedRect(sx, y + 58, 84, 44, 4, 4, "S");
        doc.setFontSize(7);
        doc.setTextColor(200, 200, 210);
        doc.text(label, sx + 42, y + 74, { align: "center" });
        doc.setFontSize(13);
        doc.setTextColor(212, 175, 55);
        doc.text(value, sx + 42, y + 92, { align: "center" });
        sx += 92;
      }
      doc.setFontSize(9);
      doc.setTextColor(255, 255, 255);
      doc.text(`PNR : ${meta.pnr || "—"}`, W / 2 - 20, y + 30);
      y += h + 10;

      // Amber warning strip
      doc.setFillColor(254, 243, 199);
      doc.rect(24, y, W - 48, 18, "F");
      doc.setTextColor(146, 64, 14);
      doc.setFontSize(8);
      doc.text("⚠ RECONFIRM PAX NAME AS PER PASSPORT AND TICKET PRINT GIVEN", 32, y + 12);
      y += 22;
    } else {
      doc.setFontSize(14);
      doc.setTextColor(11, 16, 36);
      doc.text(title, 40, y + 12);
      doc.setFontSize(9);
      doc.text(fmtDate(new Date().toISOString().slice(0, 10)), 40, y + 28);
      y += 40;
    }

    autoTable(doc, {
      head: [rows[0]],
      body: rows.slice(1),
      startY: y,
      margin: { left: 24, right: 24 },
      styles: { fontSize: 7.5, cellPadding: 4, halign: "center", textColor: [17, 24, 39] },
      headStyles: { fillColor: [4, 120, 87], textColor: 255, halign: "center", fontStyle: "bold" },
      alternateRowStyles: { fillColor: [246, 248, 250] },
    });
    doc.save(`${fileName}.pdf`);
  }

  async function exportAs(kind: "xlsx" | "csv" | "pdf") {
    setShowExport(false);
    await exportList(
      kind,
      passengers,
      `Self Group - All Passengers - ${fmtDateShort(new Date().toISOString().slice(0, 10))}`,
      "Self Group Passengers",
    );
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
        <div className="mb-4 flex items-center gap-2">
          <div className="inline-flex items-center gap-2 rounded-md bg-navy px-4 py-2 text-sm font-bold uppercase tracking-wider text-white">
            <Users className="h-4 w-4" /> Group Dashboards
            <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px]">{selfFares.length}</span>
          </div>
        </div>
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
                  <button onClick={() => setSelected(new Set(sortedFares.map((f) => f.id)))} className="rounded border border-white/20 px-2 py-0.5 text-[10px] font-semibold hover:bg-white/10">All</button>
                  <button onClick={() => setSelected(new Set())} className="rounded border border-white/20 px-2 py-0.5 text-[10px] font-semibold hover:bg-white/10">None</button>
                </div>
              </div>
              <ul className="max-h-[70vh] divide-y divide-border overflow-y-auto">
                {sortedFares.map((f) => {
                  const ft = tickets.filter(t => t.group_type === "self" && t.fare_id === f.id);
                  const soldCount = ft.reduce((s, t) => s + (Number(t.seats) || 1), 0);
                  const totalCount = parseSeatsTotal(f.seats);
                  const isSoldOut = totalCount > 0 && soldCount >= totalCount;

                  const lines = (f.flight_details || "")
                    .split(/\r?\n|\s*[,;/|]\s*/)
                    .map((s) => s.trim())
                    .filter(Boolean);
                  return (
                    <li key={f.id} className={isSoldOut ? "opacity-60 grayscale-[0.5]" : ""}>
                      <label className="flex cursor-pointer items-start gap-2 px-3 py-2 hover:bg-secondary/50">
                        <input type="checkbox" checked={isSelected(f.id)} onChange={() => toggle(f.id)} className="mt-1 h-3.5 w-3.5 accent-emerald-600" />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2">
                            <AirlineLogo name={f.airline} height={18} />
                            <span className="truncate font-serif text-sm font-black text-navy">
                              {(f.origin_code || f.origin).toUpperCase()} <span className="text-muted-foreground">→</span> {(f.destination_code || f.destination).toUpperCase()}
                            </span>
                            {isSoldOut && <span className="rounded bg-navy px-1.5 py-0.5 text-[9px] font-black text-white uppercase">Sold</span>}
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
              const match = seatsStr.match(/(\d+)\s+out\s+of\s+(\d+)/i);
              
              let total = 0;
              let available = 0;
              let sold = 0;

              if (match) {
                available = parseInt(match[1], 10);
                total = parseInt(match[2], 10);
                sold = Math.max(total - available, 0);
              } else {
                total = parseSeatsTotal(f.seats);
                sold = fareTickets.reduce((s, t) => s + (Number(t.seats) || 1), 0)
                  || new Set(pax.map((p) => p.ticket_id).filter(Boolean) as string[]).size;
                available = Math.max(total - sold, 0);
              }
              // PNR comes from the Groups Applied · Payment Status entry for this group
              // (falls back to the fare copy, then to confirmed group tickets).
              const app = appByFare.get(f.id);
              const appliedPnr = (app?.pnr || f.pnr || "").trim();
              const pnrs = appliedPnr
                ? [appliedPnr.toUpperCase()]
                : Array.from(new Set(fareTickets.map((t) => t.pnr).filter(Boolean)));
              const fromCode = (f.origin_code || f.origin).toUpperCase();
              const toCode = (f.destination_code || f.destination).toUpperCase();
              const groupDate = fmtDateShort(app?.flight_date ?? null) || (f.flight_date || "").toUpperCase();
              const fileName = `Self Group - ${fromCode} - ${toCode}${groupDate ? ` - ${groupDate}` : ""}`;
              const flightLines = (f.flight_details || "")
                .split(/\r?\n|\s*[,;/|]\s*/).map((s) => s.trim()).filter(Boolean);
              return (
                <FareDashboard
                  key={f.id}
                  fare={f}
                  passengers={pax}
                  total={total}
                  sold={sold}
                  available={available}
                  pnrs={pnrs}
                  tickets={fareTickets}
                  onConfirmDelete={onConfirmDelete}
                  onSave={async (id, patch) => { await update({ data: { id, ...patch } }); await refetch(); }}
                  onExport={(kind) =>
                    exportList(
                      kind,
                      pax,
                      fileName,
                      `${f.origin.toUpperCase()} → ${f.destination.toUpperCase()} · ${f.airline}`,
                      {
                        airline: f.airline,
                        route: `${f.origin.toUpperCase()} → ${f.destination.toUpperCase()}`,
                        flightLines,
                        baggage: f.baggage ?? "",
                        pnr: pnrs.join(", "),
                        total: total || "—",
                        sold,
                        available,
                        fare: f.vendor_fare
                          ? Number(String(f.vendor_fare).replace(/[^0-9.]/g, "")).toLocaleString("en-US")
                          : "—",
                      },
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
  fare, passengers, total, sold, available, pnrs, onSave, onExport, onConfirmDelete, tickets,
}: {
  fare: Fare;
  passengers: SelfGroupPassenger[];
  total: number;
  sold: number;
  available: number;
  pnrs: string[];
  onSave: (id: string, patch: Partial<SelfGroupPassenger>) => Promise<void>;
  onExport: (kind: "xlsx" | "csv" | "pdf") => Promise<void>;
  onConfirmDelete: (id: string, type: "self" | "party") => void;
  tickets: GroupTicket[];
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
              <div className="flex items-center gap-3">
                <p className="font-serif text-3xl font-black tracking-wide leading-tight">
                  {fare.origin.toUpperCase()} <span className="text-white/80">→</span> {fare.destination.toUpperCase()}
                </p>
                <div className="flex flex-col items-center justify-center rounded-lg bg-white/10 px-2 py-1 ring-1 ring-white/20">
                  <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-gold/60">Fare ID</p>
                  <p className="font-mono text-[10px] font-black tracking-widest text-gold">{fare.id.slice(0, 8)}</p>
                </div>
              </div>
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
              <p className="mt-2 text-[9px] font-mono text-white/50">ID: {fare.id}</p>
            </div>
          </div>

          {/* Right: seat counters + Profit stats */}
          <div className="flex flex-wrap items-stretch gap-3">
            <div className="flex gap-3 pr-4 border-r border-white/10">
              <Stat label="Inventory" value={`${available} out of ${total}`} tone="ok" />
              <Stat label="Total Seats" value={total || "—"} />
              <Stat label="Sold" value={sold} tone="warn" />
            </div>
            
            {/* Profit Dashboard Section */}
            <div className="flex gap-3">
              <div className="rounded-lg bg-white/5 px-4 py-3 text-center ring-1 ring-white/15 min-w-[120px]">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/60">Purchase</p>
                <p className="font-serif text-lg font-black text-gold">
                  {fare.vendor_fare ? fmt(Math.round(Number(String(fare.vendor_fare).replace(/[^0-9.]/g, "")) * sold)) : "—"}
                </p>
              </div>

              <div className="rounded-lg bg-white/5 px-4 py-3 text-center ring-1 ring-white/15 min-w-[120px]">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/60">Sale</p>
                <p className="font-serif text-lg font-black text-emerald-400">
                  {(() => {
                    const saleSum = tickets.reduce((sum: number, t: any) => sum + (Number(t.sale) || 0), 0);
                    return fmt(Math.round(saleSum));
                  })()}
                </p>
              </div>

              <div className="rounded-lg bg-gold/10 px-4 py-3 text-center ring-1 ring-gold/30 min-w-[120px]">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gold/80">Profit</p>
                <p className="font-serif text-lg font-black text-gold">
                  {(() => {
                    const purchase = (Number(String(fare.vendor_fare ?? "0").replace(/[^0-9.]/g, "")) || 0) * sold;
                    const sale = tickets.reduce((sum: number, t: any) => sum + (Number(t.sale) || 0), 0);
                    return fmt(Math.round(sale - purchase));
                  })()}
                </p>
              </div>
            </div>

            <div className="flex flex-col items-center gap-2 self-center">
              <button onClick={() => onConfirmDelete(fare.id, "self")} className="inline-flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs font-semibold text-destructive hover:bg-destructive hover:text-white">
                <Trash2 className="h-3.5 w-3.5" /> Delete group
              </button>
              <div className="relative">
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

      <table className="w-full min-w-[820px] border-collapse text-xs">
        <thead className="bg-emerald-700 text-white">
          <tr className="[&>th]:px-2 [&>th]:py-2 [&>th]:text-left [&>th]:font-bold [&>th]:uppercase [&>th]:tracking-wider [&>th]:border-r [&>th]:border-emerald-500/40">
            <th className="w-[60px] text-center">SR NO</th>
            <th className="w-[70px]">TITLE</th>
            <th>GIVEN NAME</th>
            <th>SURNAME</th>
            <th className="w-[140px]">DATE OF BIRTH</th>
            <th className="w-[150px]">DOCUMENT NUMBER</th>
            <th className="w-[130px]">EXPIRE DATE</th>
          </tr>
        </thead>
        <tbody>
          {passengers.length === 0 && (
            <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">No passengers yet. Add a Self-Group Ticket in Group Tickets and it will land here automatically.</td></tr>
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
      <td className="p-1"><input value={row.doc_number} onChange={(e) => set("doc_number", e.target.value.toUpperCase())} onBlur={commit} className={`${cell} font-mono`} /></td>
      <td className="p-1"><input type="date" value={row.expire_date ?? ""} onChange={(e) => set("expire_date", e.target.value || null)} onBlur={commit} className={cell} /></td>
    </tr>
  );
}

