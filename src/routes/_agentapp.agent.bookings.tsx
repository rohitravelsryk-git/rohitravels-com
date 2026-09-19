import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { flightBlockLines } from "@/lib/booking-flight-format";
import { AlertCircle, CheckCircle2, ChevronLeft, ChevronRight, Download, Eye, Paperclip, Plane, Search, Upload, X, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export const Route = createFileRoute("/_agentapp/agent/bookings")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "All Group Bookings | Rohi Travels" },
      { name: "description", content: "Track group booking payments, documents, and ticket status in the Rohi Travels agent portal." },
      { property: "og:title", content: "All Group Bookings | Rohi Travels" },
      { property: "og:description", content: "Track group booking payments, documents, and ticket status in the Rohi Travels agent portal." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BookingsPage,
});

type FileRef = { name: string; path: string; type?: string; size?: number; url?: string; kind?: string };

type Booking = {
  id: string;
  booking_ref: string | null;
  fare_snapshot: any;
  seats: number;
  passenger_names: string;
  contact_phone: string;
  status: string;
  payment_status: string;
  ticket_status: string;
  fare_on_demand: string | null;
  tickets: FileRef[];
  attachments: FileRef[];
  payment_slips: FileRef[];
  notes: string | null;
  created_at: string;
  group_type?: string;
};


function fmt(iso: string) {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}-${d.toLocaleString("en-US", { month: "short" })}-${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function toTitleCase(s: string) {
  return s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

// Upload Payment Slip visibility: live admin payment_status.
// Unpaid or Pending → always show; Paid/Confirmed/Ledger/Refunded → hide.
function canUploadSlip(paymentStatus?: string | null) {
  const v = (paymentStatus || "unpaid").trim().toLowerCase();
  return v === "" || v === "unpaid" || v === "pending";
}

function Pill({ value, kind }: { value: string; kind: "payment" | "ticket" }) {
  const v = (value || "").toLowerCase();
  if (kind === "payment") {
    // Mapping from the live admin "Payment Status" (same DB value source):
    // pending/unpaid → Unpaid, received/confirmed/paid → Paid, ledger → Added In Ledger.
    const label = v === "ledger" ? "Added In Ledger"
      : v === "confirmed" || v === "paid" || v === "received" ? "Received"
      : v === "refunded" ? "Refunded"
      : "Unpaid";
    const cls = v === "ledger"
      ? "border-border bg-muted text-muted-foreground"
      : label === "Received"
      ? "border-booking-green/25 bg-booking-green-soft/45 text-booking-green"
      : label === "Refunded"
      ? "border-booking-rose/25 bg-booking-rose-soft/55 text-booking-rose"
      : "border-booking-amber/35 bg-booking-amber-soft/65 text-booking-amber";
    const dot = v === "ledger" ? "bg-muted-foreground" : label === "Received" ? "bg-booking-green" : label === "Refunded" ? "bg-booking-rose" : "bg-booking-amber";
    const Icon = label === "Unpaid" ? AlertCircle : CheckCircle2;
    return (
      <motion.span
        animate={label === "Unpaid" ? { scale: [1, 1.025, 1] } : undefined}
        transition={label === "Unpaid" ? { duration: 2.4, repeat: Infinity, ease: "easeInOut" } : undefined}
        className={`inline-flex min-h-8 items-center gap-1.5 rounded-md border px-2.5 text-[11px] font-semibold ${cls}`}
      >
        {label === "Unpaid" ? <Icon className="h-3.5 w-3.5 shrink-0" /> : <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} />}
        {label}
      </motion.span>
    );
  }


  if (kind === "ticket") {
    // Mirrors the admin "Ticket Status" column exactly: Confirmed only when admin confirms.
    const confirmed = v === "confirmed" || v === "issued";
    const submitted = v === "submitted" || v === "waiting" || v === "";
    const cls = confirmed
      ? "border-booking-green/20 bg-booking-green-soft/35 text-booking-green"
      : submitted
      ? "border-booking-blue/20 bg-booking-blue-soft/30 text-booking-ink"
      : "border-booking-amber/20 bg-booking-amber-soft/35 text-booking-amber";
    const dot = confirmed ? "bg-booking-green" : submitted ? "bg-booking-blue" : "bg-booking-amber";
    const label = confirmed ? "Confirmed" : submitted ? "Submitted" : "On Hold";
    return (
      <span className={`inline-flex min-h-8 items-center gap-1.5 rounded-md border px-2.5 text-[11px] font-medium ${cls}`}>
        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} />
        {label}
      </span>
    );
  }
}

