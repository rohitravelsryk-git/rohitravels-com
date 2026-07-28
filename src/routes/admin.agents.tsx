import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listAgentsAdmin, setAgentStatusAdmin, type AgentRow } from "@/lib/agent-admin.functions";
import { checkAdminUnlocked } from "@/lib/fares.functions";
import { AdminTabs } from "@/components/AdminTabs";
import { AdminHeaderExtras } from "@/components/AdminHeaderExtras";
import { Link } from "@tanstack/react-router";
import { useState } from "react";

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

  const rows = (q.data ?? []).filter((a) => filter === "all" || a.status === filter);
  const pendingCount = (q.data ?? []).filter((a) => a.status === "pending").length;

  return (
    <div className="min-h-screen bg-secondary/30">
      <header className="bg-navy text-white">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div>
            <h1 className="text-lg font-bold">Manage Agents</h1>
            <p className="text-xs text-white/60">Approve or reject B2B agency registrations</p>
          </div>
          <div className="flex flex-wrap gap-2"><AdminHeaderExtras /></div>
        </div>
        <AdminTabs />
      </header>

      <main className="mx-auto max-w-[1600px] p-4">
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
                {["Agency", "Contact", "Email", "Phone", "City", "Registered", "Status", "Actions"].map((h) => (
                  <th key={h} className="px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {q.isLoading ? (
                <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">Loading…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">No agents found.</td></tr>
              ) : (
                rows.map((a: AgentRow, i) => (
                  <tr key={a.user_id} className={i % 2 ? "bg-secondary/40" : "bg-card"}>
                    <td className="px-3 py-3 font-semibold text-navy">{a.agency_name}</td>
                    <td className="px-3 py-3">{a.contact_person}</td>
                    <td className="px-3 py-3">
                      <a href={`mailto:${a.email}`} className="text-navy hover:underline">{a.email}</a>
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">{a.country_code} {a.cell_number}</td>
                    <td className="px-3 py-3">{a.city}</td>
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
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <p className="mt-3 text-xs text-muted-foreground">
          You'll also receive an email with one-click Approve/Reject links whenever a new agency registers.
        </p>
      </main>
    </div>
  );
}
