import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  Check,
  ChevronDown,
  ExternalLink,
  Folder,
  Link2,
  Menu,
  Pencil,
  Plus,
  RotateCcw,
  Settings2,
  Trash2,
  X,
  type LucideIcon,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { countSubmittedBookings } from "@/lib/agent-bookings.functions";
import {
  getAdminMenuLayout,
  saveAdminMenuLayout,
  type AdminMenuCustomLink,
  type AdminMenuLayout,
} from "@/lib/admin-menu-layout.functions";
import { ALL_TABS, TAB_GROUPS, type TabDef } from "@/lib/admin-tabs";

const GROUPS_KEY = "rohi-admin-groups-v1";
const LAYOUT_QUERY_KEY = ["admin", "menu-layout"] as const;
const STANDALONE_ID = "standalone";

type GroupEntry = {
  id: string;
  label?: string;
  tabIds: string[];
  customLinks?: AdminMenuCustomLink[];
};
type GroupsState = GroupEntry[];

function isVisibleTab(tab: TabDef | undefined, allowedTabIds: Set<string>): tab is TabDef {
  return Boolean(tab && allowedTabIds.has(tab.id));
}

const defaultGroups = (): GroupsState => [
  { id: STANDALONE_ID, label: "Other", tabIds: [], customLinks: [] },
  ...TAB_GROUPS.map((group) => ({
    id: group.id,
    tabIds: [...group.tabIds],
    customLinks: [],
  })),
];

function groupMeta(group: GroupEntry): { label: string; icon: LucideIcon; custom: boolean } {
  const builtIn = TAB_GROUPS.find((item) => item.id === group.id);
  if (builtIn) return { label: group.label?.trim() || builtIn.label, icon: builtIn.icon, custom: false };
  return { label: group.label?.trim() || "New menu", icon: Folder, custom: true };
}

