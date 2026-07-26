import { defineTool } from "@lovable.dev/mcp-js";
import { isAdmin, unauthorized } from "../admin";

export default defineTool({
  name: "list_vouchers_admin",
  title: "List all vouchers (admin)",
  description:
    "Admin only. Return every voucher with full details including agent name, PNR, voucher amount, and notes.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!isAdmin(ctx)) return unauthorized();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("vouchers")
      .select("*")
      .order("sr", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    const rows = data ?? [];
    return {
      content: [{ type: "text", text: `Loaded ${rows.length} vouchers (admin view).` }],
      structuredContent: { vouchers: rows },
    };
  },
});
