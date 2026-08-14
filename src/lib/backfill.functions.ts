import { createServerFn } from "@tanstack/react-start";
import { syncSelfTicketsToDashboards } from "./self-group-link.server";

export const backfillAllData = createServerFn({ method: "POST" })
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    
    // 1. Get all confirmed bookings
    const { data: bookings } = await supabaseAdmin
      .from("agent_bookings")
      .select("*")
      .eq("status", "confirmed");
    
    const results = {
      bookingsChecked: bookings?.length ?? 0,
      ticketsCreated: 0,
      errors: [] as string[]
    };

    if (bookings) {
      // Import the promotion logic (we need to export it or replicate it)
      // Since it's a one-time thing, we'll call promoteConfirmedBooking for each
      const { promoteConfirmedBooking } = await import("./agent-bookings.functions");
      
      for (const b of bookings) {
        try {
          await promoteConfirmedBooking(b.id);
          results.ticketsCreated++;
        } catch (e: any) {
          results.errors.push(`Booking ${b.id}: ${e.message}`);
        }
      }
    }

    // 2. Run the linkage sync to dashboards
    try {
      await syncSelfTicketsToDashboards(supabaseAdmin);
    } catch (e: any) {
      results.errors.push(`Sync failed: ${e.message}`);
    }

    return results;
  });
