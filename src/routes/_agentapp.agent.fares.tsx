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

      {booking && <BookingModal fare={booking} onClose={() => setBooking(null)} />}
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

function BookingModal({ fare, onClose }: { fare: Fare; onClose: () => void }) {
  const [seats, setSeats] = useState(1);
  const [names, setNames] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const notify = useServerFn(notifyBookingCreated);

  const priceIsNumeric = /\d/.test(fare.price_text || "");
  const details = fare.flight_details
    ?? `${fare.flight_date} ${fare.origin_code} ${fare.destination_code}${fare.depart_time ? ` ${fare.depart_time}` : ""}${fare.arrive_time ? ` ${fare.arrive_time}` : ""}${fare.flight_number ? ` ${fare.flight_number}` : ""}`;

  function onFilesPicked(e: React.ChangeEvent<HTMLInputElement>) {
    const list = Array.from(e.target.files ?? []).slice(0, 2);
    setFiles(list);
  }

  async function uploadAttachments(uid: string): Promise<{ name: string; path: string; size: number; type: string }[]> {
    const out: { name: string; path: string; size: number; type: string }[] = [];
    for (const file of files.slice(0, 2)) {
      const safe = file.name.replace(/[^\w.\-]+/g, "_");
      const path = `${uid}/${Date.now()}-${safe}`;
      const { error } = await supabase.storage.from("booking-attachments").upload(path, file, {
        upsert: false, contentType: file.type || undefined,
      });
      if (error) throw new Error(error.message);
      out.push({ name: file.name, path, size: file.size, type: file.type });
    }
    return out;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const uid = sess.session!.user.id;
      const attachments = files.length ? await uploadAttachments(uid) : [];
      const { data: inserted, error } = await supabase.from("agent_bookings").insert({
        agent_user_id: uid,
        fare_id: fare.id,
        fare_snapshot: fare,
        seats,
        passenger_names: names,
        contact_phone: phone,
        notes,
        attachments,
      } as any).select("id").single();
      if (error) throw new Error(error.message);
      const bookingId = (inserted as any)?.id as string | undefined;
      if (bookingId) { try { await notify({ data: { bookingId } }); } catch { /* ignore */ } }
      setMsg("Booking submitted! Admin has been notified.");
      setTimeout(onClose, 1400);
    } catch (err: any) {
      setMsg(err.message ?? "Failed to submit");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-xl overflow-hidden rounded-xl bg-white shadow-2xl ring-1 ring-black/5">
        <div className="flex items-center justify-between border-b bg-gradient-to-r from-navy to-[#0b1220] px-5 py-3 text-white">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-widest">Book Fare</h3>
            <p className="text-xs opacity-80">{fare.airline} · {fare.origin_code} → {fare.destination_code}</p>
          </div>
          <button onClick={onClose} className="text-2xl leading-none text-white/80 hover:text-white">×</button>
        </div>

        <form onSubmit={submit} className="space-y-4 p-5">
          {/* Fare summary card */}
          <div className="rounded-lg border border-sky-100 bg-sky-50/60 p-4 text-[13px] leading-relaxed text-gray-800">
            <p><span className="font-semibold text-gray-600">Date:</span> {fare.flight_date || "—"}</p>
            <p className="mt-1">
              <span className="font-semibold text-gray-600">Flight:</span>{" "}
              <span className="whitespace-pre-line font-mono text-[12.5px]">{details}</span>
            </p>
            <p className="mt-1">
              <span className="font-semibold text-gray-600">Fare:</span>{" "}
              {priceIsNumeric ? (
                <span className="font-black text-orange-600">{formatFare(fare.price_text)}</span>
              ) : (
                <span className="font-black uppercase text-red-600">{fare.price_text}</span>
              )}
              {" • "}
              <span className="font-semibold text-gray-600">Baggage:</span>{" "}
              <span className="font-semibold">{fare.baggage ?? "—"}</span>
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-gray-600">Seats</label>
              <input type="number" min={1} max={20} value={seats} onChange={(e) => setSeats(Number(e.target.value))}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-gray-600">Contact Phone</label>
              <input required value={phone} onChange={(e) => setPhone(e.target.value)}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" placeholder="+92 300 0000000" />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-gray-600">Passenger Names (one per line)</label>
            <textarea required value={names} onChange={(e) => setNames(e.target.value)} rows={3}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" placeholder="MR JOHN DOE&#10;MRS JANE DOE" />
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-gray-600">Notes (optional)</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-gray-600">Attachments (max 2 — passport / visa / CNIC)</label>
            <input
              type="file"
              accept="image/*,application/pdf"
              multiple
              onChange={onFilesPicked}
              className="mt-1 block w-full rounded-md border border-dashed border-gray-300 bg-gray-50 px-3 py-2 text-xs file:mr-3 file:rounded-md file:border-0 file:bg-navy file:px-3 file:py-1.5 file:text-xs file:font-bold file:uppercase file:tracking-wide file:text-navy-foreground hover:file:opacity-90"
            />
            {files.length > 0 && (
              <ul className="mt-2 space-y-1 text-[11px] text-gray-600">
                {files.map((f, i) => (
                  <li key={i} className="flex items-center justify-between rounded border border-gray-200 bg-white px-2 py-1">
                    <span className="truncate">📎 {f.name}</span>
                    <span className="text-gray-400">{Math.round(f.size / 1024)} KB</span>
                  </li>
                ))}
              </ul>
            )}
            {files.length >= 2 && (
              <p className="mt-1 text-[10.5px] font-semibold uppercase tracking-wide text-amber-700">Max 2 files reached.</p>
            )}
          </div>

          {msg && <p className="text-sm text-blue-700">{msg}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-semibold">Cancel</button>
            <button disabled={busy} className="rounded-md bg-orange-500 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-orange-600 disabled:opacity-50">
              {busy ? "Submitting…" : "Confirm Booking"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
