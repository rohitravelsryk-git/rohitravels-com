/**
 * Single source of truth for the "UMRAH" label rule.
 *
 * A fare is UMRAH **only** when it is a RETURN / round-trip fare AND the route
 * touches Jeddah (JED) or Medinah (MED / MDA) in either direction.
 * One-way fares, and return fares that do not involve JED/MED, must never
 * display "UMRAH" or "CATEGORY: UMRAH" anywhere (admin, public site, B2B).
 */

export const RETURN_MARKER = "--- RETURN ---";

const UMRAH_CODES = new Set(["JED", "MED", "MDA"]);
const UMRAH_CITIES = /JEDDAH|MADIN|MADINA|MADINAH|MEDIN|MEDINA|MEDINAH/i;

export type UmrahFareLike = {
  origin?: string | null;
  destination?: string | null;
  origin_code?: string | null;
  destination_code?: string | null;
  flight_details?: string | null;
};

export function isReturnFare(f: { flight_details?: string | null } | null | undefined): boolean {
  return String(f?.flight_details ?? "").includes(RETURN_MARKER);
}

export function touchesUmrahSector(f: UmrahFareLike | null | undefined): boolean {
  if (!f) return false;
  const codes = [f.origin_code, f.destination_code].map((c) => String(c ?? "").trim().toUpperCase());
  if (codes.some((c) => UMRAH_CODES.has(c))) return true;
  return [f.origin, f.destination].some((c) => UMRAH_CITIES.test(String(c ?? "")));
}

/** True only for RETURN fares whose route includes JED or MED. */
export function isUmrahFare(f: UmrahFareLike | null | undefined): boolean {
  return isReturnFare(f ?? undefined) && touchesUmrahSector(f);
}

/** Category label to show: "UMRAH" when the rule matches, otherwise null. */
export function umrahCategoryLabel(f: UmrahFareLike | null | undefined): string | null {
  return isUmrahFare(f) ? "UMRAH" : null;
}
