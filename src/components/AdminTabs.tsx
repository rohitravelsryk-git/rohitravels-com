import { useEffect, useRef, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { GripVertical } from "lucide-react";
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

export function AdminTabs({ staffTabs }: { staffTabs?: string[] | null }) {
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
  const dragId = useRef<string | null>(null);

  useEffect(() => { setOrder(loadOrder()); }, []);

  const effectiveStaffTabs = staffTabs ?? (ctx?.portalRole === "staff" ? ctx.staffTabs ?? [] : null);
  const isStaff = ctx?.portalRole === "staff" || Boolean(staffTabs);


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

  // Role not resolved yet (or non-admin portal) → render no admin navigation at all.
  if (ctx?.portalRole && ctx.portalRole !== "admin" && ctx.portalRole !== "staff") return null;


  return (
    <div className="mx-auto flex max-w-[1600px] flex-wrap gap-1 px-4">
      {order.map((id) => {
        const t = byId.get(id);
        if (!t) return null;
        // Staff users only see tabs in their allowed list
        if (isStaff && !allowedSet.has(t.id)) return null;
        // Admin-only tabs are hidden from staff
        if (isStaff && t.adminOnly && !allowedSet.has(t.id)) return null;
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
            className={`group flex items-center rounded-t-md border-b-2 ${
              active ? "border-gold bg-white/5 text-gold" : "border-transparent text-white/60 hover:text-white"
            }`}
            title={isStaff ? t.label : "Drag to reorder"}
          >
            {!isStaff && <GripVertical className="ml-1 h-3 w-3 cursor-grab opacity-0 group-hover:opacity-60" />}
            <Link to={t.to} className="px-3 py-2 text-xs font-bold uppercase tracking-widest">
              <Icon className="mr-1.5 inline h-3.5 w-3.5" />
              {t.label}
            </Link>
          </div>
        );
      })}
    </div>
  );
}
