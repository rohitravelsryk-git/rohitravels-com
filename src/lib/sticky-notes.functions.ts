import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";

export const getStickyNote = createServerFn({ method: "GET" })
  .handler(async () => {
    const { data, error } = await supabase
      .from("b2b_sticky_notes")
      .select("*")
      .eq("is_enabled", true)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return data;
  });

export const updateStickyNote = createServerFn({ method: "POST" })
  .input(z.object({
    content: z.string(),
    is_enabled: z.boolean()
  }))
  .handler(async ({ data }) => {
    // We assume there's only one record for simplicity, or we update the most recent one
    const { data: existing } = await supabase
      .from("b2b_sticky_notes")
      .select("id")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing) {
      const { error } = await supabase
        .from("b2b_sticky_notes")
        .update({
          content: data.content,
          is_enabled: data.is_enabled,
          updated_at: new Date().toISOString()
        })
        .eq("id", existing.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase
        .from("b2b_sticky_notes")
        .insert({
          content: data.content,
          is_enabled: data.is_enabled
        });
      if (error) throw new Error(error.message);
    }

    return { success: true };
  });
