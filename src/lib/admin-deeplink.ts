/**
 * Deep links for the admin notification centre.
 *
 * Every notice carries the id of the record behind it, so the panel can be
 * opened as `/admin/bookings?open=<uuid>` and land straight on that booking
 * instead of dropping the admin at the top of a filtered table.
 */
export type AdminOpenSearch = { open?: string };

export function validateAdminOpen(raw: Record<string, unknown>): AdminOpenSearch {
  const value = typeof raw.open === "string" ? raw.open.trim() : "";
  return value ? { open: value } : {};
}

/** "3m ago" / "2h ago" style stamp used on the heads-up notifications. */
export function timeAgo(iso: string | null | undefined) {
  if (!iso) return "now";
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "now";
  const mins = Math.round((Date.now() - then) / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString([], { day: "2-digit", month: "short" });
}
