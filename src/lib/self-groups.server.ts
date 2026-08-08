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
};

function farePayload(row: AppRow) {
  const origin = (row.origin || "").trim().toUpperCase();
  const destination = (row.destination || "").trim().toUpperCase();
  return {
    origin,
    origin_code: origin,
    destination,
    destination_code: destination,
    airline: row.airline,
    flight_date: row.flight_date ?? "",
    flight_details: row.flight_details ?? "",
    baggage: row.luggage ?? "",
    meal: row.meal ?? "",
    seats: String(row.seats ?? 0),
    category: destination || "GROUP",
    price_text: row.fare_per_pax ? String(Math.round(row.fare_per_pax)) : "FARE ON WHATSAPP",
    vendor_fare: row.fare_per_pax ? String(Math.round(row.fare_per_pax)) : null,
    group_type: "self",
    sort_order: row.sort_order ?? 0,
  };
}

/** Mirrors an application row into `fares`; returns the linked fare id. */
export async function syncApplicationToFare(admin: any, row: AppRow): Promise<string | null> {
  if (!row.airline || !row.origin || !row.destination) return row.fare_id ?? null;
  const payload = farePayload(row);

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
  if (insErr) return row.fare_id ?? null;

  await admin
    .from("self_group_applications")
    .update({ fare_id: created.id })
    .eq("id", row.id);
  return created.id as string;
}
