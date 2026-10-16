import { createFileRoute } from "@tanstack/react-router";

// Instant Google Sheet mirror for Airline Accounts.
//
// A database trigger on the airline ledger tables (see migration
// airline_sheet_instant_sync) fires this webhook whenever ledger data is
// inserted, updated, or deleted in Supabase - no manual sync button needed.
// Supabase stays the source of truth: this endpoint only ever re-reads the
// latest committed snapshot and rewrites the mirror spreadsheet from it.
//
// Auth: the caller must send the shared token in the "x-sync-token" header.
// The token lives in two places, both created by the workspace owner (never
// committed here):
//   1. Supabase Vault secret "airline_sheet_sync_token" (read by the trigger)
//   2. This app's AIRLINE_SYNC_HOOK_TOKEN secret (compared below)
export const Route = createFileRoute("/api/public/hooks/airline-sheet-sync")({
  server: {
    handlers: {
      POST: async ({ request }) => handle(request),
    },
  },
});

const MAX_CATCH_UP_LOOPS = 3;

async function handle(request: Request) {
  const url = new URL(request.url);
  const provided = request.headers.get("x-sync-token") ?? url.searchParams.get("token") ?? "";
  const expected = typeof process !== "undefined" ? process.env.AIRLINE_SYNC_HOOK_TOKEN : undefined;

  if (!expected) {
    return Response.json(
      {
        ok: false,
        error:
          "AIRLINE_SYNC_HOOK_TOKEN is not configured. Add it to the project secrets, and create the matching vault secret 'airline_sheet_sync_token' in Supabase.",
      },
      { status: 503 },
    );
  }
  if (!provided || provided !== expected) {
    return Response.json({ ok: false, error: "Invalid sync token" }, { status: 401 });
  }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const db = supabaseAdmin as unknown as import("@supabase/supabase-js").SupabaseClient;

  let loops = 0;
  let syncedAny = false;
  let lastError: string | null = null;

  while (loops < MAX_CATCH_UP_LOOPS) {
    // Atomic claim: only take the work when the queue is dirty and no other
    // worker claimed it in the last few seconds. Rapid bursts of ledger edits
    // collapse into one sync instead of hammering the Google Sheets quota.
    const cutoff = new Date(Date.now() - 5000).toISOString();
    const claim = await db
      .from("airline_sheet_sync_queue")
      .update({ dirty: false, last_claimed_at: new Date().toISOString() })
      .eq("id", 1)
      .eq("dirty", true)
      .or(`last_claimed_at.is.null,last_claimed_at.lt.${cutoff}`)
      .select("id");
    if (!claim.data?.length) break;

    loops += 1;

    const { data: meta, error: metaError } = await db
      .from("airline_ledger_meta")
      .select("revision")
      .eq("id", 1)
      .maybeSingle();
    if (metaError) {
      lastError = metaError.message;
      break;
    }
    const revision = Number(meta?.revision ?? 1);

    try {
      const { syncAirlineLedgerGoogleSheetNow } = await import("@/lib/airline-ledger-google-sync");
      const result = await syncAirlineLedgerGoogleSheetNow(revision);
      syncedAny = true;
      if (!result.synced) lastError = result.error ?? "Google Sheet sync did not complete";
    } catch (error) {
      lastError = String(error instanceof Error ? error.message : error);
    }

    // If ledger data changed while we were syncing, the trigger re-marked the
    // queue dirty and we loop once more so nothing is left behind.
    const { data: queue } = await db
      .from("airline_sheet_sync_queue")
      .select("dirty")
      .eq("id", 1)
      .maybeSingle();
    if (!queue?.dirty) break;
  }

  return Response.json({ ok: true, synced: syncedAny, loops, error: lastError });
}
