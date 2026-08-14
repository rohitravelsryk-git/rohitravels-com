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

  const fromCity = String(f["origin"] || "");
  const toCity = String(f["destination"] || "");
  const fromCode = String(f["origin_code"] || "");
  const toCode = String(f["destination_code"] || "");

  // Header line: FROM: CITY CODE • TO: CITY CODE
  lines.push(`From: ${fromCity.toUpperCase()} ${fromCode.toUpperCase()} • To: ${toCity.toUpperCase()} ${toCode.toUpperCase()}`);
  lines.push("");

  const airline = String(f["airline"] ?? "").trim();
  if (airline) {
    lines.push(`Airline: ${airline}`);
    lines.push(""); // Spacing
  }

  lines.push("Flight Details:");
  const details = String(f["flight_details"] ?? "").trim();
  if (details) {
    for (const seg of details.split(/\s*(?:\||\/{2}|\n|\r)\s*/).map((s) => s.trim()).filter(Boolean)) {
      lines.push(seg.toUpperCase());
    }
  } else {
    const seg = [f["flight_date"], up(fromCode), up(toCode), f["depart_time"], f["arrive_time"]]
      .map((v) => String(v ?? "").trim())
      .filter(Boolean)
      .join(" ");
    if (seg) lines.push(seg.toUpperCase());
  }

  lines.push(""); // Spacing
  const fare = (opts?.fare ?? "").toString().trim() || String(f["price_text"] ?? "").trim();
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

