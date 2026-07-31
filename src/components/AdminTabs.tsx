import { useEffect, useRef, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Plane, Ticket, FileText, Stamp, Link2, MessageSquare, Megaphone, GripVertical, Users } from "lucide-react";

type TabDef = {
  id: string;
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

const ALL_TABS: TabDef[] = [
  { id: "fares", to: "/admin", label: "Group Fares", icon: Plane },
  { id: "tickets", to: "/admin/tickets", label: "Group Tickets", icon: Ticket },
  { id: "self-groups", to: "/admin/self-groups", label: "Self Groups", icon: Users },
  { id: "agents", to: "/admin/agents", label: "Manage Agents", icon: Users },
  { id: "bookings", to: "/admin/bookings", label: "Agent Bookings", icon: Ticket },
  { id: "ticket-format", to: "/admin/group-ticket-format", label: "Ticket Print Format", icon: FileText },
  { id: "templates", to: "/templates", label: "Templates", icon: FileText },
  { id: "vouchers", to: "/admin/vouchers", label: "Vouchers", icon: Ticket },
  { id: "ok-to-board", to: "/admin/ok-to-board", label: "OK to Board", icon: Stamp },
  { id: "visa-links", to: "/admin/visa-links", label: "Visa Links", icon: Link2 },
  { id: "queries", to: "/admin/queries", label: "Queries", icon: MessageSquare },
  { id: "announcement", to: "/admin/announcement", label: "Latest Updates", icon: Megaphone },
  { id: "backup", to: "/admin/backup", label: "Backup & Recovery", icon: ShieldCheck },

];

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

export function AdminTabs() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [order, setOrder] = useState<string[]>(() => ALL_TABS.map((t) => t.id));
  const dragId = useRef<string | null>(null);

  useEffect(() => { setOrder(loadOrder()); }, []);

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

  return (
    <div className="mx-auto flex max-w-[1600px] flex-wrap gap-1 px-4">
      {order.map((id) => {
        const t = byId.get(id);
        if (!t) return null;
        const active = isActive(t.to);
        const Icon = t.icon;
        return (
          <div
            key={t.id}
            draggable
            onDragStart={() => onDragStart(t.id)}
            onDragOver={(e) => onDragOver(e, t.id)}
            onDrop={onDrop}
            onDragEnd={onDrop}
            className={`group flex items-center rounded-t-md border-b-2 ${
              active ? "border-gold bg-white/5 text-gold" : "border-transparent text-white/60 hover:text-white"
            }`}
            title="Drag to reorder"
          >
            <GripVertical className="ml-1 h-3 w-3 cursor-grab opacity-0 group-hover:opacity-60" />
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
