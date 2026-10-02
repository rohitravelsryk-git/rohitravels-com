import { useEffect, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  Plane, LayoutDashboard, ClipboardList, Printer, BookOpen, UserCog, KeyRound, LogOut,
  Home, Lock, Landmark, Building2, Bell, FileEdit, Menu, X, Calculator, ChevronDown,
} from "lucide-react";
import { LatestUpdatesButton } from "@/components/LatestUpdatesButton";

const TABS: {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  search?: Record<string, string>;
  external?: boolean;
  group: "workspace" | "travel" | "account";
}[] = [
  { to: "/agent/dashboard", label: "Dashboard", icon: LayoutDashboard, group: "workspace" },
  { to: "/agent/fares", label: "Group Fares", icon: Plane, group: "travel" },
  { to: "/agent/services", label: "Services", icon: ClipboardList, group: "travel" },
  { to: "/agent/sticky-notes", label: "Sticky Notes", icon: Lock, group: "workspace" },
  { to: "/agent/bank-details", label: "Bank Details", icon: Landmark, group: "account" },
  { to: "/agent/bookings", label: "All Group Bookings", icon: ClipboardList, group: "travel" },
  { to: "/print-format", label: "Print Tickets", icon: Printer, search: { portal: "agent" }, group: "travel" },
  { to: "/pdf-tools", label: "PDF Tools", icon: FileEdit, search: { portal: "agent" }, external: true, group: "travel" },
  { to: "/agent/calculators", label: "Calculators", icon: Calculator, group: "workspace" },
  { to: "/agent/ledger", label: "Ledger", icon: BookOpen, group: "account" },
  { to: "/agent/profile", label: "My Profile", icon: UserCog, group: "account" },
  { to: "/agent/change-password", label: "Change Password", icon: KeyRound, group: "account" },
  { to: "/agent/latest-updates", label: "Latest Updates", icon: Bell, group: "workspace" },
];

