import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { AirlineLogo, formatFare } from "@/routes/index";
import { buildFareShareText } from "@/lib/fare-format";
import { getSectorSoldCounts } from "@/lib/agent-fares.functions";
import { notifyBookingCreated } from "@/lib/agent-bookings.functions";

export const Route = createFileRoute("/_agentapp/agent/fares")({
  ssr: false,
  component: FaresPage,
});

type Fare = {
  id: string;
  origin: string; origin_code: string;
  destination: string; destination_code: string;
  airline: string; flight_date: string;
  flight_number: string | null;
  depart_time: string | null; arrive_time: string | null;
  baggage: string | null; category: string;
  price_text: string; is_featured: boolean; sort_order: number;
  flight_details: string | null;
  meal: string | null; seats: string | null;
};

function parseSeatsTotal(seats: string | null | undefined): number {
  if (!seats) return 0;
  const m = String(seats).match(/(\d+)\s*(?:out of|of|\/)\s*(\d+)/i);
  if (m) return parseInt(m[2], 10) || 0;
  const n = parseInt(String(seats).replace(/[^0-9]/g, ""), 10);
  return Number.isFinite(n) ? n : 0;
}

function FaresPage() {
  const [fares, setFares] = useState<Fare[]>([]);
  const [sold, setSold] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [origin, setOrigin] = useState("ALL");
  const [destination, setDestination] = useState("ALL");
  const [booking, setBooking] = useState<Fare | null>(null);
  const fetchSold = useServerFn(getSectorSoldCounts);

  useEffect(() => {
    supabase.from("fares")
      .select("*")
      .order("is_featured", { ascending: false })
      .order("sort_order")
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setFares((data ?? []) as Fare[]);
        setLoading(false);
      });
    fetchSold().then((counts) => setSold(counts ?? {})).catch(() => {});
    const iv = setInterval(() => {
      fetchSold().then((counts) => setSold(counts ?? {})).catch(() => {});
    }, 30000);
    return () => clearInterval(iv);
  }, [fetchSold]);

  const origins = useMemo(
    () => Array.from(new Set(fares.map((f) => f.origin_code.toUpperCase()))).sort(),
    [fares],
  );
  const destinations = useMemo(() => {
    const src = origin === "ALL" ? fares : fares.filter((f) => f.origin_code.toUpperCase() === origin);
    return Array.from(new Set(src.map((f) => f.destination_code.toUpperCase()))).sort();
  }, [fares, origin]);

  const filtered = useMemo(() => fares.filter((f) => {
    if (origin !== "ALL" && f.origin_code.toUpperCase() !== origin) return false;
    if (destination !== "ALL" && f.destination_code.toUpperCase() !== destination) return false;
    if (!filter) return true;
    const q = filter.toLowerCase();
    return [f.origin, f.destination, f.airline, f.origin_code, f.destination_code, f.flight_number]
      .some((v) => v?.toLowerCase().includes(q));
  }), [fares, filter, origin, destination]);

  const grouped = useMemo(() => {
    const map = new Map<string, Fare[]>();
    for (const f of filtered) {
      const key = `${f.origin_code.toUpperCase()}-${f.destination_code.toUpperCase()}`;
      const arr = map.get(key) ?? [];
      arr.push(f);
      map.set(key, arr);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  function seatsFor(f: Fare): { available: number | null; total: number; label: string } {
    const total = parseSeatsTotal(f.seats);
    if (!total) return { available: null, total: 0, label: f.seats ?? "—" };
    const key = `${f.origin_code.toUpperCase()}-${f.destination_code.toUpperCase()}`;
    const soldCount = sold[key] ?? 0;
    const available = Math.max(total - soldCount, 0);
    return { available, total, label: `${available} out of ${total}` };
  }

  return (
    <div className="p-3 md:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-gray-800">Group Fares</h1>
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter by airline, city, flight #…"
          className="w-64 rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        <FilterPill active={origin === "ALL"} onClick={() => { setOrigin("ALL"); setDestination("ALL"); }}>
          ALL ORIGINS
        </FilterPill>
        {origins.map((o) => (
          <FilterPill key={o} active={origin === o} onClick={() => { setOrigin(o); setDestination("ALL"); }}>
            {o}
          </FilterPill>
        ))}
      </div>

      <div className="mb-5 flex flex-wrap gap-2">
        <FilterPill active={destination === "ALL"} onClick={() => setDestination("ALL")} variant="dest">
          ALL DESTINATIONS
        </FilterPill>
        {destinations.map((d) => (
          <FilterPill key={d} active={destination === d} onClick={() => setDestination(d)} variant="dest">
            {d}
          </FilterPill>
        ))}
      </div>

      {loading ? (
        <p className="text-gray-500">Loading fares…</p>
      ) : grouped.length === 0 ? (
        <p className="text-gray-500">No fares match your filter.</p>
      ) : (
        <div className="space-y-8">
          {grouped.map(([sector, rows]) => (
            <section key={sector} className="rounded-xl bg-gradient-to-b from-amber-50/60 to-white p-3 shadow-sm ring-1 ring-amber-100">
              <div className="mb-3 flex items-center justify-center gap-3">
                <span className="h-px w-16 bg-gradient-to-r from-transparent to-gold/70" />
                <h2 className="font-serif text-2xl md:text-3xl font-bold tracking-[0.28em] text-navy">{sector}</h2>
                <span className="text-2xl text-gold">✈</span>
                <span className="h-px w-16 bg-gradient-to-l from-transparent to-gold/70" />
              </div>

              <div className="rounded-lg border border-gray-200 bg-white shadow-[0_2px_10px_rgba(15,23,42,0.05)]">
                <table className="w-full table-fixed border-collapse text-xs">
                  <colgroup>
                    <col className="w-[76px]" />{/* AIRLINE */}
                    <col className="w-[82px]" />{/* FROM */}
                    <col className="w-[82px]" />{/* TO */}
                    <col className="w-[200px]" />{/* FLIGHT DETAILS */}
                    <col className="w-[72px]" />{/* LUGGAGE */}
                    <col className="w-[100px]" />{/* FARE */}
                    <col className="w-[72px]" />{/* MEAL */}
                    <col className="w-[88px]" />{/* SEATS */}
                    <col className="w-[118px]" />{/* SECTOR */}
                    <col className="w-[78px]" />{/* COPY */}
                    <col className="w-[88px]" />{/* BOOK */}
                  </colgroup>
                  <thead className="bg-[#0b1220] text-white">
                    <tr>
                      {[
                        "AIRLINE","FROM","TO","FLIGHT DETAILS","LUGGAGE","FARE","MEAL","SEATS","SECTOR","COPY","",
                      ].map((h, i) => (
                        <th
                          key={i}
                          className="whitespace-nowrap border-r border-white/10 px-2 py-2.5 text-center text-[10.5px] font-bold uppercase tracking-[0.14em] last:border-r-0"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((f, idx) => {
                      const details = f.flight_details
                        ?? `${f.flight_date} ${f.origin_code} ${f.destination_code}${f.depart_time ? ` ${f.depart_time}` : ""}${f.arrive_time ? ` ${f.arrive_time}` : ""}${f.flight_number ? ` ${f.flight_number}` : ""}`;
                      const mealVal = (f.meal ?? "").trim().toUpperCase();
                      const mealColor = "text-gray-900";
                      void mealVal;
                      const s = seatsFor(f);
                      const priceIsNumeric = /\d/.test(f.price_text || "");
                      return (
                        <tr
                          key={f.id}
                          className={`border-t border-gray-100 align-middle transition-colors hover:bg-amber-50/50 ${idx % 2 === 1 ? "bg-gray-50/60" : ""}`}
                        >
                          <td className="px-2 py-2 text-center">
                            <div className="mx-auto flex h-14 w-14 items-center justify-center overflow-hidden rounded-lg border border-border bg-card shadow-sm">
                              <AirlineLogo name={f.airline} height={44} />
                            </div>
                          </td>
                          <td className="px-2 py-2 text-center">
                            <div className="text-[12px] font-bold text-gray-800 leading-tight">{f.origin.toUpperCase()}</div>
                            <div className="text-[10px] text-gray-500">{f.origin_code}</div>
                          </td>
                          <td className="px-2 py-2 text-center">
                            <div className="text-[12px] font-bold text-gray-800 leading-tight">{f.destination.toUpperCase()}</div>
                            <div className="text-[10px] text-gray-500">{f.destination_code}</div>
                          </td>
                          <td className="px-2 py-2 font-mono text-[11px] leading-snug text-gray-700 whitespace-pre-line break-words">{details}</td>
                          <td className="px-2 py-2 text-center text-[11px] font-medium text-gray-700 whitespace-nowrap">{f.baggage ?? "—"}</td>
                          <td className="px-2 py-2 text-center whitespace-nowrap">
                            {priceIsNumeric ? (
                              <span className="text-[15px] font-black text-orange-600 tabular-nums">{formatFare(f.price_text)}</span>
                            ) : (
                              <span className="text-[11px] font-black uppercase leading-tight tracking-wide text-red-600">{f.price_text}</span>
                            )}
                          </td>
                          <td className={`px-2 py-2 text-center text-[11px] font-bold ${mealColor}`}>{f.meal ?? "—"}</td>
                          <td className="px-2 py-2 text-center text-[11px] font-bold whitespace-nowrap">
                            {s.available === null ? (
                              <span className="text-gray-500">{s.label}</span>
                            ) : (
                              <span className={s.available === 0 ? "text-destructive" : "text-gray-800"}>
                                {s.available} out of {s.total}
                              </span>
                            )}
                          </td>
                          <td dir="rtl" className="font-urdu px-2 py-2 text-center text-[22px] leading-tight text-gray-900 whitespace-nowrap">{urduRoute(f.origin, f.destination)}</td>
                          <td className="px-2 py-2 text-center">
                            <button
                              onClick={() => navigator.clipboard.writeText(buildFareShareText(f))}
                              style={{ backgroundColor: "#25D366", borderColor: "#128C7E", color: "#ffffff" }}
                              className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10.5px] font-semibold shadow-sm transition hover:brightness-95"
                            >
                              📋 Copy
                            </button>
                          </td>
                          <td className="px-2 py-2 text-center">
                            <button
                              onClick={() => setBooking(f)}
                              disabled={s.available === 0}
                              className="rounded-md bg-gradient-to-b from-sky-500 to-sky-600 px-3 py-1.5 text-[11px] font-bold text-white shadow-sm transition hover:from-sky-600 hover:to-sky-700 hover:shadow-md whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              Book Now
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>
      )}

      {booking && <BookingModal fare={booking} onClose={() => setBooking(null)} sold={sold} />}
    </div>
  );
}


function FilterPill({ active, onClick, children, variant = "origin" }: { active: boolean; onClick: () => void; children: React.ReactNode; variant?: "origin" | "dest" }) {
  const activeCls = variant === "origin"
    ? "bg-navy text-navy-foreground border-navy"
    : "bg-gold text-gold-foreground border-gold";
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-4 py-1.5 text-xs font-bold uppercase tracking-wide transition ${
        active ? activeCls : "border-gray-300 bg-white text-gray-700 hover:border-gray-400"
      }`}
    >
      {children}
    </button>
  );
}


const URDU_CITIES: Record<string, string> = {
  KARACHI: "کراچی", LAHORE: "لاہور", ISLAMABAD: "اسلام آباد", MULTAN: "ملتان",
  PESHAWAR: "پشاور", QUETTA: "کوئٹہ", FAISALABAD: "فیصل آباد", SIALKOT: "سیالکوٹ",
  JEDDAH: "جدہ", MADINAH: "مدینہ", RIYADH: "ریاض", DAMMAM: "دمام",
  DUBAI: "دبئی", ABUDHABI: "ابوظہبی", SHARJAH: "شارجہ", DOHA: "دوحہ",
  MUSCAT: "مسقط", KUWAIT: "کویت", BAHRAIN: "بحرین", ISTANBUL: "استنبول",
};
function urduRoute(from: string, to: string) {
  const f = URDU_CITIES[from.toUpperCase().replace(/[^A-Z]/g, "")] ?? from;
  const t = URDU_CITIES[to.toUpperCase().replace(/[^A-Z]/g, "")] ?? to;
  return `${f} ${t}`;
}

type Pax = { first: string; last: string };
type Slot = "passport" | "visa";

/**
 * Split a fare's flight_details text into bookable options — one per travel
 * DATE. Connecting legs (and any leg that carries the same date, or no date at
 * all) are never treated as a separate flight; they stay inside the option of
 * the date they belong to.
 */
function splitFlightOptions(details: string): string[] {
  const raw = (details || "").split(/\s*\|\s*|\n+/).map((s) => s.trim()).filter(Boolean);
  if (raw.length <= 1) return raw.length ? raw : [];
  const dateOf = (s: string) => {
    const m = s
      .toUpperCase()
      .match(/\b(\d{1,2})\s*[-\/ ]?\s*(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)[A-Z]*\b/);
    return m ? `${m[1]}${m[2]}` : null;
  };
  const groups: { date: string | null; segs: string[] }[] = [];
  for (const seg of raw) {
    const d = dateOf(seg);
    const last = groups[groups.length - 1];
    // No date on this leg, or same date as the current group → same itinerary.
    if (last && (d === null || last.date === null || d === last.date)) {
      last.segs.push(seg);
      if (last.date === null) last.date = d;
    } else {
      groups.push({ date: d, segs: [seg] });
    }
  }
  return groups.map((g) => g.segs.join(" | "));
}


type FlightOption = { key: string; fare: Fare; detail: string };

function BookingModal({ fare, onClose, sold }: { fare: Fare; onClose: () => void; sold: Record<string, number> }) {
  // Only the clicked fare row is bookable here — sibling rows (other dates on
  // the same sector) are separate fares with their own Book Now button.
  const options = useMemo<FlightOption[]>(() => {
    const base = fare.flight_details
      ?? `${fare.flight_date ?? ""} ${fare.origin_code} ${fare.destination_code}${fare.depart_time ? ` ${fare.depart_time}` : ""}${fare.arrive_time ? ` ${fare.arrive_time}` : ""}${fare.flight_number ? ` ${fare.flight_number}` : ""}`;
    const parts = splitFlightOptions(base);
    const list = parts.length ? parts : [base];
    return list.map((detail, i) => ({ key: `${fare.id}:${i}`, fare, detail }));
  }, [fare]);


  const [chosenKey, setChosenKey] = useState<string | null>(
    options.length <= 1 ? (options[0]?.key ?? `${fare.id}:0`) : null,
  );
  const chosen = options.find((o) => o.key === chosenKey);
  const selected = chosen?.fare ?? fare;

  const [pax, setPax] = useState<Pax[]>([{ first: "", last: "" }]);
  const [phone] = useState("");
  const [notes, setNotes] = useState("");
  

  const [passports, setPassports] = useState<File[]>([]);
  const [visas, setVisas] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const notify = useServerFn(notifyBookingCreated);

  const priceIsNumeric = /\d/.test(selected.price_text || "");
  const details = chosen?.detail
    ?? selected.flight_details
    ?? `${selected.flight_date} ${selected.origin_code} ${selected.destination_code}${selected.depart_time ? ` ${selected.depart_time}` : ""}${selected.arrive_time ? ` ${selected.arrive_time}` : ""}${selected.flight_number ? ` ${selected.flight_number}` : ""}`;

  function pick(slot: Slot, e: React.ChangeEvent<HTMLInputElement>) {
    const list = Array.from(e.target.files ?? []).slice(0, 10);
    if (slot === "passport") setPassports(list); else setVisas(list);
  }


  function updPax(i: number, k: keyof Pax, v: string) {
    setPax((p) => p.map((row, idx) => (idx === i ? { ...row, [k]: v } : row)));
  }

  async function uploadGroup(uid: string, files: File[], kind: Slot) {
    const out: { name: string; path: string; size: number; type: string; kind: Slot }[] = [];
    for (const file of files.slice(0, 10)) {
      const safe = file.name.replace(/[^\w.\-]+/g, "_");
      const path = `${uid}/${kind}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}-${safe}`;
      const { error } = await supabase.storage.from("booking-attachments").upload(path, file, {
        upsert: false, contentType: file.type || undefined,
      });
      if (error) throw new Error(error.message);
      out.push({ name: file.name, path, size: file.size, type: file.type, kind });
    }
    return out;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const total = parseSeatsTotal(selected.seats);
    const key = `${selected.origin_code.toUpperCase()}-${selected.destination_code.toUpperCase()}`;
    const soldCount = sold[key] ?? 0;
    const available = total > 0 ? Math.max(total - soldCount, 0) : 999;

    const names = pax
      .map((p) => `${p.first.trim()} ${p.last.trim()}`.trim().toUpperCase())
      .filter(Boolean);
    if (names.length !== pax.length) return setErr("Please enter first and last name for every passenger.");
    if (pax.length > available) {
      return setErr(`Only ${available} seat${available === 1 ? "" : "s"} available for this sector.`);
    }
    if (passports.length === 0) return setErr("Passport copies are mandatory — please upload at least one file.");




    setBusy(true);
    setMsg(null);
    try {
      const { data: userRes, error: userErr } = await supabase.auth.getUser();
      const uid = userRes?.user?.id;
      if (userErr || !uid) throw new Error("Your session expired — please sign in again.");
      const { data: profile } = await supabase
        .from("agents")
        .select("country_code, cell_number")
        .eq("user_id", uid)
        .maybeSingle();
      const agentPhone = profile
        ? `${(profile as any).country_code ?? ""} ${(profile as any).cell_number ?? ""}`.trim()
        : "";
      const attachments = [
        ...(await uploadGroup(uid, passports, "passport")),
        ...(await uploadGroup(uid, visas, "visa")),
      ];
      const { data: inserted, error } = await supabase.from("agent_bookings").insert({
        agent_user_id: uid,
        fare_id: selected.id,
        fare_snapshot: { ...selected, flight_details: details },
        seats: pax.length,
        passenger_names: names.join("\n"),
        contact_phone: agentPhone || phone,

        notes,
        fare_on_demand: "",

        attachments,
        payment_status: "unpaid",
        ticket_status: "submitted",
        status: "submitted",
      } as any).select("id").single();
      if (error) throw new Error(error.message);
      const bookingId = (inserted as any)?.id as string | undefined;
      if (bookingId) { try { await notify({ data: { bookingId } }); } catch { /* ignore */ } }
      setMsg("Booking confirmed and sent to our team. Track it under All Group Bookings.");
      setTimeout(onClose, 1800);
    } catch (e: any) {
      setErr(e.message ?? "Failed to submit");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-navy/60 p-4 backdrop-blur-sm">
      <div className="my-6 w-full max-w-2xl overflow-hidden rounded-2xl bg-background shadow-2xl ring-1 ring-gold/30">
        <div className="flex items-center justify-between bg-navy px-6 py-4 text-navy-foreground">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-gold">Rohi Travels B2B</p>
            <h3 className="font-serif text-2xl font-bold">Book Fare</h3>
            <p className="text-xs text-white/70">{selected.airline} · {selected.origin_code} → {selected.destination_code}</p>
          </div>
          <button onClick={onClose} className="text-2xl leading-none text-white/70 hover:text-white">×</button>
        </div>

        {!chosen ? (
          <div className="space-y-3 p-6">
            <div>
              <p className="font-serif text-lg font-bold text-foreground">Which date / flight do you want to book?</p>
              <p className="text-[11.5px] text-muted-foreground">
                {options.length} options available on {selected.origin_code} → {selected.destination_code}. Connecting itineraries are shown as one option.
              </p>
            </div>
            <div className="space-y-2">
              {options.map((o, i) => {
                const legs = o.detail.split(/\s*\|\s*/).filter(Boolean);
                return (
                  <button
                    key={o.key}
                    type="button"
                    onClick={() => setChosenKey(o.key)}
                    className="flex w-full items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-left transition hover:border-gold hover:bg-gold/10"
                  >
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-navy text-[11px] font-black text-navy-foreground">
                      {i + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[11px] font-black uppercase tracking-wider text-navy">
                        {o.fare.airline} · {o.fare.origin_code} → {o.fare.destination_code}
                        {legs.length > 1 && <span className="ml-2 rounded bg-navy/10 px-1.5 py-0.5 text-[9.5px] tracking-wide">Connecting · {legs.length} legs</span>}
                      </span>
                      <span className="mt-1 block whitespace-pre-line font-mono text-[12px] leading-snug text-foreground">
                        {legs.join("\n")}
                      </span>
                      <span className="mt-1 block text-[10.5px] font-semibold text-muted-foreground">
                        Fare: <span className="font-black text-orange-600">{/\d/.test(o.fare.price_text || "") ? formatFare(o.fare.price_text) : o.fare.price_text}</span>
                        {" · Baggage: "}{o.fare.baggage ?? "—"}
                      </span>
                    </span>
                    <span className="shrink-0 text-lg text-gold">→</span>
                  </button>
                );
              })}
            </div>
            <div className="flex justify-end pt-1">
              <button type="button" onClick={onClose} className="rounded-full border border-border bg-card px-5 py-2.5 text-sm font-bold uppercase tracking-wide">Cancel</button>
            </div>
          </div>
        ) : (
        <form onSubmit={submit} className="space-y-5 p-6">
          {options.length > 1 && (
            <button
              type="button"
              onClick={() => setChosenKey(null)}
              className="text-[11px] font-bold uppercase tracking-wider text-navy underline hover:text-gold"
            >
              ← Change date / flight
            </button>
          )}


          {/* Auto-filled flight summary */}
          <div className="rounded-xl border border-border bg-card p-4 text-[13px] leading-relaxed">
            <p>
              <span className="font-semibold text-muted-foreground">Flight:</span>{" "}
              <span className="whitespace-pre-line font-mono text-[12.5px] text-foreground">{details}</span>
            </p>

            <p className="mt-1">
              <span className="font-semibold text-muted-foreground">Fare:</span>{" "}
              {priceIsNumeric ? (
                <span className="text-[15px] font-black text-orange-600">{formatFare(selected.price_text)}</span>
              ) : (
                <span className="font-black uppercase text-red-600">{selected.price_text}</span>
              )}
              {" • "}
              <span className="font-semibold text-muted-foreground">Baggage:</span>{" "}
              <span className="font-semibold text-foreground">{selected.baggage ?? "—"}</span>
            </p>
          </div>






          {/* Passengers */}
          <div>
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold uppercase tracking-wider text-[color:var(--ledger-brown)]">Passengers ({pax.length} seat{pax.length === 1 ? "" : "s"})</label>
              <div className="flex gap-1.5">
                <button type="button" onClick={() => setPax((p) => p.slice(0, Math.max(1, p.length - 1)))}
                  className="h-7 w-7 rounded-md border border-border bg-card font-bold text-foreground hover:bg-secondary">−</button>
                <button type="button" onClick={() => setPax((p) => (p.length >= 20 ? p : [...p, { first: "", last: "" }]))}
                  className="h-7 w-7 rounded-md bg-navy font-bold text-navy-foreground hover:opacity-90">+</button>
              </div>
            </div>
            <div className="mt-2 space-y-2">
              {pax.map((p, i) => (
                <div key={i} className="grid grid-cols-2 gap-2">
                  <input required value={p.first} onChange={(e) => updPax(i, "first", e.target.value)} placeholder="First Name"
                    className="rounded-lg border border-border bg-card px-3 py-2 text-sm uppercase outline-none focus:border-gold" />
                  <input required value={p.last} onChange={(e) => updPax(i, "last", e.target.value)} placeholder="Last Name"
                    className="rounded-lg border border-border bg-card px-3 py-2 text-sm uppercase outline-none focus:border-gold" />
                </div>
              ))}
            </div>
          </div>


          <FileSlot
            title="Passport Copies"
            hint="Mandatory · up to 10 files"
            required
            files={passports}
            onPick={(e) => pick("passport", e)}
          />
          <FileSlot
            title="Visa Copy"
            hint="Optional · up to 10 files"
            files={visas}
            onPick={(e) => pick("visa", e)}
          />

          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-[color:var(--ledger-brown)]">Notes (optional)</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
              className="mt-1.5 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:border-gold" />
          </div>

          {err && <p className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{err}</p>}
          {msg && <p className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">{msg}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="rounded-full border border-border bg-card px-5 py-2.5 text-sm font-bold uppercase tracking-wide">Cancel</button>
            <button disabled={busy} className="rounded-full bg-gold px-6 py-2.5 text-sm font-black uppercase tracking-wider text-gold-foreground shadow-md hover:opacity-90 disabled:opacity-50">
              {busy ? "Submitting…" : "Confirm Booking"}
            </button>
          </div>
        </form>
        )}

      </div>
    </div>
  );
}

function FileSlot({
  title, hint, files, onPick, required,
}: {
  title: string; hint: string; files: File[]; required?: boolean;
  onPick: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-card/60 p-3">
      <div className="flex items-baseline justify-between">
        <label className="text-[11px] font-bold uppercase tracking-wider text-[color:var(--ledger-brown)]">
          {title}{required ? " *" : ""}
        </label>
        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{hint}</span>
      </div>
      <input
        type="file"
        accept="image/*,application/pdf"
        multiple
        onChange={onPick}
        className="mt-2 block w-full text-xs file:mr-3 file:rounded-md file:border-0 file:bg-navy file:px-3 file:py-1.5 file:text-xs file:font-bold file:uppercase file:tracking-wide file:text-navy-foreground hover:file:opacity-90"
      />
      {files.length > 0 && (
        <ul className="mt-2 grid gap-1 sm:grid-cols-2">
          {files.map((f, i) => (
            <li key={i} className="flex items-center justify-between rounded border border-border bg-background px-2 py-1 text-[10.5px]">
              <span className="truncate">📎 {f.name}</span>
              <span className="ml-2 shrink-0 text-muted-foreground">{Math.round(f.size / 1024)} KB</span>
            </li>
          ))}
        </ul>
      )}
      {files.length >= 10 && (
        <p className="mt-1 text-[10.5px] font-semibold uppercase tracking-wide text-amber-700">Max 10 files reached.</p>
      )}
    </div>
  );
}

