import { createFileRoute } from "@tanstack/react-router";

// Automated backup sync is stopped per administrator configuration.
// Operations are restricted to the 8 dedicated spreadsheets.
export const Route = createFileRoute("/api/public/hooks/backup-sync")({
  server: {
    handlers: {
      POST: async () => {
        return Response.json({
          ok: true,
          message: "Automated master backup creation has been disabled. Work is directed to dedicated operational sheets only.",
        });
      },
      GET: async () => {
        return Response.json({
          ok: true,
          status: "disabled",
        });
      },
    },
  },
});
