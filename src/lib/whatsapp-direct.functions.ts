import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const getQuickReplies = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("wa_quick_replies")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) return [];
  return data;
});

export const saveQuickReply = createServerFn({ method: "POST" })
  .validator((d: { title: string; text: string; image_url?: string }) => 
    z.object({ 
      title: z.string().min(1), 
      text: z.string().min(1),
      image_url: z.string().optional()
    }).parse(d)
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("wa_quick_replies")
      .insert([data]);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteQuickReply = createServerFn({ method: "POST" })
  .validator((d: { id: string }) => z.object({ id: z.string() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("wa_quick_replies")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
