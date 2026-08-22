import { createServerFn } from "@tanstack/react-start";

// Aggregated sold-seat counts per fare_id.
// This ensures that seat counts are isolated to specific groups/dates even if they share a sector.
export const getSectorSoldCounts = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  
  // We fetch ALL bookings that represent sold seats.
  // We include 'submitted' and 'on hold' as well if they are intended to block inventory,
  // but usually 'confirmed' is the standard for final sales.
  // The user says "wrong number of seats", which often means pending bookings aren't being subtracted.
  const { data, error } = await supabaseAdmin
    .from("agent_bookings")
    .select("fare_id, seats, status")
    .in("status", ["confirmed", "submitted", "pending"]); // Include pending to prevent overbooking
    
  if (error) throw new Error(error.message);
  
  const counts: Record<string, number> = {};
  for (const row of (data ?? []) as any[]) {
    if (!row.fare_id) continue;
    const seats = Number(row.seats) || 0;
    counts[row.fare_id] = (counts[row.fare_id] ?? 0) + seats;
  }
  return counts;
});
