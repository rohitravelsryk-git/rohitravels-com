import { createServerFn } from "@tanstack/react-start";
import { useSession } from "@tanstack/react-start/server";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";
import { verifyPassword } from "@/lib/password-hash.server";

// source_key was added after the generated types were last refreshed, so add it back explicitly.
type TransactionInsert = Omit<Database["public"]["Tables"]["accounts_book_transactions"]["Insert"], "source_key"> & { source_key?: string | null };

type GateSession = { unlocked?: boolean; staffUsername?: string | null };

function sessionConfig() {
  const password = typeof process !== "undefined" ? (process.env.ROHI_SESSION_SECRET || process.env.SESSION_SECRET) : undefined;
  if (!password) throw new Error("ROHI_SESSION_SECRET is not configured");
  return { password, name: "rohi-admin", maxAge: 60 * 60 * 8, cookie: { httpOnly: true, secure: true, sameSite: "lax" as const, path: "/" } };
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


async function requireAdminPassword(password: string) {
  await requireUnlocked();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: creds, error } = await supabaseAdmin
    .from("admin_credentials")
    .select("password_hash")
    .eq("id", true)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (creds?.password_hash) {
    const result = await verifyPassword(password, creds.password_hash);
    if (result.ok) return;
  } else {
    const envPassword = typeof process !== "undefined" ? process.env.SITE_PASSWORD : undefined;
    if (envPassword) {
      const { createHash, timingSafeEqual } = await import("node:crypto");
      const a = createHash("sha256").update(password, "utf8").digest();
      const b = createHash("sha256").update(envPassword, "utf8").digest();
      if (timingSafeEqual(a, b)) return;
    }
  }
  throw new Error("Incorrect admin password.");
}

const linkedEntryInput = z.object({
  entry_date: z.string(), category: z.string().trim().min(1), party: z.string().optional(), description: z.string().trim().min(1),
  account_id: z.string().uuid(), amount: z.number().positive(), direct_cost: z.number().min(0).default(0),
  source_id: z.string().uuid(), source_type: z.enum(["sale", "expense", "transfer"]),
});

async function runAccountsBookSheetSync() {
  try {
    const engine = await import("@/lib/backup/engine.server");
    const result = await engine.runSync({
      full: false,
      tables: ["accounts_book_transactions"],
      kind: "accounts-book-transaction",
    });
    const outcome = result.outcomes.find((item) => item.table === "accounts_book_transactions");
    const failures = result.failures.map((failure) => failure.message);
    const warnings = outcome?.errors.map((error) => error.message) ?? [];
    return {
      status: result.status === "success" && warnings.length === 0 ? "success" : "failed",
      spreadsheetUrl: result.spreadsheetUrl,
      sheets: outcome?.sheet ?? "",
      warningCount: result.warningCount,
      failures: [...failures, ...warnings],
    };
  } catch (error) {
    return {
      status: "failed",
      spreadsheetUrl: null,
      sheets: "",
      warningCount: 0,
      failures: [error instanceof Error ? error.message : String(error)],
    };
  }
}


export const syncAccountsBookTransactionsToSheets = createServerFn({ method: "POST" }).handler(async () => {
  await requireUnlocked();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: claimed, error: claimError } = await supabaseAdmin
    .from("accounts_book_transaction_sync_jobs")
    .update({
      status: "running",
      started_at: new Date().toISOString(),
      attempts: (await supabaseAdmin.from("accounts_book_transaction_sync_jobs").select("attempts").eq("scope", "accounts_book_transactions").maybeSingle()).data?.attempts ?? 0,
      last_error: null,
    })
    .eq("scope", "accounts_book_transactions")
    .in("status", ["pending", "failed"])
    .select("scope")
    .maybeSingle();
  if (claimError) throw new Error(claimError.message);

  try {
    const result = await runAccountsBookSheetSync();
    const outcome = result.status === "success";
    await supabaseAdmin
      .from("accounts_book_transaction_sync_jobs")
      .update({
        status: outcome ? "synced" : "failed",
        completed_at: new Date().toISOString(),
        last_error: outcome ? null : result.failures.join("\n"),
      })
      .eq("scope", "accounts_book_transactions");
    return {
      ...result,
      status: outcome ? "success" : "failed",
      queued: Boolean(claimed),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await supabaseAdmin
      .from("accounts_book_transaction_sync_jobs")
      .update({ status: "failed", completed_at: new Date().toISOString(), last_error: message })
      .eq("scope", "accounts_book_transactions");
    return { status: "failed", spreadsheetUrl: null, sheets: "", warningCount: 0, failures: [message], queued: Boolean(claimed) };
  }
});


