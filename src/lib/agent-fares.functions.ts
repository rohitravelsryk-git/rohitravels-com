import { createServerFn } from "@tanstack/react-start";

// Aggregated sold-seat counts per fare_id.
// This ensures that seat counts are isolated to specific groups/dates even if they share a sector.
export const getSectorSoldCounts = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  
  // We need to fetch from agent_bookings (where fare_id is stored)
  // Filtering for 'confirmed' status as these are the ones that count as sold.
  const { data, error } = await supabaseAdmin
    .from("agent_bookings")
    .select("fare_id, seats")
    .eq("status", "confirmed");
    
  if (error) throw new Error(error.message);
  
  const counts: Record<string, number> = {};
  for (const row of (data ?? []) as any[]) {
    if (!row.fare_id) continue;
    const seats = Number(row.seats) || 0;
    counts[row.fare_id] = (counts[row.fare_id] ?? 0) + seats;
  }
  return counts;
});
