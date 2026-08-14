// Server-only helper: links confirmed "self" group tickets into the Self Groups
// passenger manifests (Group Dashboards). Dashboards group passengers by
// `fare_id`, so every mirrored ticket must resolve to its self-group fare.

type Ticket = {
  id: string;
  group_type: string;
  pax_name: string | null;
  pnr: string | null;
  sector: string | null;
  airline: string | null;
};

type Fare = {
  id: string;
  airline: string | null;
  pnr: string | null;
  flight_details: string | null;
  origin_code: string | null;
  destination_code: string | null;
};

const norm = (v: string | null | undefined) =>
  (v || "")
    .replace(/\|/g, "\n")
    .split(/\r?\n/)
    .map((l) => l.trim().replace(/\s+/g, " ").toUpperCase())
    .filter(Boolean)
    .join("\n");

function splitName(full: string | null | undefined) {
  const parts = (full || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { title: "MR", first: "", last: "" };
  if (parts.length === 1) return { title: "MR", first: parts[0], last: "" };
  return { title: "MR", first: parts[0], last: parts.slice(1).join(" ") };
}

/** Best-effort match of a ticket to a self-group fare (PNR first, then itinerary). */
export function matchSelfFare(ticket: Ticket, fares: Fare[]): Fare | null {
  const pnr = (ticket.pnr || "").trim().toUpperCase();
  if (pnr) {
    const byPnr = fares.find((f) => (f.pnr || "").trim().toUpperCase() === pnr);
    if (byPnr) return byPnr;
  }

  const sector = norm(ticket.sector);
  if (!sector) return null;
  const lines = sector.split("\n");

  // Exact itinerary match, then "first leg" match (tickets sometimes store one leg).
  const exact = fares.find((f) => norm(f.flight_details) === sector);
  if (exact) return exact;

  const partial = fares.filter((f) => {
    const fl = norm(f.flight_details).split("\n");
    if (!fl.length) return false;
    return lines.every((l) => fl.includes(l)) || fl[0] === lines[0];
  });
  if (partial.length === 1) return partial[0];
  if (partial.length > 1) {
    const air = (ticket.airline || "").trim().toUpperCase();
    const byAir = partial.find((f) => (f.airline || "").trim().toUpperCase() === air);
    if (byAir) return byAir;
    return partial[0];
  }
  return null;
}

/**
 * Ensures every self-type group ticket has a passenger row on its group
 * dashboard, and backfills `fare_id` on rows that were created without a link.
 */
export async function syncSelfTicketsToDashboards(admin: any) {
  const { data: tickets } = await admin
    .from("group_tickets")
    .select("id, fare_id, group_type, pax_name, pnr, sector, airline")
    .eq("group_type", "self");
  const list = (tickets ?? []) as Ticket[];
  if (!list.length) return;

  const { data: fareData } = await admin
    .from("fares")
    .select("id, airline, pnr, flight_details, origin_code, destination_code")
    .eq("group_type", "self");
  const fares = (fareData ?? []) as Fare[];
  if (!fares.length) return;

  const { data: paxData } = await admin
    .from("self_group_passengers")
    .select("id, ticket_id, fare_id");
  const pax = (paxData ?? []) as { id: string; ticket_id: string | null; fare_id: string | null }[];

  for (const t of list) {
    // Check if this ticket is already linked in self_group_passengers
    const existing = pax.find((p) => p.ticket_id === t.id);
    
    // We attempt to find the fare_id either from the ticket itself (if backfilled)
    // or by matching the itinerary/PNR to the fares table.
    let fareId = (t as any).fare_id;
    if (!fareId) {
      const matched = matchSelfFare(t, fares);
      if (matched) fareId = matched.id;
    }

    if (!fareId) continue;

    const paxData = {
      ticket_id: t.id,
      fare_id: fareId,
      title: splitName(t.pax_name).title,
      first_name: splitName(t.pax_name).first,
      last_name: splitName(t.pax_name).last,
      pnr: (t.pnr || "").trim().toUpperCase(),
      sector: t.sector || "",
    };

    if (existing) {
      // Update existing passenger record to ensure it has the correct fare_id linkage
      await admin
        .from("self_group_passengers")
        .update({
          fare_id: fareId,
          pnr: paxData.pnr,
          sector: paxData.sector,
          first_name: paxData.first_name,
          last_name: paxData.last_name,
        })
        .eq("id", existing.id);
    } else {
      // Create new passenger record linked to the group dashboard
      await admin.from("self_group_passengers").insert(paxData);
    }
  }
}
