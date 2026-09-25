/**
 * Single source of truth for the ledger "GRP TKT" detail line, written as
 *   GRP TKT - Muhammad Subhan*5 - KHI JED - 776JHGU - XY
 * i.e. first passenger (with *N when the group is bigger than one), the route
 * as IATA codes only, the PNR, then the airline's IATA code. Used by the admin
 * Group Tickets form, the admin ledger and the B2B agent ledger so all three
 * always read identically.
 */

const AIRLINE_IATA: Record<string, string> = {
  "SALAM AIR": "OV",
  "PIA": "PK",
  "AIRBLUE": "PA",
  "AIR BLUE": "PA",
  "AIRSIAL": "PF",
  "AIR SIAL": "PF",
  "SERENE AIR": "ER",
  "FLYDUBAI": "FZ",
  "FLY DUBAI": "FZ",
  "AIR ARABIA": "G9",
  "FLYNAS": "XY",
  "FIYAK": "F3",
  "ETIHAD": "EY",
  "ETIHAD AIRWAYS": "EY",
  "EMIRATES": "EK",
  "QATAR": "QR",
  "QATAR AIRWAYS": "QR",
  "SAUDIA": "SV",
};

/** Airline IATA code: an explicit code wins, then the name map, then the name itself. */
export function airlineIata(name?: string | null, code?: string | null) {
  const explicit = String(code ?? "").trim().toUpperCase();
  if (explicit) return explicit;
  const airline = String(name ?? "").trim().toUpperCase().replace(/\s+/g, " ");
  return AIRLINE_IATA[airline] ?? airline;
}

const TITLES = ["mr", "mrs", "ms", "miss", "master"];

/** "Muhammad Subhan*5" for a group, "Muhammad Subhan" for a single pax. */
export function paxLedgerName(names?: string | null, seats?: number | null) {
  const list = String(names ?? "")
    .split("\n")
    .map((line) => (line.split("|")[0] ?? "").trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split(/\s+/).filter(Boolean);
      const start = TITLES.includes(parts[0]?.toLowerCase().replace(/\.$/, "")) ? 1 : 0;
      return parts.slice(start).join(" ");
    })
    .filter(Boolean);
  const first = list[0] || "Pax";
  const count = list.length || Number(seats) || 0;
  return count > 1 ? `${first}*${count}` : first;
}

/** Route as IATA codes only ("KHI JED") from a flight-details / sector block. */
export function sectorRoute(sector?: string | null) {
  const text = String(sector ?? "").toUpperCase();
  // "10 AUG MUX DXB 1120 1320" first, then a block without the date, then a bare "KHI-JED".
  const patterns = [
    /\b\d{1,2}\s+[A-Z]{3}\s+([A-Z]{3})\s+([A-Z]{3})\s+[A-Z]{3}\s+\d{3,4}\s+\d{3,4}\b/g,
    /\b([A-Z]{3})\s+([A-Z]{3})\s+\d{3,4}\b/g,
    /\b([A-Z]{3})[-/]([A-Z]{3})\b/g,
  ];
  for (const re of patterns) {
    const pairs = [...text.matchAll(re)];
    if (!pairs.length) continue;
    const from = pairs[0][1];
    // A round trip folds back to its origin, so show the turnaround city instead.
    const turnaround = [...pairs].reverse().find((p) => p[2] !== from)?.[2];
    return `${from} ${turnaround ?? pairs[0][2]}`;
  }
  return "";
}

export type GroupTicketLedgerInput = {
  passengerNames?: string | null;
  seats?: number | null;
  /** Already-resolved "KHI JED"; falls back to parsing `sector`. */
  route?: string | null;
  sector?: string | null;
  pnr?: string | null;
  airline?: string | null;
  airlineCode?: string | null;
};

export function groupTicketLedgerEntry(d: GroupTicketLedgerInput): string {
  const route = String(d.route ?? "").trim() || sectorRoute(d.sector);
  return ["GRP TKT", paxLedgerName(d.passengerNames, d.seats), route, String(d.pnr ?? "").trim().toUpperCase(), airlineIata(d.airline, d.airlineCode)]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" - ");
}

/** Ledger line straight from an agent booking row and its fare snapshot. */
export function bookingLedgerEntry(b: any): string {
  const f = b?.fare_snapshot ?? {};
  const origin = String(f.origin_code ?? "").trim().toUpperCase();
  const destination = String(f.destination_code ?? "").trim().toUpperCase();
  return groupTicketLedgerEntry({
    passengerNames: b?.passenger_names,
    seats: b?.seats,
    route: `${origin} ${destination}`.trim(),
    sector: String(f.flight_details ?? ""),
    pnr: String(f.pnr ?? b?.pnr ?? ""),
    airline: String(f.airline ?? ""),
    airlineCode: String(f.airline_code ?? ""),
  });
}
