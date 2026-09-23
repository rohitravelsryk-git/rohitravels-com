import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Plane, CheckCircle2, Ticket, Upload, Trash2, Search, Zap, Eye, X, CircleDollarSign, ExternalLink } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { adminLogout, supabase } from "@/lib/fares.functions";
import { listBookingsAdmin, setBookingStatusAdmin, setBookingPaymentStatus, uploadBookingTicket, removeBookingTicket, uploadBookingDoc, removeBookingDoc, deleteBookingAdmin, setBookingFareOnDemand, setBookingPnr, type AdminBooking } from "@/lib/agent-bookings.functions";
import { flightBlockLines } from "@/lib/booking-flight-format";
import { AdminHeaderExtras } from "@/components/AdminHeaderExtras";
import { AdminTabs } from "@/components/AdminTabs";
import { FareOnDemandCell } from "@/components/FareOnDemandCell";
import { DocCell } from "@/components/DocCell";
import { BookingDetailsDialog } from "@/components/BookingDetailsDialog";
import { useConfirmDialog } from "@/hooks/useConfirmDialog";

export const Route = createFileRoute("/admin/bookings")({
  head: () => ({
    meta: [
      { title: "Agent Group Bookings | Rohi Admin" },
      { name: "description", content: "Manage agent group booking fares, payments, documents, tickets, and confirmations." },
      { property: "og:title", content: "Agent Group Bookings | Rohi Admin" },
      { property: "og:description", content: "Manage agent group booking fares, payments, documents, tickets, and confirmations." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: async ({ context }) => {
    try {
      await context.queryClient.ensureQueryData({
        queryKey: ["admin-bookings"],
        queryFn: () => listBookingsAdmin(),
      });
    } catch (e) {
      console.warn("Loader failed:", e instanceof Error ? e.message : e);
    }
  },
  component: AdminBookingsPage,
});

function isPaid(status?: string | null) {
  const s = (status ?? "").toLowerCase();
  return s === "confirmed" || s === "paid" || s === "ledger";
}

function fareAmount(value?: string | null) {
  const raw = String(value ?? "").trim();
  if (!raw || /fare\s*on|on\s*call|whatsapp|contact|sold|optional|tba/i.test(raw)) return null;
  const normalized = raw.replace(/pkr|rs\.?|rupees?/gi, "").replace(/[,\s/\-]/g, "");
  if (!/^\d+(?:\.\d+)?$/.test(normalized)) return null;
  const amount = Number(normalized);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

function formatDateTime(iso: string) {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}-${d.toLocaleString("en-US", { month: "short" })}-${String(d.getFullYear()).slice(-2)} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** PNR lives on the fare snapshot; falls back to the (legacy) booking field. */
function bookingPnr(b: AdminBooking) {
  return String(b.fare_snapshot?.pnr ?? b.pnr ?? "").trim();
}

function bookingAction(b: AdminBooking) {
  const fareText = String(b.fare_on_demand ?? b.fare_snapshot?.price_text ?? "");
  const fareSet = Number(fareText.replace(/[^\d.]/g, "")) > 0;
  const paid = isPaid(b.payment_status);
  const hasPassport = (b.attachments ?? []).some((a: any) => a.kind === "passport");
  const hasTicket = ((b.tickets ?? []) as any[]).length > 0;

  if (b.status === "cancelled") return { label: "Cancelled", done: true, priority: 0 };
  if (b.status === "confirmed") return { label: "Complete", done: true, priority: 0 };
  if (!fareSet) return { label: "Set fare", done: false, priority: 5 };
  if (!paid) return { label: "Review payment", done: false, priority: 4 };
  if (!hasPassport) return { label: "Passport needed", done: false, priority: 3 };
  if (!hasTicket) return { label: "Upload ticket", done: false, priority: 2 };
  return { label: "Ready to confirm", done: false, priority: 1 };
}

function AdminBookingsPage() {
  const qc = useQueryClient();
  const { confirm, dialog } = useConfirmDialog();

  useEffect(() => {
    const channel = supabase
      .channel("admin-bookings-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "agent_bookings" }, () => {
        qc.invalidateQueries({ queryKey: ["admin-bookings"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [qc]);

  const list = useServerFn(listBookingsAdmin);
  const setStatus = useServerFn(setBookingStatusAdmin);
  const setPayment = useServerFn(setBookingPaymentStatus);
  const upTicket = useServerFn(uploadBookingTicket);
  const rmTicket = useServerFn(removeBookingTicket);
  const upDoc = useServerFn(uploadBookingDoc);
  const rmDoc = useServerFn(removeBookingDoc);
  const removeBooking = useServerFn(deleteBookingAdmin);
  const setFod = useServerFn(setBookingFareOnDemand);
  const setPnr = useServerFn(setBookingPnr);
  const logout = useServerFn(adminLogout);

  const { data } = useSuspenseQuery({
    queryKey: ["admin-bookings"],
    queryFn: () => list(),
    refetchInterval: 60_000,
  });

  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [ticketFilter, setTicketFilter] = useState("action");
  const [viewing, setViewing] = useState<AdminBooking | null>(null);
  const [pnrTarget, setPnrTarget] = useState<AdminBooking | null>(null);
  const [pnrValue, setPnrValue] = useState("");

  function patchRow(id: string, patch: Partial<AdminBooking>) {
    qc.setQueryData<AdminBooking[]>(["admin-bookings"], (rows) =>
      (rows ?? []).map((r) => (r.id === id ? { ...r, ...patch } : r)),
    );
  }
  const refresh = () => qc.invalidateQueries({ queryKey: ["admin-bookings"] });


  async function saveFod(b: AdminBooking, v: string) {
    // The agent's "Booking Total" is this per-seat fare × their booked seats,
    // so ask the admin to verify the calculated total before it goes live.
    const perSeat = fareAmount(v);
    if (perSeat === null) {
      toast.error("Enter a valid numeric fare per seat");
      refresh();
      return;
    }
    if (perSeat > 0) {
      const total = perSeat * b.seats;
      const ok = await confirm({
        title: "Verify fare",
        message: `${b.booking_ref ?? "This booking"} — confirm this fare before it's sent to the agent.`,
        details: [
          { label: "Fare per seat", value: `PKR ${perSeat.toLocaleString()}` },
          { label: "Seats booked by agent", value: String(b.seats) },
          { label: "Booking Total sent to agent", value: `PKR ${total.toLocaleString()}` },
        ],
        confirmLabel: "Confirm fare",
      });
      if (!ok) { refresh(); return; }
    }
    patchRow(b.id, { fare_on_demand: v } as Partial<AdminBooking>);
    try {
      await setFod({ data: { id: b.id, fare_on_demand: v } });
      toast.success(`Fare verified — agent total PKR ${(perSeat * b.seats).toLocaleString()}`);
    } catch (e: any) { alert(e.message); refresh(); }
  }

  async function onDelete(b: AdminBooking) {
    const ok = await confirm({
      title: "Delete booking",
      message: `${b.booking_ref ?? "This booking"} will be permanently removed. This cannot be undone.`,
      tone: "danger",
      confirmLabel: "Delete",
    });
    if (!ok) return;
    try { await removeBooking({ data: { id: b.id } }); } catch (e: any) { alert(e.message); } finally { refresh(); }
  }

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const matched = data.filter((b) => {
      if (ticketFilter === "action") {
        if (bookingAction(b).done) return false;
      } else if (ticketFilter === "payment") {
        if (isPaid(b.payment_status)) return false;
      } else if (ticketFilter !== "all") {
        const st = b.status === "confirmed" ? "confirmed" : b.status === "pending" ? "pending" : "submitted";
        if (st !== ticketFilter) return false;
      }
      if (!q) return true;
      return [b.booking_ref, b.agency_name, b.contact_person, b.contact_phone].some(s => s?.toLowerCase().includes(q));
    });
    // Stable arrival order, most recent first — bookings keep the position
    // they arrived in and never jump up/down as their status or payment changes.
    return [...matched].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
  }, [data, search, ticketFilter]);

  async function updateStatus(id: string, status: "confirmed" | "cancelled" | "pending") {
    patchRow(id, { status });
    try {
      await setStatus({ data: { id, status } });
      if (status === "confirmed") toast.success("Ticket is Confirmed — booking finalized");
    } catch (e: any) { toast.error(e.message); } finally { refresh(); }
  }

  // Confirm is gated on payment (Received/Added in Ledger) + a numeric Booking
  // Total + an uploaded ticket (see confirmDisabled). On top of that, a PNR is
  // required: if it's missing we prompt the admin to write it before confirming.
  function onConfirmClick(b: AdminBooking) {
    if (!bookingPnr(b)) {
      setPnrTarget(b);
      setPnrValue("");
      return;
    }
    updateStatus(b.id, "confirmed");
  }

  async function savePnrAndConfirm() {
    const b = pnrTarget;
    if (!b) return;
    const val = pnrValue.trim().toUpperCase();
    if (!val) { toast.error("Write the PNR value to confirm this ticket"); return; }
    setBusy(true);
    try {
      await setPnr({ data: { id: b.id, pnr: val } });
      patchRow(b.id, { fare_snapshot: { ...(b.fare_snapshot ?? {}), pnr: val } } as Partial<AdminBooking>);
      setPnrTarget(null);
      toast.success(`PNR ${val} saved`);
      await updateStatus(b.id, "confirmed");
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't save PNR");
    } finally {
      setBusy(false);
    }
  }

  async function updatePayment(id: string, uiValue: any) {
    // "Received" is stored as "confirmed" on the server (accepted enum value).
    const payment_status = uiValue === "received" ? "confirmed" : uiValue;
    patchRow(id, { payment_status });
    try {
      await setPayment({ data: { id, payment_status } });
      if (uiValue === "received") toast.success("Payment marked as Received");
    } catch (e: any) { toast.error(e.message); } finally { refresh(); }
  }

  function toBase64(file: File): Promise<string> {
    return new Promise((resolve) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result).split(",")[1]);
      r.readAsDataURL(file);
    });
  }

  async function onTicketFiles(id: string, files: FileList | null) {
    if (!files) return;
    setBusy(true);
    for (const file of Array.from(files)) {
      const base64 = await toBase64(file);
      await upTicket({ data: { id, name: file.name, type: file.type, base64 } });
    }
    refresh(); setBusy(false);
  }

  async function onDocFiles(id: string, kind: "passport" | "payment_slip", files: FileList | null) {
    if (!files || !files.length) return;
    setBusy(true);
    try {
      for (const file of Array.from(files)) {
        const base64 = await toBase64(file);
        await upDoc({ data: { id, kind, name: file.name, type: file.type, base64 } });
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Upload failed");
    } finally {
      refresh(); setBusy(false);
    }
  }

  const [cleanupSummary, setCleanupSummary] = useState<{ removed: number; bookings: number; failed: number; scope: string } | null>(null);

  type CleanupScope = "cancelled" | "confirmed" | "old90" | "filtered";
  const scopeLabels: Record<CleanupScope, string> = {
    cancelled: "Cancelled bookings",
    confirmed: "Confirmed bookings",
    old90: "Bookings older than 90 days",
    filtered: "Current filtered view",
  };

  async function runCleanup(scope: CleanupScope) {
    const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000;
    const targets = (scope === "filtered" ? rows : data).filter((b) => {
      if (scope === "cancelled") return b.status === "cancelled";
      if (scope === "confirmed") return b.status === "confirmed";
      if (scope === "old90") return new Date(b.created_at).getTime() < cutoff;
      return true;
    });

    const jobs = targets.flatMap((b) => [
      ...(b.attachments ?? []).map((a) => ({ id: b.id, path: a.path, field: "attachments" as const })),
      ...(b.payment_slips ?? []).map((a) => ({ id: b.id, path: a.path, field: "payment_slips" as const })),
    ]).filter((j) => !!j.path);

    if (jobs.length === 0) {
      toast.error(`No passport copies or payment slips found in: ${scopeLabels[scope]}`);
      return;
    }
    const ok = await confirm({
      title: "Remove files",
      message: `This cannot be undone.`,
      tone: "danger",
      confirmLabel: "Remove",
      details: [
        { label: "Files", value: String(jobs.length) },
        { label: "Bookings", value: String(targets.length) },
        { label: "Scope", value: scopeLabels[scope] },
      ],
    });
    if (!ok) return;

    setBusy(true);
    setCleanupSummary(null);
    let removed = 0, failed = 0;
    const touched = new Set<string>();
    for (const job of jobs) {
      try {
        await rmDoc({ data: job });
        removed++;
        touched.add(job.id);
      } catch {
        failed++;
      }
    }
    setBusy(false);
    refresh();
    setCleanupSummary({ removed, bookings: touched.size, failed, scope: scopeLabels[scope] });
    if (failed === 0) toast.success(`Removed ${removed} file(s) across ${touched.size} booking(s)`);
    else toast.error(`Removed ${removed} file(s) across ${touched.size} booking(s), ${failed} failed`);
  }

  const kpis = useMemo(() => {
    const total = data.length;
    const needsAction = data.filter((b) => !bookingAction(b).done).length;
    const paymentsPending = data.filter((b) => !isPaid(b.payment_status)).length;
    const ticketsConfirmed = data.filter((b) => b.status === "confirmed").length;
    return { total, needsAction, paymentsPending, ticketsConfirmed };
  }, [data]);


  return (
    <div className="min-h-screen bg-booking-canvas font-booking text-booking-ink animate-premium-fade">
      {dialog}
      {pnrTarget && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-navy/60 p-4 backdrop-blur-sm animate-premium-fade"
          onClick={() => { if (!busy) setPnrTarget(null); }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm animate-premium-scale rounded-2xl bg-card p-6 shadow-2xl ring-1 ring-gold/30"
          >
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gold/10 text-gold"><Ticket className="h-5 w-5" /></span>
              <div className="min-w-0">
                <h3 className="text-sm font-black uppercase tracking-wide text-navy">Write PNR value</h3>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {pnrTarget.booking_ref ?? "This booking"} has no PNR. Enter the PNR to confirm this ticket.
                </p>
              </div>
            </div>
            <input
              autoFocus
              value={pnrValue}
              onChange={(e) => setPnrValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") savePnrAndConfirm(); }}
              placeholder="e.g. ABC123"
              maxLength={50}
              aria-label="PNR value"
              className="mt-4 h-11 w-full rounded-lg border border-border bg-white px-3 text-sm font-semibold uppercase tracking-wide text-booking-ink outline-none placeholder:font-normal placeholder:normal-case placeholder:text-booking-subtle focus:ring-2 focus:ring-gold/40"
            />
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPnrTarget(null)}
                disabled={busy}
                className="rounded-md border border-border bg-white px-4 py-2 text-xs font-bold uppercase tracking-wide text-muted-foreground transition-colors hover:bg-secondary disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={savePnrAndConfirm}
                disabled={busy || !pnrValue.trim()}
                className="rounded-md bg-gold px-4 py-2 text-xs font-black uppercase tracking-wide text-gold-foreground shadow-sm transition-all hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy ? "Saving…" : "Save & Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
      <header className="border-b border-border bg-navy text-navy-foreground">
        <div className="flex items-center justify-between px-4 py-4 sm:px-6">
          <div className="font-serif text-lg font-black uppercase tracking-tight">Agent Group Bookings</div>
          <div className="flex items-center gap-4">
            <AdminHeaderExtras />
            <button onClick={() => logout()} className="text-xs font-bold text-gold">LOGOUT</button>
          </div>
        </div>
        <AdminTabs />
      </header>

      <div className="px-3 py-5 sm:px-5 lg:px-6">
        {/* KPI strip — each card filters the list below */}
        <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            { key: "action", label: "Awaiting your action", value: kpis.needsAction, tone: "bg-booking-amber-soft text-booking-amber", icon: Zap },
            { key: "all", label: "Total bookings", value: kpis.total, tone: "bg-booking-blue-soft text-booking-blue", icon: Plane },
            { key: "confirmed", label: "Tickets confirmed", value: kpis.ticketsConfirmed, tone: "bg-booking-green-soft text-booking-green", icon: CheckCircle2 },
            { key: "payment", label: "Payments pending", value: kpis.paymentsPending, tone: "bg-booking-rose-soft text-booking-rose", icon: CircleDollarSign },
          ].map((k) => {
            const active = ticketFilter === k.key;
            return (
              <button
                key={k.label}
                type="button"
                onClick={() => setTicketFilter(k.key)}
                aria-pressed={active}
                className={`flex min-h-[72px] min-w-0 items-center gap-3 rounded-[14px] border bg-card px-4 py-3 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md ${
                  active ? "border-accent ring-1 ring-accent/40" : "border-border/70"
                }`}
              >
                <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-[11px] ${k.tone}`}><k.icon className="h-4.5 w-4.5" /></span>
                <div className="min-w-0">
                  <div className="text-xl font-extrabold leading-none tabular-nums">{k.value}</div>
                  <div className="mt-1 truncate text-[11px] font-medium text-booking-subtle">{k.label}</div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Header bar */}
        <div className="mb-3 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 sm:flex sm:justify-between">
          <h1 className="flex min-w-0 items-baseline gap-2 text-lg font-extrabold tracking-tight sm:text-2xl">
            <span className="truncate">Agents Group Bookings</span>
            <span className="shrink-0 text-sm font-medium text-booking-subtle">{rows.length} shown</span>
          </h1>
          <div className="col-span-2 flex w-full flex-col items-stretch gap-2 sm:col-auto sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
            <div className="relative w-full sm:w-72">
              <input
                type="text"
                placeholder="Search booking ref or agency…"
                className="h-10 w-full min-w-0 rounded-lg border border-border bg-card pl-9 pr-3 text-sm text-booking-ink shadow-sm outline-none placeholder:text-booking-subtle focus:ring-2 focus:ring-booking-blue/20"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-booking-subtle" />
            </div>
            <select
              className="h-10 rounded-lg border border-border bg-card px-3 text-sm font-semibold shadow-sm outline-none focus:ring-2 focus:ring-booking-blue/20"
              value={ticketFilter}
              onChange={(e) => setTicketFilter(e.target.value)}
            >
              <option value="action">Needs action</option>
              <option value="all">All Status</option>
              <option value="submitted">Submitted</option>
              <option value="pending">On Hold</option>
              <option value="confirmed">Confirmed</option>
            </select>
          </div>
        </div>

        {cleanupSummary && (
          <div className="mb-4 flex items-start justify-between gap-3 rounded-xl border border-navy/10 bg-white p-4 shadow-sm">
            <div>
              <div className="text-[10px] font-black uppercase tracking-wider text-navy/50">Cleanup Report — {cleanupSummary.scope}</div>
              <div className="mt-1 text-sm font-bold text-navy">
                Removed <span className="text-emerald-600">{cleanupSummary.removed}</span> file(s) across{" "}
                <span className="text-navy">{cleanupSummary.bookings}</span> booking(s)
                {cleanupSummary.failed > 0 && <>, <span className="text-rose-600">{cleanupSummary.failed} failed</span></>}
              </div>
            </div>
            <button onClick={() => setCleanupSummary(null)} className="text-[10px] font-black uppercase tracking-wider text-navy/40 hover:text-navy">
              Dismiss
            </button>
          </div>
        )}


        <div className="overflow-hidden rounded-lg bg-card shadow-booking">
          <div className="overflow-x-auto">
            <TooltipProvider delayDuration={250}>
              <table className="w-full min-w-[1360px] table-auto border-collapse text-sm">
                <thead>
                  <tr className="bg-text-primary text-[10px] font-semibold uppercase tracking-wider text-text-inverse">
                    <th className="sticky left-0 z-20 w-[1%] whitespace-nowrap bg-text-primary px-4 py-4 text-left">Booking</th>
                    <th className="px-4 py-4 text-left">Group Type</th>
                    <th className="px-4 py-4 text-left">Agency &amp; Contact</th>
                    <th className="px-4 py-4 text-left">Flight Details</th>
                    <th className="px-4 py-4 text-left">Passenger Names</th>
                    <th className="w-[1%] whitespace-nowrap px-4 py-4 text-left">PNR</th>
                    <th className="w-[1%] whitespace-nowrap px-4 py-4 text-right">Booking Total</th>
                    <th className="w-[1%] whitespace-nowrap px-4 py-4 text-center">Payment Status</th>
                    <th className="w-[1%] whitespace-nowrap px-4 py-4 text-center">Ticket Status</th>
                    <th className="w-[1%] whitespace-nowrap px-4 py-4 text-left">Documents</th>
                    <th className="sticky right-0 z-20 w-[1%] whitespace-nowrap bg-text-primary px-4 py-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((b, index) => (
                    <BookingRow
                      key={b.id}
                      b={b}
                      index={index}
                      busy={busy}
                      onView={() => setViewing(b)}
                      onUpdateStatus={updateStatus}
                      onConfirm={() => onConfirmClick(b)}
                      onUpdatePayment={updatePayment}
                      onDocFiles={onDocFiles}
                      onTicketFiles={onTicketFiles}
                      onRemoveDoc={(path, field) => {
                        if (!path) { toast.error("This file has no stored reference and cannot be removed automatically."); return; }
                        rmDoc({ data: { id: b.id, path, field } })
                          .then(() => { toast.success("Document removed successfully"); refresh(); })
                          .catch((e: any) => toast.error(e?.message ?? "Failed to remove file"));
                      }}
                      onRemoveTicket={(path) => {
                        rmTicket({ data: { id: b.id, path } })
                          .then(() => refresh())
                          .catch((err: any) => alert(err?.message ?? "Failed to remove ticket"));
                      }}
                      onDelete={() => onDelete(b)}
                      onSaveFod={(v) => saveFod(b, v)}
                    />
                  ))}
                </tbody>
              </table>
            </TooltipProvider>
          </div>
          {rows.length === 0 && <div className="p-10 text-center text-sm text-booking-subtle">No bookings match your filters</div>}
        </div>
      </div>

      {viewing && (() => {
        const lines = flightBlockLines(viewing.fare_snapshot, { fare: viewing.fare_on_demand }).filter((line) => !line.startsWith("Fare:"));
        const originalFare = fareAmount(viewing.fare_snapshot?.price_text);
        const verifiedFare = fareAmount(viewing.fare_on_demand);
        const perSeat = verifiedFare ?? originalFare;
        return <BookingDetailsDialog open onClose={() => setViewing(null)} bookingRef={viewing.booking_ref ?? "—"} createdLabel={formatDateTime(viewing.created_at)} route={lines[0] ?? "—"} routeCodes={lines[1] ?? ""} airline={String(viewing.fare_snapshot?.airline ?? "")} flightDetails={lines.slice(3)} baggage={String(viewing.fare_snapshot?.baggage ?? "")} seats={viewing.seats} passengerNames={viewing.passenger_names ?? ""} totalLabel={perSeat ? `PKR ${(perSeat * viewing.seats).toLocaleString()}` : "FARE ON DEMAND"} totalHint={perSeat ? `${viewing.seats} seat${viewing.seats === 1 ? "" : "s"} × PKR ${perSeat.toLocaleString()}/seat` : "Fare awaiting admin verification"} />;
      })()}

    </div>
  );
}

function BookingRow({
  b, index, busy, onView, onUpdateStatus, onConfirm, onUpdatePayment, onDocFiles, onTicketFiles, onRemoveDoc, onRemoveTicket, onDelete, onSaveFod,
}: {
  b: AdminBooking;
  index: number;
  busy: boolean;
  onView: () => void;
  onUpdateStatus: (id: string, status: "confirmed" | "cancelled" | "pending") => void;
  onConfirm: () => void;
  onUpdatePayment: (id: string, v: any) => void;
  onDocFiles: (id: string, kind: "passport" | "payment_slip", files: FileList | null) => void;
  onTicketFiles: (id: string, files: FileList | null) => void;
  onRemoveDoc: (path: string, field: "attachments" | "payment_slips") => void;
  onRemoveTicket: (path: string) => void;
  onDelete: () => void;
  onSaveFod: (v: string) => void;
}) {
  const ticketInputRef = useRef<HTMLInputElement>(null);
  const lines = flightBlockLines(b.fare_snapshot, { fare: b.fare_on_demand }).filter((l) => !l.startsWith("Fare:"));
  const route = lines[0] ?? "—";
  const routeCodes = lines[1] ?? "";
  const airline = String(b.fare_snapshot?.airline ?? "");
  const details = lines.slice(3).filter((line) => line !== "Flight Details:");
  const passengers = (b.passenger_names ?? "").split("\n").filter(Boolean);
  const travelDocuments = b.attachments ?? [];
  const slips = b.payment_slips ?? [];
  const hasPassport = travelDocuments.some((a: any) => a?.kind === "passport");
  const hasSlip = slips.length > 0;
  const tickets = (b.tickets ?? []) as any[];
  const originalFare = fareAmount(b.fare_snapshot?.price_text);
  const verifiedFare = fareAmount(b.fare_on_demand);
  const fareOnDemandEligible = originalFare === null;
  const needsFareOnDemand = fareOnDemandEligible && verifiedFare === null;
  const perSeat = verifiedFare ?? originalFare ?? 0;
  const totalCost = perSeat * b.seats;
  const paid = isPaid(b.payment_status);
  const isSelf = b.fare_snapshot?.group_type?.toLowerCase() === "self";
  const action = bookingAction(b);
  // Full-row highlight while a ticket still needs handling: Submitted or On Hold.
  const highlight = b.status === "submitted" || b.status === "pending";
  const confirmReason =
    b.status === "confirmed" ? "Ticket confirmed"
    : needsFareOnDemand ? "Set a fare first (Fare On Demand)"
    : !paid ? "Mark payment Received or Added in Ledger"
    : tickets.length === 0 ? "Upload a ticket first"
    : !bookingPnr(b) ? "Confirm — you'll be asked to write the PNR"
    : "Confirm ticket";
  const confirmDisabled = b.status === "confirmed" || needsFareOnDemand || !paid || tickets.length === 0 || busy;
  const rowTone = b.status === "cancelled" ? "opacity-60" : highlight ? "bg-booking-amber-soft/80 shadow-[inset_4px_0_0_var(--color-booking-amber,currentColor)]" : !action.done ? "bg-booking-amber-soft/15" : "";

  return (
    <>
      <motion.tr
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: Math.min(index, 12) * 0.025, duration: 0.25 }}
        className={`group border-b border-border/70 align-top hover:bg-bg-primary ${rowTone}`}
      >
        <td className={`sticky left-0 z-10 px-4 py-4 shadow-[1px_0_0_var(--border)] group-hover:bg-bg-primary ${highlight ? "bg-booking-amber-soft/80" : !action.done ? "bg-bg-accent-tint" : "bg-card"}`}>
          <p className="font-mono text-xs font-semibold text-booking-ink">{b.booking_ref ?? "—"}</p>
          <p className="mt-1 text-[10px] text-booking-subtle">{formatDateTime(b.created_at)}</p>
          <span className={`mt-2 inline-flex items-center gap-1 rounded-md px-2 py-1 text-[9px] font-semibold ${action.done ? "bg-booking-green-soft text-booking-green" : "bg-booking-amber-soft text-booking-amber"}`}>
            {action.done ? <CheckCircle2 className="h-3 w-3" /> : <Zap className="h-3 w-3" />}{action.label}
          </span>
        </td>
        <td className="px-4 py-4">
          <span className={`inline-flex items-center rounded-md px-2 py-1 text-[9px] font-semibold uppercase ${isSelf ? "bg-booking-rose-soft text-booking-rose" : "bg-booking-blue-soft text-booking-ink"}`}>
            {isSelf ? "Self" : "Party"}
          </span>
        </td>
        <td className="px-4 py-4">
          <p className="font-semibold text-booking-ink">{b.agency_name || "—"}</p>
          <p className="mt-1 text-xs text-booking-subtle">{b.contact_person || "No contact name"}</p>
          <p className="text-[10px] text-booking-subtle">{b.agent_phone || b.contact_phone || "—"}</p>
          {b.agent_email && <p className="truncate text-[10px] text-booking-subtle">{b.agent_email}</p>}
        </td>
        <td className="px-4 py-4">
          <p className="font-semibold text-booking-ink">{route}</p>
          <p className="text-[10px] font-medium text-booking-subtle">{routeCodes}</p>
          <p className="mt-1 text-xs text-booking-ink">{airline || "Airline —"}</p>
          <div className="mt-1 space-y-0.5">{details.map((line, i) => <p key={`${line}-${i}`} className="font-mono text-[10px] leading-snug text-booking-subtle">{line}</p>)}</div>
        </td>
        <td className="px-4 py-4">
          {passengers.length > 0 ? (
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                {passengers.slice(0, 3).map((line, pi) => (
                  <p key={pi} className="truncate font-semibold uppercase text-booking-ink">{line.split("|")[0]?.trim().toUpperCase()}</p>
                ))}
              </div>
            </div>
          ) : <p className="font-semibold text-booking-ink">—</p>}
          <p className="mt-1 text-xs text-booking-subtle">{passengers.length > 3 ? `+${passengers.length - 3} more · ` : ""}{b.seats} seat{b.seats === 1 ? "" : "s"}</p>
        </td>
        <td className="px-4 py-4">
          <p className="font-mono text-xs font-semibold text-booking-ink">{bookingPnr(b) || "—"}</p>
        </td>
        <td className="px-4 py-4 text-right">
          {needsFareOnDemand ? (
            <p className="text-[10px] font-semibold uppercase tracking-wide text-booking-amber">Fare On Demand</p>
          ) : (
            <>
              <p className="font-semibold tabular-nums text-booking-ink">PKR {totalCost.toLocaleString()}</p>
              <p className="mt-1 text-xs text-booking-subtle">{b.seats} × PKR {perSeat.toLocaleString()}</p>
            </>
          )}
        </td>
        <td className="px-4 py-4 text-center">
          <select
              aria-label={`Payment status for ${b.booking_ref ?? "booking"}`}
              className={`w-full rounded-md border px-2 py-2 text-[10px] font-semibold outline-none focus:ring-2 focus:ring-ring/30 ${
                paid ? "border-booking-green/30 bg-booking-green-soft/40 text-booking-green"
                : b.payment_status === "ledger" ? "border-booking-blue/30 bg-booking-blue-soft/40 text-booking-ink"
                : "border-booking-amber/30 bg-booking-amber-soft/50 text-booking-amber"
              }`}
              value={
                b.payment_status === "confirmed"
                  ? "received"
                  : b.payment_status === "pending" || !b.payment_status
                    ? "unpaid"
                    : b.payment_status
              }
              onChange={(e) => onUpdatePayment(b.id, e.target.value)}
            >
              <option value="unpaid">Unpaid</option><option value="received">Received</option><option value="ledger">Added in Ledger</option>
            </select>
        </td>
        <td className="px-4 py-4 text-center">
          <select
              aria-label={`Ticket status for ${b.booking_ref ?? "booking"}`}
              className="w-full rounded-md border border-border bg-card px-2 py-2 text-[10px] font-semibold text-booking-ink outline-none focus:ring-2 focus:ring-ring/30"
              value={b.status || "submitted"}
              onChange={(e) => onUpdateStatus(b.id, e.target.value as any)}
            >
              <option value="submitted">Submitted</option><option value="pending">On Hold</option>{b.status === "confirmed" && <option value="confirmed">Confirmed</option>}
            </select>
        </td>
        <td className="px-4 py-4">
          <div className="space-y-3">
            <div><p className="mb-1 text-[9px] font-semibold uppercase text-booking-subtle">Passport Copies</p><DocCell files={travelDocuments} attachedLabel="Attached" uploadLabel="Upload passport" hideUpload={hasPassport} maxFiles={b.seats + travelDocuments.filter((a: any) => a?.kind !== "passport").length} onFiles={(fl) => onDocFiles(b.id, "passport", fl)} onRemove={(p) => onRemoveDoc(p, "attachments")} /></div>
            <div><p className="mb-1 text-[9px] font-semibold uppercase text-booking-subtle">Payment slip</p><DocCell files={slips} attachedLabel="Attached" uploadLabel="Upload" hideUpload={hasSlip} onFiles={(fl) => onDocFiles(b.id, "payment_slip", fl)} onRemove={(p) => onRemoveDoc(p, "payment_slips")} /></div>
          </div>
        </td>
        <td className={`sticky right-0 z-10 px-3 py-4 shadow-[-1px_0_0_var(--border)] group-hover:bg-bg-primary ${highlight ? "bg-booking-amber-soft/80" : !action.done ? "bg-bg-accent-tint" : "bg-card"}`}>
          <input ref={ticketInputRef} type="file" multiple className="hidden" disabled={busy} onChange={(e) => onTicketFiles(b.id, e.target.files)} />
          <div className="flex min-h-10 items-center justify-center gap-2">
             <Tooltip><TooltipTrigger asChild><Button type="button" variant="ghost" size="icon" onClick={onView} aria-label="View booking" className="h-9 w-9 rounded-md text-booking-ink"><Eye className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent>View booking</TooltipContent></Tooltip>
            {fareOnDemandEligible && (
              <div className="w-32 shrink-0 text-left">
                <FareOnDemandCell value={b.fare_on_demand ?? ""} placeholder={needsFareOnDemand ? "Set fare" : "Edit fare"} attention={needsFareOnDemand} onSave={onSaveFod} />
              </div>
            )}
            {b.status !== "confirmed" && tickets.length === 0 && (
              <Tooltip><TooltipTrigger asChild><Button size="icon" variant="secondary" disabled={busy} onClick={() => ticketInputRef.current?.click()} className="h-9 w-9 rounded-md" aria-label="Upload ticket"><Upload className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent>Upload ticket</TooltipContent></Tooltip>
            )}
            {b.status === "confirmed" && (
              <Tooltip><TooltipTrigger asChild><Button variant="outline" size="icon" asChild className="h-9 w-9 rounded-md text-booking-green" aria-label="View in Group Tickets Confirmed"><Link to="/admin/tickets"><ExternalLink className="h-4 w-4" /></Link></Button></TooltipTrigger><TooltipContent>View in Group Tickets Confirmed</TooltipContent></Tooltip>
            )}
            <Tooltip><TooltipTrigger asChild><span><Button size="sm" disabled={confirmDisabled} onClick={onConfirm} aria-label="Confirm ticket" className={`h-9 shrink-0 rounded-md px-3 text-[11px] font-semibold ${b.status === "confirmed" ? "bg-booking-green-soft text-booking-green" : "bg-booking-green text-white hover:bg-booking-green/90"}`}><CheckCircle2 className="h-4 w-4" />Confirm</Button></span></TooltipTrigger><TooltipContent>{confirmReason}</TooltipContent></Tooltip>
            <Tooltip><TooltipTrigger asChild><Button variant="outline" size="icon" onClick={onDelete} aria-label="Delete booking" className="h-9 w-9 rounded-md text-booking-rose"><Trash2 className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent>Delete booking</TooltipContent></Tooltip>
            {tickets.map((t, i) => (
              <Tooltip key={i}><TooltipTrigger asChild><Button variant="ghost" size="icon" onClick={() => onRemoveTicket(t.path)} aria-label="Remove ticket" className="h-9 w-9 rounded-md text-booking-rose"><Ticket className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent>Remove ticket{tickets.length > 1 ? ` ${i + 1}` : ""}</TooltipContent></Tooltip>
            ))}
          </div>
        </td>
      </motion.tr>
    </>
  );
}
