import { useEffect, useMemo, useRef, useState } from "react";
import { Bell, MessageSquare, RefreshCw, Ticket, Users, X, ArrowRight, UserPlus, Info, Upload, BellRing } from "lucide-react";
import { Link, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { countPendingBookings, countPaymentSlipsAwaiting } from "@/lib/agent-bookings.functions";
import { listNotifications, markNotificationsSeen, runTicketReminderScan } from "@/lib/tickets.functions";
import { listQueries } from "@/lib/queries.functions";
import { listAgentsAdmin } from "@/lib/agent-admin.functions";
import { checkAdminUnlocked } from "@/lib/fares.functions";
import { supabase } from "@/integrations/supabase/client";


type Item = {
  id: string;
  source: "Agent Group Bookings" | "Group Tickets Confirmed" | "Queries" | "Agent Registrations" | "Payment Slips";
  title: string;
  body: string;
  to: string;
  at?: string;
  priority: "high" | "medium" | "low";
};

/**
 * The unified admin notification centre — now with WhatsApp-style visual hierarchy.
 * Merges everything: bookings, tickets, queries, and agent registrations.
 */
export function AdminNotifications() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isAdminPage = pathname.startsWith("/admin");
  const queryClient = useQueryClient();

  const pendingBookingsFn = useServerFn(countPendingBookings);
  const slipsFn = useServerFn(countPaymentSlipsAwaiting);
  const notifFn = useServerFn(listNotifications);
  const queriesFn = useServerFn(listQueries);
  const agentsFn = useServerFn(listAgentsAdmin);
  const markSeen = useServerFn(markNotificationsSeen);
  const scanFn = useServerFn(runTicketReminderScan);
  const unlockedFn = useServerFn(checkAdminUnlocked);

  // The notification server functions all require an unlocked admin session.
  // Only fetch once that session actually exists, otherwise they throw
  // `Unauthorized` on every public page (this component mounts in __root).
  const session = useQuery({
    queryKey: ["admin-notif-session"],
    queryFn: () => unlockedFn(),
    enabled: true,
    // Visitors' browsers were hitting this every 60s forever; only an actual
    // admin session is worth re-checking, and never from a hidden tab.
    refetchInterval: (query) => (query.state.data?.unlocked ? 60_000 : false),
    retry: false,
    staleTime: 60_000,
  });
  // Continue monitoring from any open Rohi website tab while the admin session
  // is active. Native notifications remain visible over other apps and tabs.
  const canFetch = Boolean(session.data?.unlocked);

  const bookings = useQuery({
    queryKey: ["admin-notif-bookings"],
    queryFn: () => pendingBookingsFn(),
    refetchInterval: 30_000,
    enabled: canFetch,
    retry: false,
  });
  const slips = useQuery({
    queryKey: ["admin-notif-slips"],
    queryFn: () => slipsFn(),
    refetchInterval: 30_000,
    enabled: canFetch,
    retry: false,
  });
  const reminders = useQuery({
    queryKey: ["admin-notif-reminders"],
    queryFn: () => notifFn(),
    refetchInterval: 30_000,
    enabled: canFetch,
    retry: false,
  });
  const queries = useQuery({
    queryKey: ["admin-notif-queries"],
    queryFn: () => queriesFn(),
    refetchInterval: 30_000,
    enabled: canFetch,
    retry: false,
  });
  const agents = useQuery({
    queryKey: ["admin-notif-agents"],
    queryFn: () => agentsFn(),
    refetchInterval: 60_000,
    enabled: canFetch,
    retry: false,
  });

  useEffect(() => {
    if (!canFetch) return;
    const channel = supabase
      .channel("admin-notification-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "agent_bookings" }, () => {
        void queryClient.invalidateQueries({ queryKey: ["admin-notif-bookings"] });
        void queryClient.invalidateQueries({ queryKey: ["admin-notif-slips"] });
        void queryClient.invalidateQueries({ queryKey: ["admin-bookings"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "queries" }, () => {
        void queryClient.invalidateQueries({ queryKey: ["admin-notif-queries"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "agents" }, () => {
        void queryClient.invalidateQueries({ queryKey: ["admin-notif-agents"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "ticket_notifications" }, () => {
        void queryClient.invalidateQueries({ queryKey: ["admin-notif-reminders"] });
      })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [canFetch, queryClient]);


  const items = useMemo<Item[]>(() => {
    const out: Item[] = [];
    
    // 1. Pending Bookings (High Priority)
    const pendingB = bookings.data?.pending ?? 0;
    if (pendingB > 0) {
      out.push({
        id: `bookings:${bookings.data?.latestId ?? pendingB}`,
        source: "Agent Group Bookings",
        title: `${pendingB} Booking Request${pendingB > 1 ? "s" : ""}`,
        body: "B2B agents are waiting for booking confirmation.",
        to: "/admin/bookings",
        at: bookings.data?.latestAt ?? undefined,
        priority: "high",
      });
    }

    // 1b. Payment slips uploaded by agents, awaiting admin verification (High Priority)
    const awaitingSlips = slips.data?.awaiting ?? 0;
    if (awaitingSlips > 0) {
      out.push({
        id: `slips:${slips.data?.latestId ?? awaitingSlips}:${slips.data?.latestAt ?? ""}`,
        source: "Payment Slips",
        title: `${awaitingSlips} Payment Slip${awaitingSlips > 1 ? "s" : ""} Uploaded`,
        body: `Agents uploaded payment proof for ${(slips.data?.refs ?? []).join(", ") || "recent bookings"} — verify and update payment status.`,
        to: "/admin/bookings",
        at: slips.data?.latestAt ?? undefined,
        priority: "high",
      });
    }



    // 2. Pending Agent Registrations (High Priority)
    const pendingAgents = (agents.data ?? []).filter(a => a.status === "pending");
    if (pendingAgents.length > 0) {
      out.push({
        id: `agents:${pendingAgents[0]?.user_id ?? pendingAgents.length}`,
        source: "Agent Registrations",
        title: `${pendingAgents.length} New Agent Registration${pendingAgents.length > 1 ? "s" : ""}`,
        body: pendingAgents.slice(0, 2).map(a => a.agency_name).join(", ") + (pendingAgents.length > 2 ? "..." : ""),
        to: "/admin/agents",
        priority: "high",
      });
    }

    // 3. Ticket Reminders (Medium Priority)
    for (const n of reminders.data ?? []) {
      if (n.seen_at) continue;
      out.push({
        id: n.id,
        source: "Group Tickets Confirmed",
        title: n.title,
        body: n.body,
        to: "/admin/tickets",
        at: n.created_at,
        priority: "medium",
      });
    }

    // 4. New Queries (Medium Priority)
    const newQueries = (queries.data ?? []).filter((q: any) => (q.status ?? "new") === "new");
    if (newQueries.length > 0) {
      out.push({
        id: `queries:${newQueries[0]?.id ?? newQueries.length}`,
        source: "Queries",
        title: `${newQueries.length} New Customer Quer${newQueries.length > 1 ? "ies" : "y"}`,
        body: newQueries.slice(0, 3).map((q: any) => `${q.name}: ${q.service}`).join("\n"),
        to: "/admin/queries",
        priority: "medium",
      });
    }

    return out.sort((a, b) => {
      const p = { high: 0, medium: 1, low: 2 };
      return p[a.priority] - p[b.priority];
    });
  }, [bookings.data, reminders.data, queries.data, agents.data, slips.data]);

  const [open, setOpen] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [popup, setPopup] = useState<Item | null>(null);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("unsupported");
  const seen = useRef<Set<string>>(new Set());
  const boot = useRef(false);
  const previousCounts = useRef({ bookings: 0, agents: 0, queries: 0, slips: 0 });
  const seenStorageKey = "rohi.admin.notifications.seen.v1";

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    setPermission(Notification.permission);
  }, []);

  useEffect(() => {
    const badgeNavigator = navigator as Navigator & {
      setAppBadge?: (contents?: number) => Promise<void>;
      clearAppBadge?: () => Promise<void>;
    };
    if (!canFetch) {
      void badgeNavigator.clearAppBadge?.().catch(() => {});
      return;
    }
    if (items.length > 0) void badgeNavigator.setAppBadge?.(items.length).catch(() => {});
    else void badgeNavigator.clearAppBadge?.().catch(() => {});
  }, [canFetch, items.length]);

  useEffect(() => {
    if (!canFetch || !bookings.isFetched || !reminders.isFetched || !queries.isFetched || !agents.isFetched) return;
    const counts = {
      bookings: bookings.data?.pending ?? 0,
      agents: (agents.data ?? []).filter((agent) => agent.status === "pending").length,
      queries: (queries.data ?? []).filter((query: any) => (query.status ?? "new") === "new").length,
      slips: slips.data?.awaiting ?? 0,
    };
    if (!boot.current) {
      let restored = false;
      try {
        const saved = JSON.parse(window.localStorage.getItem(seenStorageKey) ?? "[]");
        if (Array.isArray(saved) && saved.length > 0) {
          seen.current = new Set(saved.filter((id): id is string => typeof id === "string"));
          restored = true;
        }
      } catch { /* unavailable storage: use this tab's in-memory state */ }
      if (!restored) {
        items.forEach((i) => seen.current.add(i.id));
        try { window.localStorage.setItem(seenStorageKey, JSON.stringify([...seen.current])); } catch {}
      }
      previousCounts.current = counts;
      boot.current = true;
      if (!restored) return;
    }
    const increasedSources = new Set<Item["source"]>();
    if (counts.bookings > previousCounts.current.bookings) increasedSources.add("Agent Group Bookings");
    if (counts.agents > previousCounts.current.agents) increasedSources.add("Agent Registrations");
    if (counts.queries > previousCounts.current.queries) increasedSources.add("Queries");
    if (counts.slips > previousCounts.current.slips) increasedSources.add("Payment Slips");
    previousCounts.current = counts;
    const fresh = items.filter((i) => increasedSources.has(i.source) || !seen.current.has(i.id));
    fresh.forEach((i) => seen.current.add(i.id));
    if (fresh.length) {
      try {
        window.localStorage.setItem(seenStorageKey, JSON.stringify([...seen.current].slice(-100)));
      } catch {}
      const latest = fresh[0];
      setPopup(latest);
      if (typeof Notification !== "undefined" && Notification.permission === "granted") {
        const notification = new Notification(`Rohi Admin · ${latest.title}`, {
          body: `${latest.source}\n${latest.body}`,
          icon: "/favicon.png",
          badge: "/favicon.png",
          tag: latest.id,
          requireInteraction: true,
          silent: false,
        });
        notification.onclick = () => {
          window.focus();
          window.location.assign(latest.to);
          notification.close();
        };
      }
    }
  }, [canFetch, items, bookings.data, bookings.isFetched, reminders.isFetched, agents.data, agents.isFetched, queries.data, queries.isFetched, slips.data, slips.isFetched]);

  async function requestDesktopPermission() {
    if (typeof Notification === "undefined") return;
    try {
      const next = await Notification.requestPermission();
      setPermission(next);
      if (next === "granted") {
        new Notification("Rohi Admin notifications enabled", {
          body: "New bookings, payment slips, registrations, queries and ticket reminders will appear here.",
          icon: "/favicon.png",
          tag: "rohi-admin-notifications-enabled",
        });
      }
    } catch { /* browser blocked permission prompt */ }
  }

  async function togglePanel() {
    setOpen((value) => !value);
    if (permission === "default") await requestDesktopPermission();
  }

  async function runScan() {
    setScanning(true);
    try { await scanFn({ data: {} } as never); } catch { /* ignore */ }
    setScanning(false);
    reminders.refetch();
  }

  const btn = "relative inline-flex items-center gap-2 rounded-md border border-white/20 px-3 py-2 text-xs font-semibold hover:bg-white/10";

  const getIcon = (source: Item["source"]) => {
    switch(source) {
      case "Agent Group Bookings": return <Users className="h-4 w-4" />;
      case "Agent Registrations": return <UserPlus className="h-4 w-4" />;
      case "Queries": return <MessageSquare className="h-4 w-4" />;
      case "Payment Slips": return <Upload className="h-4 w-4" />;
      default: return <Ticket className="h-4 w-4" />;
    }
  };

  if (!canFetch) return null;

  return (
    <>
      {isAdminPage && <div className="fixed bottom-6 right-6 z-[2147483646]">
        <button 
          onClick={togglePanel}
          className="relative flex h-14 w-14 items-center justify-center rounded-full bg-navy text-white shadow-2xl transition-all hover:scale-110 active:scale-95 border-2 border-gold/30"
          title="Admin Notifications"
        >
          <Bell className={`h-6 w-6 ${items.some(i => i.priority === "high") ? "animate-bounce text-gold" : ""}`} /> 
          {items.length > 0 && (
            <span className="absolute -right-1 -top-1 flex h-6 min-w-[24px] items-center justify-center rounded-full bg-red-600 px-1.5 text-xs font-black text-white ring-2 ring-white">
              {items.length}
            </span>
          )}
        </button>
      </div>}

      {isAdminPage && permission === "default" && (
        <div className="fixed bottom-24 right-4 z-[2147483647] w-[calc(100%-2rem)] max-w-sm overflow-hidden rounded-lg border border-border bg-card shadow-2xl">
          <div className="flex items-start gap-3 p-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gold text-gold-foreground">
              <BellRing className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-foreground">Never miss an admin update</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Enable desktop alerts for bookings, payments, agents, queries and ticket reminders.</p>
              <button onClick={requestDesktopPermission} className="mt-3 min-h-11 rounded-md bg-gold px-4 text-xs font-bold text-gold-foreground hover:opacity-90">
                Enable notifications
              </button>
            </div>
          </div>
        </div>
      )}

      {open && (
        <div className="fixed inset-y-0 right-0 z-[60] w-full max-w-[400px] flex flex-col border-l border-border bg-card text-foreground shadow-2xl animate-in slide-in-from-right duration-300">
          <div className="flex items-center justify-between bg-navy px-4 py-4 text-white">
            <div className="flex items-center gap-3">
              <div className="relative">
                <Bell className="h-5 w-5 text-gold" />
                {items.length > 0 && <span className="absolute -right-1 -top-1 block h-2 w-2 rounded-full bg-red-500 ring-1 ring-navy" />}
              </div>
              <div>
                <h2 className="text-xs font-black uppercase tracking-[0.2em]">Latest Updates</h2>
                <p className="text-[10px] text-white/50 tracking-wider">Rohi International Travels</p>
              </div>
            </div>
            <button onClick={() => setOpen(false)} className="rounded-full p-2 hover:bg-white/10 transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto bg-secondary/40">
            <div className="flex flex-wrap gap-2 px-4 py-3 bg-white/50 border-b border-black/5">
              <button
                onClick={runScan}
                disabled={scanning}
                className="inline-flex items-center gap-1.5 rounded-full bg-navy/5 border border-navy/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-navy hover:bg-navy/10 disabled:opacity-50"
              >
                <RefreshCw className={`h-3 w-3 ${scanning ? "animate-spin" : ""}`} /> Scan Reminders
              </button>
              {(reminders.data ?? []).some((n) => !n.seen_at) && (
                <button
                  onClick={async () => { try { await markSeen({ data: {} }); } catch { /* ignore */ } reminders.refetch(); }}
                  className="rounded-full bg-navy/5 border border-navy/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-navy hover:bg-navy/10"
                >
                  Clear Reminders
                </button>
              )}
            </div>

            {items.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
                <div className="h-16 w-16 rounded-full bg-gray-200 flex items-center justify-center mb-4">
                  <Bell className="h-8 w-8 text-gray-400" />
                </div>
                <h3 className="text-sm font-bold text-gray-800">No new notifications</h3>
                <p className="text-xs text-gray-500 mt-1">Check back later for new updates and requests.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {items.map((i) => (
                  <div key={i.id} className="relative bg-white px-4 py-4 hover:bg-gray-50 transition-colors group">
                    <div className="flex gap-4">
                      <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-white shadow-md ring-2 ring-white ${i.priority === "high" ? "bg-red-500" : "bg-navy"}`}>
                        {getIcon(i.source)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between mb-0.5">
                          <span className={`text-[10px] font-black uppercase tracking-wider ${i.priority === "high" ? "text-red-600" : "text-navy/60"}`}>
                            {i.source}
                          </span>
                          <span className="text-[10px] text-gray-400">
                            {i.at ? new Date(i.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'now'}
                          </span>
                        </div>
                        <h4 className="text-sm font-bold text-gray-900 mb-1">{i.title}</h4>
                        <p className="text-xs text-gray-600 line-clamp-2 leading-relaxed">{i.body}</p>
                        
                        <div className="mt-3 flex gap-2">
                          <Link 
                            to={i.to} 
                            onClick={() => setOpen(false)}
                            className="inline-flex items-center gap-1.5 rounded-full bg-gold px-4 py-1.5 text-[10px] font-black uppercase tracking-widest text-gold-foreground shadow-sm hover:bg-gold/90 transition-all active:scale-95"
                          >
                            Open Details <ArrowRight className="h-3 w-3" />
                          </Link>
                        </div>
                      </div>
                      {i.priority === "high" && (
                        <div className="absolute top-4 right-4 h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          <div className="bg-secondary/40 p-4 text-center border-t border-border">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em]">Rohi Admin • System Alerts</p>
          </div>
        </div>
      )}

      {/* Compact card popup for NEW arrivals */}
      {popup && (
        <div className="fixed bottom-4 right-4 z-[2147483647] w-[calc(100%-2rem)] max-w-[440px] animate-in slide-in-from-bottom-4 duration-300 sm:bottom-6 sm:right-6">
          <div className="overflow-hidden rounded-lg border border-border bg-card shadow-2xl">
            <div className="flex items-center justify-between border-b border-border bg-gold px-4 py-2.5 text-gold-foreground">
              <div className="flex items-center gap-2 text-xs font-bold">
                <Info className="h-4 w-4" />
                <span>{popup.source}</span>
              </div>
              <button
                onClick={() => setPopup(null)}
                aria-label="Dismiss"
                className="flex h-8 w-8 items-center justify-center rounded-full text-gold-foreground transition-colors hover:bg-primary/10"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex items-center gap-3 p-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                {getIcon(popup.source)}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-bold leading-snug text-foreground">{popup.title}</h3>
                <p className="mt-1 line-clamp-3 text-xs leading-relaxed text-muted-foreground">{popup.body}</p>
                <Link
                  to={popup.to}
                  onClick={() => setPopup(null)}
                  className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-md bg-primary px-4 text-xs font-bold text-primary-foreground transition-opacity hover:opacity-90 active:scale-[0.98]"
                >
                  Take action <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>

            <div className="h-1 w-full bg-muted">
              <div className="h-full w-full bg-gold" />
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes progress {
          from { width: 100%; }
          to { width: 0%; }
        }
        .animate-progress {
          animation: progress 8s linear forwards;
        }
      `}</style>
    </>
  );
}
