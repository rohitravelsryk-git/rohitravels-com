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
 * → ISO string. A bare month rolls to next year when this year's date has already
 * gone by more than a day, matching how the tickets panel reads stored sectors.
 */
export function travelAtFromFlight(details?: string | null): string | null {
  const m = String(details ?? "").toUpperCase().match(/\b(\d{1,2})\s+([A-Z]{3})\s+[A-Z]{3}\s+[A-Z]{3}\s+(\d{3,4})\b/);
  if (!m) return null;
  const mon = MONTHS[m[2]];
  if (mon === undefined) return null;
  const day = parseInt(m[1], 10);
  const t = m[3].padStart(4, "0");
  const now = new Date();
  const build = (y: number) =>
    new Date(y, mon, day, parseInt(t.slice(0, 2), 10), parseInt(t.slice(2), 10));
  let d = build(now.getFullYear());
  if (d.getTime() < now.getTime() - 60 * 86400000) d = build(now.getFullYear() + 1);
  return d.toISOString();
}