async function insertLinkedRows(rows: TransactionInsert[]) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const normalized = rows.map((row) => ({
    ...row,
    source_key:
      row.source_type && row.source_id && row.account_id && row.direction
        ? row.source_type + ":" + row.source_id + ":" + row.account_id + ":" + row.direction
        : null,
  }));
  const keys = normalized.map((row) => row.source_key).filter((key): key is string => typeof key === "string" && key.length > 0);
  const { data: existing, error: existingError } = keys.length
    ? await supabaseAdmin.from("accounts_book_transactions").select("*").in("source_key", keys)
    : { data: [], error: null };
  if (existingError) throw new Error(existingError.message);
  const existingKeys = new Set(((existing ?? []) as Array<{ source_key?: string | null }>)
    .map((row) => row.source_key).filter((key): key is string => Boolean(key)));
  const missing = normalized.filter((row) => typeof row.source_key !== "string" || !existingKeys.has(row.source_key));
  if (!missing.length) {
    return { rows: existing ?? [], sheetSync: { status: "pending", sheets: "", failures: [] as string[] } };
  }
  // source_key exists in the table but not yet in the generated Insert type; cast through unknown.
  const { data: inserted, error: insertError } = await supabaseAdmin
    .from("accounts_book_transactions")
    .insert(missing as unknown as Database["public"]["Tables"]["accounts_book_transactions"]["Insert"][])
    .select();
  if (!insertError) {
    return { rows: [...(existing ?? []), ...(inserted ?? [])], sheetSync: { status: "pending", sheets: "", failures: [] as string[] } };
  }
  if (insertError.code === "23505" && keys.length) {
    const { data: recovered, error: recoveryError } = await supabaseAdmin.from("accounts_book_transactions").select("*").in("source_key", keys);
    if (!recoveryError && (recovered?.length ?? 0) >= keys.length) {
      return { rows: recovered ?? [], sheetSync: { status: "pending", sheets: "", failures: [] as string[] } };
    }
  }
  throw new Error(insertError.message);
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

export const deleteAccountsBookService = createServerFn({ method: "POST" }).validator((data: unknown) => z.object({ id: z.string().uuid(), password: z.string().min(1) }).parse(data)).handler(async ({ data }) => {
  await requireAdminPassword(data.password);
  const id = data.id;
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

export const deleteAccountsBookAccount = createServerFn({ method: "POST" }).validator((data: unknown) => z.object({ id: z.string().uuid(), password: z.string().min(1) }).parse(data)).handler(async ({ data }) => {
  await requireAdminPassword(data.password);
  const id = data.id;
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
  const source_key =
    data.source_type && data.source_id
      ? `${data.source_type}:${data.source_id}:${data.account_id}:${data.direction}`
      : null;
  const { data: row, error } = await supabaseAdmin
    .from("accounts_book_transactions")
    .insert({ ...data, source_key } as unknown as Database["public"]["Tables"]["accounts_book_transactions"]["Insert"])
    .select()
    .single();
  if (error) throw new Error(error.message);
  return { ...row, sheetSync: { status: "pending", sheets: "", failures: [] as string[] } };
});

export const deleteAccountsBookTransaction = createServerFn({ method: "POST" }).validator((id: unknown) => z.string().uuid().parse(id)).handler(async ({ data: id }) => {
  await requireUnlocked();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin.from("accounts_book_transactions").delete().eq("id", id);
  if (error) throw new Error(error.message);
  return { success: true, sheetSync: { status: "pending", sheets: "", failures: [] as string[] } };
});

export const updateAccountsBookTransaction = createServerFn({ method: "POST" }).validator((data: unknown) => transactionInput.extend({ id: z.string().uuid() }).parse(data)).handler(async ({ data }) => {
  await requireUnlocked();
  const { id, ...changes } = data;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const source_key =
    changes.source_type && changes.source_id && changes.account_id && changes.direction
      ? `${changes.source_type}:${changes.source_id}:${changes.account_id}:${changes.direction}`
      : null;
  const { data: row, error } = await (supabaseAdmin as unknown as import("@supabase/supabase-js").SupabaseClient)
    .from("accounts_book_transactions")
    .update({ ...changes, source_key })
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  const sheetSync = await syncAccountsBookTransactionsToSheets();
  return { ...row, sheetSync };
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
  const sheetSync = await syncAccountsBookTransactionsToSheets();
  return { success: true, sheetSync };
});
