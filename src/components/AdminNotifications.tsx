import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bell,
  MessageSquare,
  RefreshCw,
  Ticket,
  Users,
  X,
  ArrowRight,
  UserPlus,
  Upload,
  BellRing,
  Sparkles,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Link, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { markNotificationsSeen, runTicketReminderScan } from "@/lib/tickets.functions";
import {
  listAdminNotifications,
  type AdminNotification,
  type AdminNotificationKind,
} from "@/lib/admin-notifications.functions";
import { summarisePending } from "@/lib/assistant.functions";
import { checkAdminUnlocked } from "@/lib/fares.functions";
import { timeAgo } from "@/lib/admin-deeplink";
import { supabase } from "@/integrations/supabase/client";

/** A heads-up stays long enough to read, then slides away by itself. */
const TOAST_MS = 8000;
/** No more than this many notices on screen; the rest wait in the panel. */
const MAX_TOASTS = 3;
const SEEN_KEY = "rohi.admin.notifications.seen.v2";

const ICONS: Record<AdminNotificationKind, LucideIcon> = {
  booking: Users,
  payment: Upload,
  registration: UserPlus,
  query: MessageSquare,
  ticket: Ticket,
};

/**
 * The site-wide notification centre.
 *
 * Every notice is one record waiting on staff — a booking, a payment slip, an
 * enquiry, a registration, a ticket reminder — never a merged "3 bookings"
 * line, and each one opens that exact record with its data already loaded
 * (`/admin/bookings?open=<id>`).
 */