const GROUPS = [
  { id: "workspace", label: "Workspace" },
  { id: "travel", label: "Travel & Bookings" },
  { id: "account", label: "Account" },
] as const;

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
  const [openGroup, setOpenGroup] = useState<string | null>(null);

  useEffect(() => setMobileOpen(false), [pathname]);

  useEffect(() => {
    if (!mobileOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileOpen(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  const isActive = (to: string) => pathname === to;

  const renderLinks = (group: (typeof GROUPS)[number]["id"], mobile = false) =>
    TABS.filter((tab) => tab.group === group).map((tab) => {
      const active = isActive(tab.to);
      const Icon = tab.icon;
      return (
        <Link
          key={tab.to}
          to={tab.to}
          {...(tab.search ? { search: tab.search as never } : {})}
          target={tab.external ? "_blank" : undefined}
          rel={tab.external ? "noopener noreferrer" : undefined}
          onClick={() => mobile && setMobileOpen(false)}
          className={`flex items-center gap-2 rounded-lg px-3 py-2.5 text-xs font-semibold transition-colors ${active ? "bg-white/10 text-gold" : "text-white/70 hover:bg-white/5 hover:text-white"}`}
        >
          <Icon className="h-4 w-4 shrink-0" />
          <span>{tab.label}</span>
        </Link>
      );
    });

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-navy text-navy-foreground shadow-sm print:hidden">
      <div className="hidden border-b border-white/10 bg-navy/95 lg:block">
        <div className="mx-auto flex h-8 max-w-[1600px] items-center justify-end gap-5 px-4 text-[10px] font-semibold text-white/60">
          <span>Rohi International Travels</span>
          {contactPerson && <span className="hidden xl:inline">Contact: {contactPerson}</span>}
          <Link to="/agent/latest-updates" className="transition-colors hover:text-white">Latest updates</Link>
        </div>
      </div>

      <div className="mx-auto flex min-h-[68px] max-w-[1600px] items-center justify-between gap-3 px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={() => { setMobileOpen(true); onToggleSidebar?.(); }}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white/80 hover:bg-white/10 lg:hidden"
            aria-label="Open agent navigation"
            aria-expanded={mobileOpen}
          >
            <Menu className="h-5 w-5" />
          </button>

          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/10">
            <Plane className="h-5 w-5 -rotate-45 text-gold" />
          </span>

          <Link to="/agent/dashboard" className="min-w-0">
            <p className="truncate text-base font-black leading-none">B2B Agent Portal</p>
            <p className="mt-1 truncate text-[10px] tracking-[0.14em] text-white/55">Rohi International Travels</p>
          </Link>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <LatestUpdatesButton tone="dark" to="/agent/latest-updates" />
          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden items-center gap-1.5 rounded-lg border border-white/15 px-3 py-2 text-xs font-semibold transition-colors hover:bg-white/10 sm:inline-flex"
          >
            <Home className="h-3.5 w-3.5" /> Home
          </a>
          {agencyName && (
            <span className="hidden max-w-[240px] items-center gap-1.5 truncate rounded-lg border border-gold/35 bg-white/[0.05] px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-gold lg:inline-flex" title={agencyName}>
              <Building2 className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{agencyName}</span>
            </span>
          )}
          {onSignOut && (
            <button onClick={onSignOut} className="hidden items-center gap-2 rounded-lg bg-gold px-3 py-2 text-xs font-bold text-gold-foreground transition-opacity hover:opacity-90 sm:inline-flex">
              <LogOut className="h-3.5 w-3.5" /> Logout
            </button>
          )}
        </div>
      </div>

      <nav aria-label="Agent portal" className="mx-auto hidden max-w-[1600px] items-center gap-1 px-4 pb-2 lg:flex">
        {GROUPS.map((group) => {
          const open = openGroup === group.id;
          const active = TABS.some((tab) => tab.group === group.id && isActive(tab.to));
          return (
            <div key={group.id} className="relative">
              <button
                type="button"
                onClick={() => setOpenGroup(open ? null : group.id)}
                aria-expanded={open}
                className={`inline-flex min-h-10 items-center gap-1.5 rounded-lg px-3.5 text-[11px] font-extrabold uppercase tracking-wide transition-colors ${active || open ? "bg-white/10 text-white" : "text-white/70 hover:bg-white/5 hover:text-white"}`}
              >
                {group.label}
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
              </button>
              {open && (
                <div className="absolute left-0 top-full z-50 mt-2 w-64 rounded-xl border border-white/10 bg-navy p-2 shadow-2xl">
                  {renderLinks(group.id)}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div className={`fixed inset-0 z-[60] lg:hidden ${mobileOpen ? "pointer-events-auto" : "pointer-events-none"}`} aria-hidden={!mobileOpen}>
        <button
          type="button"
          aria-label="Close agent navigation"
          onClick={() => setMobileOpen(false)}
          className={`absolute inset-0 bg-navy/60 backdrop-blur-sm transition-opacity ${mobileOpen ? "opacity-100" : "opacity-0"}`}
        />
        <aside className={`absolute inset-y-0 left-0 flex w-[min(90vw,360px)] flex-col bg-navy shadow-2xl transition-transform duration-300 ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`} aria-label="Agent portal navigation">
          <div className="flex min-h-16 items-center justify-between border-b border-white/10 px-4">
            <span className="text-base font-black text-white">Agent Menu</span>
            <button type="button" onClick={() => setMobileOpen(false)} className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-white/80 hover:bg-white/10" aria-label="Close menu">
              <X className="h-5 w-5" />
            </button>
          </div>
          <nav className="flex-1 overflow-y-auto p-3" aria-label="Mobile agent portal">
            {GROUPS.map((group) => (
              <div key={group.id} className="mb-2 rounded-xl border border-white/10 p-1.5">
                <p className="px-2.5 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-white/45">{group.label}</p>
                {renderLinks(group.id, true)}
              </div>
            ))}
            <div className="mt-3 border-t border-white/10 pt-3">
              <a href="/" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-xs font-semibold text-white/75 hover:bg-white/5 hover:text-white">
                <Home className="h-4 w-4" /> Website home
              </a>
              {onSignOut && (
                <button onClick={onSignOut} className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-xs font-semibold text-gold hover:bg-white/5">
                  <LogOut className="h-4 w-4" /> Logout
                </button>
              )}
            </div>
          </nav>
        </aside>
      </div>
    </header>
  );
}
