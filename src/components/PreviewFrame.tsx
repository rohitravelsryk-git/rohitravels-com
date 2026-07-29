import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { PREVIEW_TEMPLATES } from "@/lib/preview-fares";

/** Floating chrome shown on every design-preview route. */
export function PreviewFrame({ slug, children }: { slug: string; children: ReactNode }) {
  const idx = PREVIEW_TEMPLATES.findIndex((t) => t.slug === slug);
  const current = PREVIEW_TEMPLATES[idx];
  const next = PREVIEW_TEMPLATES[(idx + 1) % PREVIEW_TEMPLATES.length];

  return (
    <div className="relative">
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center p-4">
        <div
          className="pointer-events-auto flex flex-wrap items-center gap-3 rounded-2xl border px-4 py-2.5 backdrop-blur-xl"
          style={{
            borderColor: "color-mix(in oklab, var(--gold) 35%, transparent)",
            backgroundColor: "color-mix(in oklab, var(--navy) 78%, transparent)",
          }}
        >
          <Link
            to="/preview"
            className="text-[10px] font-bold uppercase tracking-[0.25em]"
            style={{ color: "var(--gold)" }}
          >
            ← All templates
          </Link>
          <span className="text-[10px] font-bold opacity-40" style={{ color: "var(--navy-foreground)" }}>
            {String(current?.n ?? 0).padStart(2, "0")} · {current?.name}
          </span>
          <Link
            to={`/preview/${next.slug}` as string}
            className="rounded-lg px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.25em]"
            style={{ backgroundColor: "var(--gold)", color: "var(--gold-foreground)" }}
          >
            Next →
          </Link>
        </div>
      </div>
    </div>
  );
}
