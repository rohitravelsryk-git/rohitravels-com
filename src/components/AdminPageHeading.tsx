import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

/**
 * The dark pill that titles every admin page, first used on Group Fares. The
 * label and the record count always read the same way, whichever tab the admin
 * lands on, and the icon identifies the page at a glance.
 */
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
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0">
        <div
          className="inline-flex max-w-full min-w-0 items-center gap-2 rounded-md bg-navy px-4 py-2 text-sm font-bold uppercase tracking-wider text-white"
          title={countLabel}
        >
          <Icon className="h-4 w-4 shrink-0" />
          <span className="truncate">{label}</span>
          {typeof count === "number" && (
            <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-bold tabular-nums">{count}</span>
          )}
        </div>
        {description && <p className="mt-2 max-w-2xl text-xs leading-relaxed text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}
