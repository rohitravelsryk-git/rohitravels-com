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
    try { await setStatus({ data: { id, status } }); } catch (e: any) { toast.error(e.message); } finally { refresh(); }
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
        <div className="mx-auto flex max-w-[1600px] items-center justify-between px-4 py-4">
          <div className="font-serif text-lg font-black uppercase tracking-tight">Agent Group Bookings</div>
          <div className="flex items-center gap-4">
            <AdminHeaderExtras />
            <button onClick={() => logout()} className="text-xs font-bold text-gold">LOGOUT</button>
          </div>
        </div>
        <AdminTabs />
      </header>

      <div className="mx-auto max-w-[1600px] px-4 py-6">
        {/* KPI strip */}
        <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            { label: "Total Bookings", value: kpis.total, tone: "text-navy" },
            { label: "Payments Pending", value: kpis.paymentsPending, tone: "text-amber-600" },
            { label: "Tickets Confirmed", value: kpis.ticketsConfirmed, tone: "text-emerald-600" },
            { label: "Documents Missing", value: kpis.docsMissing, tone: "text-rose-600" },
          ].map((k) => (
            <div key={k.label} className="rounded-xl border border-navy/10 bg-white p-4 shadow-sm">
              <div className="text-[10px] font-black uppercase tracking-wider text-navy/50">{k.label}</div>
              <div className={`mt-1 font-serif text-3xl font-black ${k.tone}`}>{k.value}</div>
              <div className="mt-2 h-0.5 w-8 rounded-full bg-gold" />
            </div>
          ))}
        </div>

        {/* Header bar */}
        <div className="mb-4 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-navy/10 bg-navy px-4 py-3 sm:flex sm:justify-between">
          <h1 className="flex min-w-0 items-center gap-2 font-serif text-base font-black uppercase tracking-tight text-white sm:text-lg">
            <Plane className="h-5 w-5 shrink-0 text-gold" />
            <span className="truncate">Agent Group Bookings</span>
          </h1>
          <div className="col-span-2 flex flex-wrap items-center gap-2 sm:col-auto">
            <div className="relative">
              <input
                type="text"
                placeholder="Search booking ref or agency..."
                className="w-56 rounded-md border border-white/15 bg-white/10 py-1.5 pl-8 pr-3 text-xs text-white placeholder:text-white/45 outline-none focus:ring-1 focus:ring-gold"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/50" />
            </div>
            <select
              className="rounded-md border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-bold text-white outline-none focus:ring-1 focus:ring-gold"
              value={ticketFilter}
              onChange={(e) => setTicketFilter(e.target.value)}
            >
              <option value="all" className="bg-white text-navy">All Status</option>
              <option value="submitted" className="bg-white text-navy">Submitted</option>
              <option value="pending" className="bg-white text-navy">Pending</option>
              <option value="confirmed" className="bg-white text-navy">Confirmed</option>
            </select>
          </div>
        </div>

        <div className="space-y-3">
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
                rmDoc({ data: { id: b.id, path, field } })
                  .then(() => refresh())
                  .catch((e: any) => alert(e?.message ?? "Failed to remove file"));
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
  const airline = lines[1] ?? "";
  const details = lines.slice(2);
  const passengers = (b.passenger_names ?? "").split("\n").filter(Boolean);
  const passports = (b.attachments ?? []).filter((a: any) => a.kind === "passport");
  const slips = (b.payment_slips ?? []).slice(0, 1);
  const tickets = (b.tickets ?? []) as any[];
  const perSeat = Number(b.fare_on_demand?.replace(/[^\d]/g, "") || b.fare_snapshot?.price_text?.replace(/[^\d]/g, "") || 0);
  const totalCost = perSeat * b.seats;
  const initials = (b.agency_name ?? "?").split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("");
  const paid = isPaid(b.payment_status);
  const isSelf = b.fare_snapshot?.group_type?.toLowerCase() === "self";

  return (
    <div className={`rounded-xl border bg-white shadow-sm transition-shadow hover:shadow-md ${b.status !== "confirmed" ? "border-amber-300/70" : "border-navy/10"}`}>
      <div className="grid gap-4 p-4 lg:grid-cols-[1.1fr_1.5fr_0.9fr_0.85fr_auto]">
        {/* Agency */}
        <div className="flex min-w-0 items-start gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-navy font-serif text-sm font-black text-gold">
            {initials || "?"}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] font-bold tracking-wider text-navy/45">{b.booking_ref ?? "—"}</span>
              {isSelf && (
                <span className="rounded bg-orange-600 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-tight text-white">SELF</span>
              )}
            </div>
            <div className="truncate text-sm font-bold text-navy">{b.agency_name}</div>
            <div className="truncate text-[10px] font-semibold text-navy/60">
              {[b.contact_person, b.agent_phone].filter(Boolean).join(" · ")}
            </div>
            {b.agent_email && <div className="truncate text-[10px] text-navy/40">{b.agent_email}</div>}
            <div className="mt-1 text-[9px] font-bold uppercase tracking-wider text-navy/35">{formatDateTime(b.created_at)}</div>
          </div>
        </div>

        {/* Flight ticket stub */}
        <div className="min-w-0 rounded-lg border border-dashed border-navy/20 bg-navy/[0.03] p-3">
          <div className="truncate font-serif text-base font-black uppercase text-navy">{route}</div>
          {airline && <div className="truncate text-[10px] font-bold uppercase tracking-wider text-gold">{airline}</div>}
          <div className="mt-1 space-y-0.5">
            {details.map((l, i) => (
              <p key={i} className="font-mono text-[10px] leading-tight text-navy/75">{l}</p>
            ))}
          </div>
          <button
            onClick={onToggle}
            className="mt-2 flex w-full items-center justify-between gap-2 rounded border border-navy/10 bg-white px-2 py-1 text-[10px] font-bold text-navy hover:bg-navy/5"
          >
            <span className="truncate">PNR {b.fare_snapshot?.pnr ?? "—"} · {passengers.length || b.seats} PAX</span>
            {expanded ? <ChevronUp className="h-3 w-3 shrink-0 text-gold" /> : <ChevronDown className="h-3 w-3 shrink-0 text-gold" />}
          </button>
          {expanded && (
            <div className="mt-2 overflow-hidden rounded border border-navy/10 bg-white">
              <div className="grid grid-cols-[24px_1fr_1fr] gap-1 bg-navy px-2 py-1 text-[8px] font-black uppercase tracking-wider text-white">
                <span>#</span><span>Given Name</span><span>Sur Name</span>
              </div>
              {passengers.length === 0 && (
                <div className="px-2 py-1.5 text-[10px] text-navy/45">No passenger names recorded</div>
              )}
              {passengers.map((line, i) => {
                const { given, sur, extra } = splitName(line);
                return (
                  <div key={i} className="grid grid-cols-[24px_1fr_1fr] gap-1 border-t border-navy/5 px-2 py-1 text-[10px] text-navy/80">
                    <span className="font-bold text-navy/50">{i + 1}</span>
                    <span className="truncate font-semibold">{given || "—"}</span>
                    <span className="truncate">{sur || "—"}{extra ? <em className="ml-1 not-italic text-navy/40">{extra}</em> : null}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Fare */}
        <div className="min-w-0">
          <div className="text-[9px] font-black uppercase tracking-wider text-navy/40">Total Cost</div>
          <div className="font-serif text-xl font-black text-emerald-600">{totalCost.toLocaleString()}</div>
          <div className="mt-0.5 text-[10px] font-bold text-blue-600">
            {b.fare_snapshot?.price_text ?? "—"} <span className="text-navy/45">× {b.seats} seats</span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ${passports.length ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
              {passports.length ? "Passports ✓" : "Passports Missing"}
            </span>
          </div>
          <div className="mt-2 space-y-1">
            <div>
              <div className="mb-0.5 text-[8px] font-black uppercase tracking-wider text-navy/40">Passport Copies</div>
              <DocCell files={passports} attachedLabel="Attached" uploadLabel="Upload" onFiles={(fl) => onDocFiles(b.id, "passport", fl)} onRemove={(p) => onRemoveDoc(p, "attachments")} />
            </div>
            <div>
              <div className="mb-0.5 text-[8px] font-black uppercase tracking-wider text-navy/40">Payment Slip</div>
              <DocCell files={slips} attachedLabel="Attached" uploadLabel="Upload" onFiles={(fl) => onDocFiles(b.id, "payment_slip", fl)} onRemove={(p) => onRemoveDoc(p, "payment_slips")} />
            </div>
            <div>
              <div className="mb-0.5 text-[8px] font-black uppercase tracking-wider text-navy/40">Fare on Demand</div>
              <FareOnDemandCell value={b.fare_on_demand ?? ""} onSave={onSaveFod} />
            </div>
          </div>
        </div>

        {/* Status pills */}
        <div className="min-w-0 space-y-2">
          <div>
            <div className="mb-0.5 text-[8px] font-black uppercase tracking-wider text-navy/40">Payment Status</div>
            <select
              className={`w-full rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wider outline-none focus:ring-1 focus:ring-gold ${
                paid ? "border-emerald-300 bg-emerald-100 text-emerald-700"
                : b.payment_status === "ledger" ? "border-blue-300 bg-blue-100 text-blue-700"
                : "border-amber-300 bg-amber-100 text-amber-700"
              }`}
              value={b.payment_status === "confirmed" ? "received" : (b.payment_status || "pending")}
              onChange={(e) => onUpdatePayment(b.id, e.target.value)}
            >
              <option value="pending" className="bg-white text-navy">Pending</option>
              <option value="received" className="bg-white text-navy">Received</option>
              <option value="ledger" className="bg-white text-navy">Add in Ledger</option>
            </select>
          </div>
          <div>
            <div className="mb-0.5 text-[8px] font-black uppercase tracking-wider text-navy/40">Ticket Status</div>
            <select
              className={`w-full rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wider outline-none focus:ring-1 focus:ring-gold ${
                b.status === "confirmed" ? "border-emerald-300 bg-emerald-100 text-emerald-700"
                : b.status === "pending" ? "border-amber-300 bg-amber-100 text-amber-700"
                : "border-navy/15 bg-navy/5 text-navy/70"
              }`}
              value={b.status || "submitted"}
              onChange={(e) => onUpdateStatus(b.id, e.target.value as any)}
            >
              <option value="submitted" className="bg-white text-navy">Submitted</option>
              <option value="pending" className="bg-white text-navy">On Hold</option>
              <option value="confirmed" className="bg-white text-navy">Confirmed</option>
            </select>
          </div>
          {tickets.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {tickets.map((t, i) => (
                <a key={i} href={t.url} target="_blank" rel="noopener noreferrer" className="rounded-full bg-navy px-2 py-0.5 text-[9px] font-bold text-gold">
                  TICKET {tickets.length > 1 ? i + 1 : ""}
                </a>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-start justify-end">
          <input ref={ticketInputRef} type="file" multiple className="hidden" disabled={busy} onChange={(e) => onTicketFiles(b.id, e.target.files)} />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="grid h-8 w-8 place-items-center rounded-full border border-navy/10 text-navy hover:bg-navy/5" aria-label="Booking actions">
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem onSelect={() => onUpdateStatus(b.id, "confirmed")}>
                <CheckCircle2 className="mr-2 h-3.5 w-3.5 text-emerald-600" /> Confirm
              </DropdownMenuItem>
              {b.status === "confirmed" && (
                <DropdownMenuItem disabled={busy} onSelect={() => ticketInputRef.current?.click()}>
                  <Upload className="mr-2 h-3.5 w-3.5 text-navy" /> {tickets.length ? "Add Ticket" : "Upload Ticket"}
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
    </div>
  );
}
