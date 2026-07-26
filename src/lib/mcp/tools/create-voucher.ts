import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { isAdmin, unauthorized } from "../admin";

export default defineTool({
  name: "create_voucher",
  title: "Create voucher (admin)",
  description: "Admin only. Insert a new discount voucher.",
  inputSchema: {
    sr: z.number().int().optional().describe("Serial number order."),
    agent_name: z.string().optional(),
    passenger_name: z.string().optional(),
    pnr: z.string().optional(),
    voucher_amount: z.string().optional(),
    airline: z.string().optional(),
    expiry_date: z.string().optional().describe("YYYY-MM-DD or free-form."),
    notes: z.string().optional(),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async (input, ctx) => {
    if (!isAdmin(ctx)) return unauthorized();
    const row = {
      sr: input.sr ?? 0,
      agent_name: input.agent_name ?? "",
      passenger_name: input.passenger_name ?? "",
      pnr: input.pnr ?? "",
      voucher_amount: input.voucher_amount ?? "",
      airline: input.airline ?? "",
      expiry_date: input.expiry_date ?? "",
      notes: input.notes ?? "",
      name: input.passenger_name || input.pnr || input.agent_name || "",
      alert_date: "",
      days_left: "",
      status: "",
    };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.from("vouchers").insert(row).select().single();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: `Voucher created (id ${data.id}).` }],
      structuredContent: { voucher: data },
    };
  },
});
