import { defineTool } from "@lovable.dev/mcp-js";

export default defineTool({
  name: "list_vouchers",
  title: "List public voucher inventory",
  description:
    "Return the public discount voucher inventory (airline, expiry, passenger name). Does not include PNRs, agent names, voucher amounts, or notes.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("vouchers")
      .select("id,sr,airline,expiry_date,passenger_name,created_at,updated_at")
      .order("sr", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) {
      return { content: [{ type: "text", text: error.message }], isError: true };
    }
    const rows = data ?? [];
    return {
      content: [{ type: "text", text: `Loaded ${rows.length} vouchers.` }],
      structuredContent: { vouchers: rows },
    };
  },
});
