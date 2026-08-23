import { createServerFn } from "@tanstack/react-start";

// Aggregated sold-seat counts per fare_id.
// This ensures that seat counts are isolated to specific groups/dates even if they share a sector.
export const getSectorSoldCounts = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  
  // 1. Fetch seats from active agent bookings.
  // We include 'submitted', 'pending', and 'on hold' to block inventory immediately.
  const { data: bData, error: bErr } = await supabaseAdmin
    .from("agent_bookings")
    .select("fare_id, seats, status")
    .in("status", ["confirmed", "submitted", "pending", "on hold"]);
    
  if (bErr) throw new Error(bErr.message);

  // 2. Fetch seats from confirmed group tickets.
  // This covers bookings that were promoted to tickets and any manually entered tickets.
  const { data: tData, error: tErr } = await supabaseAdmin
    .from("group_tickets")
    .select("fare_id, seats")
    .not("fare_id", "is", null);

  if (tErr) throw new Error(tErr.message);
  
  const counts: Record<string, number> = {};
  
  // Aggregate from bookings
  for (const row of (bData ?? []) as any[]) {
    if (!row.fare_id) continue;
    const seats = Number(row.seats) || 0;
    counts[row.fare_id] = (counts[row.fare_id] ?? 0) + seats;
  }

  // Aggregate from group tickets (only if they aren't already counted via booking_id linkage)
  // Actually, agent_bookings are marked 'confirmed' when promoted. 
  // To avoid double counting, we should only count bookings that are NOT yet tickets, 
  // OR just trust the tickets table for confirmed ones and filter bookings.
  // However, promoteConfirmedBooking keeps the booking status as 'confirmed'.
  // Let's isolation by checking if the booking is 'confirmed' vs 'submitted'.
  
  // Refined Logic: 
  // - 'submitted', 'pending', 'on hold' from agent_bookings (Active inventory blocks)
  // - ALL from group_tickets linked to this fare (Finalized inventory blocks)
  
  // Wait, if a booking is 'confirmed', it exists in group_tickets. 
  // So we take agent_bookings WHERE status IS NOT 'confirmed', plus ALL group_tickets.
  
  const countsV2: Record<string, number> = {};
  
  // Active requests (not yet finalized into tickets)
  for (const row of (bData ?? []) as any[]) {
    if (!row.fare_id || row.status === "confirmed") continue;
    countsV2[row.fare_id] = (countsV2[row.fare_id] ?? 0) + (Number(row.seats) || 0);
  }
  
  // Finalized tickets
  for (const row of (tData ?? []) as any[]) {
    if (!row.fare_id) continue;
    countsV2[row.fare_id] = (countsV2[row.fare_id] ?? 0) + (Number(row.seats) || 0);
  }

  return countsV2;
});
