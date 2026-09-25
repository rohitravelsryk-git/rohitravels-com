import { AdminQuickActions } from "@/components/AdminQuickActions";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Plane, LogOut, Calculator as CalcIcon, RotateCcw } from "lucide-react";
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
      <header className="border-b border-[rgba(255,255,255,0.10)] bg-navy text-white">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <Plane className="h-5 w-5 -rotate-45 text-white" />
            <div>
              <p className="font-sans text-lg font-black">Admin Panel</p>
              <p className="text-[10px] tracking-widest text-white/70">Calculators studio</p>
            </div>
          </div>
          <div className="flex gap-2">
            <AdminQuickActions />
            <AdminHeaderExtras />
            <a href="/" className="rounded-md border border-white/25 px-3 py-2 text-xs font-semibold hover:bg-white/10">View site</a>
            <button onClick={async () => { await logout(); router.navigate({ to: "/admin" }); }} className="inline-flex items-center gap-2 rounded-md bg-[var(--accent)] px-3 py-2 text-xs font-bold text-white">
              <LogOut className="h-3.5 w-3.5" /> Logout
            </button>
          </div>
        </div>
<AdminTabs />
      </header>

      <div className="border-b border-border bg-secondary/40">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-3 px-4 py-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-gold to-warning text-navy shadow">
            <CalcIcon className="h-5 w-5" />
          </div>
          <div className="min-w-[260px] flex-1">
            <input
              value={page.title}
              onChange={(e) => patch({ title: e.target.value })}
              maxLength={80}
              aria-label="Page title"
              className={`${fieldCls} w-full font-sans text-2xl font-black text-navy`}
            />
            <input
              value={page.intro}
              onChange={(e) => patch({ intro: e.target.value })}
              maxLength={400}
              aria-label="Intro line"
              className={`${fieldCls} mt-1 w-full text-sm text-muted-foreground`}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setPage(defaultContent())}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-white px-3 py-2 text-xs font-bold text-navy hover:bg-secondary"
              title="Restore the original wording"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Default
            </button>
            <button
              onClick={onSave}
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-md bg-navy px-4 py-2 text-xs font-bold text-navy-foreground hover:bg-navy/90 disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </div>
      </div>

      <section className="mx-auto max-w-6xl px-4 py-8 sm:py-10">
        <div className="mb-6">
          <input
            value={page.heading}
            onChange={(e) => patch({ heading: e.target.value })}
            maxLength={80}
            aria-label="Section heading"
            className={`${fieldCls} w-full font-sans text-xl font-black text-navy`}
          />
          <input
            value={page.subheading}
            onChange={(e) => patch({ subheading: e.target.value })}
            maxLength={200}
            aria-label="Section sub-heading"
            className={`${fieldCls} mt-1 w-full text-sm text-muted-foreground`}
          />
        </div>

        <CalculatorsBoard content={page} onToolsChange={(tools) => patch({ tools })} />
      </section>
    </div>
  );
}

/** Borderless until hovered or focused, so the page reads like the real thing. */
const fieldCls =
  "rounded-md border border-transparent bg-transparent px-2 py-1 outline-none hover:border-border focus:border-gold focus:bg-background";
