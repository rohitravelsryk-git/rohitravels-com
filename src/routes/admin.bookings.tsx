// '''Do not make any visual modifications. The phrases I write are commands to understand what I want, not to be written down. Understand their content well, then execute what is required.'''
// In admin panel print Tickets when a ticket is downloaded it looses quality and shrink fromleft right or give non professional look. make is same original ticket uploaded formating and do not compress but do it much enahhced and hd quality and also save it as A4 or letter page size and other editing and stamps applyed setting remain same aslo save non refundable and group tickets non refundable non changeable stamps always available like ok to board stamps. AS this button print Tickets is also located in b2b agent portal so do the same settings in it also
import { createFileRoute, useRouter } from "@tanstack/react-router";

import { useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Plane, LogOut, Bell, MessageCircle, CheckCircle2, Ticket, Paperclip, Upload, FileText as FileIcon, Image as ImageIcon, Pencil, Trash2, Search } from "lucide-react";
import { adminLogout } from "@/lib/fares.functions";
import { listBookingsAdmin, setBookingStatusAdmin, setBookingPaymentStatus, uploadBookingTicket, removeBookingTicket, uploadBookingDoc, removeBookingDoc, updateBookingAdmin, deleteBookingAdmin, setBookingFareOnDemand, type AdminBooking } from "@/lib/agent-bookings.functions";



import { flightBlockLines } from "@/lib/booking-flight-format";
import { AdminHeaderExtras } from "@/components/AdminHeaderExtras";
import { AdminResetButton } from "@/components/AdminResetButton";

import { AdminTabs } from "@/components/AdminTabs";
import { AdminNotifications } from "@/components/AdminNotifications";

