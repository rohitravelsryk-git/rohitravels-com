import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Plane, LogOut, Trash2, Plus, Search, X, Ticket, Stamp, Bell, RefreshCw, Check, Upload,
  CircleDollarSign, Wallet, TrendingUp, Eye, FileSpreadsheet, FileDown, CheckCircle2, Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { validateAdminOpen } from "@/lib/admin-deeplink";
import {
  listTickets, createTicket, updateTicket, deleteTicket,
  listNotifications, countUnreadNotifications, markNotificationsSeen,
  runTicketReminderScan, deriveFlightStatus,
  uploadTicketDoc, removeTicketDoc,
  type GroupTicket,
} from "@/lib/tickets.functions";
import { downloadCsv, printPdf } from "@/lib/voucher-export";
import { travelAtFromFlight } from "@/lib/booking-flight-format";
import { groupTicketLedgerEntry } from "@/lib/ledger-format";
import { formatDateShort, formatDateTimeShort } from "@/lib/date-format";
import { adminLogout, checkAdminUnlocked, listAgentsAdmin, listFares, listVendors, supabase } from "@/lib/fares.functions";
import { AdminHeaderExtras } from "@/components/AdminHeaderExtras";
import { AdminTabs } from "@/components/AdminTabs";
import { BookingDetailsDialog } from "@/components/BookingDetailsDialog";
import { useDocPreview } from "@/components/DocViewer";
import { Button } from "@/components/ui/button";


