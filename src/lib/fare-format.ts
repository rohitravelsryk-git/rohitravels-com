// Shared canonical WhatsApp / clipboard format for a group fare.
// Used by admin panel copy buttons and the B2B agent portal copy button
// so every share pastes the same structure.

export type FareShare = {
  origin: string;
  destination: string;
  origin_code: string;
  destination_code: string;
  airline: string;
  flight_date: string;
  flight_number?: string | null;
  depart_time?: string | null;
  arrive_time?: string | null;
  baggage?: string | null;
  price_text: string;
  flight_details?: string | null;
  category?: string | null;
};

// Destination-country flag (kept short — extend as new sectors go live).
const FLAG_BY_CODE: Record<string, string> = {
  JED: "🇸🇦", RUH: "🇸🇦", MED: "🇸🇦", DMM: "🇸🇦", AHB: "🇸🇦", ELQ: "🇸🇦", YNB: "🇸🇦",
  DXB: "🇦🇪", AUH: "🇦🇪", SHJ: "🇦🇪", DWC: "🇦🇪",
  DOH: "🇶🇦",
  KWI: "🇰🇼",
  BAH: "🇧🇭",
  MCT: "🇴🇲", SLL: "🇴🇲",
  IST: "🇹🇷", SAW: "🇹🇷",
  KHI: "🇵🇰", LHE: "🇵🇰", ISB: "🇵🇰", MUX: "🇵🇰", PEW: "🇵🇰", UET: "🇵🇰", LYP: "🇵🇰", SKT: "🇵🇰",
};

export function flagFor(dest: string): string {
  return FLAG_BY_CODE[dest?.toUpperCase()] ?? "✈️";
}

function formatFlightDate(d: string): string {
  if (!d) return "";
  return d.replace(/^(\d{1,2})([A-Za-z]{3})$/, "$1 $2").toUpperCase();
}

function buildLegLines(f: FareShare): string[] {
  // Prefer admin-authored flight_details verbatim (supports multi-leg / connections).
  if (f.flight_details && f.flight_details.trim()) {
    return f.flight_details
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
  }
  const line = [
    formatFlightDate(f.flight_date),
    f.origin_code?.toUpperCase(),
    f.destination_code?.toUpperCase(),
    f.depart_time,
    f.arrive_time,
    f.flight_number,
  ]
    .filter(Boolean)
    .join(" ");
  return line ? [line] : [];
}

function formatBaggage(b?: string | null): string {
  if (!b) return "";
  return b.replace(/\s*KG\s*$/i, " KG").trim();
}

function formatFareValue(price: string): string {
  if (!price) return "";
  const num = price.replace(/[^\d]/g, "");
  if (!num) return price.trim();
  return Number(num).toLocaleString("en-US");
}

/**
 * Canonical share text:
 *
 *   🇸🇦 *KARACHI → JEDDAH*
 *
 *   FLYADEAL
 *
 *   26 JUL KHI JED 0800 1100
 *   26 JUL KHI JED 0800 1100    ← second leg / connection when present
 *
 *   Baggage: 25+7 KG
 *
 *   Fare: 110,000
 */
export function buildFareShareText(f: FareShare): string {
  const flag = flagFor(f.destination_code);
  const route = `${f.origin.toUpperCase()} → ${f.destination.toUpperCase()}`;
  const header = `${flag} *${route}*`;
  
  // Detect return fare by marker; "UMRAH" only for JED/MED return routes.
  const isReturn = isReturnFare(f);
  const subHeader = isUmrahFare(f) ? "*RETURN FARE (UMRAH)*" : isReturn ? "*RETURN FARE*" : "";

  const airline = f.airline?.toUpperCase() ?? "";
  
  let legs = "";
  if (isReturn) {
    const [dep, ret] = (f.flight_details || "").split("--- RETURN ---").map(s => s.trim());
    legs = `*Departure:*\n${dep}\n\n*Return:*\n${ret}`;
  } else {
    legs = buildLegLines(f).join("\n");
  }

  const bag = formatBaggage(f.baggage);
  
  // If price is "FARE ON WHATSAPP" or similar, keep it as is. Otherwise format numeric.
  const isNumeric = /\d/.test(f.price_text || "");
  let fareVal = isNumeric ? formatFareValue(f.price_text) : f.price_text;
  
  if (fareVal.toUpperCase().includes("FARE ON WHATSAPP")) {
    fareVal = "FARE ON WHATSAPP";
  }

  const blocks: string[] = [header];
  if (subHeader) blocks.push(subHeader);
  if (airline) blocks.push(airline);
  if (legs) blocks.push(legs);
  if (bag) blocks.push(`Baggage: ${bag}`);
  if (fareVal) blocks.push(`Fare: ${fareVal}`);
  return blocks.join("\n\n");
}
