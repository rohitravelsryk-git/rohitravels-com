import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";


import { supabase } from "@/integrations/supabase/client";
import { AirlineLogo, formatFare } from "@/routes/index";
import { buildFareShareText } from "@/lib/fare-format";
import { getSectorSoldCounts } from "@/lib/agent-fares.functions";
import { listFares } from "@/lib/fares.functions";
import { maskedPriceText } from "@/lib/fare-mask";
import { notifyBookingCreated } from "@/lib/agent-bookings.functions";
import { requestBookingOtp, resendBookingOtp, verifyBookingOtp, createVerifiedBooking } from "@/lib/booking-otp.functions";
import { isReturnFare, umrahCategoryLabel } from "@/lib/umrah";

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
  group_type?: string;
  hide_fare_after_2h?: boolean;
  auto_hide_hours?: number;
  updated_at: string;
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
  const fetchFares = useServerFn(listFares);

  const loadData = () => {
    // Server-side masked list: while masking is active the real amount never
    // reaches the browser.
    fetchFares()
      .then((rows: any) => {
        setFares((rows ?? []) as Fare[]);
        setLoading(false);
      })
      .catch(() => setLoading(false));
    fetchSold().then((counts) => {
      setSold(counts ?? {});
    }).catch((err) => console.error('Failed to fetch sold counts:', err));
  };

  useEffect(() => {
    loadData();
    
    // Real-time sync for fares and bookings (seat availability)
    const faresChannel = supabase
      .channel("agent-fares-sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "fares" }, () => loadData())
      .subscribe();

    const bookingsChannel = supabase
      .channel("agent-bookings-sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "agent_bookings" }, () => {
        fetchSold().then((counts) => setSold(counts ?? {}));
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "group_tickets" }, () => {
        fetchSold().then((counts) => setSold(counts ?? {}));
      })
      .subscribe();

    // Re-check masking windows every minute so an expiring fare flips to
    // "FARE ON WHATSAPP" without a manual refresh.
    const maskTimer = setInterval(loadData, 60_000);

    return () => {
      clearInterval(maskTimer);
      supabase.removeChannel(faresChannel);
      supabase.removeChannel(bookingsChannel);
    };
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
    
    // We isolate sold counts strictly by the fare_id to ensure specific groups (even on same sector)
    // show correct remaining inventory.
    const soldCount = sold[f.id] ?? 0;
    const available = Math.max(total - soldCount, 0);
    return { available, total, label: `${available} out of ${total}` };
  }

  return (
    <div className="p-3 md:p-5 relative pb-32">

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

              <div className="rounded-lg border border-gray-200 bg-white shadow-[0_2px_10px_rgba(15,23,42,0.05)] overflow-x-auto">
                <table className="w-full min-w-[1200px] border-collapse text-xs">
                  <thead className="bg-[#0b1220] text-white sticky top-0 z-10">
                    <tr>
                      {[
                        { label: "AIRLINE", w: "70px" },
                        { label: "FROM", w: "100px" },
                        { label: "TO", w: "100px" },
                        { label: "FLIGHT DETAILS", w: "220px" },
                        { label: "BAGGAGE", w: "80px" },
                        { label: "MEAL", w: "70px" },
                        { label: "SEATS", w: "85px" },
                        { label: "SECTOR", w: "140px" },
                        { label: "FARE", w: "100px" },
                        { label: "GET FARE", w: "90px" },
                        { label: "ACTION", w: "100px" },
                      ].map((h, i) => (
                        <th
                          key={i}
                          style={{ width: h.w }}
                          className="whitespace-nowrap px-2 py-3 text-center text-[10.5px] font-bold uppercase tracking-[0.14em]"
                        >
                          {h.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((f, idx) => {
                      const isReturn = f.flight_details?.includes("--- RETURN ---");
                      let details = f.flight_details ?? "";
                      if (isReturn) {
                        const [dep, ret] = (f.flight_details || "").split("--- RETURN ---").map(s => s.trim());
                        details = `DEPARTURE:\n${dep}\n\nRETURN:\n${ret}`;
                      } else {
                        const year = new Date().getFullYear();
                        details = f.flight_details
                          ?? `${f.flight_date} ${year} ${f.origin_code} ${f.destination_code}${f.depart_time ? ` ${f.depart_time}` : ""}${f.arrive_time ? ` ${f.arrive_time}` : ""}${f.flight_number ? ` ${f.flight_number}` : ""}`;
                      }
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
                            <div className="mx-auto flex h-12 w-12 items-center justify-center overflow-hidden rounded-lg border border-border bg-card shadow-sm">
                              <AirlineLogo name={f.airline} height={36} />
                            </div>

                          </td>
                          <td className="px-2 py-2.5 text-center font-bold text-navy whitespace-nowrap align-middle">
                            <div className="flex flex-col items-center leading-tight">
                              <span>{f.origin.toUpperCase()}</span>
                              <span className="text-[10px] font-bold text-navy/40 uppercase">{f.origin_code.toUpperCase()}</span>
                              {isReturn && (
                                <>
                                  <div className="h-[1px] w-8 bg-gray-200 my-0.5" />
                                  <span>{f.destination.toUpperCase()}</span>
                                  <span className="text-[10px] font-bold text-navy/40 uppercase">{f.destination_code.toUpperCase()}</span>
                                </>
                              )}
                            </div>
                          </td>
                          <td className="px-2 py-2.5 text-center font-bold text-navy whitespace-nowrap align-middle">
                            <div className="flex flex-col items-center leading-tight">
                              <span>{f.destination.toUpperCase()}</span>
                              <span className="text-[10px] font-bold text-navy/40 uppercase">{f.destination_code.toUpperCase()}</span>
                              {isReturn && (
                                <>
                                  <div className="h-[1px] w-8 bg-gray-200 my-0.5" />
                                  <span>{f.origin.toUpperCase()}</span>
                                  <span className="text-[10px] font-bold text-navy/40 uppercase">{f.origin_code.toUpperCase()}</span>
                                </>
                              )}
                            </div>
                          </td>
                          <td className="px-2 py-3 text-center font-mono text-[11px] font-bold tracking-tight leading-relaxed text-gray-800 whitespace-pre-line break-words">
                            {(() => {
                              if (isReturn) {
                                const year = new Date().getFullYear();
                                const [dep, ret] = (f.flight_details || "").split("--- RETURN ---").map(s => s.trim());
                                const depLines = dep.split('\n');
                                const retLines = ret.split('\n');
                                
                                return (
                                  <div className="flex flex-col text-left px-2 font-mono text-[11px] font-bold leading-tight uppercase">
                                    <div className="whitespace-pre-line">
                                      {depLines.map(line => {
                                        if (/^\d{1,2}[A-Z]{3}/.test(line)) {
                                          const parts = line.split(/\s+/);
                                          if (!parts[1] || !/^\d{4}$/.test(parts[1])) {
                                            parts.splice(1, 0, String(year));
                                            return parts.join(' ');
                                          }
                                        }
                                        return line;
                                      }).join('\n')}
                                    </div>
                                    <div className="whitespace-pre-line mt-1">
                                      {retLines.map(line => {
                                        if (/^\d{1,2}[A-Z]{3}/.test(line)) {
                                          const parts = line.split(/\s+/);
                                          if (!parts[1] || !/^\d{4}$/.test(parts[1])) {
                                            parts.splice(1, 0, String(year));
                                            return parts.join(' ');
                                          }
                                        }
                                        return line;
                                      }).join('\n')}
                                    </div>
                                  </div>
                                );
                              }
                              const year = new Date().getFullYear();
                              const lines = (details || "—").split('\n');
                              return (
                                <div className="px-2 text-left font-mono text-[11px] font-bold leading-tight uppercase whitespace-pre-line">
                                  {lines.map(line => {
                                    if (/^\d{1,2}[A-Z]{3}/.test(line)) {
                                      const parts = line.split(/\s+/);
                                      if (!parts[1] || !/^\d{4}$/.test(parts[1])) {
                                        parts.splice(1, 0, String(year));
                                        return parts.join(' ');
                                      }
                                    }
                                    return line;
                                  }).join('\n')}
                                </div>
                              );
                            })()}
                          </td>
                          <td className="px-2 py-2 text-center text-[11px] font-medium text-gray-700 whitespace-nowrap">{f.baggage ?? "—"}</td>
                          <td className={`px-2 py-2 text-center text-[11px] font-bold ${mealColor}`}>{f.meal ?? "—"}</td>
                          <td className="px-2 py-2 text-center text-[11px] font-bold whitespace-nowrap">
                            {s.available === 0 && f.group_type === "self" ? (
                              <span className="inline-flex items-center gap-1 rounded bg-navy px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-white shadow-sm ring-1 ring-navy/30">
                                Sold
                              </span>
                            ) : s.available === null ? (
                              <span className="text-gray-500">{s.label}</span>
                            ) : (
                              <span className={s.available === 0 ? "text-destructive" : "text-gray-800"}>
                                {s.label}
                              </span>
                            )}
                          </td>
                          <td dir="rtl" className="font-urdu whitespace-nowrap px-1 py-2 text-center align-middle">
                            <span className="inline-flex items-center justify-center text-[22px] leading-none text-gray-900">
                              {urduRoute(f.origin, f.destination)}
                            </span>
                          </td>
                          <td className="px-2 py-2 text-center whitespace-nowrap">
                            {(() => {
                              const priceText = maskedPriceText(f);
                              const isNumeric = /\d/.test(priceText || "");
                              if (isNumeric) {
                                return <span className="text-[15px] font-black text-orange-600 tabular-nums">{formatFare(priceText)}</span>;
                              }
                              return <span className="text-[11px] font-black uppercase leading-tight tracking-wide text-red-600">{priceText}</span>;
                            })()}
                          </td>
                          <td className="px-2 py-2 text-center">
                            <button
                              onClick={() => {
                                const text = buildFareShareText(f);
                                const phone = "923056622988";
                                const url = `https://wa.me/${phone}?text=${encodeURIComponent(text.trim())}`;
                                window.open(url, "_blank", "noopener,noreferrer");
                              }}
                              style={{ backgroundColor: "#25D366", borderColor: "#128C7E", color: "#ffffff" }}
                              className="inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[10.5px] font-bold shadow-sm transition hover:brightness-95"
                            >
                              GET FARE
                            </button>
                          </td>
                          <td className="px-2 py-2 text-center bg-[#0b1220]">
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

type Pax = { title: string; first: string; last: string; passport: string; dob: string; passport_date: string; passport_expiry: string };
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

/**
 * Business rule: "UMRAH" is shown only for RETURN fares whose route includes
 * Jeddah (JED) or Medinah (MED). Shared with the public site and admin panel.
 */

/** Forced category for a qualifying fare, otherwise null (existing logic applies). */
function forcedCategory(f: Fare): string | null {
  return umrahCategoryLabel(f);
}

/** Category label to display / submit — forced rule first, then existing data. */
function effectiveCategory(f: Fare): string {
  const forced = forcedCategory(f);
  if (forced) return forced;
  // Never surface a stale "UMRAH" label on one-way / non-JED-MED fares.
  return String(f.category ?? "")
    .toUpperCase()
    .replace(/JEDDAH|SELF GROUP|UMRAH|UMARH/g, "")
    .trim();
}


function BookingModal({ fare, onClose, sold }: { fare: Fare; onClose: () => void; sold: Record<string, number> }) {
  const totalSeats = parseSeatsTotal(fare.seats);
  // Subtract sold counts from total to get available. sold[fare.id] is correctlyIsolated by unique fare_id
  const availableSeats = totalSeats > 0 ? Math.max(totalSeats - (sold[fare.id] ?? 0), 0) : 0;

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

  const [pax, setPax] = useState<Pax[]>([{ title: "Mr", first: "", last: "", passport: "", dob: "", passport_date: "", passport_expiry: "" }]);
  const [bookerInfo, setBookerInfo] = useState({ name: "", phone: "", email: "" });



  

  const [passports, setPassports] = useState<File[]>([]);
  const [visas, setVisas] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const notify = useServerFn(notifyBookingCreated);

  const [otpOpen, setOtpOpen] = useState(false);
  const [otpChallenge, setOtpChallenge] = useState("");
  const [otpMasked, setOtpMasked] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpBusy, setOtpBusy] = useState(false);
  const [otpErr, setOtpErr] = useState<string | null>(null);
  const [otpExpiresAt, setOtpExpiresAt] = useState<number>(0);
  const [otpLeft, setOtpLeft] = useState(0);
  const [confirming, setConfirming] = useState(false);

  const requestOtpFn = useServerFn(requestBookingOtp);
  const resendOtpFn = useServerFn(resendBookingOtp);
  const verifyOtpFn = useServerFn(verifyBookingOtp);
  const createBookingFn = useServerFn(createVerifiedBooking);

  useEffect(() => {
    if (!otpOpen || !otpExpiresAt) return;
    const tick = () => setOtpLeft(Math.max(0, Math.ceil((otpExpiresAt - Date.now()) / 1000)));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [otpOpen, otpExpiresAt]);

  async function sendOtp(mode: "start" | "resend") {
    setOtpBusy(true);
    setOtpErr(null);
    try {
      const res = mode === "start" ? await requestOtpFn({ data: undefined }) : await resendOtpFn({ data: undefined });
      if (!res.ok) throw new Error(res.error ?? "Could not send the verification code.");
      setOtpChallenge(res.challenge);
      setOtpMasked(res.maskedEmail);
      setOtpCode("");
      setOtpExpiresAt(Date.now() + res.expiresInSeconds * 1000);
      setOtpOpen(true);
    } catch (e: any) {
      const message = e?.message ?? "Could not send the verification code.";
      if (mode === "start") setErr(message); else setOtpErr(message);
    } finally {
      setOtpBusy(false);
    }
  }

  // Masked fare text is the only value the Book Fare form may show/use.
  const shownPrice = maskedPriceText(selected);
  const priceIsNumeric = /\d/.test(shownPrice || "");
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

  const priceVal = (shownPrice || "").replace(/[^\d]/g, "");
  const displayFare = priceVal
    ? `PKR ${Number(priceVal).toLocaleString()}`
    : shownPrice || "FARE ON WHATSAPP";
  const totalCost = priceVal ? Number(priceVal) * pax.length : null;
  const displayTotal = totalCost !== null ? `PKR ${totalCost.toLocaleString()}` : displayFare;


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

    const names = pax
      .map((p) => `${p.title} ${p.first.trim()} ${p.last.trim()}`.trim().toUpperCase())
      .filter((n) => n.length > 3);

    if (names.length !== pax.length) return setErr("Please enter names for every passenger.");
    if (passports.length === 0) return setErr("Passport copies are mandatory — please upload at least one file.");

    if (!confirming) {
      setConfirming(true);
      return;
    }

    const total = parseSeatsTotal(selected.seats);
    const soldCount = sold[selected.id] ?? 0;
    const available = total > 0 ? Math.max(total - soldCount, 0) : 0;

    if (pax.length > available) {
      return setErr(`Only ${available} seat${available === 1 ? "" : "s"} available for this fare.`);
    }

    // Booking stays pending until the emailed OTP is verified.
    await sendOtp("start");
  }

  async function finalizeBooking(grant: string) {
    setBusy(true);
    setMsg(null);
    setErr(null);
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
      const res = await createBookingFn({
        data: {
          grant,
          fare_id: selected.id,
          fare_snapshot: { ...selected, category: forcedCategory(selected) ?? selected.category, flight_details: details, fare_on_demand: (selected as any).fare_on_demand },
          seats: pax.length,
          passenger_names: pax.map(p => `${p.first} ${p.last} | ${p.passport} | ${p.dob} | ${p.passport_date} | ${p.passport_expiry}`.trim()).join("\n"),
          contact_phone: agentPhone,
          attachments,
        },
      });

      if (!res.ok) throw new Error(res.error);

      const bookingId = res.bookingId;
      if (bookingId) {
        try {
          await notify({ data: { bookingId } });
        } catch (err) {
          console.error("Notification error:", err);
        }
      }

      setOtpOpen(false);
      setMsg("Booking confirmed and sent to our team. Track it under All Group Bookings.");
      setTimeout(onClose, 1800);
    } catch (e: any) {
      setOtpErr(e.message ?? "Failed to submit");
    } finally {
      setBusy(false);
    }
  }

  if (otpOpen) {
    const expired = otpLeft <= 0;
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/60 p-4 backdrop-blur-sm">
        <div className="w-full max-w-sm rounded-2xl bg-background p-6 shadow-2xl ring-1 ring-gold/30">
          <div className="mb-6 text-center">
            <h3 className="font-serif text-xl font-bold text-navy">Email Verification</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Enter the 6-digit code we sent to <b>{otpMasked}</b> to complete this booking.
            </p>
            <p className={`mt-2 text-[11px] font-bold uppercase tracking-wider ${expired ? "text-red-600" : "text-muted-foreground"}`}>
              {expired
                ? "Code expired — please resend"
                : `Expires in ${String(Math.floor(otpLeft / 60)).padStart(2, "0")}:${String(otpLeft % 60).padStart(2, "0")}`}
            </p>
          </div>
          <div className="space-y-4">
            <input
              type="text"
              inputMode="numeric"
              autoFocus
              placeholder="000000"
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              className="w-full rounded-lg border border-border bg-card px-4 py-3 text-center text-2xl font-bold tracking-[0.5em] outline-none focus:border-gold"
            />
            {otpErr && <p className="text-center text-xs font-semibold text-red-600">{otpErr}</p>}
            <button
              onClick={async () => {
                setOtpBusy(true);
                setOtpErr(null);
                try {
                  const res = await verifyOtpFn({ data: { challenge: otpChallenge, code: otpCode } });
                  if (!res.ok) throw new Error(res.error);
                  await finalizeBooking(res.grant);
                } catch (e: any) {
                  setOtpErr(e.message ?? "Invalid code.");
                } finally {
                  setOtpBusy(false);
                }
              }}
              disabled={otpBusy || busy || expired || otpCode.length < 6}
              className="w-full rounded-full bg-gold py-3 text-sm font-black uppercase tracking-wider text-gold-foreground shadow-md hover:opacity-90 disabled:opacity-50"
            >
              {otpBusy || busy ? "Verifying…" : "Verify & Confirm Booking"}
            </button>
            <button
              onClick={() => sendOtp("resend")}
              disabled={otpBusy || busy}
              className="w-full text-xs font-bold uppercase tracking-wider text-navy hover:text-gold disabled:opacity-50"
            >
              Resend OTP
            </button>
            <button
              onClick={() => { setOtpOpen(false); setOtpErr(null); }}
              disabled={otpBusy || busy}
              className="w-full text-xs font-bold uppercase tracking-wider text-muted-foreground hover:text-navy"
            >
              ← Back to Details
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-navy/60 p-4 backdrop-blur-sm">
      <div className="my-6 w-full max-w-[1000px] overflow-hidden rounded-2xl bg-background shadow-2xl ring-1 ring-gold/30">
        <div className="flex items-center justify-between bg-white px-6 py-4 border-b border-border">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-lg border border-border bg-card shadow-sm">
              <AirlineLogo name={selected.airline} height={36} />
            </div>
            <div>
              <h3 className="text-lg font-black uppercase text-navy leading-none">
                <span className="font-bold">{selected.origin.toUpperCase()}</span>
                <span className="mx-2 text-gray-400">→</span>
                <span className="font-bold">{selected.destination.toUpperCase()}</span>
              </h3>
              <p className="mt-1 text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none">
                {selected.origin_code.toUpperCase()} {selected.destination_code.toUpperCase()}
              </p>
              {effectiveCategory(selected) && (
                <p className="mt-1 text-[9px] font-bold text-gold uppercase tracking-[0.2em]">
                  ({`CATEGORY ${effectiveCategory(selected)}`})
                </p>
              )}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Seats Available</div>
            <div className="text-sm font-black text-emerald-600">{availableSeats > 0 ? availableSeats : ""}</div>
          </div>
          <button onClick={onClose} className="ml-4 h-8 w-8 flex items-center justify-center rounded-full bg-gray-100 text-xl leading-none text-gray-500 hover:bg-gray-200">×</button>
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
                const isReturn = isReturnFare(o.fare);
                const forced = forcedCategory(o.fare);
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
                        {forced && <span className="ml-2 text-gold font-bold">(CATEGORY UMRAH)</span>}
                        {legs.length > 1 && !isReturn && <span className="ml-2 rounded bg-navy/10 px-1.5 py-0.5 text-[9.5px] tracking-wide">Connecting · {legs.length} legs</span>}
                      </span>
                      <span className="mt-1 block whitespace-pre-line font-mono text-[12px] leading-snug text-foreground">
                        {legs.join("\n")}
                      </span>
                      <span className="mt-1 block text-[10.5px] font-semibold text-muted-foreground">
                        Fare: <span className="font-black text-orange-600">{(() => { const pt = maskedPriceText(o.fare); return /\d/.test(pt || "") ? formatFare(pt) : pt; })()}</span>
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
        <form onSubmit={submit} className="space-y-4 p-6 bg-[#f8fafc]">
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
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <div className="grid grid-cols-3 gap-6">
              <div className="col-span-2 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="text-sm font-black text-navy">{selected.origin.toUpperCase()} {selected.destination.toUpperCase()}</div>
                </div>
                
                <div className="flex items-center gap-2">
                  <div className="text-xs font-bold text-gray-500 uppercase">{selected.origin_code} {selected.destination_code}</div>
                </div>
                
                <div className="space-y-1.5 text-[11px]">
                  <div className="font-mono leading-tight text-gray-700 whitespace-pre-line border-l-2 border-gold/30 pl-2">
                    {details.split(/\s*\|\s*/).join('\n')}
                    {`\nBaggage: ${selected.baggage ?? "—"}`}
                  </div>
                </div>
              </div>

              <div className="space-y-4 border-l border-gray-100 pl-6">
                <div>
                  <div className="text-[9px] font-black uppercase tracking-widest text-gray-400">Price/Seat</div>
                  <div className="text-sm font-black text-navy">{displayFare}</div>
                </div>
                <div>
                  <div className="text-[9px] font-black uppercase tracking-widest text-gray-400">Total Price</div>
                  <div className="text-lg font-black text-orange-600">{displayTotal}</div>
                </div>
              </div>
            </div>
          </div>








          {/* Main Tables */}
          <div className="space-y-6">


            <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
              <table className="w-full min-w-[800px] border-collapse bg-white text-xs">
                <thead className="bg-[#f1f5f9] text-[10px] font-bold uppercase tracking-wider text-gray-600">
                  <tr>
                    <th className="border-b border-r border-gray-200 px-2 py-2 text-left w-12">Sr#</th>
                    <th className="border-b border-r border-gray-200 px-2 py-2 text-left w-20">Title</th>
                    <th className="border-b border-r border-gray-200 px-2 py-2 text-left">Given Name</th>
                    <th className="border-b border-r border-gray-200 px-2 py-2 text-left">Sur Name</th>
                    <th className="border-b border-r border-gray-200 px-2 py-2 text-left">Passport#</th>
                    <th className="border-b border-r border-gray-200 px-2 py-2 text-left">Date of Birth</th>
                    <th className="border-b border-r border-gray-200 px-2 py-2 text-left">Passport issue Date</th>
                    <th className="border-b border-r border-gray-200 px-2 py-2 text-left">Passport Expiry</th>
                    <th className="border-b border-r border-gray-200 px-2 py-2 text-left">Passport Copy*</th>
                    <th className="border-b border-gray-200 px-2 py-2 text-left">Visa Copy</th>
                  </tr>
                </thead>
                <tbody>
                  {pax.map((p, i) => (
                    <tr key={i} className="hover:bg-gray-50/50">
                      <td className="border-b border-r border-gray-200 px-2 py-2 text-center align-middle font-bold text-gray-500">
                        {i + 1}
                      </td>
                      <td className="border-b border-r border-gray-200 px-1 py-1">
                        <select 
                          value={p.title} 
                          onChange={(e) => updPax(i, "title", e.target.value)}
                          className="w-full rounded border-none bg-transparent px-1 py-1 outline-none"
                        >
                          <option>Mr</option>
                          <option>Ms</option>
                          <option>Mrs</option>
                          <option>Mstr</option>
                        </select>
                      </td>
                      <td className="border-b border-r border-gray-200 px-1 py-1">
                        <input 
                          required 
                          value={p.first} 
                          onChange={(e) => updPax(i, "first", e.target.value)}
                          className="w-full border-none bg-transparent px-2 py-1 uppercase outline-none" 
                          placeholder="Given Name"
                        />
                      </td>
                      <td className="border-b border-r border-gray-200 px-1 py-1">
                        <input 
                          required 
                          value={p.last} 
                          onChange={(e) => updPax(i, "last", e.target.value)}
                          className="w-full border-none bg-transparent px-2 py-1 uppercase outline-none" 
                          placeholder="Sur Name"
                        />
                      </td>
                      <td className="border-b border-r border-gray-200 px-1 py-1">
                        <input 
                          value={p.passport} 
                          onChange={(e) => updPax(i, "passport", e.target.value)}
                          className="w-full border-none bg-transparent px-2 py-1 uppercase outline-none" 
                          placeholder="Passport#"
                        />
                      </td>
                      <td className="border-b border-r border-gray-200 px-1 py-1">
                        <input 
                          type="text"
                          placeholder="DD-MM-YYYY"
                          value={p.dob || ""} 
                          onChange={(e) => {
                            const val = e.target.value.replace(/[^0-9-]/g, "");
                            updPax(i, "dob", val);
                          }}
                          onBlur={(e) => {
                            const raw = e.target.value.replace(/\D/g, "");
                            if (raw.length === 8) {
                              const d = raw.slice(0, 2);
                              const m = raw.slice(2, 4);
                              const y = raw.slice(4, 8);
                              updPax(i, "dob", `${d}-${m}-${y}`);
                            }
                          }}
                          className="w-full border-none bg-transparent px-2 py-1 outline-none" 
                        />
                      </td>
                      <td className="border-b border-r border-gray-200 px-1 py-1">
                        <input 
                          type="text"
                          placeholder="DD-MM-YYYY"
                          value={p.passport_date || ""} 
                          onChange={(e) => {
                            const val = e.target.value.replace(/[^0-9-]/g, "");
                            updPax(i, "passport_date", val);
                          }}
                          onBlur={(e) => {
                            const raw = e.target.value.replace(/\D/g, "");
                            if (raw.length === 8) {
                              const d = raw.slice(0, 2);
                              const m = raw.slice(2, 4);
                              const y = raw.slice(4, 8);
                              updPax(i, "passport_date", `${d}-${m}-${y}`);
                            }
                          }}
                          className="w-full border-none bg-transparent px-2 py-1 outline-none" 
                        />
                      </td>
                      <td className="border-b border-r border-gray-200 px-1 py-1">
                        <input 
                          type="text"
                          placeholder="DD-MM-YYYY"
                          value={p.passport_expiry || ""} 
                          onChange={(e) => {
                            const val = e.target.value.replace(/[^0-9-]/g, "");
                            updPax(i, "passport_expiry", val);
                          }}
                          onBlur={(e) => {
                            const raw = e.target.value.replace(/\D/g, "");
                            if (raw.length === 8) {
                              const d = raw.slice(0, 2);
                              const m = raw.slice(2, 4);
                              const y = raw.slice(4, 8);
                              updPax(i, "passport_expiry", `${d}-${m}-${y}`);
                            }
                          }}
                          className="w-full border-none bg-transparent px-2 py-1 outline-none" 
                        />
                      </td>
                      <td className="border-b border-r border-gray-200 px-1 py-1">
                        <input 
                          type="file"
                          accept="image/*,application/pdf"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) setPassports(prev => [...prev, f]);
                          }}
                          className="w-full text-[9px]"
                        />
                      </td>
                      <td className="border-b border-gray-200 px-1 py-1">
                        <input 
                          type="file"
                          accept="image/*,application/pdf"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) setVisas(prev => [...prev, f]);
                          }}
                          className="w-full text-[9px]"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button 
                  type="button" 
                  onClick={() => setPax((p) => p.slice(0, Math.max(1, p.length - 1)))}
                  className="rounded-md border border-gray-200 bg-white px-3 py-1 text-sm font-bold shadow-sm hover:bg-gray-50"
                >
                  −
                </button>
                <span className="text-xs font-bold text-gray-500">{pax.length} Seat(s)</span>
                <button 
                  type="button" 
                  onClick={() => {
                    if (pax.length < availableSeats) {
                      setPax((p) => [...p, { title: "Mr", first: "", last: "", passport: "", dob: "", passport_date: "", passport_expiry: "" }]);
                    }
                  }}
                  disabled={pax.length >= availableSeats}
                  className="rounded-md border border-gray-200 bg-white px-3 py-1 text-sm font-bold shadow-sm hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  +
                </button>
              </div>
            </div>
          </div>






          {err && <p className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{err}</p>}
          {msg && <p className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">{msg}</p>}

          <div className="flex items-center justify-between border-t border-gray-200 pt-4">
            <button
              type="button"
              disabled={busy || availableSeats <= 0 || (fare as any).group_type !== 'self'}
              onClick={() => {
                const arr = [];
                for (let i = 0; i < availableSeats; i++) {
                  arr.push({ title: "Mr", first: `PAX ${i + 1}`, last: "SEAT", passport: "", dob: "", passport_date: "", passport_expiry: "" });
                }
                setPax(arr);
              }}
              className="rounded-md border border-[#0b2545] bg-white px-4 py-2 text-[10px] font-black uppercase tracking-wider text-[#0b2545] hover:bg-[#0b2545] hover:text-white transition-colors disabled:opacity-40"
            >
              Book Full Group
            </button>


            <div className="flex gap-3">
              <button type="button" onClick={onClose} className="rounded-md border border-gray-200 bg-white px-6 py-2 text-xs font-bold uppercase tracking-wider text-gray-400 hover:bg-gray-50">Cancel</button>
              
              {confirming ? (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-3 rounded-lg bg-orange-50 px-4 py-2 ring-1 ring-orange-200">
                    <p className="text-[10px] font-black uppercase tracking-wider text-orange-800">Verify ALL Details</p>
                    <button 
                      type="button" 
                      onClick={() => setConfirming(false)}
                      className="text-[10px] font-bold text-gray-400 hover:text-navy"
                    >
                      CANCEL
                    </button>
                    <button
                      type="submit"
                      disabled={busy}
                      className="rounded bg-orange-600 px-4 py-1.5 text-[10px] font-black uppercase tracking-wider text-white shadow-sm hover:bg-orange-700"
                    >
                      {otpBusy ? "SENDING OTP…" : "CONFIRM & SEND OTP"}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="submit"
                  disabled={busy}
                  className="rounded bg-[#0b2545] px-8 py-2.5 text-xs font-black uppercase tracking-wider text-white shadow-lg hover:bg-[#081b33] disabled:opacity-50"
                >
                  Confirm Booking
                </button>
              )}
            </div>

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

