import { createFileRoute } from "@tanstack/react-router";

// Scheduled trigger for ticket reminders. Public URL, so the caller must send the
// shared TICKET_REMINDER_HOOK_TOKEN in the "x-hook-token" header. Without that
// secret configured the hook stays closed; reminders still run whenever the
// admin panel is open.
async function handle(request: Request) {
  const expected = typeof process !== "undefined" ? process.env.TICKET_REMINDER_HOOK_TOKEN : undefined;
  if (!expected) return Response.json({ ok: false, error: "Hook disabled" }, { status: 503 });
  const provided = request.headers.get("x-hook-token") ?? "";
  const { timingSafeEqual, createHash } = await import("node:crypto");
  const a = createHash("sha256").update(provided).digest();
  const b = createHash("sha256").update(expected).digest();
  if (!timingSafeEqual(a, b)) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  try {
    const { performTicketReminderScan } = await import("@/lib/tickets.functions");
    const res = await performTicketReminderScan();
    return Response.json({ ok: true, ...res });
  } catch {
    return Response.json({ ok: false, error: "Reminder scan failed" }, { status: 500 });
  }
}

export const Route = createFileRoute("/api/public/hooks/ticket-reminders")({
  server: {
    handlers: {
      POST: async ({ request }) => handle(request),
    },
  },
});
