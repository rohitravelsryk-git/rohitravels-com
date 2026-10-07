/**
 * Site-wide default date display format: "05-OCT-26" (DD-MMM-YY uppercase).
 * Use `formatDateShort` or `formatDate` anywhere a date is shown to a user
 * (tables, ledgers, cards, receipts, admin, public, B2B) instead of a local
 * one-off formatter, so the whole site stays strictly consistent.
 */

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

/** Formats a date (or ISO/date-like string) as "05-OCT-26". Returns "—" for
 * anything missing or unparseable. */
export function formatDateShort(value: string | number | Date | null | undefined): string {
  if (!value) return "—";
  // Date-only strings ("2026-10-05") parse as UTC midnight and can shift a day
  // in other timezones, so read them directly instead of via `new Date`.
  if (typeof value === "string") {
    const m = value.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s]|$)/);
    if (m) {
      const month = MONTHS[Number(m[2]) - 1];
      if (month) return `${m[3]}-${month}-${m[1].slice(2)}`;
    }
  }
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  const day = String(d.getDate()).padStart(2, "0");
  const month = MONTHS[d.getMonth()];
  const year = String(d.getFullYear()).slice(-2);
  return `${day}-${month}-${year}`;
}

export const formatDate = formatDateShort;

/** Same format, but also appends the time as "05-OCT-26 14:05" when the
 * source value carries a time component. */
export function formatDateTimeShort(value: string | number | Date | null | undefined): string {
  if (!value) return "—";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${formatDateShort(d)} ${hh}:${mm}`;
}

export const formatDateTime = formatDateTimeShort;

export default formatDateShort;
