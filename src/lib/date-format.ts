/**
 * Site-wide default date display format: "18-SEP-26" (DD-MMM-YY, uppercase).
 * Use `formatDateShort` anywhere a date is shown to a user (tables, ledgers,
 * cards, receipts) instead of a local one-off formatter, so the whole site
 * stays consistent.
 */

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

/** Formats a date (or ISO/date-like string) as "18-SEP-26". Returns "—" for
 * anything missing or unparseable. */
export function formatDateShort(value: string | number | Date | null | undefined): string {
  if (!value) return "—";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  const day = String(d.getDate()).padStart(2, "0");
  const month = MONTHS[d.getMonth()];
  const year = String(d.getFullYear()).slice(-2);
  return `${day}-${month}-${year}`;
}

/** Same format, but also appends the time as "18-SEP-26 14:05" when the
 * source value carries a time component. */
export function formatDateTimeShort(value: string | number | Date | null | undefined): string {
  if (!value) return "—";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${formatDateShort(d)} ${hh}:${mm}`;
}
