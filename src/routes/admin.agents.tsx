import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  listAgentsAdmin, 
  setAgentStatusAdmin, 
  updateAgentAdmin, 
  deleteAgentAdmin, 
  createAgentAdmin, 
  type AgentRow, 
  setRegistrationVisibility, 
  getRegistrationVisibility 
} from "@/lib/agent-admin.functions";
import { checkAdminUnlocked } from "@/lib/fares.functions";
import { AdminTabs } from "@/components/AdminTabs";
import { AdminHeaderExtras } from "@/components/AdminHeaderExtras";
import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Users, Plus, Trash2, X, Check, AlertCircle } from "lucide-react";

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
  const setVisibility = useServerFn(setRegistrationVisibility);
  const getVisibility = useServerFn(getRegistrationVisibility);
  const deleteAgent = useServerFn(deleteAgentAdmin);
  const createAgent = useServerFn(createAgentAdmin);

  const q = useQuery({ queryKey: ["admin-agents"], queryFn: () => list(), refetchInterval: 30000 });
  const visibilityQ = useQuery({ queryKey: ["admin-registration-visibility"], queryFn: () => getVisibility() });
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");

  const [isAdding, setIsAdding] = useState(false);
  const [newAgent, setNewAgent] = useState<any>({
    agency_name: "", contact_person: "", email: "", city: "", country_code: "+92", cell_number: ""
  });
  const [createdAgent, setCreatedAgent] = useState<{ email: string; pass: string } | null>(null);

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

  const deleteMut = useMutation({
    mutationFn: (user_id: string) => deleteAgent({ data: { user_id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-agents"] }),
    onError: (e: any) => alert(e?.message ?? "Deletion failed"),
  });

  const createMut = useMutation({
    mutationFn: (v: any) => createAgent({ data: v }),
    onSuccess: (res: any) => {
      setCreatedAgent({ email: res.email || newAgent.email, pass: res.tempPassword });
      setIsAdding(false);
      setNewAgent({ agency_name: "", contact_person: "", email: "", city: "", country_code: "+92", cell_number: "" });
      qc.invalidateQueries({ queryKey: ["admin-agents"] });
    },
    onError: (e: any) => alert(e?.message ?? "Creation failed"),
  });


  const rows = (q.data ?? []).filter((a) => filter === "all" || a.status === filter);
  const pendingRows = (q.data ?? []).filter((a) => a.status === "pending");
  const pendingCount = pendingRows.length;



  return (
    <div className="min-h-screen bg-secondary/30">
      <header className="bg-navy text-white">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div>
            <h1 className="text-lg font-bold">Registered Agents</h1>
            <p className="text-xs text-white/60">Manage and approve agency registrations</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <AdminHeaderExtras />
          </div>

        </div>
        <AdminTabs />
      </header>

      <main className="mx-auto max-w-[1600px] p-4">
        <div className="mb-4 flex items-center justify-between">
          <div className="inline-flex items-center gap-2 rounded-md bg-navy px-4 py-2 text-sm font-bold uppercase tracking-wider text-white">
            <Users className="h-4 w-4" /> Registered Agents
            <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px]">{q.data?.length ?? 0}</span>
          </div>
          <button
            onClick={() => setIsAdding(true)}
            className="inline-flex items-center gap-2 rounded-md bg-gold px-4 py-2 text-sm font-bold text-navy hover:bg-gold/90"
          >
            <Plus className="h-4 w-4" /> Register New Agent
          </button>
        </div>

        {createdAgent && (
          <div className="mb-6 flex items-start gap-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800">
            <Check className="mt-1 h-5 w-5 shrink-0" />
            <div className="flex-1">
              <p className="font-bold">Agent created successfully!</p>
              <p className="mt-1 text-sm">Email: <span className="font-mono font-bold">{createdAgent.email}</span></p>
              <p className="text-sm">Temporary Password: <span className="font-mono font-bold">{createdAgent.pass}</span></p>
              <p className="mt-2 text-[10px] uppercase font-black opacity-70">Share these details with the agent for their first login.</p>
            </div>
            <button onClick={() => setCreatedAgent(null)} className="text-emerald-800 hover:text-emerald-900">✕</button>
          </div>
        )}

        {isAdding && (
          <div className="mb-6 overflow-hidden rounded-xl border border-navy/20 bg-card shadow-lg">
            <div className="bg-navy px-6 py-3 text-white">
              <h2 className="text-lg font-serif font-bold">Register New Agency</h2>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Agency Name</label>
                  <input
                    className="w-full rounded border border-navy/20 bg-white px-3 py-2 text-sm focus:border-gold focus:ring-1 focus:ring-gold"
                    placeholder="e.g. Rohi Travels"
                    value={newAgent.agency_name}
                    onChange={(e) => setNewAgent({ ...newAgent, agency_name: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Contact Person</label>
                  <input
                    className="w-full rounded border border-navy/20 bg-white px-3 py-2 text-sm focus:border-gold focus:ring-1 focus:ring-gold"
                    placeholder="Full Name"
                    value={newAgent.contact_person}
                    onChange={(e) => setNewAgent({ ...newAgent, contact_person: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Email Address</label>
                  <input
                    className="w-full rounded border border-navy/20 bg-white px-3 py-2 text-sm focus:border-gold focus:ring-1 focus:ring-gold"
                    placeholder="agent@example.com"
                    type="email"
                    value={newAgent.email}
                    onChange={(e) => setNewAgent({ ...newAgent, email: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">City</label>
                  <input
                    className="w-full rounded border border-navy/20 bg-white px-3 py-2 text-sm focus:border-gold focus:ring-1 focus:ring-gold"
                    placeholder="e.g. Rahim Yar Khan"
                    value={newAgent.city}
                    onChange={(e) => setNewAgent({ ...newAgent, city: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Country Code</label>
                  <input
                    className="w-full rounded border border-navy/20 bg-white px-3 py-2 text-sm focus:border-gold focus:ring-1 focus:ring-gold"
                    placeholder="+92"
                    value={newAgent.country_code}
                    onChange={(e) => setNewAgent({ ...newAgent, country_code: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Phone Number</label>
                  <input
                    className="w-full rounded border border-navy/20 bg-white px-3 py-2 text-sm focus:border-gold focus:ring-1 focus:ring-gold"
                    placeholder="3001234567"
                    value={newAgent.cell_number}
                    onChange={(e) => setNewAgent({ ...newAgent, cell_number: e.target.value })}
                  />
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-3">
                <button
                  onClick={() => setIsAdding(false)}
                  className="rounded-md border border-navy/20 px-6 py-2 text-sm font-bold text-navy hover:bg-secondary"
                >
                  Cancel
                </button>
                <button
                  disabled={createMut.isPending || !newAgent.email || !newAgent.agency_name}
                  onClick={() => createMut.mutate(newAgent)}
                  className="rounded-md bg-navy px-8 py-2 text-sm font-bold text-white hover:bg-navy/90 disabled:opacity-50"
                >
                  {createMut.isPending ? "Creating..." : "Register Agent"}
                </button>
              </div>
            </div>
          </div>
        )}
        <div className="mb-6 rounded-xl border border-border bg-card p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-serif text-lg font-bold text-navy">Registration Page Visibility</p>
              <p className="text-sm text-muted-foreground">Hide or show the agent registration button and links on the website.</p>
            </div>
            <button
              disabled={visibilityQ.isLoading}
              onClick={async () => {
                const current = visibilityQ.data?.visible;
                await setVisibility({ data: { visible: !current } });
                qc.invalidateQueries({ queryKey: ["admin-registration-visibility"] });
                qc.invalidateQueries({ queryKey: ["admin", "status"] });
              }}
              className={`h-7 w-12 rounded-full transition-colors ${visibilityQ.data?.visible ? "bg-navy" : "bg-muted"}`}
            >
              <div className={`h-5 w-5 rounded-full bg-white transition-transform shadow-sm ${visibilityQ.data?.visible ? "translate-x-6" : "translate-x-1"}`} />
            </button>
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
                            title="Allow agent to sign in"
                            onClick={() => mut.mutate({ user_id: a.user_id, status: "approved" })}
                            className="rounded-md bg-emerald-500 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-600 disabled:opacity-50"
                          >✓ Approve</button>
                        )}
                        {a.status !== "rejected" && (
                          <button
                            disabled={mut.isPending}
                            title="Block agent access"
                            onClick={() => mut.mutate({ user_id: a.user_id, status: "rejected" })}
                            className="rounded-md bg-red-500 px-2.5 py-1 text-xs font-semibold text-white hover:bg-red-600 disabled:opacity-50"
                          >✕ Reject</button>
                        )}
                        {a.status !== "pending" && (
                          <button
                            disabled={mut.isPending}
                            title="Move back to pending for review"
                            onClick={() => mut.mutate({ user_id: a.user_id, status: "pending" })}
                            className="rounded-md bg-muted px-2.5 py-1 text-xs font-semibold text-navy hover:bg-secondary disabled:opacity-50"
                          >Set to Pending</button>
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
                        <button
                          disabled={deleteMut.isPending}
                          onClick={() => {
                            if (confirm(`Are you sure you want to delete ${a.agency_name}? This will permanently remove their account and all associated data.`)) {
                              deleteMut.mutate(a.user_id);
                            }
                          }}
                          className="rounded-md bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-600 border border-red-200 hover:bg-red-100 disabled:opacity-50"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
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

    </div>
  );
}

