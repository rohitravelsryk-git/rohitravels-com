import { createFileRoute, Outlet, Link, useNavigate, useRouterState, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type AgentRow = {
  user_id: string;
  agency_name: string;
  contact_person: string;
  email: string;
  city: string;
  cell_number: string;
  country_code: string;
  status: "pending" | "approved" | "rejected";
};

export const Route = createFileRoute("/_agentapp")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/agent/login" });
  },
  component: AgentLayout,
});

function AgentLayout() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [agent, setAgent] = useState<AgentRow | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [airlineOpen, setAirlineOpen] = useState(true);
  const [packageOpen, setPackageOpen] = useState(false);
  const [acctOpen, setAcctOpen] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) return navigate({ to: "/agent/login" });
      const uid = sess.session.user.id;
      const [{ data: a }, { data: roles }] = await Promise.all([
        supabase.from("agents").select("*").eq("user_id", uid).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", uid).eq("role", "admin"),
      ]);
      setAgent(a as AgentRow | null);
      setIsAdmin((roles ?? []).length > 0);
      setLoading(false);
    })();
  }, [navigate]);

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/agent/login" });
  }

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-gray-100 text-gray-500">Loading portal…</div>;
  }

  if (agent && agent.status !== "approved" && !isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-100 px-4">
        <div className="max-w-md rounded-lg border bg-white p-8 text-center shadow">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 text-3xl">⏳</div>
          <h1 className="text-xl font-bold text-gray-800">Awaiting Admin Approval</h1>
          <p className="mt-2 text-sm text-gray-600">
            Thanks for registering <b>{agent.agency_name}</b>. Your account is pending approval. You'll be able to sign in and access the portal once an admin approves your agency.
          </p>
          <button onClick={signOut} className="mt-6 rounded-md bg-gray-800 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700">Sign out</button>
        </div>
      </div>
    );
  }

  const navItem = (to: string, label: string, icon: string) => {
    const active = pathname === to;
    return (
      <Link
        to={to}
        onClick={() => setSidebarOpen(false)}
        className={`flex items-center gap-3 border-l-4 px-4 py-2.5 text-sm transition ${
          active
            ? "border-orange-400 bg-[#1f2d3d] text-white"
            : "border-transparent text-gray-300 hover:border-orange-400 hover:bg-[#1f2d3d] hover:text-white"
        }`}
      >
        <span className="w-5 text-orange-400">{icon}</span>
        <span>{label}</span>
      </Link>
    );
  };

  const subHeader = (label: string, icon: string, open: boolean, setOpen: (v: boolean) => void) => (
    <button
      onClick={() => setOpen(!open)}
      className="flex w-full items-center justify-between border-l-4 border-transparent bg-[#232f3e] px-4 py-2.5 text-left text-sm text-gray-200 hover:bg-[#1f2d3d]"
    >
      <span className="flex items-center gap-3"><span className="w-5 text-orange-400">{icon}</span>{label}</span>
      <span className="text-xs">{open ? "▾" : "▸"}</span>
    </button>
  );

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Top navbar */}
      <header className="fixed left-0 right-0 top-0 z-20 flex h-14 items-center justify-between border-b bg-white px-4 shadow-sm">
        <div className="flex items-center gap-3">
          <button className="rounded p-1 text-gray-600 hover:bg-gray-100" onClick={() => setSidebarOpen((v) => !v)}>☰</button>
          <Link to="/agent/dashboard" className="text-sm font-semibold text-gray-700">Home</Link>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden text-sm text-gray-600 md:inline">{agent?.agency_name}</span>
          <div className="relative">
            <details className="relative">
              <summary className="flex cursor-pointer list-none items-center gap-2 rounded-full border bg-gray-50 px-2 py-1 text-sm">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-orange-500 font-bold text-white">
                  {agent?.contact_person?.[0]?.toUpperCase() ?? "A"}
                </span>
              </summary>
              <div className="absolute right-0 mt-2 w-48 rounded-md border bg-white shadow-lg">
                <Link to="/agent/profile" className="block px-4 py-2 text-sm hover:bg-gray-100">My Profile</Link>
                <Link to="/agent/change-password" className="block px-4 py-2 text-sm hover:bg-gray-100">Change Password</Link>
                <button onClick={signOut} className="block w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-gray-100">Sign out</button>
              </div>
            </details>
          </div>
        </div>
      </header>

      {/* Sidebar */}
      <aside className={`fixed left-0 top-14 z-10 h-[calc(100vh-3.5rem)] w-60 overflow-y-auto bg-[#222d32] text-white transition-transform md:translate-x-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="border-b border-white/10 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-500 font-bold">
              {agent?.contact_person?.[0]?.toUpperCase() ?? "A"}
            </div>
            <div>
              <p className="text-sm font-semibold">{agent?.contact_person ?? "Agent"}</p>
              <p className="text-xs text-emerald-400">● Online</p>
            </div>
          </div>
        </div>

        <div className="py-2 text-xs uppercase tracking-wider text-gray-400 px-4">Main Navigation</div>

        <nav className="space-y-0.5">
          <a href="/" className="flex items-center gap-3 border-l-4 border-transparent px-4 py-2.5 text-sm text-gray-300 hover:border-orange-400 hover:bg-[#1f2d3d] hover:text-white">
            <span className="w-5 text-orange-400">↩</span> Go Back To Main Site
          </a>
          {navItem("/agent/dashboard", "Dashboard", "◉")}

          {subHeader("Airline Booking", "✈", airlineOpen, setAirlineOpen)}
          {airlineOpen && (
            <div className="bg-[#2c3b41]">
              {navItem("/agent/fares", "Group Fares", "•")}
              {navItem("/agent/bookings", "All Group Bookings", "•")}
            </div>
          )}

          {subHeader("Package Bookings", "🕋", packageOpen, setPackageOpen)}
          {packageOpen && (
            <div className="bg-[#2c3b41]">
              <div className="px-4 py-2.5 text-sm text-gray-400">Coming soon</div>
            </div>
          )}

          {subHeader("Accounts", "💰", acctOpen, setAcctOpen)}
          {acctOpen && (
            <div className="bg-[#2c3b41]">
              <div className="px-4 py-2.5 text-sm text-gray-400">Ledger — coming soon</div>
              <div className="px-4 py-2.5 text-sm text-gray-400">Add Payments — coming soon</div>
              <div className="px-4 py-2.5 text-sm text-gray-400">Bank Details — coming soon</div>
            </div>
          )}

          {navItem("/agent/profile", "My-Profile", "👤")}
          {navItem("/agent/change-password", "Change Password", "🔑")}
          {isAdmin && (
            <>
              <div className="mt-4 px-4 py-2 text-xs uppercase tracking-wider text-orange-400">Admin</div>
              {navItem("/agent/admin", "Manage Agents", "★")}
            </>
          )}
        </nav>
      </aside>

      {/* Content */}
      <main className="ml-0 pt-14 md:ml-60">
        <Outlet />
      </main>
    </div>
  );
}
