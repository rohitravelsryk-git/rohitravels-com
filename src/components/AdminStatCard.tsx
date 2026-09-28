import type { LucideIcon } from "lucide-react";

export type AdminStatTone = "navy" | "blue" | "green" | "amber" | "muted";

const TILE: Record<AdminStatTone, string> = {
  navy: "bg-booking-blue-soft text-booking-blue",
  blue: "bg-booking-blue-soft text-booking-blue",
  green: "bg-booking-green-soft text-booking-green",
  amber: "bg-booking-amber-soft text-booking-amber",
  muted: "bg-booking-rose-soft text-booking-rose",
};

/**
 * KPI strip card. Bookings made these clickable filters and it read much better,
 * so every admin page uses the same card: pass onClick and it becomes a toggle.
 */
export function AdminStatCard({
  label,
  value,
  icon: Icon,
  tone = "navy",
  valueColor,
  active,
  onClick,
  title,
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  tone?: AdminStatTone;
  valueColor?: string;
  active?: boolean;
  onClick?: () => void;
  title?: string;
}) {
  const tile = TILE[tone];
  const ink = valueColor ?? (tone === "green" ? "text-booking-green" : "text-booking-ink");
  const content = (
    <>
      <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-[11px] ring-1 ring-inset ring-black/[0.03] ${tile}`}>
        <Icon className="h-4.5 w-4.5" />
      </span>
      <div className="min-w-0">
        <div className={`text-xl font-extrabold leading-none tabular-nums ${ink}`}>{value}</div>
        <div className="mt-1 truncate text-[11px] font-medium text-booking-subtle">{label}</div>
      </div>
    </>
  );

  const base =
    "flex min-h-[72px] min-w-0 items-center gap-3 rounded-[14px] border bg-card px-4 py-3 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md";

  if (!onClick) {
    return (
      <div title={title} className={`${base} border-border/70`}>
        {content}
      </div>
    );
  }

  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      aria-pressed={!!active}
      className={`${base} ${active ? "border-accent ring-1 ring-accent/40" : "border-border/70"}`}
    >
      {content}
    </button>
  );
}
