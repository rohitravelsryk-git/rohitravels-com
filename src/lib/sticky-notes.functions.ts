import { createServerFn } from "@tanstack/react-start";
import { z } from "@tanstack/react-start"; // Fixed: validator uses zod from elsewhere usually, but let's stick to import z from "zod" if available or ensure it matches schema
import { supabase } from "@/integrations/supabase/client";

// Re-importing Zod to be sure
import { z as zod } from "zod";

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
  .validator((data: unknown) => 
    zod.object({
      content: zod.string(),
      is_enabled: zod.boolean()
    }).parse(data)
  )
  .handler(async ({ data }) => {
    // We need to import requireAdmin inside the handler to avoid circular dependencies 
    // and ensure it's running on the server context.
    const { requireAdmin } = await import("./fares.functions");
    await requireAdmin();

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

