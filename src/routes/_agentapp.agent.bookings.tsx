import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { flightBlockLines } from "@/lib/booking-flight-format";
import { Check, CheckCircle2, ChevronDown, Download, Paperclip, Plane, Search, Upload, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_agentapp/agent/bookings")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "All Group Bookings | Rohi Travels" },
      { name: "description", content: "Track group booking payments, documents, and ticket status in the Rohi Travels agent portal." },
      { property: "og:title", content: "All Group Bookings | Rohi Travels" },
      { property: "og:description", content: "Track group booking payments, documents, and ticket status in the Rohi Travels agent portal." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
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

function Pill({ value, kind }: { value: string; kind: "payment" | "ticket" }) {
  const v = (value || "").toLowerCase();
  if (kind === "payment") {
    // Mapping from the live admin "Payment Status" (same DB value source):
    // pending/unpaid → Unpaid, received/confirmed/paid → Paid, ledger → Added In Ledger.
    const label = v === "ledger" ? "Added In Ledger"
      : v === "confirmed" || v === "paid" || v === "received" ? "Paid"
      : v === "refunded" ? "Refunded"
      : "Unpaid";
    const cls = v === "ledger"
      ? "bg-muted text-booking-subtle ring-border"
      : label === "Paid"
      ? "bg-booking-green-soft text-booking-green ring-booking-green/20"
      : "bg-booking-amber-soft text-booking-amber ring-booking-amber/20";
    return <span className={`inline-flex h-8 w-36 items-center justify-center gap-1 rounded-full px-3 text-[10px] font-extrabold uppercase ring-1 ${cls}`}>{label}<ChevronDown className="h-3 w-3" /></span>;
  }


  if (kind === "ticket") {
    // Mirrors the admin "Ticket Status" column exactly: Confirmed only when admin confirms.
    const confirmed = v === "confirmed";
    const submitted = v === "submitted" || v === "waiting" || v === "";
    const cls = confirmed
      ? "bg-booking-green-soft text-booking-green ring-booking-green/20"
      : submitted
      ? "bg-booking-blue-soft text-booking-blue ring-booking-blue/20"
      : "bg-booking-amber-soft text-booking-amber ring-booking-amber/20";
    const label = confirmed ? "Confirmed" : submitted ? "Submitted" : "On Hold";
    return <span className={`inline-flex h-8 w-36 items-center justify-center gap-1 rounded-full px-3 text-[10px] font-extrabold uppercase ring-1 ${cls}`}>{label}<ChevronDown className="h-3 w-3" /></span>;
  }
}


function BookingsPage() {
  const [rows, setRows] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [cleanupActive, setCleanupActive] = useState(false);

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
    if (cleanupActive && b.attachments.length > 0 && b.payment_slips.length > 0) return false;
    if (statusFilter !== "all") {
      const ticket = (b.ticket_status || b.status || "").toLowerCase();
      // Mirrors the Pill labels: Confirmed / Submitted / On Hold (anything else).
      const st = ticket === "confirmed"
        ? "confirmed"
        : ticket === "submitted" || ticket === "waiting" || ticket === ""
        ? "submitted"
        : "pending";
      if (st !== statusFilter) return false;
    }
    if (!q) return true;
    const f = b.fare_snapshot ?? {};
    return [b.booking_ref, b.passenger_names, b.status, b.payment_status, f.airline, f.origin_code, f.destination_code]
      .filter(Boolean).join(" ").toLowerCase().includes(q);
  });

  const confirmedCount = rows.filter((b) => (b.ticket_status || "").toLowerCase() === "confirmed" || (b.status || "").toLowerCase() === "confirmed").length;
  const paymentPendingCount = rows.filter((b) => canUploadSlip(b.payment_status)).length;
  const documentsMissingCount = rows.filter((b) => b.attachments.length === 0 || b.payment_slips.length === 0).length;

  const stats = [
    { label: "Total bookings", value: String(rows.length), icon: Plane, tone: "bg-booking-blue-soft text-booking-blue" },
    { label: "Payments pending", value: String(paymentPendingCount), icon: Zap, tone: "bg-booking-amber-soft text-booking-amber" },
    { label: "Tickets confirmed", value: String(confirmedCount), icon: CheckCircle2, tone: "bg-booking-green-soft text-booking-green" },
    { label: "Documents missing", value: String(documentsMissingCount), icon: Paperclip, tone: "bg-booking-rose-soft text-booking-rose" },
  ];

  return (
    <div className="min-h-full bg-booking-canvas px-3 py-5 font-booking text-booking-ink sm:px-5 lg:px-6">
      <div className="grid grid-cols-2 gap-3 min-[920px]:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="flex min-h-24 items-center gap-3 rounded-[14px] border border-border/70 bg-card p-4 shadow-booking">
              <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-[10px] ${stat.tone}`}><Icon className="h-5 w-5" /></div>
              <div className="min-w-0">
                <p className="text-[21px] font-extrabold leading-none">{stat.value}</p>
                <p className="mt-1.5 text-xs font-medium text-booking-subtle">{stat.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      <header className="mt-7 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 min-[920px]:flex min-[920px]:justify-between">
        <div className="flex min-w-0 items-baseline gap-2">
          <h1 className="truncate text-2xl font-extrabold">Bookings</h1>
          <span className="shrink-0 text-sm font-medium text-booking-subtle">{rows.length} total</span>
        </div>
        <div className="col-span-2 flex min-w-0 flex-wrap items-center gap-2 min-[920px]:col-span-1 min-[920px]:justify-end">
          <label className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-lg border border-border bg-card px-3 focus-within:ring-2 focus-within:ring-booking-blue/20 min-[920px]:w-72 min-[920px]:flex-none">
            <Search className="h-4 w-4 shrink-0 text-booking-subtle" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search booking ref or sector…" className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-booking-subtle" />
          </label>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="h-10 rounded-lg border border-border bg-card px-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-booking-blue/20">
            <option value="all">All</option>
            <option value="submitted">Submitted</option>
            <option value="pending">On Hold</option>
            <option value="confirmed">Confirmed</option>
          </select>
          <Button type="button" variant="outline" aria-pressed={cleanupActive} onClick={() => setCleanupActive((active) => !active)} className={`h-10 rounded-lg px-3 text-xs font-bold ${cleanupActive ? "border-booking-amber bg-booking-amber-soft text-booking-amber hover:bg-booking-amber-soft" : "bg-card text-booking-subtle"}`}>
            <Paperclip className="h-4 w-4" /> Clean up documents
          </Button>
        </div>
      </header>

      <div className="mt-4 space-y-3">
        {loading ? (
          <div className="rounded-[14px] border border-border bg-card p-10 text-center text-sm text-booking-subtle">Loading bookings…</div>
        ) : filtered.length === 0 ? (
          <div className="rounded-[14px] border border-border bg-card p-10 text-center text-sm text-booking-subtle shadow-booking">
            <Plane className="mx-auto mb-2 h-6 w-6 -rotate-45" />
            No matching bookings. <Link to="/agent/fares" className="font-bold text-booking-blue underline">Browse group fares</Link>
          </div>
        ) : filtered.map((b) => {
          const f = b.fare_snapshot ?? {};
          const flightLines = flightBlockLines(f, { fare: b.fare_on_demand }).filter((line) => !line.startsWith("Fare:"));
          const passengerRows = (b.passenger_names ?? "").split("\n").filter(Boolean).map((line) => {
            const full = (line.split("|")[0] ?? "").trim();
            const parts = full.split(/\s+/).filter(Boolean);
            const start = ["mr", "mrs", "ms", "miss", "master"].includes(parts[0]?.toLowerCase()) ? 1 : 0;
            return { given: (parts.slice(start, -1).join(" ") || parts[start] || "—").toUpperCase(), surname: (parts.length > start + 1 ? parts.at(-1) : "—")?.toUpperCase() };
          });
          const fareValue = String(b.fare_on_demand || f.fare_on_demand || f.price_text || "");
          const masked = /FARE\s*ON\s*WHATSAPP/i.test(fareValue);
          const numericFare = masked ? "" : fareValue.replace(/[^\d]/g, "");
          const total = numericFare ? `PKR ${(Number(numericFare) * b.seats).toLocaleString()}` : masked ? "FARE ON WHATSAPP" : "ON CALL";
          const paymentDone = b.payment_slips.length > 0;
          const docsMissing = b.attachments.length === 0 || !paymentDone;
          const attention = canUploadSlip(b.payment_status) || (b.ticket_status || "").toLowerCase() !== "confirmed" || docsMissing;
          return (
            <article key={b.id} className={`grid gap-5 rounded-[14px] border bg-card p-4 shadow-booking min-[920px]:grid-cols-[64px_minmax(300px,1fr)_170px_160px_190px] min-[920px]:items-start ${attention ? "border-l-4 border-l-booking-amber bg-booking-amber-soft/25" : "border-border"}`}>
              <div className="grid h-14 w-14 place-items-center rounded-[10px] bg-booking-blue-soft text-center text-booking-blue">
                <div><strong className="block text-lg font-extrabold leading-none">{b.seats}</strong><span className="text-[9px] font-extrabold uppercase">PAX</span></div>
              </div>

              <section className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs font-bold text-booking-blue">{b.booking_ref ?? "—"}</span>
                  {b.seats > 1 && <span className="rounded bg-booking-blue-soft px-1.5 py-0.5 text-[9px] font-extrabold text-booking-blue">GROUP</span>}
                  <span className="text-[10px] text-booking-subtle">{fmt(b.created_at)}</span>
                </div>
                <h2 className="mt-2 text-base font-extrabold uppercase">{String(f.origin || f.origin_code || "—")} to {String(f.destination || f.destination_code || "—")}</h2>
                <p className="text-xs font-semibold text-booking-subtle">{[f.origin_code, f.destination_code].filter(Boolean).join(" → ")}</p>
                <div className="mt-2 space-y-0.5 text-xs">
                  {flightLines.slice(2).map((line, index) => <p key={`${line}-${index}`} className={line.startsWith("Baggage:") ? "font-semibold" : "font-mono text-booking-subtle"}>{line}</p>)}
                  <p className="font-semibold text-booking-subtle">{b.seats} passenger{b.seats === 1 ? "" : "s"}</p>
                </div>
                <div className="mt-3 overflow-hidden rounded-lg border border-border bg-card">
                  <div className="grid grid-cols-[36px_minmax(0,1fr)_minmax(0,1fr)] bg-muted/60 px-2 py-1.5 text-[9px] font-extrabold uppercase text-booking-subtle"><span>No.</span><span>Given Name</span><span>Surname</span></div>
                  {passengerRows.map((passenger, index) => <div key={index} className="grid grid-cols-[36px_minmax(0,1fr)_minmax(0,1fr)] border-t border-border px-2 py-1.5 text-[10px] font-bold"><span className="text-booking-subtle">{index + 1}</span><span className="truncate pr-2">{passenger.given}</span><span className="truncate">{passenger.surname}</span></div>)}
                </div>
              </section>

              <section className="min-w-0 min-[920px]:text-right">
                <p className="text-[10px] font-extrabold uppercase text-booking-subtle">Total cost</p>
                <p className="mt-1 break-words text-base font-extrabold">{total}</p>
                <p className="mt-1 text-[10px] font-semibold text-booking-subtle">{b.seats} seats × {masked ? "fare on request" : numericFare ? `PKR ${Number(numericFare).toLocaleString()}` : "on call"}/seat</p>
              </section>

              <section className="flex flex-wrap gap-2 min-[920px]:flex-col">
                <div><p className="mb-1 text-[9px] font-extrabold uppercase text-booking-subtle">Payment status</p><Pill value={b.payment_status} kind="payment" /></div>
                <div><p className="mb-1 text-[9px] font-extrabold uppercase text-booking-subtle">Ticket status</p><Pill value={b.ticket_status || b.status} kind="ticket" /></div>
                <span className={`inline-flex h-8 w-36 items-center justify-center rounded-full px-3 text-[10px] font-extrabold uppercase ring-1 ${paymentDone ? "bg-booking-green-soft text-booking-green ring-booking-green/20" : "bg-booking-amber-soft text-booking-amber ring-booking-amber/20"}`}>{paymentDone ? "Payment Done" : "Payment Pending"}</span>
              </section>

              <section className="flex flex-wrap gap-2 border-t border-dashed border-border pt-4 min-[920px]:flex-col min-[920px]:border-l min-[920px]:border-t-0 min-[920px]:pl-5 min-[920px]:pt-0">
                <p className="w-full text-[9px] font-extrabold uppercase text-booking-subtle">Order actions</p>
                {paymentDone ? (
                  <a href={b.payment_slips[0]?.url ?? "#"} target="_blank" rel="noopener noreferrer" className="inline-flex h-10 w-44 items-center justify-center gap-2 rounded-lg bg-booking-green-soft px-3 text-[10px] font-extrabold text-booking-green ring-1 ring-booking-green/20"><Check className="h-4 w-4" /> Payment slip attached</a>
                ) : canUploadSlip(b.payment_status) ? (
                  <label className={`inline-flex h-10 w-44 cursor-pointer items-center justify-center gap-2 rounded-lg bg-booking-blue px-3 text-[10px] font-extrabold text-primary-foreground shadow-sm motion-safe:animate-pulse ${uploading === `${b.id}:payment_slip` ? "pointer-events-none opacity-50" : ""}`}><Upload className="h-4 w-4" />{uploading === `${b.id}:payment_slip` ? "Uploading…" : "Upload Payment Slip"}<input type="file" accept="image/*,application/pdf" multiple className="hidden" onChange={(e) => uploadSlips(b, e.target.files)} /></label>
                ) : <span className="inline-flex h-10 w-44 items-center justify-center rounded-lg bg-muted px-3 text-[10px] font-bold text-booking-subtle">Payment update locked</span>}
                {b.tickets.length ? b.tickets.map((ticket, index) => (
                  <a key={ticket.path || index} href={ticket.url ?? "#"} target="_blank" rel="noopener noreferrer" className="inline-flex h-10 w-44 items-center justify-center gap-2 rounded-lg bg-booking-ink px-3 text-[10px] font-extrabold text-primary-foreground"><Download className="h-4 w-4" /> Download Ticket{b.tickets.length > 1 ? ` ${index + 1}` : ""}</a>
                )) : (
                  <span className={`inline-flex h-10 w-44 items-center justify-center gap-2 rounded-lg border px-3 text-[10px] font-extrabold ${docsMissing ? "border-booking-amber bg-booking-amber-soft text-booking-amber" : "border-booking-ink bg-booking-ink text-primary-foreground"}`}><Upload className="h-4 w-4" /> Waiting Ticket</span>
                )}
              </section>
            </article>
          );
        })}
      </div>
    </div>
  );
}
