import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { Home, Plus, Save, Trash2, X, Pencil, Plane, LogOut, Link as LinkIcon, Search, ExternalLink } from "lucide-react";
import { SimplePager, paginate } from "@/components/ui/simple-pager";
import { adminLogout } from "@/lib/fares.functions";
import { AdminHeaderExtras } from "@/components/AdminHeaderExtras";
import { AdminTabs } from "@/components/AdminTabs";
import { AdminPageHeading } from "@/components/AdminPageHeading";
import { listVisaLinks, createVisaLink, updateVisaLink, deleteVisaLink, type VisaLink } from "@/lib/visa-links.functions";

export const Route = createFileRoute("/admin/visa-links")({
  ssr: false,
  head: () => ({ meta: [{ title: "Visa Links Admin — Rohi" }] }),
  loader: async ({ context }) => {
    try { await context.queryClient.ensureQueryData({ queryKey: ["visa-links"], queryFn: () => listVisaLinks() }); } catch {}
  },
  errorComponent: ({ error, reset }) => (
    <div className="min-h-screen grid place-items-center p-8" style={{ background: "var(--color-background)", color: "var(--color-text)" }}>
      <div className="rounded-2xl bg-white p-8 text-center shadow-[var(--shadow-card-elevation)]">
        <p className="mb-4">{error instanceof Error ? error.message : String(error)}</p>
        <button onClick={reset} className="rounded-lg px-4 py-2 font-semibold" style={{ background: "var(--color-cta)", color: "var(--color-text)" }}>Retry</button>
      </div>
    </div>
  ),
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
  const { data: rawData = [] } = useQuery({ queryKey: ["visa-links"], queryFn: () => list() });
  const data = rawData ?? [];
  const [newDraft, setNewDraft] = useState<Draft>(emptyDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Draft>(emptyDraft);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.filter((l) => !q || l.country.toLowerCase().includes(q) || l.purpose.toLowerCase().includes(q) || l.url.toLowerCase().includes(q));
  }, [data, search]);
  const { pageItems, totalPages, safePage } = paginate(filtered, page, 25);

  async function handleCreate() {
    if (!newDraft.country.trim() || !newDraft.purpose.trim() || !newDraft.url.trim()) { alert("Please fill Country, Purpose and URL."); return; }
    setBusy(true);
    try { await create({ data: { ...newDraft, country: newDraft.country.trim(), purpose: newDraft.purpose.trim(), url: newDraft.url.trim() } }); setNewDraft(emptyDraft); await router.invalidate(); }
    catch (e: any) { alert(e?.message || "Unable to add visa link."); } finally { setBusy(false); }
  }

  function startEdit(l: VisaLink) { setEditingId(l.id); setEditDraft({ country: l.country, purpose: l.purpose, url: l.url, sort_order: l.sort_order }); }
  async function saveEdit() {
    if (!editingId) return;
    if (!editDraft.country.trim() || !editDraft.purpose.trim() || !editDraft.url.trim()) { alert("Please fill Country, Purpose and URL."); return; }
    setBusy(true);
    try { await update({ data: { id: editingId, country: editDraft.country.trim(), purpose: editDraft.purpose.trim(), url: editDraft.url.trim(), sort_order: editDraft.sort_order } }); setEditingId(null); await router.invalidate(); }
    catch (e: any) { alert(e?.message || "Unable to update visa link."); } finally { setBusy(false); }
  }
  async function del(id: string) {
    if (!confirm("Delete this visa link?")) return;
    setBusy(true); try { await remove({ data: { id } }); await router.invalidate(); } catch (e: any) { alert(e?.message || "Unable to delete visa link."); } finally { setBusy(false); }
  }
  const logout = useServerFn(adminLogout);
  async function onLogout() { try { await logout(); } catch {} router.navigate({ to: "/admin" }); }

  return (
    <div className="min-h-screen" style={{ background: "var(--color-background)", color: "var(--color-text)", ["--color-background" as any]: "#e3dacc", ["--color-text" as any]: "#141413", ["--color-cta" as any]: "#d97757", ["--color-accent" as any]: "#4285f4", ["--color-success" as any]: "#34a853", ["--color-error" as any]: "#ea4335", ["--color-warning" as any]: "#fbbc05", ["--shadow-card-elevation" as any]: "0 4px 12px rgba(0,0,0,0.05)" }}>
      <header style={{ background: "var(--color-text)", color: "var(--color-background)" }} className="sticky top-0 z-40 border-b border-black/10 shadow-sm">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-3"><Plane className="h-5 w-5 -rotate-45" style={{ color: "var(--color-cta)" }} /><div><p className="text-base font-semibold">Admin Panel</p><p className="text-[11px] opacity-70">Visa verification links</p></div></div>
          <div className="flex items-center gap-2"><AdminHeaderExtras /><a href="/" className="hidden sm:inline-flex items-center gap-1.5 rounded-lg border border-white/20 px-3 py-2 text-xs font-semibold hover:bg-white/10"><Home className="h-3.5 w-3.5" /> Home</a><button onClick={onLogout} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold" style={{ background: "var(--color-cta)", color: "var(--color-text)" }}><LogOut className="h-3.5 w-3.5" /> Logout</button></div>
        </div><AdminTabs />
      </header>

      <main className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8">
        <AdminPageHeading icon={LinkIcon} label="Visa Links" count={data.length} countLabel="Country links" description="Manage the official visa verification links displayed on the public website." />

        <section className="mb-5 rounded-2xl border border-black/10 bg-white p-5 shadow-[var(--shadow-card-elevation)]">
          <div className="mb-4 flex items-center justify-between gap-3"><div><h2 className="text-sm font-bold">Add visa link</h2><p className="mt-0.5 text-xs opacity-60">Add a country portal without leaving this page.</p></div><Plus className="h-5 w-5" style={{ color: "var(--color-cta)" }} /></div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_1.4fr_2fr_90px_auto]">
            <Field label="Country *" value={newDraft.country} onChange={(v) => setNewDraft({ ...newDraft, country: v })} />
            <Field label="Purpose *" value={newDraft.purpose} onChange={(v) => setNewDraft({ ...newDraft, purpose: v })} />
            <Field label="Official URL *" value={newDraft.url} onChange={(v) => setNewDraft({ ...newDraft, url: v })} placeholder="https://..." />
            <Field label="Sort" type="number" value={String(newDraft.sort_order)} onChange={(v) => setNewDraft({ ...newDraft, sort_order: Number(v) || 0 })} />
            <button disabled={busy} onClick={handleCreate} className="mt-5 inline-flex h-10 items-center justify-center gap-1.5 rounded-lg px-4 text-xs font-bold disabled:opacity-50" style={{ background: "var(--color-cta)", color: "var(--color-text)" }}><Plus className="h-4 w-4" /> Add</button>
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-black/10 bg-white shadow-[var(--shadow-card-elevation)]">
          <div className="flex flex-col gap-3 border-b border-black/10 p-4 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-sm font-bold">Visa link directory</h2><p className="text-xs opacity-60">{filtered.length} matching record{filtered.length === 1 ? "" : "s"}</p></div><div className="relative w-full sm:w-80"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 opacity-50" /><input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search country, purpose or URL..." className="h-10 w-full rounded-lg border border-black/15 bg-white pl-9 pr-3 text-sm outline-none focus:ring-2" style={{ ["--tw-ring-color" as any]: "var(--color-cta)" }} /></div></div>
          <div className="overflow-x-auto"><table className="w-full min-w-[850px] text-sm"><thead><tr style={{ background: "var(--color-text)", color: "var(--color-background)" }}><th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider">Country</th><th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider">Purpose</th><th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider">Official URL</th><th className="px-4 py-3 text-center text-[11px] font-bold uppercase tracking-wider">Sort</th><th className="px-4 py-3 text-right text-[11px] font-bold uppercase tracking-wider">Actions</th></tr></thead><tbody>
            {pageItems.map((l) => { const editing = editingId === l.id; return <tr key={l.id} className="border-b border-black/5 last:border-0 hover:bg-black/[0.025]">
              <td className="px-4 py-3 font-semibold">{editing ? <InlineInput value={editDraft.country} onChange={(v) => setEditDraft({ ...editDraft, country: v })} /> : l.country}</td>
              <td className="px-4 py-3">{editing ? <InlineInput value={editDraft.purpose} onChange={(v) => setEditDraft({ ...editDraft, purpose: v })} /> : <span className="line-clamp-2">{l.purpose}</span>}</td>
              <td className="max-w-[340px] px-4 py-3">{editing ? <InlineInput value={editDraft.url} onChange={(v) => setEditDraft({ ...editDraft, url: v })} /> : <a href={l.url} target="_blank" rel="noopener noreferrer" className="inline-flex max-w-full items-center gap-1 truncate text-xs underline-offset-2 hover:underline" style={{ color: "var(--color-accent)" }} title={l.url}>{l.url}<ExternalLink className="h-3 w-3 shrink-0" /></a>}</td>
              <td className="px-4 py-3 text-center">{editing ? <InlineInput type="number" value={String(editDraft.sort_order)} onChange={(v) => setEditDraft({ ...editDraft, sort_order: Number(v) || 0 })} /> : <span className="rounded-full bg-black/5 px-2 py-1 text-xs font-semibold">{l.sort_order}</span>}</td>
              <td className="px-4 py-3 text-right">{editing ? <div className="inline-flex gap-1.5"><IconButton label="Save" onClick={saveEdit} disabled={busy} tone="cta"><Save className="h-4 w-4" /></IconButton><IconButton label="Cancel" onClick={() => setEditingId(null)}><X className="h-4 w-4" /></IconButton></div> : <div className="inline-flex gap-1.5"><IconButton label="Edit" onClick={() => startEdit(l)}><Pencil className="h-4 w-4" /></IconButton><IconButton label="Delete" onClick={() => del(l.id)} disabled={busy} tone="danger"><Trash2 className="h-4 w-4" /></IconButton></div>}</td>
            </tr>; })}
            {pageItems.length === 0 && <tr><td colSpan={5} className="px-4 py-14 text-center"><div className="mx-auto max-w-md"><LinkIcon className="mx-auto mb-3 h-8 w-8 opacity-30" /><p className="font-semibold">{search ? "No matching visa links" : "No visa links yet"}</p><p className="mt-1 text-xs opacity-60">{search ? "Try a different search." : "Use the form above to add the first official portal."}</p></div></td></tr>}
          </tbody></table></div>
          {filtered.length > 0 && <div className="flex items-center justify-center border-t border-black/5 p-3"><SimplePager page={safePage} totalPages={totalPages} onPrev={() => setPage((p) => Math.max(1, p - 1))} onNext={() => setPage((p) => Math.min(totalPages, p + 1))} /></div>}
        </section>
      </main>
    </div>
  );
}

