import { createFileRoute } from "@tanstack/react-router";

// Scheduled backup endpoint (called by the database scheduler).
// Authenticated with the project publishable key in the `apikey` header.
export const Route = createFileRoute("/api/public/hooks/backup-sync")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apikey = request.headers.get("apikey") ?? "";
        const expected =
          process.env["SUPABASE_PUBLISHABLE_KEY"] ?? process.env["SUPABASE_ANON_KEY"] ?? "";
        if (!expected || apikey !== expected) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }

        let body: { mode?: string } = {};
        try {
          body = (await request.json()) as { mode?: string };
        } catch {
          body = {};
        }

        const engine = await import("@/lib/backup/engine.server");
        try {
          if (body.mode === "snapshot") {
            const snap = await engine.createSnapshot(undefined, "scheduled");
            return Response.json({ ok: snap.status !== "failed", ...snap });
          }
          const full = body.mode === "full";
          const result = await engine.runSync({
            full,
            kind: full ? "scheduled-full" : "scheduled-incremental",
          });
          return Response.json({ ok: result.status !== "failed", ...result });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          console.error("[backup-sync]", message);
          return Response.json({ ok: false, error: message }, { status: 500 });
        }
      },
    },
  },
});
