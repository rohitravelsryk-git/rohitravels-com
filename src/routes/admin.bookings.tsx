import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import { Plane, LogOut, Bell, MessageCircle, CheckCircle2, XCircle, Ticket, Paperclip, Upload, FileText as FileIcon, Image as ImageIcon, Pencil, Trash2 } from "lucide-react";
import { adminLogout } from "@/lib/fares.functions";
import { listBookingsAdmin, setBookingStatusAdmin, setBookingPaymentStatus, uploadBookingTicket, removeBookingTicket, updateBookingAdmin, deleteBookingAdmin, type AdminBooking } from "@/lib/agent-bookings.functions";


import { AdminHeaderExtras } from "@/components/AdminHeaderExtras";
import { AdminTabs } from "@/components/AdminTabs";

export const Route = createFileRoute("/admin/bookings")({
  head: () => ({ meta: [{ title: "Agent Bookings — Rohi Admin" }] }),
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData({
      queryKey: ["admin-bookings"],
      queryFn: () => listBookingsAdmin(),
    });
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
  const list = useServerFn(listBookingsAdmin);
  const setStatus = useServerFn(setBookingStatusAdmin);
  const setPayment = useServerFn(setBookingPaymentStatus);
  const upTicket = useServerFn(uploadBookingTicket);
  const rmTicket = useServerFn(removeBookingTicket);
  const saveBooking = useServerFn(updateBookingAdmin);
  const removeBooking = useServerFn(deleteBookingAdmin);

  const logout = useServerFn(adminLogout);

  const { data } = useSuspenseQuery({
    queryKey: ["admin-bookings"],
    queryFn: () => list(),
    refetchInterval: 20_000,
  });

  const [busy, setBusy] = useState(false);
  const [uploadingId, setUploadingId] = useState<string | null>(null);

  const [showBell, setShowBell] = useState(false);
  const [popup, setPopup] = useState<AdminBooking | null>(null);
  const lastSeen = useRef<Set<string>>(new Set());
  const bootstrapped = useRef(false);

  const pending = useMemo(() => data.filter((b) => b.status === "pending"), [data]);

  // Desktop notifications permission
  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  // Detect new pending bookings and popup + browser notify
  useEffect(() => {
    if (!bootstrapped.current) {
      pending.forEach((b) => lastSeen.current.add(b.id));
      bootstrapped.current = true;
      return;
    }
    const fresh = pending.filter((b) => !lastSeen.current.has(b.id));
    fresh.forEach((b) => lastSeen.current.add(b.id));
    if (fresh.length) {
      setPopup(fresh[0]);
      if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
        try {
          const b = fresh[0];
          new Notification("New agent booking · Rohi Travels", {
            body: `${b.agency_name ?? "Agent"} · ${b.seats} seats · ${b.fare_snapshot?.airline ?? ""}`,
            tag: b.id,
          });
        } catch { /* ignore */ }
      }
    }
  }, [pending]);

  async function updateStatus(id: string, status: "confirmed" | "cancelled" | "pending") {
    setBusy(true);
    try {
      await setStatus({ data: { id, status } });
      router.invalidate();
    } catch (e: any) {
      alert(e.message);
    } finally { setBusy(false); }
  }

  async function updatePayment(id: string, payment_status: "unpaid" | "pending" | "confirmed" | "refunded") {
    setBusy(true);
    try {
      await setPayment({ data: { id, payment_status } });
      router.invalidate();
    } catch (e: any) { alert(e.message); } finally { setBusy(false); }
  }

  async function removeTicket(id: string, path: string) {
    if (!confirm("Remove this ticket file?")) return;
    setBusy(true);
    try {
      await rmTicket({ data: { id, path } });
      router.invalidate();
    } catch (e: any) { alert(e.message); } finally { setBusy(false); }
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
      router.invalidate();
    } catch (e: any) { alert(e.message); } finally { setUploadingId(null); setBusy(false); }
  }



  function waReply(b: AdminBooking) {
    const f = b.fare_snapshot ?? {};
    const text = encodeURIComponent(
      `*ROHI INTERNATIONAL TRAVELS*\n\nDear ${b.contact_person ?? "Agent"},\n\nRegarding your group booking request:\n${f.airline ?? ""} · ${f.origin_code ?? ""} → ${f.destination_code ?? ""}\nSeats: ${b.seats}\n\n`,
    );
    return `https://wa.me/${toWa(b.contact_phone)}?text=${text}`;
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
            <button
              onClick={() => setShowBell((v) => !v)}
              className="relative inline-flex items-center gap-2 rounded-md border border-white/20 px-3 py-2 text-xs font-semibold hover:bg-white/10"
            >
              <Bell className="h-3.5 w-3.5" /> Pending
              {pending.length > 0 && (
                <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-black text-white ring-2 ring-navy">
                  {pending.length}
                </span>
              )}
            </button>
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
            <Ticket className="h-4 w-4" /> All Booking Requests
            <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px]">{data.length}</span>
          </div>
          <span className="ml-auto text-xs text-muted-foreground">Auto-refreshing every 20s</span>
        </div>

        <div className="overflow-x-auto rounded-lg border border-navy/10 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-navy text-[10px] uppercase tracking-widest text-white">
              <tr>
                <th className="px-3 py-2 text-left">Date</th>
                <th className="px-3 py-2 text-left">Agency Name / Contact</th>
                <th className="px-3 py-2 text-left">Flight Details</th>
                <th className="px-3 py-2 text-center">Seats</th>
                <th className="px-3 py-2 text-left">Passenger Names</th>
                <th className="px-3 py-2 text-left">Files Uploaded</th>
                <th className="px-3 py-2 text-left">Payment Slip</th>

                <th className="px-3 py-2 text-center">Payment Status</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.map((b) => (
                <tr key={b.id} className={`border-t border-navy/5 align-top ${b.status === "pending" ? "bg-amber-50/60" : ""}`}>
                  <td className="whitespace-nowrap px-3 py-2 text-xs text-muted-foreground">{formatDateTime(b.created_at)}</td>
                  <td className="px-3 py-2">
                    <p className="font-semibold text-navy">{b.agency_name ?? "—"}</p>
                    <p className="text-[11px] text-muted-foreground">{b.contact_person ?? ""}</p>
                    <p className="text-[11px] font-semibold text-navy/80">{b.contact_phone}</p>
                    {b.agent_phone && b.agent_phone !== b.contact_phone && (
                      <p className="text-[10.5px] text-muted-foreground">{b.agent_phone}</p>
                    )}
                    {b.agent_email && <p className="text-[10.5px] text-muted-foreground">{b.agent_email}</p>}
                  </td>
                  <td className="max-w-[260px] px-3 py-2 text-[11px] leading-snug">
                    <p className="font-bold text-navy">{b.fare_snapshot?.airline ?? "—"} · {b.fare_snapshot?.origin_code ?? ""} → {b.fare_snapshot?.destination_code ?? ""}</p>
                    <p className="whitespace-pre-line font-mono text-[10.5px] text-navy/80">{fareLine(b.fare_snapshot)}</p>
                    <p className="mt-0.5 text-[10.5px] text-orange-700">Fare: {b.fare_snapshot?.price_text ?? "—"} · Bag: {b.fare_snapshot?.baggage ?? "—"}</p>
                  </td>
                  <td className="px-3 py-2 text-center font-black text-navy">{b.seats}</td>
                  <td className="max-w-[220px] whitespace-pre-wrap px-3 py-2 text-[11px] text-navy/80">{b.passenger_names}</td>
                  <td className="px-3 py-2">
                    {b.attachments && b.attachments.length > 0 ? (
                      <div className="flex flex-col gap-1">
                        {b.attachments.map((a, i) => (
                          <a key={i} href={a.url ?? "#"} target="_blank" rel="noopener noreferrer"
                            className="inline-flex max-w-[160px] items-center gap-1 rounded bg-navy/5 px-2 py-1 text-[10.5px] font-semibold text-navy hover:bg-gold/20" title={a.name}>
                            {a.type === "application/pdf" ? <FileIcon className="h-3 w-3 shrink-0" /> : <ImageIcon className="h-3 w-3 shrink-0" />}
                            <span className="truncate">{a.name}</span>
                          </a>
                        ))}
                      </div>
                    ) : <span className="text-[11px] text-muted-foreground">—</span>}
                    {b.tickets && b.tickets.length > 0 && (
                      <div className="mt-1 flex flex-col gap-1 border-t border-navy/10 pt-1">
                        {b.tickets.map((t, i) => (
                          <span key={i} className="inline-flex max-w-[160px] items-center gap-1 rounded bg-emerald-50 px-2 py-1 text-[10.5px] font-semibold text-emerald-700">
                            <Ticket className="h-3 w-3 shrink-0" />
                            <a href={t.url ?? "#"} target="_blank" rel="noopener noreferrer" className="truncate underline" title={t.name}>{t.name}</a>
                            <button onClick={() => removeTicket(b.id, t.path)} className="ml-auto text-red-600" title="Remove">✕</button>
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {b.payment_slips && b.payment_slips.length > 0 ? (
                      <div className="flex flex-col gap-1">
                        {b.payment_slips.map((s, i) => (
                          <a key={i} href={s.url ?? "#"} target="_blank" rel="noopener noreferrer"
                            className="inline-flex max-w-[160px] items-center gap-1 rounded bg-sky-50 px-2 py-1 text-[10.5px] font-semibold text-sky-800 hover:bg-sky-100" title={s.name}>
                            {s.type === "application/pdf" ? <FileIcon className="h-3 w-3 shrink-0" /> : <ImageIcon className="h-3 w-3 shrink-0" />}
                            <span className="truncate">{s.name}</span>
                          </a>
                        ))}
                      </div>
                    ) : (
                      <span className="text-[11px] text-muted-foreground">Not uploaded</span>
                    )}
                  </td>

                  <td className="px-3 py-2 text-center">
                    <select
                      value={b.payment_status ?? "unpaid"}
                      disabled={busy}
                      onChange={(e) => updatePayment(b.id, e.target.value as any)}
                      className={`rounded border px-2 py-1 text-[10.5px] font-bold uppercase ${
                        b.payment_status === "confirmed" ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                        : b.payment_status === "refunded" ? "border-red-300 bg-red-50 text-red-700"
                        : "border-amber-300 bg-amber-50 text-amber-800"
                      }`}
                    >
                      <option value="unpaid">Unpaid</option>
                      <option value="pending">Pending</option>
                      <option value="confirmed">Confirmed</option>
                      <option value="refunded">Refunded</option>
                    </select>
                    <p className="mt-1">
                      <span className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${
                        b.status === "pending" ? "bg-amber-100 text-amber-700"
                        : b.status === "confirmed" ? "bg-emerald-100 text-emerald-700"
                        : "bg-red-100 text-red-700"
                      }`}>{b.status}</span>
                    </p>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="inline-flex flex-wrap justify-end gap-1">
                      <a href={waReply(b)} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded bg-whatsapp px-2 py-1.5 text-[11px] font-bold text-whatsapp-foreground hover:opacity-90" title="Reply on WhatsApp">
                        <MessageCircle className="h-3 w-3" /> Reply
                      </a>
                      {b.status !== "confirmed" && (
                        <button disabled={busy} onClick={() => updateStatus(b.id, "confirmed")}
                          className="inline-flex items-center gap-1 rounded bg-emerald-600 px-2 py-1.5 text-[11px] font-bold text-white hover:bg-emerald-700 disabled:opacity-50">
                          <CheckCircle2 className="h-3 w-3" /> Confirm
                        </button>
                      )}
                      {b.status !== "cancelled" && (
                        <button disabled={busy} onClick={() => updateStatus(b.id, "cancelled")}
                          className="inline-flex items-center gap-1 rounded bg-red-600 px-2 py-1.5 text-[11px] font-bold text-white hover:bg-red-700 disabled:opacity-50">
                          <XCircle className="h-3 w-3" /> Cancel
                        </button>
                      )}
                      <label className={`inline-flex cursor-pointer items-center gap-1 rounded bg-navy px-2 py-1.5 text-[11px] font-bold text-white hover:bg-navy/90 ${busy ? "opacity-50" : ""}`}>
                        <Upload className="h-3 w-3" /> {uploadingId === b.id ? "Uploading…" : "Upload Ticket"}
                        <input type="file" accept="application/pdf,image/*" multiple className="hidden"
                          onChange={(e) => onTicketFiles(b.id, e.target.files)} />
                      </label>
                    </div>
                  </td>
                </tr>
              ))}
              {data.length === 0 && (
                <tr><td colSpan={9} className="px-3 py-10 text-center text-muted-foreground">
                  <Paperclip className="mx-auto mb-2 h-6 w-6 text-navy/30" />
                  No booking requests yet.
                </td></tr>
              )}
            </tbody>
          </table>
        </div>

      </div>

      {/* Pending drawer */}
      {showBell && (
        <div className="fixed inset-y-0 right-0 z-40 w-full max-w-md overflow-y-auto border-l border-border bg-card shadow-2xl">
          <div className="sticky top-0 flex items-center justify-between border-b border-border bg-navy px-4 py-3 text-white">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-gold" />
              <p className="text-sm font-bold uppercase tracking-widest">Pending bookings</p>
              <span className="ml-1 rounded-full bg-gold/20 px-2 py-0.5 text-[10px] font-bold text-gold">{pending.length}</span>
            </div>
            <button onClick={() => setShowBell(false)} className="rounded p-1 hover:bg-white/10">✕</button>
          </div>
          <div className="divide-y divide-border">
            {pending.length === 0 && (
              <p className="p-6 text-center text-xs text-muted-foreground">No pending bookings.</p>
            )}
            {pending.map((b) => (
              <div key={b.id} className="p-4">
                <p className="text-[10px] text-muted-foreground">{formatDateTime(b.created_at)}</p>
                <p className="mt-1 text-sm font-semibold text-navy">{b.agency_name ?? "Agent"}</p>
                <p className="text-[11px] text-muted-foreground">{b.fare_snapshot?.airline} · {b.fare_snapshot?.origin_code} → {b.fare_snapshot?.destination_code} · {b.seats} seats</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <a href={waReply(b)} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded bg-whatsapp px-2 py-1 text-[11px] font-bold text-whatsapp-foreground">
                    <MessageCircle className="h-3 w-3" /> Reply
                  </a>
                  <button onClick={() => updateStatus(b.id, "confirmed")}
                    className="inline-flex items-center gap-1 rounded bg-emerald-600 px-2 py-1 text-[11px] font-bold text-white">
                    <CheckCircle2 className="h-3 w-3" /> Confirm
                  </button>
                  <button onClick={() => updateStatus(b.id, "cancelled")}
                    className="inline-flex items-center gap-1 rounded bg-red-600 px-2 py-1 text-[11px] font-bold text-white">
                    <XCircle className="h-3 w-3" /> Cancel
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* New-booking popup */}
      {popup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setPopup(null)}>
          <div className="w-full max-w-md overflow-hidden rounded-xl bg-white shadow-2xl ring-1 ring-black/5" onClick={(e) => e.stopPropagation()}>
            <div className="bg-gradient-to-r from-orange-500 to-amber-500 px-5 py-3 text-white">
              <p className="text-[10px] font-bold uppercase tracking-widest opacity-80">New booking request</p>
              <h3 className="text-lg font-black">{popup.agency_name ?? "Agent"}</h3>
            </div>
            <div className="space-y-2 p-5 text-sm">
              <p><span className="font-semibold text-gray-600">Flight:</span> {popup.fare_snapshot?.airline} · {popup.fare_snapshot?.origin_code} → {popup.fare_snapshot?.destination_code}</p>
              <p><span className="font-semibold text-gray-600">Seats:</span> <span className="font-black text-navy">{popup.seats}</span></p>
              <p><span className="font-semibold text-gray-600">Contact:</span> {popup.contact_phone}</p>
              <p className="whitespace-pre-line text-xs text-gray-700"><span className="font-semibold text-gray-600">Passengers:</span> {popup.passenger_names}</p>
              <div className="flex justify-end gap-2 pt-3">
                <button onClick={() => setPopup(null)} className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-semibold">Dismiss</button>
                <button onClick={() => { setPopup(null); setShowBell(true); }} className="rounded-md bg-navy px-3 py-1.5 text-xs font-bold text-white">Review</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
