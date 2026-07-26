import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { isAdmin, unauthorized } from "../admin";

export default defineTool({
  name: "delete_voucher",
  title: "Delete voucher (admin)",
  description: "Admin only. Permanently delete a voucher by id.",
  inputSchema: { id: z.string().uuid() },
  annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
  handler: async ({ id }, ctx) => {
    if (!isAdmin(ctx)) return unauthorized();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("vouchers").delete().eq("id", id);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return { content: [{ type: "text", text: `Voucher ${id} deleted.` }] };
  },
});
