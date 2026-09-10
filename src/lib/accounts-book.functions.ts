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

const accountInput = z.object({ name: z.string().trim().min(1), kind: z.enum(["cash", "bank", "wallet"]), opening_balance: z.number(), opening_balance_date: z.string().optional() });
const transactionInput = z.object({
  account_id: z.string().uuid(), entry_date: z.string(), entry_type: z.enum(["sale", "expense", "transfer", "manual"]),
  category: z.string().trim().min(1), party: z.string().optional(), description: z.string().trim().min(1),
  amount: z.number().positive(), direct_cost: z.number().min(0), direction: z.enum(["in", "out"]),
  source_type: z.string().optional(), source_id: z.string().uuid().optional(),
});

const linkedEntryInput = z.object({
  entry_date: z.string(), category: z.string().trim().min(1), party: z.string().optional(), description: z.string().trim().min(1),
  account_id: z.string().uuid(), amount: z.number().positive(), direct_cost: z.number().min(0).default(0),
  source_id: z.string().uuid(), source_type: z.enum(["sale", "expense", "transfer"]),
});

async function insertLinkedRows(rows: Array<Record<string, unknown>>) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.from("accounts_book_transactions").insert(rows).select();
  if (error) throw new Error(error.message);
  return data ?? [];
}

export const listAccountsBook = createServerFn({ method: "GET" }).handler(async () => {
  await requireUnlocked();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const [{ data: accounts, error: accountError }, { data: transactions, error: transactionError }, { data: services, error: serviceError }] = await Promise.all([
    supabaseAdmin.from("accounts_book_accounts").select("*").eq("is_active", true).order("created_at"),
    supabaseAdmin.from("accounts_book_transactions").select("*").order("entry_date", { ascending: true }).order("created_at", { ascending: true }),
    supabaseAdmin.from("accounts_book_services").select("*").eq("is_active", true).order("name"),
  ]);
  if (accountError) throw new Error(accountError.message);
  if (transactionError) throw new Error(transactionError.message);
  if (serviceError) throw new Error(serviceError.message);
  return { accounts: accounts ?? [], transactions: transactions ?? [], services: services ?? [] };
});

export const createAccountsBookService = createServerFn({ method: "POST" }).validator((data: unknown) => z.object({ name: z.string().trim().min(1) }).parse(data)).handler(async ({ data }) => {
  await requireUnlocked();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: row, error } = await supabaseAdmin.from("accounts_book_services").insert(data).select().single();
  if (error) throw new Error(error.message);
  return row;
});

export const updateAccountsBookService = createServerFn({ method: "POST" }).validator((data: unknown) => z.object({ id: z.string().uuid(), name: z.string().trim().min(1) }).parse(data)).handler(async ({ data }) => {
  await requireUnlocked();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin.from("accounts_book_services").update({ name: data.name }).eq("id", data.id);
  if (error) throw new Error(error.message);
  return { success: true };
});

export const deleteAccountsBookService = createServerFn({ method: "POST" }).validator((id: unknown) => z.string().uuid().parse(id)).handler(async ({ data: id }) => {
  await requireUnlocked();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin.from("accounts_book_services").update({ is_active: false }).eq("id", id);
  if (error) throw new Error(error.message);
  return { success: true };
});

export const createAccountsBookAccount = createServerFn({ method: "POST" }).validator((data: unknown) => accountInput.parse(data)).handler(async ({ data }) => {
  await requireUnlocked();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: row, error } = await supabaseAdmin.from("accounts_book_accounts").insert(data).select().single();
  if (error) throw new Error(error.message);
  return row;
});

export const updateAccountsBookOpening = createServerFn({ method: "POST" }).validator((data: unknown) => z.object({ id: z.string().uuid(), opening_balance: z.number(), opening_balance_date: z.string().optional() }).parse(data)).handler(async ({ data }) => {
  await requireUnlocked();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin.from("accounts_book_accounts").update({ opening_balance: data.opening_balance, ...(data.opening_balance_date ? { opening_balance_date: data.opening_balance_date } : {}) }).eq("id", data.id);
  if (error) throw new Error(error.message);
  return { success: true };
});

export const deleteAccountsBookAccount = createServerFn({ method: "POST" }).validator((id: unknown) => z.string().uuid().parse(id)).handler(async ({ data: id }) => {
  await requireUnlocked();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { count, error: countError } = await supabaseAdmin.from("accounts_book_transactions").select("id", { count: "exact", head: true }).eq("account_id", id);
  if (countError) throw new Error(countError.message);
  if ((count ?? 0) > 0) throw new Error("This account has ledger entries and cannot be deleted. Deactivate it instead.");
  const { error } = await supabaseAdmin.from("accounts_book_accounts").update({ is_active: false }).eq("id", id);
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

export const createAccountsBookLinkedEntry = createServerFn({ method: "POST" }).validator((data: unknown) => linkedEntryInput.parse(data)).handler(async ({ data }) => {
  await requireUnlocked();
  const direction = data.source_type === "expense" ? "out" : "in";
  return insertLinkedRows([{ ...data, entry_type: data.source_type === "sale" ? "sale" : data.source_type === "expense" ? "expense" : "transfer", direction }]);
});

export const createAccountsBookTransfer = createServerFn({ method: "POST" }).validator((data: unknown) => z.object({
  entry_date: z.string(), category: z.string().trim().min(1), description: z.string().trim().min(1), from_account_id: z.string().uuid(), to_account_id: z.string().uuid(), amount: z.number().positive(), source_id: z.string().uuid(),
}).parse(data)).handler(async ({ data }) => {
  await requireUnlocked();
  return insertLinkedRows([
    { account_id: data.from_account_id, entry_date: data.entry_date, entry_type: "transfer", category: data.category, description: data.description, amount: data.amount, direct_cost: 0, direction: "out", source_type: "transfer", source_id: data.source_id },
    { account_id: data.to_account_id, entry_date: data.entry_date, entry_type: "transfer", category: data.category, description: data.description, amount: data.amount, direct_cost: 0, direction: "in", source_type: "transfer", source_id: data.source_id },
  ]);
});

export const deleteAccountsBookLinkedEntry = createServerFn({ method: "POST" }).validator((data: unknown) => z.object({ source_type: z.enum(["sale", "expense", "transfer"]), source_id: z.string().uuid() }).parse(data)).handler(async ({ data }) => {
  await requireUnlocked();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin.from("accounts_book_transactions").delete().eq("source_type", data.source_type).eq("source_id", data.source_id);
  if (error) throw new Error(error.message);
  return { success: true };
});
