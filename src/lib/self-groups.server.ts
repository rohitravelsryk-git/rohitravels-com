// Server-only helper: keeps a "Groups Applied" row mirrored into the public
// `fares` table (group_type = "self") so every applied group automatically
// appears in the admin Group Fares tab and the Self Groups dashboard.

type AppRow = {
  id: string;
  fare_id: string | null;
  airline: string;
  origin: string;
  destination: string;
  flight_date: string | null;
  flight_details: string;
  luggage: string;
  meal: string;
  seats: number;
  fare_per_pax: number;
  sort_order: number;
  pnr?: string;
};

type Loc = { city: string; code: string };

/** Resolves a typed value (city name or IATA code) into { city, code }. */
function resolveLocation(value: string, locs: Loc[]): { city: string; code: string } {
  const q = (value || "").trim().toUpperCase();
  if (!q) return { city: "", code: "" };
  const hit =
    locs.find((l) => (l.code || "").toUpperCase() === q) ??
    locs.find((l) => (l.city || "").toUpperCase() === q) ??
    locs.find((l) => (l.city || "").toUpperCase().startsWith(q));
  if (hit) return { city: (hit.city || "").toUpperCase(), code: (hit.code || "").toUpperCase() };
  return { city: q, code: q.length === 3 ? q : q.slice(0, 3) };
}

function farePayload(row: AppRow, locs: Loc[]) {
  const from = resolveLocation(row.origin, locs);
  const to = resolveLocation(row.destination, locs);
  return {
    origin: from.city,
    origin_code: from.code,
    destination: to.city,
    destination_code: to.code,
    airline: row.airline,
    flight_date: row.flight_date ?? "",
    flight_details: row.flight_details ?? "",
    baggage: row.luggage ?? "",
    meal: row.meal ?? "",
    seats: String(row.seats ?? 0),
    category: to.city || "GROUP",
    // Self-group fares never publish a number — agents ask on WhatsApp.
    price_text: "FARE ON WHATSAPP",
    vendor_fare: row.fare_per_pax ? String(Math.round(row.fare_per_pax)) : null,
    flight_number: row.pnr ? row.pnr.trim().toUpperCase() : null,
    group_type: "self",
    sort_order: row.sort_order ?? 0,
  };
}

/** Mirrors an application row into `fares`; returns the linked fare id. */
export async function syncApplicationToFare(admin: any, row: AppRow): Promise<string | null> {
  const origin = (row.origin || "").trim();
  const destination = (row.destination || "").trim();
  const airline = (row.airline || "").trim();
  if (!airline || !origin || !destination) return row.fare_id ?? null;

  const { data: locData } = await admin.from("locations").select("city, code");
  const locs = (locData ?? []) as Loc[];
  const payload = farePayload(row, locs);

  if (row.fare_id) {
    const { data, error } = await admin
      .from("fares")
      .update(payload)
      .eq("id", row.fare_id)
      .select("id")
      .maybeSingle();
    if (!error && data?.id) return data.id as string;
  }

  const { data: created, error: insErr } = await admin
    .from("fares")
    .insert(payload)
    .select("id")
    .single();
  if (insErr || !created?.id) {
    console.error("syncApplicationToFare insert failed", insErr?.message, payload);
    return row.fare_id ?? null;
  }

  const { error: linkErr } = await admin
    .from("self_group_applications")
    .update({ fare_id: created.id })
    .eq("id", row.id);
  if (linkErr) console.error("syncApplicationToFare link failed", linkErr.message);
  return created.id as string;
}
