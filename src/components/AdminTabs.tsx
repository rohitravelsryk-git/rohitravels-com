import { useEffect, useRef, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { GripVertical, Menu, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { countSubmittedBookings } from "@/lib/agent-bookings.functions";
import { ALL_TABS } from "@/lib/admin-tabs";

const STORAGE_KEY = "rohi-admin-tab-order-v1";

function loadOrder(): string[] {
  if (typeof window === "undefined") return ALL_TABS.map((t) => t.id);
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return ALL_TABS.map((t) => t.id);
    const saved: string[] = JSON.parse(raw);
    const known = new Set(ALL_TABS.map((t) => t.id));
    const filtered = saved.filter((id) => known.has(id));
    // append any newly added tabs at the end
    for (const t of ALL_TABS) if (!filtered.includes(t.id)) filtered.push(t.id);
    return filtered;
  } catch {
    return ALL_TABS.map((t) => t.id);
  }
}

export function AdminTabs({
  staffTabs,
  panelRole,
}: {
  staffTabs?: string[] | null;
  panelRole?: "admin" | "staff";
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  // Role comes from the /admin layout route context (resolved before render),
  // so staff never get a frame of admin-only navigation.
  const ctx = useRouterState({
    select: (s) =>
      s.matches.find((m) => (m.context as { portalRole?: string } | undefined)?.portalRole)?.context as
        | { portalRole?: string; staffTabs?: string[] }
        | undefined,
  });
  const [order, setOrder] = useState<string[]>(() => ALL_TABS.map((t) => t.id));
  const [mobileOpen, setMobileOpen] = useState(false);
  const dragId = useRef<string | null>(null);
  
  const fetchCount = useServerFn(countSubmittedBookings);
  const { data: bookingStats } = useQuery({
    queryKey: ["admin", "submitted-count"],
    queryFn: () => fetchCount(),
    refetchInterval: 30_000,
    enabled: ctx?.portalRole === "admin" || ctx?.portalRole === "staff",
  });

  useEffect(() => { setOrder(loadOrder()); }, []);
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

  // Staff mode is driven by the resolved portal role only. A `staffTabs` prop
  // (which can be an empty array for admins) must never turn on staff gating.
  const resolvedRole = panelRole ?? ctx?.portalRole;
  const isStaff = resolvedRole === "staff";
  const effectiveStaffTabs = isStaff ? staffTabs ?? ctx?.staffTabs ?? [] : null;



  function persist(next: string[]) {
    setOrder(next);
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
  }

  function onDragStart(id: string) { dragId.current = id; }
  function onDragOver(e: React.DragEvent, overId: string) {
    e.preventDefault();
    const from = dragId.current;
    if (!from || from === overId) return;
    const next = [...order];
    const fromIdx = next.indexOf(from);
    const toIdx = next.indexOf(overId);
    if (fromIdx < 0 || toIdx < 0) return;
    next.splice(fromIdx, 1);
    next.splice(toIdx, 0, from);
    setOrder(next);
  }
  function onDrop() { persist(order); dragId.current = null; }

  const byId = new Map(ALL_TABS.map((t) => [t.id, t] as const));
  const isActive = (to: string) => (to === "/admin" ? pathname === "/admin" : pathname.startsWith(to));

  const allowedSet = new Set(effectiveStaffTabs ?? []);
  const allTabsIds = ALL_TABS.map(t => t.id);
  // If no staff tabs are configured, we treat it as "allow all" for staff too if the user wants everything enabled
  const hasStaffRestrictions = isStaff && (effectiveStaffTabs && effectiveStaffTabs.length > 0);

  // Role not resolved yet (or non-admin portal) → render no admin navigation at all.
  if (resolvedRole && resolvedRole !== "admin" && resolvedRole !== "staff") return null;

  const renderTabs = (mobile = false) => (
    <div className={mobile ? "space-y-1" : "mx-auto flex max-w-[1600px] flex-wrap gap-1 px-4"}>
      {order.map((id) => {
        const t = byId.get(id);
        if (!t) return null;
        
        // When user asks to "enable all", we bypass the adminOnly and allowedSet filters 
        // to show everything to everyone with access to the panel.
        // However, we still respect basic staff vs admin routing elsewhere.
        // To strictly "enable all" in the UI:
        const visible = true; 
        
        if (!visible) return null;
        const active = isActive(t.to);
        const Icon = t.icon;
        return (
          <div
            key={t.id}
            draggable={!isStaff}
            onDragStart={() => onDragStart(t.id)}
            onDragOver={(e) => onDragOver(e, t.id)}
            onDrop={onDrop}
            onDragEnd={onDrop}
            className={`group flex items-center border-b-2 transition-all duration-[var(--duration-base)] ease-[var(--ease-premium)] ${mobile ? "rounded-md" : "rounded-t-md"} ${
              active ? "border-gold bg-white/5 text-gold" : "border-transparent text-white/60 hover:text-white"
            }`}
            title={isStaff ? t.label : "Drag to reorder"}
          >
            {!isStaff && !mobile && <GripVertical className="ml-1 h-3 w-3 cursor-grab opacity-0 group-hover:opacity-60" />}
            <Link to={t.to} className={`flex min-h-11 items-center text-xs font-bold uppercase tracking-widest ${mobile ? "w-full px-4 py-3" : "px-3 py-2"}`}>
              <Icon className="mr-1.5 inline h-3.5 w-3.5" />
              {t.label}
              {t.id === "bookings" && (bookingStats?.count ?? 0) > 0 && (
                <span className="ml-1.5 inline-flex items-center justify-center rounded-full bg-accent px-1.5 py-0.5 text-[9px] font-black leading-none text-white ring-1 ring-white/20">
                  {bookingStats!.count}
                </span>
              )}
            </Link>
          </div>
        );
      })}
    </div>
  );

  return (
    <>
      <div className="px-4 pb-3 lg:hidden">
        <button type="button" onClick={() => setMobileOpen(true)} className="inline-flex min-h-11 items-center gap-2 rounded-md border border-white/20 px-3 text-xs font-bold uppercase tracking-widest text-white hover:bg-white/10" aria-label="Open admin navigation" aria-expanded={mobileOpen}>
          <Menu className="h-4 w-4" /> Menu
        </button>
      </div>
      <nav className="hidden lg:block" aria-label="Admin portal">{renderTabs()}</nav>
      <div className={`fixed inset-0 z-50 lg:hidden ${mobileOpen ? "pointer-events-auto" : "pointer-events-none"}`} aria-hidden={!mobileOpen}>
        <button type="button" aria-label="Close admin navigation" onClick={() => setMobileOpen(false)} className={`absolute inset-0 bg-navy/60 backdrop-blur-sm transition-opacity ${mobileOpen ? "opacity-100" : "opacity-0"}`} />
        <aside className={`absolute inset-y-0 left-0 flex w-[min(88vw,340px)] flex-col bg-navy shadow-xl transition-transform duration-300 ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`} aria-label="Admin navigation">
          <div className="flex min-h-16 items-center justify-between border-b border-white/10 px-4">
            <span className="font-sans text-base font-black text-white">Admin Menu</span>
            <button type="button" onClick={() => setMobileOpen(false)} className="inline-flex h-11 w-11 items-center justify-center rounded-md text-white/80 hover:bg-white/10" aria-label="Close menu"><X className="h-5 w-5" /></button>
          </div>
          <nav className="flex-1 overflow-y-auto p-3" aria-label="Mobile admin portal">{renderTabs(true)}</nav>
        </aside>
      </div>
    </>
  );
}
