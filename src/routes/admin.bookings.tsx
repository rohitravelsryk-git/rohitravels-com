import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Plane, CheckCircle2, Ticket, Paperclip, Upload, Pencil, Trash2, Search, Zap, ChevronDown, ChevronUp, CircleDollarSign, FileCheck2 } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { adminLogout, supabase } from "@/lib/fares.functions";
import { listBookingsAdmin, setBookingStatusAdmin, setBookingPaymentStatus, uploadBookingTicket, removeBookingTicket, uploadBookingDoc, removeBookingDoc, updateBookingAdmin, deleteBookingAdmin, setBookingFareOnDemand, type AdminBooking } from "@/lib/agent-bookings.functions";
import { flightBlockLines } from "@/lib/booking-flight-format";
import { AdminHeaderExtras } from "@/components/AdminHeaderExtras";
import { AdminTabs } from "@/components/AdminTabs";
import { FareOnDemandCell } from "@/components/FareOnDemandCell";
import { DocCell } from "@/components/DocCell";
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

function formatDateTime(iso: string) {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}-${d.toLocaleString("en-US", { month: "short" })}-${String(d.getFullYear()).slice(-2)} ${p(d.getHours())}:${p(d.getMinutes())}`;
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
  const router = useRouter();
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
  const saveBooking = useServerFn(updateBookingAdmin);
  const removeBooking = useServerFn(deleteBookingAdmin);
  const setFod = useServerFn(setBookingFareOnDemand);
  const logout = useServerFn(adminLogout);

  const { data } = useSuspenseQuery({
    queryKey: ["admin-bookings"],
    queryFn: () => list(),
    refetchInterval: 60_000,
  });

  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [ticketFilter, setTicketFilter] = useState("all");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [editing, setEditing] = useState<AdminBooking | null>(null);
  const [form, setForm] = useState({ seats: 1, passenger_names: "", contact_phone: "", notes: "" });

  function patchRow(id: string, patch: Partial<AdminBooking>) {
    qc.setQueryData<AdminBooking[]>(["admin-bookings"], (rows) =>
      (rows ?? []).map((r) => (r.id === id ? { ...r, ...patch } : r)),
    );
  }
  const refresh = () => qc.invalidateQueries({ queryKey: ["admin-bookings"] });

  function openEdit(b: AdminBooking) {
    setEditing(b);
    setForm({ seats: b.seats, passenger_names: b.passenger_names ?? "", contact_phone: b.contact_phone ?? "", notes: b.notes ?? "" });
  }

  async function submitEdit() {
    if (!editing) return;
    setBusy(true);
    try {
      await saveBooking({ data: { id: editing.id, ...form, seats: Number(form.seats) || 1 } });
    } catch (e: any) { alert(e.message); } finally { refresh(); setBusy(false); setEditing(null); }
  }

  async function saveFod(b: AdminBooking, v: string) {
    // The agent's "Booking Total" is this per-seat fare × their booked seats,
    // so ask the admin to verify the calculated total before it goes live.
    const perSeat = Number(String(v).replace(/[^\d.]/g, ""));
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
      if (perSeat > 0) toast.success(`Fare verified — agent total PKR ${(perSeat * b.seats).toLocaleString()}`);
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
      } else if (ticketFilter !== "all") {
        const st = b.status === "confirmed" ? "confirmed" : b.status === "pending" ? "pending" : "submitted";
        if (st !== ticketFilter) return false;
      }
      if (!q) return true;
      return [b.booking_ref, b.agency_name, b.contact_person, b.contact_phone].some(s => s?.toLowerCase().includes(q));
    });
    // Actionable bookings float to the top, furthest-along first, then newest.
    return [...matched].sort((a, b) => {
      const sa = bookingAction(a), sb = bookingAction(b);
      if (sa.done !== sb.done) return sa.done ? 1 : -1;
      if (!sa.done && sa.priority !== sb.priority) return sb.priority - sa.priority;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [data, search, ticketFilter]);

  async function updateStatus(id: string, status: "confirmed" | "cancelled" | "pending") {
    patchRow(id, { status });
    try {
      await setStatus({ data: { id, status } });
      if (status === "confirmed") toast.success("Ticket is Confirmed — booking finalized");
    } catch (e: any) { toast.error(e.message); } finally { refresh(); }
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
    if (!files) return;
    setBusy(true);
    for (const file of Array.from(files)) {
      const base64 = await toBase64(file);
      await upDoc({ data: { id, kind, name: file.name, type: file.type, base64 } });
    }
    refresh(); setBusy(false);
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
    const docsMissing = data.filter(
      (b) => !((b.attachments ?? []).some((a: any) => a.kind === "passport")) || !((b.payment_slips ?? []).length),
    ).length;
    return { total, needsAction, paymentsPending, ticketsConfirmed, docsMissing };
  }, [data]);


  return (
    <div className="min-h-screen bg-booking-canvas font-booking text-booking-ink animate-premium-fade">
      {dialog}
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
                onClick={() => k.key !== "payment" && setTicketFilter(k.key)}
                aria-pressed={active}
                className={`flex min-h-[72px] min-w-0 items-center gap-3 rounded-[14px] border bg-card px-4 py-3 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md ${
                  active ? "border-accent ring-1 ring-accent/40" : "border-border/70"
                } ${k.key === "payment" ? "cursor-default hover:translate-y-0" : ""}`}
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
            <span className="truncate">All Group Bookings</span>
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
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  disabled={busy}
                  className="flex items-center gap-1.5 rounded-md border border-input bg-card px-3 py-1.5 text-xs font-bold text-foreground outline-none hover:bg-muted disabled:opacity-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  {busy ? "Cleaning…" : "Clean up documents"}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {(["cancelled", "confirmed", "old90", "filtered"] as const).map((s) => (
                  <DropdownMenuItem key={s} onSelect={() => runCleanup(s)}>
                    {scopeLabels[s]}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
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
              <table className="w-full min-w-[1640px] table-fixed border-collapse text-sm">
                <colgroup>
                  <col className="w-[10%]" /><col className="w-[12%]" /><col className="w-[18%]" />
                  <col className="w-[10%]" /><col className="w-[11%]" /><col className="w-[10%]" />
                  <col className="w-[11%]" /><col className="w-[9%]" /><col className="w-[9%]" />
                </colgroup>
                <thead>
                  <tr className="bg-text-primary text-[10px] font-semibold uppercase tracking-wider text-text-inverse">
                    <th className="sticky left-0 z-20 bg-text-primary px-4 py-4 text-left">Booking</th>
                    <th className="px-4 py-4 text-left">Agency &amp; Contact</th>
                    <th className="px-4 py-4 text-left">Flight Details</th>
                    <th className="px-4 py-4 text-left">Passengers</th>
                    <th className="px-4 py-4 text-right">Fare &amp; Total</th>
                    <th className="px-4 py-4 text-center">Payment</th>
                    <th className="px-4 py-4 text-left">Documents</th>
                    <th className="px-4 py-4 text-center">Ticket Status</th>
                    <th className="sticky right-0 z-20 bg-text-primary px-4 py-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((b, index) => (
                    <BookingRow
                      key={b.id}
                      b={b}
                      index={index}
                      busy={busy}
                      expanded={!!expanded[b.id]}
                      onToggle={() => setExpanded((s) => ({ ...s, [b.id]: !s[b.id] }))}
                      onEdit={() => openEdit(b)}
                      onUpdateStatus={updateStatus}
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

      {editing && (
        <div className="fixed inset-0 z-[90] grid place-items-center bg-text-primary/30 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="edit-booking-title">
          <div className="w-full max-w-xl rounded-xl bg-bg-secondary p-6 shadow-lg">
            <div className="flex items-start justify-between gap-4">
              <div><h2 id="edit-booking-title" className="text-xl font-semibold">Edit booking</h2><p className="mt-1 text-sm text-text-secondary">{editing.booking_ref}</p></div>
              <Button variant="ghost" size="sm" onClick={() => setEditing(null)}>Close</Button>
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="text-xs font-medium text-text-secondary">Seats<input type="number" min={1} value={form.seats} onChange={(e) => setForm((v) => ({ ...v, seats: Number(e.target.value) }))} className="mt-1 h-10 w-full rounded-sm border border-border-default bg-bg-secondary px-3 text-sm" /></label>
              <label className="text-xs font-medium text-text-secondary">Contact phone<input value={form.contact_phone} onChange={(e) => setForm((v) => ({ ...v, contact_phone: e.target.value }))} className="mt-1 h-10 w-full rounded-sm border border-border-default bg-bg-secondary px-3 text-sm" /></label>
              <label className="text-xs font-medium text-text-secondary sm:col-span-2">Passenger names<textarea rows={5} value={form.passenger_names} onChange={(e) => setForm((v) => ({ ...v, passenger_names: e.target.value }))} className="mt-1 w-full rounded-sm border border-border-default bg-bg-secondary px-3 py-2 text-sm" /></label>
              <label className="text-xs font-medium text-text-secondary sm:col-span-2">Notes<textarea rows={3} value={form.notes} onChange={(e) => setForm((v) => ({ ...v, notes: e.target.value }))} className="mt-1 w-full rounded-sm border border-border-default bg-bg-secondary px-3 py-2 text-sm" /></label>
            </div>
            <div className="mt-6 flex justify-end gap-2"><Button variant="secondary" onClick={() => setEditing(null)}>Cancel</Button><Button disabled={busy} onClick={submitEdit}>{busy ? "Saving…" : "Save changes"}</Button></div>
          </div>
        </div>
      )}
    </div>
  );
}

function splitName(line: string) {
  const parts = line.split("|").map((s) => s.trim());
  const nameParts = (parts[0] || "").split(" ").filter(Boolean);
  const start = ["mr", "mrs", "ms", "miss", "master"].includes(nameParts[0]?.toLowerCase() ?? "") ? 1 : 0;
  const sur = nameParts.length > 1 ? nameParts[nameParts.length - 1] : "";
  const given = nameParts.slice(start, nameParts.length - 1).join(" ") || nameParts[start] || "";
  return { given, sur, extra: parts.slice(1).filter(Boolean).join(" · ") };
}

function BookingRow({
  b, index, busy, expanded, onToggle, onEdit, onUpdateStatus, onUpdatePayment, onDocFiles, onTicketFiles, onRemoveDoc, onRemoveTicket, onDelete, onSaveFod,
}: {
  b: AdminBooking;
  index: number;
  busy: boolean;
  expanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onUpdateStatus: (id: string, status: "confirmed" | "cancelled" | "pending") => void;
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
  const passports = (b.attachments ?? []).filter((a: any) => a.kind === "passport");
  const slips = (b.payment_slips ?? []).slice(0, 1);
  const tickets = (b.tickets ?? []) as any[];
  const perSeat = Number(b.fare_on_demand?.replace(/[^\d]/g, "") || b.fare_snapshot?.price_text?.replace(/[^\d]/g, "") || 0);
  const totalCost = perSeat * b.seats;
  const paid = isPaid(b.payment_status);
  const isSelf = b.fare_snapshot?.group_type?.toLowerCase() === "self";
  const action = bookingAction(b);
  const rowTone = b.status === "cancelled" ? "opacity-60" : !action.done ? "bg-booking-amber-soft/10" : "";

  return (
    <>
      <motion.tr
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: Math.min(index, 12) * 0.025, duration: 0.25 }}
        className={`group border-b border-border/70 align-top hover:bg-bg-primary ${rowTone}`}
      >
        <td className={`sticky left-0 z-10 px-4 py-4 shadow-[1px_0_0_var(--border)] group-hover:bg-bg-primary ${!action.done ? "bg-bg-accent-tint" : "bg-card"}`}>
          <p className="font-mono text-xs font-semibold text-booking-ink">{b.booking_ref ?? "—"}</p>
          <p className="mt-1 text-[10px] text-booking-subtle">{formatDateTime(b.created_at)}</p>
          <span className={`mt-2 inline-flex items-center gap-1 rounded-md px-2 py-1 text-[9px] font-semibold ${action.done ? "bg-booking-green-soft text-booking-green" : "bg-booking-amber-soft text-booking-amber"}`}>
            {action.done ? <CheckCircle2 className="h-3 w-3" /> : <Zap className="h-3 w-3" />}{action.label}
          </span>
        </td>
        <td className="px-4 py-4">
          <div className="flex items-center gap-2"><p className="font-semibold text-booking-ink">{b.agency_name || "—"}</p>{isSelf && <span className="rounded bg-booking-rose-soft px-1.5 py-0.5 text-[8px] font-semibold uppercase text-booking-rose">Self</span>}</div>
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
          <p className="font-semibold text-booking-ink">{passengers[0]?.split("|")[0] || "—"}</p>
          <p className="mt-1 text-xs text-booking-subtle">{b.seats} seat{b.seats === 1 ? "" : "s"} · PNR {String(b.fare_snapshot?.pnr ?? "—")}</p>
          <Button variant="ghost" size="sm" onClick={onToggle} className="mt-2 h-8 px-2 text-[10px]">
            {expanded ? <ChevronUp /> : <ChevronDown />}{expanded ? "Hide passengers" : `Passenger list (${passengers.length})`}
          </Button>
        </td>
        <td className="px-4 py-4 text-right">
          <FareOnDemandCell value={b.fare_on_demand ?? ""} onSave={onSaveFod} />
          <p className="mt-2 text-sm font-semibold tabular-nums text-booking-ink">PKR {totalCost.toLocaleString()}</p>
          <p className="text-[10px] text-booking-subtle">{b.seats} × PKR {perSeat.toLocaleString()}</p>
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
          <p className="mt-2 text-[10px] text-booking-subtle">{slips.length ? `${slips.length} slip attached` : "No slip attached"}</p>
        </td>
        <td className="px-4 py-4">
          <div className="space-y-3">
            <div><p className="mb-1 text-[9px] font-semibold uppercase text-booking-subtle">Passport</p><DocCell files={passports} attachedLabel="Attached" uploadLabel="Upload" onFiles={(fl) => onDocFiles(b.id, "passport", fl)} onRemove={(p) => onRemoveDoc(p, "attachments")} /></div>
            <div><p className="mb-1 text-[9px] font-semibold uppercase text-booking-subtle">Payment slip</p><DocCell files={slips} attachedLabel="Attached" uploadLabel="Upload" onFiles={(fl) => onDocFiles(b.id, "payment_slip", fl)} onRemove={(p) => onRemoveDoc(p, "payment_slips")} /></div>
          </div>
        </td>
        <td className="px-4 py-4 text-center">
          <select
              aria-label={`Ticket status for ${b.booking_ref ?? "booking"}`}
              className={`w-full rounded-md border px-2 py-2 text-[10px] font-semibold outline-none focus:ring-2 focus:ring-ring/30 ${
                b.status === "confirmed" ? "border-booking-green/30 bg-booking-green-soft/40 text-booking-green"
                : b.status === "pending" ? "border-booking-amber/30 bg-booking-amber-soft/50 text-booking-amber"
                : "border-border bg-bg-tertiary text-booking-ink"
              }`}
              value={b.status || "submitted"}
              onChange={(e) => onUpdateStatus(b.id, e.target.value as any)}
            >
              <option value="submitted">Submitted</option><option value="pending">On Hold</option>{b.status === "confirmed" && <option value="confirmed">Confirmed</option>}
            </select>
          {tickets.length > 0 && (
            <div className="mt-2 flex min-w-0 flex-wrap justify-center gap-1">
              {tickets.map((t, i) => (
                <a key={i} href={t.url} target="_blank" rel="noopener noreferrer" className="truncate rounded-md bg-booking-blue-soft/40 px-2 py-1 text-[9px] font-semibold text-booking-ink">
                  Ticket {tickets.length > 1 ? i + 1 : "attached"}
                </a>
              ))}
            </div>
          )}
        </td>
        <td className={`sticky right-0 z-10 px-3 py-4 shadow-[-1px_0_0_var(--border)] group-hover:bg-bg-primary ${!action.done ? "bg-bg-accent-tint" : "bg-card"}`}>
          <input ref={ticketInputRef} type="file" multiple className="hidden" disabled={busy} onChange={(e) => onTicketFiles(b.id, e.target.files)} />
          <div className="flex flex-col gap-2">
            {b.status !== "confirmed" && tickets.length === 0 && <Button size="sm" variant="secondary" disabled={busy} onClick={() => ticketInputRef.current?.click()} className="w-full text-[10px]"><Upload />Upload ticket</Button>}
            {b.status !== "confirmed" && <Button size="sm" disabled={tickets.length === 0 || busy} onClick={() => onUpdateStatus(b.id, "confirmed")} className="w-full text-[10px]"><CheckCircle2 />Confirm</Button>}
            <div className="grid grid-cols-2 gap-1.5">
              <Tooltip><TooltipTrigger asChild><Button variant="outline" size="icon" onClick={onEdit} aria-label="Edit booking" className="h-8 w-full"><Pencil /></Button></TooltipTrigger><TooltipContent>Edit booking</TooltipContent></Tooltip>
              <Tooltip><TooltipTrigger asChild><Button variant="outline" size="icon" onClick={onDelete} aria-label="Delete booking" className="h-8 w-full text-booking-rose"><Trash2 /></Button></TooltipTrigger><TooltipContent>Delete booking</TooltipContent></Tooltip>
            </div>
            {tickets.map((t, i) => <Button key={i} variant="ghost" size="sm" onClick={() => onRemoveTicket(t.path)} className="h-8 w-full text-[9px] text-booking-rose"><Ticket />Remove ticket {tickets.length > 1 ? i + 1 : ""}</Button>)}
          </div>
        </td>
      </motion.tr>
      {expanded && (
        <tr className="border-b border-border bg-bg-tertiary/60">
          <td colSpan={9} className="px-4 py-4">
          <div className="grid gap-4 lg:grid-cols-[minmax(420px,1fr)_minmax(240px,0.55fr)]">
          <div className="min-w-0 overflow-hidden rounded-md bg-card shadow-sm">
            <div className="grid grid-cols-[24px_minmax(0,1fr)_minmax(0,1fr)] gap-x-2 bg-text-primary px-3 py-2 text-[9px] font-semibold uppercase tracking-wide text-text-inverse">
              <span>#</span><span>GIVEN NAME</span><span>SUR NAME</span>
            </div>
            {passengers.length === 0 && <div className="px-2 py-2 text-[10px] text-muted-foreground">No passenger names recorded</div>}
            {passengers.map((line, i) => {
              const { given, sur, extra } = splitName(line);
              return (
                <div key={i} className="grid grid-cols-[24px_minmax(0,1fr)_minmax(0,1fr)] items-center gap-x-2 border-t border-border px-2.5 py-2 text-xs text-foreground">
                  <span className="font-bold text-muted-foreground">{i + 1}</span>
                  <span className="truncate font-bold uppercase tracking-wide">{given ? given.toUpperCase() : "—"}</span>
                  <span className="truncate font-semibold uppercase tracking-wide">{sur ? sur.toUpperCase() : "—"}{extra ? <em className="ml-1 not-italic font-normal normal-case text-muted-foreground">{extra}</em> : null}</span>
                </div>
              );
            })}
          </div>
          <div className="rounded-md bg-card p-4 shadow-sm">
            <p className="text-[9px] font-semibold uppercase text-booking-subtle">Booking notes</p>
            <p className="mt-2 text-xs text-booking-ink">{b.notes || "No notes recorded."}</p>
            <p className="mt-4 text-[10px] text-booking-subtle">Booked {formatDateTime(b.created_at)}</p>
          </div>
          </div>
          </td>
        </tr>
      )}
    </>
  );
}
