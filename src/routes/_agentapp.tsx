import { createFileRoute, Outlet, Link, useNavigate, useRouterState, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { LatestUpdatesButton } from "@/components/LatestUpdatesButton";
import { IdleSessionGuard } from "@/components/IdleSessionGuard";

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
            ? "border-gold bg-navy/80 text-navy-foreground"
            : "border-transparent text-navy-foreground/70 hover:border-gold hover:bg-navy/80 hover:text-navy-foreground"
        }`}
      >
        <span className="w-5 text-gold">{icon}</span>
        <span>{label}</span>
      </Link>
    );
  };

  const subHeader = (label: string, icon: string, open: boolean, setOpen: (v: boolean) => void) => (
    <button
      onClick={() => setOpen(!open)}
      className="flex w-full items-center justify-between border-l-4 border-transparent bg-navy/70 px-4 py-2.5 text-left text-sm text-navy-foreground/85 hover:bg-navy/90"
    >
      <span className="flex items-center gap-3"><span className="w-5 text-gold">{icon}</span>{label}</span>
      <span className="text-xs">{open ? "▾" : "▸"}</span>
    </button>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Top navbar */}
      <header className="fixed left-0 right-0 top-0 z-20 flex h-14 items-center justify-between border-b border-border bg-card px-4 shadow-sm">
        <div className="flex items-center gap-3">
          <button className="rounded p-1 text-muted-foreground hover:bg-secondary" onClick={() => setSidebarOpen((v) => !v)}>☰</button>
          <Link to="/agent/dashboard" className="text-sm font-semibold text-navy">Dashboard</Link>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/agent/fares"
            className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-emerald-700"
          >
            ✈ Group Fares
          </Link>
          <a
            href="/"
            className="inline-flex items-center gap-1.5 rounded-md bg-gold px-3 py-1.5 text-xs font-bold text-gold-foreground shadow-sm hover:opacity-90"
          >
            🏠 Homepage
          </a>
          <LatestUpdatesButton />


          <span className="hidden text-sm text-muted-foreground md:inline">{agent?.agency_name}</span>
          <div className="relative">
            <details className="relative">
              <summary className="flex cursor-pointer list-none items-center gap-2 rounded-full border border-border bg-secondary px-2 py-1 text-sm">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gold font-bold text-gold-foreground">
                  {agent?.contact_person?.[0]?.toUpperCase() ?? "A"}
                </span>
              </summary>
              <div className="absolute right-0 mt-2 w-48 rounded-md border border-border bg-popover text-popover-foreground shadow-lg">
                <Link to="/agent/profile" className="block px-4 py-2 text-sm hover:bg-secondary">My Profile</Link>
                <Link to="/agent/change-password" className="block px-4 py-2 text-sm hover:bg-secondary">Change Password</Link>
                <button onClick={signOut} className="block w-full px-4 py-2 text-left text-sm text-destructive hover:bg-secondary">Sign out</button>
              </div>
            </details>
          </div>
        </div>
      </header>

      {/* Sidebar */}
      <aside className={`fixed left-0 top-14 z-10 h-[calc(100vh-3.5rem)] w-60 overflow-y-auto bg-navy text-navy-foreground transition-transform md:translate-x-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="border-b border-white/10 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gold font-bold text-gold-foreground">
              {agent?.contact_person?.[0]?.toUpperCase() ?? "A"}
            </div>
            <div>
              <p className="text-sm font-semibold">{agent?.agency_name ?? agent?.contact_person ?? "Agent"}</p>
              <p className="text-xs text-emerald-400">● Online</p>
            </div>
          </div>
        </div>

        <div className="py-2 text-xs uppercase tracking-wider text-gold/80 px-4">Main Navigation</div>

        <nav className="space-y-0.5">
          <a href="/" className="flex items-center gap-3 border-l-4 border-gold bg-navy/60 px-4 py-2.5 text-sm font-semibold text-navy-foreground hover:bg-navy/90">
            <span className="w-5 text-gold">🏠</span> Homepage
          </a>
          {navItem("/agent/dashboard", "Dashboard", "◉")}

          {subHeader("Airline Booking", "✈", airlineOpen, setAirlineOpen)}
          {airlineOpen && (
            <div className="bg-navy/70">
              {navItem("/agent/fares", "Group Fares", "•")}
              {navItem("/agent/bookings", "All Group Bookings", "•")}
            </div>
          )}

          {subHeader("Package Bookings", "🕋", packageOpen, setPackageOpen)}
          {packageOpen && (
            <div className="bg-navy/70">
              <div className="px-4 py-2.5 text-sm text-navy-foreground/50">Coming soon</div>
            </div>
          )}

          {subHeader("Accounts", "💰", acctOpen, setAcctOpen)}
          {acctOpen && (
            <div className="bg-navy/70">
              {navItem("/agent/ledger", "Ledger", "•")}
              <div className="px-4 py-2.5 text-sm text-navy-foreground/50">Add Payments — coming soon</div>
              <div className="px-4 py-2.5 text-sm text-navy-foreground/50">Bank Details — coming soon</div>
            </div>
          )}

          {navItem("/agent/profile", "My-Profile", "👤")}
          {navItem("/agent/change-password", "Change Password", "🔑")}
          {isAdmin && (
            <>
              <div className="mt-4 px-4 py-2 text-xs uppercase tracking-wider text-gold">Admin</div>
              {navItem("/agent/admin", "Manage Agents", "★")}
            </>
          )}
        </nav>
      </aside>

      {/* Content */}
      <main className="ml-0 pt-14 md:ml-60">
        <Outlet />
      </main>

      <IdleSessionGuard portalName="Agent B2B Portal" onLogout={signOut} />

      {/* Latest Updates notification is mounted globally in __root via <GlobalAnnouncement /> */}
    </div>
  );
}