export function AdminNotifications() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isAdminPage = pathname.startsWith("/admin");
  const queryClient = useQueryClient();

  const markSeen = useServerFn(markNotificationsSeen);
  const scanFn = useServerFn(runTicketReminderScan);
  const unlockedFn = useServerFn(checkAdminUnlocked);
  const feedFn = useServerFn(listAdminNotifications);
  const briefFn = useServerFn(summarisePending);

  // The feed needs an unlocked admin session; without one the server answers
  // with an empty list, so polling it from a public page is harmless (this
  // component is mounted in __root).
  const session = useQuery({
    queryKey: ["admin-notif-session"],
    queryFn: () => unlockedFn(),
    enabled: true,
    // Visitors' browsers used to hit this every 60s forever; only an actual
    // admin session is worth re-checking, and never from a hidden tab.
    refetchInterval: (query) => (query.state.data?.unlocked ? 60_000 : false),
    retry: false,
    staleTime: 60_000,
  });
  const canFetch = Boolean(session.data?.unlocked);

  // The AI brief reads the same per-record feed, so it only ever runs for a
  // staff session — a visitor never spends a credit.
  const [brief, setBrief] = useState<string | null>(null);
  const [briefBusy, setBriefBusy] = useState(false);

  const feed = useQuery({
    queryKey: ["admin-notifications"],
    queryFn: () => feedFn(),
    enabled: canFetch,
    refetchInterval: 25_000,
    retry: false,
  });

  // Work handled in another tab or panel drops out of this list the moment its
  // row changes, instead of lingering for the length of a poll.
  useEffect(() => {
    if (!canFetch) return;
    const invalidate = () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-notifications"] });
    };
    const channel = supabase
      .channel("admin-notification-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "agent_bookings" }, invalidate)
      .on("postgres_changes", { event: "*", schema: "public", table: "queries" }, invalidate)
      .on("postgres_changes", { event: "*", schema: "public", table: "agents" }, invalidate)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "ticket_notifications" },
        invalidate,
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [canFetch, queryClient]);

  const items = useMemo(() => feed.data ?? [], [feed.data]);

  const [toasts, setToasts] = useState<AdminNotification[]>([]);
  const [open, setOpen] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">(
    "unsupported",
  );
  const seen = useRef<Set<string>>(new Set());
  const restored = useRef(false);
  const announced = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    setPermission(Notification.permission);
  }, []);

  // A record is announced once and never again — across reloads and in other
  // open tabs — so the stack only ever shows what genuinely just arrived.
  useEffect(() => {
    if (!canFetch || !feed.isFetched) return;
    if (!restored.current) {
      restored.current = true;
      try {
        const saved = JSON.parse(window.localStorage.getItem(SEEN_KEY) ?? "[]");
        if (Array.isArray(saved)) {
          seen.current = new Set(saved.filter((id): id is string => typeof id === "string"));
        }
      } catch {
        /* storage unavailable: this tab's memory will do */
      }
    }

    const incoming = items.filter((i) => !seen.current.has(i.id));
    if (!announced.current) {
      announced.current = true;
      // A browser with no memory of past notices must not be buried under every
      // old request still sitting in the tables: show it the newest few only.
      if (seen.current.size === 0 && incoming.length > MAX_TOASTS) {
        incoming.forEach((i) => seen.current.add(i.id));
        persistSeen();
        setToasts(incoming.slice(0, MAX_TOASTS));
        return;
      }
    }
    if (!incoming.length) return;
    incoming.forEach((i) => seen.current.add(i.id));
    persistSeen();
    setToasts((current) => [...incoming, ...current].slice(0, MAX_TOASTS));

    const latest = incoming[0];
    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      const notification = new Notification(`Rohi · ${latest.name}`, {
        body: `${latest.title}\n${latest.body}`,
        icon: "/favicon.png",
        badge: "/favicon.png",
        tag: latest.id,
        requireInteraction: true,
        silent: false,
      });
      notification.onclick = () => {
        window.focus();
        window.location.assign(`${latest.to}?open=${encodeURIComponent(latest.open)}`);
        notification.close();
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canFetch, feed.isFetched, items]);

  function persistSeen() {
    try {
      window.localStorage.setItem(SEEN_KEY, JSON.stringify([...seen.current].slice(-300)));
    } catch {
      /* storage blocked or full */
    }
  }

  const dismiss = (id: string) => setToasts((current) => current.filter((t) => t.id !== id));

  useEffect(() => {
    if (!canFetch) return;
    const badge = navigator as Navigator & {
      setAppBadge?: (contents?: number) => Promise<void>;
      clearAppBadge?: () => Promise<void>;
    };
    if (items.length) void badge.setAppBadge?.(items.length).catch(() => {});
    else void badge.clearAppBadge?.().catch(() => {});
  }, [canFetch, items.length]);

  async function requestDesktopPermission() {
    if (typeof Notification === "undefined") return;
    try {
      const next = await Notification.requestPermission();
      setPermission(next);
    } catch {
      /* browser blocked the prompt */
    }
  }

  async function togglePanel() {
    setOpen((value) => !value);
    if (permission === "default") await requestDesktopPermission();
  }

  async function runScan() {
    setScanning(true);
    try {
      await scanFn({ data: {} } as never);
    } catch {
      /* ignore */
    }
    setScanning(false);
    void feed.refetch();
  }

  async function clearReminders() {
    const ids = items.filter((i) => i.kind === "ticket").map((i) => i.id.slice("ticket:".length));
    try {
      await markSeen({ data: { ids } });
    } catch {
      /* ignore */
    }
    void feed.refetch();
  }

  async function runBrief() {
    setBriefBusy(true);
    try {
      setBrief(await briefFn());
    } catch (e) {
      setBrief(e instanceof Error ? e.message : "The assistant could not prepare the brief.");
    } finally {
      setBriefBusy(false);
    }
  }

  if (!canFetch) return null;

  return (
    <>
      {/* Heads-up stack: above every page of the site, not only inside the admin
          panel, so a notice cannot be missed wherever the tab happens to be. */}
      <div className="pointer-events-none fixed right-3 top-3 z-[2147483646] flex w-[min(calc(100vw-1.5rem),380px)] flex-col gap-2">
        {toasts.map((n) => (
          <HeadsUp key={n.id} item={n} onDismiss={dismiss} />
        ))}
      </div>

      {isAdminPage && (
        <div className="fixed bottom-6 right-6 z-[2147483645]">
          <button
            onClick={togglePanel}
            className="relative flex h-14 w-14 items-center justify-center rounded-full border-2 border-gold/30 bg-navy text-white shadow-2xl transition-all hover:scale-110 active:scale-95"
            title="Notifications"
          >
            <Bell
              className={`h-6 w-6 ${items.some((i) => i.priority === "high") ? "animate-bounce text-gold" : ""}`}
            />
            {items.length > 0 && (
              <span className="absolute -right-1 -top-1 flex h-6 min-w-[24px] items-center justify-center rounded-full bg-error px-1.5 text-xs font-black text-white ring-2 ring-white">
                {items.length}
              </span>
            )}
          </button>
        </div>
      )}

      {isAdminPage && permission === "default" && (
        <div className="fixed bottom-24 right-4 z-[2147483647] w-[calc(100%-2rem)] max-w-sm overflow-hidden rounded-lg border border-border bg-card shadow-2xl">
          <div className="flex items-start gap-3 p-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gold text-gold-foreground">
              <BellRing className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-foreground">Never miss an admin update</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Enable desktop alerts for bookings, payments, agents, queries and ticket reminders.
              </p>
              <button
                onClick={requestDesktopPermission}
                className="mt-3 min-h-11 rounded-md bg-gold px-4 text-xs font-bold text-gold-foreground hover:opacity-90"
              >
                Enable notifications
              </button>
            </div>
          </div>
        </div>
      )}

      {open && (
        <div className="fixed inset-y-0 right-0 z-[2147483644] flex w-full max-w-[400px] flex-col border-l border-border bg-card text-foreground shadow-2xl">
          <div className="flex items-center justify-between bg-navy px-4 py-4 text-white">
            <div className="flex items-center gap-3">
              <div className="relative">
                <Bell className="h-5 w-5 text-gold" />
                {items.length > 0 && (
                  <span className="absolute -right-1 -top-1 block h-2 w-2 rounded-full bg-error ring-1 ring-navy" />
                )}
              </div>
              <div>
                <h2 className="text-xs font-black uppercase tracking-[0.2em]">Waiting for you</h2>
                <p className="text-[10px] tracking-wider text-white/50">
                  Rohi International Travels
                </p>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="rounded-full p-2 transition-colors hover:bg-white/10"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto bg-secondary/40">
            <div className="flex flex-wrap gap-2 border-b border-black/5 bg-white/50 px-4 py-3">
              <button
                onClick={runScan}
                disabled={scanning}
                className="inline-flex items-center gap-1.5 rounded-full border border-navy/10 bg-navy/5 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-navy hover:bg-navy/10 disabled:opacity-50"
              >
                <RefreshCw className={`h-3 w-3 ${scanning ? "animate-spin" : ""}`} /> Scan Reminders
              </button>
              {items.some((i) => i.kind === "ticket") && (
                <button
                  onClick={clearReminders}
                  className="rounded-full border border-navy/10 bg-navy/5 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-navy hover:bg-navy/10"
                >
                  Clear Reminders
                </button>
              )}
              <button
                onClick={runBrief}
                disabled={briefBusy || !items.length}
                className="inline-flex items-center gap-1.5 rounded-full bg-gold px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-gold-foreground hover:bg-gold/90 disabled:opacity-50"
              >
                <Sparkles className={`h-3 w-3 ${briefBusy ? "animate-pulse" : ""}`} />
                {briefBusy ? "Reading…" : "Today at a glance"}
              </button>
            </div>

            {brief && (
              <div className="mx-4 mb-4 rounded-2xl border border-gold/30 bg-gold/10 p-4">
                <p className="mb-1.5 text-[10px] font-black uppercase tracking-widest text-navy/60">
                  Assistant brief · {items.length} waiting
                </p>
                <p className="whitespace-pre-wrap text-xs leading-relaxed text-foreground">
                  {brief}
                </p>
              </div>
            )}

            {items.length === 0 ? (
              <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-secondary">
                  <Bell className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-sm font-bold text-foreground">Nothing is waiting</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  New bookings, payments, agents and queries appear here the moment they arrive.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {items.map((n) => (
                  <div
                    key={n.id}
                    className="relative bg-card px-4 py-4 transition-colors hover:bg-secondary/60"
                  >
                    <div className="flex gap-4">
                      <NoticeAvatar item={n} />
                      <div className="min-w-0 flex-1">
                        <div className="mb-0.5 flex items-center justify-between gap-2">
                          <span
                            className={`truncate text-[10px] font-black uppercase tracking-wider ${n.priority === "high" ? "text-error" : "text-navy/60"}`}
                          >
                            {n.name}
                          </span>
                          <span className="shrink-0 text-[10px] text-muted-foreground">
                            {timeAgo(n.at)}
                          </span>
                        </div>
                        <h4 className="mb-1 text-sm font-bold text-foreground">{n.title}</h4>
                        <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                          {n.body}
                        </p>
                        <div className="mt-3 flex items-center gap-2">
                          <Link
                            to={n.to}
                            search={{ open: n.open }}
                            onClick={() => setOpen(false)}
                            className="inline-flex items-center gap-1.5 rounded-full bg-gold px-4 py-1.5 text-[10px] font-black uppercase tracking-widest text-gold-foreground shadow-sm transition-all hover:bg-gold/90 active:scale-95"
                          >
                            Open {n.ref} <ArrowRight className="h-3 w-3" />
                          </Link>
                        </div>
                      </div>
                      {n.priority === "high" && (
                        <div className="absolute right-4 top-4 h-2 w-2 animate-pulse rounded-full bg-error" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="border-t border-border bg-secondary/40 p-4 text-center">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Each notice opens that exact record
            </p>
          </div>
        </div>
      )}

      <style>{`@keyframes notif-progress { from { transform: scaleX(1); } to { transform: scaleX(0); } }`}</style>
    </>
  );
}

function NoticeAvatar({ item }: { item: AdminNotification }) {
  const Icon = ICONS[item.kind];
  return (
    <span
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full shadow-md ring-2 ring-white ${
        item.priority === "high" ? "bg-navy text-gold" : "bg-booking-blue-soft text-booking-ink"
      }`}
    >
      <Icon className="h-5 w-5" />
    </span>
  );
}

/**
 * One heads-up notice: WhatsApp's layout — avatar, sender line, message,
 * timestamp, auto-dismiss bar — drawn with this site's navy and gold. Holding
 * the pointer pauses the countdown so nothing vanishes mid-read.
 */
function HeadsUp({
  item,
  onDismiss,
}: {
  item: AdminNotification;
  onDismiss: (id: string) => void;
}) {
  const [paused, setPaused] = useState(false);

  function close(event: React.MouseEvent) {
    // The whole card is a link, so the close button must not navigate as well.
    event.preventDefault();
    event.stopPropagation();
    onDismiss(item.id);
  }

  return (
    <Link
      to={item.to}
      search={{ open: item.open }}
      onClick={() => onDismiss(item.id)}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      className="pointer-events-auto relative block overflow-hidden rounded-[18px] border border-border bg-card shadow-2xl animate-premium-slide"
    >
      <div className="flex items-start gap-3 p-3 pr-9">
        <NoticeAvatar item={item} />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <p className="truncate text-sm font-bold text-navy">{item.name}</p>
            <span className="shrink-0 text-[11px] font-medium text-muted-foreground">
              {timeAgo(item.at)}
            </span>
          </div>
          <p className="mt-0.5 truncate text-[13px] font-semibold text-foreground">{item.title}</p>
          <p className="mt-0.5 line-clamp-2 text-[12.5px] leading-snug text-muted-foreground">
            {item.body}
          </p>
          <div className="mt-2 flex items-center gap-2">
            <span className="rounded-full bg-gold/20 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-navy">
              {item.ref}
            </span>
            <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-navy/50">
              Tap to open <ArrowRight className="h-3 w-3" />
            </span>
          </div>
        </div>
        <button
          onClick={close}
          aria-label="Dismiss"
          className="absolute right-2 top-2 rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <span
        className="absolute bottom-0 left-0 h-[3px] w-full origin-left bg-gold"
        style={{
          animation: `notif-progress ${TOAST_MS}ms linear forwards`,
          animationPlayState: paused ? "paused" : "running",
        }}
        onAnimationEnd={() => onDismiss(item.id)}
      />
    </Link>
  );
}
