import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listAgentsAdmin, setAgentStatusAdmin, updateAgentAdmin, type AgentRow } from "@/lib/agent-admin.functions";
import { checkAdminUnlocked } from "@/lib/fares.functions";
import { AdminTabs } from "@/components/AdminTabs";
import { AdminHeaderExtras } from "@/components/AdminHeaderExtras";
import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

export const Route = createFileRoute("/admin/agents")({
  ssr: false,
  head: () => ({
    meta: [{ title: "Manage Agents — Rohi Admin" }],
  }),
  component: AdminAgentsPage,
});

function AdminAgentsPage() {
  const check = useServerFn(checkAdminUnlocked);
  const gate = useQuery({ queryKey: ["admin-unlocked"], queryFn: () => check() });

  if (gate.isLoading) return <div className="p-10 text-center text-white/70">Loading…</div>;
  if (!gate.data?.unlocked) {
    return (
      <div className="min-h-screen bg-navy p-10 text-center text-white">
        <p>Admin session required.</p>
        <Link to="/admin" className="mt-4 inline-block rounded bg-gold px-4 py-2 text-navy font-semibold">Go to admin login →</Link>
      </div>
    );
  }
  return <AgentsInner />;
}

function AgentsInner() {
  const qc = useQueryClient();
  const list = useServerFn(listAgentsAdmin);
  const setStatus = useServerFn(setAgentStatusAdmin);
  const q = useQuery({ queryKey: ["admin-agents"], queryFn: () => list(), refetchInterval: 30000 });
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");

  const mut = useMutation({
    mutationFn: (v: { user_id: string; status: "approved" | "rejected" | "pending" }) => setStatus({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-agents"] }),
  });

  const updateAgent = useServerFn(updateAgentAdmin);
  const [editId, setEditId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, any>>({});
  const saveMut = useMutation({
    mutationFn: (v: any) => updateAgent({ data: v }),
    onSuccess: () => { setEditId(null); qc.invalidateQueries({ queryKey: ["admin-agents"] }); },
    onError: (e: any) => alert(e?.message ?? "Update failed"),
  });


  const rows = (q.data ?? []).filter((a) => filter === "all" || a.status === filter);
  const pendingRows = (q.data ?? []).filter((a) => a.status === "pending");
  const pendingCount = pendingRows.length;

  // Unread tracking + in-panel popup for newly arrived registrations
  const seen = useRef<Set<string>>(new Set());
  const bootstrapped = useRef(false);
  const [popup, setPopup] = useState<AgentRow | null>(null);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!q.data) return;
    if (!bootstrapped.current) {
      pendingRows.forEach((a) => seen.current.add(a.user_id));
      bootstrapped.current = true;
      return;
    }
    const fresh = pendingRows.filter((a) => !seen.current.has(a.user_id));
    fresh.forEach((a) => seen.current.add(a.user_id));
    if (fresh.length) {
      setUnread((n) => n + fresh.length);
      setPopup(fresh[0]!);
    }
  }, [q.data, pendingRows]);

  return (
    <div className="min-h-screen bg-secondary/30">
      <header className="bg-navy text-white">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div>
            <h1 className="text-lg font-bold">Manage Agents</h1>
            <p className="text-xs text-white/60">Approve or reject B2B agency registrations</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => { setUnread(0); setFilter("pending"); }}
              className="relative inline-flex items-center gap-2 rounded-md border border-white/20 px-3 py-2 text-xs font-semibold hover:bg-white/10"
            >
              🔔 New requests
              {unread > 0 && (
                <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-black text-white ring-2 ring-navy">
                  {unread}
                </span>
              )}
            </button>
            <AdminHeaderExtras />
          </div>
        </div>
        <AdminTabs />
      </header>

      <main className="mx-auto max-w-[1600px] p-4">
        <div className="mb-4 flex items-center gap-2">
          <div className="inline-flex items-center gap-2 rounded-md bg-navy px-4 py-2 text-sm font-bold uppercase tracking-wider text-white">
            <Users className="h-4 w-4" /> Manage Agents
            <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px]">{q.data?.length ?? 0}</span>
          </div>
        </div>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {(["all", "pending", "approved", "rejected"] as const).map((f) => {
            const count = f === "all" ? (q.data?.length ?? 0) : (q.data ?? []).filter((a) => a.status === f).length;
            const active = filter === f;
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded-full border px-4 py-1.5 text-xs font-semibold uppercase tracking-wider transition ${
                  active ? "border-navy bg-navy text-white" : "border-border bg-card text-navy hover:bg-secondary"
                }`}
              >
                {f} {count > 0 && <span className={`ml-1 rounded-full px-1.5 py-0.5 text-[10px] ${active ? "bg-white/20" : "bg-navy/10"}`}>{count}</span>}
              </button>
            );
          })}
          {pendingCount > 0 && (
            <span className="ml-auto inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
              🔔 {pendingCount} pending approval{pendingCount === 1 ? "" : "s"}
            </span>
          )}
        </div>

        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <table className="min-w-full text-sm">
            <thead className="bg-navy text-white">
              <tr>
                {["Code", "Agency", "Contact Person", "Email", "Phone", "City", "Registered", "Status", "Actions"].map((h) => (
                  <th key={h} className="px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {q.isLoading ? (
                <tr><td colSpan={9} className="p-8 text-center text-muted-foreground">Loading…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={9} className="p-8 text-center text-muted-foreground">No agents found.</td></tr>
              ) : (

                rows.map((a: AgentRow, i) => {
                  const editing = editId === a.user_id;
                  const inputCls = "w-full min-w-[110px] rounded border border-navy/20 bg-white px-2 py-1 text-xs";
                  return (
                  <tr key={a.user_id} className={i % 2 ? "bg-secondary/40" : "bg-card"}>
                    <td className="px-3 py-3 whitespace-nowrap font-mono text-xs font-bold text-[color:var(--ledger-brown)]">{a.user_code ?? "—"}</td>
                    <td className="px-3 py-3 font-semibold text-navy">
                      {editing
                        ? <input className={inputCls} value={draft.agency_name ?? ""} onChange={(e) => setDraft({ ...draft, agency_name: e.target.value })} />
                        : a.agency_name}
                    </td>
                    <td className="px-3 py-3">
                      {editing
                        ? <input className={inputCls} value={draft.contact_person ?? ""} onChange={(e) => setDraft({ ...draft, contact_person: e.target.value })} />
                        : a.contact_person}
                    </td>

                    <td className="px-3 py-3">
                      <a href={`mailto:${a.email}`} className="text-navy hover:underline">{a.email}</a>
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      {editing ? (
                        <div className="flex gap-1">
                          <input className="w-16 rounded border border-navy/20 bg-white px-2 py-1 text-xs" value={draft.country_code ?? ""} onChange={(e) => setDraft({ ...draft, country_code: e.target.value })} />
                          <input className={inputCls} value={draft.cell_number ?? ""} onChange={(e) => setDraft({ ...draft, cell_number: e.target.value })} />
                        </div>
                      ) : `${a.country_code} ${a.cell_number}`}
                    </td>
                    <td className="px-3 py-3">
                      {editing
                        ? <input className={inputCls} value={draft.city ?? ""} onChange={(e) => setDraft({ ...draft, city: e.target.value })} />
                        : a.city}
                    </td>

                    <td className="px-3 py-3 text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(a.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-3 py-3">
                      <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                        a.status === "approved" ? "bg-emerald-100 text-emerald-700"
                          : a.status === "rejected" ? "bg-red-100 text-red-700"
                          : "bg-amber-100 text-amber-700"
                      }`}>{a.status}</span>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        {a.status !== "approved" && (
                          <button
                            disabled={mut.isPending}
                            onClick={() => mut.mutate({ user_id: a.user_id, status: "approved" })}
                            className="rounded-md bg-emerald-500 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-600 disabled:opacity-50"
                          >✓ Approve</button>
                        )}
                        {a.status !== "rejected" && (
                          <button
                            disabled={mut.isPending}
                            onClick={() => mut.mutate({ user_id: a.user_id, status: "rejected" })}
                            className="rounded-md bg-red-500 px-2.5 py-1 text-xs font-semibold text-white hover:bg-red-600 disabled:opacity-50"
                          >✕ Reject</button>
                        )}
                        {a.status !== "pending" && (
                          <button
                            disabled={mut.isPending}
                            onClick={() => mut.mutate({ user_id: a.user_id, status: "pending" })}
                            className="rounded-md bg-muted px-2.5 py-1 text-xs font-semibold text-navy hover:bg-secondary disabled:opacity-50"
                          >Reset</button>
                        )}
                        {editing ? (
                          <>
                            <button
                              disabled={saveMut.isPending}
                              onClick={() => saveMut.mutate({ ...draft, user_id: a.user_id } as any)}
                              className="rounded-md bg-navy px-2.5 py-1 text-xs font-semibold text-white hover:bg-navy/90 disabled:opacity-50"
                            >Save</button>
                            <button onClick={() => setEditId(null)}
                              className="rounded-md border border-navy/20 px-2.5 py-1 text-xs font-semibold text-navy hover:bg-secondary">Cancel</button>
                          </>
                        ) : (
                          <button
                            onClick={() => { setEditId(a.user_id); setDraft({ ...a }); }}
                            className="rounded-md border border-navy/25 px-2.5 py-1 text-xs font-semibold text-navy hover:bg-secondary"
                          >✎ Edit</button>
                        )}
                      </div>
                    </td>
                  </tr>
                  );
                })

              )}
            </tbody>
          </table>
        </div>

        <p className="mt-3 text-xs text-muted-foreground">
          You'll also receive an email with one-click Approve/Reject links whenever a new agency registers.
        </p>
      </main>

      {popup && (
        <div className="fixed bottom-5 right-5 z-50 w-[340px] overflow-hidden rounded-xl border border-gold/40 bg-card shadow-[0_20px_50px_-15px_rgba(11,37,69,.5)]">
          <div className="flex items-center justify-between bg-navy px-4 py-2.5 text-white">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-gold">New agency registration</p>
            <button onClick={() => setPopup(null)} className="text-white/70 hover:text-white">✕</button>
          </div>
          <div className="p-4">
            <p className="font-serif text-lg font-bold text-navy">{popup.agency_name}</p>
            <p className="text-xs text-muted-foreground">{popup.contact_person} · {popup.city}</p>
            <p className="mt-0.5 font-mono text-[11px] font-bold text-[color:var(--ledger-brown)]">{popup.user_code ?? ""}</p>
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => { mut.mutate({ user_id: popup.user_id, status: "approved" }); setPopup(null); }}
                className="flex-1 rounded-md bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700"
              >✓ Approve</button>
              <button
                onClick={() => { mut.mutate({ user_id: popup.user_id, status: "rejected" }); setPopup(null); }}
                className="flex-1 rounded-md bg-red-600 px-3 py-2 text-xs font-bold text-white hover:bg-red-700"
              >✕ Reject</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

