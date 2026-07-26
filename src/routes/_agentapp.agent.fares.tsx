import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

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
};

function FaresPage() {
  const [fares, setFares] = useState<Fare[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [category, setCategory] = useState("ALL");
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

  const categories = useMemo(() => Array.from(new Set(fares.map((f) => f.category))).sort(), [fares]);

  const filtered = useMemo(() => fares.filter((f) => {
    if (category !== "ALL" && f.category !== category) return false;
    if (!filter) return true;
    const q = filter.toLowerCase();
    return [f.origin, f.destination, f.airline, f.origin_code, f.destination_code, f.flight_number]
      .some((v) => v?.toLowerCase().includes(q));
  }), [fares, filter, category]);

  const grouped = useMemo(() => {
    const map = new Map<string, Fare[]>();
    for (const f of filtered) {
      const key = `${f.airline}|${f.origin_code}-${f.destination_code}`;
      const arr = map.get(key) ?? [];
      arr.push(f);
      map.set(key, arr);
    }
    return Array.from(map.entries());
  }, [filtered]);

  return (
    <div className="p-4 md:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-gray-800">Group Fares</h1>
        <div className="flex flex-wrap items-center gap-2">
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="rounded-md border border-gray-300 px-3 py-2 text-sm">
            <option value="ALL">All Sectors</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter by airline, city, flight #…"
            className="w-64 rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div className="mb-3 inline-flex rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white">
        Filters
      </div>

      {loading ? (
        <p className="text-gray-500">Loading fares…</p>
      ) : grouped.length === 0 ? (
        <p className="text-gray-500">No fares match your filter.</p>
      ) : (
        <div className="space-y-6">
          {grouped.map(([key, rows], idx) => {
            const first = rows[0];
            return (
              <div key={key} className="overflow-hidden rounded-lg border bg-white shadow-sm">
                <div className="grid grid-cols-3 items-center border-b bg-gray-50 px-4 py-3">
                  <div className="text-sm font-semibold text-blue-700">{first.airline}</div>
                  <div className="text-center text-xl">✈</div>
                  <div className="text-right text-sm font-bold text-gray-800">
                    {first.origin.toUpperCase()}-{first.destination.toUpperCase()}
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-[#1e3a5f] text-white">
                      <tr>
                        {["Date", "Sector", "Flight", "Time", "Bag", "Meal", "Seats", "Fare", "Book Now"].map((h) => (
                          <th key={h} className="px-3 py-2.5 text-left font-semibold">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((f, i) => (
                        <tr key={f.id} className={i % 2 ? "bg-blue-50/40" : "bg-white"}>
                          <td className="px-3 py-3 text-gray-700 whitespace-nowrap">✈ {f.flight_date}</td>
                          <td className="px-3 py-3 text-gray-700 whitespace-nowrap">{f.origin.toUpperCase()}-{f.destination.toUpperCase()}</td>
                          <td className="px-3 py-3 font-medium text-gray-800">{f.flight_number ?? "—"}</td>
                          <td className="px-3 py-3 text-gray-700 whitespace-nowrap">
                            {f.depart_time ?? "—"} {f.arrive_time ? `- ${f.arrive_time}` : ""}
                          </td>
                          <td className="px-3 py-3 text-gray-700">{f.baggage ?? "—"}</td>
                          <td className="px-3 py-3 font-semibold text-red-600">NO</td>
                          <td className="px-3 py-3 text-gray-700">{2 + (i % 3)}</td>
                          <td className="px-3 py-3 font-semibold text-gray-800">{f.price_text}</td>
                          <td className="px-3 py-3">
                            <div className="flex flex-col gap-1">
                              <button
                                onClick={() => {
                                  const line = `${f.airline} ${f.flight_number ?? ""} ${f.origin_code}-${f.destination_code} ${f.flight_date} ${f.depart_time ?? ""} ${f.price_text}`;
                                  navigator.clipboard.writeText(line);
                                }}
                                className="rounded bg-emerald-500 px-3 py-1 text-xs font-bold text-white hover:bg-emerald-600"
                              >
                                📋 Copy
                              </button>
                              <span className="text-center text-[10px] text-gray-500">(AG# {(idx * 10) + i + 1})</span>
                              <button
                                onClick={() => setBooking(f)}
                                className="rounded bg-orange-500 px-3 py-1 text-xs font-bold text-white hover:bg-orange-600"
                              >
                                Book Now
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {booking && <BookingModal fare={booking} onClose={() => setBooking(null)} />}
    </div>
  );
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
