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

function Dashboard() {
  const [agent, setAgent] = useState<AgentRow | null>(null);
  const [counts, setCounts] = useState({ bookings: 0 });

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

      {/* Notice removed "Recent Booking Updates" section as per plan */}
      <div className="mt-12 rounded-xl border border-dashed border-navy/20 bg-muted/30 p-8 text-center">
        <p className="text-sm text-muted-foreground">
          Looking for booking updates? All statuses are now managed on the 
          <Link to="/agent/bookings" className="mx-1 font-bold text-navy underline">
            All Group Bookings
          </Link> 
          page for a smarter, unified view.
        </p>
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