function normaliseGroups(saved: unknown): GroupsState {
  const fallback = defaultGroups();
  if (!Array.isArray(saved)) return fallback;
  const knownTabs = new Set(ALL_TABS.map((tab) => tab.id));
  const seenTabs = new Set<string>();
  const seenGroups = new Set<string>();
  const seenLinks = new Set<string>();
  const cleaned: GroupsState = [];

  for (const candidate of saved) {
    if (!candidate || typeof candidate !== "object") continue;
    const value = candidate as Partial<GroupEntry>;
    if (typeof value.id !== "string" || seenGroups.has(value.id)) continue;
    const builtIn = value.id === STANDALONE_ID || TAB_GROUPS.some((group) => group.id === value.id);
    if (!builtIn && !value.id.startsWith("c-")) continue;
    seenGroups.add(value.id);
    const tabIds = (Array.isArray(value.tabIds) ? value.tabIds : []).filter((id): id is string => {
      if (typeof id !== "string" || !knownTabs.has(id) || seenTabs.has(id)) return false;
      seenTabs.add(id);
      return true;
    });
    const customLinks = (Array.isArray(value.customLinks) ? value.customLinks : []).filter(
      (link): link is AdminMenuCustomLink => {
        if (!link || typeof link.id !== "string" || typeof link.label !== "string" || typeof link.url !== "string" || seenLinks.has(link.id)) return false;
        if (!link.url.startsWith("/") && !/^https?:\/\//i.test(link.url)) return false;
        seenLinks.add(link.id);
        return true;
      },
    );
    cleaned.push({
      id: value.id,
      ...(typeof value.label === "string" && value.label.trim() ? { label: value.label.trim() } : {}),
      tabIds,
      customLinks,
    });
  }

  if (!cleaned.some((group) => group.id === STANDALONE_ID)) {
    cleaned.unshift({ id: STANDALONE_ID, label: "Other", tabIds: [], customLinks: [] });
  }
  for (const group of TAB_GROUPS) {
    if (!cleaned.some((entry) => entry.id === group.id)) {
      cleaned.push({ id: group.id, tabIds: [], customLinks: [] });
    }
  }
  const standalone = cleaned.find((group) => group.id === STANDALONE_ID);
  for (const tab of ALL_TABS) {
    if (seenTabs.has(tab.id)) continue;
    const home = TAB_GROUPS.find((group) => group.tabIds.includes(tab.id));
    const target = cleaned.find((group) => group.id === home?.id) ?? standalone;
    target?.tabIds.push(tab.id);
  }
  return cleaned;
}

function loadGroups(): GroupsState {
  if (typeof window === "undefined") return defaultGroups();
  try {
    const raw = window.localStorage.getItem(GROUPS_KEY);
    return raw ? normaliseGroups(JSON.parse(raw)) : defaultGroups();
  } catch {
    return defaultGroups();
  }
}

function safeCustomUrl(url: string): string | null {
  const value = url.trim();
  if (value.startsWith("/") && !value.startsWith("//")) return value;
  if (/^https?:\/\//i.test(value)) return value;
  return null;
}

export function AdminTabs({
  staffTabs,
  panelRole,
}: {
  staffTabs?: string[] | null;
  panelRole?: "admin" | "staff";
}) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const context = useRouterState({
    select: (state) =>
      state.matches.find((match) => (match.context as { portalRole?: string } | undefined)?.portalRole)?.context as
        | { portalRole?: string; staffTabs?: string[] }
        | undefined,
  });
  const resolvedRole = panelRole ?? context?.portalRole;
  const isStaff = resolvedRole === "staff";
  const [groups, setGroups] = useState<GroupsState>(defaultGroups);
  const groupsRef = useRef(groups);
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileGroupsOpen, setMobileGroupsOpen] = useState<Record<string, boolean>>({});
  const [editing, setEditing] = useState(false);
  const [addingGroup, setAddingGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [linkDraft, setLinkDraft] = useState<{ groupId: string; label: string; url: string } | null>(null);
  const [editingLinkId, setEditingLinkId] = useState<string | null>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const pushedLayout = useRef(false);
  const layoutTimer = useRef<number | null>(null);
  const pendingLayout = useRef<AdminMenuLayout | null>(null);

  const countBookings = useServerFn(countSubmittedBookings);
  const { data: bookingStats } = useQuery({
    queryKey: ["admin", "submitted-count"],
    queryFn: () => countBookings(),
    refetchInterval: 30_000,
    enabled: resolvedRole === "admin" || resolvedRole === "staff",
  });
  const bookingCount = bookingStats?.count ?? 0;

  const queryClient = useQueryClient();
  const fetchLayout = useServerFn(getAdminMenuLayout);
  const pushLayout = useServerFn(saveAdminMenuLayout);
  const { data: storedLayout } = useQuery({
    queryKey: LAYOUT_QUERY_KEY,
    queryFn: () => fetchLayout(),
    enabled: resolvedRole === "admin" || resolvedRole === "staff",
  });

  const allowedTabIds = useMemo(
    () => new Set(isStaff ? staffTabs ?? context?.staffTabs ?? [] : ALL_TABS.map((tab) => tab.id)),
    [context?.staffTabs, isStaff, staffTabs],
  );
  const byId = useMemo(() => new Map(ALL_TABS.map((tab) => [tab.id, tab] as const)), []);
  const isActive = (url: string) => (url === "/admin" ? pathname === "/admin" : pathname === url || pathname.startsWith(`${url}/`));

  useEffect(() => {
    const local = loadGroups();
    groupsRef.current = local;
    setGroups(local);
  }, []);

  useEffect(() => {
    if (!storedLayout || pushedLayout.current) return;
    const next = normaliseGroups(storedLayout.groups);
    groupsRef.current = next;
    setGroups(next);
    try {
      window.localStorage.setItem(GROUPS_KEY, JSON.stringify(next));
    } catch {}
  }, [storedLayout]);

  useEffect(() => {
    setOpenGroup(null);
    setMobileOpen(false);
    setEditing(false);
    setLinkDraft(null);
  }, [pathname]);

  useEffect(() => {
    if (!openGroup) return;
    const close = (event: MouseEvent) => {
      if (!barRef.current?.contains(event.target as Node)) setOpenGroup(null);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenGroup(null);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", escape);
    };
  }, [openGroup]);

  useEffect(() => {
    if (!mobileOpen) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  function flushLayout() {
    if (layoutTimer.current) window.clearTimeout(layoutTimer.current);
    layoutTimer.current = null;
    const next = pendingLayout.current;
    if (!next) return;
    pendingLayout.current = null;
    pushLayout({ data: next }).catch((error) => {
      toast.error(error instanceof Error ? error.message : "Menu changes could not be saved");
    });
  }

  function persist(next: GroupsState) {
    groupsRef.current = next;
    setGroups(next);
    try {
      window.localStorage.setItem(GROUPS_KEY, JSON.stringify(next));
    } catch {}
    pushedLayout.current = true;
    const layout: AdminMenuLayout = { groups: next, favorites: [] };
    pendingLayout.current = layout;
    queryClient.setQueryData(LAYOUT_QUERY_KEY, layout);
    if (layoutTimer.current) window.clearTimeout(layoutTimer.current);
    layoutTimer.current = window.setTimeout(flushLayout, 400);
  }

  useEffect(() => () => flushLayout(), []);

  function cloneGroups() {
    return groupsRef.current.map((group) => ({
      ...group,
      tabIds: [...group.tabIds],
      customLinks: [...(group.customLinks ?? [])],
    }));
  }

  function renameGroup(group: GroupEntry) {
    const current = groupMeta(group).label;
    const label = window.prompt("Main heading name", current)?.trim();
    if (!label) return;
    const next = cloneGroups();
    const target = next.find((item) => item.id === group.id);
    if (target) target.label = label;
    persist(next);
  }

  function addGroup() {
    const label = newGroupName.trim();
    if (!label) return;
    persist([...cloneGroups(), { id: `c-${Date.now().toString(36)}`, label, tabIds: [], customLinks: [] }]);
    setNewGroupName("");
    setAddingGroup(false);
  }

  function removeGroup(group: GroupEntry) {
    const next = cloneGroups();
    const fallback = next.find((item) => item.id === STANDALONE_ID) ?? next.find((item) => item.id !== group.id);
    if (!fallback) return;
    fallback.tabIds.push(...group.tabIds);
    fallback.customLinks = [...(fallback.customLinks ?? []), ...(group.customLinks ?? [])];
    persist(next.filter((item) => item.id !== group.id));
    setOpenGroup(null);
  }

  function moveTab(tabId: string, groupId: string) {
    const next = cloneGroups();
    next.forEach((group) => {
      group.tabIds = group.tabIds.filter((id) => id !== tabId);
    });
    next.find((group) => group.id === groupId)?.tabIds.push(tabId);
    persist(next);
  }

  function saveCustomLink() {
    if (!linkDraft) return;
    const label = linkDraft.label.trim();
    const url = safeCustomUrl(linkDraft.url);
    if (!label || !url) {
      toast.error("Enter a link name and an internal path or full web address");
      return;
    }
    const next = cloneGroups();
    next.forEach((group) => {
      group.customLinks = (group.customLinks ?? []).filter((link) => link.id !== editingLinkId);
    });
    const target = next.find((group) => group.id === linkDraft.groupId);
    if (!target) return;
    target.customLinks = [
      ...(target.customLinks ?? []),
      { id: editingLinkId ?? `link-${Date.now().toString(36)}`, label, url },
    ];
    persist(next);
    setLinkDraft(null);
    setEditingLinkId(null);
  }

  function editCustomLink(groupId: string, link: AdminMenuCustomLink) {
    setEditingLinkId(link.id);
    setLinkDraft({ groupId, label: link.label, url: link.url });
  }

  function removeCustomLink(linkId: string) {
    const next = cloneGroups();
    next.forEach((group) => {
      group.customLinks = (group.customLinks ?? []).filter((link) => link.id !== linkId);
    });
    persist(next);
  }

  function resetGroups() {
    persist(defaultGroups());
    setOpenGroup(null);
    toast.success("Default menu restored");
  }

  if (resolvedRole && resolvedRole !== "admin" && resolvedRole !== "staff") return null;

  const visibleGroups = groups.filter((group) => {
    const hasTab = group.tabIds.some((id) => allowedTabIds.has(id));
    return hasTab || (!isStaff && (group.customLinks?.length || editing));
  });

  function BuiltInRow({ tab, close }: { tab: TabDef; close?: () => void }) {
    const Icon = tab.icon;
    const active = isActive(tab.to);
    return (
      <div className={`group/link flex min-w-0 items-center rounded-md ${active ? "bg-[var(--bg-tertiary)]" : "hover:bg-[var(--bg-tertiary)]"}`}>
        <Link
          to={tab.to}
          onClick={close}
          className={`flex min-h-10 min-w-0 flex-1 items-center gap-2 px-3 py-2 text-sm ${active ? "font-semibold text-[var(--text-primary)]" : "text-[var(--text-secondary)]"}`}
        >
          <Icon className="h-4 w-4 shrink-0 text-[var(--accent)]" />
          <span className="truncate">{tab.label}</span>
          {tab.id === "bookings" && bookingCount > 0 && (
            <span className="ml-auto rounded-full bg-[var(--accent)] px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">{bookingCount}</span>
          )}
          {active && <Check className="ml-auto h-4 w-4 shrink-0 text-[var(--accent-ink)]" />}
        </Link>
        {editing && !isStaff && (
          <select
            aria-label={`Move ${tab.label} to another heading`}
            value={groups.find((group) => group.tabIds.includes(tab.id))?.id ?? STANDALONE_ID}
            onChange={(event) => moveTab(tab.id, event.target.value)}
            className="mr-2 max-w-24 rounded-md border border-[var(--border-default)] bg-[var(--bg-primary)] px-1 py-1 text-[11px] text-[var(--text-secondary)]"
          >
            {groups.map((group) => <option key={group.id} value={group.id}>{groupMeta(group).label}</option>)}
          </select>
        )}
      </div>
    );
  }

  function CustomRow({ groupId, link, close }: { groupId: string; link: AdminMenuCustomLink; close?: () => void }) {
    const external = /^https?:\/\//i.test(link.url);
    const active = !external && isActive(link.url);
    return (
      <div className={`group/link flex items-center rounded-md ${active ? "bg-[var(--bg-tertiary)]" : "hover:bg-[var(--bg-tertiary)]"}`}>
        <a
          href={link.url}
          target={external ? "_blank" : undefined}
          rel={external ? "noopener noreferrer" : undefined}
          onClick={close}
          className={`flex min-h-10 min-w-0 flex-1 items-center gap-2 px-3 py-2 text-sm ${active ? "font-semibold text-[var(--text-primary)]" : "text-[var(--text-secondary)]"}`}
        >
          <Link2 className="h-4 w-4 shrink-0 text-[var(--accent)]" />
          <span className="truncate">{link.label}</span>
          {external && <ExternalLink className="ml-auto h-3.5 w-3.5 text-[var(--text-muted)]" />}
          {active && <Check className="ml-auto h-4 w-4 text-[var(--accent-ink)]" />}
        </a>
        {editing && !isStaff && (
          <div className="mr-1 flex items-center">
            <button type="button" onClick={() => editCustomLink(groupId, link)} className="rounded-md p-2 text-[var(--text-muted)] hover:bg-[var(--bg-primary)] hover:text-[var(--text-primary)]" aria-label={`Edit ${link.label}`}><Pencil className="h-3.5 w-3.5" /></button>
            <button type="button" onClick={() => removeCustomLink(link.id)} className="rounded-md p-2 text-[var(--text-muted)] hover:bg-[var(--bg-primary)] hover:text-[var(--accent-ink)]" aria-label={`Remove ${link.label}`}><Trash2 className="h-3.5 w-3.5" /></button>
          </div>
        )}
      </div>
    );
  }

  function GroupContents({ group, close }: { group: GroupEntry; close?: () => void }) {
    const tabs = group.tabIds.map((id) => byId.get(id)).filter((tab): tab is TabDef => isVisibleTab(tab, allowedTabIds));
    const customLinks = isStaff ? [] : group.customLinks ?? [];
    return (
      <div className="space-y-0.5">
        {tabs.map((tab) => <BuiltInRow key={tab.id} tab={tab} close={close} />)}
        {customLinks.map((link) => <CustomRow key={link.id} groupId={group.id} link={link} close={close} />)}
        {tabs.length === 0 && customLinks.length === 0 && <p className="px-3 py-3 text-sm text-[var(--text-muted)]">No links in this heading.</p>}
        {editing && !isStaff && (
          <button
            type="button"
            onClick={() => { setEditingLinkId(null); setLinkDraft({ groupId: group.id, label: "", url: "" }); }}
            className="mt-1 flex min-h-9 w-full items-center gap-2 rounded-md border border-dashed border-[var(--border-default)] px-3 text-xs font-medium text-[var(--text-secondary)] hover:border-[var(--accent)] hover:text-[var(--text-primary)]"
          >
            <Plus className="h-3.5 w-3.5" /> Add link
          </button>
        )}
      </div>
    );
  }

  return (
    <>
      <div className="px-4 pb-3 lg:hidden">
        <button type="button" onClick={() => setMobileOpen(true)} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-[var(--accent-ink)] px-3 text-sm font-medium text-white" aria-label="Open admin navigation"><Menu className="h-4 w-4" /> Admin menu</button>
      </div>

      <nav ref={barRef} className="relative hidden lg:block" aria-label="Admin portal">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-x-1 gap-y-1 px-3 pb-2">
          {visibleGroups.map((group) => {
            const meta = groupMeta(group);
            const tabs = group.tabIds.map((id) => byId.get(id)).filter((tab): tab is TabDef => isVisibleTab(tab, allowedTabIds));
            const active = tabs.some((tab) => isActive(tab.to)) || (group.customLinks ?? []).some((link) => !/^https?:\/\//i.test(link.url) && isActive(link.url));
            const open = openGroup === group.id;
            const GroupIcon = meta.icon;
            return (
              <div key={group.id} className="relative">
                <button
                  type="button"
                  onClick={() => setOpenGroup(open ? null : group.id)}
                  aria-expanded={open}
                  className={`inline-flex min-h-9 items-center gap-1.5 rounded-lg px-3 text-[13px] font-medium transition-colors ${active ? "bg-[var(--bg-primary)] text-[var(--accent-ink)] shadow-sm" : "text-white/85 hover:bg-white/10 hover:text-white"}`}
                >
                  <GroupIcon className="h-3.5 w-3.5 opacity-75" />
                  {meta.label}
                  <ChevronDown className={`h-3.5 w-3.5 opacity-60 transition-transform ${open ? "rotate-180" : ""}`} />
                </button>
                {open && (
                  <div className="absolute left-0 top-full z-[80] mt-2 w-80 rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] p-2 shadow-xl">
                    <div className="mb-1 flex items-center justify-between border-b border-[var(--border-default)] px-2 pb-2 pt-1">
                      <p className="text-xs font-semibold uppercase text-[var(--text-muted)]">{meta.label}</p>
                      {editing && !isStaff && (
                        <div className="flex items-center gap-1">
                          <button type="button" onClick={() => renameGroup(group)} className="rounded-md p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)]" aria-label={`Rename ${meta.label}`}><Pencil className="h-3.5 w-3.5" /></button>
                          {meta.custom && <button type="button" onClick={() => removeGroup(group)} className="rounded-md p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)]" aria-label={`Remove ${meta.label}`}><Trash2 className="h-3.5 w-3.5" /></button>}
                        </div>
                      )}
                    </div>
                    <GroupContents group={group} close={() => setOpenGroup(null)} />
                  </div>
                )}
              </div>
            );
          })}
          {!isStaff && (
            <button
              type="button"
              onClick={() => { setEditing((value) => !value); setOpenGroup(null); setAddingGroup(false); }}
              className={`ml-auto inline-flex min-h-9 items-center gap-1.5 rounded-lg px-3 text-[13px] font-medium transition-colors ${editing ? "bg-[var(--accent)] text-white" : "text-white/75 hover:bg-white/10 hover:text-white"}`}
              aria-pressed={editing}
            >
              <Settings2 className="h-3.5 w-3.5" /> {editing ? "Done" : "Edit menus"}
            </button>
          )}
        </div>
        {editing && !isStaff && (
          <div className="mx-auto mb-2 flex max-w-[1576px] flex-wrap items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-white">
            <span className="text-xs text-white/65">Open a heading to rename it, move pages, or manage links.</span>
            <button type="button" onClick={() => setAddingGroup((value) => !value)} className="ml-auto inline-flex min-h-8 items-center gap-1.5 rounded-md bg-white/10 px-2.5 text-xs font-medium hover:bg-white/15"><Plus className="h-3.5 w-3.5" /> Add heading</button>
            <button type="button" onClick={resetGroups} className="inline-flex min-h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium text-white/75 hover:bg-white/10 hover:text-white"><RotateCcw className="h-3.5 w-3.5" /> Reset</button>
            {addingGroup && (
              <div className="flex w-full items-center gap-2 pt-1">
                <input autoFocus value={newGroupName} onChange={(event) => setNewGroupName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") addGroup(); }} placeholder="New main heading" className="min-h-9 flex-1 rounded-md border border-white/20 bg-white/10 px-3 text-sm text-white outline-none placeholder:text-white/45 focus:border-[var(--accent)]" />
                <button type="button" onClick={addGroup} className="min-h-9 rounded-md bg-[var(--accent)] px-3 text-xs font-semibold text-white">Add</button>
              </div>
            )}
          </div>
        )}
      </nav>

      <div className={`fixed inset-0 z-[90] lg:hidden ${mobileOpen ? "pointer-events-auto" : "pointer-events-none"}`} aria-hidden={!mobileOpen}>
        <button type="button" aria-label="Close admin navigation" onClick={() => setMobileOpen(false)} className={`absolute inset-0 bg-[var(--text-primary)]/45 backdrop-blur-sm transition-opacity ${mobileOpen ? "opacity-100" : "opacity-0"}`} />
        <aside className={`absolute inset-y-0 left-0 flex w-[min(90vw,360px)] flex-col bg-[var(--bg-secondary)] shadow-xl transition-transform duration-300 ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`} aria-label="Admin navigation">
          <div className="flex min-h-16 items-center justify-between border-b border-[var(--border-default)] px-4">
            <span className="text-base font-semibold text-[var(--text-primary)]">Admin Menu</span>
            <button type="button" onClick={() => setMobileOpen(false)} className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]" aria-label="Close menu"><X className="h-5 w-5" /></button>
          </div>
          <nav className="flex-1 overflow-y-auto p-3" aria-label="Mobile admin portal">
            {visibleGroups.map((group) => {
              const meta = groupMeta(group);
              const tabs = group.tabIds.map((id) => byId.get(id)).filter((tab): tab is TabDef => isVisibleTab(tab, allowedTabIds));
              const active = tabs.some((tab) => isActive(tab.to));
              const open = mobileGroupsOpen[group.id] ?? active;
              const GroupIcon = meta.icon;
              return (
                <div key={group.id} className="border-b border-[var(--border-default)] py-1.5">
                  <button type="button" onClick={() => setMobileGroupsOpen((current) => ({ ...current, [group.id]: !open }))} className={`flex min-h-11 w-full items-center gap-2 rounded-lg px-3 text-sm font-semibold ${active ? "bg-[var(--bg-tertiary)] text-[var(--text-primary)]" : "text-[var(--text-secondary)]"}`}>
                    <GroupIcon className="h-4 w-4 text-[var(--accent)]" /> {meta.label}
                    <ChevronDown className={`ml-auto h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
                  </button>
                  {open && <div className="pl-2 pt-1"><GroupContents group={group} close={() => setMobileOpen(false)} /></div>}
                </div>
              );
            })}
          </nav>
        </aside>
      </div>

      {linkDraft && !isStaff && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-[var(--text-primary)]/45 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={editingLinkId ? "Edit menu link" : "Add menu link"}>
          <div className="w-full max-w-md rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <div><p className="text-lg font-semibold text-[var(--text-primary)]">{editingLinkId ? "Edit link" : "Add link"}</p><p className="text-sm text-[var(--text-muted)]">Add an Admin Panel page path or a full website address.</p></div>
              <button type="button" onClick={() => { setLinkDraft(null); setEditingLinkId(null); }} className="rounded-md p-2 text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)]" aria-label="Close"><X className="h-4 w-4" /></button>
            </div>
            <label className="mb-3 block text-sm font-medium text-[var(--text-primary)]">Link name<input autoFocus value={linkDraft.label} onChange={(event) => setLinkDraft({ ...linkDraft, label: event.target.value })} className="mt-1.5 min-h-11 w-full rounded-md border border-[var(--border-default)] bg-[var(--bg-primary)] px-3 text-sm outline-none focus:border-[var(--accent)]" placeholder="Example: Reports" /></label>
            <label className="mb-3 block text-sm font-medium text-[var(--text-primary)]">Address<input value={linkDraft.url} onChange={(event) => setLinkDraft({ ...linkDraft, url: event.target.value })} onKeyDown={(event) => { if (event.key === "Enter") saveCustomLink(); }} className="mt-1.5 min-h-11 w-full rounded-md border border-[var(--border-default)] bg-[var(--bg-primary)] px-3 text-sm outline-none focus:border-[var(--accent)]" placeholder="/admin/reports or https://example.com" /></label>
            <label className="mb-5 block text-sm font-medium text-[var(--text-primary)]">Main heading<select value={linkDraft.groupId} onChange={(event) => setLinkDraft({ ...linkDraft, groupId: event.target.value })} className="mt-1.5 min-h-11 w-full rounded-md border border-[var(--border-default)] bg-[var(--bg-primary)] px-3 text-sm outline-none focus:border-[var(--accent)]">{groups.map((group) => <option key={group.id} value={group.id}>{groupMeta(group).label}</option>)}</select></label>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => { setLinkDraft(null); setEditingLinkId(null); }} className="min-h-10 rounded-md border border-[var(--border-default)] px-4 text-sm font-medium text-[var(--text-secondary)]">Cancel</button>
              <button type="button" onClick={saveCustomLink} className="min-h-10 rounded-md bg-[var(--accent-ink)] px-4 text-sm font-semibold text-white">Save link</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
