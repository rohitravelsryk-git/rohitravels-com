import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Plane, LogOut, Ticket, Stamp, Link as LinkIcon, MessageSquare,
  Trash2, MessageCircle, User, Briefcase, CheckCircle2, BarChart3, Paperclip, FileText, Image as ImageIcon,
  Bell, RefreshCw,
} from "lucide-react";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { adminLogout } from "@/lib/fares.functions";
import { listQueries, updateQueryStatus, deleteQuery, type Query } from "@/lib/queries.functions";
import { AdminHeaderExtras } from "@/components/AdminHeaderExtras";

export const Route = createFileRoute("/admin/queries")({
  head: () => ({ meta: [{ title: "Queries Admin — Rohi" }] }),
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData({
      queryKey: ["admin-queries"],
      queryFn: () => listQueries(),
    });
  },
  errorComponent: ({ error, reset }) => (
    <div className="p-8 text-center">
      <p className="mb-4 text-destructive">{error.message}</p>
      <button onClick={reset} className="rounded bg-navy px-4 py-2 text-white">
        Retry
      </button>
    </div>
  ),
  notFoundComponent: () => <div className="p-8">Not found</div>,
  component: AdminQueriesPage,
});

function AdminQueriesPage() {
  const router = useRouter();
  const list = useServerFn(listQueries);
  const setStatus = useServerFn(updateQueryStatus);
  const remove = useServerFn(deleteQuery);
  const logout = useServerFn(adminLogout);

  const { data } = useSuspenseQuery({
    queryKey: ["admin-queries"],
    queryFn: () => list(),
    refetchInterval: 30_000,
  });
  const [busy, setBusy] = useState(false);
  const [showChart, setShowChart] = useState(false);
  const [showBell, setShowBell] = useState(false);
  const [scanning, setScanning] = useState(false);
  const lastSeenIdsRef = useRef<Set<string>>(new Set());

  const refresh = () => router.invalidate();

  async function runScan() {
    setScanning(true);
    try {
      await router.invalidate();
    } finally {
      setScanning(false);
    }
  }

  const rows = useMemo(() => data.filter((q) => q.user_type === "customer"), [data]);
  const counts = useMemo(() => ({ customer: rows.length }), [rows]);
  const newRows = useMemo(() => rows.filter((q) => q.status === "new"), [rows]);
  const unreadCount = newRows.length;

  // Desktop notification permission
  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  // Fire a browser notification when a new query appears
  useEffect(() => {
    const known = lastSeenIdsRef.current;
    // First run: seed the set, don't notify.
    if (known.size === 0 && newRows.length > 0) {
      newRows.forEach((q) => known.add(q.id));
      return;
    }
    const fresh = newRows.filter((q) => !known.has(q.id));
    fresh.forEach((q) => known.add(q.id));
    if (fresh.length && typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
      try {
        const q = fresh[0];
        const n = new Notification("New customer query · Rohi Travels", {
          body: `${q.name} · ${q.service}`,
          tag: q.id,
        });
        n.onclick = () => window.focus();
      } catch { /* ignore */ }
    }
  }, [newRows]);



  const chartData = useMemo(() => {
    const map = new Map<string, number>();
    for (const q of rows) map.set(q.service, (map.get(q.service) ?? 0) + 1);
    return Array.from(map.entries())
      .map(([service, count]) => ({ service, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [rows]);

  const CHART_COLORS = ["#c9a34e", "#0f2547", "#1a3a6c", "#c9a34e", "#0f2547"];

  async function onStatus(id: string, status: "new" | "replied" | "closed") {
    setBusy(true);
    try { await setStatus({ data: { id, status } }); refresh(); }
    catch (e: any) { alert(e.message); }
    finally { setBusy(false); }
  }

  async function onDelete(id: string) {
    if (!confirm("Delete this query?")) return;
    setBusy(true);
    try { await remove({ data: { id } }); refresh(); }
    catch (e: any) { alert(e.message); }
    finally { setBusy(false); }
  }

  function toWa(phone: string) {
    const raw = phone.replace(/[^\d]/g, "");
    return raw.startsWith("0") ? "92" + raw.slice(1) : raw;
  }

  function shortNum(q: Query) {
    return q.seq ? `Q-${q.seq}` : "Q-—";
  }

  function waReplyLink(q: Query) {
    const text = encodeURIComponent(
      `*ROHI INTERNATIONAL TRAVELS*\n\nDear ${q.name},\n\nRegarding your inquiry ${shortNum(q)} for *${q.service}*:\n\n`,
    );
    return `https://wa.me/${toWa(q.phone)}?text=${text}`;
  }

  function formatDateTime(iso: string) {
    const d = new Date(iso);
    const day = String(d.getDate()).padStart(2, "0");
    const mon = d.toLocaleString("en-US", { month: "short" }).toLowerCase();
    const yr = String(d.getFullYear()).slice(-2);
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${day}-${mon}-${yr} ${hh}:${mm}`;
  }


  async function onLogout() {
    try { await logout(); } catch {}
    router.navigate({ to: "/admin" });
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-navy text-navy-foreground">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <Plane className="h-5 w-5 -rotate-45 text-gold" />
            <div>
              <p className="font-serif text-lg font-black">Admin Panel</p>
              <p className="text-[10px] tracking-widest text-white/60">Customer queries</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={runScan}
              disabled={scanning}
              className="inline-flex items-center gap-2 rounded-md border border-white/20 px-3 py-2 text-xs font-semibold hover:bg-white/10 disabled:opacity-60"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${scanning ? "animate-spin" : ""}`} /> Scan reminders
            </button>
            <button
              onClick={() => setShowBell((v) => !v)}
              className="relative inline-flex items-center gap-2 rounded-md border border-white/20 px-3 py-2 text-xs font-semibold hover:bg-white/10"
            >
              <Bell className="h-3.5 w-3.5" /> Notifications
              {unreadCount > 0 && (
                <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-black text-white ring-2 ring-navy">
                  {unreadCount}
                </span>
              )}
            </button>
            <AdminHeaderExtras />
            <a href="/" className="rounded-md border border-white/20 px-3 py-2 text-xs font-semibold hover:bg-white/10">View site</a>
            <button onClick={onLogout} className="inline-flex items-center gap-2 rounded-md bg-gold px-3 py-2 text-xs font-bold text-gold-foreground">
              <LogOut className="h-3.5 w-3.5" /> Logout
            </button>
          </div>
        </div>
        <div className="mx-auto flex max-w-[1600px] flex-wrap gap-1 px-4">
          <Link to="/admin" className="rounded-t-md border-b-2 border-transparent px-4 py-2 text-xs font-bold uppercase tracking-widest text-white/60 hover:text-white">
            <Plane className="mr-1.5 inline h-3.5 w-3.5" /> Group Fares
          </Link>
          <Link to="/admin/tickets" className="rounded-t-md border-b-2 border-transparent px-4 py-2 text-xs font-bold uppercase tracking-widest text-white/60 hover:text-white">
            <Ticket className="mr-1.5 inline h-3.5 w-3.5" /> Group Tickets
          </Link>
          <Link to="/admin/group-ticket-format" className="rounded-t-md border-b-2 border-transparent px-4 py-2 text-xs font-bold uppercase tracking-widest text-white/60 hover:text-white">
            Group Ticket Format
          </Link>
          <Link to="/admin/vouchers" className="rounded-t-md border-b-2 border-transparent px-4 py-2 text-xs font-bold uppercase tracking-widest text-white/60 hover:text-white">
            <Ticket className="mr-1.5 inline h-3.5 w-3.5" /> Vouchers
          </Link>
          <Link to="/admin/ok-to-board" className="rounded-t-md border-b-2 border-transparent px-4 py-2 text-xs font-bold uppercase tracking-widest text-white/60 hover:text-white">
            <Stamp className="mr-1.5 inline h-3.5 w-3.5" /> OK TO BOARD
          </Link>
          <Link to="/admin/visa-links" className="rounded-t-md border-b-2 border-transparent px-4 py-2 text-xs font-bold uppercase tracking-widest text-white/60 hover:text-white">
            <LinkIcon className="mr-1.5 inline h-3.5 w-3.5" /> Visa Links
          </Link>
          <Link to="/admin/queries" className="relative rounded-t-md border-b-2 border-gold bg-white/5 px-4 py-2 text-xs font-bold uppercase tracking-widest text-gold">
            <MessageSquare className="mr-1.5 inline h-3.5 w-3.5" /> Queries
            {unreadCount > 0 && (
              <span className="ml-2 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-black text-white">
                {unreadCount}
              </span>
            )}
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-[1600px] px-4 py-6">
        {/* Toolbar */}
        <div className="mb-6 flex items-center gap-2">
          <div className="inline-flex items-center gap-2 rounded-md bg-navy px-4 py-2 text-sm font-bold uppercase tracking-wider text-white">
            <User className="h-4 w-4" /> Queries
            <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px]">{counts.customer}</span>
          </div>
          <button
            onClick={() => setShowChart((v) => !v)}
            className="ml-auto inline-flex items-center gap-2 rounded-md border border-gold bg-gold/10 px-4 py-2 text-xs font-bold uppercase tracking-wider text-navy hover:bg-gold hover:text-navy-foreground"
          >
            <BarChart3 className="h-4 w-4" /> {showChart ? "Hide" : "View"} Analytics
          </button>
        </div>


        {/* Chart (toggleable) */}
        {showChart && (
          <section className="mb-6 rounded-lg border border-navy/10 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-navy">
              <BarChart3 className="h-3.5 w-3.5 text-gold" />
              Most-queried services
            </div>
            {chartData.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No queries yet.</p>
            ) : (
              <div style={{ width: "100%", height: 260 }}>
                <ResponsiveContainer>
                  <BarChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
                    <XAxis dataKey="service" tick={{ fontSize: 11 }} angle={-15} textAnchor="end" height={60} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip cursor={{ fill: "rgba(15,37,71,0.05)" }} />
                    <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                      {chartData.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </section>
        )}

        {/* Table */}
        <div className="overflow-hidden rounded-lg border border-navy/10 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-navy text-[10px] uppercase tracking-widest text-white">
              <tr>
                <th className="px-3 py-2 text-left">Q#</th>
                <th className="px-3 py-2 text-left">Date</th>
                <th className="px-3 py-2 text-left">Passenger Name</th>
                <th className="px-3 py-2 text-left">Phone</th>
                <th className="px-3 py-2 text-left">Service</th>
                <th className="px-3 py-2 text-left">Message</th>
                <th className="px-3 py-2 text-left">Files</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((q) => (
                <tr key={q.id} className="border-t border-navy/5 align-top">
                  <td className="whitespace-nowrap px-3 py-2 text-xs font-bold text-gold">{shortNum(q)}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-xs text-muted-foreground">
                    {formatDateTime(q.created_at)}
                  </td>
                  <td className="px-3 py-2 font-semibold text-navy">{q.name}</td>
                  <td className="whitespace-nowrap px-3 py-2">{q.phone}</td>
                  <td className="px-3 py-2">
                    <span className="rounded bg-gold/20 px-2 py-0.5 text-[11px] font-bold text-navy">
                      {q.service}
                    </span>
                  </td>
                  <td className="max-w-[280px] whitespace-pre-wrap px-3 py-2 text-xs text-navy/80">{q.message}</td>
                  <td className="px-3 py-2">
                    {q.attachments && q.attachments.length > 0 ? (
                      <div className="flex flex-col gap-1">
                        {q.attachments.map((a, i) => (
                          <a
                            key={i}
                            href={a.url ?? "#"}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex max-w-[180px] items-center gap-1 rounded bg-navy/5 px-2 py-1 text-[11px] font-semibold text-navy hover:bg-gold/20"
                            title={a.name}
                          >
                            {a.mime === "application/pdf"
                              ? <FileText className="h-3 w-3 shrink-0" />
                              : <ImageIcon className="h-3 w-3 shrink-0" />}
                            <span className="truncate">{a.name}</span>
                          </a>
                        ))}
                      </div>
                    ) : (
                      <span className="text-[11px] text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <select
                      value={q.status}
                      onChange={(e) => onStatus(q.id, e.target.value as any)}
                      className={`cursor-pointer rounded border border-navy/20 px-2 py-1 pr-6 text-[11px] font-bold uppercase shadow-sm outline-none focus:border-gold ${
                        q.status === "new" ? "bg-red-100 text-red-700"
                        : q.status === "replied" ? "bg-green-100 text-green-700"
                        : "bg-navy/10 text-navy/70"
                      }`}
                      title="Change status"
                    >
                      <option value="new">New</option>
                      <option value="replied">Replied</option>
                      <option value="closed">Closed</option>
                    </select>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="inline-flex gap-1">
                      <a
                        href={waReplyLink(q)}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => q.status === "new" && onStatus(q.id, "replied")}
                        className="inline-flex items-center gap-1 rounded bg-whatsapp px-2 py-1.5 text-[11px] font-bold text-whatsapp-foreground hover:opacity-90"
                        title="Reply on WhatsApp"
                      >
                        <MessageCircle className="h-3 w-3" /> Reply
                      </a>
                      <button
                        onClick={() => onDelete(q.id)}
                        disabled={busy}
                        className="rounded bg-destructive/80 p-1.5 text-white hover:bg-destructive"
                        title="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-3 py-10 text-center text-muted-foreground">
                    <CheckCircle2 className="mx-auto mb-2 h-6 w-6 text-navy/30" />
                    No customer queries yet.
                  </td>
                </tr>
              )}
            </tbody>

          </table>
        </div>
      </div>

      {showBell && (
        <div className="fixed inset-y-0 right-0 z-40 w-full max-w-md overflow-y-auto border-l border-border bg-card shadow-2xl">
          <div className="sticky top-0 flex items-center justify-between border-b border-border bg-navy px-4 py-3 text-white">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-gold" />
              <p className="text-sm font-bold uppercase tracking-widest">Notifications</p>
              <span className="ml-1 rounded-full bg-gold/20 px-2 py-0.5 text-[10px] font-bold text-gold">
                {unreadCount} new
              </span>
            </div>
            <button onClick={() => setShowBell(false)} className="rounded p-1 hover:bg-white/10" aria-label="Close">
              ✕
            </button>
          </div>
          <div className="divide-y divide-border">
            {newRows.length === 0 && (
              <p className="p-6 text-center text-xs text-muted-foreground">
                No new queries. Click "Scan reminders" to check for updates.
              </p>
            )}
            {newRows.map((q) => (
              <div key={q.id} className="p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-bold text-gold">{shortNum(q)}</p>
                  <p className="text-[10px] text-muted-foreground">{formatDateTime(q.created_at)}</p>
                </div>
                <p className="mt-1 text-sm font-semibold text-navy">{q.name}</p>
                <p className="text-[11px] text-muted-foreground">{q.phone} · {q.service}</p>
                <p className="mt-1 line-clamp-3 text-xs text-navy/80">{q.message}</p>
                <div className="mt-2 flex gap-2">
                  <a
                    href={waReplyLink(q)}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => onStatus(q.id, "replied")}
                    className="inline-flex items-center gap-1 rounded bg-whatsapp px-2 py-1 text-[11px] font-bold text-whatsapp-foreground"
                  >
                    <MessageCircle className="h-3 w-3" /> Reply
                  </a>
                  <button
                    onClick={() => onStatus(q.id, "replied")}
                    className="rounded border border-navy/20 px-2 py-1 text-[11px] font-semibold text-navy hover:bg-navy/5"
                  >
                    Mark replied
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
