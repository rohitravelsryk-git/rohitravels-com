import { createFileRoute } from "@tanstack/react-router";
import { verifyApprovalToken, sendMail, agentApprovedEmail, SITE_URL } from "@/lib/agent-admin-helpers";

export const Route = createFileRoute("/api/public/agent-approve")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const token = url.searchParams.get("token") ?? "";
        const verified = verifyApprovalToken(token);
        if (!verified.ok) return htmlPage("Invalid or expired link", "This approval link is not valid.", false);

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: agent, error } = await supabaseAdmin
          .from("agents")
          .update({ status: verified.status })
          .eq("user_id", verified.userId)
          .select("agency_name, contact_person, email, status")
          .maybeSingle();

        if (error || !agent) return htmlPage("Agent not found", "We couldn't find that agency.", false);

        if (verified.status === "approved") {
          const loginUrl = `${SITE_URL.replace(/\/$/, "")}/agent/login`;
          await sendMail(
            agent.email,
            `Your agency ${agent.agency_name} has been approved`,
            agentApprovedEmail(agent.agency_name, agent.contact_person, loginUrl),
          );
          return htmlPage("Agency approved ✓", `${agent.agency_name} has been approved and notified by email.`, true);
        }
        return htmlPage("Agency rejected", `${agent.agency_name} has been marked as rejected.`, true);
      },
    },
  },
});

function htmlPage(title: string, body: string, ok: boolean) {
  const color = ok ? "#059669" : "#dc2626";
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <style>body{font-family:system-ui,Arial,sans-serif;background:#f3f4f6;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:24px} .card{background:#fff;padding:32px 28px;border-radius:12px;box-shadow:0 6px 24px rgba(0,0,0,.08);max-width:420px;text-align:center} h1{margin:0 0 8px;color:${color};font-size:22px} p{margin:0 0 16px;color:#374151;font-size:15px} a{color:#0b2545;font-weight:600}</style>
    </head><body><div class="card"><h1>${title}</h1><p>${body}</p><p><a href="/admin/agents">Open admin panel</a></p></div></body></html>`;
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}
