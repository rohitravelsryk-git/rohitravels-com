/** Temporary diagnostic: verifies the managed email send path for admin OTPs. */
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/email-selftest")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        if (url.searchParams.get("key") !== "rohi-diag") {
          return new Response("forbidden", { status: 403 });
        }
        const { sendAppMail } = await import("@/lib/mailer");
        const res = await sendAppMail({
          to: "rohitravelsryk@gmail.com",
          subject: "Rohi Travels email delivery test",
          html: "<p>Delivery test for admin sign-in codes.</p>",
          label: "diagnostic",
        });
        return new Response(
          JSON.stringify({ ...res, hasKey: Boolean(process.env.LOVABLE_API_KEY) }),
          { headers: { "content-type": "application/json" } },
        );
      },
    },
  },
});
