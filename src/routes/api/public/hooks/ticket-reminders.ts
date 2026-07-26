import { createFileRoute } from "@tanstack/react-router";
import { runTicketReminderScan } from "@/lib/tickets.functions";

export const Route = createFileRoute("/api/public/hooks/ticket-reminders")({
  server: {
    handlers: {
      POST: async () => {
        try {
          const res = await runTicketReminderScan();
          return Response.json({ ok: true, ...res });
        } catch (e) {
          return Response.json({ ok: false, error: (e as Error).message }, { status: 500 });
        }
      },
      GET: async () => {
        const res = await runTicketReminderScan();
        return Response.json({ ok: true, ...res });
      },
    },
  },
});
