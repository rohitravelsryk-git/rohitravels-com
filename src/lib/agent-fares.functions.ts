import { createServerFn } from "@tanstack/react-start";

// Aggregated sold-seat counts per sector (origin-destination), used by the B2B
// agent portal to auto-decrement remaining seats as tickets are confirmed in
// admin. Returns only aggregate counts — no passenger data — so it is safe to
// call without authentication.
export const getSectorSoldCounts = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await (supabaseAdmin as any)
    .from("group_tickets")
    .select("sector");
  if (error) throw new Error(error.message);
  const counts: Record<string, number> = {};
  for (const row of (data ?? []) as { sector: string | null }[]) {
    const tokens = (row.sector || "").toUpperCase().split(/[^A-Z0-9]+/).filter(Boolean);
    if (tokens.length < 2) continue;
    // count for every ordered pair present in the sector token list
    for (let i = 0; i < tokens.length; i++) {
      for (let j = 0; j < tokens.length; j++) {
        if (i === j) continue;
        const key = `${tokens[i]}-${tokens[j]}`;
        counts[key] = (counts[key] ?? 0) + 1;
      }
    }
  }
  return counts;
});
