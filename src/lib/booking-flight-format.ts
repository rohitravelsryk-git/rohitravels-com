/**
 * Single source of truth for the "Airline / Flight Details" block shown for a
 * booking — used by the admin bookings table, the agent portal and the
 * notification emails so every surface reads identically:
 *
 *   Airline: Salam Air
 *   Flight Details:
 *   25 AUG KHI MCT 0640 0730
 *   25 AUG MCT JED 1330 1600
 *   Fare: FARE ON WHATSAPP
 *   Baggage: 20+05 KG
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

/**
 * Returns city and its IATA code if available.
 * E.g. "Karachi KHI"
 */
function cityWithCode(city: string, code: string): string {
  const c = titleCase(city);
  const cd = up(code);
  if (!c && !cd) return "—";
  if (!c) return cd;
  if (!cd) return c;
  return `${c} ${cd}`;
}

export function flightBlockLines(f: FareSnapshot, opts?: { fare?: string | null }): string[] {
  if (!f) return ["—"];
  const lines: string[] = [];

  const fromCity = String(f["origin"] || "").toUpperCase();
  const toCity = String(f["destination"] || "").toUpperCase();
  const fromCode = String(f["origin_code"] || "").toUpperCase();
  const toCode = String(f["destination_code"] || "").toUpperCase();

  // KARACHI MADINAH (Bold in UI)
  lines.push(`${fromCity} ${toCity}`);
  // KHI MED (Small in UI)
  lines.push(`${fromCode} ${toCode}`);

  const airline = String(f["airline"] ?? "").trim();
  if (airline) {
    lines.push(`Airline: ${airline}`);
  }

  lines.push("Flight Details:");
  const details = String(f["flight_details"] ?? "").trim();
  if (details) {
    const isReturn = details.includes("--- RETURN ---");
    if (isReturn) {
      const [dep, ret] = details.split("--- RETURN ---").map(s => s.trim());
      lines.push("DEPARTURE:");
      for (const seg of dep.split(/\s*(?:\||\/{2}|\n|\r)\s*/).filter(Boolean)) {
        lines.push(seg.toUpperCase());
      }
      lines.push("RETURN:");
      for (const seg of ret.split(/\s*(?:\||\/{2}|\n|\r)\s*/).filter(Boolean)) {
        lines.push(seg.toUpperCase());
      }
    } else {
      for (const seg of details.split(/\s*(?:\||\/{2}|\n|\r)\s*/).map((s) => s.trim()).filter(Boolean)) {
        lines.push(seg.toUpperCase());
      }
    }
  } else {
    const seg = [f["flight_date"], fromCode, toCode, f["depart_time"], f["arrive_time"]]
      .map((v) => String(v ?? "").trim())
      .filter(Boolean)
      .join(" ");
    if (seg) lines.push(seg.toUpperCase());
  }

  const fare = (opts?.fare ?? "").toString().trim() || String(f["fare_on_demand"] ?? "").trim() || String(f["price_text"] ?? "").trim();
  if (fare) {
    const formattedFare = /\d/.test(fare) ? fare : "FARE ON WHATSAPP";
    lines.push(`Fare: ${formattedFare}`);
  }

  const bag = String(f["baggage"] ?? "").trim();
  if (bag) lines.push(`Baggage: ${bag}`);

  return lines;
}

export function flightBlockText(f: FareSnapshot, opts?: { fare?: string | null }): string {
  return flightBlockLines(f, opts).join("\n");
}

const MONTHS: Record<string, number> = {
  JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5,
  JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11,
};

/**
 * First departure date & time in a flight-details block — "10 AUG MUX DXB 1120 1320"
 * → ISO string.
 *
 * The clock written in a sector line is the airport's own time and every ROHI
 * group departs Pakistan, so it is pinned to UTC+5. Reading it in whatever zone
 * the code happens to run in made server-derived rows land five hours away from
 * the FLIGHT DETAILS column shown next to them.
 *
 * A bare month rolls to next year only when this year's date is already more than
 * six months behind, so a flight that recently flew stays in the past instead of
 * jumping a year forward.
 */
const SECTOR_OFFSET_MS = 5 * 60 * 60 * 1000;

export function travelAtFromFlight(details?: string | null): string | null {
  // Two airport codes must sit between the month and the clock, and the clock is
  // four digits (or HH:MM) — so a flight number such as "605" can't be read as 06:05.
  // "KHI JED GIL 605 1345 1605" is skipped as long as the token after it isn't itself
  // a clock, which keeps the departure time and never the arrival time.
  const m = String(details ?? "").toUpperCase().match(/\b(\d{1,2})\s+([A-Z]{3})\s+[A-Z]{3}\s+[A-Z]{3}\s+(?:[A-Z]{2,3}\s?\d{2,4}\s+)?(?:(?!\d{2}:\d{2}|\d{4}\s)\d{2,4}\s+)?(\d{2}):?(\d{2})\b/);
  if (!m) return null;
  const mon = MONTHS[m[2]];
  if (mon === undefined) return null;
  const day = parseInt(m[1], 10);
  const hh = parseInt(m[3], 10);
  const mm = parseInt(m[4], 10);
  if (day < 1 || day > 31 || hh > 23 || mm > 59) return null;
  const now = Date.now();
  const year = new Date(now).getUTCFullYear();
  const at = (y: number) => Date.UTC(y, mon, day, hh, mm) - SECTOR_OFFSET_MS;
  let ms = at(year);
  if (ms < now - 183 * 86400000) ms = at(year + 1);
  return new Date(ms).toISOString();
}

