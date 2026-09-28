import { createFileRoute } from "@tanstack/react-router";
import { completeGoogleSheetsOAuth } from "@/lib/google-sheets-oauth.server";

export const Route = createFileRoute("/api/admin/google-sheets/oauth/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        const error = url.searchParams.get("error");
        if (error) return new Response(`Google authorization was cancelled: ${error}`, { status: 400, headers: { "content-type": "text/plain; charset=utf-8" } });
        if (!code || !state) return new Response("Missing Google OAuth code/state", { status: 400, headers: { "content-type": "text/plain; charset=utf-8" } });
        try {
          const result = await completeGoogleSheetsOAuth(code, state);
          const target = new URL("/admin/backup", url.origin);
          target.searchParams.set("googleSheets", "connected");
          if (result.email) target.searchParams.set("account", result.email);
          return Response.redirect(target.toString(), 302);
        } catch (error) {
          const message = error instanceof Error ? error.message : "Google OAuth could not be completed";
          const target = new URL("/admin/backup", url.origin);
          target.searchParams.set("googleSheets", "error");
          target.searchParams.set("message", message.slice(0, 300));
          return Response.redirect(target.toString(), 302);
        }
      },
    },
  },
});
