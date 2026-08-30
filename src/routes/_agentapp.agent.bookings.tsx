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
  return `${p(d.getDate())}-${d.toLocaleString("en-US", { month: "short" })}-${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

// Upload Payment Slip visibility: live admin payment_status.
// Unpaid or Pending → always show; Paid/Confirmed/Ledger/Refunded → hide.
function canUploadSlip(paymentStatus?: string | null) {
  const v = (paymentStatus || "unpaid").trim().toLowerCase();
  return v === "" || v === "unpaid" || v === "pending";
}

function Pill({ value, kind }: { value: string; kind: "payment" | "ticket" | "status" }) {
  const v = (value || "").toLowerCase();
  if (kind === "payment") {
    // Mapping from the live admin "Payment Status" (same DB value source):
    // pending/unpaid → Unpaid, received/confirmed/paid → Paid, ledger → Added In Ledger.
    const label = v === "ledger" ? "Added In Ledger"
      : v === "confirmed" || v === "paid" || v === "received" ? "Paid"
      : v === "refunded" ? "Refunded"
      : "Unpaid";
    const cls = v === "ledger"
      ? "bg-blue-100 text-blue-700 ring-blue-200"
      : label === "Paid"
      ? "bg-emerald-100 text-emerald-700 ring-emerald-200"
      : "bg-amber-100 text-amber-800 ring-amber-200";
    return <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ring-1 ${cls}`}>{label}</span>;
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
  const [statusFilter, setStatusFilter] = useState("all");

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

    // Group → Self bookings show the PNR of their linked Admin Fare record.
    const fareIds = Array.from(new Set(list.map((b: any) => b.fare_id).filter(Boolean)));
    if (fareIds.length) {
      const { data: fareRows } = await supabase
        .from("fares")
        .select("id, group_type, pnr")
        .in("id", fareIds as string[]);
      const fareById = new Map((fareRows ?? []).map((f: any) => [f.id, f]));
      list = list.map((b: any) => {
        const f = fareById.get(b.fare_id) as any;
        const isSelf = (f?.group_type ?? b.fare_snapshot?.group_type ?? "").toLowerCase() === "self";
        if (!isSelf || !String(f?.pnr ?? "").trim()) return b;
        return { ...b, fare_snapshot: { ...(b.fare_snapshot ?? {}), group_type: "self", pnr: String(f.pnr).trim().toUpperCase() } };
      });
    }


    // Removed hard filter that was hiding confirmed bookings.
    // list = list.filter(b => {
    //   const s = (b.ticket_status || "").toLowerCase();
    //   return s === "submitted" || s === "waiting" || s === "on hold" || s === "";
    // });

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
      const st = (b.status || "").toLowerCase() === "confirmed" ? "confirmed"
        : (b.status || "").toLowerCase() === "pending" ? "pending" : "submitted";
      if (st !== statusFilter) return false;
    }
    if (!q) return true;
    const f = b.fare_snapshot ?? {};
    return [b.booking_ref, b.passenger_names, b.status, b.payment_status, f.airline, f.origin_code, f.destination_code]
      .filter(Boolean).join(" ").toLowerCase().includes(q);
  });

  const totalSeats = rows.reduce((s, b) => s + (b.seats || 0), 0);
  const confirmedCount = rows.filter((b) => (b.ticket_status || "").toLowerCase() === "confirmed" || (b.status || "").toLowerCase() === "confirmed").length;
  const pendingCount = rows.length - confirmedCount;
  const totalValue = rows.reduce((sum, b) => {
    const fareVal = b.fare_on_demand || b.fare_snapshot?.fare_on_demand || b.fare_snapshot?.price_text || "";
    const numeric = String(fareVal).replace(/[^\d]/g, "");
    return sum + (numeric ? Number(numeric) * (b.seats || 0) : 0);
  }, 0);

  const stats = [
    { label: "Total Bookings", value: String(rows.length), hint: `${totalSeats} seats` },
    { label: "Pending", value: String(pendingCount), hint: "awaiting action" },
    { label: "Confirmed", value: String(confirmedCount), hint: "tickets issued / ok" },
    { label: "Total Value", value: totalValue ? totalValue.toLocaleString() : "ON CALL", hint: "sum of group cost" },
  ];

  return (
    <div className="min-h-full bg-background px-0 py-4 md:py-6 pb-24">
      <div className="mb-5">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 bg-navy px-4 py-3.5 text-white shadow-sm sm:flex sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <Ticket className="h-5 w-5 shrink-0 text-gold" />
            <div className="min-w-0">
              <p className="truncate text-base font-black leading-none tracking-tight">All Group Bookings</p>
              <p className="mt-1 text-[10px] uppercase tracking-[0.2em] text-white/60">B2B Agent Portal</p>
            </div>
          </div>
          <span className="shrink-0 rounded-full bg-gold/20 px-2.5 py-1 text-[10px] font-bold text-gold">{rows.length}</span>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 px-4 lg:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="rounded-xl border border-navy/10 bg-card p-4 shadow-[0_8px_24px_-16px_rgba(11,37,69,.4)]">
              <p className="text-[9.5px] font-bold uppercase tracking-[0.16em] text-navy/50">{s.label}</p>
              <p className="mt-1.5 text-2xl font-black leading-none tracking-tight text-navy">{s.value}</p>
              <p className="mt-1.5 text-[10px] font-medium text-muted-foreground">{s.hint}</p>
            </div>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 px-4">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search booking ID, sector, passenger…"
            className="min-w-0 flex-1 rounded-lg border border-navy/20 bg-card px-3 py-2.5 text-xs outline-none focus:border-gold sm:max-w-xs sm:flex-none"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-navy/20 bg-card px-2 py-2.5 text-xs font-semibold text-navy outline-none focus:border-gold"
          >
            <option value="all">All ticket status</option>
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

      <div className="hidden overflow-x-auto border-y border-navy/10 bg-card shadow-[0_10px_30px_-12px_rgba(11,37,69,.25)] md:block md:rounded-xl md:border md:mx-4">

        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-navy text-[10px] uppercase tracking-[0.12em] text-white">
               <th className="px-2 py-3 text-left font-bold w-[110px]">Date</th>
               <th className="px-2 py-3 text-center font-bold w-[90px]">Booking ID</th>
               <th className="px-2 py-3 text-left font-bold w-[250px]">Flight Details</th>
               <th className="px-2 py-3 text-left font-bold w-[120px]">Given Name</th>
               <th className="px-2 py-3 text-left font-bold w-[120px]">Sur Name</th>
               <th className="px-2 py-3 text-left font-bold w-[120px]">Passport Copies</th>
               <th className="px-2 py-3 text-center font-bold w-[120px]">FARE</th>
               <th className="px-2 py-3 text-center font-bold w-[140px]">Fare on Demand</th>
               <th className="px-2 py-3 text-center font-bold w-[60px]">No.of Seats</th>
               <th className="px-2 py-3 text-center font-bold w-[100px]">Total Cost</th>
               <th className="px-2 py-3 text-center font-bold w-[130px]">Payment Status</th>
               <th className="px-2 py-3 text-center font-bold w-[100px]">Ticket Status</th>
               <th className="px-2 py-3 text-center font-bold w-[120px]">Print / Download Ticket</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={12} className="p-8 text-center text-muted-foreground">Loading…</td></tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={12} className="p-10 text-center text-muted-foreground">
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
                  <td className="whitespace-nowrap px-2 py-3 text-[10px] font-semibold text-navy/70">{fmt(b.created_at)}</td>
                  <td className="px-2 py-3 text-center">
                    <span className="inline-flex rounded bg-navy px-2 py-0.5 font-mono text-[9px] font-black tracking-wider text-white">
                      {b.booking_ref ?? "—"}
                    </span>
                    {String((f as any).group_type ?? "").toLowerCase() === "self" && String((f as any).pnr ?? "").trim() ? (
                      <div className="mt-1 font-mono text-[9px] font-black tracking-wider text-orange-700">
                        PNR {String((f as any).pnr).trim().toUpperCase()}
                      </div>
                    ) : null}
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
                          <span className="font-bold text-navy/90">{idx + 1}.</span> {nameParts.slice(startIndex, nameParts.length - 1).join(" ") || nameParts[startIndex] || ""}
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
                     {(() => {
                       const fareValue = b.fare_snapshot?.price_text || "";
                       return fareValue
                         ? <span className="text-[10.5px] font-black text-blue-600">{fareValue}</span>
                         : <span className="text-[9px] text-muted-foreground">—</span>;
                     })()}
                   </td>
                   <td className="px-2 py-3 text-center">
                     {b.fare_on_demand
                       ? <span className="text-[10.5px] font-black text-orange-600">{b.fare_on_demand}</span>
                       : <span className="text-[9px] text-muted-foreground">—</span>}
                   </td>
                  <td className="px-2 py-3 text-center text-sm font-black text-navy">{b.seats}</td>
                  <td className="px-2 py-3 text-center">
                    <span className="text-[11px] font-black text-orange-600">
                      {(() => {
                        const fareVal = b.fare_on_demand || (b.fare_snapshot?.fare_on_demand || b.fare_snapshot?.price_text || "");
                        const numeric = fareVal.replace(/[^\d]/g, "");
                        if (!numeric) return "ON CALL";
                        return (Number(numeric) * b.seats).toLocaleString();
                      })()}
                    </span>
                  </td>

                  <td className="px-3 py-3 text-center">
                    <Pill value={b.payment_status} kind="payment" />
                    {canUploadSlip(b.payment_status) && (
                      <label className={`mt-2 flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-navy px-3 py-2.5 text-center text-[10px] font-black uppercase tracking-[0.12em] text-white shadow-md transition-all hover:bg-navy/90 hover:shadow-lg active:scale-[0.98] ${uploading === `${b.id}:payment_slip` ? "opacity-50" : ""}`}>
                        <Paperclip className="h-3.5 w-3.5 shrink-0 text-gold" />
                        <div className="flex flex-col leading-none">
                          <span>{uploading === `${b.id}:payment_slip` ? "Uploading…" : "Upload"}</span>
                          <span className="mt-0.5 text-[8.5px] text-white/60">Payment Slip</span>
                        </div>
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
                    {(b.payment_status || "").toLowerCase() === "unpaid" ? (
                      <span className="text-[10.5px] font-semibold text-amber-700">Awaiting Payment Slip</span>
                    ) : b.status !== "confirmed" ? (
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

      {/* Mobile / tablet card list — same data, same actions */}
      <div className="space-y-3 px-4 md:hidden">
        {loading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-navy/10 bg-card p-8 text-center text-sm text-muted-foreground">
            <Plane className="mx-auto mb-2 h-6 w-6 -rotate-45 text-navy/30" />
            No bookings yet. <Link to="/agent/fares" className="font-semibold text-orange-600 underline">Browse group fares →</Link>
          </div>
        ) : filtered.map((b) => {
          const f = b.fare_snapshot ?? {};
          const passports = b.attachments.filter((a) => (a.kind ?? "passport") === "passport");
          const paid = ["paid", "confirmed", "ledger"].includes((b.payment_status || "").toLowerCase());
          const fareVal = b.fare_on_demand || f.fare_on_demand || f.price_text || "";
          const numeric = String(fareVal).replace(/[^\d]/g, "");
          return (
            <div key={b.id} className={`rounded-xl border bg-card p-4 shadow-[0_10px_30px_-20px_rgba(11,37,69,.5)] ${
              (b.ticket_status || "").toLowerCase() === "confirmed" ? "border-emerald-200" : !paid ? "border-amber-300" : "border-navy/10"
            }`}>
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                <div className="min-w-0">
                  <span className="inline-flex rounded bg-navy px-2 py-0.5 font-mono text-[9px] font-black tracking-wider text-white">
                    {b.booking_ref ?? "—"}
                  </span>
                  <p className="mt-1 text-[10px] font-semibold text-navy/60">{fmt(b.created_at)}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <Pill value={b.status} kind="ticket" />
                  <Pill value={b.payment_status} kind="payment" />
                </div>
              </div>

              <div className="mt-3 border-t border-navy/10 pt-3">
                {flightBlockLines(f, { fare: b.fare_on_demand }).map((line, li) =>
                  line.startsWith("Fare:") ? null : (
                    <p key={li} className={li === 0 ? "text-[12px] font-black uppercase text-navy" : li === 1 ? "text-[10px] font-bold uppercase text-navy/60" : "font-mono text-[10.5px] leading-tight text-navy/85"}>
                      {line}
                    </p>
                  ),
                )}
              </div>

              <dl className="mt-3 grid grid-cols-3 gap-2 border-t border-navy/10 pt-3 text-center">
                <div>
                  <dt className="text-[9px] font-bold uppercase tracking-wider text-navy/50">Seats</dt>
                  <dd className="text-sm font-black text-navy">{b.seats}</dd>
                </div>
                <div>
                  <dt className="text-[9px] font-bold uppercase tracking-wider text-navy/50">Fare</dt>
                  <dd className="text-[11px] font-black text-blue-600">{f.price_text || "—"}</dd>
                </div>
                <div>
                  <dt className="text-[9px] font-bold uppercase tracking-wider text-navy/50">Total</dt>
                  <dd className="text-[11px] font-black text-orange-600">
                    {numeric ? (Number(numeric) * b.seats).toLocaleString() : "ON CALL"}
                  </dd>
                </div>
              </dl>

              <div className="mt-3 border-t border-navy/10 pt-3">
                <p className="text-[9px] font-bold uppercase tracking-wider text-navy/50">Passenger Names</p>
                <div className="mt-1 text-[11px] leading-tight text-navy/85">
                  {(b.passenger_names ?? "").split("\n").filter(Boolean).map((line, idx) => (
                    <div key={idx}><span className="font-bold text-navy/90">{idx + 1}.</span> {line.split("|")[0]?.trim()}</div>
                  ))}
                </div>
              </div>

              <div className="mt-3 grid gap-2 border-t border-navy/10 pt-3">
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-wider text-navy/50">Passport Copies</p>
                  <div className="mt-1"><AttachList files={passports} /></div>
                </div>

                {canUploadSlip(b.payment_status) && (
                  <label className={`flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-navy px-3 py-2.5 text-[10px] font-black uppercase tracking-[0.12em] text-white shadow-md active:scale-[0.98] ${uploading === `${b.id}:payment_slip` ? "opacity-50" : ""}`}>
                    <Paperclip className="h-3.5 w-3.5 shrink-0 text-gold" />
                    <span>{uploading === `${b.id}:payment_slip` ? "Uploading…" : "Upload Payment Slip"}</span>
                    <input type="file" accept="image/*,application/pdf" multiple className="hidden"
                      onChange={(e) => uploadSlips(b, e.target.files)} />
                  </label>
                )}

                {b.payment_slips.length > 0 && (
                  <div className="flex flex-col gap-0.5">
                    {b.payment_slips.map((s, k) => (
                      <a key={k} href={s.url ?? "#"} target="_blank" rel="noopener noreferrer" title={s.name}
                        className="truncate text-[10px] font-semibold text-navy underline">🧾 {s.name}</a>
                    ))}
                  </div>
                )}

                {(b.payment_status || "").toLowerCase() === "unpaid" ? (
                  <p className="text-center text-[10.5px] font-semibold text-amber-700">Awaiting Payment Slip</p>
                ) : b.status !== "confirmed" ? (
                  <p className="text-center text-[10.5px] font-semibold text-amber-700">Waiting Uploads</p>
                ) : b.tickets.length ? (
                  <div className="flex flex-col gap-1">
                    {b.tickets.map((t, k) => (
                      <a key={k} href={t.url ?? "#"} target="_blank" rel="noopener noreferrer" title={t.name}
                        className="inline-flex items-center justify-center gap-1.5 rounded-md bg-emerald-600 px-3 py-2 text-[10.5px] font-black uppercase tracking-wider text-white shadow-sm">
                        <Download className="h-3 w-3" /> Print / Download Ticket {b.tickets.length > 1 ? k + 1 : ""}
                      </a>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-[10.5px] font-semibold text-muted-foreground">Awaiting issue</p>
                )}
              </div>
            </div>
          );
        })}
      </div>



      <p className="mt-3 px-4 text-[11px] text-muted-foreground">
        Tickets appear here automatically once payment is confirmed and our team uploads your e-ticket.
      </p>
    </div>
  );
}
