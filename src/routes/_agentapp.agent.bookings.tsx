import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_agentapp/agent/bookings")({
  ssr: false,
  component: BookingsPage,
});

type Booking = {
  id: string;
  fare_snapshot: any;
  seats: number;
  passenger_names: string;
  contact_phone: string;
  status: string;
  notes: string | null;
  created_at: string;
};

function BookingsPage() {
  const [rows, setRows] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      const uid = sess.session!.user.id;
      const { data } = await supabase.from("agent_bookings")
        .select("id,fare_snapshot,seats,passenger_names,contact_phone,status,notes,created_at")
        .eq("agent_user_id", uid)
        .order("created_at", { ascending: false });
      setRows((data ?? []) as Booking[]);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="p-4 md:p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-800">All Group Bookings</h1>
        <Link to="/agent/fares" className="rounded-md bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600">+ New Booking</Link>
      </div>

      <div className="overflow-hidden rounded-lg border bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-[#1e3a5f] text-white">
            <tr>
              <th className="px-3 py-2.5 text-left">Date</th>
              <th className="px-3 py-2.5 text-left">Sector</th>
              <th className="px-3 py-2.5 text-left">Airline / Flight</th>
              <th className="px-3 py-2.5 text-left">Seats</th>
              <th className="px-3 py-2.5 text-left">Passengers</th>
              <th className="px-3 py-2.5 text-left">Contact</th>
              <th className="px-3 py-2.5 text-left">Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="p-6 text-center text-gray-500">Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={7} className="p-6 text-center text-gray-500">No bookings yet. <Link to="/agent/fares" className="text-orange-600 underline">Browse fares →</Link></td></tr>
            ) : rows.map((b, i) => {
              const f = b.fare_snapshot ?? {};
              return (
                <tr key={b.id} className={i % 2 ? "bg-blue-50/40" : "bg-white"}>
                  <td className="px-3 py-3 whitespace-nowrap">{f.flight_date ?? "—"}</td>
                  <td className="px-3 py-3">{f.origin_code}-{f.destination_code}</td>
                  <td className="px-3 py-3">{f.airline} {f.flight_number ?? ""}</td>
                  <td className="px-3 py-3">{b.seats}</td>
                  <td className="px-3 py-3 whitespace-pre-line text-xs">{b.passenger_names}</td>
                  <td className="px-3 py-3">{b.contact_phone}</td>
                  <td className="px-3 py-3">
                    <span className={`rounded px-2 py-1 text-xs font-semibold ${
                      b.status === "confirmed" ? "bg-emerald-100 text-emerald-700" :
                      b.status === "cancelled" ? "bg-red-100 text-red-700" :
                      "bg-amber-100 text-amber-700"
                    }`}>{b.status}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
