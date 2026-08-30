import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Plane, LogOut, CheckCircle2, Ticket, Paperclip, Upload, Pencil, Trash2, Search, Zap, MoreHorizontal, ChevronDown, ChevronUp } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { adminLogout, supabase } from "@/lib/fares.functions";
import { listBookingsAdmin, setBookingStatusAdmin, setBookingPaymentStatus, uploadBookingTicket, removeBookingTicket, uploadBookingDoc, removeBookingDoc, updateBookingAdmin, deleteBookingAdmin, setBookingFareOnDemand, type AdminBooking } from "@/lib/agent-bookings.functions";
import { flightBlockLines } from "@/lib/booking-flight-format";
import { AdminHeaderExtras } from "@/components/AdminHeaderExtras";
import { AdminTabs } from "@/components/AdminTabs";
import { FareOnDemandCell } from "@/components/FareOnDemandCell";
import { DocCell } from "@/components/DocCell";

export const Route = createFileRoute("/admin/bookings")({
  head: () => ({ meta: [{ title: "Agent Bookings — Rohi Admin" }] }),
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

function AdminBookingsPage() {
  const router = useRouter();
  const qc = useQueryClient();

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
    refetchInterval: 10_000,
  });

  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [ticketFilter, setTicketFilter] = useState("all");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [uploadingId, setUploadingId] = useState<string | null>(null);
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

  async function saveFod(id: string, v: string) {
    patchRow(id, { fare_on_demand: v } as Partial<AdminBooking>);
    try { await setFod({ data: { id, fare_on_demand: v } }); } catch (e: any) { alert(e.message); refresh(); }
  }

  async function onDelete(b: AdminBooking) {
    if (!confirm(`Delete this booking?`)) return;
    try { await removeBooking({ data: { id: b.id } }); } catch (e: any) { alert(e.message); } finally { refresh(); }
  }

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.filter((b) => {
      if (ticketFilter !== "all") {
        const st = b.status === "confirmed" ? "confirmed" : b.status === "pending" ? "pending" : "submitted";
        if (st !== ticketFilter) return false;
      }
      if (!q) return true;
      return [b.booking_ref, b.agency_name, b.contact_person, b.contact_phone].some(s => s?.toLowerCase().includes(q));
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
    try { await setPayment({ data: { id, payment_status } }); } catch (e: any) { alert(e.message); } finally { refresh(); }
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
    if (!confirm(`Remove ${jobs.length} file(s) from ${targets.length} booking(s) in "${scopeLabels[scope]}"? This cannot be undone.`)) return;

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
    const paymentsPending = data.filter((b) => !isPaid(b.payment_status)).length;
    const ticketsConfirmed = data.filter((b) => b.status === "confirmed").length;
    const docsMissing = data.filter(
      (b) => !((b.attachments ?? []).some((a: any) => a.kind === "passport")) || !((b.payment_slips ?? []).length),
    ).length;
    return { total, paymentsPending, ticketsConfirmed, docsMissing };
  }, [data]);


  return (
    <div className="min-h-screen bg-background">
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

      <div className="px-4 py-6 sm:px-6">
        {/* KPI strip */}
        <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            { label: "Total bookings", value: kpis.total, tone: "bg-blue-100 text-blue-700", icon: Plane },
            { label: "Payments pending", value: kpis.paymentsPending, tone: "bg-amber-100 text-amber-700", icon: Zap },
            { label: "Tickets confirmed", value: kpis.ticketsConfirmed, tone: "bg-emerald-100 text-emerald-700", icon: CheckCircle2 },
            { label: "Documents missing", value: kpis.docsMissing, tone: "bg-rose-100 text-rose-700", icon: Paperclip },
          ].map((k) => (
            <div key={k.label} className="flex min-w-0 items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 shadow-sm">
              <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-md ${k.tone}`}><k.icon className="h-4 w-4" /></span>
              <div className="min-w-0">
                <div className="text-xl font-black leading-none text-foreground">{k.value}</div>
                <div className="mt-1 truncate text-[10px] text-muted-foreground">{k.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Header bar */}
        <div className="mb-3 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 sm:flex sm:justify-between">
          <h1 className="flex min-w-0 items-baseline gap-1.5 text-sm font-black text-foreground sm:text-base">
            <span className="truncate">Bookings</span>
            <span className="shrink-0 text-xs font-normal text-muted-foreground">{rows.length} total</span>
          </h1>
          <div className="col-span-2 flex flex-wrap items-center gap-2 sm:col-auto">
            <div className="relative">
              <input
                type="text"
                placeholder="Search booking ref or agency..."
                className="w-56 rounded-md border border-input bg-card py-1.5 pl-8 pr-3 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-ring"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            </div>
            <select
              className="rounded-md border border-input bg-card px-3 py-1.5 text-xs font-bold text-foreground outline-none focus:ring-1 focus:ring-ring"
              value={ticketFilter}
              onChange={(e) => setTicketFilter(e.target.value)}
            >
              <option value="all">All Status</option>
              <option value="submitted">Submitted</option>
              <option value="pending">Pending</option>
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


        <div className="space-y-2.5">
          {rows.map((b) => (
            <BookingCard
              key={b.id}
              b={b}
              busy={busy}
              expanded={!!expanded[b.id]}
              onToggle={() => setExpanded((s) => ({ ...s, [b.id]: !s[b.id] }))}
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
              onSaveFod={(v) => saveFod(b.id, v)}
            />
          ))}
          {rows.length === 0 && (
            <div className="rounded-xl border border-dashed border-navy/15 bg-white p-10 text-center text-xs font-bold uppercase tracking-wider text-navy/40">
              No bookings match your filters
            </div>
          )}
        </div>
      </div>
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

function BookingCard({
  b, busy, expanded, onToggle, onUpdateStatus, onUpdatePayment, onDocFiles, onTicketFiles, onRemoveDoc, onRemoveTicket, onDelete, onSaveFod,
}: {
  b: AdminBooking;
  busy: boolean;
  expanded: boolean;
  onToggle: () => void;
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
  const initials = (b.agency_name ?? "?").split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("");
  const paid = isPaid(b.payment_status);
  const isSelf = b.fare_snapshot?.group_type?.toLowerCase() === "self";

  const needsAttention = b.status === "submitted" || b.status === "pending";

  return (
    <article className={`overflow-hidden rounded-lg border shadow-sm transition-shadow hover:shadow-md ${
      needsAttention
        ? "border-amber-400 bg-amber-50 ring-1 ring-amber-300/60"
        : b.status !== "confirmed"
          ? "border-amber-300/70 bg-card"
          : "border-border bg-card"
    }`}>
      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-4 p-3 sm:p-4 lg:grid-cols-[210px_minmax(280px,1fr)_145px_130px_130px_150px_36px] lg:items-center lg:gap-3">
        {/* Agent information */}
        <section className="col-span-2 flex min-w-0 items-center gap-2.5 lg:col-span-1">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-navy text-xs font-black text-gold">{initials || "?"}</div>
          <div className="min-w-0 leading-tight">
            <div className="flex min-w-0 items-center gap-1.5">
              <span className="truncate font-mono text-[9px] font-bold uppercase text-muted-foreground">{b.booking_ref ?? "—"}</span>
              {isSelf && <span className="shrink-0 rounded bg-destructive px-1.5 py-0.5 text-[8px] font-black uppercase text-destructive-foreground">Self</span>}
            </div>
            <div className="truncate text-sm font-bold text-foreground">{b.agency_name || "—"}</div>
            <div className="truncate text-[10px] text-muted-foreground">{[b.contact_person, b.agent_phone].filter(Boolean).join(" · ")}</div>
            {b.agent_email && <div className="truncate text-[10px] text-muted-foreground">{b.agent_email}</div>}
          </div>
        </section>

        {/* Route and flight */}
        <section className="col-span-2 min-w-0 rounded-md border border-dashed border-border bg-muted/30 px-3 py-2 lg:col-span-1">
          <div className="flex min-w-0 items-baseline gap-4">
            <span className="truncate font-serif text-sm font-black text-foreground">{route}</span>
            <span className="shrink-0 font-mono text-[9px] font-bold text-muted-foreground">{routeCodes}</span>
          </div>
          <div className="mt-1 flex min-w-0 items-center gap-3 text-[10px]">
            <span className="shrink-0 font-bold text-foreground">{airline || "Airline —"}</span>
            <span className="truncate text-muted-foreground">{details.join(" · ") || "Flight details unavailable"}</span>
          </div>
          <div className="mt-2 flex min-w-0 items-center justify-between gap-2 border-t border-dashed border-border pt-1.5 text-[10px] text-muted-foreground">
            <span className="truncate">{passengers.length || b.seats} passenger{(passengers.length || b.seats) === 1 ? "" : "s"} · PNR <strong>{String(b.fare_snapshot?.pnr ?? "—")}</strong></span>
            <button type="button" onClick={onToggle} className="shrink-0 font-bold text-primary hover:underline">{expanded ? "Close" : "View"}</button>
          </div>
        </section>

        {/* Total cost */}
        <section className="min-w-0">
          <div className="text-[9px] text-muted-foreground">Total cost</div>
          <div className="truncate text-base font-black text-foreground">PKR {totalCost.toLocaleString()}</div>
          <div className="truncate text-[10px] text-muted-foreground">{b.seats} seat{b.seats === 1 ? "" : "s"} · {b.fare_snapshot?.price_text ?? "—"} / seat</div>
        </section>

        {/* Payment status */}
        <section className="min-w-0">
          <div className="mb-1 text-[8px] font-bold uppercase text-muted-foreground lg:hidden">Payment</div>
            <select
              aria-label={`Payment status for ${b.booking_ref ?? "booking"}`}
              className={`w-full rounded-full border px-2.5 py-1 text-[10px] font-bold outline-none focus:ring-1 focus:ring-ring ${
                paid ? "border-emerald-300 bg-emerald-100 text-emerald-700"
                : b.payment_status === "ledger" ? "border-blue-300 bg-blue-100 text-blue-700"
                : "border-amber-300 bg-amber-100 text-amber-700"
              }`}
              value={b.payment_status === "confirmed" ? "received" : (b.payment_status || "pending")}
              onChange={(e) => onUpdatePayment(b.id, e.target.value)}
            >
              <option value="pending" className="bg-white text-navy">Pending</option>
              <option value="received" className="bg-white text-navy">Received</option>
              <option value="ledger" className="bg-white text-navy">Added in Ledger</option>
            </select>
        </section>

        {/* Ticket status */}
        <section className="min-w-0">
          <div className="mb-1 text-[8px] font-bold uppercase text-muted-foreground lg:hidden">Ticket</div>
            <select
              aria-label={`Ticket status for ${b.booking_ref ?? "booking"}`}
              className={`w-full rounded-full border px-2.5 py-1 text-[10px] font-bold outline-none focus:ring-1 focus:ring-ring ${
                b.status === "confirmed" ? "border-emerald-300 bg-emerald-100 text-emerald-700"
                : b.status === "pending" ? "border-amber-300 bg-amber-100 text-amber-700"
                : "border-navy/15 bg-navy/5 text-navy/70"
              }`}
              value={b.status || "submitted"}
              onChange={(e) => onUpdateStatus(b.id, e.target.value as any)}
            >
              <option value="submitted" className="bg-white text-navy">Submitted</option>
              <option value="pending" className="bg-white text-navy">On Hold</option>
              {b.status === "confirmed" && <option value="confirmed" className="bg-white text-navy">Confirmed</option>}
            </select>
        </section>

        {/* Documents */}
        <section className="min-w-0 space-y-1">
          <div className="text-[8px] font-bold uppercase text-muted-foreground lg:hidden">Documents</div>
          <span className={`inline-flex rounded-full px-2 py-0.5 text-[9px] font-bold ${passports.length && slips.length ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
            {passports.length && slips.length ? "Docs attached" : "Docs pending"}
          </span>
          {tickets.length > 0 && (
            <div className="flex min-w-0 flex-wrap gap-1">
              {tickets.map((t, i) => (
                <a key={i} href={t.url} target="_blank" rel="noopener noreferrer" className="truncate rounded-full bg-blue-100 px-2 py-0.5 text-[9px] font-bold text-blue-700">
                  Ticket {tickets.length > 1 ? i + 1 : "attached"}
                </a>
              ))}
            </div>
          )}
        </section>

        {/* Actions — Upload Ticket first, then Confirm (Confirm stays disabled until a ticket is uploaded) */}
        <div className="flex items-center justify-end gap-1.5">
          <input ref={ticketInputRef} type="file" multiple className="hidden" disabled={busy} onChange={(e) => onTicketFiles(b.id, e.target.files)} />
          {b.status !== "confirmed" && tickets.length === 0 && (
            <button
              type="button"
              disabled={busy}
              onClick={() => ticketInputRef.current?.click()}
              className="inline-flex items-center gap-1 rounded-md border border-navy/20 bg-navy/5 px-2 py-1 text-[10px] font-bold text-navy transition-colors hover:bg-navy/10 disabled:opacity-50"
              title="Upload ticket before confirming"
            >
              <Upload className="h-3.5 w-3.5" /> Upload Ticket
            </button>
          )}
          {b.status !== "confirmed" && (
            <button
              type="button"
              disabled={tickets.length === 0 || busy}
              onClick={() => onUpdateStatus(b.id, "confirmed")}
              className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                tickets.length === 0
                  ? "border border-dashed border-amber-300 bg-amber-50 text-amber-600"
                  : "border border-emerald-300 bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
              }`}
              title={tickets.length === 0 ? "Upload a ticket first to enable confirmation" : "Confirm this booking"}
            >
              <CheckCircle2 className="h-3.5 w-3.5" /> Confirm{tickets.length === 0 ? " (ticket required)" : ""}
            </button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="grid h-8 w-8 place-items-center rounded-md border border-border text-foreground hover:bg-muted" aria-label="Booking actions">
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              {tickets.length > 0 && b.status !== "confirmed" && (
                <DropdownMenuItem disabled={busy} onSelect={() => ticketInputRef.current?.click()}>
                  <Upload className="mr-2 h-3.5 w-3.5 text-navy" /> Upload Another Ticket
                </DropdownMenuItem>
              )}
              {tickets.map((t, i) => (
                <DropdownMenuItem key={i} onSelect={() => onRemoveTicket(t.path)}>
                  <Ticket className="mr-2 h-3.5 w-3.5 text-amber-600" /> Remove Ticket{tickets.length > 1 ? ` ${i + 1}` : ""}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={onDelete} className="text-rose-600 focus:text-rose-600">
                <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {expanded && (
        <div className="grid gap-4 border-t border-border bg-muted/20 px-3 py-3 sm:px-4 lg:grid-cols-[minmax(280px,1fr)_180px_180px_190px]">
          <div className="min-w-0 overflow-hidden rounded-md border border-border bg-card">
            <div className="grid grid-cols-[24px_1fr_1fr] gap-1 bg-navy px-2 py-1 text-[8px] font-black uppercase text-navy-foreground">
              <span>#</span><span>Given Name</span><span>Sur Name</span>
            </div>
            {passengers.length === 0 && <div className="px-2 py-2 text-[10px] text-muted-foreground">No passenger names recorded</div>}
            {passengers.map((line, i) => {
              const { given, sur, extra } = splitName(line);
              return (
                <div key={i} className="grid grid-cols-[24px_1fr_1fr] gap-1 border-t border-border px-2 py-1 text-[10px] text-foreground">
                  <span className="font-bold text-muted-foreground">{i + 1}</span>
                  <span className="truncate font-semibold">{given || "—"}</span>
                  <span className="truncate">{sur || "—"}{extra ? <em className="ml-1 not-italic text-muted-foreground">{extra}</em> : null}</span>
                </div>
              );
            })}
          </div>
          <div>
            <div className="mb-1 text-[8px] font-black uppercase text-muted-foreground">Passport Copies</div>
            <DocCell files={passports} attachedLabel="Attached" uploadLabel="Upload" onFiles={(fl) => onDocFiles(b.id, "passport", fl)} onRemove={(p) => onRemoveDoc(p, "attachments")} />
          </div>
          <div>
            <div className="mb-1 text-[8px] font-black uppercase text-muted-foreground">Payment Slip</div>
            <DocCell files={slips} attachedLabel="Attached" uploadLabel="Upload" onFiles={(fl) => onDocFiles(b.id, "payment_slip", fl)} onRemove={(p) => onRemoveDoc(p, "payment_slips")} />
          </div>
          <div>
            <div className="mb-1 text-[8px] font-black uppercase text-muted-foreground">Fare on Demand</div>
            <FareOnDemandCell value={b.fare_on_demand ?? ""} onSave={onSaveFod} />
            <div className="mt-2 text-[9px] text-muted-foreground">Booked {formatDateTime(b.created_at)}</div>
          </div>
        </div>
      )}
    </article>
  );
}
