import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Fragment, useEffect, useMemo, useState } from "react";
import {
  Home,
  Plane,
  LogOut,
  Ticket,
  Stamp,
  Link as LinkIcon,
  MessageSquare,
  Trash2,
  MessageCircle,
  User,
  Briefcase,
  CheckCircle2,
  BarChart3,
  Paperclip,
  FileText,
  Image as ImageIcon,
  Bell,
  RefreshCw,
  Sparkles,
} from "lucide-react";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { adminLogout } from "@/lib/fares.functions";
import { listQueries, updateQueryStatus, deleteQuery, type Query } from "@/lib/queries.functions";
import { AdminHeaderExtras } from "@/components/AdminHeaderExtras";
import { AdminResetButton } from "@/components/AdminResetButton";
import { AdminTabs } from "@/components/AdminTabs";
import { AdminNotifications } from "@/components/AdminNotifications";
import { validateAdminOpen } from "@/lib/admin-deeplink";
import { draftQueryReply } from "@/lib/assistant.functions";
import { formatDateTimeShort } from "@/lib/date-format";

export const Route = createFileRoute("/admin/queries")({
  validateSearch: validateAdminOpen,
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
  const draftReply = useServerFn(draftQueryReply);
  const logout = useServerFn(adminLogout);

  const qc = useQueryClient();
  const { data } = useSuspenseQuery({
    queryKey: ["admin-queries"],
    queryFn: () => list(),
    refetchInterval: 30_000,
  });
  const [busy, setBusy] = useState(false);
  const [showChart, setShowChart] = useState(false);
  const [showBell, setShowBell] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [draftFor, setDraftFor] = useState<{ id: string; text: string } | null>(null);
  const [draftBusy, setDraftBusy] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "new" | "replied" | "closed">("all");

  // An enquiry notice opens this page on ?open=<query id>. There is no details
  // dialog here — the reply and status controls live in the row — so the row is
  // scrolled into view and ringed.
  const { open: openQuery } = Route.useSearch();
  const [highlightQuery, setHighlightQuery] = useState<string | null>(null);
  useEffect(() => {
    if (!openQuery || highlightQuery === openQuery) return;
    const el = document.getElementById(`query-${openQuery}`);
    if (!el) return;
    setHighlightQuery(openQuery);
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openQuery, highlightQuery, data]);

  const refresh = () => router.invalidate();

  async function runScan() {
    setScanning(true);
    try {
      await router.invalidate();
    } finally {
      setScanning(false);
    }
  }

  const allCustomerRows = useMemo(() => data.filter((q) => q.user_type === "customer"), [data]);
  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return allCustomerRows.filter((q) => (statusFilter === "all" || q.status === statusFilter) && (!term || [shortNum(q), q.name, q.phone, q.service, q.message].some((v) => String(v ?? "").toLowerCase().includes(term))));
  }, [allCustomerRows, search, statusFilter]);
  const counts = useMemo(() => ({ customer: allCustomerRows.length, new: allCustomerRows.filter((q) => q.status === "new").length, replied: allCustomerRows.filter((q) => q.status === "replied").length, closed: allCustomerRows.filter((q) => q.status === "closed").length }), [allCustomerRows]);
  const newRows = useMemo(() => allCustomerRows.filter((q) => q.status === "new"), [allCustomerRows]);
  const unreadCount = newRows.length;

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
    try {
      await setStatus({ data: { id, status } });
      refresh();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(id: string) {
    if (!confirm("Delete this query?")) return;
    setBusy(true);
    try {
      await remove({ data: { id } });
      refresh();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setBusy(false);
    }
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

  function waReplyWith(q: Query, body: string) {
    return `https://wa.me/${toWa(q.phone)}?text=${encodeURIComponent(body)}`;
  }

  // Drafts are read-only until it is sent: generating one must not flip the
  // query to "replied", or an unfinished draft hides it from the new list.
  async function onDraft(q: Query) {
    setDraftBusy(q.id);
    try {
      setDraftFor({ id: q.id, text: await draftReply({ data: { id: q.id } }) });
    } catch (e: any) {
      alert(e?.message ?? "Could not draft a reply.");
    } finally {
      setDraftBusy(null);
    }
  }

  function formatDateTime(iso: string) {
    return formatDateTimeShort(iso);
  }

  async function onLogout() {
    try {
      await logout();
    } catch {}
    router.navigate({ to: "/admin" });
  }

  return (
    <div className="min-h-screen bg-background animate-premium-fade">
      <header className="border-b border-[rgba(255,255,255,0.10)] bg-navy text-white">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <Plane className="h-5 w-5 -rotate-45 text-white" />
            <div>
              <p className="font-sans text-lg font-semibold">Admin Panel</p>
              <p className="text-[11px] font-medium text-white/70">Customer queries</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <AdminHeaderExtras />
            <a href="/" className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[13px] font-medium text-white hover:bg-white/20"><Home className="h-3.5 w-3.5" /> Home</a>
            <button onClick={onLogout} className="inline-flex items-center gap-2 rounded-lg bg-[var(--accent)] px-3 py-1.5 text-[13px] font-medium text-white transition-colors hover:bg-[var(--accent-hover)]">
              <LogOut className="h-3.5 w-3.5" /> Logout
            </button>
          </div>
        </div>
        <AdminTabs />
      </header>

      <div className="mx-auto max-w-[1600px] px-4 py-6 space-y-4">
        {/* AdminNotifications is now globally mounted in __root */}
        {/* Toolbar */}
        <div className="flex items-center gap-2">
          <div className="inline-flex items-center gap-2 rounded-md bg-navy px-4 py-2 text-sm font-bold uppercase tracking-wider text-white">
            <User className="h-4 w-4" /> All Queries
            <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px]">
              {counts.customer}
            </span>
          </div>
          <button
            onClick={() => setShowChart((v) => !v)}
            className="inline-flex items-center gap-2 rounded-md border border-gold bg-gold/10 px-4 py-2 text-xs font-bold uppercase tracking-wider text-navy hover:bg-gold hover:text-navy-foreground"
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
                    <XAxis
                      dataKey="service"
                      tick={{ fontSize: 11 }}
                      angle={-15}
                      textAnchor="end"
                      height={60}
                    />
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

        {/* Query controls */}
        <section className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-3 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative min-w-0 flex-1 lg:max-w-xl">
              <MessageSquare className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, phone, service, message or query number…" className="h-10 w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] pl-9 pr-3 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)]" />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {([["all","All",counts.customer],["new","New",counts.new],["replied","Replied",counts.replied],["closed","Closed",counts.closed]] as const).map(([value,label,count]) => (
                <button key={value} type="button" onClick={() => setStatusFilter(value)} className={`inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-[11px] font-extrabold uppercase tracking-wide ${statusFilter === value ? "bg-[#171717] text-white" : "border border-[var(--border-default)] bg-[var(--bg-primary)] text-[var(--text-secondary)]"}`}>
                  {label}<span className="rounded-full bg-black/10 px-1.5 py-0.5 text-[10px]">{count}</span>
                </button>
              ))}
              <button type="button" onClick={runScan} disabled={scanning} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] px-3 text-[11px] font-bold uppercase tracking-wide text-[var(--text-secondary)] hover:border-[var(--accent)] disabled:opacity-60">
                <RefreshCw className={`h-3.5 w-3.5 ${scanning ? "animate-spin" : ""}`} /> Refresh
              </button>
            </div>
          </div>
          {(search || statusFilter !== "all") && <div className="mt-2 flex items-center justify-between border-t border-[var(--border-default)] pt-2 text-[11px] text-[var(--text-muted)]"><span>Showing {rows.length} of {allCustomerRows.length} queries</span><button type="button" onClick={() => { setSearch(""); setStatusFilter("all"); }} className="font-semibold text-[var(--accent-ink)] hover:underline">Clear filters</button></div>}
        </section>

        {/* Table */}
        <div className="overflow-hidden rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] shadow-sm"><div className="max-h-[calc(100vh-300px)] overflow-auto">
          <table className="min-w-[1100px] text-sm">
            <thead className="sticky top-0 z-20 bg-navy text-[10px] uppercase tracking-widest text-white shadow-sm">
              <tr>
                <th className="whitespace-nowrap px-3 py-3 text-left font-extrabold">Q#</th>
                <th className="px-3 py-2 text-left">Date</th>
                <th className="px-3 py-2 text-left">Passenger Name</th>
                <th className="px-3 py-2 text-left">Phone</th>
                <th className="px-3 py-2 text-left">Service</th>
                <th className="px-3 py-2 text-left">Message</th>
                <th className="px-3 py-2 text-left">Files</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="sticky right-0 z-10 bg-[var(--bg-secondary)] px-3 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((q) => (
                <Fragment key={q.id}>
                  <tr
                    id={`query-${q.id}`}
                    className={`border-t align-top ${
                      highlightQuery === q.id
                        ? "bg-warning-soft/60 ring-2 ring-inset ring-gold"
                        : "border-navy/5"
                    }`}
                  >
                    <td className="sticky left-0 whitespace-nowrap bg-white px-3 py-2 text-xs font-bold text-gold">
                      {shortNum(q)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-xs text-muted-foreground">
                      {formatDateTime(q.created_at)}
                    </td>
                    <td className="px-3 py-3 font-semibold text-[var(--text-primary)]">{q.name}</td>
                    <td className="whitespace-nowrap px-3 py-2">{q.phone}</td>
                    <td className="px-3 py-2">
                      <span className="rounded bg-gold/20 px-2 py-0.5 text-[11px] font-bold text-navy">
                        {q.service}
                      </span>
                    </td>
                    <td className="max-w-[280px] whitespace-pre-wrap px-3 py-2 text-xs text-navy/80">
                      {q.message}
                    </td>
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
                              {a.mime === "application/pdf" ? (
                                <FileText className="h-3 w-3 shrink-0" />
                              ) : (
                                <ImageIcon className="h-3 w-3 shrink-0" />
                              )}
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
                          q.status === "new"
                            ? "bg-error-soft text-error"
                            : q.status === "replied"
                              ? "bg-success-soft text-success"
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
                      <div className="inline-flex items-center justify-end gap-1">
                        <button
                          onClick={() => onDraft(q)}
                          disabled={draftBusy === q.id}
                          className="inline-flex items-center gap-1 rounded bg-gold/20 px-2 py-1.5 text-[11px] font-bold text-navy ring-1 ring-inset ring-gold/40 transition hover:bg-gold/30 disabled:opacity-50"
                          title="Draft a reply from our live fares"
                        >
                          <Sparkles className="h-3 w-3" />
                          {draftBusy === q.id ? "Drafting…" : "AI Draft"}
                        </button>
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
                          className="rounded-lg bg-destructive/80 p-2 text-white hover:bg-destructive"
                          title="Delete"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                  {draftFor?.id === q.id && (
                    <tr className="border-b border-navy/5 bg-secondary/40">
                      <td colSpan={9} className="px-3 pb-4">
                        <p className="mb-1 text-center text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                          AI draft · edit anything before sending
                        </p>
                        <textarea
                          value={draftFor.text}
                          onChange={(e) => setDraftFor({ id: q.id, text: e.target.value })}
                          rows={4}
                          maxLength={900}
                          className="w-full rounded border border-navy/20 bg-white p-2 text-xs text-navy outline-none focus:border-gold"
                        />
                        <div className="mt-2 flex flex-wrap gap-1">
                          <a
                            href={waReplyWith(q, draftFor.text)}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={() => q.status === "new" && onStatus(q.id, "replied")}
                            className="inline-flex items-center gap-1 rounded bg-whatsapp px-2 py-1.5 text-[11px] font-bold text-whatsapp-foreground hover:opacity-90"
                          >
                            <MessageCircle className="h-3 w-3" /> Send this draft
                          </a>
                          <button
                            onClick={() =>
                              void navigator.clipboard?.writeText(draftFor.text).catch(() => {})
                            }
                            className="rounded bg-navy/10 px-2 py-1.5 text-[11px] font-bold text-navy hover:bg-navy/20"
                          >
                            Copy
                          </button>
                          <button
                            onClick={() => onDraft(q)}
                            disabled={draftBusy === q.id}
                            className="rounded bg-navy/10 px-2 py-1.5 text-[11px] font-bold text-navy hover:bg-navy/20 disabled:opacity-50"
                          >
                            {draftBusy === q.id ? "Drafting…" : "Try again"}
                          </button>
                          <button
                            onClick={() => setDraftFor(null)}
                            className="rounded bg-navy/10 px-2 py-1.5 text-[11px] font-bold text-navy hover:bg-navy/20"
                          >
                            Close
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
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
          <div className="border-t border-[var(--border-default)] bg-[var(--bg-tertiary)] px-3 py-2 text-[11px] text-[var(--text-muted)]">{rows.length} {rows.length === 1 ? "query" : "queries"} shown · Auto-refreshes every 30 seconds</div>
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
            <button
              onClick={() => setShowBell(false)}
              className="rounded p-1 hover:bg-white/10"
              aria-label="Close"
            >
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
                  <p className="text-[10px] text-muted-foreground">
                    {formatDateTime(q.created_at)}
                  </p>
                </div>
                <p className="mt-1 text-sm font-semibold text-navy">{q.name}</p>
                <p className="text-[11px] text-muted-foreground">
                  {q.phone} · {q.service}
                </p>
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