export const Route = createFileRoute("/admin/bookings")({
  head: () => ({ meta: [{ title: "Agent Bookings — Rohi Admin" }] }),
  loader: async ({ context }) => {
    // Note: This function requires admin unlock. Prerender/SSR will fail with 401 
    // unless the environment handles it gracefully.
    try {
      await context.queryClient.ensureQueryData({
        queryKey: ["admin-bookings"],
        queryFn: () => listBookingsAdmin(),
      });
    } catch (e) {
      console.warn("Loader failed (expected during prerender):", e instanceof Error ? e.message : e);
    }
  },
  errorComponent: ({ error, reset }) => (
    <div className="p-8 text-center">
      <p className="mb-4 text-destructive">{error.message}</p>
      <button onClick={reset} className="rounded bg-navy px-4 py-2 text-white">Retry</button>
    </div>
  ),
  notFoundComponent: () => <div className="p-8">Not found</div>,
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

function fareLine(f: any) {
  return f?.flight_details
    ?? `${f?.flight_date ?? ""} ${f?.origin_code ?? ""} ${f?.destination_code ?? ""}${f?.depart_time ? ` ${f.depart_time}` : ""}${f?.arrive_time ? ` ${f.arrive_time}` : ""}${f?.flight_number ? ` ${f.flight_number}` : ""}`;
}

function toWa(phone: string) {
  const raw = (phone || "").replace(/[^\d]/g, "");
  return raw.startsWith("0") ? "92" + raw.slice(1) : raw;
}

function AdminBookingsPage() {
  const router = useRouter();
  const qc = useQueryClient();
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
    refetchOnWindowFocus: true,
  });

  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [ticketFilter, setTicketFilter] = useState("all");
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [editing, setEditing] = useState<AdminBooking | null>(null);
  const [form, setForm] = useState({ seats: 1, passenger_names: "", contact_phone: "", notes: "" });

  /** Optimistically patch a row in the cache so the UI updates instantly. */
  function patchRow(id: string, patch: Partial<AdminBooking>) {
    qc.setQueryData<AdminBooking[]>(["admin-bookings"], (rows) =>
      (rows ?? []).map((r) => (r.id === id ? { ...r, ...patch } : r)),
    );
  }
  const refresh = () => qc.invalidateQueries({ queryKey: ["admin-bookings"] });

  function openEdit(b: AdminBooking) {
    setEditing(b);
    setForm({
      seats: b.seats,
      passenger_names: b.passenger_names ?? "",
      contact_phone: b.contact_phone ?? "",
      notes: b.notes ?? "",
    });
  }

  async function submitEdit() {
    if (!editing) return;
    setBusy(true);
    const id = editing.id;
    patchRow(id, { ...form, seats: Number(form.seats) || 1, status: "pending" } as Partial<AdminBooking>);
    setEditing(null);
    try {
      await saveBooking({ data: { id, ...form, seats: Number(form.seats) || 1 } });
    } catch (e: any) { alert(e.message); } finally { refresh(); setBusy(false); }
  }

  async function saveFod(id: string, v: string) {
    patchRow(id, { fare_on_demand: v } as Partial<AdminBooking>);
    try {
      await setFod({ data: { id, fare_on_demand: v } });
    } catch (e: any) { alert(e.message); refresh(); }
  }

  async function onDelete(b: AdminBooking) {

    if (!confirm(`Delete this booking from ${b.agency_name ?? "agent"}? This also removes its uploaded files.`)) return;
    qc.setQueryData<AdminBooking[]>(["admin-bookings"], (rows) => (rows ?? []).filter((r) => r.id !== b.id));
    try {
      await removeBooking({ data: { id: b.id } });
    } catch (e: any) { alert(e.message); } finally { refresh(); }
  }



  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.filter((b) => {
      if (ticketFilter !== "all") {
        const st = b.status === "confirmed" ? "confirmed" : b.status === "pending" ? "pending" : "submitted";
        if (st !== ticketFilter) return false;
      }
      if (!q) return true;
      const hay = [
        b.booking_ref,
        b.agency_name,
        b.contact_person,
        b.contact_phone,
        b.passenger_names,
        b.fare_snapshot?.airline,
        b.fare_snapshot?.origin_code,
        b.fare_snapshot?.destination_code,
        b.status,
        b.payment_status,
      ].filter(Boolean).join(" ").toLowerCase();
      return hay.includes(q);
    });
  }, [data, search, ticketFilter]);

  // Redundant notification state removed in favor of central AdminNotifications component
  const pending = useMemo(() => data.filter((b) => b.status === "submitted" || b.status === "pending"), [data]);


  async function updateStatus(id: string, status: "confirmed" | "cancelled" | "pending") {
    patchRow(id, { status, ticket_status: status === "confirmed" ? "issued" : "pending" });
    try {
      const res = await setStatus({ data: { id, status } });
      if (status === "confirmed") {
        toast.success("Booking confirmed! Data synced to tickets and dashboards.");
      }
    } catch (e: any) { toast.error(e.message); } finally { refresh(); }
  }

  async function updatePayment(id: string, payment_status: "unpaid" | "pending" | "confirmed" | "refunded" | "ledger") {
    patchRow(id, { payment_status });
    try {
      await setPayment({ data: { id, payment_status } });
    } catch (e: any) { alert(e.message); } finally { refresh(); }
  }

  async function removeTicket(id: string, path: string) {
    if (!confirm("Remove this ticket file?")) return;
    setBusy(true);
    try {
      await rmTicket({ data: { id, path } });
    } catch (e: any) { alert(e.message); } finally { refresh(); setBusy(false); }
  }

  async function removeDoc(id: string, path: string, field: "attachments" | "payment_slips") {
    if (!confirm("Remove this file?")) return;
    setBusy(true);
    try {
      await rmDoc({ data: { id, path, field } });
    } catch (e: any) { alert(e.message); } finally { refresh(); setBusy(false); }
  }

  function toBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result).split(",")[1] ?? "");
      r.onerror = reject;
      r.readAsDataURL(file);
    });
  }

  async function onTicketFiles(id: string, files: FileList | null) {
    if (!files || !files.length) return;
    setUploadingId(id);
    setBusy(true);
    try {
      for (const file of Array.from(files)) {
        if (file.size > 10 * 1024 * 1024) throw new Error(`${file.name} is larger than 10MB`);
        const base64 = await toBase64(file);
        await upTicket({ data: { id, name: file.name, type: file.type || "application/pdf", base64 } });
      }
    } catch (e: any) { toast.error(e.message); } finally { setUploadingId(null); setBusy(false); refresh(); }
  }

  async function onDocFiles(id: string, kind: "visa" | "passport" | "payment_slip", files: FileList | null) {
    if (!files || !files.length) return;
    setUploadingId(`${id}:${kind}`);
    setBusy(true);
    try {
      for (const file of Array.from(files)) {
        if (file.size > 10 * 1024 * 1024) throw new Error(`${file.name} is larger than 10MB`);
        const base64 = await toBase64(file);
        await upDoc({ data: { id, kind, name: file.name, type: file.type || "application/pdf", base64 } });
      }
    } catch (e: any) { toast.error(e.message); } finally { setUploadingId(null); setBusy(false); refresh(); }
  }





  function waReply(b: AdminBooking) {
    const f = b.fare_snapshot ?? {};
    const text = encodeURIComponent(
      `*ROHI INTERNATIONAL TRAVELS*\n\nDear ${b.contact_person ?? "Agent"},\n\nRegarding your group booking request:\n${f.airline ?? ""} · ${f.origin_code ?? ""} → ${f.destination_code ?? ""}\nSeats: ${b.seats}\n\n`,
    );
    return `https://wa.me/${toWa(b.contact_phone || b.agent_phone || "")}?text=${text}`;
  }

  async function onLogout() { try { await logout(); } catch {} router.navigate({ to: "/admin" }); }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-navy text-navy-foreground">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <Plane className="h-5 w-5 -rotate-45 text-gold" />
            <div>
              <p className="font-serif text-lg font-black">Admin Panel</p>
              <p className="text-[10px] tracking-widest text-white/60">Agent bookings</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <AdminHeaderExtras />

            <a href="/" className="rounded-md border border-white/20 px-2 py-2 text-xs font-semibold hover:bg-white/10">View site</a>
            <button onClick={onLogout} className="inline-flex items-center gap-2 rounded-md bg-gold px-2 py-2 text-xs font-bold text-gold-foreground">
              <LogOut className="h-3.5 w-3.5" /> Logout
            </button>
          </div>
        </div>
        <AdminTabs />
      </header>

      <div className="mx-auto max-w-[1600px] px-4 py-6">
        <div className="mb-4 space-y-4">
          {/* AdminNotifications is now globally mounted in __root */}
          <div className="flex items-center gap-2">
            <div className="inline-flex items-center gap-2 rounded-md bg-navy px-4 py-2 text-sm font-bold uppercase tracking-wider text-white">
              <Ticket className="h-4 w-4" /> All Group Bookings
              <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px]">{data.length}</span>
            </div>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search booking ID, agency, PNR names…"
                className="w-64 rounded-md border border-navy/20 px-3 py-2 text-xs outline-none focus:border-gold"
              />
              <select
                value={ticketFilter}
                onChange={(e) => setTicketFilter(e.target.value)}
                className="rounded-md border border-navy/20 px-2 py-2 text-xs font-semibold text-navy outline-none focus:border-gold"
              >
                <option value="all">All ticket status</option>
                <option value="submitted">Submitted</option>
                <option value="pending">On Hold</option>
                <option value="confirmed">Confirmed</option>
              </select>
              <span className="text-xs text-muted-foreground">Live · 5s</span>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-navy/10 bg-white shadow-sm">
          <table className="w-full table-fixed text-sm">
            <colgroup>
              <col className="w-[64px]" />
              <col className="w-[78px]" />
              <col className="w-[84px]" />
              <col className="w-[84px]" />
              <col className="w-[124px]" />
              <col className="w-[166px]" />
              <col className="w-[74px]" />
              <col className="w-[40px]" />
              <col className="w-[80px]" />
              <col className="w-[110px]" />
              <col className="w-[96px]" />
              <col className="w-[96px]" />
              <col className="w-[90px]" />
              <col className="w-[84px]" />
              <col className="w-[84px]" />
              <col className="w-[168px]" />
            </colgroup>
            <thead className="bg-navy text-[9.5px] uppercase leading-tight tracking-wider text-white">
              <tr>
                <th className="px-2 py-2 text-left">Date</th>
                <th className="px-2 py-2 text-center">FARE ID</th>
                <th className="px-2 py-2 text-center">PNR</th>
                <th className="px-2 py-2 text-center border-l border-white/10">Booking ID</th>
                <th className="px-2 py-2 text-left border-l border-white/10">Group Type</th>
                <th className="px-2 py-2 text-left border-l border-white/10">Agency Name / Contact</th>
                <th className="px-2 py-2 text-left border-l border-white/10">Airline / Flight Details</th>
                <th className="px-2 py-2 text-left border-l border-white/10">Fare On Demand</th>
                <th className="px-2 py-2 text-center border-l border-white/10">Seats</th>
                <th className="px-2 py-2 text-center border-l border-white/10">Total Cost</th>
                <th className="px-2 py-2 text-left border-l border-white/10">Passenger Names</th>
                <th className="px-2 py-2 text-left border-l border-white/10">Passport Copies</th>
                <th className="px-2 py-3 text-left border-l border-white/10">Visa Copies / OTB</th>
                <th className="px-2 py-2 text-left border-l border-white/10">Payment Slip</th>
                <th className="px-2 py-2 text-center border-l border-white/10">Ticket Status</th>
                <th className="px-2 py-2 text-center border-l border-white/10">Payment Status</th>
                <th className="px-2 py-2 text-center border-l border-white/10">Actions</th>
              </tr>
            </thead>

            <tbody>
              {rows.map((b) => (
                <tr key={b.id} className={`border-t border-navy/5 align-top ${b.status === "submitted" ? "bg-amber-100/70 ring-1 ring-inset ring-amber-300" : ""}`}>
                  <td className="whitespace-nowrap px-2 py-2 text-xs text-navy/60">{formatDateTime(b.created_at)}</td>
                  <td className="px-2 py-2 text-center text-[10px] font-mono font-bold text-gold">
                    {b.fare_snapshot?.id ? b.fare_snapshot.id.slice(0, 8) : "—"}
                  </td>
                  <td className="px-2 py-2 text-center text-[10px] font-bold text-navy">
                    {b.fare_snapshot?.pnr ?? "—"}
                  </td>
                  <td className="px-2 py-2 text-center">
                    <span className="inline-flex rounded bg-navy px-1.5 py-1 font-mono text-[10.5px] font-black tracking-wider text-white">
                      {b.booking_ref ?? "—"}
                    </span>
                    {b.status === "submitted" && (
                      <p className="mt-1 text-[9px] font-black uppercase tracking-wider text-amber-700">New</p>
                    )}
                  </td>
                  <td className="px-2 py-2">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${
                      b.fare_snapshot?.group_type === "self" 
                        ? "bg-emerald-100 text-emerald-800 ring-1 ring-emerald-300" 
                        : "bg-navy/10 text-navy/60"
                    }`}>
                      {b.fare_snapshot?.group_type === "self" ? "Self" : "Party"}
                    </span>
                  </td>
                  <td className="px-2 py-2">
                    <p className="font-semibold text-navy">{b.agency_name ?? "—"}</p>
                    <p className="text-[11px] text-navy/60">{b.contact_person ?? ""}</p>
                    <p className="text-[11px] font-semibold text-navy/80">{b.contact_phone}</p>
                    {b.agent_phone && b.agent_phone !== b.contact_phone && (
                      <p className="text-[10.5px] text-navy/60">{b.agent_phone}</p>
                    )}
                    {b.agent_email && <p className="text-[10.5px] text-navy/60">{b.agent_email}</p>}
                  </td>
                  <td className="px-2 py-2 text-[11px] leading-snug">
                    {flightBlockLines(b.fare_snapshot).map((line, i) => (
                      <p
                        key={i}
                        className={
                          line.includes("→") ? "font-bold text-navy"
                          : i === 1 ? "mb-0.5 text-[10px] font-bold text-navy/60"
                          : line.startsWith("Fare:") ? "mt-0.5 font-bold text-orange-700"
                          : line.startsWith("Bag:") ? "font-semibold text-navy/70"
                          : /^[A-Z]/.test(line) && i === 2 ? "font-semibold text-navy"
                          : "font-mono text-[10.5px] text-navy/80"
                        }
                      >
                        {line}
                      </p>
                    ))}
                  </td>
                  <td className="px-2 py-2">
                    <FareOnDemandCell
                      value={b.fare_on_demand ?? ""}
                      onSave={(v) => saveFod(b.id, v)}
                    />
                  </td>

                  <td className="px-2 py-2 text-center font-black text-navy">{b.seats}</td>
                  <td className="px-2 py-2 text-center">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[10px] font-black text-emerald-600" title="Sale Total">
                        S: {(() => {
                          const fareVal = b.fare_on_demand || (b.fare_snapshot?.price_text || "");
                          const numeric = fareVal.replace(/[^\d]/g, "");
                          if (!numeric) return "ON CALL";
                          return (Number(numeric) * b.seats).toLocaleString();
                        })()}
                      </span>
                      {b.fare_snapshot?.vendor_fare && (
                        <span className="text-[9px] font-bold text-navy/50" title="Purchase Total">
                          P: {(() => {
                            const numeric = String(b.fare_snapshot.vendor_fare).replace(/[^\d]/g, "");
                            return numeric ? (Number(numeric) * b.seats).toLocaleString() : "—";
                          })()}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="whitespace-pre-wrap px-2 py-2 text-[11px] text-navy/80">{b.passenger_names}</td>
                  <td className="px-2 py-2">
                    <DocCell
                      files={(b.attachments ?? []).filter((a: any) => (a.kind ?? "passport") === "passport")}
                      attachedLabel="Passport Attached"
                      uploadLabel="Upload Passport"
                      uploading={uploadingId === `${b.id}:passport`}
                      busy={busy}
                      onFiles={(fl) => onDocFiles(b.id, "passport", fl)}
                      onRemove={(p) => removeDoc(b.id, p, "attachments")}
                    />
                  </td>
                  <td className="px-2 py-2">
                    <DocCell
                      files={(b.attachments ?? []).filter((a: any) => a.kind === "visa")}
                      attachedLabel="Visa Attached"
                      uploadLabel="Upload Visa"
                      uploading={uploadingId === `${b.id}:visa`}
                      busy={busy}
                      onFiles={(fl) => onDocFiles(b.id, "visa", fl)}
                      onRemove={(p) => removeDoc(b.id, p, "attachments")}
                    />
                    {b.tickets && b.tickets.length > 0 && (
                      <div className="mt-1 flex flex-col gap-1 border-t border-navy/10 pt-1">
                        {b.tickets.map((t, i) => (
                          <span key={i} className="inline-flex w-full items-center gap-1 rounded bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-700">
                            <Ticket className="h-3 w-3 shrink-0" />
                            <a href={t.url ?? "#"} target="_blank" rel="noopener noreferrer" className="truncate underline" title={t.name}>Ticket Attached</a>
                            <button onClick={() => removeTicket(b.id, t.path)} className="ml-auto text-red-600" title="Remove">✕</button>
                          </span>
                        ))}
                      </div>
                    )}
                  </td>

                  <td className="px-2 py-2">
                    <DocCell
                      files={b.payment_slips ?? []}
                      attachedLabel="Slip Attached"
                      uploadLabel="Upload Payment Slip"
                      uploading={uploadingId === `${b.id}:payment_slip`}
                      busy={busy}
                      onFiles={(fl) => onDocFiles(b.id, "payment_slip", fl)}
                      onRemove={(p) => removeDoc(b.id, p, "payment_slips")}
                    />
                  </td>

                  <td className="px-2 py-2 text-center">
                    <select
                      value={b.status === "confirmed" ? "confirmed" : b.status === "pending" ? "pending" : "submitted"}
                      onChange={(e) => updateStatus(b.id, e.target.value as any)}
                      className={`w-full appearance-none rounded-full px-2 py-1 text-center text-[10px] font-black uppercase tracking-wider outline-none ${
                        b.status === "confirmed" ? "bg-emerald-100 text-emerald-800 ring-1 ring-emerald-300"
                        : b.status === "pending" ? "bg-amber-100 text-amber-800 ring-1 ring-amber-300"
                        : "bg-navy/10 text-navy/60"
                      }`}
                    >
                      <option value="submitted">Submitted</option>
                      <option value="pending">On Hold</option>
                      <option value="confirmed" disabled={!isPaid(b.payment_status)}>Confirmed</option>
                    </select>
                  </td>

                  <td className="px-2 py-2 text-center">
                    <select
                      value={b.payment_status === "confirmed" ? "confirmed" : b.payment_status === "ledger" ? "ledger" : "pending"}
                      onChange={(e) => updatePayment(b.id, e.target.value as any)}
                      className={`w-full appearance-none rounded-full border-0 bg-transparent px-1 py-1 text-center text-[10px] font-black uppercase tracking-wider outline-none ${
                        b.payment_status === "confirmed" ? "text-emerald-700"
                        : b.payment_status === "ledger" ? "text-sky-800"
                        : "text-amber-700"
                      }`}
                    >
                      <option value="pending">Pending</option>
                      <option value="confirmed">Received</option>
                      <option value="ledger">Added In Ledger</option>
                    </select>
                  </td>
                  <td className="px-2 py-2">
                    {(() => {
                      const paid = isPaid(b.payment_status);
                      // Validation: either flight details must have a fare value OR fare on demand must have one
                      const hasFareAmount = (() => {
                        const lines = flightBlockLines(b.fare_snapshot);
                        const fareLine = lines.find(l => l.startsWith("Fare:"));
                        const amount = fareLine ? fareLine.replace(/Fare:\s*/i, "").trim() : "";
                        const fodAmount = (b.fare_on_demand ?? "").trim();
                        
                        const isNumeric = (val: string) => {
                          const num = val.replace(/[^\d.]/g, "");
                          return num.length > 0 && !isNaN(parseFloat(num));
                        };
                        
                        return isNumeric(amount) || isNumeric(fodAmount);
                      })();

                      const ready = paid && hasFareAmount;
                      const hint = ready ? "" : !paid ? "Enabled once payment is Received/Added In Ledger" : "Valid Fare amount required in Flight Details or Fare On Demand";
                      const chip = "inline-flex items-center gap-1 rounded px-1.5 py-1 text-[9px] font-black uppercase tracking-wide";
                      return (
                        <div className="flex flex-wrap items-center justify-center gap-1">
                          <a href={waReply(b)} target="_blank" rel="noopener noreferrer"
                            className={`${chip} bg-whatsapp text-whatsapp-foreground hover:opacity-90`} title="Reply on WhatsApp">
                            <MessageCircle className="h-3 w-3" /> Reply
                          </a>
                          <button
                            disabled={busy || !ready || b.status === "confirmed"}
                            onClick={() => updateStatus(b.id, "confirmed")}
                            title={hint || "Confirm booking"}
                            className={`${chip} bg-emerald-600 text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40`}>
                            <CheckCircle2 className="h-3 w-3" /> {b.status === "confirmed" ? "Done" : "Confirm"}
                          </button>
                          <label
                            title={hint || "Upload Ticket"}
                            className={`${chip} bg-navy text-white ${busy || !ready ? "cursor-not-allowed opacity-40" : "cursor-pointer hover:bg-navy/90"}`}>
                            <Upload className="h-3 w-3" /> {uploadingId === b.id ? "…" : "Ticket"}
                            <input type="file" accept="application/pdf,image/*" multiple className="hidden"
                              disabled={busy || !ready}
                              onChange={(e) => onTicketFiles(b.id, e.target.files)} />
                          </label>
                          <button disabled={busy} onClick={() => openEdit(b)} title="Edit booking"
                            className={`${chip} border border-navy/25 bg-white text-navy hover:bg-navy/5 disabled:opacity-50`}>
                            <Pencil className="h-3 w-3" /> Edit
                          </button>
                          <button disabled={busy} onClick={() => onDelete(b)} title="Delete booking"
                            className={`${chip} border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-50`}>
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      );
                    })()}
                  </td>


                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={13} className="px-3 py-10 text-center text-muted-foreground">
                  <Paperclip className="mx-auto mb-2 h-6 w-6 text-navy/30" />
                  No booking requests yet.
                </td></tr>
              )}

            </tbody>
          </table>
        </div>

      </div>


      {/* Edit booking */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4">
          <div className="my-8 w-full max-w-lg overflow-hidden rounded-xl bg-white shadow-2xl">
            <div className="flex items-center justify-between bg-navy px-5 py-3 text-white">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-gold">Edit booking</p>
                <h3 className="font-serif text-lg font-bold">{editing.agency_name ?? "Agent"}</h3>
              </div>
              <button onClick={() => setEditing(null)} className="text-2xl leading-none text-white/70 hover:text-white">×</button>
            </div>
            <div className="space-y-3 p-5">
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-navy/70">Seats</label>
                <input type="number" min={1} max={200} value={form.seats}
                  onChange={(e) => setForm((f) => ({ ...f, seats: Number(e.target.value) }))}
                  className="mt-1 w-full rounded-lg border border-border px-2 py-2 text-sm" />
              </div>
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-navy/70">Passenger Names (one per line)</label>
                <textarea rows={5} value={form.passenger_names}
                  onChange={(e) => setForm((f) => ({ ...f, passenger_names: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-border px-2 py-2 text-sm uppercase" />
              </div>
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-navy/70">Contact Phone</label>
                <input value={form.contact_phone}
                  onChange={(e) => setForm((f) => ({ ...f, contact_phone: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-border px-2 py-2 text-sm" />
              </div>
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-navy/70">Notes</label>
                <textarea rows={2} value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-border px-2 py-2 text-sm" />
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button onClick={() => setEditing(null)} className="rounded-md border border-gray-300 px-4 py-2 text-xs font-bold uppercase">Cancel</button>
                <button disabled={busy} onClick={submitEdit} className="rounded-md bg-gold px-4 py-2 text-xs font-black uppercase tracking-wider text-gold-foreground disabled:opacity-50">
                  {busy ? "Saving…" : "Save changes"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );

}

type FileRef = { name: string; path: string; type: string; url?: string };

/**
 * Compact document cell: shows "<Doc> Attached" links when files exist,
 * otherwise a plain "Upload <Doc>" control.
 */
function DocCell({
  files, attachedLabel, uploadLabel, uploading, busy, onFiles, onRemove,
}: {
  files: FileRef[];
  attachedLabel: string;
  uploadLabel: string;
  uploading: boolean;
  busy: boolean;
  onFiles: (files: FileList | null) => void;
  onRemove: (path: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      {files.map((a, i) => (
        <span key={i} className="inline-flex w-full items-center gap-1 rounded bg-emerald-50 px-1.5 py-1 text-[10px] font-bold text-emerald-700" title={a.name}>
          {a.type === "application/pdf" ? <FileIcon className="h-3 w-3 shrink-0" /> : <ImageIcon className="h-3 w-3 shrink-0" />}
          <a href={a.url ?? "#"} target="_blank" rel="noopener noreferrer" className="truncate underline">{attachedLabel}</a>
          <button onClick={() => onRemove(a.path)} className="ml-auto text-red-600" title="Remove">✕</button>
        </span>
      ))}
      <label className={`inline-flex items-center gap-1 rounded border border-dashed border-navy/30 px-1.5 py-1 text-[9.5px] font-bold uppercase tracking-wide text-navy/70 hover:border-gold hover:bg-gold/10 ${busy ? "opacity-50" : "cursor-pointer"}`}>
        <Upload className="h-3 w-3 shrink-0" />
        <span className="truncate">{uploading ? "Uploading…" : uploadLabel}</span>
        <input type="file" accept="application/pdf,image/*" multiple className="hidden" disabled={busy}
          onChange={(e) => onFiles(e.target.files)} />
      </label>
    </div>
  );
}


/** Inline-editable "Fare On Demand" cell (saves on blur / Enter). */
function FareOnDemandCell({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [v, setV] = useState(value);
  useEffect(() => { setV(value); }, [value]);
  return (
    <input
      value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => { if (v !== value) onSave(v.trim()); }}
      onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
      placeholder="Fare on call / WhatsApp"
      className="w-full rounded border border-navy/20 bg-white px-2 py-1 text-[11px] font-bold text-orange-700 outline-none focus:border-gold"
    />
  );
}
