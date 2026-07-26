import { defineTool } from "@lovable.dev/mcp-js";

export default defineTool({
  name: "list_fares",
  title: "List live fares",
  description:
    "Return the current publicly-listed live group fares (origin/destination, airline, dates, price text). Does not include internal vendor cost fields.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async () => {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const { data, error } = await supabase
      .from("fares")
      .select(
        "id,origin,origin_code,destination,destination_code,airline,flight_date,flight_details,baggage,category,price_text,is_featured,updated_at",
      )
      .order("is_featured", { ascending: false })
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });
    if (error) {
      return { content: [{ type: "text", text: error.message }], isError: true };
    }
    const rows = data ?? [];
    return {
      content: [{ type: "text", text: `Loaded ${rows.length} fares.` }],
      structuredContent: { fares: rows },
    };
  },
});
