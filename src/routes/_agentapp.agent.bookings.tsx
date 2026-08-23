import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { flightBlockLines } from "@/lib/booking-flight-format";
import { Ticket, Download, Paperclip, FileText, Image as ImageIcon, Plane } from "lucide-react";

export const Route = createFileRoute("/_agentapp/agent/bookings")({
  ssr: false,
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
  const dateStr = `${p(d.getDate())}-${d.toLocaleString("en-US", { month: "short" })}-${d.getFullYear()}`;
  const timeStr = `${p(d.getHours())}:${p(d.getMinutes())}`;
  return (
    <div className="flex flex-col text-[12px] font-black text-navy leading-tight">
      <span className="bg-navy/5 px-1 rounded inline-block w-fit">{dateStr}</span>
      <span className="text-[10px] opacity-60 font-bold ml-1">{timeStr}</span>
    </div>
  );
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
    const submitted = v === "submitted" || v === "waiting" || v === "";
    const cls = confirmed
      ? "bg-emerald-100 text-emerald-700 ring-emerald-200"
      : submitted
      ? "bg-sky-100 text-sky-800 ring-sky-200"
      : "bg-amber-100 text-amber-800 ring-amber-200";
    const label = confirmed ? "Confirmed" : submitted ? "Submitted" : "On Hold";
    return <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ring-1 ${cls}`}>{label}</span>;
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
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("actionable");

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



  const q = search.trim().toLowerCase();
  const filtered = rows.filter((b) => {
    if (statusFilter !== "all") {
      const tStat = (b.ticket_status || "").toLowerCase();
      const st = tStat === "confirmed" ? "confirmed"
        : (tStat === "pending" || tStat === "on hold" || tStat === "waiting") ? "pending" : "submitted";
      
      if (statusFilter === "actionable") {
        if (st === "confirmed") return false;
      } else if (st !== statusFilter) {
        return false;
      }
    }
    if (!q) return true;
    const f = b.fare_snapshot ?? {};
    return [b.booking_ref, b.passenger_names, b.status, b.payment_status, f.airline, f.origin_code, f.destination_code]
      .filter(Boolean).join(" ").toLowerCase().includes(q);
  });

  return (
    <div className="min-h-full bg-background px-0 py-4 md:py-6 pb-24">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex w-full items-center gap-3 bg-navy px-0 py-2.5 text-white shadow-sm">
          <Ticket className="h-4 w-4 text-gold" />
          <div className="pl-4">
            <p className="font-serif text-base font-black leading-none">All Group Bookings</p>
            <p className="mt-1 text-[10px] uppercase tracking-[0.2em] text-white/60">B2B Agent Portal</p>
          </div>
          <span className="ml-2 rounded-full bg-gold/20 px-2 py-0.5 text-[10px] font-bold text-gold">{rows.length}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2 px-4">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search booking ID, sector, passenger…"
            className="w-60 rounded-md border border-navy/20 bg-card px-3 py-2 text-xs outline-none focus:border-gold"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-md border border-navy/20 bg-card px-2 py-2 text-xs font-semibold text-navy outline-none focus:border-gold"
          >
            <option value="all">All ticket status</option>
            <option value="actionable">Submitted / On Hold</option>
            <option value="submitted">Submitted</option>
            <option value="pending">On Hold</option>
            <option value="confirmed">Confirmed</option>
          </select>
        <Link
          to="/agent/fares"
          className="rounded-full bg-gradient-to-r from-orange-500 to-orange-400 px-5 py-2.5 text-xs font-black uppercase tracking-wider text-navy shadow-md transition hover:from-orange-400 hover:to-orange-300"
        >
          + New Booking
        </Link>
        </div>
      </div>

      <div className="overflow-x-auto border-y border-navy/10 bg-card shadow-[0_10px_30px_-12px_rgba(11,37,69,.25)]">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-navy text-[10px] uppercase tracking-[0.12em] text-white">
               <th className="px-2 py-3 text-left font-bold w-[110px]">Date</th>
               <th className="px-2 py-3 text-center font-bold w-[90px]">Booking ID</th>
               <th className="px-2 py-3 text-left font-bold w-[250px]">Flight Details</th>
               <th className="px-2 py-3 text-left font-bold w-[120px]">Given Name</th>
               <th className="px-2 py-3 text-left font-bold w-[120px]">Sur Name</th>
               <th className="px-2 py-3 text-left font-bold w-[120px]">Passport Copies</th>
               <th className="px-2 py-3 text-center font-bold w-[100px]">Fare</th>
               <th className="px-2 py-3 text-center font-bold w-[60px]">No.of Seats</th>
               <th className="px-2 py-3 text-center font-bold w-[100px]">Total Cost</th>
               <th className="px-2 py-3 text-center font-bold w-[130px]">Payment Status</th>
               <th className="px-2 py-3 text-center font-bold w-[100px]">Ticket Status</th>
               <th className="px-2 py-3 text-center font-bold w-[120px]">Print / Download Ticket</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={11} className="p-8 text-center text-muted-foreground">Loading…</td></tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={11} className="p-10 text-center text-muted-foreground">
                  <Plane className="mx-auto mb-2 h-6 w-6 -rotate-45 text-navy/30" />
                  No bookings yet. <Link to="/agent/fares" className="font-semibold text-orange-600 underline">Browse group fares →</Link>
                </td>
              </tr>
            ) : filtered.map((b, i) => {
              const f = b.fare_snapshot ?? {};
              const passports = b.attachments.filter((a) => (a.kind ?? "passport") === "passport");
              return (
                <tr key={b.id} className={`border-t border-navy/5 align-top ${
                  (b.ticket_status || "").toLowerCase() === "confirmed" 
                    ? "bg-emerald-50/30" 
                    : (b.payment_status || "").toLowerCase() === "unpaid"
                    ? "bg-amber-50/50 shadow-[inset_4px_0_0_0_theme(colors.amber.400)]"
                    : i % 2 ? "bg-secondary/40" : "bg-card"
                }`}>
                  <td className="whitespace-nowrap px-2 py-3 align-middle">{fmt(b.created_at)}</td>
                  <td className="px-2 py-3 text-center">
                    <span className="inline-flex rounded bg-navy px-2 py-0.5 font-mono text-[9px] font-black tracking-wider text-white">
                      {b.booking_ref ?? "—"}
                    </span>
                  </td>
                  <td className="max-w-[300px] px-3 py-3">
                    {flightBlockLines(f, { fare: b.fare_on_demand }).map((line, li) => {
                      // Skip specific lines as per user request
                      if (line.startsWith("Fare:")) return null;
                      return (
                        <p
                          key={li}
                          className={
                            li === 0
                              ? "text-[12px] font-black uppercase text-navy"
                              : li === 1
                                ? "text-[10px] font-bold uppercase text-navy/60"
                                : line.startsWith("Baggage:")
                                  ? "text-[11px] font-semibold text-foreground"
                                  : "font-mono text-[10.5px] leading-tight text-navy/85"
                          }
                        >
                          {line}
                        </p>
                      );
                    })}
                  </td>

                  {(() => {
                    const lines = (b.passenger_names ?? "").split("\n").filter(Boolean);
                    const givenNames = lines.map((line, idx) => {
                      const parts = line.split("|").map(s => s.trim());
                      // Assume format Title GivenName Surname
                      const full = parts[0] || "";
                      const nameParts = full.split(" ").filter(Boolean);
                      // If title exists (Mr, Ms etc), skip first part
                      const startIndex = ["mr", "mrs", "ms", "miss", "master"].includes(nameParts[0]?.toLowerCase()) ? 1 : 0;
                      return (
                        <div key={idx} className="mb-0.5 last:mb-0">
                          {nameParts.slice(startIndex, nameParts.length - 1).join(" ") || nameParts[startIndex] || ""}
                        </div>
                      );
                    });
                    const surNames = lines.map((line, idx) => {
                      const parts = line.split("|").map(s => s.trim());
                      const full = parts[0] || "";
                      const nameParts = full.split(" ").filter(Boolean);
                      const sur = nameParts.length > 1 ? nameParts[nameParts.length - 1] : "";
                      return (
                        <div key={idx} className="mb-0.5 last:mb-0">
                          {sur || "—"}
                        </div>
                      );
                    });
                    return (
                      <>
                        <td className="px-2 py-3 text-[10px] leading-tight text-navy/80">{givenNames}</td>
                        <td className="px-2 py-3 text-[10px] leading-tight text-navy/80">{surNames}</td>
                      </>
                    );
                  })()}

                  <td className="px-3 py-3"><AttachList files={passports} /></td>
                  <td className="px-2 py-3 text-center">
                    {b.fare_on_demand
                      ? <span className="text-[10.5px] font-black text-emerald-600">{b.fare_on_demand}</span>
                      : <span className="text-[9px] text-muted-foreground">—</span>}
                  </td>
                  <td className="px-2 py-3 text-center text-sm font-black text-navy">{b.seats}</td>
                  <td className="px-2 py-3 text-center">
                    <span className="text-[11px] font-black text-orange-600">
                      {(() => {
                        const fareVal = b.fare_on_demand || (b.fare_snapshot?.fare_on_demand || b.fare_snapshot?.price_text || "");
                        const numeric = fareVal.replace(/[^\d]/g, "");
                        if (!numeric || !b.fare_on_demand) return "";
                        return `PKR ${(Number(numeric) * b.seats).toLocaleString()}`;
                      })() || "—"}
                    </span>
                  </td>

                  <td className="px-3 py-3 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <Pill value={b.payment_status} kind="payment" />
                      <label className={`flex cursor-pointer items-center justify-center gap-1 rounded bg-navy px-2 py-1 text-[9px] font-bold text-white transition-colors hover:bg-navy/80 ${uploading === `${b.id}:payment_slip` ? "opacity-50" : ""}`}>
                        <Paperclip className="h-2.5 w-2.5" />
                        <span>SLIP</span>
                        <input type="file" accept="image/*,application/pdf" multiple className="hidden"
                          onChange={(e) => uploadSlips(b, e.target.files)} disabled={!!uploading} />
                      </label>
                      {b.payment_slips.length > 0 && (
                        <div className="flex flex-wrap justify-center gap-1">
                          {b.payment_slips.map((s, k) => (
                            <a key={k} href={s.url ?? "#"} target="_blank" rel="noopener noreferrer" title={s.name}>
                              <ImageIcon className="h-3 w-3 text-gold hover:text-orange-500" />
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  </td>

                  <td className="px-3 py-3 text-center"><Pill value={b.ticket_status} kind="ticket" /></td>
                  <td className="px-2 py-3 text-center align-middle">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="flex gap-1 mr-1">
                        {b.tickets.map((t, k) => (
                          <a key={k} href={t.url ?? "#"} target="_blank" rel="noopener noreferrer" title="Download Ticket"
                            className="rounded-full bg-navy/10 p-1 text-navy hover:bg-navy hover:text-white transition-all">
                            <Download className="h-3 w-3" />
                          </a>
                        ))}
                      </div>
                      <Link
                        to="/admin/tickets"
                        search={{ id: b.id }}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-gold/10 text-gold transition-all hover:bg-gold hover:text-navy"
                        title="View Screenshot"
                      >
                        <ImageIcon className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="mt-3 px-4 text-[11px] text-muted-foreground">
        Tickets appear here automatically once payment is confirmed and our team uploads your e-ticket.
      </p>
    </div>
  );
}
