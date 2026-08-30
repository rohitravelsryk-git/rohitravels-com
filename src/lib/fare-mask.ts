// Shared timed fare-masking rules.
// Single source of truth: the admin fare value. Once a fare has not been
// updated within its configured window, every frontend (public site, B2B
// agent portal, Book Now form) must show MASK_TEXT instead of the amount.

export const MASK_TEXT = "FARE ON WHATSAPP";
export const DEFAULT_MASK_HOURS = 2;

export type MaskableFare = {
  price_text: string;
  hide_fare_after_2h?: boolean | null;
  auto_hide_hours?: number | null;
  updated_at: string;
};

export function maskHoursOf(f: MaskableFare): number {
  const h = Number(f.auto_hide_hours);
  return Number.isFinite(h) && h > 0 ? h : DEFAULT_MASK_HOURS;
}

/** Timestamp (ms) at which this fare's amount becomes hidden. */
export function maskAtMs(f: MaskableFare): number {
  return new Date(f.updated_at).getTime() + maskHoursOf(f) * 3_600_000;
}

export function isFareMasked(f: MaskableFare, now: number = Date.now()): boolean {
  if (!f.hide_fare_after_2h) return false;
  return now >= maskAtMs(f);
}

/** Price string safe for any frontend. */
export function maskedPriceText(f: MaskableFare, now: number = Date.now()): string {
  return isFareMasked(f, now) ? MASK_TEXT : f.price_text;
}

/** Returns the fare with its price already masked (amount never leaves the server). */
export function withMaskedPrice<T extends MaskableFare>(f: T, now: number = Date.now()): T {
  return { ...f, price_text: maskedPriceText(f, now) };
}
