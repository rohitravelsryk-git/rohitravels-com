/**
 * Single source of truth for the "Airline / Flight Details" block shown for a
 * booking — used by the admin bookings table, the agent portal and the
 * notification emails so every surface reads identically:
 *
 *   Karachi → Jeddah
 *   KHI → JED
 *   Salam Air
 *   25 AUG KHI MCT 0640 0730
 *   25 AUG MCT JED 1330 1600
 *   Fare: 73000
 *   Bag: 20+05 KG
 */

export type FareSnapshot = Record<string, unknown> | null | undefined;

function titleCase(v: unknown): string {
  const s = String(v ?? "").trim();
  if (!s) return "";
  return s.toLowerCase().replace(/(^|[\s/-])([a-z])/g, (_m, p, c) => p + c.toUpperCase());
}

function up(v: unknown): string {
  return String(v ?? "").trim().toUpperCase();
}

export function flightBlockLines(f: FareSnapshot, opts?: { fare?: string | null }): string[] {
  if (!f) return ["—"];
  const lines: string[] = [];

  const fromCity = titleCase(f["origin"]);
  const toCity = titleCase(f["destination"]);
  if (fromCity || toCity) lines.push(`${fromCity || "—"} → ${toCity || "—"}`);

  const fromCode = up(f["origin_code"]);
  const toCode = up(f["destination_code"]);
  if (fromCode || toCode) lines.push(`${fromCode || "—"} → ${toCode || "—"}`);

  const airline = String(f["airline"] ?? "").trim();
  if (airline) lines.push(airline);

  const details = String(f["flight_details"] ?? "").trim();
  if (details) {
    for (const seg of details.split(/\s*(?:\||\/{2}|\n|\r)\s*/).map((s) => s.trim()).filter(Boolean)) {
      lines.push(seg.toUpperCase());
    }
  } else {
    const seg = [f["flight_date"], fromCode, toCode, f["depart_time"], f["arrive_time"]]
      .map((v) => String(v ?? "").trim())
      .filter(Boolean)
      .join(" ");
    if (seg) lines.push(seg.toUpperCase());
  }

  const fare = (opts?.fare ?? "").toString().trim() || String(f["price_text"] ?? "").trim();
  if (fare) lines.push(`Fare: ${fare}`);

  const bag = String(f["baggage"] ?? "").trim();
  if (bag) lines.push(`Bag: ${bag}`);

  return lines;
}

export function flightBlockText(f: FareSnapshot, opts?: { fare?: string | null }): string {
  return flightBlockLines(f, opts).join("\n");
}
