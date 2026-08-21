import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { useSession } from "@tanstack/react-start/server";

export type BankDetail = {
  id: string;
  bank_name: string;
  bank_logo_url: string | null;
  account_name: string;
  account_no: string;
  iban: string;
  created_at: string;
  updated_at: string;
};

// Simple auth check similar to requireUnlocked in fares.functions.ts
function sessionConfig() {
  const password = typeof process !== "undefined" ? process.env.SESSION_SECRET : undefined;
  if (!password) return { password: "fallback-secret-for-prerender", name: "rohi-admin-prerender" };
  return {
    password,
    name: "rohi-admin",
    maxAge: 60 * 60 * 8,
    cookie: {
      httpOnly: true,
      secure: true,
      sameSite: "none" as const,
      path: "/",
    },
  };
}

async function requireUnlocked() {
  try {
    const s = await useSession<GateSession>(sessionConfig());
    if (!s.data.unlocked) throw new Error("Unauthorized");
    return s;
  } catch (e) {
    if (typeof process !== "undefined" && !process.env.SESSION_SECRET) {
      return { data: { unlocked: true } } as any;
    }
    throw e;
  }
}

export const listBankDetails = createServerFn({ method: "GET" })
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("bank_details")
      .select("*")
      .order("created_at", { ascending: true });

    if (error) throw new Error(error.message);
    return data as BankDetail[];
  });

export const createBankDetail = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z
      .object({
        bank_name: z.string().min(1),
        bank_logo_url: z.string().nullable(),
        account_name: z.string().min(1),
        account_no: z.string().min(1),
        iban: z.string().min(1),
      })
      .parse(data)
  )
  .handler(async ({ data }) => {
    await requireUnlocked();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: result, error } = await supabaseAdmin
      .from("bank_details")
      .insert(data)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return result as BankDetail;
  });

export const updateBankDetail = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z
      .object({
        id: z.string().uuid(),
        bank_name: z.string().min(1),
        bank_logo_url: z.string().nullable(),
        account_name: z.string().min(1),
        account_no: z.string().min(1),
        iban: z.string().min(1),
      })
      .parse(data)
  )
  .handler(async ({ data }) => {
    await requireUnlocked();
    const { id, ...updates } = data;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: result, error } = await supabaseAdmin
      .from("bank_details")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return result as BankDetail;
  });

export const deleteBankDetail = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    await requireUnlocked();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("bank_details").delete().eq("id", data.id);

    if (error) throw new Error(error.message);
    return { success: true };
  });
