import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { UserCog, Plus, Trash2, Check, X, ShieldCheck } from "lucide-react";
import { AdminHeaderExtras } from "@/components/AdminHeaderExtras";
import { AdminTabs } from "@/components/AdminTabs";
import { IdleSessionGuard } from "@/components/IdleSessionGuard";
import { adminLogout } from "@/lib/fares.functions";
import {
  listStaffUsers,
  createStaffUser,
  updateStaffUser,
  deleteStaffUser,
  type StaffUser,
} from "@/lib/fares.functions";

export const Route = createFileRoute("/admin/staff")({
  component: StaffAccessPage,
  errorComponent: ({ error }) => (
    <div className="p-8 text-center text-destructive">{error.message}</div>
  ),
});

// Tabs available to assign to staff (subset that makes sense for staff access)
const ASSIGNABLE_TABS = [
  { id: "fares", label: "Group Fares" },
  { id: "self-groups", label: "Self Groups" },
  { id: "ticket-format", label: "Print Group Tickets" },
  { id: "branded-ticket-pdf", label: "Print Tickets" },
  { id: "ok-to-board", label: "OK to Board" },
  { id: "visa-links", label: "Visa Links" },
  { id: "tickets", label: "Group Tickets Confirmed" },
  { id: "agents", label: "Manage Agents" },
  { id: "bookings", label: "Agent Group Bookings" },
  { id: "marketing", label: "Marketing" },
  { id: "vouchers", label: "Vouchers" },
  { id: "queries", label: "Queries" },
  { id: "announcement", label: "Latest Updates" },
  { id: "backup", label: "Backup & Recovery" },
];

