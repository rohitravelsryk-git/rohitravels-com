import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Ticket, Download, Paperclip, FileText, Image as ImageIcon, Plane } from "lucide-react";

export const Route = createFileRoute("/_agentapp/agent/bookings")({
  ssr: false,
  component: BookingsPage,
});

type FileRef = { name: string; path: string; type?: string; size?: number; url?: string; kind?: string };

type Booking = {
  id: string;
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
  if (kind === "payment") {
    const paid = v === "confirmed" || v === "paid" || v === "ledger";
    const cls = paid
      ? "bg-emerald-100 text-emerald-700 ring-emerald-200"
      : "bg-amber-100 text-amber-800 ring-amber-200";
    return <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ring-1 ${cls}`}>{paid ? "Paid" : "Unpaid"}</span>;
  }

  if (kind === "ticket") {
    // Mirrors the admin "Ticket Status" column exactly: Confirmed only when admin confirms.
    const confirmed = v === "confirmed";
    const cls = confirmed
      ? "bg-emerald-100 text-emerald-700 ring-emerald-200"
      : "bg-amber-100 text-amber-800 ring-amber-200";
    return <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ring-1 ${cls}`}>{confirmed ? "Confirmed" : "On Hold"}</span>;
  }
  const cls = v === "confirmed" ? "bg-emerald-100 text-emerald-700 ring-emerald-200"
    : v === "cancelled" ? "bg-red-100 text-red-700 ring-red-200"
    : "bg-amber-100 text-amber-800 ring-amber-200";
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ring-1 ${cls}`}>{value || "—"}</span>;
}

function AttachList({ files }: { files: FileRef[] }) {
  if (!files.length) {
    return <span className="text-[11px] text-muted-foreground"><Paperclip className="inline h-3 w-3" /> —</span>;
  }
  return (
    <div className="flex flex-col gap-1">
      {files.map((a, k) => (
        <a key={k} href={a.url ?? "#"} target="_blank" rel="noopener noreferrer" title={a.name}
          className="inline-flex max-w-[150px] items-center gap-1 rounded bg-navy/5 px-2 py-1 text-[10.5px] font-semibold text-navy hover:bg-gold/25">
          {a.type === "application/pdf" ? <FileText className="h-3 w-3 shrink-0" /> : <ImageIcon className="h-3 w-3 shrink-0" />}
          <span className="truncate">{a.name}</span>
        </a>
      ))}
    </div>
  );
}


function BookingsPage() {
  const [rows, setRows] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<string | null>(null);

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
      payment_slips: Array.isArray(r.payment_slips) ? r.payment_slips : [],
      payment_status: r.payment_status ?? "unpaid",
      ticket_status: r.ticket_status ?? "waiting",
    })) as Booking[];

    // Sign private storage files so the agent can open them.
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

  /** Agent uploads payment slips or visa copies against their own booking. */
  async function uploadFiles(b: Booking, files: FileList | null, kind: "payment_slip" | "visa") {
    if (!files || !files.length) return;
    setUploading(`${b.id}:${kind}`);
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes?.user?.id;
      if (!uid) throw new Error("Your session expired — please sign in again.");
      const folder = kind === "payment_slip" ? "payment-slips" : "visa";
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
              <th className="px-3 py-3 text-left font-bold">Passport Copies</th>
              <th className="px-3 py-3 text-left font-bold">Visa Copies</th>
              <th className="px-3 py-3 text-center font-bold">Payment Status</th>
              <th className="px-3 py-3 text-center font-bold">Ticket Status</th>
              <th className="px-3 py-3 text-center font-bold">Print / Download Ticket</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} className="p-8 text-center text-muted-foreground">Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={9} className="p-10 text-center text-muted-foreground">
                  <Plane className="mx-auto mb-2 h-6 w-6 -rotate-45 text-navy/30" />
                  No bookings yet. <Link to="/agent/fares" className="font-semibold text-orange-600 underline">Browse group fares →</Link>
                </td>
              </tr>
            ) : rows.map((b, i) => {
              const f = b.fare_snapshot ?? {};
              const passports = b.attachments.filter((a) => (a.kind ?? "passport") === "passport");
              const visas = b.attachments.filter((a) => a.kind === "visa");
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
                  <td className="px-3 py-3"><AttachList files={passports} /></td>
                  <td className="px-3 py-3"><AttachList files={visas} /></td>

                  <td className="px-3 py-3 text-center">
                    <Pill value={b.payment_status} kind="payment" />
                    {!(b.payment_status === "confirmed" || b.payment_status === "ledger") && (
                      <label className={`mt-1.5 inline-flex cursor-pointer items-center gap-1 rounded-md bg-navy px-2.5 py-1.5 text-[10px] font-black uppercase tracking-wider text-navy-foreground hover:opacity-90 ${uploading === b.id ? "opacity-50" : ""}`}>
                        <Paperclip className="h-3 w-3" />
                        {uploading === b.id ? "Uploading…" : "Upload Payment Slip"}
                        <input type="file" accept="image/*,application/pdf" multiple className="hidden"
                          onChange={(e) => uploadSlips(b, e.target.files)} />
                      </label>
                    )}
                    {b.payment_slips.length > 0 && (
                      <div className="mt-1 flex flex-col items-center gap-0.5">
                        {b.payment_slips.map((s, k) => (
                          <a key={k} href={s.url ?? "#"} target="_blank" rel="noopener noreferrer" title={s.name}
                            className="max-w-[150px] truncate text-[10px] font-semibold text-navy underline">
                            🧾 {s.name}
                          </a>
                        ))}
                      </div>
                    )}
                  </td>

                  <td className="px-3 py-3 text-center"><Pill value={b.status} kind="ticket" /></td>
                  <td className="px-3 py-3 text-center">
                    {b.status !== "confirmed" ? (
                      <span className="text-[10.5px] font-semibold text-amber-700">Waiting Uploads</span>
                    ) : b.tickets.length ? (
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
