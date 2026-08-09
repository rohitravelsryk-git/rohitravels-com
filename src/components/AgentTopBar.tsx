import { Link, useRouterState } from "@tanstack/react-router";
import { LatestUpdatesButton } from "@/components/LatestUpdatesButton";

/**
 * Shared B2B Agent Portal top bar. Renders the FULL agent menu as header tabs
 * so every portal page (including Print Tickets) shows the same navigation.
 * Never renders admin navigation or an admin login button.
 *
 * To add a future agent tab: append one entry to TABS — it inherits the same
 * navy/gold colors, typography and layout automatically.
 */
const TABS: { to: string; label: string; search?: Record<string, string> }[] = [
  { to: "/agent/dashboard", label: "Dashboard" },
  { to: "/agent/fares", label: "Group Fares" },
  { to: "/agent/bookings", label: "All Group Bookings" },
  { to: "/print-format", label: "Print Tickets", search: { portal: "agent" } },
  { to: "/agent/ledger", label: "Ledger" },
  { to: "/agent/profile", label: "My Profile" },
  { to: "/agent/change-password", label: "Change Password" },
];

export function AgentTopBar({
  agencyName,
  contactPerson,
  onToggleSidebar,
  onSignOut,
}: {
  agencyName?: string | null;
  contactPerson?: string | null;
  onToggleSidebar?: () => void;
  onSignOut?: () => void;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <header className="sticky top-0 z-30 border-b border-gold/25 bg-navy text-navy-foreground shadow-sm print:hidden">
      {/* Brand row */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-3">
          {onToggleSidebar && (
            <button
              type="button"
              onClick={onToggleSidebar}
              className="rounded p-1 text-navy-foreground/80 hover:bg-white/10 md:hidden"
              aria-label="Toggle navigation"
            >
              ☰
            </button>
          )}
          <Link to="/agent/dashboard" className="min-w-0">
            <p className="font-serif text-base font-black leading-none tracking-wide">
              ROHI <span className="text-gold">INTERNATIONAL</span> TRAVELS
            </p>
            <p className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.25em] text-white/55">
              B2B Agent Portal
            </p>
          </Link>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 rounded-full border border-white/20 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-navy-foreground/85 transition hover:border-gold hover:text-gold"
          >
            🏠 Homepage
          </Link>
          <LatestUpdatesButton />
          {agencyName && (
            <span className="hidden max-w-[180px] truncate text-[11px] font-semibold text-white/70 lg:inline">
              {agencyName}
            </span>
          )}
          <details className="relative">
            <summary className="flex cursor-pointer list-none items-center gap-2 rounded-full border border-white/20 bg-white/5 px-2 py-1">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gold text-sm font-bold text-gold-foreground">
                {contactPerson?.[0]?.toUpperCase() ?? agencyName?.[0]?.toUpperCase() ?? "A"}
              </span>
            </summary>
            <div className="absolute right-0 z-40 mt-2 w-48 overflow-hidden rounded-md border border-border bg-popover text-popover-foreground shadow-lg">
              <Link to="/agent/profile" className="block px-4 py-2 text-sm hover:bg-secondary">My Profile</Link>
              <Link to="/agent/change-password" className="block px-4 py-2 text-sm hover:bg-secondary">Change Password</Link>
              {onSignOut && (
                <button
                  onClick={onSignOut}
                  className="block w-full px-4 py-2 text-left text-sm text-destructive hover:bg-secondary"
                >
                  Sign out
                </button>
              )}
            </div>
          </details>
        </div>
      </div>

      {/* Tab row */}
      <nav aria-label="Agent portal" className="flex flex-wrap items-center gap-1 border-t border-white/10 bg-navy/95 px-3 py-1.5">
        {TABS.map((t) => {
          const active = pathname === t.to;
          return (
            <Link
              key={t.to}
              to={t.to}
              {...(t.search ? { search: t.search as never } : {})}
              className={`inline-flex items-center rounded-full px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide transition ${
                active
                  ? "bg-gold text-gold-foreground shadow-sm"
                  : "text-navy-foreground/75 hover:bg-white/10 hover:text-gold"
              }`}
            >
              {t.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