export const Route = createFileRoute("/admin/tickets")({
  validateSearch: validateAdminOpen,
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
const REMARK_OPTIONS = ["UPDATED", "PENDING", "PAID", "UNPAID"];

// These agencies book for walk-in passengers, so their own phone number is
// useless in CONTACT # — the admin must type the passenger's number instead.
const PASSENGER_CONTACT_AGENCIES = ["abdul razzaq"];
function needsPassengerContact(agentName?: string | null) {
  const name = String(agentName ?? "").trim().toLowerCase();
  return PASSENGER_CONTACT_AGENCIES.some((a) => name.includes(a));
}

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

/**
 * What the STATUS column shows. A hand-picked UPDATE NAME always outranks the
 * auto-derived window — it is an instruction to the office, and the row must not
 * quietly lose its warning colour just because the flight is still days away.
 */
function shownTicketStatus(travelIso: string | null | undefined, flightStatus?: string | null) {
  const stored = String(flightStatus || "").trim().toUpperCase();
  if (stored === "UPDATE NAME") return stored;
  return deriveFlightStatus(travelIso) || stored;
}

function ticketsExportTable(tickets: GroupTicket[]) {
  const sum = (key: "sale" | "purchase" | "profit") =>
    tickets.reduce((acc, t) => acc + Number(t[key] || 0), 0);
  const seatTotal = tickets.reduce((acc, t) => acc + Number(t.seats || 0), 0);

  return {
    title: "Group Tickets — Admin",
    subtitle: `Generated ${formatDateTimeShort(new Date())}  •  ${tickets.length} ticket${tickets.length === 1 ? "" : "s"}`,
    // Eighteen columns never read well sideways on portrait paper.
    orientation: "landscape" as const,
    highlightLastRow: true,
    numericColumns: [0, 8, 13, 14, 15],
    headers: [
      "Sr", "Booking Ref", "Group Type", "Agency Name", "Agency Contact", "Flight Details", "Airline",
      "Travel Date & Time", "Seats", "Passenger Names", "PNR", "Contact #", "Vendor",
      "Sale", "Purchase", "Profit", "Status", "Ledger Entry",
    ],
    rows: [
      ...tickets.map((t, i) => [
        t.seq ?? i + 1,
        t.booking_id ? `BK-${t.booking_id.slice(0, 8).toUpperCase()}` : "—",
        (t.group_type || "party").toUpperCase(),
        t.agent_name || "—",
        t.agent_contact || "—",
        (t.sector || "—").replace(/\n/g, " "),
        t.airline || "—",
        formatDateTimeShort(t.travel_at),
        t.seats || 0,
        (t.pax_name || "—").replace(/\n/g, ", "),
        t.pnr || "—",
        t.contact || "—",
        t.vendor || "—",
        t.sale || 0,
        t.purchase || 0,
        t.profit || 0,
        shownTicketStatus(t.travel_at, t.flight_status) || "—",
        ledgerForTicket(t) || "—",
      ]),
      ["", "", "", "", "", "", "", "", seatTotal, "", "", "", "TOTAL",
        sum("sale"), sum("purchase"), sum("profit"), "", ""],
    ],
  };
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

  useEffect(() => {
    const channel = supabase
      .channel("admin-tickets-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "group_tickets" }, () => {
        qc.invalidateQueries({ queryKey: ["tickets"] });
        qc.invalidateQueries({ queryKey: ["admin-notif-reminders"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);

  const router = useRouter();
  const logout = useServerFn(adminLogout);


  const { data: tickets = [] } = useQuery<GroupTicket[]>({
    queryKey: ["tickets"], queryFn: () => listTickets(),
  });
  
  // Stable arrival order, most recent received first — tickets keep the
  // position they were confirmed in and never jump around when later edited.
  const sortedTickets = useMemo(() => {
    return [...tickets].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
  }, [tickets]);
  const { data: agents = [] } = useQuery({
    queryKey: ["admin", "agents"], queryFn: () => listAgentsAdmin(),
  });
  const { data: fares = [] } = useQuery({
    queryKey: ["admin", "fares-lite"], queryFn: () => listFares(),
  });
  const { data: vendors = [] } = useQuery({
    queryKey: ["vendors"], queryFn: () => listVendors(),
  });
  // Baggage is stored on the fare, so look it up by the ticket's fare id.
  const baggageByFareId = useMemo(() => {
    const map = new Map<string, string>();
    for (const f of fares as Array<{ id: string; baggage?: string | null }>) {
      const b = (f.baggage || "").trim();
      if (b) map.set(f.id, b);
    }
    return map;
  }, [fares]);
  // Route header (cities + codes) comes from the linked fare so this column
  // reads exactly like the agent portal's All Group Bookings Flight Details.
  const fareRouteById = useMemo(() => {
    const map = new Map<string, { route: string; codes: string }>();
    for (const f of fares as Array<{ id: string; origin?: string | null; destination?: string | null; origin_code?: string | null; destination_code?: string | null }>) {
      map.set(f.id, {
        route: `${f.origin ?? ""} ${f.destination ?? ""}`.trim().toUpperCase(),
        codes: `${f.origin_code ?? ""} ${f.destination_code ?? ""}`.trim().toUpperCase(),
      });
    }
    return map;
  }, [fares]);
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

  // The reminder scan reads the whole tickets table, so it waits until the
  // table has already painted instead of competing with it on mount.
  useEffect(() => {
    const run = () => {
      scan().then(() => {
        qc.invalidateQueries({ queryKey: ["tickets", "unread"] });
        qc.invalidateQueries({ queryKey: ["tickets", "notifs"] });
      }).catch(() => {});
    };
    const firstScan = setTimeout(run, 4000);
    const id = setInterval(run, 5 * 60 * 1000);
    return () => { clearTimeout(firstScan); clearInterval(id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [showBell, setShowBell] = useState(false);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Draft>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [viewing, setViewing] = useState<GroupTicket | null>(null);

  // A ticket reminder notice opens this ledger on ?open=<ticket id>: that row's
  // details dialog is shown and the row itself is ringed, so the column the
  // reminder is about (names, OTB, travel date) is one click away.
  const { open: openTicket } = Route.useSearch();
  const [highlight, setHighlight] = useState<string | null>(null);
  useEffect(() => {
    if (!openTicket || highlight === openTicket) return;
    const row = tickets.find((t) => t.id === openTicket);
    if (!row) return;
    setHighlight(openTicket);
    if (!viewing) setViewing(row);
    document.getElementById(`ticket-${openTicket}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openTicket, highlight, tickets]);

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
    return sortedTickets.filter((t) => {
      // Compare against the status actually shown in the table (auto-derived from
      // the travel date, with a hand-picked UPDATE NAME always winning).
      const shown = shownTicketStatus(t.travel_at || travelAtFromFlight(t.sector || ""), t.flight_status);
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
    const missing = missingRequired(draft);
    if (missing.length) return alert(`Please fill these required fields: ${missing.join(", ")}.`);
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
      sale: t.sale, purchase: t.purchase, ledger_entry: ledgerForTicket(t), remarks: t.remarks,
      group_type: t.group_type || "party",
    });
  }
  async function saveEdit() {
    if (!editingId) return;
    const missing = missingRequired(editDraft);
    if (missing.length) return alert(`Please fill these required fields: ${missing.join(", ")}.`);
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
    <div className="min-h-screen bg-background animate-premium-fade">
      <header className="border-b border-[rgba(255,255,255,0.10)] bg-navy text-white w-full">
        <div className="flex items-center justify-between px-0 py-4">
          <div className="flex items-center gap-3">
            <Plane className="h-5 w-5 -rotate-45 text-white" />
            <div>
              <p className="font-sans text-lg font-semibold">Group Tickets</p>
              <p className="text-[11px] font-medium text-white/70">Bookings ledger · Reminders · Notifications</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <AdminHeaderExtras />
            <a href="/" className="rounded-lg border border-white/25 px-3 py-1.5 text-[13px] font-medium hover:bg-white/10">Home</a>
            <button onClick={onLogout} className="inline-flex items-center gap-2 rounded-lg bg-[var(--accent)] px-3 py-1.5 text-[13px] font-medium text-white transition-colors hover:bg-[var(--accent-hover)]">
              <LogOut className="h-3.5 w-3.5" /> Logout
            </button>
          </div>
        </div>
<AdminTabs />
      </header>

      <div className="px-3 py-5 font-booking text-booking-ink sm:px-5 lg:px-6">
        {/* KPI strip — leads the page, same as the other admin tabs */}
        <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="Total Tickets" value={String(filtered.length)} icon={Ticket} />
          <StatCard label="Sale" value={fmtMoney(totals.sale)} tone="navy" icon={CircleDollarSign} />
          <StatCard label="Purchase" value={fmtMoney(totals.purchase)} tone="muted" icon={Wallet} />
          <StatCard label="Profit" value={fmtMoney(totals.profit)} tone="green" icon={TrendingUp} />
        </div>

        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h1 className="flex min-w-0 items-baseline gap-2 text-lg font-extrabold tracking-tight sm:text-2xl">
            <span className="truncate">Group Tickets Confirmed</span>
            <span className="shrink-0 text-sm font-medium text-booking-subtle">{filtered.length} shown</span>
          </h1>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <div className="relative w-full sm:w-64">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-booking-subtle" />
              <input
                value={q} onChange={(e) => setQ(e.target.value)}
                placeholder="Search agent, pax, sector, PNR, airline, vendor…"
                className="h-10 w-full min-w-0 rounded-lg border border-border bg-card pl-9 pr-9 text-sm text-booking-ink shadow-sm outline-none placeholder:text-booking-subtle focus:ring-2 focus:ring-booking-blue/20"
              />
              {q && <button onClick={() => setQ("")} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-booking-subtle hover:bg-secondary"><X className="h-3.5 w-3.5" /></button>}
            </div>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="h-10 rounded-lg border border-border bg-card px-3 text-sm font-semibold text-booking-ink shadow-sm outline-none focus:ring-2 focus:ring-booking-blue/20">
              <option value="ALL">All statuses</option>
              {STATUS_OPTIONS.filter(s => s !== "CONFIRMED").map((s) => <option key={s}>{s}</option>)}
            </select>
            <button
              onClick={() => setShowAdd((v) => !v)}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-gold px-4 text-xs font-black uppercase tracking-wide text-gold-foreground shadow-sm transition-all hover:brightness-95"
            >
              <Plus className="h-3.5 w-3.5" /> {showAdd ? "Close" : "Add ticket"}
            </button>
            <button
              onClick={() => downloadCsv(ticketsExportTable(filtered))}
              className="inline-flex h-10 items-center gap-1.5 rounded-md bg-booking-green px-3 text-xs font-bold text-white transition hover:brightness-95"
              title="Download as Excel / Google Sheets"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" /> Excel
            </button>
            <button
              onClick={() => printPdf(ticketsExportTable(filtered))}
              className="inline-flex h-10 items-center gap-1.5 rounded-md bg-booking-rose px-3 text-xs font-bold text-white transition hover:brightness-95"
              title="Download as PDF"
            >
              <FileDown className="h-3.5 w-3.5" /> PDF
            </button>
          </div>
        </div>

        {showAdd && (
          <div className="mb-4 rounded-lg border border-border/70 bg-card p-4 shadow-booking">
            <h2 className="mb-3 font-sans text-sm font-black text-navy">New Ticket</h2>
            <TicketForm draft={draft} setDraft={setDraft} agents={agents} vendors={vendors} flightOptions={flightOptions} />
            <div className="mt-3 flex justify-end gap-2">
              <button onClick={() => { setDraft(EMPTY); setShowAdd(false); }} className="rounded-md border border-input px-3 py-2 text-xs font-semibold">Cancel</button>
              <button disabled={busy} onClick={onAdd} className="rounded-md bg-gold px-4 py-2 text-xs font-bold text-gold-foreground disabled:opacity-60">
                {busy ? "Saving…" : "Save ticket"}
              </button>
            </div>
          </div>
        )}

        <div className="overflow-hidden rounded-lg bg-card shadow-booking">
          <div className="overflow-x-auto">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="bg-text-primary text-text-inverse">
                {[
                  { h: "GROUP TYPE", cls: "" },
                  { h: "Booking ID", cls: "" },
                  { h: "AGENCY NAME / CONTACT", cls: "min-w-[110px]" },
                  { h: "FLIGHT DETAILS", cls: "min-w-[120px]" },
                  { h: "TRAVEL DATE & TIME", cls: "min-w-[92px]" },
                  { h: "STATUS", cls: "" },
                  { h: "PASSENGER NAMES", cls: "min-w-[110px]" },
                  { h: "PNR", cls: "" },
                  { h: "CONTACT #", cls: "" },
                  { h: "VENDOR", cls: "" },
                  { h: "SALE", cls: "text-right" },
                  { h: "PURCHASE", cls: "text-right" },
                  { h: "PROFIT", cls: "text-right" },
                  { h: "ACTIONS", cls: "" },
                  { h: "LEDGER ENTRY", cls: "w-[130px]" },
                ].map(({ h, cls }) => (
                  <th key={h} className={`sticky top-0 z-10 bg-text-primary px-3 py-3 text-left align-bottom text-[10px] font-semibold uppercase leading-tight tracking-wider ${cls}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={15} className="p-10 text-center text-sm text-muted-foreground">No tickets match your filters.</td></tr>
              )}
              {filtered.map((t, index) => {
                const isEditing = editingId === t.id;
                const travelIso = t.travel_at || travelAtFromFlight(t.sector || "");
                const shownStatus = shownTicketStatus(travelIso, t.flight_status);
                const hoursOut = travelIso ? (new Date(travelIso).getTime() - Date.now()) / 3600000 : Infinity;
                const step = ticketStep(t, travelIso);
                const attention = "bg-booking-amber-soft/80 shadow-[inset_4px_0_0_var(--color-booking-amber,currentColor)]";
                // UPDATE NAME is a standing instruction to the office, so it gets a
                // full warning row — amber across every cell with a rule above and
                // below — instead of the small left tab used for incomplete rows.
                const warning =
                  "bg-booking-amber-soft" +
                  " shadow-[inset_0_2px_0_var(--color-booking-amber,currentColor),inset_0_-2px_0_var(--color-booking-amber,currentColor),inset_5px_0_0_var(--color-booking-amber,currentColor)]";
                const isWarning = shownStatus === "UPDATE NAME";
                // Incomplete rows take the Agent Group Bookings attention style; the
                // rest follow the travel window.
                const rowTone = isWarning
                  ? warning
                  : !step.done
                    ? attention
                    : hoursOut < 0 ? "bg-booking-canvas" : hoursOut < 24 ? "bg-booking-rose-soft/40" : hoursOut < 72 ? "bg-booking-amber-soft/15" : "";
                if (isEditing) {
                  return (
                    <tr key={t.id} className="border-t border-border bg-gold/10">
                      <td colSpan={15} className="p-3">
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
                  <motion.tr
                    key={t.id}
                    id={`ticket-${t.id}`}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(index, 12) * 0.025, duration: 0.25 }}
                    className={`group border-b border-border/70 align-top ${rowTone || "bg-card"} ${highlight === t.id ? "ring-2 ring-inset ring-gold" : isWarning ? "font-semibold" : "hover:bg-bg-primary"}`}
                  >
                    <td className={`sticky left-0 z-10 px-3 py-3 shadow-[1px_0_0_var(--border)] ${isWarning ? "bg-booking-amber-soft" : rowTone || "bg-card group-hover:bg-bg-primary"}`}>
                      <span className={`inline-flex items-center rounded-md px-2 py-1 text-[9px] font-semibold whitespace-nowrap uppercase ${t.group_type === "self" ? "bg-booking-rose-soft text-booking-rose" : "bg-booking-blue-soft text-booking-ink"}`}>
                        {t.group_type === "self" ? "Self" : "Party"}
                      </span>
                      <p className="mt-1 whitespace-nowrap font-sans tabular-nums text-[10px] text-booking-subtle">{t.fare_id ? `FARE ${t.fare_id.slice(0, 8)}` : "—"}</p>
                    </td>
                    <td className="px-3 py-3">
                      <p className="whitespace-nowrap font-sans tabular-nums text-xs font-semibold text-booking-ink">#{t.seq ?? "—"}</p>
                      <p className="mt-1 whitespace-nowrap font-sans tabular-nums text-[10px] font-semibold text-booking-blue">{t.booking_id ? `BK-${t.booking_id.slice(0, 8).toUpperCase()}` : "—"}</p>
                      <p className="mt-1 text-[10px] text-booking-subtle">{t.created_at ? formatDateTimeShort(t.created_at) : formatDateShort(t.booking_date)}</p>
                      <span
                        title={step.done ? "Every column is filled" : `Pending: ${step.pending.map((p) => p.field).join(", ")}`}
                        className={`mt-1 inline-flex items-center gap-1 rounded-md px-2 py-1 text-[9px] font-semibold ${step.done ? "bg-booking-green-soft text-booking-green" : "bg-booking-amber-soft text-booking-amber"}`}
                      >
                        {step.done ? <CheckCircle2 className="h-3 w-3" /> : <Zap className="h-3 w-3" />}{step.label}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <p className="font-semibold text-booking-ink">{t.agent_name || "—"}</p>
                      <p className="mt-1 text-[10px] text-booking-subtle">{t.agent_contact || ""}</p>
                    </td>
                    <td className="px-3 py-3">
                      {(() => {
                        const segs = splitFlightSegments(t.sector || "").map((x) => x.toUpperCase());
                        const fr = fareRouteById.get(t.fare_id ?? "");
                        const firstParts = (segs[0] || "").split(/\s+/);
                        const lastParts = (segs[segs.length - 1] || "").split(/\s+/);
                        const codes = fr?.codes || (segs.length ? `${firstParts[2] ?? ""} ${lastParts[3] ?? ""}`.trim() : "");
                        const bag = baggageByFareId.get(t.fare_id ?? "");
                        return (
                          <>
                            <p className="font-semibold text-booking-ink">{fr?.route || codes || "—"}</p>
                            <p className="text-[10px] font-medium text-booking-subtle">{codes}</p>
                            <p className="mt-1 text-xs text-booking-ink">{t.airline || "Airline —"}</p>
                            <div className="mt-1 space-y-0.5">
                              {segs.map((line, idx) => (
                                <p key={`${line}-${idx}`} className="font-sans tabular-nums text-[10px] leading-snug text-booking-subtle">{line}</p>
                              ))}
                              {bag && <p className="font-sans tabular-nums text-[10px] leading-snug text-booking-subtle">Baggage: {bag}</p>}
                            </div>
                          </>
                        );
                      })()}
                    </td>
                    <td className="px-3 py-3">
                      <p className="font-semibold text-booking-ink">{formatDateTimeShort(travelIso)}</p>
                      <p className={`mt-1 text-[10px] font-semibold uppercase tracking-wide ${hoursOut < 24 ? "text-booking-rose" : "text-booking-green"}`}>
                        {hoursOut < 0 ? "DEPARTED" : `${Math.floor(hoursOut)}h to departure`}
                      </p>
                    </td>
                    <td className="px-3 py-3">
                      <span className={`inline-flex items-center rounded-md px-2 py-1 text-[9px] font-semibold uppercase ${shownStatus === "UPDATE NAME" ? "bg-booking-amber text-text-inverse font-bold ring-2 ring-booking-amber/40" : shownStatus === "UPCOMMING" ? "bg-booking-green-soft text-booking-green" : shownStatus === "FLOWN" ? "bg-booking-canvas text-booking-subtle" : "bg-booking-blue-soft text-booking-ink"}`}>
                        {shownStatus}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      {(() => {
                        const names = (t.pax_name || "").split("\n").map((l) => l.split("|")[0].trim()).filter(Boolean);
                        const seats = `${t.seats || 0} seat${t.seats === 1 ? "" : "s"}`;
                        if (names.length === 0) return <p className="mt-1 text-xs text-booking-subtle">{seats}</p>;
                        const shown = names.slice(0, 3);
                        return (
                          <>
                            <div className="flex items-start gap-2">
                              <div className="min-w-0 flex-1">
                                {shown.map((n, pi) => (
                                  <p key={pi} className="truncate font-semibold uppercase text-booking-ink">{n}</p>
                                ))}
                              </div>
                            </div>
                            <p className="mt-1 text-xs text-booking-subtle">{names.length > 3 ? `+${names.length - 3} more · ` : ""}{seats}</p>
                          </>
                        );
                      })()}
                    </td>
                    <td className="px-3 py-3 text-center font-sans tabular-nums text-xs font-semibold whitespace-nowrap text-booking-ink">{t.pnr || "—"}</td>
                    <td className="px-3 py-3 text-center font-sans tabular-nums text-[10px] leading-snug whitespace-nowrap text-booking-subtle">{t.contact || "—"}</td>
                    <td className="px-3 py-3 text-center text-booking-ink">{t.vendor || "—"}</td>
                    <td className="px-3 py-3 text-right font-semibold tabular-nums whitespace-nowrap text-booking-ink">{fmtMoney(t.sale)}</td>
                    <td className="px-3 py-3 text-right tabular-nums whitespace-nowrap text-booking-subtle">{fmtMoney(t.purchase)}</td>
                    <td className="px-3 py-3 text-right font-semibold tabular-nums whitespace-nowrap text-booking-green">{fmtMoney(t.profit)}</td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-1">
                        <Button type="button" variant="ghost" size="icon" onClick={() => setViewing(t)} aria-label="View booking" title="View booking" className="h-8 w-8 rounded-md text-booking-ink"><Eye className="h-4 w-4" /></Button>
                        <button onClick={() => startEdit(t)} className="rounded-md px-2 py-1 text-[10px] font-semibold text-booking-ink transition-colors hover:bg-bg-accent-tint">EDIT</button>
                        <button onClick={() => onDelete(t.id)} className="rounded-md p-1.5 text-booking-rose transition-colors hover:bg-booking-rose-soft/40"><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                    </td>
                    <td className="max-w-[130px] break-words px-3 py-3 text-[10px] leading-snug text-booking-subtle">{ledgerForTicket(t) || "—"}</td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
          </div>
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
              <div key={n.id} className={`p-3 text-xs ${!n.seen_at ? "bg-warning-soft" : ""}`}>
                <p className="font-bold text-navy">{n.title}</p>
                <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{n.body}</p>
                <p className="mt-1 text-[10px] uppercase tracking-widest text-muted-foreground">
                  {formatDateTimeShort(n.created_at)} · {n.channels_sent?.length ? `sent: ${n.channels_sent.join(", ")}` : "in-app"}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {viewing && (() => {
        const segments = splitFlightSegments(viewing.sector || "").map((segment) => segment.toUpperCase());
        const routeInfo = fareRouteById.get(viewing.fare_id ?? "");
        const first = (segments[0] || "").split(/\s+/);
        const last = (segments.at(-1) || "").split(/\s+/);
        const codes = routeInfo?.codes || `${first[2] ?? ""} ${last[3] ?? ""}`.trim();
        const docs = Array.isArray(viewing.attachments) ? viewing.attachments : [];
        const passports = docs.filter((a) => (a.kind ?? "passport") === "passport");
        const unrowed = passports.slice((viewing.pax_name || "").split("\n").filter(Boolean).length);
        const dropPassport = (path: string) => {
          void rmDoc({ data: { id: viewing.id, path } }).then(() => qc.invalidateQueries({ queryKey: ["tickets"] }));
        };
        return <BookingDetailsDialog open onClose={() => setViewing(null)} bookingRef={viewing.booking_id ? `BK-${viewing.booking_id.slice(0, 8).toUpperCase()}` : `#${viewing.seq}`} createdLabel={formatDateTimeShort(viewing.created_at)} route={routeInfo?.route || codes || "—"} routeCodes={codes} airline={viewing.airline || ""} flightDetails={segments} baggage={baggageByFareId.get(viewing.fare_id ?? "")} seats={viewing.seats} passengerNames={viewing.pax_name || ""} totalLabel={`PKR ${fmtMoney(viewing.sale)}`} totalHint={`${viewing.seats} seat${viewing.seats === 1 ? "" : "s"} · PNR ${viewing.pnr || "—"}`} passportFiles={passports} onRemovePassport={dropPassport} documents={<DocCell ticketId={viewing.id} kind="passport" files={unrowed} />} aside={<div className="grid gap-3 text-xs sm:grid-cols-3"><div><p className="text-[9px] font-bold uppercase text-muted-foreground">Agency</p><p className="mt-1 font-semibold text-foreground">{viewing.agent_name || "—"}</p></div><div><p className="text-[9px] font-bold uppercase text-muted-foreground">Contact</p><p className="mt-1 font-semibold text-foreground">{viewing.agent_contact || viewing.contact || "—"}</p></div><div><p className="text-[9px] font-bold uppercase text-muted-foreground">Status</p><p className="mt-1 font-semibold text-foreground">{viewing.flight_status || "—"}</p></div></div>} />;
      })()}

    </div>
  );
}

function StatCard({ label, value, tone = "navy", icon: Icon }: { label: string; value: string; tone?: "navy" | "green" | "muted" | "amber"; icon: LucideIcon }) {
  const tile = tone === "green" ? "bg-booking-green-soft text-booking-green"
    : tone === "amber" ? "bg-booking-amber-soft text-booking-amber"
    : tone === "muted" ? "bg-booking-rose-soft text-booking-rose"
    : "bg-booking-blue-soft text-booking-blue";
  const valueColor = tone === "green" ? "text-booking-green" : "text-booking-ink";
  return (
    <div className="flex min-h-[72px] min-w-0 items-center gap-3 rounded-[14px] border border-border/70 bg-card px-4 py-3 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
      <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-[11px] ring-1 ring-inset ring-black/[0.03] ${tile}`}><Icon className="h-4.5 w-4.5" /></span>
      <div className="min-w-0">
        <div className={`text-xl font-extrabold leading-none tabular-nums ${valueColor}`}>{value}</div>
        <div className="mt-1 truncate text-[11px] font-medium text-booking-subtle">{label}</div>
      </div>
    </div>
  );
}
type TicketFile = { name: string; url?: string; path?: string; type?: string };

/** Passport / Visa-OTB column: existing copies plus admin upload + delete. */
function DocCell({ ticketId, kind, files }: { ticketId: string; kind: "passport" | "visa"; files: TicketFile[] }) {
  const qc = useQueryClient();
  const upload = useServerFn(uploadTicketDoc);
  const removeDoc = useServerFn(removeTicketDoc);
  const [busy, setBusy] = useState(false);
  const { openDoc, previewNode } = useDocPreview();

  async function sendFiles(list: FileList) {
    for (const file of Array.from(list)) {
      const base64 = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result).split(",")[1] ?? "");
        r.onerror = () => reject(r.error);
        r.readAsDataURL(file);
      });
      await upload({ data: { id: ticketId, kind, name: file.name, type: file.type || "application/octet-stream", base64 } });
    }
  }

  async function onPick(list: FileList | null) {
    if (!list?.length) return;
    setBusy(true);
    try {
      await sendFiles(list);
      await qc.invalidateQueries({ queryKey: ["tickets"] });
    } catch (e) { alert((e as Error).message); }
    finally { setBusy(false); }
  }

  // The fresh copy is stored before the old one is dropped, so a failed upload
  // can never leave the ticket without its passport.
  async function onReplace(oldPath: string, list: FileList | null) {
    if (!list?.length) return;
    setBusy(true);
    try {
      await sendFiles(list);
      await removeDoc({ data: { id: ticketId, path: oldPath } });
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
    <div className="flex w-full min-w-0 flex-col gap-1.5">
      {files.map((f, i) => (
        <span key={i} className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => f.url && openDoc({ url: f.url, name: f.name, type: f.type ?? "" })}
            title={f.name}
            className="inline-block max-w-[260px] truncate rounded bg-booking-blue-soft/50 px-2 py-1 text-[11px] font-semibold text-booking-ink underline">
            {f.name}
          </button>
          {f.path && (
            <>
              <label className="inline-flex cursor-pointer items-center rounded px-1 py-0.5 text-[9px] font-bold uppercase tracking-wide text-booking-blue hover:bg-booking-blue-soft/40" title="Replace with a new file">
                {busy ? "…" : "Replace"}
                <input type="file" accept="image/*,application/pdf" className="hidden" disabled={busy}
                  onChange={(e) => { const files = e.target.files; e.currentTarget.value = ""; void onReplace(f.path!, files); }} />
              </label>
              <button onClick={() => onRemove(f.path!)} disabled={busy} className="rounded p-0.5 text-booking-rose hover:bg-booking-rose-soft/40" title="Remove">
                <X className="h-3 w-3" />
              </button>
            </>
          )}
        </span>
      ))}
      {files.length === 0 && (
        <label className={`inline-flex cursor-pointer items-center gap-1 self-start rounded border border-dashed border-booking-ink/25 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-booking-ink hover:bg-secondary ${busy ? "opacity-60" : ""}`}>
          <Upload className="h-3 w-3" /> {busy ? "…" : "Upload"}
          <input type="file" multiple accept="image/*,application/pdf" className="hidden" disabled={busy}
            onChange={(e) => { void onPick(e.target.files); e.currentTarget.value = ""; }} />
        </label>
      )}
      {previewNode}
    </div>
  );
}

function StatusBadge({ s }: { s: string }) {
  const map: Record<string, string> = {
    BOOKED: "bg-info-soft text-info",
    FLOWN: "bg-gray-200 text-gray-700",
    "FLIGHT IS FAR": "bg-warning-soft text-warning",
    "UPDATE NAME": "bg-accent-subtle text-accent ring-1 ring-accent",
    SCHEDULED: "bg-success-soft text-success",
    UPCOMMING: "bg-info-soft text-info",
    CANCELLED: "bg-error-soft text-error",
    REFUNDED: "bg-info-soft text-info",
  };
  return <span className={`whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] font-bold ${map[s] ?? "bg-gray-100 text-gray-600"}`}>{s || "—"}</span>;
}
function RemarkBadge({ r }: { r: string }) {
  const map: Record<string, string> = {
    UPDATED: "bg-success-soft text-success",
    PENDING: "bg-warning-soft text-warning",
    PAID: "bg-success-soft text-success",
    UNPAID: "bg-error-soft text-error",
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

/** Rows saved before the shared format keep a manual override; anything empty or
 * still auto-generated ("GRP TKT …") is re-derived so the column always reads the same. */
function ledgerForTicket(t: GroupTicket) {
  const stored = String(t.ledger_entry ?? "").trim();
  if (stored && !/^GRP\s+TKT/i.test(stored)) return stored;
  return (
    groupTicketLedgerEntry({
      passengerNames: t.pax_name,
      seats: t.seats,
      sector: formatFlightSegments(t.sector || ""),
      pnr: t.pnr,
      airline: t.airline,
    }) || stored
  );
}

/** Next thing still owed on a ticket row — same idea as the Agent Group
 * Bookings task pill: first gap names the step, the rest ride in the tooltip. */
function ticketStep(t: GroupTicket, travelIso: string | null) {
  const pending: { field: string; label: string }[] = [];
  const need = (field: string, label: string, filled: boolean) => {
    if (!filled) pending.push({ field, label });
  };
  need("Agency", "Add agency", Boolean(t.agent_name?.trim()));
  need("Passenger names", "Add pax names", Boolean(t.pax_name?.trim()));
  need("Seats", "Set seats", Number(t.seats || 0) > 0);
  need("Flight details", "Add flight details", Boolean(t.sector?.trim()));
  need("Travel date", "Add travel date", Boolean(travelIso));
  need("Airline", "Add airline", Boolean(t.airline?.trim()));
  need("PNR", "Add PNR", Boolean(t.pnr?.trim()));
  need("Contact", "Add contact", Boolean(t.contact?.trim()));
  need("Vendor", "Add vendor", Boolean(t.vendor?.trim()));
  need("Sale", "Set sale", Number(t.sale || 0) > 0);
  need("Purchase", "Set purchase", Number(t.purchase || 0) > 0);
  need("Ledger entry", "Set ledger entry", Boolean(ledgerForTicket(t)));
  return pending.length
    ? { label: pending[0].label, done: false, pending }
    : { label: "Updated", done: true, pending };
}

function buildLedgerEntry(d: Draft) {
  return groupTicketLedgerEntry({
    passengerNames: d.pax_name,
    seats: d.seats,
    sector: formatFlightSegments(d.sector || ""),
    pnr: d.pnr,
    airline: d.airline,
  });
}

/** Every field the ticket form requires before it can be saved. */
function missingRequired(d: Draft): string[] {
  const t = (v: unknown) => String(v ?? "").trim();
  const travelIso = t(d.travel_at) || travelAtFromFlight(d.sector || "");
  const checks: [string, boolean][] = [
    ["Booking date", Boolean(t(d.booking_date))],
    ["Agency name / contact", Boolean(t(d.agent_name))],
    ["Passenger names", Boolean(t(d.pax_name))],
    ["Seats", Number(d.seats || 0) > 0],
    ["Flight details", Boolean(t(d.sector))],
    ["Travel date & time", Boolean(travelIso)],
    ["PNR", Boolean(t(d.pnr))],
    ["Airline", Boolean(t(d.airline))],
    [needsPassengerContact(d.agent_name) ? "Passenger contact number" : "Contact #", Boolean(t(d.contact))],
    ["Vendor", Boolean(t(d.vendor))],
    ["Sale", Number(d.sale || 0) > 0],
    ["Purchase", Number(d.purchase || 0) > 0],
    ["Ledger entry", Boolean(t(d.ledger_entry) || t(buildLedgerEntry(d)))],
  ];
  return checks.filter(([, ok]) => !ok).map(([label]) => label);
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
      const iso = travelAtFromFlight(next.sector || "");
      if (iso) next.travel_at = toLocalInput(iso);
    }
    next.ledger_entry = buildLedgerEntry(next);
    setDraft(next);
  };
  const set = (k: keyof Draft, v: string | number) => update({ [k]: v as never } as Partial<Draft>);
  const manualContact = needsPassengerContact(draft.agent_name);
  const onAgentChange = (name: string) => {
    const match = agents.find((a) => a.agency_name.toLowerCase() === name.toLowerCase());
    if (match) {
      const phone = `${match.country_code || ""}${match.cell_number || ""}`.replace(/\s+/g, "");
      // Abdul Razzaq-style agencies: keep the agency phone out of CONTACT #.
      const contact = needsPassengerContact(match.agency_name) ? "" : phone;
      update({
        agent_name: match.agency_name,
        agent_contact: [match.contact_person, phone].filter(Boolean).join(" · "),
        contact,
      });
    } else {
      update({ agent_name: name });
    }
  };
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
      <p className="text-[10px] font-bold uppercase tracking-widest text-booking-subtle md:col-span-4">
        All fields are required · Ledger Entry is built automatically
      </p>
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
          <span className={`text-[10px] font-semibold ${seatCap > 0 ? "text-success" : "text-muted-foreground"}`}>
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
          className={`${inp} whitespace-pre font-sans tabular-nums text-[13px] leading-snug`}
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
                  const iso = travelAtFromFlight(o.details);
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
                  <span className="block whitespace-pre-line font-sans tabular-nums text-[12px] leading-snug">{o.details}</span>
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
        <input value={draft.pnr} onChange={(e) => set("pnr", e.target.value.toUpperCase())} placeholder="Auto-filled from group fare" className={`${inp} font-sans tabular-nums font-bold`} />
      </Field>
      <Field label="Airline"><input placeholder="G9 / F3 / OV" value={draft.airline} onChange={(e) => set("airline", e.target.value.toUpperCase())} className={inp} /></Field>
      <Field label="Travel Date & Time (auto)">
        <input type="datetime-local" value={draft.travel_at ?? ""} onChange={(e) => set("travel_at", e.target.value)} className={inp} />
        <span className="text-[10px] text-muted-foreground">Auto-filled from Flight Details</span>
      </Field>

      <Field label="CONTACT #">
        <input
          value={draft.contact}
          onChange={(e) => set("contact", e.target.value)}
          className={inp}
          placeholder={manualContact ? "Enter the passenger contact number" : "Auto-filled from agency"}
        />
        {manualContact && (
          <span className="text-[10px] font-semibold text-booking-amber">
            {draft.agent_name}: agency number is not used — enter the passenger contact number.
          </span>
        )}
      </Field>
      <Field label="Vendor">
        <input list="vendor-names-list" value={draft.vendor} onChange={(e) => set("vendor", e.target.value)} className={inp} placeholder="Type or select vendor…" />
        <datalist id="vendor-names-list">
          {vendors.map((v) => <option key={v.id} value={v.name}>{[v.contact_person, v.phone].filter(Boolean).join(" · ")}</option>)}
        </datalist>
      </Field>
      <Field label="Sale"><input type="number" value={draft.sale} onChange={(e) => set("sale", Number(e.target.value))} className={inp} /></Field>
      <Field label="Purchase"><input type="number" value={draft.purchase} onChange={(e) => set("purchase", Number(e.target.value))} className={inp} /></Field>
      <Field label="Ledger Entry">
        <input value={draft.ledger_entry} onChange={(e) => setDraft({ ...draft, ledger_entry: e.target.value })} className={inp} placeholder="Auto: GRP TKT - PAX*N - KHI JED - PNR - AIRLINE IATA" />
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