/** Computes everything the card and table views both need from one
 * booking, so the two views can never drift out of sync with each other. */
function computeBookingDisplay(b: Booking) {
  const f = b.fare_snapshot ?? {};
  const flightLines = flightBlockLines(f, { fare: b.fare_on_demand }).filter((line) => !line.startsWith("Fare:"));
  const passengerRows = (b.passenger_names ?? "").split("\n").filter(Boolean).map((line) => {
    const full = (line.split("|")[0] ?? "").trim();
    const parts = full.split(/\s+/).filter(Boolean);
    const start = ["mr", "mrs", "ms", "miss", "master"].includes(parts[0]?.toLowerCase()) ? 1 : 0;
    return { given: (parts.slice(start, -1).join(" ") || parts[start] || "—").toUpperCase(), surname: (parts.length > start + 1 ? parts.at(-1) : "—")?.toUpperCase() };
  });
  const fareValue = String(b.fare_on_demand || f.fare_on_demand || f.price_text || "");
  const masked = /FARE\s*ON\s*WHATSAPP/i.test(fareValue);
  const numericFare = masked ? "" : fareValue.replace(/[^\d]/g, "");
  const total = numericFare ? `PKR ${(Number(numericFare) * b.seats).toLocaleString()}` : masked ? "FARE ON WHATSAPP" : "ON CALL";
  const paymentDone = b.payment_slips.length > 0;
  const docsMissing = b.attachments.length === 0 || !paymentDone;
  const attention = canUploadSlip(b.payment_status) || (b.ticket_status || "").toLowerCase() !== "confirmed" || docsMissing;
  // Compact flight segments + baggage for the table's "Flight Details" cell:
  // drop the route/airline headings, keep only the actual schedule lines.
  const segmentLines = flightLines.filter(
    (line) =>
      !/^Airline:/i.test(line) &&
      !/^Flight Details:/i.test(line) &&
      !/^Baggage:/i.test(line) &&
      /\d/.test(line),
  );
  const baggage = String(f.baggage ?? "").trim();
  return { f, flightLines, segmentLines, baggage, passengerRows, fareValue, masked, numericFare, total, paymentDone, docsMissing, attention };
}


