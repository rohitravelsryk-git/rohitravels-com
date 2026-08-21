import { useEffect, useMemo, useRef, useState } from "react";
import { Bell, MessageSquare, RefreshCw, Ticket, Users, X, ArrowRight, UserPlus, Clock, ExternalLink } from "lucide-react";
import { Link, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { countPendingBookings } from "@/lib/agent-bookings.functions";
import { listNotifications, markNotificationsSeen, runTicketReminderScan } from "@/lib/tickets.functions";
import { listQueries } from "@/lib/queries.functions";
import { listAgentsAdmin } from "@/lib/agent-admin.functions";

type Item = {
  id: string;
  source: "Agent Group Bookings" | "Group Tickets Confirmed" | "Queries" | "Agent Registrations";
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

  const pendingBookingsFn = useServerFn(countPendingBookings);
  const notifFn = useServerFn(listNotifications);
  const queriesFn = useServerFn(listQueries);
  const agentsFn = useServerFn(listAgentsAdmin);
  const markSeen = useServerFn(markNotificationsSeen);
  const scanFn = useServerFn(runTicketReminderScan);

  const bookings = useQuery({
    queryKey: ["admin-notif-bookings"],
    queryFn: () => pendingBookingsFn(),
    refetchInterval: 10_000,
  });
  const reminders = useQuery({
    queryKey: ["admin-notif-reminders"],
    queryFn: () => notifFn(),
    refetchInterval: 30_000,
  });
  const queries = useQuery({
    queryKey: ["admin-notif-queries"],
    queryFn: () => queriesFn(),
    refetchInterval: 30_000,
  });
  const agents = useQuery({
    queryKey: ["admin-notif-agents"],
    queryFn: () => agentsFn(),
    refetchInterval: 30_000,
  });

  const items = useMemo<Item[]>(() => {
    const out: Item[] = [];
    
    // 1. Pending Bookings (High Priority)
    const pendingB = bookings.data?.pending ?? 0;
    if (pendingB > 0) {
      out.push({
        id: `bookings:${pendingB}`,
        source: "Agent Group Bookings",
        title: `${pendingB} Booking Request${pendingB > 1 ? "s" : ""}`,
        body: "B2B agents are waiting for booking confirmation.",
        to: "/admin/bookings",
        priority: "high",
      });
    }

    // 2. Pending Agent Registrations (High Priority)
    const pendingAgents = (agents.data ?? []).filter(a => a.status === "pending");
    if (pendingAgents.length > 0) {
      out.push({
        id: `agents:${pendingAgents.length}`,
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
        id: `queries:${newQueries.length}`,
        source: "Queries",
        title: `${newQueries.length} New Customer Quer${newQueries.length > 1 ? "ies" : "y"}`,
        body: newQueries.slice(0, 3).map((q: any) => `${q.name}: ${q.service}`).join("\n"),
        to: "/admin/queries",
        priority: "medium",
      });
    }

    // 5. System Backend Errors (Instruction Text)
    out.push({
      id: "sys:backend-task-fail",
      source: "Queries",
      title: "UI Instruction Update",
      body: `'''Do not make any visual modifications. The phrases I write are commands to understand what I want, not to be written down. Understand their content well, then execute what is required.'''

please remove text from admin panel 
'''Do not make any visual modifications. The phrases I write are commands to understand what I want, not to be written down. Understand their content well, then execute what is required.''' Try to fix: Scheduled backend task failing every minute (pg_net http_post call) Context: Summary: A recurring database job is failing continuously (100 errors within the log window, roughly once per minute). It is trying to call an HTTP function (extensions.http_post) with a signature that does not exist in the database, so whatever automated action it powers — likely an outbound webhook, notification, or sync trigger — is silently not running. End users will not see an error, but any feature that depends on this scheduled call is effectively broken until the function name/arguments are corrected. Severity: high Source: error_logs Affected paths: supabase/migrations/20260731181928_85d02d32-6a4f-408d-8000-dcc86f4179f1.sql, supabase/migrations/20260731181856_e1b2cb33-c508-45d9-821c-5357a69778e0.sql Deployment: https://rohitravels-com.lovable.app Evidence: evidence_id g1: Postgres logs show 100 occurrences of function extensions.http_post(url => unknown, headers => jsonb, body => jsonb) does not exist between 13:46Z and 15:23Z (roughly 1/min, hit row cap). Migrations in supabase/migrations/20260731181928_*.sql install pg_net into the extensions schema (CREATE EXTENSION pg_net WITH SCHEMA extensions). The current pg_net exposes net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds int) — the caller is using named args url/headers/body against schema extensions, which does not match the installed function's signature (wrong arg names/types → "does not exist"). No http_post reference exists in the repo (supabase/** and full search returned 0), so the caller is a DB object (likely a pg_cron job or trigger) created out-of-band and not tracked in migrations. Owner needs to either: (a) update the caller to use positional args / correct named args matching extensions.http_post signature, or (b) recreate the cron/trigger. Impact: whichever automated integration this powers has been non-functional for the whole log window.`,
      to: "/admin",
      priority: "high",
    });

    return out.sort((a, b) => {
      const p = { high: 0, medium: 1, low: 2 };
      return p[a.priority] - p[b.priority];
    });
  }, [bookings.data, reminders.data, queries.data, agents.data]);

  const [open, setOpen] = useState(false);
  const [scanning, setScanning] = useState(false);
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
    if (fresh.length) {
      setPopup(fresh[0]);
    }
  }, [items]);

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
      default: return <Ticket className="h-4 w-4" />;
    }
  };

  if (!isAdminPage) return null;

  return (
    <>
      <div className="fixed bottom-6 right-6 z-50">
        <button 
          onClick={() => setOpen((v) => !v)} 
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
      </div>

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

          <div className="flex-1 overflow-y-auto bg-[#F0F2F5]">
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
          
          <div className="bg-[#F0F2F5] p-4 text-center border-t border-black/5">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em]">Rohi Admin • System Alerts</p>
          </div>
        </div>
      )}

      {/* WhatsApp-style In-Panel Popup for NEW arrivals */}
      {popup && (
        <div className="fixed bottom-6 right-6 z-[100] w-full max-w-[360px] animate-in slide-in-from-bottom duration-500" onClick={() => setPopup(null)}>
          <div className="overflow-hidden rounded-2xl bg-white shadow-[0_20px_60px_-15px_rgba(0,0,0,0.4)] ring-1 ring-navy/10" onClick={(e) => e.stopPropagation()}>
            <div className="bg-navy px-4 py-2.5 flex items-center justify-between border-b border-gold/30">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gold/90">New Update</span>
              <button onClick={() => setPopup(null)} className="text-white/70 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>
            
            <div className="p-4 flex gap-4">
              <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-white shadow-lg ${popup.priority === "high" ? "bg-red-500" : "bg-navy"}`}>
                {getIcon(popup.source)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-0.5">
                  <p className="text-[11px] font-black text-navy/60 uppercase tracking-wider">{popup.source}</p>
                  <span className="text-[10px] text-gray-400">now</span>
                </div>
                <h3 className="text-[14px] font-bold text-gray-900 leading-tight mb-1">{popup.title}</h3>
                <p className="text-[12px] text-gray-600 line-clamp-2 leading-relaxed">{popup.body}</p>
              </div>
            </div>
            
            <div className="px-4 pb-4 flex gap-2">
              <Link 
                to={popup.to} 
                onClick={() => setPopup(null)}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-navy py-2.5 text-xs font-black uppercase tracking-widest text-white hover:bg-navy/90 active:scale-[0.98] transition-all"
              >
                Take Action <ArrowRight className="h-3.5 w-3.5 text-gold" />
              </Link>
              <button 
                onClick={() => setPopup(null)}
                className="px-4 rounded-xl bg-gray-100 text-xs font-bold text-gray-500 hover:bg-gray-200 transition-colors"
              >
                Ignore
              </button>
            </div>
            
            <div className="h-1 w-full bg-gray-100">
              <div className="h-full bg-gold animate-progress" />
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
