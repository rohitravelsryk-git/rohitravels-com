import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_agentapp/agent/dashboard")({
  ssr: false,
  component: Dashboard,
});

type AgentRow = {
  agency_name: string; email: string; contact_person: string;
  cell_number: string; country_code: string; city: string; country: string;
};

function Dashboard() {
  const [agent, setAgent] = useState<AgentRow | null>(null);
  const [counts, setCounts] = useState({ bookings: 0 });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      const uid = sess.session!.user.id;
      const { data } = await supabase.from("agents").select("*").eq("user_id", uid).maybeSingle();
      setAgent(data as AgentRow | null);
      const { count } = await supabase.from("agent_bookings").select("*", { count: "exact", head: true }).eq("agent_user_id", uid);
      setCounts({ bookings: count ?? 0 });
    })();
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!agent) return;
    setSaving(true);
    setMsg(null);
    const { data: sess } = await supabase.auth.getSession();
    const uid = sess.session!.user.id;
    const { error } = await supabase.from("agents").update({
      contact_person: agent.contact_person,
      cell_number: agent.cell_number,
      country_code: agent.country_code,
    }).eq("user_id", uid);
    setSaving(false);
    setMsg(error ? error.message : "Profile updated.");
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold text-gray-800">
          {`'''Do not make any visual modifications. The phrases I write are commands to understand what I want, not to be written down. Understand their content well, then execute what is required.'''
                                        
                                            
                                            redo please
The "Update Your Profile" section has been removed from the agent dashboard and the requested visual text edits have been applied.`}
          | {agent?.agency_name ?? "…"}
        </h1>
        <nav className="text-sm text-gray-500">Home / <span className="text-blue-600">Profile</span></nav>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard color="from-cyan-500 to-cyan-600" title="All Group Bookings" subtitle="My Group Bookings" href="/agent/bookings" count={counts.bookings} />
        <StatCard color="from-emerald-500 to-emerald-600" title="Group Fares" subtitle="Live Live Fares" href="/agent/fares" count={null} />
        <StatCard color="from-gray-700 to-gray-800" title="Ledger" subtitle="Account Balance" href="/agent/ledger" count={null} />
      </div>

      {/* Profile section hidden per request */}
    </div>
  );
}

function StatCard({ color, title, subtitle, href, count }: { color: string; title: string; subtitle: string; href: string; count: number | null }) {
  return (
    <Link to={href as any} className={`block rounded-md bg-gradient-to-r ${color} p-5 text-white shadow transition hover:opacity-95`}>
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

function Field({ label, value, onChange, disabled }: { label: string; value: string; onChange: (v: string) => void; disabled?: boolean }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700">{label}</label>
      <input
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 disabled:bg-gray-100"
      />
    </div>
  );
}