function BookingsPage() {
  const [rows, setRows] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  async function load() {
    const { data: sess } = await supabase.auth.getSession();
    const uid = sess.session?.user?.id;
    if (!uid) return setLoading(false);
    const { data } = await supabase
      .from("agent_bookings")
      .select("*")
      .eq("agent_user_id", uid)
      .order("created_at", { ascending: false });

    let list = ((data ?? []) as any[]).map((r) => ({
      ...r,
      tickets: Array.isArray(r.tickets) ? r.tickets : [],
      attachments: Array.isArray(r.attachments) ? r.attachments : [],
      payment_slips: Array.isArray(r.payment_slips) ? r.payment_slips : [],
      payment_status: r.payment_status ?? "unpaid",
      ticket_status: r.ticket_status ?? "waiting",
    })) as Booking[];

    // Group → Self bookings show the PNR of their linked Admin Fare record.
    const fareIds = Array.from(new Set(list.map((b: any) => b.fare_id).filter(Boolean)));
    if (fareIds.length) {
      const { data: fareRows } = await supabase
        .from("fares")
        .select("id, group_type, pnr")
        .in("id", fareIds as string[]);
      const fareById = new Map((fareRows ?? []).map((f: any) => [f.id, f]));
      list = list.map((b: any) => {
        const f = fareById.get(b.fare_id) as any;
        const isSelf = (f?.group_type ?? b.fare_snapshot?.group_type ?? "").toLowerCase() === "self";
        if (!isSelf || !String(f?.pnr ?? "").trim()) return b;
        return { ...b, fare_snapshot: { ...(b.fare_snapshot ?? {}), group_type: "self", pnr: String(f.pnr).trim().toUpperCase() } };
      });
    }


    // Removed hard filter that was hiding confirmed bookings.
    // list = list.filter(b => {
    //   const s = (b.ticket_status || "").toLowerCase();
    //   return s === "submitted" || s === "waiting" || s === "on hold" || s === "";
    // });

    // SMART SORTING:
    // 1. Actionable (Unpaid or Submitted/On Hold)
    // 2. Confirmed (Recent)
    // 3. Others
    const actionableScore = (b: Booking) => {
      const tStat = (b.ticket_status || "").toLowerCase();
      const pStat = (b.payment_status || "").toLowerCase();
      
      // Top priority: Submitted/On Hold AND Unpaid
      if ((tStat === "submitted" || tStat === "waiting" || tStat === "on hold") && pStat === "unpaid") return 100;
      // High priority: Any Submitted/On Hold
      if (tStat === "submitted" || tStat === "waiting" || tStat === "on hold") return 80;
      // Medium priority: Just Unpaid
      if (pStat === "unpaid") return 50;
      // Lower: Confirmed
      if (tStat === "confirmed") return 20;
      return 0;
    };

    list.sort((a, b) => {
      const scoreA = actionableScore(a);
      const scoreB = actionableScore(b);
      if (scoreA !== scoreB) return scoreB - scoreA;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    // Sign private storage files
    await Promise.all(
      list.flatMap((b) =>
        [...b.tickets, ...b.attachments, ...b.payment_slips].map(async (f) => {
          if (!f?.path) return;
          const { data: sig } = await supabase.storage
            .from("booking-attachments")
            .createSignedUrl(f.path, 60 * 60);
          f.url = sig?.signedUrl;
        }),
      ),
    );

    setRows(list);
    setLoading(false);
  }

  async function uploadSlips(b: Booking, files: FileList | null) {
    return uploadFiles(b, files, "payment_slip");
  }

  /** Agent uploads payment slips, passport or visa copies against their own booking. */
  async function uploadFiles(b: Booking, files: FileList | null, kind: "payment_slip" | "visa" | "passport") {
    if (!files || !files.length) return;
    setUploading(`${b.id}:${kind}`);
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes?.user?.id;
      if (!uid) throw new Error("Your session expired — please sign in again.");
      const folder = kind === "payment_slip" ? "payment-slips" : kind === "passport" ? "passport" : "visa";
      const added: FileRef[] = [];
      for (const file of Array.from(files).slice(0, 5)) {
        const safe = file.name.replace(/[^\w.\-]+/g, "_");
        const path = `${uid}/${folder}/${b.id}/${Date.now()}-${safe}`;
        const { error } = await supabase.storage
          .from("booking-attachments")
          .upload(path, file, { upsert: false, contentType: file.type || undefined });
        if (error) throw new Error(error.message);
        added.push({ name: file.name, path, size: file.size, type: file.type, kind });
      }
      const patch =
        kind === "payment_slip"
          ? { payment_slips: [...b.payment_slips, ...added] }
          : { attachments: [...b.attachments, ...added] };
      const { error: updErr } = await supabase
        .from("agent_bookings")
        .update(patch as any)
        .eq("id", b.id);
      if (updErr) throw new Error(updErr.message);
      await load();
    } catch (e: any) {
      alert(e.message ?? "Upload failed");
    } finally {
      setUploading(null);
    }
  }


  useEffect(() => {
    load();
    // Fast polling + realtime so admin changes reflect without a page refresh.
    const t = setInterval(load, 5_000);
    const channel = supabase
      .channel("agent-bookings-sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "agent_bookings" }, () => load())
      .subscribe();
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(t);
      window.removeEventListener("focus", onFocus);
      supabase.removeChannel(channel);
    };
  }, []);



  const q = search.trim().toLowerCase();
  const filtered = rows.filter((b) => {
    if (statusFilter !== "all") {
      const ticket = (b.ticket_status || b.status || "").toLowerCase();
      const hasTicket = b.tickets.length > 0;
      if (statusFilter === "confirmed") {
        // Confirmed only: admin marked the ticket status as confirmed.
        if (ticket !== "confirmed") return false;
      } else if (statusFilter === "submitted") {
        // Submitted: newly requested bookings that are not ticketed yet.
        if (ticket === "confirmed" || hasTicket) return false;
      }
    }
    if (!q) return true;
    const f = b.fare_snapshot ?? {};
    return [b.booking_ref, b.passenger_names, b.status, b.payment_status, f.airline, f.origin_code, f.destination_code]
      .filter(Boolean).join(" ").toLowerCase().includes(q);
  });

  const pageSize = 20;
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
  useEffect(() => { setPage(1); }, [statusFilter, search]);

  // Stat cards follow the active filter + search so the numbers always match the rows shown.
  const confirmedCount = filtered.filter((b) => (b.ticket_status || "").toLowerCase() === "confirmed" || (b.status || "").toLowerCase() === "confirmed").length;
  const paymentPendingCount = filtered.filter((b) => canUploadSlip(b.payment_status)).length;

  const stats = [
    { label: "Total bookings", value: String(filtered.length), icon: Plane, tone: "bg-booking-blue-soft text-booking-blue" },
    { label: "Payments pending", value: String(paymentPendingCount), icon: Zap, tone: "bg-booking-amber-soft text-booking-amber" },
    { label: "Tickets confirmed", value: String(confirmedCount), icon: CheckCircle2, tone: "bg-booking-green-soft text-booking-green" },
  ];

  return (
    <div className="min-h-full bg-booking-canvas px-3 py-5 font-booking text-booking-ink sm:px-5 lg:px-6 animate-premium-fade">
      <div className="grid grid-cols-2 gap-3 min-[920px]:grid-cols-3">
        {stats.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06, duration: 0.35, ease: "easeOut" }}
              whileHover={{ y: -2 }}
              className="flex min-h-24 items-center gap-3 rounded-[14px] border border-border/70 bg-card p-4 shadow-[0_1px_2px_rgba(0,0,0,0.03),0_8px_20px_-12px_rgba(20,20,19,0.15)] transition-shadow hover:shadow-[0_1px_2px_rgba(0,0,0,0.04),0_14px_28px_-12px_rgba(20,20,19,0.22)]"
            >
              <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-[11px] ring-1 ring-inset ring-black/[0.03] ${stat.tone}`}><Icon className="h-5 w-5" /></div>
              <div className="min-w-0">
                <p className="text-[22px] font-extrabold leading-none tabular-nums">{stat.value}</p>
                <p className="mt-1.5 text-xs font-medium text-booking-subtle">{stat.label}</p>
              </div>
            </motion.div>
          );
        })}
      </div>

      <header className="mt-7 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 min-[920px]:flex min-[920px]:justify-between">
        <div className="flex min-w-0 items-baseline gap-2">
          <h1 className="truncate text-2xl font-extrabold tracking-tight">All Group Bookings</h1>
          <span className="shrink-0 text-sm font-medium text-booking-subtle">{rows.length} total</span>
        </div>
        <div className="col-span-2 flex min-w-0 flex-wrap items-center gap-2 min-[920px]:col-span-1 min-[920px]:justify-end">
          <label className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-lg border border-border bg-card px-3 shadow-sm transition-shadow focus-within:shadow-md focus-within:ring-2 focus-within:ring-booking-blue/20 min-[920px]:w-72 min-[920px]:flex-none">
            <Search className="h-4 w-4 shrink-0 text-booking-subtle" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search booking ref or sector…" className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-booking-subtle" />
          </label>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="h-10 rounded-lg border border-border bg-card px-3 text-sm font-semibold shadow-sm outline-none focus:ring-2 focus:ring-booking-blue/20">
            <option value="all">All</option>
            <option value="submitted">Submitted</option>
            <option value="confirmed">Confirmed</option>
          </select>
        </div>
      </header>

      {loading ? (
        <div className="mt-4 rounded-[14px] border border-border bg-card p-10 text-center text-sm text-booking-subtle">Loading bookings…</div>
      ) : filtered.length === 0 ? (
        <div className="mt-4 rounded-[14px] border border-border bg-card p-10 text-center text-sm text-booking-subtle shadow-booking">
          <Plane className="mx-auto mb-2 h-6 w-6 -rotate-45" />
          No matching bookings. <Link to="/agent/fares" className="font-bold text-booking-blue underline">Browse group fares</Link>
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="mt-4 overflow-hidden rounded-lg border border-border bg-card shadow-booking"
        >
          <div className="overflow-x-auto">
          <TooltipProvider delayDuration={250}>
          <table className="w-full min-w-[1240px] table-fixed border-collapse text-sm">
            <colgroup>
              <col className="w-[12%]" />
              <col className="w-[17%]" />
              <col className="w-[14%]" />
              <col className="w-[12%]" />
              <col className="w-[15%]" />
              <col className="w-[11%]" />
              <col className="w-[19%]" />
            </colgroup>
            <thead>
              <tr className="border-b border-primary bg-primary text-[10px] font-semibold uppercase tracking-wider text-primary-foreground">
                <th className="sticky left-0 z-20 bg-primary px-4 py-4 text-left">Booking</th>
                <th className="px-4 py-4 text-left">Flight Details</th>
                <th className="px-4 py-4 text-left">Passengers</th>
                <th className="px-4 py-4 text-right">Booking Total</th>
                <th className="px-4 py-4 text-center">Payment Status</th>
                <th className="px-4 py-4 text-center">Ticket Status</th>
                <th className="sticky right-0 z-20 bg-primary px-4 py-4 text-center">Tickets &amp; Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginated.map((b, i) => {
                const { f, total, paymentDone, docsMissing, attention, segmentLines, baggage } = computeBookingDisplay(b);
                const leadPassenger = (b.passenger_names ?? "").split("\n").filter(Boolean)[0]?.split("|")[0]?.trim() || "—";
                const ticketState = (b.ticket_status || b.status || "").toLowerCase();
                const isSubmitted = ticketState !== "confirmed" && b.tickets.length === 0;
                return (
                  <motion.tr
                    key={b.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(i, 12) * 0.03, duration: 0.25, ease: "easeOut" }}
                    className={`group border-b border-border/70 transition-colors duration-150 last:border-0 hover:bg-booking-canvas ${isSubmitted ? "bg-booking-amber-soft/35 shadow-[inset_3px_0_0_var(--color-booking-amber,currentColor)]" : attention ? "bg-booking-amber-soft/10" : ""}`}
                  >
                    <td className={`sticky left-0 z-10 px-4 py-4 align-middle shadow-[1px_0_0_var(--border)] transition-colors group-hover:bg-booking-canvas ${isSubmitted ? "bg-booking-amber-soft" : "bg-card"}`}>
                      <div className="flex items-center gap-2">
                        <div className="min-w-0">
                          <p className="truncate font-mono text-xs font-semibold text-booking-ink">{b.booking_ref ?? "—"}</p>
                          <p className="mt-1 whitespace-nowrap text-[10px] text-booking-subtle">{fmt(b.created_at)}</p>
                        </div>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" onClick={() => setViewingId(b.id)} aria-label={`View booking ${b.booking_ref ?? "details"}`} className="h-8 w-8 shrink-0 rounded-md text-booking-subtle hover:bg-booking-blue-soft/35 hover:text-booking-ink">
                              <Eye className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>View booking</TooltipContent>
                        </Tooltip>
                      </div>
                    </td>
                    <td className="px-4 py-4 align-middle">
                      <p className="text-sm font-semibold text-booking-ink">{[f.origin_code, f.destination_code].filter(Boolean).join(" → ") || "—"}</p>
                      <p className="mt-0.5 text-xs text-booking-subtle">{String(f.airline ?? "").trim() || "—"}</p>
                      {segmentLines.length > 0 && (
                        <div className="mt-1 space-y-0.5">
                          {segmentLines.map((line, idx) => (
                            <p key={idx} className="font-mono text-[10px] leading-snug text-booking-subtle">{line}</p>
                          ))}
                        </div>
                      )}
                      {baggage && <p className="mt-1 text-[10px] text-booking-subtle">Baggage: {baggage}</p>}
                    </td>
                    <td className="px-4 py-4 align-middle">
                      <p className="font-medium">{leadPassenger}{b.seats > 1 ? ` +${b.seats - 1}` : ""}</p>
                      <p className="text-xs text-booking-subtle">{b.seats} pax{b.seats > 1 ? " · group" : ""}</p>
                    </td>
                    <td className="px-4 py-4 align-middle text-right font-semibold tabular-nums text-booking-ink">{total}</td>
                    <td className="px-4 py-4 align-middle text-center">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Pill value={b.payment_status} kind="payment" />
                        {canUploadSlip(b.payment_status) && (
                          <Button asChild size="sm" className={`h-8 min-w-28 rounded-md bg-accent px-3 text-[11px] font-semibold text-accent-foreground shadow-sm hover:bg-accent/90 ${uploading === `${b.id}:payment_slip` ? "pointer-events-none opacity-50" : ""}`}>
                            <label>
                              <Upload className="h-3.5 w-3.5" />
                              {uploading === `${b.id}:payment_slip` ? "Uploading…" : "Upload slip"}
                              <input type="file" accept="image/*,application/pdf" multiple className="hidden" onChange={(e) => uploadSlips(b, e.target.files)} />
                            </label>
                          </Button>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4 align-middle text-center"><Pill value={b.ticket_status || b.status} kind="ticket" /></td>
                    <td className={`sticky right-0 z-10 px-4 py-4 align-middle shadow-[-1px_0_0_var(--border)] transition-colors group-hover:bg-booking-canvas ${isSubmitted ? "bg-booking-amber-soft" : "bg-card"}`}>
                      <div className="flex min-h-10 items-center justify-center gap-2">
                        {paymentDone && b.tickets.length ? (
                          <>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button asChild size="icon" className="h-9 w-9 rounded-md bg-booking-green text-primary-foreground shadow-sm hover:bg-booking-green/90">
                                  <a href={b.tickets[0]?.url ?? "#"} target="_blank" rel="noopener noreferrer" aria-label={`Download ticket for ${b.booking_ref ?? "booking"}`}>
                                    <Download className="h-4 w-4" />
                                  </a>
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Download ticket</TooltipContent>
                            </Tooltip>
                          </>
                        ) : canUploadSlip(b.payment_status) ? (
                          <span className="text-[11px] font-medium text-booking-amber">Payment required</span>
                        ) : paymentDone && docsMissing ? (
                          <span className="inline-flex min-h-8 items-center justify-center gap-1.5 rounded-md bg-booking-rose-soft/55 px-3 text-[11px] font-medium text-booking-rose">
                            <Paperclip className="h-3.5 w-3.5" /> Documents missing
                          </span>
                        ) : paymentDone ? (
                          <span className="inline-flex min-h-8 items-center justify-center gap-1.5 rounded-md bg-booking-amber-soft/45 px-3 text-[11px] font-medium text-booking-amber">
                            <Upload className="h-3.5 w-3.5" /> Awaiting ticket
                          </span>
                        ) : (
                          <span className="text-[11px] font-medium text-booking-subtle">Payment locked</span>
                        )}
                      </div>
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
          </TooltipProvider>
          </div>
        </motion.div>
      )}

      {!loading && filtered.length > 0 && totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-4">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={safePage <= 1}
            className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-4 py-2 text-xs font-bold text-booking-ink transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronLeft className="h-3.5 w-3.5" /> Previous
          </button>
          <span className="text-xs font-semibold text-booking-subtle">Page {safePage} of {totalPages}</span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={safePage >= totalPages}
            className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-4 py-2 text-xs font-bold text-booking-ink transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <AnimatePresence>
        {viewingId && (() => {
          const b = rows.find((x) => x.id === viewingId);
          if (!b) return null;
          const { f, flightLines, passengerRows, masked, numericFare, total } = computeBookingDisplay(b);
          return (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-navy/60 p-4 backdrop-blur-sm"
              onClick={() => setViewingId(null)}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.96, y: 8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97, y: 6 }}
                transition={{ duration: 0.22, ease: "easeOut" }}
                onClick={(e) => e.stopPropagation()}
                className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-card p-6 shadow-2xl"
              >
                <div className="flex items-start justify-between gap-3 border-b border-border pb-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm font-bold text-booking-blue">{b.booking_ref ?? "—"}</span>
                      {b.seats > 1 && <span className="rounded bg-booking-blue-soft px-1.5 py-0.5 text-[9px] font-extrabold text-booking-blue">GROUP</span>}
                      <span className="text-[10px] text-booking-subtle">{fmt(b.created_at)}</span>
                    </div>
                    <h2 className="mt-1.5 text-xl font-extrabold uppercase tracking-tight">{String(f.origin || f.origin_code || "—")} to {String(f.destination || f.destination_code || "—")}</h2>
                    <p className="text-xs font-semibold text-booking-subtle">{[f.origin_code, f.destination_code].filter(Boolean).join(" → ")}</p>
                  </div>
                  <button type="button" onClick={() => setViewingId(null)} className="rounded-lg p-1.5 text-booking-subtle transition-colors hover:bg-muted hover:text-booking-ink" aria-label="Close">
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="mt-4 space-y-1 rounded-lg bg-muted/40 px-3.5 py-3 text-xs">
                  {flightLines.slice(2).map((line, index) => <p key={`${line}-${index}`} className={line.startsWith("Baggage:") ? "font-semibold text-booking-ink" : "font-mono text-booking-subtle"}>{line}</p>)}
                  <p className="pt-0.5 font-semibold text-booking-subtle">{b.seats} passenger{b.seats === 1 ? "" : "s"}</p>
                </div>

                <div className="mt-4 overflow-hidden rounded-lg border border-border">
                  <div className="grid grid-cols-[36px_minmax(0,1fr)_minmax(0,1fr)] bg-muted/60 px-3 py-2 text-[9px] font-extrabold uppercase tracking-wide text-booking-subtle"><span>No.</span><span>Given Name</span><span>Surname</span></div>
                  {passengerRows.map((passenger, index) => (
                    <div key={index} className={`grid grid-cols-[36px_minmax(0,1fr)_minmax(0,1fr)] border-t border-border px-3 py-2 text-[11px] font-bold ${index % 2 ? "bg-muted/20" : ""}`}>
                      <span className="text-booking-subtle">{index + 1}</span>
                      <span className="truncate pr-2">{passenger.given}</span>
                      <span className="truncate">{passenger.surname}</span>
                    </div>
                  ))}
                </div>

                <div className="mt-4 rounded-xl border border-border bg-booking-blue-soft/25 p-4">
                  <p className="text-[10px] font-extrabold uppercase tracking-wide text-booking-subtle">Total cost</p>
                  <p className="mt-1 break-words text-2xl font-extrabold text-booking-ink">{total}</p>
                  <p className="mt-1 text-[11px] font-semibold text-booking-subtle">{b.seats} seat{b.seats === 1 ? "" : "s"} × {masked ? "fare on request" : numericFare ? `PKR ${Number(numericFare).toLocaleString()}` : "on call"}/seat</p>
                </div>

                <div className="mt-4 rounded-xl border border-border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wide text-booking-subtle">
                      <Paperclip className="h-3.5 w-3.5" /> Passport copies &amp; documents
                    </p>
                    <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide text-booking-ink transition-colors hover:bg-muted">
                      <Upload className="h-3 w-3" />
                      {uploading === `${b.id}:passport` ? "Uploading…" : "Attach passport copy"}
                      <input
                        type="file"
                        multiple
                        accept="image/*,application/pdf"
                        className="hidden"
                        disabled={uploading === `${b.id}:passport`}
                        onChange={(e) => {
                          void uploadFiles(b, e.target.files, "passport");
                          e.target.value = "";
                        }}
                      />
                    </label>
                  </div>

                  {b.attachments.length === 0 ? (
                    <p className="mt-2 text-[11px] font-semibold text-booking-subtle">No passport or visa copies attached yet.</p>
                  ) : (
                    <ul className="mt-2 space-y-1.5">
                      {b.attachments.map((file) => (
                        <li key={file.path}>
                          <a
                            href={file.url ?? "#"}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => { if (!file.url) { e.preventDefault(); alert("Document link is still loading — please try again in a moment."); } }}
                            className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-[11px] font-bold text-booking-ink transition-colors hover:bg-booking-blue-soft/30"
                          >
                            <span className="flex min-w-0 items-center gap-2">
                              <Eye className="h-3.5 w-3.5 shrink-0 text-booking-blue" />
                              <span className="truncate">{file.name}</span>
                            </span>
                            <span className="shrink-0 text-[9px] font-extrabold uppercase tracking-wide text-booking-subtle">
                              {file.kind === "passport" ? "Passport" : file.kind === "visa" ? "Visa" : "Document"}
                            </span>
                          </a>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </motion.div>
            </motion.div>
          );
        })()}
      </AnimatePresence>
    </div>
  );
}
