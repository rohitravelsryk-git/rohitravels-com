import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { Home, Plus, Save, Trash2, X, Pencil, Plane, LogOut, Link as LinkIcon, Search, ExternalLink, Globe2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { adminLogout } from "@/lib/fares.functions";
import { AdminHeaderExtras } from "@/components/AdminHeaderExtras";
import { AdminTabs } from "@/components/AdminTabs";
import { AdminPageHeading } from "@/components/AdminPageHeading";
import { listVisaLinks, createVisaLink, updateVisaLink, deleteVisaLink, syncVisaLinksToAddons, type VisaLink } from "@/lib/visa-links.functions";

export const Route = createFileRoute("/admin/visa-links")({
  ssr: false,
  head: () => ({ meta: [{ title: "Visa Links Admin — Rohi" }] }),
  loader: async ({ context }) => {
    try { await context.queryClient.ensureQueryData({ queryKey: ["visa-links"], queryFn: () => listVisaLinks() }); } catch {}
  },
  errorComponent: ({ error, reset }) => (
    <div className="min-h-screen grid place-items-center p-8" style={{ background: "#e3dacc", color: "#141413" }}>
      <div className="rounded-2xl bg-white p-8 text-center shadow-lg">
        <p className="mb-4">{error instanceof Error ? error.message : String(error)}</p>
        <button onClick={reset} className="rounded-lg px-4 py-2 font-semibold" style={{ background: "#d97757", color: "#141413" }}>Retry</button>
      </div>
    </div>
  ),
  component: AdminVisaLinksPage,
});

type Draft = { country: string; purpose: string; url: string };
const emptyDraft: Draft = { country: "", purpose: "", url: "" };

function AdminVisaLinksPage() {
  const router = useRouter();
  const list = useServerFn(listVisaLinks);
  const create = useServerFn(createVisaLink);
  const update = useServerFn(updateVisaLink);
  const remove = useServerFn(deleteVisaLink);
  const syncAddons = useServerFn(syncVisaLinksToAddons);
  const logout = useServerFn(adminLogout);
  const { data: rawData = [] } = useQuery({ queryKey: ["visa-links"], queryFn: () => list() });
  const data = rawData ?? [];

  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<VisaLink | null>(null);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");

  const grouped = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = data.filter((l) =>
      !q || l.country.toLowerCase().includes(q) || l.purpose.toLowerCase().includes(q) || l.url.toLowerCase().includes(q),
    );
    const map = new Map<string, VisaLink[]>();
    filtered.forEach((l) => map.set(l.country, [...(map.get(l.country) ?? []), l]));
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [data, search]);

  async function syncAddonsAfterSave() {
    try {
      await syncAddons({ data: {} });
    } catch (e: any) {
      alert(`Saved in Supabase, but the Addons sheet could not be synced: ${e?.message || "Unknown sync error"}`);
    }
  }

  function openAdd() {
    setDraft(emptyDraft);
    setAddOpen(true);
  }

  function openEdit(link: VisaLink) {
    setDraft({ country: link.country, purpose: link.purpose, url: link.url });
    setEditing(link);
  }

  async function save() {
    if (!draft.country.trim() || !draft.purpose.trim() || !draft.url.trim()) {
      alert("Please fill Country, Purpose and URL.");
      return;
    }
    setBusy(true);
    try {
      if (editing) {
        await update({ data: { id: editing.id, ...draft, country: draft.country.trim(), purpose: draft.purpose.trim(), url: draft.url.trim() } });
      } else {
        await create({ data: { ...draft, country: draft.country.trim(), purpose: draft.purpose.trim(), url: draft.url.trim() } });
      }
      await syncAddonsAfterSave();
      setDraft(emptyDraft);
      setEditing(null);
      setAddOpen(false);
      await router.invalidate();
    } catch (e: any) {
      alert(e?.message || `Unable to ${editing ? "update" : "add"} visa link.`);
    } finally {
      setBusy(false);
    }
  }

  async function del(link: VisaLink) {
    if (!confirm(`Delete "${link.purpose}" for ${link.country}?`)) return;
    setBusy(true);
    try {
      await remove({ data: { id: link.id } });
      await syncAddonsAfterSave();
      await router.invalidate();
    } catch (e: any) {
      alert(e?.message || "Unable to delete visa link.");
    } finally {
      setBusy(false);
    }
  }

  async function onLogout() {
    try { await logout(); } catch {}
    router.navigate({ to: "/admin" });
  }

  const closeForm = () => {
    if (busy) return;
    setAddOpen(false);
    setEditing(null);
    setDraft(emptyDraft);
  };

  return (
    <div className="min-h-screen" style={{ background: "#e3dacc", color: "#141413" }}>
      <header className="sticky top-0 z-40 border-b border-black/10 bg-[#141413] text-[#e3dacc] shadow-sm">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-3">
            <Plane className="h-5 w-5 -rotate-45 text-[#d97757]" />
            <div><p className="text-base font-semibold">Admin Panel</p><p className="text-[11px] opacity-70">Visa verification links</p></div>
          </div>
          <div className="flex items-center gap-2">
            <AdminHeaderExtras />
            <a href="/" className="hidden items-center gap-1.5 rounded-lg border border-white/20 px-3 py-2 text-xs font-semibold hover:bg-white/10 sm:inline-flex"><Home className="h-3.5 w-3.5" /> Home</a>
            <button onClick={onLogout} className="inline-flex items-center gap-1.5 rounded-lg bg-[#d97757] px-3 py-2 text-xs font-semibold text-[#141413]"><LogOut className="h-3.5 w-3.5" /> Logout</button>
          </div>
        </div>
        <AdminTabs />
      </header>

      <main className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8">
        <AdminPageHeading
          icon={LinkIcon}
          label="Visa Links"
          count={data.length}
          countLabel="Official links"
          description="Manage official visa verification portals. Links are grouped by country for quick review."
        />

        <section className="mb-6 flex flex-col gap-4 rounded-2xl border border-black/10 bg-white p-5 shadow-[0_4px_12px_rgba(0,0,0,.05)] sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-bold">Visa verification directory</h2>
            <p className="mt-1 text-xs opacity-60">Supabase is the source of truth; the existing Addons sheet is only a mirror.</p>
          </div>
          <button type="button" onClick={openAdd} className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg bg-[#d97757] px-4 text-xs font-bold text-[#141413]">
            <Plus className="h-4 w-4" /> Add Visa Link
          </button>
        </section>

        <section className="mb-6 rounded-2xl border border-black/10 bg-white p-4 shadow-[0_4px_12px_rgba(0,0,0,.05)]">
          <div className="relative max-w-xl">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 opacity-45" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search country, service or official URL…"
              className="h-11 w-full rounded-xl border border-black/15 bg-white pl-9 pr-3 text-sm outline-none focus:ring-2"
              style={{ ["--tw-ring-color" as any]: "#d97757" }}
            />
          </div>
        </section>

        {grouped.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-black/15 bg-white p-14 text-center">
            <Globe2 className="mx-auto mb-3 h-9 w-9 opacity-25" />
            <p className="font-semibold">{search ? "No matching visa links" : "No visa links yet"}</p>
            <p className="mt-1 text-sm opacity-55">{search ? "Try a different search." : "Add the first official country portal."}</p>
          </div>
        ) : (
          <div className="space-y-5">
            {grouped.map(([country, links]) => (
              <section key={country} className="overflow-hidden rounded-2xl border border-black/10 bg-white shadow-[0_4px_12px_rgba(0,0,0,.05)]">
                <header className="flex flex-wrap items-center gap-3 border-b border-black/10 bg-[#f1ece4] px-5 py-4">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#141413] text-[#e3dacc]"><Globe2 className="h-5 w-5" /></span>
                  <div>
                    <h2 className="text-lg font-black tracking-tight">{country}</h2>
                    <p className="text-[11px] uppercase tracking-wider opacity-50">{links.length} official portal{links.length === 1 ? "" : "s"}</p>
                  </div>
                  <button onClick={() => { setDraft({ country, purpose: "", url: "" }); setEditing(null); setAddOpen(true); }} className="ml-auto inline-flex items-center gap-1 rounded-lg bg-[#d97757] px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-[#141413]">
                    <Plus className="h-3.5 w-3.5" /> Add Link
                  </button>
                </header>
                <div className="grid gap-3 p-4 md:grid-cols-2">
                  {links.map((link) => (
                    <article key={link.id} className="rounded-xl border border-black/10 bg-[#faf9f7] p-4 transition hover:-translate-y-0.5 hover:shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-bold leading-5">{link.purpose}</p>
                          <p className="mt-2 truncate text-[11px] opacity-50" title={link.url}>{link.url}</p>
                        </div>
                        <span className="shrink-0 rounded-full bg-[#141413] px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-[#e3dacc]">Official</span>
                      </div>
                      <div className="mt-4 flex items-center justify-between gap-2">
                        <a href={link.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs font-bold text-[#2f6fed] hover:underline">
                          Open portal <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                        <div className="flex gap-1.5">
                          <button onClick={() => openEdit(link)} aria-label="Edit" title="Edit" className="grid h-8 w-8 place-items-center rounded-lg bg-black/[0.06] hover:bg-black/[0.1]"><Pencil className="h-3.5 w-3.5" /></button>
                          <button onClick={() => del(link)} disabled={busy} aria-label="Delete" title="Delete" className="grid h-8 w-8 place-items-center rounded-lg bg-[#ea4335]/10 text-[#b42318] hover:bg-[#ea4335]/15 disabled:opacity-40"><Trash2 className="h-3.5 w-3.5" /></button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}

        <Dialog open={addOpen || Boolean(editing)} onOpenChange={(open) => { if (!open) closeForm(); }}>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>{editing ? "Edit Visa Verification Link" : "Add Visa Verification Link"}</DialogTitle>
              <DialogDescription>
                Use the official government or authority portal. The change is saved to Supabase first and then mirrored to Addons.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4">
              <Field label="Country *" value={draft.country} onChange={(v) => setDraft({ ...draft, country: v })} />
              <Field label="Purpose / Description *" value={draft.purpose} onChange={(v) => setDraft({ ...draft, purpose: v })} />
              <Field label="Official URL *" value={draft.url} onChange={(v) => setDraft({ ...draft, url: v })} placeholder="https://…" />
            </div>
            <DialogFooter>
              <button type="button" disabled={busy} onClick={closeForm} className="rounded-lg border border-black/15 px-4 py-2 text-xs font-semibold disabled:opacity-50">Cancel</button>
              <button type="button" disabled={busy} onClick={save} className="inline-flex items-center gap-1.5 rounded-lg bg-[#d97757] px-4 py-2 text-xs font-bold text-[#141413] disabled:opacity-50">
                {busy ? "Saving…" : <><Save className="h-4 w-4" /> {editing ? "Save Changes" : "Save Visa Link"}</>}
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5 text-xs">
      <span className="font-bold uppercase tracking-wider opacity-55">{label}</span>
      <input value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className="h-11 rounded-xl border border-black/15 bg-white px-3 text-sm outline-none focus:ring-2" style={{ ["--tw-ring-color" as any]: "#d97757" }} />
    </label>
  );
}
