import { useEffect, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

/**
 * The B2B agent portal sidebar. Shared by the `_agentapp` layout and the
 * Print Tickets page so agents keep the same dashboard navigation everywhere.
 * Never renders admin navigation.
 */
export function AgentSidebarNav({
  open,
  agencyName,
  contactPerson,
  onNavigate,
}: {
  open: boolean;
  agencyName?: string | null;
  contactPerson?: string | null;
  onNavigate?: () => void;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [airlineOpen, setAirlineOpen] = useState(true);
  const [packageOpen, setPackageOpen] = useState(false);
  const [acctOpen, setAcctOpen] = useState(false);
  const [fallback, setFallback] = useState<{ agency_name: string; contact_person: string } | null>(null);

  useEffect(() => {
    if (agencyName) return;
    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      const uid = sess.session?.user?.id;
      if (!uid) return;
      const { data } = await supabase
        .from("agents")
        .select("agency_name, contact_person")
        .eq("user_id", uid)
        .maybeSingle();
      if (data) setFallback(data as { agency_name: string; contact_person: string });
    })();
  }, [agencyName]);

  const agency = agencyName ?? fallback?.agency_name ?? "Agent";
  const person = contactPerson ?? fallback?.contact_person ?? "A";

  const navItem = (to: string, label: string, icon: string) => {
    const active = pathname === to;
    return (
      <Link
        to={to}
        onClick={onNavigate}
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

  const subHeader = (label: string, icon: string, isOpen: boolean, setOpen: (v: boolean) => void) => (
    <button
      onClick={() => setOpen(!isOpen)}
      className="flex w-full items-center justify-between border-l-4 border-transparent bg-navy/70 px-4 py-2.5 text-left text-sm text-navy-foreground/85 hover:bg-navy/90"
    >
      <span className="flex items-center gap-3"><span className="w-5 text-gold">{icon}</span>{label}</span>
      <span className="text-xs">{isOpen ? "▾" : "▸"}</span>
    </button>
  );

  const printActive = pathname === "/print-format";

  return (
    <aside
      className={`fixed left-0 top-14 z-10 h-[calc(100vh-3.5rem)] w-60 overflow-y-auto bg-navy text-navy-foreground transition-transform md:translate-x-0 print:hidden ${
        open ? "translate-x-0" : "-translate-x-full"
      }`}
    >
      <div className="border-b border-white/10 p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gold font-bold text-gold-foreground">
            {person?.[0]?.toUpperCase() ?? "A"}
          </div>
          <div>
            <p className="text-sm font-semibold">{agency}</p>
            <p className="text-xs text-emerald-400">● Online</p>
          </div>
        </div>
      </div>

      <div className="px-4 py-2 text-xs uppercase tracking-wider text-gold/80">Main Navigation</div>

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
            <Link
              to="/print-format"
              search={{ portal: "agent" }}
              onClick={onNavigate}
              className={`flex items-center gap-3 border-l-4 px-4 py-2.5 text-sm transition ${
                printActive
                  ? "border-gold bg-navy/80 text-navy-foreground"
                  : "border-transparent text-navy-foreground/70 hover:border-gold hover:bg-navy/80 hover:text-navy-foreground"
              }`}
            >
              <span className="w-5 text-gold">•</span> Print Tickets
            </Link>
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
      </nav>
    </aside>
  );
}
