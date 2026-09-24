import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Plane, LogOut, Calculator as CalcIcon, ArrowUp, ArrowDown, ExternalLink, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { adminLogout } from "@/lib/fares.functions";
import {
  getCalculatorsContent,
  saveCalculatorsContent,
  CALCULATORS_DEFAULTS,
  type CalculatorToolId,
} from "@/lib/calculators.functions";
import { calculatorsQueryKey } from "@/components/CalculatorsBoard";
import { AdminHeaderExtras } from "@/components/AdminHeaderExtras";
import { AdminTabs } from "@/components/AdminTabs";

export const Route = createFileRoute("/admin/calculators")({
  head: () => ({
    meta: [
      { title: "Calculators Page · Rohi Admin" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: AdminCalculatorsPage,
});

type Draft = {
  eyebrow: string;
  title: string;
  intro: string;
  heading: string;
  subheading: string;
  tools: { id: CalculatorToolId; label: string; visible: boolean; note: string }[];
};

const TOOL_HINTS: Record<CalculatorToolId, string> = {
  "add-subtract": "Adds or subtracts a number of days from a start date.",
  "age-duration": "Years, months and days between two dates.",
  "days-between": "Counts the number of days between two dates.",
  "hours-between": "Hours, minutes and total hours between two date-times.",
  discount: "Works out discount received and net invoice for a group.",
};

function fromStored(data: Awaited<ReturnType<typeof getCalculatorsContent>>): Draft {
  return {
    eyebrow: data.eyebrow,
    title: data.title,
    intro: data.intro,
    heading: data.heading,
    subheading: data.subheading,
    tools: data.tools.map((t) => ({ id: t.id, label: t.label, visible: t.visible, note: t.note })),
  };
}

function defaultDraft(): Draft {
  return fromStored({ ...CALCULATORS_DEFAULTS, updatedAt: "" });
}

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

  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data && !draft) setDraft(fromStored(data));
  }, [data, draft]);

  function patch<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((d) => (d ? { ...d, [key]: value } : d));
  }

  function patchTool(id: CalculatorToolId, changes: Partial<Draft["tools"][number]>) {
    setDraft((d) => (d ? { ...d, tools: d.tools.map((t) => (t.id === id ? { ...t, ...changes } : t)) } : d));
  }

  function moveTool(index: number, direction: -1 | 1) {
    setDraft((d) => {
      if (!d) return d;
      const target = index + direction;
      if (target < 0 || target >= d.tools.length) return d;
      const tools = [...d.tools];
      [tools[index], tools[target]] = [tools[target], tools[index]];
      return { ...d, tools };
    });
  }

  async function onSave() {
    if (!draft) return;
    const cleaned = { ...draft, title: draft.title.trim(), tools: draft.tools.map((t) => ({ ...t, label: t.label.trim() })) };
    if (!cleaned.title) { toast.error("The page needs a main title"); return; }
    if (cleaned.tools.some((t) => !t.label)) { toast.error("Every tool needs a name"); return; }
    setSaving(true);
    try {
      await save({ data: cleaned });
      await qc.invalidateQueries({ queryKey: calculatorsQueryKey });
      toast.success("Calculators page updated — live on the website and agent portal");
    } catch (e: any) {
      toast.error(e?.message ?? "Could not save");
    } finally {
      setSaving(false);
    }
  }

  if (!draft) return <div className="p-10 text-center text-sm text-muted-foreground">Loading…</div>;

  const visibleCount = draft.tools.filter((t) => t.visible).length;

  return (
    <div className="min-h-screen bg-background font-booking text-booking-ink">
      <header className="border-b border-border bg-navy text-navy-foreground">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <Plane className="h-5 w-5 -rotate-45 text-gold" />
            <div>
              <p className="font-serif text-lg font-black">Admin Panel</p>
              <p className="text-[10px] tracking-widest text-white/60">Manage the Calculators page</p>
            </div>
          </div>
          <div className="flex gap-2">
            <AdminHeaderExtras />
            <a href="/" className="rounded-md border border-white/20 px-3 py-2 text-xs font-semibold hover:bg-white/10">View site</a>
            <button onClick={async () => { await logout(); router.navigate({ to: "/admin" }); }} className="inline-flex items-center gap-2 rounded-md bg-gold px-3 py-2 text-xs font-bold text-gold-foreground">
              <LogOut className="h-3.5 w-3.5" /> Logout
            </button>
          </div>
        </div>
        <AdminTabs />
      </header>

      <div className="mx-auto max-w-[1200px] px-4 py-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-[11px] bg-booking-blue-soft text-booking-ink"><CalcIcon className="h-5 w-5" /></span>
            <div>
              <h1 className="text-lg font-extrabold tracking-tight sm:text-2xl">Calculators Page</h1>
              <p className="text-xs text-booking-subtle">Edits here appear instantly on rohitravels.com/calculators and in the agent portal.</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link to="/calculators" target="_blank" className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-2 text-xs font-bold hover:bg-secondary">
              <ExternalLink className="h-3.5 w-3.5" /> View public page
            </Link>
            <button
              onClick={() => setDraft(defaultDraft())}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-2 text-xs font-bold hover:bg-secondary"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Reset to default
            </button>
            <button
              onClick={onSave}
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-md bg-gold px-4 py-2 text-xs font-black uppercase tracking-wide text-gold-foreground hover:brightness-95 disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </div>

        <section className="mb-5 rounded-lg border border-border/70 bg-card p-5 shadow-booking">
          <h2 className="mb-4 font-serif text-sm font-black uppercase tracking-wider text-booking-subtle">Page wording</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Small label above the title">
              <input value={draft.eyebrow} onChange={(e) => patch("eyebrow", e.target.value)} maxLength={60} className={inputCls} />
            </Field>
            <Field label="Main title">
              <input value={draft.title} onChange={(e) => patch("title", e.target.value)} maxLength={80} className={inputCls} />
            </Field>
            <Field label="Section heading">
              <input value={draft.heading} onChange={(e) => patch("heading", e.target.value)} maxLength={80} className={inputCls} />
            </Field>
            <Field label="Section sub-heading">
              <input value={draft.subheading} onChange={(e) => patch("subheading", e.target.value)} maxLength={200} className={inputCls} />
            </Field>
            <div className="md:col-span-2">
              <Field label="Intro line">
                <textarea value={draft.intro} onChange={(e) => patch("intro", e.target.value)} maxLength={400} rows={2} className={inputCls} />
              </Field>
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-border/70 bg-card p-5 shadow-booking">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="font-serif text-sm font-black uppercase tracking-wider text-booking-subtle">Tools</h2>
            <p className="text-xs text-booking-subtle">{visibleCount} of {draft.tools.length} shown to visitors</p>
          </div>

          <div className="space-y-3">
            {draft.tools.map((tool, index) => (
              <div
                key={tool.id}
                className={`rounded-lg border p-4 transition ${tool.visible ? "border-border bg-background" : "border-dashed border-border bg-booking-canvas opacity-70"}`}
              >
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex flex-col gap-1">
                    <button onClick={() => moveTool(index, -1)} disabled={index === 0} className="rounded border border-border p-1 hover:bg-secondary disabled:opacity-30" title="Move up">
                      <ArrowUp className="h-3 w-3" />
                    </button>
                    <button onClick={() => moveTool(index, 1)} disabled={index === draft.tools.length - 1} className="rounded border border-border p-1 hover:bg-secondary disabled:opacity-30" title="Move down">
                      <ArrowDown className="h-3 w-3" />
                    </button>
                  </div>
                  <input
                    value={tool.label}
                    onChange={(e) => patchTool(tool.id, { label: e.target.value })}
                    maxLength={60}
                    className={`${inputCls} max-w-[280px] font-semibold`}
                    aria-label={`Name of the ${TOOL_HINTS[tool.id]} tool`}
                  />
                  <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-bold uppercase tracking-wide text-booking-subtle">
                    <input
                      type="checkbox"
                      checked={tool.visible}
                      onChange={(e) => patchTool(tool.id, { visible: e.target.checked })}
                      className="h-4 w-4 accent-[var(--color-gold)]"
                    />
                    Show
                  </label>
                  <span className="ml-auto text-[11px] text-booking-subtle">{TOOL_HINTS[tool.id]}</span>
                </div>
                <textarea
                  value={tool.note}
                  onChange={(e) => patchTool(tool.id, { note: e.target.value })}
                  maxLength={600}
                  rows={2}
                  placeholder="Optional note shown under this tool (e.g. instructions for agents and customers)"
                  className={`${inputCls} mt-3`}
                />
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

const inputCls =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-booking-ink outline-none focus:border-gold focus:ring-2 focus:ring-gold/30";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-black uppercase tracking-widest text-booking-subtle">{label}</span>
      {children}
    </label>
  );
}
