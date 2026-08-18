import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";

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

export const listBankDetails = createServerFn({ method: "GET" })
  .handler(async () => {
    const { data, error } = await supabase
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
    const { data: result, error } = await supabase
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
    const { id, ...updates } = data;
    const { data: result, error } = await supabase
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
    const { error } = await supabase.from("bank_details").delete().eq("id", data.id);

    if (error) throw new Error(error.message);
    return { success: true };
  });
