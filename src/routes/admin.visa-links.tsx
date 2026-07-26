import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Plus, Save, Trash2, X, Pencil, Plane, LogOut, Ticket, Stamp, Link as LinkIcon } from "lucide-react";
import { adminLogout } from "@/lib/fares.functions";
import { AdminHeaderExtras } from "@/components/AdminHeaderExtras";
import { AdminTabs } from "@/components/AdminTabs";
import {
  listVisaLinks,
  createVisaLink,
  updateVisaLink,
  deleteVisaLink,
  type VisaLink,
} from "@/lib/visa-links.functions";


export const Route = createFileRoute("/admin/visa-links")({
  head: () => ({ meta: [{ title: "Visa Links Admin — Rohi" }] }),
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData({
      queryKey: ["visa-links"],
      queryFn: () => listVisaLinks(),
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
  component: AdminVisaLinksPage,
});

type Draft = { country: string; purpose: string; url: string; sort_order: number };
const emptyDraft: Draft = { country: "", purpose: "", url: "", sort_order: 0 };

function AdminVisaLinksPage() {
  const router = useRouter();
  const list = useServerFn(listVisaLinks);
  const create = useServerFn(createVisaLink);
  const update = useServerFn(updateVisaLink);
  const remove = useServerFn(deleteVisaLink);
  const { data } = useSuspenseQuery({ queryKey: ["visa-links"], queryFn: () => list() });

  const [newDraft, setNewDraft] = useState<Draft>(emptyDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Draft>(emptyDraft);
  const [busy, setBusy] = useState(false);

  const refresh = () => router.invalidate();

  async function handleCreate() {
    if (!newDraft.country || !newDraft.purpose || !newDraft.url) return;
    setBusy(true);
    try {
      await create({ data: newDraft });
      setNewDraft(emptyDraft);
      refresh();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setBusy(false);
    }
  }

  function startEdit(l: VisaLink) {
    setEditingId(l.id);
    setEditDraft({ country: l.country, purpose: l.purpose, url: l.url, sort_order: l.sort_order });
  }

  async function saveEdit() {
    if (!editingId) return;
    setBusy(true);
    try {
      await update({ data: { id: editingId, ...editDraft } });
      setEditingId(null);
      refresh();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function del(id: string) {
    if (!confirm("Delete this visa link?")) return;
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

  const logout = useServerFn(adminLogout);
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
              <p className="text-[10px] tracking-widest text-white/60">Visa verification links</p>
            </div>
          </div>
          <div className="flex gap-2">
            <AdminHeaderExtras />
            <a href="/" className="rounded-md border border-white/20 px-3 py-2 text-xs font-semibold hover:bg-white/10">View site</a>
            <button onClick={onLogout} className="inline-flex items-center gap-2 rounded-md bg-gold px-3 py-2 text-xs font-bold text-gold-foreground">
              <LogOut className="h-3.5 w-3.5" /> Logout
            </button>
          </div>
        </div>
        <AdminTabs />
      </header>

      <div className="mx-auto max-w-6xl px-4 py-6">


        {/* Add new */}
        <section className="mb-6 rounded-lg border border-navy/10 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-navy">
            <Plus className="h-3.5 w-3.5" /> Add new visa link
          </div>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_2fr_2fr_80px_auto]">
            <Field label="Country" value={newDraft.country} onChange={(v) => setNewDraft({ ...newDraft, country: v })} />
            <Field label="Purpose / Description" value={newDraft.purpose} onChange={(v) => setNewDraft({ ...newDraft, purpose: v })} />
            <Field label="URL" value={newDraft.url} onChange={(v) => setNewDraft({ ...newDraft, url: v })} placeholder="https://..." />
            <Field label="Sort" type="number" value={String(newDraft.sort_order)} onChange={(v) => setNewDraft({ ...newDraft, sort_order: Number(v) || 0 })} />
            <button
              disabled={busy}
              onClick={handleCreate}
              className="mt-5 inline-flex items-center justify-center gap-1 rounded bg-gold px-3 py-2 text-xs font-bold uppercase tracking-wider text-navy hover:opacity-90 disabled:opacity-50"
            >
              <Plus className="h-3.5 w-3.5" /> Add
            </button>
          </div>
        </section>

        {/* Table */}
        <div className="overflow-hidden rounded-lg border border-navy/10 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-navy text-[10px] uppercase tracking-widest text-white">
              <tr>
                <th className="px-3 py-2 text-left">Country</th>
                <th className="px-3 py-2 text-left">Purpose</th>
                <th className="px-3 py-2 text-left">URL</th>
                <th className="px-3 py-2 text-left">Sort</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.map((l) => {
                const editing = editingId === l.id;
                return (
                  <tr key={l.id} className="border-t border-navy/5">
                    <td className="px-3 py-2">
                      {editing ? (
                        <InlineInput value={editDraft.country} onChange={(v) => setEditDraft({ ...editDraft, country: v })} />
                      ) : (
                        <span className="font-semibold text-navy">{l.country}</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {editing ? (
                        <InlineInput value={editDraft.purpose} onChange={(v) => setEditDraft({ ...editDraft, purpose: v })} />
                      ) : (
                        l.purpose
                      )}
                    </td>
                    <td className="max-w-[300px] truncate px-3 py-2 text-muted-foreground">
                      {editing ? (
                        <InlineInput value={editDraft.url} onChange={(v) => setEditDraft({ ...editDraft, url: v })} />
                      ) : (
                        <a href={l.url} target="_blank" rel="noopener noreferrer" className="hover:text-gold">
                          {l.url}
                        </a>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {editing ? (
                        <InlineInput
                          type="number"
                          value={String(editDraft.sort_order)}
                          onChange={(v) => setEditDraft({ ...editDraft, sort_order: Number(v) || 0 })}
                        />
                      ) : (
                        l.sort_order
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {editing ? (
                        <div className="inline-flex gap-1">
                          <button onClick={saveEdit} disabled={busy} className="rounded bg-gold p-1.5 text-navy" title="Save">
                            <Save className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={() => setEditingId(null)} className="rounded bg-navy/10 p-1.5" title="Cancel">
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="inline-flex gap-1">
                          <button onClick={() => startEdit(l)} className="rounded bg-navy/10 p-1.5 hover:bg-navy/20" title="Edit">
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={() => del(l.id)} className="rounded bg-destructive/80 p-1.5 text-white hover:bg-destructive" title="Delete">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
              {data.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">
                    No visa links yet. Add one above.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs">
      <span className="font-semibold uppercase tracking-wider text-navy/60">{label}</span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="rounded border border-navy/15 bg-white px-2 py-2 text-sm text-navy outline-none focus:border-gold"
      />
    </label>
  );
}

function InlineInput({
  value,
  onChange,
  type = "text",
}: {
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded border border-navy/15 bg-white px-2 py-1 text-sm text-navy outline-none focus:border-gold"
    />
  );
}
