import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Ticket, Download, Paperclip, FileText, Image as ImageIcon, Plane } from "lucide-react";

export const Route = createFileRoute("/_agentapp/agent/bookings")({
  ssr: false,
  component: BookingsPage,
});

type FileRef = { name: string; path: string; type?: string; size?: number; url?: string };

type Booking = {
  id: string;
  fare_snapshot: any;
  seats: number;
  passenger_names: string;
  contact_phone: string;
  status: string;
  payment_status: string;
  ticket_status: string;
  tickets: FileRef[];
  attachments: FileRef[];
  notes: string | null;
  created_at: string;
};

function fmt(iso: string) {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}-${d.toLocaleString("en-US", { month: "short" })}-${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function flightLine(f: any) {
  if (!f) return "—";
  return f.flight_details
    ?? `${f.flight_date ?? ""} ${f.origin_code ?? ""}-${f.destination_code ?? ""}${f.depart_time ? ` ${f.depart_time}` : ""}${f.arrive_time ? ` ${f.arrive_time}` : ""}${f.flight_number ? ` ${f.flight_number}` : ""}`;
}

function Pill({ value, kind }: { value: string; kind: "payment" | "ticket" | "status" }) {
  const v = (value || "").toLowerCase();
  const good = v === "confirmed" || v === "issued" || v === "paid";
  const bad = v === "cancelled" || v === "refunded";
  const cls = good
    ? "bg-emerald-100 text-emerald-700 ring-emerald-200"
    : bad
      ? "bg-red-100 text-red-700 ring-red-200"
      : "bg-amber-100 text-amber-800 ring-amber-200";
  const label = kind === "ticket" && v === "pending" ? "Not issued" : value || "—";
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ring-1 ${cls}`}>
      {label}
    </span>
  );
}

function BookingsPage() {
  const [rows, setRows] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    const { data: sess } = await supabase.auth.getSession();
    const uid = sess.session?.user?.id;
    if (!uid) return setLoading(false);
    const { data } = await supabase
      .from("agent_bookings")
      .select("*")
      .eq("agent_user_id", uid)
      .order("created_at", { ascending: false });

    const list = ((data ?? []) as any[]).map((r) => ({
      ...r,
      tickets: Array.isArray(r.tickets) ? r.tickets : [],
      attachments: Array.isArray(r.attachments) ? r.attachments : [],
      payment_status: r.payment_status ?? "unpaid",
      ticket_status: r.ticket_status ?? "pending",
    })) as Booking[];

    // Sign private storage files so the agent can open them.
    await Promise.all(
      list.flatMap((b) =>
        [...b.tickets, ...b.attachments].map(async (f) => {
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

  useEffect(() => {
    load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="min-h-full bg-background p-4 md:p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex items-center gap-3 rounded-lg bg-navy px-4 py-2.5 text-white shadow-sm">
          <Ticket className="h-4 w-4 text-gold" />
          <div>
            <p className="font-serif text-base font-black leading-none">All Group Bookings</p>
            <p className="mt-1 text-[10px] uppercase tracking-[0.2em] text-white/60">B2B Agent Portal</p>
          </div>
          <span className="ml-2 rounded-full bg-gold/20 px-2 py-0.5 text-[10px] font-bold text-gold">{rows.length}</span>
        </div>
        <Link
          to="/agent/fares"
          className="rounded-full bg-gradient-to-r from-orange-500 to-orange-400 px-5 py-2.5 text-xs font-black uppercase tracking-wider text-navy shadow-md transition hover:from-orange-400 hover:to-orange-300"
        >
          + New Booking
        </Link>
      </div>

      <div className="overflow-x-auto rounded-xl border border-navy/10 bg-card shadow-[0_10px_30px_-12px_rgba(11,37,69,.25)]">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-navy text-[10px] uppercase tracking-[0.12em] text-white">
              <th className="px-3 py-3 text-left font-bold">Date</th>
              <th className="px-3 py-3 text-left font-bold">Airline / Flight Details</th>
              <th className="px-3 py-3 text-center font-bold">Seats</th>
              <th className="px-3 py-3 text-left font-bold">Passenger Names</th>
              <th className="px-3 py-3 text-left font-bold">Files Uploaded</th>
              <th className="px-3 py-3 text-center font-bold">Payment Status</th>
              <th className="px-3 py-3 text-center font-bold">Ticket Status</th>
              <th className="px-3 py-3 text-center font-bold">Print / Download Ticket</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-10 text-center text-muted-foreground">
                  <Plane className="mx-auto mb-2 h-6 w-6 -rotate-45 text-navy/30" />
                  No bookings yet. <Link to="/agent/fares" className="font-semibold text-orange-600 underline">Browse group fares →</Link>
                </td>
              </tr>
            ) : rows.map((b, i) => {
              const f = b.fare_snapshot ?? {};
              return (
                <tr key={b.id} className={`border-t border-navy/5 align-top ${i % 2 ? "bg-secondary/40" : "bg-card"}`}>
                  <td className="whitespace-nowrap px-3 py-3 text-[11px] font-semibold text-navy/70">{fmt(b.created_at)}</td>
                  <td className="max-w-[300px] px-3 py-3">
                    <p className="text-[12px] font-black text-navy">
                      {f.airline ?? "—"} · {f.origin_code ?? ""} → {f.destination_code ?? ""}
                    </p>
                    <p className="mt-0.5 whitespace-pre-line font-mono text-[10.5px] leading-snug text-navy/75">{flightLine(f)}</p>
                    <p className="mt-0.5 text-[10.5px] font-semibold text-orange-600">
                      Fare: {f.price_text ?? "—"} · Bag: {f.baggage ?? "—"}
                    </p>
                  </td>
                  <td className="px-3 py-3 text-center text-base font-black text-navy">{b.seats}</td>
                  <td className="max-w-[220px] whitespace-pre-wrap px-3 py-3 text-[11px] leading-snug text-navy/80">{b.passenger_names}</td>
                  <td className="px-3 py-3">
                    {b.attachments.length ? (
                      <div className="flex flex-col gap-1">
                        {b.attachments.map((a, k) => (
                          <a key={k} href={a.url ?? "#"} target="_blank" rel="noopener noreferrer" title={a.name}
                            className="inline-flex max-w-[170px] items-center gap-1 rounded bg-navy/5 px-2 py-1 text-[10.5px] font-semibold text-navy hover:bg-gold/25">
                            {a.type === "application/pdf" ? <FileText className="h-3 w-3 shrink-0" /> : <ImageIcon className="h-3 w-3 shrink-0" />}
                            <span className="truncate">{a.name}</span>
                          </a>
                        ))}
                      </div>
                    ) : <span className="text-[11px] text-muted-foreground"><Paperclip className="inline h-3 w-3" /> —</span>}
                  </td>
                  <td className="px-3 py-3 text-center"><Pill value={b.payment_status} kind="payment" /></td>
                  <td className="px-3 py-3 text-center"><Pill value={b.ticket_status} kind="ticket" /></td>
                  <td className="px-3 py-3 text-center">
                    {b.tickets.length ? (
                      <div className="flex flex-col items-center gap-1">
                        {b.tickets.map((t, k) => (
                          <a key={k} href={t.url ?? "#"} target="_blank" rel="noopener noreferrer" title={t.name}
                            className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-[10.5px] font-black uppercase tracking-wider text-white shadow-sm hover:bg-emerald-700">
                            <Download className="h-3 w-3" /> Ticket {b.tickets.length > 1 ? k + 1 : ""}
                          </a>
                        ))}
                      </div>
                    ) : (
                      <span className="text-[10.5px] font-semibold text-muted-foreground">Awaiting issue</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-[11px] text-muted-foreground">
        Tickets appear here automatically once payment is confirmed and our team uploads your e-ticket.
      </p>
    </div>
  );
}
