import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Plane, LogOut, Calculator as CalcIcon, ExternalLink, Pencil, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { adminLogout } from "@/lib/fares.functions";
import {
  getCalculatorsContent,
  saveCalculatorsContent,
  CALCULATORS_DEFAULTS,
  type CalculatorsContent,
} from "@/lib/calculators.functions";
import { CalculatorsBoard, calculatorsQueryKey } from "@/components/CalculatorsBoard";
import { AdminHeaderExtras } from "@/components/AdminHeaderExtras";
import { AdminTabs } from "@/components/AdminTabs";

export const Route = createFileRoute("/admin/calculators")({
  head: () => ({
    meta: [
      { title: "Calculators · Rohi Admin" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: AdminCalculatorsPage,
});

function defaultContent(): CalculatorsContent {
  return { ...CALCULATORS_DEFAULTS, updatedAt: "" };
}

/**
 * The Calculators page itself, living inside the admin panel. Editing here is
 * editing the master copy: the public page and the agent portal read the same
 * stored content, so both refresh as soon as it is saved.
 */
function AdminCalculatorsPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const logout = useServerFn(adminLogout);
  const save = useServerFn(saveCalculatorsContent);

  const { data } = useQuery({
    queryKey: calculatorsQueryKey,
    queryFn: () => getCalculatorsContent(),
    staleTime: Infinity,
  });

  const [page, setPage] = useState<CalculatorsContent | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data && !page) setPage(data);
  }, [data, page]);

  async function onSave() {
    if (!page) return;
    const cleaned = {
      ...page,
      title: page.title.trim(),
      tools: page.tools.map((t) => ({ ...t, label: t.label.trim() })),
    };
    if (!cleaned.title) { toast.error("The page needs a main title"); return; }
    if (cleaned.tools.some((t) => !t.label)) { toast.error("Every tool needs a name"); return; }
    setSaving(true);
    try {
      await save({
        data: {
          eyebrow: cleaned.eyebrow,
          title: cleaned.title,
          intro: cleaned.intro,
          heading: cleaned.heading,
          subheading: cleaned.subheading,
          tools: cleaned.tools,
        },
      });
      await qc.invalidateQueries({ queryKey: calculatorsQueryKey });
      toast.success("Saved — the website and agent portal are updated");
      setEditing(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Could not save");
    } finally {
      setSaving(false);
    }
  }

  if (!page) return <div className="min-h-screen p-10 text-center text-sm text-muted-foreground">Loading…</div>;

  const patch = (changes: Partial<CalculatorsContent>) => setPage((p) => (p ? { ...p, ...changes } : p));

  return (
    <div className="min-h-screen bg-background text-navy animate-premium-fade">
      <header className="border-b border-border bg-navy text-navy-foreground">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <Plane className="h-5 w-5 -rotate-45 text-gold" />
            <div>
              <p className="font-serif text-base font-black">Calculators — admin copy</p>
              <p className="text-[10px] tracking-widest text-white/60">What you see here is what the site shows</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <AdminHeaderExtras />
            <Link to="/calculators" target="_blank" className="inline-flex items-center gap-1.5 rounded-md border border-white/20 px-3 py-2 text-xs font-semibold hover:bg-white/10">
              <ExternalLink className="h-3.5 w-3.5" /> Public page
            </Link>
            {editing ? (
              <>
                <button
                  onClick={onSave}
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 rounded-md bg-gold px-3 py-2 text-xs font-bold text-gold-foreground hover:brightness-95 disabled:opacity-60"
                >
                  {saving ? "Saving…" : "Save changes"}
                </button>
                <button
                  onClick={() => {
                    if (data) setPage(data);
                    setEditing(false);
                  }}
                  className="rounded-md border border-white/20 px-3 py-2 text-xs font-semibold hover:bg-white/10"
                >
                  Cancel
                </button>
                <button
                  onClick={() => setPage(defaultContent())}
                  className="inline-flex items-center gap-1.5 rounded-md border border-white/20 px-3 py-2 text-xs font-semibold hover:bg-white/10"
                  title="Restore the original wording"
                >
                  <RotateCcw className="h-3.5 w-3.5" /> Default
                </button>
              </>
            ) : (
              <button
                onClick={() => setEditing(true)}
                className="inline-flex items-center gap-1.5 rounded-md bg-gold px-3 py-2 text-xs font-bold text-gold-foreground hover:brightness-95"
              >
                <Pencil className="h-3.5 w-3.5" /> Edit this page
              </button>
            )}
            <button onClick={async () => { await logout(); router.navigate({ to: "/admin" }); }} className="inline-flex items-center gap-1.5 rounded-md border border-white/20 px-3 py-2 text-xs font-semibold hover:bg-white/10">
              <LogOut className="h-3.5 w-3.5" /> Logout
            </button>
          </div>
        </div>
        <AdminTabs />
      </header>

      <section className="bg-navy text-navy-foreground">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:py-14">
          <div className="flex items-center gap-3 text-gold">
            <CalcIcon className="h-5 w-5" aria-hidden="true" />
            {editing ? (
              <input value={page.eyebrow} onChange={(e) => patch({ eyebrow: e.target.value })} maxLength={60} className={heroInput} />
            ) : (
              <span className="text-xs font-bold uppercase tracking-[0.3em]">{page.eyebrow}</span>
            )}
          </div>
          {editing ? (
            <input value={page.title} onChange={(e) => patch({ title: e.target.value })} maxLength={80} className={`${heroInput} mt-3 !text-3xl font-black sm:!text-4xl`} />
          ) : (
            <h1 className="mt-3 font-serif text-4xl font-black sm:text-5xl">{page.title}</h1>
          )}
          {editing ? (
            <textarea value={page.intro} onChange={(e) => patch({ intro: e.target.value })} maxLength={400} rows={2} className={`${heroInput} mt-3 max-w-2xl text-sm`} />
          ) : (
            page.intro && <p className="mt-3 max-w-2xl text-sm text-navy-foreground/75 sm:text-base">{page.intro}</p>
          )}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-10 sm:py-14">
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gold/15 text-navy">
            <CalcIcon className="h-5 w-5" />
          </div>
          <div className="flex-1">
            {editing ? (
              <>
                <input value={page.heading} onChange={(e) => patch({ heading: e.target.value })} maxLength={80} className={`${heroInput} !text-2xl font-black`} />
                <input value={page.subheading} onChange={(e) => patch({ subheading: e.target.value })} maxLength={200} className={`${heroInput} mt-2 text-sm`} />
              </>
            ) : (
              <>
                <h2 className="font-serif text-2xl font-black text-navy">{page.heading}</h2>
                {page.subheading && <p className="text-sm text-muted-foreground">{page.subheading}</p>}
              </>
            )}
          </div>
        </div>

        <CalculatorsBoard content={page} onToolsChange={editing ? (tools) => patch({ tools }) : undefined} />
      </section>
    </div>
  );
}

const heroInput =
  "w-full rounded-md border border-gold/40 bg-white/10 px-3 py-2 text-sm text-white outline-none placeholder:text-white/40 focus:border-gold focus:ring-2 focus:ring-gold/30";
