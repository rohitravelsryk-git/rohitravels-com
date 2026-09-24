import { useEffect, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Plane, LayoutDashboard, ClipboardList, Printer, BookOpen, UserCog, KeyRound, LogOut, Home, Lock, Landmark, Building2, Bell, FileEdit, Menu, X, Calculator } from "lucide-react";
import { LatestUpdatesButton } from "@/components/LatestUpdatesButton";

/**
 * Shared B2B Agent Portal top bar. Renders the FULL agent menu as header tabs
 * laid out exactly like the Admin Panel header (brand block + action buttons,
 * then a wrapping icon tab row with a gold underline for the active tab).
 * Never renders admin navigation or an admin login button.
 *
 * To add a future agent tab: append one entry to TABS — it inherits the same
 * navy/gold colors, typography and layout automatically.
 */
const TABS: {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  search?: Record<string, string>;
  external?: boolean;
}[] = [
  { to: "/agent/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/agent/fares", label: "Group Fares", icon: Plane },
  { to: "/agent/services", label: "Services", icon: ClipboardList },
  { to: "/agent/sticky-notes", label: "Sticky Notes", icon: Lock },
  { to: "/agent/bank-details", label: "Bank Details", icon: Landmark },
  { to: "/agent/bookings", label: "All Group Bookings", icon: ClipboardList },
  { to: "/print-format", label: "Print Tickets", icon: Printer, search: { portal: "agent" } },
  { to: "/pdf-tools", label: "PDF Tools", icon: FileEdit, search: { portal: "agent" }, external: true },
  { to: "/agent/calculators", label: "Calculators", icon: Calculator },
  { to: "/agent/ledger", label: "Ledger", icon: BookOpen },
  { to: "/agent/profile", label: "My Profile", icon: UserCog },
  { to: "/agent/change-password", label: "Change Password", icon: KeyRound },
  { to: "/agent/latest-updates", label: "Latest Updates", icon: Bell },
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
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => { setMobileOpen(false); }, [pathname]);
  useEffect(() => {
    if (!mobileOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setMobileOpen(false); };
    document.addEventListener("keydown", closeOnEscape);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  const tabs = (mobile = false) => TABS.map((t) => {
    const active = pathname === t.to;
    const Icon = t.icon;
    return (
      <div key={t.to} className={`flex items-center border-b-2 transition-all duration-[var(--duration-base)] ease-[var(--ease-premium)] ${mobile ? "rounded-md" : "rounded-t-md"} ${active ? "border-gold bg-white/5 text-gold" : "border-transparent text-white/60 hover:text-white"}`}>
        <Link
          to={t.to}
          {...(t.search ? { search: t.search as never } : {})}
          target={t.external ? "_blank" : undefined}
          rel={t.external ? "noopener noreferrer" : undefined}
          className={`flex min-h-11 items-center text-xs font-bold uppercase tracking-widest ${mobile ? "w-full px-4 py-3" : "px-3 py-2"}`}
        >
          <Icon className="mr-2 h-4 w-4 shrink-0" />
          {t.label}
        </Link>
      </div>
    );
  });

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-navy text-navy-foreground print:hidden">
      {/* Brand row — mirrors the Admin Panel header */}
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={() => { setMobileOpen(true); onToggleSidebar?.(); }}
            className="inline-flex h-11 w-11 items-center justify-center rounded-md text-navy-foreground/80 hover:bg-white/10 lg:hidden"
            aria-label="Open agent navigation"
            aria-expanded={mobileOpen}
          >
            <Menu className="h-5 w-5" />
          </button>
          <Plane className="h-5 w-5 -rotate-45 text-gold" />
          <Link to="/agent/dashboard" className="min-w-0">
            <p className="font-serif text-lg font-black leading-none">B2B Agent Portal</p>
            <p className="mt-1 text-[10px] tracking-widest text-white/60">Rohi International Travels</p>
          </Link>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <LatestUpdatesButton tone="dark" to="/agent/latest-updates" />
          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md border border-white/20 px-2.5 py-2 text-xs font-semibold transition-all duration-[var(--duration-base)] ease-[var(--ease-premium)] hover:bg-white/10"
          >
            <Home className="h-3.5 w-3.5" /> View site
          </a>

          {agencyName && (
            <span
              className="hidden max-w-[240px] items-center gap-1.5 truncate rounded-full border border-gold/40 bg-white/[0.06] px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-gold lg:inline-flex"
              title={agencyName}
            >
              <Building2 className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{agencyName}</span>
            </span>
          )}
          {onSignOut && (
            <button
              onClick={onSignOut}
              className="inline-flex items-center gap-2 rounded-md bg-gold px-2.5 py-2 text-xs font-bold text-gold-foreground transition-all duration-[var(--duration-base)] ease-[var(--ease-premium)] hover:opacity-90"
            >
              <LogOut className="h-3.5 w-3.5" /> Logout
            </button>
          )}
        </div>
      </div>

      {/* Tab row */}
      <nav aria-label="Agent portal" className="mx-auto hidden max-w-[1600px] flex-wrap gap-1 px-4 lg:flex">
        {tabs()}
      </nav>

      <div className={`fixed inset-0 z-50 lg:hidden ${mobileOpen ? "pointer-events-auto" : "pointer-events-none"}`} aria-hidden={!mobileOpen}>
        <button type="button" aria-label="Close agent navigation" onClick={() => setMobileOpen(false)} className={`absolute inset-0 bg-navy/60 backdrop-blur-sm transition-opacity ${mobileOpen ? "opacity-100" : "opacity-0"}`} />
        <aside className={`absolute inset-y-0 left-0 flex w-[min(88vw,340px)] flex-col bg-navy shadow-xl transition-transform duration-300 ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`} aria-label="Agent portal navigation">
          <div className="flex min-h-16 items-center justify-between border-b border-white/10 px-4">
            <span className="font-serif text-base font-black text-white">Agent Menu</span>
            <button type="button" onClick={() => setMobileOpen(false)} className="inline-flex h-11 w-11 items-center justify-center rounded-md text-white/80 hover:bg-white/10" aria-label="Close menu"><X className="h-5 w-5" /></button>
          </div>
          <nav className="flex-1 space-y-1 overflow-y-auto p-3" aria-label="Mobile agent portal">{tabs(true)}</nav>
        </aside>
      </div>
    </header>
  );
}
