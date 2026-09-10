import { createServerFn } from "@tanstack/react-start";
import { useSession } from "@tanstack/react-start/server";
import { z } from "zod";

type GateSession = { unlocked?: boolean; staffUsername?: string | null };

function sessionConfig() {
  const password = typeof process !== "undefined" ? process.env.SESSION_SECRET : undefined;
  if (!password) return { password: "fallback-secret-for-prerender", name: "rohi-admin-prerender" };
  return { password, name: "rohi-admin", maxAge: 60 * 60 * 8, cookie: { httpOnly: true, secure: true, sameSite: "none" as const, path: "/" } };
}

async function requireUnlocked() {
  const session = await useSession<GateSession>(sessionConfig());
  if (!session.data.unlocked) throw new Error("Unauthorized");
  if (session.data.staffUsername) throw new Error("Forbidden: admin role required");
}

const accountInput = z.object({ name: z.string().trim().min(1), kind: z.enum(["cash", "bank", "wallet"]), opening_balance: z.number() });
const transactionInput = z.object({
  account_id: z.string().uuid(), entry_date: z.string(), entry_type: z.enum(["sale", "expense", "transfer", "manual"]),
  category: z.string().trim().min(1), party: z.string().optional(), description: z.string().trim().min(1),
  amount: z.number().positive(), direct_cost: z.number().min(0), direction: z.enum(["in", "out"]),
});

export const listAccountsBook = createServerFn({ method: "GET" }).handler(async () => {
  await requireUnlocked();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const [{ data: accounts, error: accountError }, { data: transactions, error: transactionError }] = await Promise.all([
    supabaseAdmin.from("accounts_book_accounts").select("*").eq("is_active", true).order("created_at"),
    supabaseAdmin.from("accounts_book_transactions").select("*").order("entry_date", { ascending: true }).order("created_at", { ascending: true }),
  ]);
  if (accountError) throw new Error(accountError.message);
  if (transactionError) throw new Error(transactionError.message);
  return { accounts: accounts ?? [], transactions: transactions ?? [] };
});

export const createAccountsBookAccount = createServerFn({ method: "POST" }).validator((data: unknown) => accountInput.parse(data)).handler(async ({ data }) => {
  await requireUnlocked();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: row, error } = await supabaseAdmin.from("accounts_book_accounts").insert(data).select().single();
  if (error) throw new Error(error.message);
  return row;
});

export const updateAccountsBookOpening = createServerFn({ method: "POST" }).validator((data: unknown) => z.object({ id: z.string().uuid(), opening_balance: z.number() }).parse(data)).handler(async ({ data }) => {
  await requireUnlocked();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin.from("accounts_book_accounts").update({ opening_balance: data.opening_balance }).eq("id", data.id);
  if (error) throw new Error(error.message);
  return { success: true };
});

export const createAccountsBookTransaction = createServerFn({ method: "POST" }).validator((data: unknown) => transactionInput.parse(data)).handler(async ({ data }) => {
  await requireUnlocked();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: row, error } = await supabaseAdmin.from("accounts_book_transactions").insert(data).select().single();
  if (error) throw new Error(error.message);
  return row;
});

export const deleteAccountsBookTransaction = createServerFn({ method: "POST" }).validator((id: unknown) => z.string().uuid().parse(id)).handler(async ({ data: id }) => {
  await requireUnlocked();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin.from("accounts_book_transactions").delete().eq("id", id);
  if (error) throw new Error(error.message);
  return { success: true };
});