function Field({ label, value, onChange, type = "text", placeholder }: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string }) {
  return <label className="flex min-w-0 flex-col gap-1.5 text-xs"><span className="font-bold uppercase tracking-wider opacity-55">{label}</span><input type={type} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className="h-10 rounded-lg border border-black/15 bg-white px-3 text-sm outline-none focus:ring-2" style={{ ["--tw-ring-color" as any]: "var(--color-cta)" }} /></label>;
}
function InlineInput({ value, onChange, type = "text" }: { value: string; onChange: (v: string) => void; type?: string }) {
  return <input type={type} value={value} onChange={(e) => onChange(e.target.value)} className="h-9 w-full min-w-[100px] rounded-lg border border-black/15 bg-white px-2.5 text-sm outline-none focus:ring-2" style={{ ["--tw-ring-color" as any]: "var(--color-cta)" }} />;
}
function IconButton({ label, onClick, disabled, children, tone }: { label: string; onClick: () => void; disabled?: boolean; children: React.ReactNode; tone?: "cta" | "danger" }) {
  const style = tone === "cta" ? { background: "var(--color-cta)", color: "var(--color-text)" } : tone === "danger" ? { background: "var(--color-error)", color: "white" } : { background: "rgba(20,20,19,.06)", color: "var(--color-text)" };
  return <button type="button" aria-label={label} title={label} onClick={onClick} disabled={disabled} className="grid h-9 w-9 place-items-center rounded-lg transition hover:opacity-80 disabled:opacity-40" style={style}>{children}</button>;
}
