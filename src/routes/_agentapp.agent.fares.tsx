import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AirlineLogo } from "@/routes/index";

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

function FaresPage() {
  const [fares, setFares] = useState<Fare[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [origin, setOrigin] = useState("ALL");
  const [destination, setDestination] = useState("ALL");
  const [booking, setBooking] = useState<Fare | null>(null);

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
  }, []);

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

  return (
    <div className="p-4 md:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-gray-800">Group Fares</h1>
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter by airline, city, flight #…"
          className="w-64 rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
      </div>

      {/* Origin filter tabs */}
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

      {/* Destination filter tabs */}
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
            <section key={sector} className="rounded-lg bg-amber-50/40 p-3 shadow-sm">
              <div className="mb-2 flex items-center justify-center gap-3">
                <h2 className="text-lg font-bold tracking-wider text-gray-800">{sector}</h2>
                <span className="text-xl">✈</span>
              </div>

              <div className="overflow-x-auto rounded-md border border-gray-200 bg-white">
                <table className="min-w-full text-sm">
                  <thead className="bg-[#0b1220] text-white">
                    <tr>
                      {["AIRLINE","LOGO","FROM","TO","FLIGHT DETAILS","LUGGAGE","MEAL","SEATS","FARE","URDU","COMM","","",""].map((h,i) => (
                        <th key={i} className="whitespace-nowrap px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((f) => {
                      const details = f.flight_details
                        ?? `${f.flight_date} ${f.origin_code} ${f.destination_code}${f.depart_time ? ` ${f.depart_time}` : ""}${f.arrive_time ? ` ${f.arrive_time}` : ""}${f.flight_number ? ` ${f.flight_number}` : ""}`;
                      return (
                        <tr key={f.id} className="border-t border-gray-100 align-middle">
                          <td className="px-3 py-3 font-semibold text-gray-800">{f.airline}</td>
                          <td className="px-3 py-3"><AirlineLogo name={f.airline} height={28} /></td>
                          <td className="px-3 py-3">
                            <div className="font-bold text-gray-800">{f.origin.toUpperCase()}</div>
                            <div className="text-[11px] text-gray-500">{f.origin_code}</div>
                          </td>
                          <td className="px-3 py-3">
                            <div className="font-bold text-gray-800">{f.destination.toUpperCase()}</div>
                            <div className="text-[11px] text-gray-500">{f.destination_code}</div>
                          </td>
                          <td className="px-3 py-3 font-mono text-[12px] text-gray-700">{details}</td>
                          <td className="px-3 py-3 text-gray-700">{f.baggage ?? "—"}</td>
                          <td className="px-3 py-3 text-gray-700">{f.meal ?? "—"}</td>
                          <td className="px-3 py-3 text-gray-700">{f.seats ?? "—"}</td>
                          <td className="px-3 py-3 font-bold text-orange-600">{f.price_text}</td>
                          <td dir="rtl" className="px-3 py-3 text-gray-700">{urduRoute(f.origin, f.destination)}</td>
                          <td className="px-3 py-3 text-gray-500">—</td>
                          <td className="px-3 py-3">
                            <button
                              onClick={() => {
                                const line = `${f.airline} ${f.flight_number ?? ""} ${f.origin_code}-${f.destination_code} ${f.flight_date} ${f.depart_time ?? ""} ${f.price_text}`;
                                navigator.clipboard.writeText(line.trim());
                              }}
                              className="inline-flex items-center gap-1 rounded border border-gray-300 bg-white px-2.5 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                            >
                              📋 Copy
                            </button>
                          </td>
                          <td className="px-3 py-3">
                            <button
                              onClick={() => setBooking(f)}
                              className="rounded bg-sky-500 px-4 py-1.5 text-xs font-bold text-white hover:bg-sky-600"
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
  return `${f} ← ${t}`;
}

function BookingModal({ fare, onClose }: { fare: Fare; onClose: () => void }) {
  const [seats, setSeats] = useState(1);
  const [names, setNames] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const { data: sess } = await supabase.auth.getSession();
    const uid = sess.session!.user.id;
    const { error } = await supabase.from("agent_bookings").insert({
      agent_user_id: uid,
      fare_id: fare.id,
      fare_snapshot: fare,
      seats,
      passenger_names: names,
      contact_phone: phone,
      notes,
    });
    setBusy(false);
    if (error) return setMsg(error.message);
    setMsg("Booking submitted!");
    setTimeout(onClose, 1200);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-lg bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b px-5 py-3">
          <h3 className="font-semibold text-gray-800">Book: {fare.airline} — {fare.origin_code}-{fare.destination_code}</h3>
          <button onClick={onClose} className="text-2xl leading-none text-gray-500 hover:text-gray-800">×</button>
        </div>
        <form onSubmit={submit} className="space-y-4 p-5">
          <div className="rounded-md bg-blue-50 p-3 text-xs text-gray-700">
            <p><b>Date:</b> {fare.flight_date}</p>
            <p><b>Flight:</b> {fare.flight_number ?? "—"} • {fare.depart_time ?? "—"} → {fare.arrive_time ?? "—"}</p>
            <p><b>Fare:</b> {fare.price_text} • <b>Bag:</b> {fare.baggage ?? "—"}</p>
          </div>
          <div>
            <label className="text-sm font-medium">Seats</label>
            <input type="number" min={1} max={20} value={seats} onChange={(e) => setSeats(Number(e.target.value))}
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-sm font-medium">Passenger Names (one per line)</label>
            <textarea required value={names} onChange={(e) => setNames(e.target.value)} rows={3}
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm" placeholder="MR JOHN DOE / MRS JANE DOE" />
          </div>
          <div>
            <label className="text-sm font-medium">Contact Phone</label>
            <input required value={phone} onChange={(e) => setPhone(e.target.value)}
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm" placeholder="+92 300 0000000" />
          </div>
          <div>
            <label className="text-sm font-medium">Notes (optional)</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm" />
          </div>
          {msg && <p className="text-sm text-blue-700">{msg}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="rounded-md border px-4 py-2 text-sm">Cancel</button>
            <button disabled={busy} className="rounded-md bg-orange-500 px-4 py-2 text-sm font-bold text-white hover:bg-orange-600 disabled:opacity-50">
              {busy ? "Submitting…" : "Confirm Booking"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