function StaffAccessPage() {
  const listFn = useServerFn(listStaffUsers);
  const createFn = useServerFn(createStaffUser);
  const updateFn = useServerFn(updateStaffUser);
  const deleteFn = useServerFn(deleteStaffUser);
  const logoutFn = useServerFn(adminLogout);
  const qc = useQueryClient();

  const { data: staff, isLoading } = useQuery({
    queryKey: ["staff-users"],
    queryFn: () => listFn(),
  });

  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState({ username: "", password: "", allowed_tabs: ["fares", "self-groups", "ticket-format", "branded-ticket-pdf", "ok-to-board", "visa-links"] });
  const [editForm, setEditForm] = useState<Record<string, { password: string; allowed_tabs: string[]; active: boolean }>>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      await createFn({ data: { username: form.username, password: form.password, allowed_tabs: form.allowed_tabs } });
      setShowAdd(false);
      setForm({ username: "", password: "", allowed_tabs: ["fares", "self-groups", "ticket-format", "branded-ticket-pdf", "ok-to-board", "visa-links"] });
      await qc.invalidateQueries({ queryKey: ["staff-users"] });
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleSave(id: string) {
    const ef = editForm[id];
    if (!ef) return;
    setBusy(true);
    setErr(null);
    try {
      await updateFn({ data: { id, allowed_tabs: ef.allowed_tabs, active: ef.active, ...(ef.password ? { password: ef.password } : {}) } });
      setEditing(null);
      setEditForm((p) => { const n = { ...p }; delete n[id]; return n; });
      await qc.invalidateQueries({ queryKey: ["staff-users"] });
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this staff user permanently?")) return;
    setBusy(true);
    try {
      await deleteFn({ data: { id } });
      await qc.invalidateQueries({ queryKey: ["staff-users"] });
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function startEdit(s: StaffUser) {
    setEditing(s.id);
    setEditForm((p) => ({ ...p, [s.id]: { password: "", allowed_tabs: [...s.allowed_tabs], active: s.active } }));
  }

  function toggleTab(list: string[], id: string): string[] {
    return list.includes(id) ? list.filter((t) => t !== id) : [...list, id];
  }

  const logout = async () => { await logoutFn(); window.location.href = "/admin"; };

  return (
    <div className="min-h-screen bg-background">
      <IdleSessionGuard portalName="Admin Panel" idleMs={10 * 60 * 1000} warningMs={10 * 1000} onLogout={logout} />

      {/* Header */}
      <header className="border-b border-border bg-navy text-navy-foreground">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-3 px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gold/20">
              <UserCog className="h-5 w-5 text-gold" />
            </div>
            <div>
              <h1 className="font-serif text-lg font-black uppercase tracking-wider text-gold">Staff Access</h1>
              <p className="text-[10px] uppercase tracking-widest text-white/60">Manage staff users and their permissions</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <AdminHeaderExtras />
            <button onClick={logout} className="inline-flex items-center gap-2 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-bold uppercase tracking-wider text-red-400 hover:bg-red-500/20">
              Logout
            </button>
          </div>
        </div>
        <AdminTabs />
      </header>

      <div className="mx-auto max-w-[1600px] px-4 py-6">
        {err && <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">{err}</div>}

        <div className="mb-4 flex items-center justify-between">
          <p className="max-w-2xl text-sm text-muted-foreground">
            Create staff accounts and select which admin panel tabs each staff member can access.
            Staff users can only see the tabs you assign — everything else is hidden.
          </p>
          <button
            onClick={() => setShowAdd((v) => !v)}
            className="inline-flex items-center gap-2 rounded-md bg-gold px-4 py-2 text-xs font-black uppercase tracking-wider text-gold-foreground hover:opacity-90"
          >
            <Plus className="h-4 w-4" /> Add Staff User
          </button>
        </div>

        {/* Add form */}
        {showAdd && (
          <form onSubmit={handleAdd} className="mb-6 rounded-xl border border-gold/30 bg-card p-6">
            <h3 className="mb-4 font-serif text-base font-bold text-gold">New Staff User</h3>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-muted-foreground">Username</label>
                <input
                  type="text"
                  required
                  value={form.username}
                  onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-navy outline-none focus:border-gold"
                  placeholder="e.g. staff1"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-muted-foreground">Password</label>
                <input
                  type="text"
                  required
                  minLength={4}
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-navy outline-none focus:border-gold"
                  placeholder="Minimum 4 characters"
                />
              </div>
            </div>
            <div className="mt-4">
              <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-muted-foreground">Allowed Tabs</label>
              <div className="flex flex-wrap gap-2">
                {ASSIGNABLE_TABS.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, allowed_tabs: toggleTab(f.allowed_tabs, tab.id) }))}
                    className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition ${
                      form.allowed_tabs.includes(tab.id)
                        ? "border-gold bg-gold/25 text-navy"
                        : "border-input text-muted-foreground hover:text-navy"
                    }`}
                  >
                    {form.allowed_tabs.includes(tab.id) ? <Check className="h-3 w-3" /> : <X className="h-3 w-3 opacity-30" />}
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-5 flex gap-2">
              <button type="submit" disabled={busy} className="rounded-md bg-emerald-600 px-5 py-2 text-xs font-bold uppercase tracking-wider text-white hover:bg-emerald-700 disabled:opacity-50">
                {busy ? "Creating…" : "Create Staff User"}
              </button>
              <button type="button" onClick={() => setShowAdd(false)} className="rounded-md border border-input px-5 py-2 text-xs font-bold uppercase tracking-wider text-muted-foreground hover:bg-secondary">
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* Staff list */}
        {isLoading ? (
          <p className="py-10 text-center text-muted-foreground">Loading staff users…</p>
        ) : !staff || staff.length === 0 ? (
          <div className="rounded-xl border border-border bg-card py-16 text-center">
            <UserCog className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No staff users yet. Click "Add Staff User" to create one.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {staff.map((s) => (
              <div key={s.id} className="rounded-xl border border-border bg-card p-5">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${s.active ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"}`}>
                      <ShieldCheck className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-bold text-navy">{s.username}</p>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        {s.active ? "Active" : "Inactive"} · Created {new Date(s.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {editing === s.id ? (
                      <>
                        <button
                          onClick={() => handleSave(s.id)}
                          disabled={busy}
                          className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-white hover:bg-emerald-700 disabled:opacity-50"
                        >
                          <Check className="mr-1 inline h-3.5 w-3.5" /> Save
                        </button>
                        <button
                          onClick={() => { setEditing(null); setEditForm((p) => { const n = { ...p }; delete n[s.id]; return n; }); }}
                          className="rounded-md border border-input px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground hover:bg-secondary"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => startEdit(s)}
                          className="rounded-md border border-gold/40 bg-gold/10 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-gold hover:bg-gold/20"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(s.id)}
                          disabled={busy}
                          className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-red-400 hover:bg-red-500/20 disabled:opacity-50"
                        >
                          <Trash2 className="mr-1 inline h-3.5 w-3.5" /> Delete
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {editing === s.id && editForm[s.id] ? (
                  <div className="mt-4 space-y-4 border-t border-border pt-4">
                    <div>
                      <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-muted-foreground">New Password (leave blank to keep current)</label>
                      <input
                        type="text"
                        value={editForm[s.id].password}
                        onChange={(e) => setEditForm((p) => ({ ...p, [s.id]: { ...p[s.id], password: e.target.value } }))}
                        className="w-full max-w-xs rounded-lg border border-input bg-background px-3 py-2 text-sm text-navy outline-none focus:border-gold"
                        placeholder="••••••"
                      />
                    </div>
                    <div className="flex items-center gap-3">
                      <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Active</label>
                      <button
                        type="button"
                        onClick={() => setEditForm((p) => ({ ...p, [s.id]: { ...p[s.id], active: !p[s.id].active } }))}
                        className={`rounded-full px-4 py-1 text-xs font-bold ${editForm[s.id].active ? "bg-emerald-600 text-white" : "bg-secondary text-muted-foreground"}`}
                      >
                        {editForm[s.id].active ? "Active" : "Inactive"}
                      </button>
                    </div>
                    <div>
                      <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-muted-foreground">Allowed Tabs</label>
                      <div className="flex flex-wrap gap-2">
                        {ASSIGNABLE_TABS.map((tab) => (
                          <button
                            key={tab.id}
                            type="button"
                            onClick={() => setEditForm((p) => ({ ...p, [s.id]: { ...p[s.id], allowed_tabs: toggleTab(p[s.id].allowed_tabs, tab.id) } }))}
                            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition ${
                              editForm[s.id].allowed_tabs.includes(tab.id)
                                ? "border-gold bg-gold/25 text-navy"
                                : "border-input text-muted-foreground hover:text-navy"
                            }`}
                          >
                            {editForm[s.id].allowed_tabs.includes(tab.id) ? <Check className="h-3 w-3" /> : <X className="h-3 w-3 opacity-30" />}
                            {tab.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {s.allowed_tabs.length === 0 ? (
                      <span className="text-xs text-muted-foreground">No tabs assigned</span>
                    ) : (
                      s.allowed_tabs.map((tabId) => {
                        const tab = ASSIGNABLE_TABS.find((t) => t.id === tabId);
                        return (
                          <span key={tabId} className="rounded-lg bg-gold/10 border border-gold/40 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-navy">
                            {tab?.label ?? tabId}
                          </span>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="mt-8 rounded-xl border border-blue-500/20 bg-blue-500/5 p-5">
          <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-blue-400">
            <ShieldCheck className="h-4 w-4" /> How Staff Login Works
          </h3>
          <ul className="space-y-1 text-xs text-muted-foreground">
            <li>• Staff users log in at <code className="rounded bg-white/10 px-1.5 py-0.5 text-gold">/admin</code> using the "Staff Login" button.</li>
            <li>• They enter their username and password — not the admin password.</li>
            <li>• Staff only see the tabs you assign above. All other admin functionality is hidden.</li>
            <li>• Staff sessions auto-logout after 10 minutes of inactivity, same as admin.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
