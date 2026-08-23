import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Plane, LogOut, CheckCircle2, Ticket, Paperclip, Upload, Pencil, Trash2 } from "lucide-react";
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

  async function updatePayment(id: string, payment_status: any) {
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

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-navy text-navy-foreground">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between px-4 py-4">
          <div className="font-serif text-lg font-black">Admin Panel: All Group Bookings</div>
          <div className="flex items-center gap-4">
            <AdminHeaderExtras />
            <button onClick={() => logout()} className="text-xs font-bold text-gold">LOGOUT</button>
          </div>
        </div>
        <AdminTabs />
      </header>

      <div className="mx-auto max-w-[1600px] px-4 py-6">
        <div className="rounded-lg border border-navy/10 bg-white shadow-sm overflow-x-auto">
          <table className="w-full table-fixed text-sm">
            <colgroup>
              <col className="w-[80px]" /><col className="w-[80px]" /><col className="w-[90px]" /><col className="w-[80px]" /><col className="w-[120px]" />
              <col className="w-[180px]" /><col className="w-[100px]" /><col className="w-[100px]" /><col className="w-[100px]" /><col className="w-[80px]" />
              <col className="w-[80px]" /><col className="w-[100px]" /><col className="w-[100px]" /><col className="w-[100px]" /><col className="w-[100px]" />
              <col className="w-[100px]" /><col className="w-[150px]" />
            </colgroup>
            <thead className="bg-navy text-[9px] uppercase text-white">
              <tr>
                <th className="p-2">Group Type</th><th className="p-2">FARE ID</th><th className="p-2">Date</th><th className="p-2">Booking ID</th>
                <th className="p-2">Agent</th><th className="p-2">Flight Details</th><th className="p-2">Given Name</th><th className="p-2">Sur Name</th>
                <th className="p-2">Passport Copies</th><th className="p-2">PNR</th><th className="p-2">No.of Seats</th><th className="p-2">Fare</th>
                <th className="p-2">Total Cost</th><th className="p-2">Payment Slip</th><th className="p-2">Payment Status</th>
                <th className="p-2">Ticket Status</th><th className="p-2">Actions</th>
              </tr>
            </thead>
            <tbody className="text-[11px]">
              {rows.map((b) => (
                <tr key={b.id} className="border-t border-navy/5">
                  <td className="p-2">{b.fare_snapshot?.group_type ?? "Party"}</td>
                  <td className="p-2 text-gold font-mono">{b.fare_snapshot?.id?.slice(0, 8)}</td>
                  <td className="p-2">{formatDateTime(b.created_at)}</td>
                  <td className="p-2 font-mono font-bold">{b.booking_ref}</td>
                  <td className="p-2">{b.agency_name}</td>
                  <td className="p-2 leading-tight">{flightBlockLines(b.fare_snapshot).filter(l => !l.startsWith("Fare:")).join(" ")}</td>
                  <td className="p-2">{b.passenger_names?.split("\n").map((n, i) => <div key={i}>{n.split("|")[0].split(" ").slice(0,-1).join(" ")}</div>)}</td>
                  <td className="p-2">{b.passenger_names?.split("\n").map((n, i) => <div key={i}>{n.split("|")[0].split(" ").slice(-1)}</div>)}</td>
                  <td className="p-2"><DocCell files={(b.attachments ?? []).filter((a: any) => a.kind === "passport")} attachedLabel="Attached" uploadLabel="Upload" onFiles={(fl: FileList | null) => onDocFiles(b.id, "passport", fl)} /></td>
                  <td className="p-2 font-bold">{b.fare_snapshot?.pnr}</td>
                  <td className="p-2 text-center">{b.seats}</td>
                  <td className="p-2"><FareOnDemandCell value={b.fare_on_demand ?? ""} onSave={(v: string) => saveFod(b.id, v)} /></td>
                  <td className="p-2 text-emerald-600 font-bold">{( (Number(b.fare_on_demand?.replace(/[^\d]/g, "") || b.fare_snapshot?.price_text?.replace(/[^\d]/g, "") || 0)) * b.seats).toLocaleString()}</td>
                  <td className="p-2"><DocCell files={b.payment_slips ?? []} attachedLabel="Attached" uploadLabel="Upload" onFiles={(fl: FileList | null) => onDocFiles(b.id, "payment_slip", fl)} /></td>
                  <td className="p-2">{b.payment_status}</td>
                  <td className="p-2 text-center font-bold">{b.status}</td>
                  <td className="p-2 flex gap-1">
                     <button onClick={() => updateStatus(b.id, "confirmed")} className="bg-emerald-600 text-white px-2 py-1 rounded text-[9px]">CONFIRM</button>
                     <button onClick={() => onDelete(b)} className="bg-red-500 text-white px-2 py-1 rounded text-[9px]">DELETE</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
