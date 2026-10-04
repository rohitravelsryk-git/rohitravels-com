import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

/** Shared admin page heading. Visual language follows the canonical Rohi design system. */
export function AdminPageHeading({
  icon: Icon,
  label,
  count,
  countLabel,
  description,
  action,
}: {
  icon: LucideIcon;
  label: string;
  count?: number | null;
  countLabel?: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
      <div className="min-w-0">
        <div className="inline-flex max-w-full min-w-0 items-center gap-2 rounded-[var(--rohi-radius-md)] border border-[var(--rohi-border-strong)] bg-[var(--rohi-surface-strong)] px-4 py-2.5 text-sm font-semibold tracking-tight text-[var(--rohi-text-inverse)] shadow-[var(--rohi-shadow-sm)]" title={countLabel}>
          <Icon className="h-4 w-4 shrink-0 text-[var(--rohi-brand)]" />
          <span className="truncate">{label}</span>
          {typeof count === "number" && <span className="rounded-full border border-white/10 bg-white/10 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-white/90">{count}</span>}
        </div>
        {description && <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--rohi-text-muted)]">{description}</p>}
      </div>
      {action}
    </div>
  );
}
