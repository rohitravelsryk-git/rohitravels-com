import { useEffect, useRef, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Check, ChevronDown, Folder, GripVertical, Menu, MoveUpRight, Plus, RotateCcw, Star, X, type LucideIcon } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { countSubmittedBookings } from "@/lib/agent-bookings.functions";
import {
  getAdminMenuLayout,
  saveAdminMenuLayout,
  type AdminMenuLayout,
} from "@/lib/admin-menu-layout.functions";
import { ALL_TABS, TAB_GROUPS, type TabDef } from "@/lib/admin-tabs";

const FAVORITES_KEY = "rohi-admin-favorites-v1";
const GROUPS_KEY = "rohi-admin-groups-v1";
const LAYOUT_QUERY_KEY = ["admin", "menu-layout"] as const;
// Pseudo-folder whose tabs render as loose pills directly in the bar.
const STANDALONE_ID = "standalone";

type GroupEntry = { id: string; label?: string; tabIds: string[] };
type GroupsState = GroupEntry[];

const defaultGroups = (): GroupsState => [
  { id: STANDALONE_ID, tabIds: [] },
  ...TAB_GROUPS.map((g) => ({ id: g.id, tabIds: [...g.tabIds] })),
];

function groupMeta(g: GroupEntry): { label: string; icon: LucideIcon; custom: boolean } {
  const d = TAB_GROUPS.find((x) => x.id === g.id);
  if (d) return { label: g.label?.trim() || d.label, icon: d.icon, custom: false };
  return { label: g.label?.trim() || "New menu", icon: Folder, custom: true };
}

// User arrangement is stored as folder order + per-folder tab-id lists; custom
// folders also carry their label. Anything unknown/duplicated falls back to the
// default placement.
function loadGroups(): GroupsState {
  const fallback = defaultGroups();
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(GROUPS_KEY);
    if (!raw) return fallback;
    const saved = JSON.parse(raw) as GroupEntry[];
    const known = new Set(ALL_TABS.map((t) => t.id));
    const seen = new Set<string>();
    const cleaned: GroupsState = [{ id: STANDALONE_ID, tabIds: [] }];
    for (const g of saved) {
      if (!g || typeof g.id !== "string") continue;
      const isStand = g.id === STANDALONE_ID;
      const builtin = TAB_GROUPS.some((d) => d.id === g.id);
      const custom = isStand || g.id.startsWith("c-") || (typeof g.label === "string" && g.label.trim().length > 0);
      if (!builtin && !custom) continue;
      const ids = (Array.isArray(g.tabIds) ? g.tabIds : []).filter((id) => known.has(id) && !seen.has(id));
      ids.forEach((id) => seen.add(id));
      if (isStand) { cleaned[0].tabIds.push(...ids); continue; }
      if (cleaned.some((c) => c.id === g.id)) continue;
      cleaned.push({ id: g.id, label: typeof g.label === "string" && g.label.trim() ? g.label : undefined, tabIds: ids });
    }
    for (const d of TAB_GROUPS) if (!cleaned.some((c) => c.id === d.id)) cleaned.push({ id: d.id, tabIds: [] });
    const stand = cleaned[0];
    for (const t of ALL_TABS) {
      if (seen.has(t.id)) continue;
      const home = TAB_GROUPS.find((g) => g.tabIds.includes(t.id));
      (cleaned.find((c) => c.id === home?.id)?.tabIds ?? stand.tabIds).push(t.id);
    }
    return cleaned;
  } catch {
    return fallback;
  }
}

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

