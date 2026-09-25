import { useEffect, useRef, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Check, ChevronDown, Menu, Star, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { countSubmittedBookings } from "@/lib/agent-bookings.functions";
import { ALL_TABS, TAB_GROUPS, type TabDef } from "@/lib/admin-tabs";

const FAVORITES_KEY = "rohi-admin-favorites-v1";

function loadFavorites(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(FAVORITES_KEY);
    if (!raw) return ["fares", "tickets", "bookings"];
    const saved: string[] = JSON.parse(raw);
    const known = new Set(ALL_TABS.map((t) => t.id));
    return saved.filter((id) => known.has(id));
  } catch {
    return [];
  }
}

const barText = "text-white/85";
const pillBase = "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors duration-[var(--duration-fast)]";
const pillIdle = `${pillBase} ${barText} hover:bg-white/10 hover:text-white`;
const pillActive = `${pillBase} bg-[var(--bg-primary)] text-[var(--accent-ink)] shadow-sm`;

export function AdminTabs({
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
  const [favorites, setFavorites] = useState<string[]>([]);
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileGroupsOpen, setMobileGroupsOpen] = useState<Record<string, boolean>>({});
  const dragId = useRef<string | null>(null);
  const barRef = useRef<HTMLDivElement>(null);

  const fetchCount = useServerFn(countSubmittedBookings);
  const { data: bookingStats } = useQuery({
    queryKey: ["admin", "submitted-count"],
    queryFn: () => fetchCount(),
    refetchInterval: 30_000,
    enabled: ctx?.portalRole === "admin" || ctx?.portalRole === "staff",
  });

  useEffect(() => { setFavorites(loadFavorites()); }, []);
  useEffect(() => { setMobileOpen(false); setOpenGroup(null); }, [pathname]);

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

  useEffect(() => {
    if (!openGroup) return;
    const onDown = (event: MouseEvent) => {
      if (!barRef.current?.contains(event.target as Node)) setOpenGroup(null);
    };
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setOpenGroup(null); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [openGroup]);

  // Staff mode is driven by the resolved portal role only. A `staffTabs` prop
  // (which can be an empty array for admins) must never turn on staff gating.
  const resolvedRole = panelRole ?? ctx?.portalRole;
  const isStaff = resolvedRole === "staff";

  // Role not resolved yet (or non-admin portal) → render no admin navigation at all.
  if (resolvedRole && resolvedRole !== "admin" && resolvedRole !== "staff") return null;

  const byId = new Map(ALL_TABS.map((t) => [t.id, t] as const));
  const isActive = (to: string) => (to === "/admin" ? pathname === "/admin" : pathname.startsWith(to));
  const badgeCount = bookingStats?.count ?? 0;

  function persistFavorites(next: string[]) {
    setFavorites(next);
    try { window.localStorage.setItem(FAVORITES_KEY, JSON.stringify(next)); } catch {}
  }
  function toggleFavorite(id: string) {
    persistFavorites(favorites.includes(id) ? favorites.filter((f) => f !== id) : [...favorites, id]);
  }

  function onDragStart(id: string) { dragId.current = id; }
  function onDragOver(e: React.DragEvent, overId: string) {
    e.preventDefault();
    const from = dragId.current;
    if (!from || from === overId) return;
    const next = [...favorites];
    const fromIdx = next.indexOf(from);
    const toIdx = next.indexOf(overId);
    if (fromIdx < 0 || toIdx < 0) return;
    next.splice(fromIdx, 1);
    next.splice(toIdx, 0, from);
    setFavorites(next);
  }
  function onDrop() { persistFavorites(favorites); dragId.current = null; }

  function TabRow({ t, onNavigate }: { t: TabDef; onNavigate?: () => void }) {
    const Icon = t.icon;
    const active = isActive(t.to);
    const fav = favorites.includes(t.id);
    return (
      <div className={`group/row flex items-center gap-1 rounded-lg ${active ? "bg-[var(--bg-tertiary)]" : "hover:bg-[var(--bg-tertiary)]"}`}>
        <Link
          to={t.to}
          onClick={onNavigate}
          className={`flex min-w-0 flex-1 items-center gap-2 px-2.5 py-2 text-[13px] ${
            active ? "font-medium text-[var(--text-primary)]" : "text-[var(--text-secondary)] group-hover/row:text-[var(--text-primary)]"
          }`}
        >
          <Icon className="h-4 w-4 shrink-0 opacity-70" />
          <span className="truncate">{t.label}</span>
          {active && <Check className="ml-auto h-3.5 w-3.5 shrink-0 text-[var(--accent-ink)]" />}
          {t.id === "bookings" && badgeCount > 0 && (
            <span className={`${active ? "" : "ml-auto "}inline-flex items-center justify-center rounded-full bg-[var(--accent)] px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white`}>
              {badgeCount}
            </span>
          )}
        </Link>
        <button
          type="button"
          onClick={() => toggleFavorite(t.id)}
          aria-label={fav ? `Remove ${t.label} from favourites` : `Add ${t.label} to favourites`}
          className={`mr-1.5 rounded-md p-1.5 transition-colors ${fav ? "text-[var(--accent)]" : "text-[var(--text-muted)] opacity-0 hover:text-[var(--accent)] group-hover/row:opacity-100"}`}
        >
          <Star className={`h-3.5 w-3.5 ${fav ? "fill-current" : ""}`} />
        </button>
      </div>
    );
  }

  function FavoritePill({ t }: { t: TabDef }) {
    const Icon = t.icon;
    const active = isActive(t.to);
    return (
      <div
        draggable={!isStaff}
        onDragStart={() => onDragStart(t.id)}
        onDragOver={(e) => onDragOver(e, t.id)}
        onDrop={onDrop}
        onDragEnd={onDrop}
        title={isStaff ? t.label : "Drag to reorder"}
      >
        <Link to={t.to} className={active ? pillActive : pillIdle}>
          <Icon className="h-3.5 w-3.5 opacity-70" />
          {t.label}
          {t.id === "bookings" && badgeCount > 0 && (
            <span className={`inline-flex items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white ${active ? "bg-[var(--accent)]" : "bg-[var(--accent-ink)]"}`}>
              {badgeCount}
            </span>
          )}
        </Link>
      </div>
    );
  }

  const favTabs = favorites.map((id) => byId.get(id)).filter((t): t is TabDef => Boolean(t));

  const mobileGroupSection = (group: (typeof TAB_GROUPS)[number]) => {
    const tabs = group.tabIds.map((id) => byId.get(id)).filter((t): t is TabDef => Boolean(t));
    const groupHasActive = tabs.some((t) => isActive(t.to));
    const open = mobileGroupsOpen[group.id] ?? groupHasActive;
    const GroupIcon = group.icon;
    return (
      <div key={group.id} className="border-b border-[var(--border-default)] py-1">
        <button
          type="button"
          onClick={() => setMobileGroupsOpen((prev) => ({ ...prev, [group.id]: !open }))}
          className={`flex min-h-11 w-full items-center gap-2 rounded-lg px-3 py-2.5 text-[13px] font-medium ${groupHasActive ? "bg-[var(--bg-tertiary)] text-[var(--text-primary)]" : "text-[var(--text-primary)]"}`}
        >
          <GroupIcon className="h-4 w-4 opacity-70" />
          {group.label}
          {groupHasActive && <Check className="ml-auto h-4 w-4 text-[var(--accent-ink)]" />}
          <ChevronDown className={`h-4 w-4 transition-transform ${open && !groupHasActive ? "rotate-180" : ""} ${groupHasActive ? "ml-1" : "ml-auto"}`} />
        </button>
        {open && <div className="pb-1 pl-2">{tabs.map((t) => <TabRow key={t.id} t={t} onNavigate={() => setMobileOpen(false)} />)}</div>}
      </div>
    );
  };

  return (
    <>
      <div className="px-4 pb-3 lg:hidden">
        <button type="button" onClick={() => setMobileOpen(true)} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-[var(--accent-ink)] px-3 text-[13px] font-medium text-white hover:bg-[var(--accent-hover)]" aria-label="Open admin navigation" aria-expanded={mobileOpen}>
          <Menu className="h-4 w-4" /> Menu
        </button>
      </div>

      <nav ref={barRef} className="relative hidden lg:block" aria-label="Admin portal">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-1 px-3 pb-2">
          {favTabs.length > 0 && (
            <>
              <span className="flex items-center gap-1 px-1 text-[11px] font-medium uppercase tracking-[0.04em] text-white/60">
                <Star className="h-3 w-3 fill-current text-[var(--bg-primary)]" /> Favourites
              </span>
              {favTabs.map((t) => <FavoritePill key={t.id} t={t} />)}
              <span className="mx-1.5 h-5 w-px bg-white/25" aria-hidden />
            </>
          )}
          {TAB_GROUPS.map((group) => {
            const tabs = group.tabIds.map((id) => byId.get(id)).filter((t): t is TabDef => Boolean(t));
            const groupHasActive = tabs.some((t) => isActive(t.to));
            const isOpen = openGroup === group.id;
            const GroupIcon = group.icon;
            const activeTab = tabs.find((t) => isActive(t.to));
            return (
              <div key={group.id} className="relative">
                <button
                  type="button"
                  onClick={() => setOpenGroup(isOpen ? null : group.id)}
                  aria-expanded={isOpen}
                  className={`${groupHasActive && !isOpen ? pillActive : pillIdle}`}
                >
                  <GroupIcon className="h-3.5 w-3.5 opacity-70" />
                  {groupHasActive && activeTab ? activeTab.label : group.label}
                  <ChevronDown className={`h-3.5 w-3.5 opacity-50 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                </button>
                {isOpen && (
                  <div className="absolute left-0 top-full z-50 mt-1.5 w-72 rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-1.5 shadow-lg">
                    <p className="px-2.5 pb-1 pt-1.5 text-[11px] font-medium uppercase tracking-[0.04em] text-[var(--text-muted)]">{group.label}</p>
                    {tabs.map((t) => <TabRow key={t.id} t={t} onNavigate={() => setOpenGroup(null)} />)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </nav>

      <div className={`fixed inset-0 z-50 lg:hidden ${mobileOpen ? "pointer-events-auto" : "pointer-events-none"}`} aria-hidden={!mobileOpen}>
        <button type="button" aria-label="Close admin navigation" onClick={() => setMobileOpen(false)} className={`absolute inset-0 bg-[var(--text-primary)]/40 backdrop-blur-sm transition-opacity ${mobileOpen ? "opacity-100" : "opacity-0"}`} />
        <aside className={`absolute inset-y-0 left-0 flex w-[min(88vw,340px)] flex-col bg-[var(--bg-secondary)] shadow-xl transition-transform duration-300 ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`} aria-label="Admin navigation">
          <div className="flex min-h-16 items-center justify-between border-b border-[var(--border-default)] px-4">
            <span className="text-base font-semibold text-[var(--text-primary)]">Admin Menu</span>
            <button type="button" onClick={() => setMobileOpen(false)} className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]" aria-label="Close menu"><X className="h-5 w-5" /></button>
          </div>
          <nav className="flex-1 overflow-y-auto p-3" aria-label="Mobile admin portal">
            {favTabs.length > 0 && (
              <div className="mb-2">
                <p className="px-3 pb-1 pt-2 text-[11px] font-medium uppercase tracking-[0.04em] text-[var(--text-muted)]">Favourites</p>
                {favTabs.map((t) => <TabRow key={t.id} t={t} onNavigate={() => setMobileOpen(false)} />)}
              </div>
            )}
            {TAB_GROUPS.map(mobileGroupSection)}
          </nav>
        </aside>
      </div>
    </>
  );
}
