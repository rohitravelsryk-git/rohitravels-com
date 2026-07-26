import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { isAdmin, unauthorized } from "../admin";

export default defineTool({
  name: "update_voucher",
  title: "Update voucher (admin)",
  description: "Admin only. Update fields on an existing voucher by id. Only fields you pass are changed.",
  inputSchema: {
    id: z.string().uuid(),
    sr: z.number().int().optional(),
    agent_name: z.string().optional(),
    passenger_name: z.string().optional(),
    pnr: z.string().optional(),
    voucher_amount: z.string().optional(),
    airline: z.string().optional(),
    expiry_date: z.string().optional(),
    notes: z.string().optional(),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async (input, ctx) => {
    if (!isAdmin(ctx)) return unauthorized();
    const { id, ...rest } = input;
    const patch: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(rest)) if (v !== undefined) patch[k] = v;
    if (Object.keys(patch).length === 0) {
      return { content: [{ type: "text", text: "No fields to update." }], isError: true };
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await (supabaseAdmin.from("vouchers") as unknown as {
      update: (p: Record<string, unknown>) => { eq: (c: string, v: string) => { select: () => { single: () => Promise<{ data: unknown; error: { message: string } | null }> } } };
    })
      .update(patch)
      .eq("id", id)
      .select()
      .single();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: `Voucher ${id} updated.` }],
      structuredContent: { voucher: data },
    };
  },
});
