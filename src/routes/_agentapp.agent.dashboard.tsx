import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_agentapp/agent/dashboard")({
  ssr: false,
  component: Dashboard,
});

type AgentRow = {
  agency_name: string;
  email: string;
  contact_person: string;
  cell_number: string;
  country_code: string;
  city: string;
  country: string;
};

type RecentBooking = {
  id: string;
  pnr: string;
  status: string;
  ticket_status: string;
  created_at: string;
  airline_name?: string;
};

function Dashboard() {
  const [agent, setAgent] = useState<AgentRow | null>(null);
  const [counts, setCounts] = useState({ bookings: 0 });
  const [recentBookings, setRecentBookings] = useState<RecentBooking[]>([]);
  const [loadingBookings, setLoadingBookings] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) return;
      const uid = sess.session.user.id;

      // Fetch agent profile
      const { data: agentData } = await supabase
        .from("agents")
        .select("*")
        .eq("user_id", uid)
        .maybeSingle();
      setAgent(agentData as AgentRow | null);

      // Total bookings count
      const { count } = await supabase
        .from("agent_bookings")
        .select("*", { count: "exact", head: true })
        .eq("agent_user_id", uid);
      setCounts({ bookings: count ?? 0 });

      // Recent Bookings (Submitted, On Hold, Pending)
      setLoadingBookings(true);
      console.log("Fetching recent bookings for user:", uid);
      
      const { data: bookingsData, error } = await supabase
        .from("agent_bookings")
        .select("id, pnr, status, created_at, airline_name, ticket_status")
        .eq("agent_user_id", uid)
        .or('ticket_status.ilike.submitted,ticket_status.ilike.on hold,ticket_status.ilike.pending,ticket_status.ilike.onhold,status.ilike.submitted,status.ilike.on hold,status.ilike.pending')
        .order("created_at", { ascending: false })
        .limit(10);
      
      if (error) {
        console.error("Error fetching recent bookings:", error);
      } else {
        console.log("Found bookings for dashboard:", bookingsData?.length, bookingsData);
      }
      
      setRecentBookings((bookingsData as RecentBooking[]) || []);
      setLoadingBookings(false);
    })();
  }, []);

  return (
    <div className="p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold text-gray-800">
          {agent?.agency_name ?? "…"}
        </h1>
        <nav className="text-sm text-gray-500">
          <Link to="/agent/dashboard" className="hover:text-blue-600 transition-colors">
            Home
          </Link>{" "}
          /{" "}
          <Link to="/agent/profile" className="text-blue-600 hover:text-blue-800 transition-colors">
            Profile
          </Link>
        </nav>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard
          color="from-cyan-500 to-cyan-600"
          title="All Group Bookings"
          subtitle="My Group Bookings"
          href="/agent/bookings"
          count={counts.bookings}
        />
        <StatCard
          color="from-emerald-500 to-emerald-600"
          title="Group Fares"
          subtitle="Live Live Fares"
          href="/agent/fares"
          count={null}
        />
        <StatCard
          color="from-gray-700 to-gray-800"
          title="Ledger"
          subtitle="Account Balance"
          href="/agent/ledger"
          count={null}
        />
      </div>

      <div className="mt-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-navy">Recent Booking Updates</h2>
          <Link to="/agent/bookings" className="text-xs font-semibold text-blue-600 hover:underline">
            View All
          </Link>
        </div>
        
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          {loadingBookings ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Loading recent bookings...</div>
          ) : recentBookings.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted/50 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">PNR</th>
                    <th className="px-4 py-3">Airline</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {recentBookings.map((b) => (
                    <tr key={b.id} className="hover:bg-muted/30">
                      <td className="px-4 py-3 font-mono font-bold text-navy">{b.pnr || "—"}</td>
                      <td className="px-4 py-3 font-semibold">{b.airline_name || "—"}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                          (b.ticket_status || b.status)?.toLowerCase().includes("hold") ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"
                        }`}>
                          {b.ticket_status || b.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-muted-foreground">
                        {new Date(b.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-8 text-center text-sm text-muted-foreground italic">
              No recent "Submitted" or "On Hold" bookings found.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  color,
  title,
  subtitle,
  href,
  count,
}: {
  color: string;
  title: string;
  subtitle: string;
  href: string;
  count: number | null;
}) {
  return (
    <Link
      to={href as any}
      className={`block rounded-md bg-gradient-to-r ${color} p-5 text-white shadow transition hover:opacity-95`}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-2xl font-bold">{title}</p>
          <p className="mt-1 text-sm opacity-90">{subtitle}</p>
          {count !== null && <p className="mt-2 text-3xl font-black">{count}</p>}
        </div>
        <div className="text-5xl opacity-40">✈</div>
      </div>
      <p className="mt-4 border-t border-white/30 pt-2 text-sm">Go to list ➜</p>
    </Link>
  );
}
