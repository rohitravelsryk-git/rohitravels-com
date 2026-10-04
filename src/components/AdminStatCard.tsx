import type { LucideIcon } from "lucide-react";

export type AdminStatTone = "navy" | "blue" | "green" | "amber" | "muted";

const TILE: Record<AdminStatTone, { surface: string; ink: string }> = {
  navy: { surface: "bg-[var(--rohi-surface-muted)]", ink: "text-[var(--rohi-text)]" },
  blue: { surface: "bg-[color-mix(in_srgb,var(--rohi-brand-info)_10%,transparent)]", ink: "text-[var(--rohi-brand-info)]" },
  green: { surface: "bg-[color-mix(in_srgb,var(--rohi-brand-success)_10%,transparent)]", ink: "text-[var(--rohi-brand-success)]" },
  amber: { surface: "bg-[color-mix(in_srgb,var(--rohi-brand-warning)_12%,transparent)]", ink: "text-[var(--rohi-brand-warning)]" },
  muted: { surface: "bg-[color-mix(in_srgb,var(--rohi-brand-danger)_8%,transparent)]", ink: "text-[var(--rohi-brand-danger)]" },
};

export function AdminStatCard({ label, value, icon: Icon, tone = "navy", valueColor, active, onClick, title }: { label: string; value: string | number; icon: LucideIcon; tone?: AdminStatTone; valueColor?: string; active?: boolean; onClick?: () => void; title?: string }) {
  const tile = TILE[tone];
  const content = <><span className={`grid h-10 w-10 shrink-0 place-items-center rounded-[var(--rohi-radius-md)] border border-[var(--rohi-border)] ${tile.surface} ${tile.ink}`}><Icon className="h-4 w-4" /></span><div className="min-w-0"><div className={`text-xl font-bold leading-none tabular-nums ${valueColor ?? tile.ink}`}>{value}</div><div className="mt-1 truncate text-xs font-medium text-[var(--rohi-text-muted)]">{label}</div></div></>;
  const base = "flex min-h-[72px] min-w-0 items-center gap-3 rounded-[var(--rohi-radius-lg)] border bg-[var(--rohi-surface)] px-4 py-3 text-left shadow-[var(--rohi-shadow-sm)] transition-[box-shadow,border-color,transform] duration-[var(--duration-fast)] ease-[var(--ease-premium)] hover:border-[var(--rohi-border-strong)] hover:shadow-[var(--rohi-shadow-md)]";
  if (!onClick) return <div title={title} className={base}>{content}</div>;
  return <button type="button" title={title} onClick={onClick} aria-pressed={!!active} className={`${base} ${active ? "border-[var(--rohi-brand)] ring-2 ring-[color-mix(in_srgb,var(--rohi-brand)_18%,transparent)]" : ""}`}>{content}</button>;
}