// Browsers may silently cancel an HTML5 drag whose DragEvent carries no data,
// so every custom drag must seed dataTransfer before we rely on ref state.
function startMoveDrag(e: React.DragEvent, id: string) {
  e.dataTransfer.setData("text/plain", id);
  e.dataTransfer.effectAllowed = "move";
}
function acceptMoveDrag(e: React.DragEvent) {
  e.preventDefault();
  e.stopPropagation();
  e.dataTransfer.dropEffect = "move";
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
  const [favorites, setFavorites] = useState<string[]>([]);
  const [groups, setGroups] = useState<GroupsState>(defaultGroups);
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileGroupsOpen, setMobileGroupsOpen] = useState<Record<string, boolean>>({});
  const [addingGroup, setAddingGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [standaloneHint, setStandaloneHint] = useState(false);
  const dragId = useRef<string | null>(null);
  const dragTab = useRef<string | null>(null);
  const dragGroup = useRef<string | null>(null);
  const groupsRef = useRef(groups);
  const favoritesRef = useRef<string[]>([]);
  const barRef = useRef<HTMLDivElement>(null);
  // Live moves happen on dragover; the dragged element may be remounted before
  // dragend fires, so persist on a short timer instead of only on drag-end.
  const persistTimer = useRef<number | null>(null);
  function schedulePersist() {
    if (persistTimer.current) window.clearTimeout(persistTimer.current);
    persistTimer.current = window.setTimeout(() => {
      persistTimer.current = null;
      persistGroups();
    }, 350);
  }

  const fetchCount = useServerFn(countSubmittedBookings);
  const { data: bookingStats } = useQuery({
    queryKey: ["admin", "submitted-count"],
    queryFn: () => fetchCount(),
    refetchInterval: 30_000,
    enabled: ctx?.portalRole === "admin" || ctx?.portalRole === "staff",
  });

  const qc = useQueryClient();
  const fetchLayout = useServerFn(getAdminMenuLayout);
  const pushLayout = useServerFn(saveAdminMenuLayout);
  const { data: storedLayout } = useQuery({
    queryKey: LAYOUT_QUERY_KEY,
    queryFn: () => fetchLayout(),
  });
  // Once this browser has arranged a menu, its own copy is the newest one, so a
  // slow-arriving read of the previous layout must not undo it.
  const pushedLayout = useRef(false);
  const layoutTimer = useRef<number | null>(null);
  const pendingLayout = useRef<AdminMenuLayout | null>(null);

  // The arrangement is stored on the site, not per browser: reopening the panel
  // on another device — or after this browser clears its storage — shows the
  // menus exactly as they were last left.
  useEffect(() => {
    if (!storedLayout || pushedLayout.current) return;
    if (dragId.current || dragTab.current || dragGroup.current) return;
    try {
      window.localStorage.setItem(GROUPS_KEY, JSON.stringify(storedLayout.groups));
      window.localStorage.setItem(FAVORITES_KEY, JSON.stringify(storedLayout.favorites));
    } catch {}
    setGroups(loadGroups());
    setFavorites(loadFavorites());
  }, [storedLayout]);

  function queueLayoutSend(next: AdminMenuLayout) {
    pushedLayout.current = true;
    pendingLayout.current = next;
    qc.setQueryData(LAYOUT_QUERY_KEY, next);
    if (layoutTimer.current) window.clearTimeout(layoutTimer.current);
    layoutTimer.current = window.setTimeout(flushLayout, 400);
  }
  function flushLayout() {
    if (layoutTimer.current) {
      window.clearTimeout(layoutTimer.current);
      layoutTimer.current = null;
    }
    const next = pendingLayout.current;
    if (!next) return;
    pendingLayout.current = null;
    pushLayout({ data: next }).catch((e) => {
      toast.error(e instanceof Error ? e.message : "Menu change kept in this browser only");
    });
  }

  useEffect(() => { setFavorites(loadFavorites()); setGroups(loadGroups()); }, []);
  useEffect(() => {
    setMobileOpen(false);
    setOpenGroup(null);
    setAddingGroup(false);
  }, [pathname]);
  useEffect(() => { groupsRef.current = groups; }, [groups]);
  useEffect(() => { favoritesRef.current = favorites; }, [favorites]);
  useEffect(() => () => {
    // A drag can end as the page changes, so flush both pending timers — other-
    // wise the arrangement stays in this browser and looks like it went back.
    if (persistTimer.current) {
      window.clearTimeout(persistTimer.current);
      persistTimer.current = null;
      persistGroups();
    }
    if (layoutTimer.current) flushLayout();
  }, []);

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
    if (!openGroup && !addingGroup) return;
    const onDown = (event: MouseEvent) => {
      if (!barRef.current?.contains(event.target as Node)) {
        setOpenGroup(null);
        setAddingGroup(false);
      }
    };
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") { setOpenGroup(null); setAddingGroup(false); } };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [openGroup, addingGroup]);

  // Staff mode is driven by the resolved portal role only. A `staffTabs` prop
  // (which can be an empty array for admins) must never turn on staff gating.
  const resolvedRole = panelRole ?? ctx?.portalRole;
  const isStaff = resolvedRole === "staff";

  // Role not resolved yet (or non-admin portal) → render no admin navigation at all.
  if (resolvedRole && resolvedRole !== "admin" && resolvedRole !== "staff") return null;

  const byId = new Map(ALL_TABS.map((t) => [t.id, t] as const));
  const isActive = (to: string) => (to === "/admin" ? pathname === "/admin" : pathname.startsWith(to));
  const badgeCount = bookingStats?.count ?? 0;
  const visibleTabs = isStaff
    ? ALL_TABS.filter((tab) => (staffTabs ?? ctx?.staffTabs ?? []).includes(tab.id))
    : ALL_TABS;

  function persistFavorites(next: string[]) {
    setFavorites(next);
    favoritesRef.current = next;
    try { window.localStorage.setItem(FAVORITES_KEY, JSON.stringify(next)); } catch {}
    queueLayoutSend({ groups: groupsRef.current, favorites: next });
  }
  function toggleFavorite(id: string) {
    persistFavorites(favorites.includes(id) ? favorites.filter((f) => f !== id) : [...favorites, id]);
  }

  function persistGroups() {
    try { window.localStorage.setItem(GROUPS_KEY, JSON.stringify(groupsRef.current)); } catch {}
    queueLayoutSend({ groups: groupsRef.current, favorites: favoritesRef.current });
  }
  function resetGroups() {
    const next = defaultGroups();
    try { window.localStorage.setItem(GROUPS_KEY, JSON.stringify(next)); } catch {}
    groupsRef.current = next;
    setGroups(next);
    queueLayoutSend({ groups: next, favorites: favoritesRef.current });
  }
  const cloneGroups = (): GroupsState => groupsRef.current.map((g) => ({ ...g, tabIds: [...g.tabIds] }));

  function commitGroups(next: GroupsState) {
    groupsRef.current = next;
    setGroups(next);
    persistGroups();
  }

  function addGroup() {
    const label = newGroupName.trim();
    if (!label) return;
    const next = cloneGroups();
    next.push({ id: `c-${Date.now().toString(36)}`, label, tabIds: [] });
    setNewGroupName("");
    setAddingGroup(false);
    commitGroups(next);
  }

  function renameGroup(id: string, current: string) {
    const label = window.prompt("Rename menu folder", current);
    if (label == null || !label.trim()) return;
    const next = cloneGroups();
    const g = next.find((x) => x.id === id);
    if (g) g.label = label.trim();
    commitGroups(next);
  }

  // Deleting a folder never deletes pages — its items become standalone menus.
  function removeGroup(id: string) {
    const next = cloneGroups();
    const g = next.find((x) => x.id === id);
    const stand = next.find((x) => x.id === STANDALONE_ID);
    if (!g || !stand) return;
    stand.tabIds.push(...g.tabIds);
    commitGroups(next.filter((x) => x.id !== id));
  }

  // Live preview while dragging: move the held tab into `toGroupId`, inserting
  // before `overTabId` (or appended when none is given).
  function dragTabTo(toGroupId: string, overTabId?: string) {
    const tabId = dragTab.current;
    if (!tabId || tabId === overTabId) return;
    const next = cloneGroups();
    for (const g of next) g.tabIds = g.tabIds.filter((x) => x !== tabId);
    const target = next.find((g) => g.id === toGroupId);
    if (!target) return;
    const idx = overTabId ? target.tabIds.indexOf(overTabId) : -1;
    target.tabIds.splice(idx < 0 ? target.tabIds.length : idx, 0, tabId);
    groupsRef.current = next;
    setGroups(next);
    schedulePersist();
  }

  function dragGroupTo(overGroupId: string) {
    const fromId = dragGroup.current;
    if (!fromId || fromId === overGroupId) return;
    const next = cloneGroups();
    const fi = next.findIndex((g) => g.id === fromId);
    const ti = next.findIndex((g) => g.id === overGroupId);
    if (fi < 0 || ti < 0) return;
    const [moved] = next.splice(fi, 1);
    next.splice(ti, 0, moved);
    groupsRef.current = next;
    setGroups(next);
    schedulePersist();
  }

  // Click-based move (no dragging needed): sends a tab to the end of a folder.
  function moveTabToGroup(tabId: string, toGroupId: string) {
    const next = cloneGroups();
    for (const g of next) g.tabIds = g.tabIds.filter((x) => x !== tabId);
    const target = next.find((g) => g.id === toGroupId);
    if (!target) return;
    target.tabIds.push(tabId);
    commitGroups(next);
  }

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

  function TabRow({ t, onNavigate, groupId }: { t: TabDef; onNavigate?: () => void; groupId?: string }) {
    const Icon = t.icon;
    const active = isActive(t.to);
    const fav = favorites.includes(t.id);
    const canDrag = !isStaff && Boolean(groupId);
    return (
      <div
        draggable={canDrag}
        onDragStart={(e) => { if (!groupId) return; e.stopPropagation(); dragTab.current = t.id; dragGroup.current = null; dragId.current = null; startMoveDrag(e, t.id); }}
        onDragEnd={() => { if (dragTab.current) { dragTab.current = null; setStandaloneHint(false); persistGroups(); } }}
        onDragOver={(e) => { if (groupId && dragTab.current) { acceptMoveDrag(e); dragTabTo(groupId, t.id); } }}
        className={`group/row flex items-center gap-1 rounded-lg ${active ? "bg-[var(--bg-tertiary)]" : "hover:bg-[var(--bg-tertiary)]"} ${canDrag ? "cursor-grab active:cursor-grabbing" : ""}`}
      >
        <Link
          to={t.to}
          onClick={onNavigate}
          draggable={false}
          className={`flex min-w-0 flex-1 items-center gap-2 px-2.5 py-2 text-[13px] ${
            active ? "font-medium text-[var(--text-primary)]" : "text-[var(--text-secondary)] group-hover/row:text-[var(--text-primary)]"
          }`}
        >
          {canDrag && <GripVertical className="h-3.5 w-3.5 shrink-0 text-[var(--text-muted)] opacity-0 group-hover/row:opacity-50" />}
          <Icon className="h-4 w-4 shrink-0 opacity-70" />
          <span className="truncate">{t.label}</span>
          {active && <Check className="ml-auto h-3.5 w-3.5 shrink-0 text-[var(--accent-ink)]" />}
          {t.id === "bookings" && badgeCount > 0 && (
            <span className={`${active ? "" : "ml-auto "}inline-flex items-center justify-center rounded-full bg-[var(--accent)] px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white`}>
              {badgeCount}
            </span>
          )}
        </Link>
        {groupId && !isStaff && (
          <button
            type="button"
            onClick={() => moveTabToGroup(t.id, STANDALONE_ID)}
            aria-label={`Move ${t.label} out as a standalone menu`}
            title="Move out as a standalone menu"
            className="rounded-md p-1.5 text-[var(--text-muted)] opacity-0 transition-colors hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)] group-hover/row:opacity-100"
          >
            <MoveUpRight className="h-3.5 w-3.5" />
          </button>
        )}
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
        onDragStart={(e) => { e.stopPropagation(); dragId.current = t.id; dragTab.current = null; dragGroup.current = null; startMoveDrag(e, t.id); }}
        onDragOver={(e) => { if (dragId.current) acceptMoveDrag(e); onDragOver(e, t.id); }}
        onDrop={onDrop}
        onDragEnd={onDrop}
        title={isStaff ? t.label : "Drag to reorder"}
      >
        <Link to={t.to} draggable={false} className={active ? pillActive : pillIdle}>
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

  function StandalonePill({ t }: { t: TabDef }) {
    const Icon = t.icon;
    const active = isActive(t.to);
    return (
      <div
        draggable={!isStaff}
        onDragStart={(e) => { e.stopPropagation(); dragTab.current = t.id; dragGroup.current = null; dragId.current = null; startMoveDrag(e, t.id); }}
        onDragEnd={() => { if (dragTab.current) { dragTab.current = null; setStandaloneHint(false); persistGroups(); } }}
        onDragOver={(e) => { if (dragTab.current && dragTab.current !== t.id) { acceptMoveDrag(e); dragTabTo(STANDALONE_ID, t.id); } }}
        title={isStaff ? t.label : "Standalone menu — drag it onto a folder to file it away, or reorder by dragging"}
      >
        <Link to={t.to} draggable={false} className={`${active ? pillActive : pillIdle} ${isStaff ? "" : "cursor-grab active:cursor-grabbing"}`}>
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
  const standaloneTabs = (groups.find((g) => g.id === STANDALONE_ID)?.tabIds ?? [])
    .map((id) => byId.get(id))
    .filter((t): t is TabDef => Boolean(t));

  const mobileGroupSection = (g: GroupEntry) => {
    if (g.id === STANDALONE_ID) return null;
    const meta = groupMeta(g);
    const tabs = g.tabIds.map((id) => byId.get(id)).filter((t): t is TabDef => Boolean(t));
    const groupHasActive = tabs.some((t) => isActive(t.to));
    const open = mobileGroupsOpen[g.id] ?? groupHasActive;
    const GroupIcon = meta.icon;
    return (
      <div key={g.id} className="border-b border-[var(--border-default)] py-1">
        <button
          type="button"
          onClick={() => setMobileGroupsOpen((prev) => ({ ...prev, [g.id]: !open }))}
          className={`flex min-h-11 w-full items-center gap-2 rounded-lg px-3 py-2.5 text-[13px] font-medium ${groupHasActive ? "bg-[var(--bg-tertiary)] text-[var(--text-primary)]" : "text-[var(--text-primary)]"}`}
        >
          <GroupIcon className="h-4 w-4 opacity-70" />
          {meta.label}
          {groupHasActive && <Check className="ml-auto h-4 w-4 text-[var(--accent-ink)]" />}
          <ChevronDown className={`h-4 w-4 transition-transform ${open && !groupHasActive ? "rotate-180" : ""} ${groupHasActive ? "ml-1" : "ml-auto"}`} />
        </button>
        {open && <div className="pb-1 pl-2">{tabs.map((t) => <TabRow key={t.id} t={t} groupId={g.id} onNavigate={() => setMobileOpen(false)} />)}</div>}
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
        <div
          className={`relative mx-auto flex max-w-[1600px] flex-wrap items-center gap-1 px-3 pb-2 transition-shadow ${standaloneHint ? "rounded-xl ring-2 ring-inset ring-white/25" : ""}`}
          onDragOver={(e) => {
            // Reached only when not over a folder/row (they stop propagation):
            // dropping a tab on the open bar area makes it a standalone menu.
            if (dragTab.current && !isStaff) {
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              setStandaloneHint(true);
            }
          }}
          onDrop={(e) => {
            if (dragTab.current && !isStaff) {
              e.preventDefault();
              dragTabTo(STANDALONE_ID);
              dragTab.current = null;
              persistGroups();
            }
            setStandaloneHint(false);
          }}
        >
          {visibleTabs.map((t) => {
            const Icon = t.icon;
            const active = isActive(t.to);
            return (
              <Link key={t.id} to={t.to} className={active ? pillActive : pillIdle}>
                <Icon className="h-3.5 w-3.5 shrink-0 opacity-70" />
                {t.label}
                {t.id === "bookings" && badgeCount > 0 && (
                  <span className={`inline-flex items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white ${active ? "bg-[var(--accent)]" : "bg-[var(--accent-ink)]"}`}>
                    {badgeCount}
                  </span>
                )}
              </Link>
            );
          })}
          <div className="hidden" aria-hidden="true">
          {standaloneHint && (
            <span className="pointer-events-none absolute inset-x-2 bottom-1 z-10 rounded-lg border border-dashed border-white/40 bg-[var(--text-primary)]/60 px-2 py-1 text-center text-[11px] font-medium uppercase tracking-[0.04em] text-white">
              Drop here to make it a standalone menu
            </span>
          )}
          {favTabs.length > 0 && (
            <>
              <span className="flex items-center gap-1 px-1 text-[11px] font-medium uppercase tracking-[0.04em] text-white/60">
                <Star className="h-3 w-3 fill-current text-[var(--accent)]" /> Favourites
              </span>
              {favTabs.map((t) => <FavoritePill key={t.id} t={t} />)}
              <span className="mx-1.5 h-5 w-px bg-white/15" aria-hidden />
            </>
          )}
          {standaloneTabs.length > 0 && (
            <>
              {standaloneTabs.map((t) => <StandalonePill key={t.id} t={t} />)}
              <span className="mx-1.5 h-5 w-px bg-white/15" aria-hidden />
            </>
          )}
          {groups.filter((g) => g.id !== STANDALONE_ID).map((g) => {
            const meta = groupMeta(g);
            const tabs = g.tabIds.map((id) => byId.get(id)).filter((t): t is TabDef => Boolean(t));
            const groupHasActive = tabs.some((t) => isActive(t.to));
            const isOpen = openGroup === g.id;
            const GroupIcon = meta.icon;
            const activeTab = tabs.find((t) => isActive(t.to));
            return (
              <div key={g.id} className="relative">
                <button
                  type="button"
                  onClick={() => setOpenGroup(isOpen ? null : g.id)}
                  aria-expanded={isOpen}
                  draggable={!isStaff}
                  onDragStart={(e) => { e.stopPropagation(); dragGroup.current = g.id; dragTab.current = null; dragId.current = null; startMoveDrag(e, `folder:${g.id}`); }}
                  onDragEnd={() => {
                    setStandaloneHint(false);
                    if (dragGroup.current) { dragGroup.current = null; persistGroups(); }
                    else if (dragTab.current) { dragTab.current = null; persistGroups(); }
                  }}
                  onDragOver={(e) => {
                    acceptMoveDrag(e);
                    if (dragGroup.current) dragGroupTo(g.id);
                    else if (dragTab.current) dragTabTo(g.id);
                  }}
                  onDrop={(e) => {
                    acceptMoveDrag(e);
                    setStandaloneHint(false);
                    if (dragTab.current) { dragTabTo(g.id); dragTab.current = null; persistGroups(); }
                    else if (dragGroup.current) { dragGroup.current = null; persistGroups(); }
                  }}
                  title={isStaff ? meta.label : "Drag onto another folder to reorder — or drop a menu item here to move it into this folder"}
                  className={`${groupHasActive && !isOpen ? pillActive : pillIdle} ${isStaff ? "" : "cursor-grab active:cursor-grabbing"}`}
                >
                  <GroupIcon className="h-3.5 w-3.5 opacity-70" />
                  {groupHasActive && activeTab ? activeTab.label : meta.label}
                  <ChevronDown className={`h-3.5 w-3.5 opacity-50 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                </button>
                {isOpen && (
                  <div
                    className="absolute left-0 top-full z-50 mt-1.5 w-72 rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-1.5 shadow-lg"
                    onDragOver={(e) => { if (dragTab.current) { acceptMoveDrag(e); dragTabTo(g.id); } }}
                    onDrop={(e) => { if (dragTab.current) { acceptMoveDrag(e); dragTabTo(g.id); dragTab.current = null; setStandaloneHint(false); persistGroups(); } }}
                  >
                    <p className="px-2.5 pb-1 pt-1.5 text-[11px] font-medium uppercase tracking-[0.04em] text-[var(--text-muted)]">{meta.label}</p>
                    {tabs.length === 0 && (
                      <p className="px-2.5 py-2 text-[12px] text-[var(--text-muted)]">Empty — drag menu items here.</p>
                    )}
                    {tabs.map((t) => <TabRow key={t.id} t={t} groupId={g.id} onNavigate={() => setOpenGroup(null)} />)}
                    {!isStaff && (
                      <div className="mt-1 flex items-center gap-1.5 border-t border-[var(--border-default)] px-1 pb-0.5 pt-1.5">
                        <button
                          type="button"
                          onClick={() => renameGroup(g.id, meta.label)}
                          className="rounded-md px-2 py-1 text-[11px] font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]"
                        >
                          Rename
                        </button>
                        {meta.custom && (
                          <button
                            type="button"
                            onClick={() => removeGroup(g.id)}
                            className="rounded-md px-2 py-1 text-[11px] font-medium text-[var(--accent-ink)] hover:bg-[var(--bg-tertiary)]"
                          >
                            Delete (items become standalone)
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          {!isStaff && (
            <div className="relative">
              <button
                type="button"
                onClick={() => { setOpenGroup(null); setAddingGroup((v) => !v); }}
                aria-label="New menu folder"
                title="New menu folder"
                className={`${pillIdle} px-2`}
              >
                <Plus className="h-4 w-4" />
              </button>
              {addingGroup && (
                <div className="absolute left-0 top-full z-50 mt-1.5 w-64 rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-2 shadow-lg">
                  <input
                    autoFocus
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") addGroup();
                      if (e.key === "Escape") setAddingGroup(false);
                    }}
                    placeholder="New menu name"
                    className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] px-2.5 py-1.5 text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
                  />
                  <div className="mt-1.5 flex items-center justify-between gap-2 px-0.5">
                    <p className="text-[11px] text-[var(--text-muted)]">Drag menu items into it.</p>
                    <button
                      type="button"
                      onClick={addGroup}
                      className="rounded-md bg-[var(--accent)] px-2.5 py-1 text-[11px] font-medium text-white hover:bg-[var(--accent-hover)]"
                    >
                      Add
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
          {!isStaff && JSON.stringify(groups) !== JSON.stringify(defaultGroups()) && (
            <button
              type="button"
              onClick={resetGroups}
              title="Reset menu arrangement"
              aria-label="Reset menu arrangement"
              className="ml-1 rounded-md p-1.5 text-white/50 hover:bg-white/10 hover:text-white"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          )}
          </div>
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
            <div className="space-y-1">
              {visibleTabs.map((t) => <TabRow key={t.id} t={t} onNavigate={() => setMobileOpen(false)} />)}
            </div>
            <div className="hidden" aria-hidden="true">
            {favTabs.length > 0 && (
              <div className="mb-2">
                <p className="px-3 pb-1 pt-2 text-[11px] font-medium uppercase tracking-[0.04em] text-[var(--text-muted)]">Favourites</p>
                {favTabs.map((t) => <TabRow key={t.id} t={t} onNavigate={() => setMobileOpen(false)} />)}
              </div>
            )}
            {standaloneTabs.length > 0 && (
              <div className="mb-2 border-b border-[var(--border-default)] pb-1">
                <p className="px-3 pb-1 pt-2 text-[11px] font-medium uppercase tracking-[0.04em] text-[var(--text-muted)]">Standalone menus</p>
                {standaloneTabs.map((t) => <TabRow key={t.id} t={t} onNavigate={() => setMobileOpen(false)} />)}
              </div>
            )}
            {groups.map(mobileGroupSection)}
            </div>
          </nav>
        </aside>
      </div>
    </>
  );
}
