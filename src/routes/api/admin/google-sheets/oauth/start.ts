import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/admin/google-sheets/oauth/start")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const url = await (await import("@/lib/google-sheets-oauth.server")).beginGoogleSheetsOAuth();
          return Response.redirect(url, 302);
        } catch (error) {
          const message = error instanceof Error ? error.message : "Google OAuth could not start";
          return new Response(message, { status: 500, headers: { "content-type": "text/plain; charset=utf-8" } });
        }
      },
    },
  },
});
