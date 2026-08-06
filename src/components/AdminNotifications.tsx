import { useEffect, useMemo, useRef, useState } from "react";
import { Bell, Ticket, Users, X } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { countPendingBookings } from "@/lib/agent-bookings.functions";
import { listNotifications, markNotificationsSeen } from "@/lib/tickets.functions";

type Item = {
  id: string;
  source: "Agent Group Bookings" | "Group Tickets Confirmed";
  title: string;
  body: string;
  to: string;
  at?: string;
};

/**
 * Global admin notification centre — available on every admin tab.
 * Aggregates pending Agent Group Bookings and Group Tickets Confirmed
 * reminders, labels each one with the tab it belongs to, and pops up
 * whenever something new arrives.
 */
export function AdminNotifications() {
  const pendingFn = useServerFn(countPendingBookings);
  const notifFn = useServerFn(listNotifications);
  const markSeen = useServerFn(markNotificationsSeen);

  const bookings = useQuery({
    queryKey: ["admin-notif-bookings"],
    queryFn: () => pendingFn(),
    refetchInterval: 15_000,
  });
  const reminders = useQuery({
    queryKey: ["admin-notif-reminders"],
    queryFn: () => notifFn(),
    refetchInterval: 30_000,
  });

  const items = useMemo<Item[]>(() => {
    const out: Item[] = [];
    const pending = bookings.data?.pending ?? 0;
    if (pending > 0) {
      out.push({
        id: `bookings:${pending}`,
        source: "Agent Group Bookings",
        title: `${pending} booking request${pending > 1 ? "s" : ""} awaiting action`,
        body: "New requests submitted by B2B agents.",
        to: "/admin/bookings",
      });
    }
    for (const n of reminders.data ?? []) {
      if (n.seen_at) continue;
      out.push({
        id: n.id,
        source: "Group Tickets Confirmed",
        title: n.title,
        body: n.body,
        to: "/admin/tickets",
        at: n.created_at,
      });
    }
    return out;
  }, [bookings.data, reminders.data]);

  const [open, setOpen] = useState(false);
  const [popup, setPopup] = useState<Item | null>(null);
  const seen = useRef<Set<string>>(new Set());
  const boot = useRef(false);

  useEffect(() => {
    if (!boot.current) {
      items.forEach((i) => seen.current.add(i.id));
      boot.current = true;
      return;
    }
    const fresh = items.filter((i) => !seen.current.has(i.id));
    fresh.forEach((i) => seen.current.add(i.id));
    if (fresh.length) setPopup(fresh[0]);
  }, [items]);

  const btn = "relative inline-flex items-center gap-2 rounded-md border border-white/20 px-3 py-2 text-xs font-semibold hover:bg-white/10";

  return (
    <>
      <button onClick={() => setOpen((v) => !v)} className={btn}>
        <Bell className="h-3.5 w-3.5" /> Notifications
        {items.length > 0 && (
          <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-black text-white ring-2 ring-navy">
            {items.length}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-y-0 right-0 z-[60] w-full max-w-md overflow-y-auto border-l border-border bg-card text-foreground shadow-2xl">
          <div className="sticky top-0 flex items-center justify-between border-b border-border bg-navy px-4 py-3 text-white">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-gold" />
              <p className="text-sm font-bold uppercase tracking-widest">Admin Panel · Notifications</p>
            </div>
            <button onClick={() => setOpen(false)} className="rounded p-1 hover:bg-white/10"><X className="h-4 w-4" /></button>
          </div>
          {items.length === 0 && <p className="p-6 text-center text-xs text-muted-foreground">Nothing new right now.</p>}
          <div className="divide-y divide-border">
            {items.map((i) => (
              <div key={i.id} className="p-4">
                <p className="inline-flex items-center gap-1 rounded-full bg-navy/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-navy">
                  {i.source === "Agent Group Bookings" ? <Users className="h-3 w-3" /> : <Ticket className="h-3 w-3" />}
                  {i.source}
                </p>
                <p className="mt-1 text-sm font-semibold text-navy">{i.title}</p>
                <p className="whitespace-pre-line text-[11px] text-muted-foreground">{i.body}</p>
                <Link to={i.to} onClick={() => setOpen(false)}
                  className="mt-2 inline-flex rounded bg-gold px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-gold-foreground">
                  Open {i.source}
                </Link>
              </div>
            ))}
          </div>
          {(reminders.data ?? []).some((n) => !n.seen_at) && (
            <div className="p-4">
              <button
                onClick={async () => { try { await markSeen({ data: {} }); } catch { /* ignore */ } reminders.refetch(); }}
                className="w-full rounded-md border border-navy/20 px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-navy hover:bg-navy/5">
                Mark reminders as read
              </button>
            </div>
          )}
        </div>
      )}

      {popup && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4" onClick={() => setPopup(null)}>
          <div className="w-full max-w-md overflow-hidden rounded-xl bg-white text-foreground shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="bg-navy px-5 py-3 text-white">
              <p className="text-[10px] font-black uppercase tracking-widest text-gold">{popup.source}</p>
              <h3 className="font-serif text-lg font-bold">{popup.title}</h3>
            </div>
            <div className="space-y-3 p-5">
              <p className="whitespace-pre-line text-xs text-muted-foreground">{popup.body}</p>
              <div className="flex justify-end gap-2">
                <button onClick={() => setPopup(null)} className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold">Dismiss</button>
                <Link to={popup.to} onClick={() => setPopup(null)}
                  className="rounded-md bg-gold px-3 py-1.5 text-xs font-black uppercase tracking-wider text-gold-foreground">
                  Open
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
