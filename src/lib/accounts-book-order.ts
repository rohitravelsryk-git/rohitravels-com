// Accounts Book rows are always shown in the order they were CREATED -- never
// re-sorted by their (editable, back-datable) entry date and never by random id.
// This one rule is shared by the web page and every Google Sheets writer so the
// website, Supabase and the sheets can never disagree about the order.

type Orderable = {
  id?: string | null;
  created_at?: string | null;
  source_type?: string | null;
  direction?: string | null;
};

// Postgres drops trailing zeros from fractional seconds ("…56.5+00:00" vs
// "…56.500000+00:00"), so pad them before comparing as text.
function normalizeTimestamp(value?: string | null): string {
  const text = String(value ?? "");
  const match = /^(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2})(?:\.(\d+))?(.*)$/.exec(text);
  if (!match) return text;
  return `${match[1].replace(" ", "T")}.${(match[2] ?? "").padEnd(6, "0")}${match[3]}`;
}

// The legs of one transaction (sale + its cost payment, both sides of a
// transfer) are written in a single statement and so share one timestamp.
// Keep them in the order they were posted: transfer = out then in, sale/others = in then out.
function legRank(row: Orderable): number {
  if (row.source_type === "transfer") return row.direction === "out" ? 0 : 1;
  return row.direction === "in" ? 0 : 1;
}

export function compareCreationOrder(a: Orderable, b: Orderable): number {
  const ta = normalizeTimestamp(a.created_at);
  const tb = normalizeTimestamp(b.created_at);
  if (ta !== tb) return ta < tb ? -1 : 1;
  const rank = legRank(a) - legRank(b);
  if (rank !== 0) return rank;
  return String(a.id ?? "").localeCompare(String(b.id ?? ""));
}

export function inCreationOrder<T extends Orderable>(rows: readonly T[]): T[] {
  return [...rows].sort(compareCreationOrder);
}
