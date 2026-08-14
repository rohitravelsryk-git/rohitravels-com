import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  Plane, LogOut, Trash2, Plus, Search, X, Ticket, Stamp, Bell, Send, RefreshCw, Check, Upload,
} from "lucide-react";
import {
  listTickets, createTicket, updateTicket, deleteTicket,
  listNotifications, countUnreadNotifications, markNotificationsSeen,
  runTicketReminderScan, deriveFlightStatus,
  uploadTicketDoc, removeTicketDoc,
  type GroupTicket,
} from "@/lib/tickets.functions";
import { adminLogout, checkAdminUnlocked, listAgentsAdmin, listFares, listVendors } from "@/lib/fares.functions";
import { AdminHeaderExtras } from "@/components/AdminHeaderExtras";
import { AdminResetButton } from "@/components/AdminResetButton";
import { AdminTabs } from "@/components/AdminTabs";


export const Route = createFileRoute("/admin/tickets")({
  component: TicketsPage,
  head: () => ({
    meta: [
      { title: "Group Tickets · Rohi Admin" },
      { name: "description", content: "Manage group ticket bookings with reminders and notifications." },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
});

const STATUS_OPTIONS = ["FLIGHT IS FAR", "UPDATE NAME", "SCHEDULED", "FLOWN", "UPCOMMING", "BOOKED", "CANCELLED", "REFUNDED"];
const OTB_OPTIONS = ["YES", "NOT REQUIRED"];
const REMARK_OPTIONS = ["UPDATED", "PENDING", "PAID", "UNPAID"];

const REMINDER_WA = "923056622988";

type Draft = Omit<
  GroupTicket,
  "id" | "seq" | "profit" | "created_at" | "updated_at" | "reminder_24h_sent_at" | "reminder_72h_sent_at" | "attachments" | "booking_id"
>;

const EMPTY: Draft = {
  booking_date: new Date().toISOString().slice(0, 10),
  agent_name: "",
  agent_contact: "",
  pax_name: "",
  seats: 0,
  sector: "",
  pnr: "",
  airline: "",
  travel_at: "",
  flight_status: "BOOKED",
  otb: "NOT REQUIRED",
  contact: "",
  vendor: "",
  sale: 0,
  purchase: 0,
  ledger_entry: "",
  remarks: "UPDATED",
  group_type: "party",
};


function toLocalInput(iso: string | null | undefined) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fmtMoney(n: number) {
  return new Intl.NumberFormat("en-PK").format(Number(n || 0));
}
function fmtDate(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" });
}
function fmtDateTime(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleString("en-GB", { day: "2-digit", month: "short", year: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function waLink(t: GroupTicket) {
  const msg = `*Rohi Travels - Booking Reminder*\n\nPax: ${t.pax_name}\nSector: ${t.sector}\nAirline: ${t.airline}\nPNR: ${t.pnr}\nTravel: ${fmtDateTime(t.travel_at)}\nStatus: ${t.flight_status}${t.otb === "YES" ? " · OTB ✅" : ""}\nAgent: ${t.agent_name}`;
  const to = (t.contact || "").replace(/\D/g, "") || REMINDER_WA;
  return `https://wa.me/${to}?text=${encodeURIComponent(msg)}`;
}

function TicketsPage() {
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

  const { data: tickets = [] } = useQuery<GroupTicket[]>({
    queryKey: ["tickets"], queryFn: () => listTickets(),
  });
  const { data: agents = [] } = useQuery({
    queryKey: ["admin", "agents"], queryFn: () => listAgentsAdmin(),
  });
  const { data: fares = [] } = useQuery({
    queryKey: ["admin", "fares-lite"], queryFn: () => listFares(),
  });
  const { data: vendors = [] } = useQuery({
    queryKey: ["vendors"], queryFn: () => listVendors(),
  });
  // Flight options carry their group type, PNR and seat inventory so the ticket
  // form can filter by group type and auto-fill the PNR.
  const flightOptions = useMemo<FlightOption[]>(() => {
    const out: FlightOption[] = [];
    for (const f of fares as Array<{ flight_details: string | null; pnr?: string | null; seats?: string | null; group_type?: string | null }>) {
      const v = (f.flight_details || "").trim();
      if (!v) continue;
      for (const o of splitFlightOptions(v)) {
        if (out.some((x) => x.details === o)) continue;
        out.push({
          details: o,
          pnr: (f.pnr || "").trim(),
          seats: Number(String(f.seats ?? "").replace(/\D/g, "")) || 0,
          groupType: f.group_type === "self" ? "self" : "party",
        });
      }
    }
    return out;
  }, [fares]);


  const { data: unread } = useQuery({
    queryKey: ["tickets", "unread"], queryFn: () => countUnreadNotifications(),
    refetchInterval: 30_000,
  });
  const { data: notifs = [] } = useQuery({
    queryKey: ["tickets", "notifs"], queryFn: () => listNotifications(),
    refetchInterval: 30_000,
  });

  const create = useServerFn(createTicket);
  const upDoc = useServerFn(uploadTicketDoc);
  const rmDoc = useServerFn(removeTicketDoc);
  const update = useServerFn(updateTicket);
  const remove = useServerFn(deleteTicket);
  const markSeen = useServerFn(markNotificationsSeen);
  const scan = useServerFn(runTicketReminderScan);

  // Auto-scan every 5 min while admin panel is open + on mount
  useEffect(() => {
    scan().then(() => {
      qc.invalidateQueries({ queryKey: ["tickets", "unread"] });
      qc.invalidateQueries({ queryKey: ["tickets", "notifs"] });
    }).catch(() => {});
    const id = setInterval(() => {
      scan().then(() => {
        qc.invalidateQueries({ queryKey: ["tickets", "unread"] });
        qc.invalidateQueries({ queryKey: ["tickets", "notifs"] });
      }).catch(() => {});
    }, 5 * 60 * 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Request desktop notification permission once
  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  // Show a WhatsApp-style desktop popup for newly-arrived unseen notifications
  const [seenIds] = useState<Set<string>>(() => new Set());
  const [wapop, setWapop] = useState<{ id: string; title: string; body: string } | null>(null);
  useEffect(() => {
    const fresh = notifs.find((n) => !n.seen_at && !seenIds.has(n.id));
    if (!fresh) return;
    seenIds.add(fresh.id);
    setWapop({ id: fresh.id, title: fresh.title, body: fresh.body });
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
      try {
        const n = new Notification("WhatsApp · Rohi Travels", { body: fresh.title, tag: fresh.id });
        n.onclick = () => window.focus();
      } catch { /* ignore */ }
    }
  }, [notifs, seenIds]);

  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [showBell, setShowBell] = useState(false);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Draft>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [uploadingId, setUploadingId] = useState<string | null>(null);

  async function toBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result).split(",")[1] ?? "");
      r.onerror = reject;
      r.readAsDataURL(file);
    });
  }

  async function onDocFiles(id: string, kind: "visa" | "passport", files: FileList | null) {
    if (!files || !files.length) return;
    setUploadingId(`${id}:${kind}`);
    setBusy(true);
    try {
      const up = useServerFn(uploadTicketDoc);
      for (const file of Array.from(files)) {
        if (file.size > 10 * 1024 * 1024) throw new Error(`${file.name} is larger than 10MB`);
        const base64 = await toBase64(file);
        await up({ data: { id, kind, name: file.name, type: file.type || "application/pdf", base64 } });
      }
    } catch (e: any) { alert(e.message); } finally { setUploadingId(null); setBusy(false); qc.invalidateQueries({ queryKey: ["tickets"] }); }
  }

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return tickets.filter((t) => {
      // Compare against the status actually shown in the table (auto-derived
      // from travel date, falling back to the stored value).
      const shown = deriveFlightStatus(t.travel_at || deriveTravelAtFromFlight(t.sector || "")) || t.flight_status;
      if (statusFilter !== "ALL" && shown !== statusFilter) return false;
      if (!s) return true;
      return [t.agent_name, t.pax_name, t.sector, t.pnr, t.airline, t.contact, t.vendor, t.ledger_entry, t.remarks]
        .join(" ").toLowerCase().includes(s);
    });
  }, [tickets, q, statusFilter]);

  const totals = useMemo(() => {
    return filtered.reduce(
      (a, t) => ({ sale: a.sale + Number(t.sale || 0), purchase: a.purchase + Number(t.purchase || 0), profit: a.profit + Number(t.profit || 0) }),
      { sale: 0, purchase: 0, profit: 0 },
    );
  }, [filtered]);

  useEffect(() => {
    if (showBell && (unread?.unread ?? 0) > 0) {
      markSeen({ data: {} }).then(() => qc.invalidateQueries({ queryKey: ["tickets", "unread"] }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showBell]);

  function toPayload(d: Draft) {
    return {
      ...d,
      booking_date: d.booking_date || null,
      travel_at: d.travel_at ? new Date(d.travel_at).toISOString() : null,
      sale: Number(d.sale || 0),
      purchase: Number(d.purchase || 0),
    };
  }
  async function onAdd() {
    if (!draft.pax_name && !draft.pnr) return alert("Add at least a Passenger name or PNR.");
    setBusy(true);
    try {
      await create({ data: toPayload(draft) });
      await qc.invalidateQueries({ queryKey: ["tickets"] });
      setDraft(EMPTY);
      setShowAdd(false);
    } catch (e) { alert((e as Error).message); }
    finally { setBusy(false); }
  }
  function startEdit(t: GroupTicket) {
    setEditingId(t.id);
    setEditDraft({
      booking_date: t.booking_date ?? "",
      agent_name: t.agent_name, agent_contact: t.agent_contact ?? "",
      pax_name: t.pax_name, seats: t.seats ?? 0, sector: t.sector, pnr: t.pnr,
      airline: t.airline, travel_at: toLocalInput(t.travel_at),
      flight_status: t.flight_status, otb: t.otb, contact: t.contact, vendor: t.vendor,
      sale: t.sale, purchase: t.purchase, ledger_entry: t.ledger_entry, remarks: t.remarks,
      group_type: t.group_type || "party",
    });
  }
  async function saveEdit() {
    if (!editingId) return;
    setBusy(true);
    try {
      await update({ data: { id: editingId, ...toPayload(editDraft) } });
      await qc.invalidateQueries({ queryKey: ["tickets"] });
      setEditingId(null);
    } catch (e) { alert((e as Error).message); }
    finally { setBusy(false); }
  }
  async function onDelete(id: string) {
    if (!confirm("Delete this ticket?")) return;
    await remove({ data: { id } });
    await qc.invalidateQueries({ queryKey: ["tickets"] });
  }
  async function runScan() {
    const r = await scan();
    await qc.invalidateQueries({ queryKey: ["tickets"] });
    await qc.invalidateQueries({ queryKey: ["tickets", "unread"] });
    await qc.invalidateQueries({ queryKey: ["tickets", "notifs"] });
    alert(`Scanned ${r.scanned} upcoming tickets. Created ${r.created} reminder(s).`);
  }
  async function onLogout() { await logout(); router.navigate({ to: "/admin" }); }

  const unreadCount = unread?.unread ?? 0;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-navy text-navy-foreground">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <Plane className="h-5 w-5 -rotate-45 text-gold" />
            <div>
              <p className="font-serif text-lg font-black">Group Tickets</p>
              <p className="text-[10px] tracking-widest text-white/60">Bookings ledger · Reminders · Notifications</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
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
        <div className="mb-4 flex items-center gap-2">
          <div className="inline-flex items-center gap-2 rounded-md bg-navy px-4 py-2 text-sm font-bold uppercase tracking-wider text-white">
            <Ticket className="h-4 w-4" /> Group Tickets Confirmed
            <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px]">{filtered.length}</span>
          </div>
          <div className="ml-auto flex gap-2">
            <AdminResetButton
              target="group_tickets"
              label="Reset"
              numbering="SR #"
              onDone={() => { void qc.invalidateQueries({ queryKey: ["tickets"] }); }}
            />
          </div>
        </div>
        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-4">
          <StatCard label="Total Tickets" value={String(filtered.length)} />
          <StatCard label="Sale" value={fmtMoney(totals.sale)} tone="navy" />
          <StatCard label="Purchase" value={fmtMoney(totals.purchase)} tone="muted" />
          <StatCard label="Profit" value={fmtMoney(totals.profit)} tone="green" />
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl bg-card p-3 ring-1 ring-border">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={q} onChange={(e) => setQ(e.target.value)}
              placeholder="Search agent, pax, sector, PNR, airline, vendor…"
              className="w-full rounded-md border border-input bg-background py-2 pl-9 pr-9 text-sm outline-none focus:border-gold focus:ring-2 focus:ring-gold/30"
            />
            {q && <button onClick={() => setQ("")} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-secondary"><X className="h-3.5 w-3.5" /></button>}
          </div>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-md border border-input bg-background px-3 py-2 text-sm">
            <option value="ALL">All statuses</option>
            {STATUS_OPTIONS.map((s) => <option key={s}>{s}</option>)}
          </select>
          <button
            onClick={() => setShowAdd((v) => !v)}
            className="inline-flex items-center gap-2 rounded-md bg-navy px-3 py-2 text-xs font-bold text-navy-foreground hover:opacity-95"
          >
            <Plus className="h-3.5 w-3.5" /> {showAdd ? "Close" : "Add ticket"}
          </button>
        </div>

        {showAdd && (
          <div className="mb-4 rounded-xl bg-card p-4 ring-1 ring-border">
            <h2 className="mb-3 font-serif text-sm font-black text-navy">New Ticket</h2>
            <TicketForm draft={draft} setDraft={setDraft} agents={agents} vendors={vendors} flightOptions={flightOptions} />
            <div className="mt-3 flex justify-end gap-2">
              <button onClick={() => { setDraft(EMPTY); setShowAdd(false); }} className="rounded-md border border-input px-3 py-2 text-xs font-semibold">Cancel</button>
              <button disabled={busy} onClick={onAdd} className="rounded-md bg-gold px-4 py-2 text-xs font-bold text-gold-foreground disabled:opacity-60">
                {busy ? "Saving…" : "Save ticket"}
              </button>
            </div>
          </div>
        )}

        <div className="overflow-x-auto rounded-xl bg-card ring-1 ring-border">
          <table className="w-full min-w-[2000px] table-fixed border-collapse text-[11.5px] [&_td]:align-top">
            <colgroup>
              <col style={{ width: 44 }} /><col style={{ width: 104 }} /><col style={{ width: 104 }} /><col style={{ width: 66 }} />
              <col style={{ width: 150 }} /><col style={{ width: 250 }} /><col style={{ width: 108 }} />
              <col style={{ width: 54 }} /><col style={{ width: 178 }} /><col style={{ width: 120 }} />
              <col style={{ width: 120 }} /><col style={{ width: 104 }} /><col style={{ width: 86 }} />
              <col style={{ width: 52 }} /><col style={{ width: 104 }} /><col style={{ width: 104 }} />
              <col style={{ width: 84 }} /><col style={{ width: 84 }} /><col style={{ width: 84 }} />
              <col style={{ width: 118 }} /><col style={{ width: 96 }} /><col style={{ width: 96 }} />
              <col style={{ width: 120 }} />{/* FARE ID */}
            </colgroup>
            <thead className="bg-navy text-navy-foreground">
              <tr>
                {["SR #", "BOOKING DATE", "BOOKING ID", "GROUP TYPE", "AGENCY NAME / CONTACT", "FLIGHT DETAILS", "TRAVEL DATE & TIME", "SEATS", "PASSENGER NAMES", "PASSPORT COPIES", "VISA COPIES / OTB", "AIRLINE", "PNR", "OTB", "PAX CONTACT", "VENDOR", "SALE", "PURCHASE", "PROFIT", "LEDGER ENTRY", "STATUS", "FARE ID", "ACTIONS"].map((h) => (
                  <th key={h} className="sticky top-0 z-10 bg-navy px-2 py-1.5 text-left align-bottom text-[10px] font-bold uppercase leading-tight tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={21} className="p-10 text-center text-sm text-muted-foreground">No tickets match your filters.</td></tr>
              )}
              {filtered.map((t) => {
                const isEditing = editingId === t.id;
                const travelIso = t.travel_at || deriveTravelAtFromFlight(t.sector || "");
                const shownStatus = deriveFlightStatus(travelIso) || t.flight_status;
                const hoursOut = travelIso ? (new Date(travelIso).getTime() - Date.now()) / 3600000 : Infinity;
                const rowTone = shownStatus === "UPDATE NAME"
                  ? "bg-orange-100 ring-2 ring-inset ring-orange-400"
                  : hoursOut < 0 ? "bg-gray-50" : hoursOut < 24 ? "bg-red-50" : hoursOut < 72 ? "bg-amber-50" : "";
                const atts = Array.isArray(t.attachments) ? t.attachments : [];
                const passports = atts.filter((a) => (a.kind ?? "passport") === "passport");
                const visas = atts.filter((a) => a.kind === "visa");
                if (isEditing) {
                  return (
                    <tr key={t.id} className="border-t border-border bg-gold/10">
                      <td colSpan={21} className="p-3">
                        <TicketForm draft={editDraft} setDraft={setEditDraft} agents={agents} vendors={vendors} flightOptions={flightOptions} />

                        <div className="mt-3 flex justify-end gap-2">
                          <button onClick={() => setEditingId(null)} className="rounded-md border border-input px-3 py-1 text-xs font-semibold">Cancel</button>
                          <button disabled={busy} onClick={saveEdit} className="inline-flex items-center gap-1 rounded-md bg-navy px-3 py-1 text-xs font-bold text-navy-foreground">
                            <Check className="h-3.5 w-3.5" /> Save
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                }
                return (
                  <tr key={t.id} className={`border-t border-border align-top ${rowTone} hover:bg-secondary/30`}>
                    <td className="px-2 py-1 font-semibold text-muted-foreground">{t.seq}</td>
                    <td className="whitespace-nowrap px-2 py-1">{fmtDateTime(t.created_at) || fmtDate(t.booking_date)}</td>
                    <td className="px-2 py-1 text-xs font-mono text-navy">{t.booking_id ? `BK-${t.booking_id.slice(0, 8).toUpperCase()}` : "—"}</td>
                    <td className="px-2 py-1">
                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${t.group_type === "self" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-700"}`}>
                        {t.group_type === "self" ? "SELF" : "PARTY"}
                      </span>
                    </td>
                    <td className="px-2 py-1">
                      <p className="font-semibold text-navy">{t.agent_name || "—"}</p>
                      {t.agent_contact && <p className="text-[10.5px] text-muted-foreground">{t.agent_contact}</p>}
                    </td>
                    <td className="px-3 py-1">
                      <div className="whitespace-pre-line font-mono text-[12px] font-bold leading-[1.35] tracking-tight text-navy">
                        {formatFlightSegments(t.sector) || "—"}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-2 py-1 font-semibold">{fmtDateTime(travelIso) || "—"}</td>
                    <td className="px-2 py-1 text-center font-black text-navy">{t.seats || "—"}</td>
                    <td className="px-2 py-1">
                      <div className="max-h-[56px] overflow-y-auto whitespace-pre-line break-words text-[11px] font-semibold leading-[1.35] text-navy">
                        {t.pax_name}
                      </div>
                    </td>
                     <td className="px-2 py-1">
                       <DocCell ticketId={t.id} kind="passport" files={passports} />
                       <div className="mt-1">
                         <label className="cursor-pointer rounded-sm bg-navy/5 px-1 py-0.5 text-[9px] font-bold text-navy hover:bg-navy/10">
                           Upload
                           <input type="file" multiple className="hidden" onChange={(e) => onDocFiles(t.id, "passport", e.target.files)} disabled={busy} />
                         </label>
                         {uploadingId === `${t.id}:passport` && <span className="ml-1 text-[9px] animate-pulse">...</span>}
                       </div>
                     </td>
                     <td className="px-2 py-1">
                       <DocCell ticketId={t.id} kind="visa" files={visas} />
                       <div className="mt-1">
                         <label className="cursor-pointer rounded-sm bg-navy/5 px-1 py-0.5 text-[9px] font-bold text-navy hover:bg-navy/10">
                           Upload
                           <input type="file" multiple className="hidden" onChange={(e) => onDocFiles(t.id, "visa", e.target.files)} disabled={busy} />
                         </label>
                         {uploadingId === `${t.id}:visa` && <span className="ml-1 text-[9px] animate-pulse">...</span>}
                       </div>
                     </td>
                    <td className="px-2 py-1 break-words">{t.airline}</td>
                    <td className="px-2 py-1 font-mono font-bold">{t.pnr}</td>
                    <td className="px-2 py-1">
                      <span className={`whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] font-bold ${t.otb === "YES" ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>{t.otb}</span>
                    </td>
                    <td className="px-2 py-1 break-words font-mono text-[11px]">{t.contact}</td>
                    <td className="px-2 py-1 break-words">{t.vendor}</td>
                    <td className="px-2 py-1 text-right">{fmtMoney(t.sale)}</td>
                    <td className="px-2 py-1 text-right">{fmtMoney(t.purchase)}</td>
                    <td className={`px-2 py-1 text-right font-bold ${Number(t.profit) >= 0 ? "text-emerald-600" : "text-red-600"}`}>{fmtMoney(t.profit)}</td>
                    <td className="px-2 py-1"><div className="max-h-[56px] overflow-y-auto whitespace-pre-line break-words text-[11px] leading-[1.35]">{t.ledger_entry}</div></td>
                    <td className="px-2 py-1"><StatusBadge s={deriveFlightStatus(travelIso) || t.flight_status} /></td>

                    <td className="px-2 py-1">
                      <div className="flex items-center gap-1">
                        <a href={waLink(t)} target="_blank" rel="noreferrer" className="rounded p-1 text-emerald-600 hover:bg-emerald-50" title="WhatsApp"><Send className="h-3.5 w-3.5" /></a>
                        <button onClick={() => startEdit(t)} className="rounded p-1 text-navy hover:bg-navy/10">Edit</button>
                        <button onClick={() => onDelete(t.id)} className="rounded p-1 text-red-600 hover:bg-red-50"><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {showBell && (
        <div className="fixed right-4 top-24 z-50 w-[380px] max-h-[70vh] overflow-hidden rounded-xl bg-white shadow-2xl ring-1 ring-black/10">
          <div className="flex items-center justify-between bg-navy px-4 py-3 text-navy-foreground">
            <p className="text-sm font-bold">Notifications</p>
            <button onClick={() => setShowBell(false)} className="rounded p-1 hover:bg-white/10"><X className="h-4 w-4" /></button>
          </div>
          <div className="max-h-[60vh] overflow-y-auto divide-y divide-border">
            {notifs.length === 0 && <p className="p-6 text-center text-xs text-muted-foreground">No notifications yet. Run "Scan reminders" to check.</p>}
            {notifs.map((n) => (
              <div key={n.id} className={`p-3 text-xs ${!n.seen_at ? "bg-amber-50" : ""}`}>
                <p className="font-bold text-navy">{n.title}</p>
                <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{n.body}</p>
                <p className="mt-1 text-[10px] uppercase tracking-widest text-muted-foreground">
                  {new Date(n.created_at).toLocaleString()} · {n.channels_sent?.length ? `sent: ${n.channels_sent.join(", ")}` : "in-app"}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {wapop && (
        <div className="fixed bottom-6 right-6 z-[10000] w-[360px] overflow-hidden rounded-xl bg-white shadow-2xl ring-1 ring-black/10 animate-in slide-in-from-bottom-4 fade-in duration-200">
          <div className="flex items-center gap-2 border-b border-gray-100 px-4 pt-3">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#25D366] text-white text-[11px] font-bold">W</span>
            <p className="text-xs font-semibold text-gray-700">WhatsApp</p>
            <button onClick={() => setWapop(null)} className="ml-auto rounded p-1 text-gray-400 hover:bg-gray-100"><X className="h-3.5 w-3.5" /></button>
          </div>
          <div className="flex gap-3 p-4">
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 font-bold">R</div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-gray-900">Rohi Travels · Reminder</p>
              <p className="mt-0.5 line-clamp-4 whitespace-pre-wrap text-[12px] text-gray-600">{wapop.body}</p>
              <div className="mt-2 flex gap-2">
                <a
                  href={`https://wa.me/923056622988?text=${encodeURIComponent(wapop.body)}`}
                  target="_blank" rel="noreferrer"
                  className="rounded bg-[#25D366] px-3 py-1 text-[11px] font-bold text-white hover:brightness-105"
                >Send on WhatsApp</a>
                <button onClick={() => setWapop(null)} className="rounded border border-gray-200 px-3 py-1 text-[11px] font-semibold text-gray-600 hover:bg-gray-50">Dismiss</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, tone }: { label: string; value: string; tone?: "navy" | "green" | "muted" }) {
  const c = tone === "green" ? "text-emerald-600" : tone === "navy" ? "text-navy" : tone === "muted" ? "text-muted-foreground" : "text-foreground";
  return (
    <div className="rounded-xl bg-card p-4 ring-1 ring-border">
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className={`mt-1 font-serif text-2xl font-black ${c}`}>{value}</p>
    </div>
  );
}
type TicketFile = { name: string; url?: string; path?: string };

/** Passport / Visa-OTB column: existing copies plus admin upload + delete. */
function DocCell({ ticketId, kind, files }: { ticketId: string; kind: "passport" | "visa"; files: TicketFile[] }) {
  const qc = useQueryClient();
  const upload = useServerFn(uploadTicketDoc);
  const removeDoc = useServerFn(removeTicketDoc);
  const [busy, setBusy] = useState(false);

  async function onPick(list: FileList | null) {
    if (!list?.length) return;
    setBusy(true);
    try {
      for (const file of Array.from(list)) {
        const base64 = await new Promise<string>((resolve, reject) => {
          const r = new FileReader();
          r.onload = () => resolve(String(r.result).split(",")[1] ?? "");
          r.onerror = () => reject(r.error);
          r.readAsDataURL(file);
        });
        await upload({ data: { id: ticketId, kind, name: file.name, type: file.type || "application/octet-stream", base64 } });
      }
      await qc.invalidateQueries({ queryKey: ["tickets"] });
    } catch (e) { alert((e as Error).message); }
    finally { setBusy(false); }
  }

  async function onRemove(path: string) {
    if (!confirm("Remove this file?")) return;
    setBusy(true);
    try {
      await removeDoc({ data: { id: ticketId, path } });
      await qc.invalidateQueries({ queryKey: ["tickets"] });
    } catch (e) { alert((e as Error).message); }
    finally { setBusy(false); }
  }

  return (
    <div className="flex min-w-[130px] flex-col gap-1">
      {files.map((f, i) => (
        <span key={i} className="flex items-center gap-1">
          <a href={f.url ?? "#"} target="_blank" rel="noreferrer" title={f.name}
            className="inline-block max-w-[110px] truncate rounded bg-sky-50 px-1.5 py-0.5 text-[10px] font-semibold text-sky-800 underline">
            {f.name}
          </a>
          {f.path && (
            <button onClick={() => onRemove(f.path!)} disabled={busy} className="rounded p-0.5 text-red-600 hover:bg-red-50" title="Remove">
              <X className="h-3 w-3" />
            </button>
          )}
        </span>
      ))}
      <label className={`inline-flex cursor-pointer items-center gap-1 self-start rounded border border-dashed border-navy/30 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-navy hover:bg-secondary ${busy ? "opacity-60" : ""}`}>
        <Upload className="h-3 w-3" /> {busy ? "…" : "Upload"}
        <input type="file" multiple accept="image/*,application/pdf" className="hidden" disabled={busy}
          onChange={(e) => { void onPick(e.target.files); e.currentTarget.value = ""; }} />
      </label>
    </div>
  );
}

function StatusBadge({ s }: { s: string }) {
  const map: Record<string, string> = {
    BOOKED: "bg-blue-100 text-blue-700",
    FLOWN: "bg-gray-200 text-gray-700",
    "FLIGHT IS FAR": "bg-amber-100 text-amber-700",
    "UPDATE NAME": "bg-orange-100 text-orange-700 ring-1 ring-orange-300",
    SCHEDULED: "bg-emerald-100 text-emerald-700",
    UPCOMMING: "bg-sky-100 text-sky-700",
    CANCELLED: "bg-red-100 text-red-700",
    REFUNDED: "bg-violet-100 text-violet-700",
  };
  return <span className={`whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] font-bold ${map[s] ?? "bg-gray-100 text-gray-600"}`}>{s || "—"}</span>;
}
function RemarkBadge({ r }: { r: string }) {
  const map: Record<string, string> = {
    UPDATED: "bg-emerald-100 text-emerald-700",
    PENDING: "bg-amber-100 text-amber-700",
    PAID: "bg-emerald-100 text-emerald-700",
    UNPAID: "bg-red-100 text-red-700",
  };
  return <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${map[r] ?? "bg-gray-100 text-gray-600"}`}>{r || "—"}</span>;
}

type AgentLite = { agency_name: string; contact_person: string; country_code: string; cell_number: string };
export function splitFlightSegments(s: string): string[] {
  const str = (s || "").toUpperCase().trim();
  if (!str) return [];
  const re = /\d{1,2}\s+[A-Z]{3}\s+[A-Z]{3}\s+[A-Z]{3}\s+\d{3,4}\s+\d{3,4}/g;
  const matches = str.match(re);
  return matches && matches.length
    ? matches.map((m) => m.replace(/\s+/g, " ").trim())
    : [str.replace(/[()]/g, "").replace(/\s+/g, " ").trim()];
}
// Each segment on its own line, no brackets.
export function formatFlightSegments(s: string): string {
  return splitFlightSegments(s).join("\n");
}

const MONTHS: Record<string, number> = {
  JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5,
  JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11,
};

/** Derive travel date & time from the first flight-details segment: "10 AUG MUX DXB 1120 1320". */
export function deriveTravelAtFromFlight(details: string): string | null {
  const seg = splitFlightSegments(details)[0];
  if (!seg) return null;
  const m = seg.match(/^(\d{1,2})\s+([A-Z]{3})\s+[A-Z]{3}\s+[A-Z]{3}\s+(\d{3,4})/);
  if (!m) return null;
  const mon = MONTHS[m[2]];
  if (mon === undefined) return null;
  const day = parseInt(m[1], 10);
  const t = m[3].padStart(4, "0");
  const now = new Date();
  const build = (y: number) =>
    new Date(y, mon, day, parseInt(t.slice(0, 2), 10), parseInt(t.slice(2), 10));
  let d = build(now.getFullYear());
  if (d.getTime() < now.getTime() - 60 * 86400000) d = build(now.getFullYear() + 1);
  return d.toISOString();
}

/** Group multi-date flight details into selectable options (connections stay together). */
export function splitFlightOptions(details: string): string[] {
  const raw = (details || "").split(/\s*\|\s*|\n+/).map((s) => s.trim()).filter(Boolean);
  const segs = raw.length > 1 ? raw : splitFlightSegments(details);
  if (segs.length <= 1) return segs;
  const codes = (s: string) => {
    const m = s.toUpperCase().match(/\b([A-Z]{3})\b\s+\b([A-Z]{3})\b\s+\d{3,4}/);
    return m ? { from: m[1], to: m[2] } : null;
  };
  const groups: string[][] = [];
  for (const seg of segs) {
    const cur = codes(seg);
    const last = groups[groups.length - 1];
    const prev = last ? codes(last[last.length - 1]) : null;
    if (last && cur && prev && cur.from === prev.to) last.push(seg);
    else groups.push([seg]);
  }
  return groups.map((g) => g.join("\n"));
}

function buildLedgerEntry(d: Draft) {
  const sector = formatFlightSegments(d.sector || "");
  const parts = ["GRP TKT", d.pax_name, sector, d.pnr, d.airline].map((p) => (p || "").toString().trim()).filter(Boolean);
  return parts.join(" - ");
}
type VendorLite = { id: string; name: string; contact_person: string | null; phone: string | null };
export type FlightOption = { details: string; pnr: string; seats: number; groupType: "self" | "party" };

function TicketForm({ draft, setDraft, agents, vendors = [], flightOptions = [] }: { draft: Draft; setDraft: (d: Draft) => void; agents: AgentLite[]; vendors?: VendorLite[]; flightOptions?: FlightOption[] }) {
  const [showPicker, setShowPicker] = useState(false);
  // Only offer flights that belong to the selected group type.
  const options = useMemo(
    () => flightOptions.filter((o) => o.groupType === draft.group_type),
    [flightOptions, draft.group_type],
  );
  const picked = useMemo(
    () => options.find((o) => o.details === formatFlightSegments(draft.sector || "")),
    [options, draft.sector],
  );
  const seatCap = draft.group_type === "self" ? picked?.seats ?? 0 : 0;


  const update = (patch: Partial<Draft>) => {
    const next = { ...draft, ...patch } as Draft;
    if (patch.sector !== undefined) {
      const iso = deriveTravelAtFromFlight(next.sector || "");
      if (iso) next.travel_at = toLocalInput(iso);
    }
    next.ledger_entry = buildLedgerEntry(next);
    setDraft(next);
  };
  const set = (k: keyof Draft, v: string | number) => update({ [k]: v as never } as Partial<Draft>);
  const onAgentChange = (name: string) => {
    const match = agents.find((a) => a.agency_name.toLowerCase() === name.toLowerCase());
    if (match) {
      const phone = `${match.country_code || ""}${match.cell_number || ""}`.replace(/\s+/g, "");
      update({
        agent_name: match.agency_name,
        agent_contact: [match.contact_person, phone].filter(Boolean).join(" · "),
        contact: phone,
      });
    } else {
      update({ agent_name: name });
    }
  };
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
      <Field label="Group Type">
        <select value={draft.group_type} onChange={(e) => set("group_type", e.target.value)} className={inp}>
          <option value="party">Party Group</option>
          <option value="self">Self Group</option>
        </select>
      </Field>
      <Field label="Booking Date"><input type="date" value={draft.booking_date ?? ""} onChange={(e) => set("booking_date", e.target.value)} className={inp} /></Field>
      <Field label="Agency Name / Contact">
        <input list="agent-names-list" value={draft.agent_name} onChange={(e) => onAgentChange(e.target.value)} className={inp} placeholder="Search agency…" />
        <datalist id="agent-names-list">
          {agents.map((a) => (
            <option key={a.agency_name} value={a.agency_name}>
              {[a.contact_person, `${a.country_code ?? ""}${a.cell_number ?? ""}`].filter(Boolean).join(" · ")}
            </option>
          ))}
        </datalist>
        {draft.agent_contact && <span className="text-[10px] text-muted-foreground">{draft.agent_contact}</span>}
      </Field>
      <Field label="Seats">
        <input
          type="number" min={0} max={seatCap || undefined}
          value={draft.seats}
          onChange={(e) => {
            let n = Number(e.target.value);
            if (seatCap > 0 && n > seatCap) n = seatCap;
            set("seats", n);
          }}
          placeholder={seatCap > 0 ? `${seatCap} seats available` : "Seats"}
          className={inp}
        />
        {draft.group_type === "self" && (
          <span className={`text-[10px] font-semibold ${seatCap > 0 ? "text-emerald-700" : "text-muted-foreground"}`}>
            {seatCap > 0 ? `${seatCap} seat(s) available in this self group` : "Choose a self-group flight to see availability"}
          </span>
        )}
      </Field>
      <Field label="Passenger Names"><input value={draft.pax_name} onChange={(e) => set("pax_name", e.target.value)} className={inp} /></Field>

      <Field label="Flight Details">
        <textarea
          rows={Math.max(2, splitFlightSegments(draft.sector || "").length)}
          placeholder="10 AUG MUX DXB 1120 1320"
          value={formatFlightSegments(draft.sector || "")}
          onChange={(e) => set("sector", e.target.value.toUpperCase())}
          className={`${inp} whitespace-pre font-mono text-[13px] leading-snug`}
        />
        <button
          type="button"
          onClick={() => setShowPicker((v) => !v)}
          className="self-start rounded border border-input px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-navy hover:bg-secondary"
        >
          {showPicker ? "Close" : `Choose ${draft.group_type === "self" ? "self group" : "party group"} flight`}
        </button>
        {showPicker && (
          <div className="mt-1 max-h-52 overflow-y-auto rounded-md border border-border bg-background">
            {options.length === 0 && (
              <p className="p-2 text-[11px] text-muted-foreground">
                No {draft.group_type === "self" ? "self group" : "party group"} flights uploaded yet.
              </p>
            )}
            {options.map((o, i) => (
              <button
                key={o.details}
                type="button"
                onClick={() => {
                  const next = { ...draft, sector: o.details } as Draft;
                  if (o.pnr) next.pnr = o.pnr;
                  const iso = deriveTravelAtFromFlight(o.details);
                  if (iso) next.travel_at = toLocalInput(iso);
                  if (draft.group_type === "self" && o.seats > 0 && Number(next.seats) > o.seats) next.seats = o.seats;
                  next.ledger_entry = buildLedgerEntry(next);
                  setDraft(next);
                  setShowPicker(false);
                }}
                className="flex w-full items-start gap-2 border-b border-border px-2 py-1.5 text-left hover:bg-secondary"
              >
                <span className="mt-0.5 flex h-4 w-4 flex-none items-center justify-center rounded-full bg-navy text-[9px] font-bold text-navy-foreground">{i + 1}</span>
                <span className="min-w-0 flex-1">
                  <span className="block whitespace-pre-line font-mono text-[12px] leading-snug">{o.details}</span>
                  <span className="mt-0.5 block text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    {o.pnr ? `PNR ${o.pnr}` : "No PNR"}{o.seats > 0 ? ` · ${o.seats} seats` : ""}
                  </span>
                </span>
              </button>
            ))}
          </div>
        )}
      </Field>
      <Field label="PNR (auto · editable)">
        <input value={draft.pnr} onChange={(e) => set("pnr", e.target.value.toUpperCase())} placeholder="Auto-filled from group fare" className={`${inp} font-mono font-bold`} />
      </Field>
      <Field label="Airline"><input placeholder="G9 / F3 / OV" value={draft.airline} onChange={(e) => set("airline", e.target.value.toUpperCase())} className={inp} /></Field>
      <Field label="Travel Date & Time (auto)">
        <input type="datetime-local" value={draft.travel_at ?? ""} onChange={(e) => set("travel_at", e.target.value)} className={inp} />
        <span className="text-[10px] text-muted-foreground">Auto-filled from Flight Details</span>
      </Field>

      <Field label="OTB">
        <select value={draft.otb} onChange={(e) => set("otb", e.target.value)} className={inp}>
          {OTB_OPTIONS.map((s) => <option key={s}>{s}</option>)}
        </select>
      </Field>
      <Field label="Pax Contact"><input value={draft.contact} onChange={(e) => set("contact", e.target.value)} className={inp} placeholder="Auto-filled from agent" /></Field>
      <Field label="Vendor">
        <input list="vendor-names-list" value={draft.vendor} onChange={(e) => set("vendor", e.target.value)} className={inp} placeholder="Type or select vendor…" />
        <datalist id="vendor-names-list">
          {vendors.map((v) => <option key={v.id} value={v.name}>{[v.contact_person, v.phone].filter(Boolean).join(" · ")}</option>)}
        </datalist>
      </Field>
      <Field label="Sale"><input type="number" value={draft.sale} onChange={(e) => set("sale", Number(e.target.value))} className={inp} /></Field>
      <Field label="Purchase"><input type="number" value={draft.purchase} onChange={(e) => set("purchase", Number(e.target.value))} className={inp} /></Field>
      <Field label="Ledger Entry">
        <input value={draft.ledger_entry} onChange={(e) => setDraft({ ...draft, ledger_entry: e.target.value })} className={inp} placeholder="Auto: GRP TKT - PAX - SECTOR - PNR - AIRLINE" />
      </Field>
      <Field label="Status (auto)">
        <div className={`${inp} bg-muted/50 text-muted-foreground`}>
          {deriveFlightStatus(draft.travel_at) || "— set travel date —"}
        </div>
      </Field>

    </div>
  );
}

const inp = "w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm outline-none focus:border-gold focus:ring-2 focus:ring-gold/30";
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
