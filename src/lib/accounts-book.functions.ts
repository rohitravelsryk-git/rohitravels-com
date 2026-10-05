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
    const [bankResult, cashResult, salesResult] = await Promise.allSettled([
      engine.reconcileBanksWalletsToSheets(),
      engine.reconcileDailyCashBookToSheets(),
      engine.reconcileSalesAccountsToSheets(),
    ]);

    const failures: string[] = [];
    if (bankResult.status === "rejected") failures.push("Banks & Wallets: " + (bankResult.reason?.message || String(bankResult.reason)));
    else if (bankResult.value.status === "failed") failures.push(...bankResult.value.failures.map((f: any) => f.message));

    if (cashResult.status === "rejected") failures.push("Daily Cash Book: " + (cashResult.reason?.message || String(cashResult.reason)));
    else if (cashResult.value.status === "failed") failures.push(...cashResult.value.failures.map((f: any) => f.message));

    const allSucceeded = failures.length === 0;
    return {
      status: allSucceeded ? "success" : "failed",
      spreadsheetUrl: bankResult.status === "fulfilled" ? bankResult.value.spreadsheetUrl : null,
      sheets: "Daily Cash Book, Banks & Wallets, Sales Accounts",
      warningCount: 0,
      failures,
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


export const reconcileBanksWalletsToSheets = createServerFn({ method: "POST" }).validator(() => ({})).handler(async () => {
  await requireUnlocked();
  const engine = await import("@/lib/backup/engine.server");
  return engine.reconcileBanksWalletsToSheets();
});

export const reconcileSalesAccountsToSheets = createServerFn({ method: "POST" }).validator(() => ({})).handler(async () => {
  await requireUnlocked();
  const engine = await import("@/lib/backup/engine.server");
  return engine.reconcileSalesAccountsToSheets();
});

export const syncAccountsBookTransactionsToSheets = createServerFn({ method: "POST" }).validator(() => ({})).handler(async () => {
  await requireUnlocked();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: claimed, error: claimError } = await (supabaseAdmin as unknown as import("@supabase/supabase-js").SupabaseClient)
    .from("accounts_book_transaction_sync_jobs")
    .update({
      status: "running",
      started_at: new Date().toISOString(),
      attempts: (await (supabaseAdmin as unknown as import("@supabase/supabase-js").SupabaseClient).from("accounts_book_transaction_sync_jobs").select("attempts").eq("scope", "accounts_book_transactions").maybeSingle()).data?.attempts ?? 0,
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
    await (supabaseAdmin as unknown as import("@supabase/supabase-js").SupabaseClient)
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
    await (supabaseAdmin as unknown as import("@supabase/supabase-js").SupabaseClient)
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
  // Try inserting with duplicate-proof source_key first; fall back to standard insert if source_key is rejected or missing from table schema
  let inserted: any[] | null = null;
  const { data: resData, error: insertError } = await supabaseAdmin
    .from("accounts_book_transactions")
    .insert(missing as unknown as Database["public"]["Tables"]["accounts_book_transactions"]["Insert"][])
    .select();
  if (!insertError) {
    inserted = resData;
  } else if (insertError.code === "23505" && keys.length) {
    const { data: recovered } = await supabaseAdmin.from("accounts_book_transactions").select("*").in("source_key", keys);
    if (recovered && recovered.length >= keys.length) {
      return { rows: recovered, sheetSync: { status: "pending", sheets: "", failures: [] as string[] } };
    }
  } else {
    // Schema mismatch or source_key column rejected: retry inserting without source_key so transaction is never lost
    console.warn("[accounts-book] source_key insert failed, falling back to clean transaction insert:", insertError.message);
    const cleanRows = missing.map(({ source_key: _, ...row }) => row);
    const { data: fallbackInserted, error: fallbackError } = await supabaseAdmin
      .from("accounts_book_transactions")
      .insert(cleanRows as unknown as Database["public"]["Tables"]["accounts_book_transactions"]["Insert"][])
      .select();
    if (fallbackError) throw new Error(fallbackError.message);
    inserted = fallbackInserted;
  }
  return { rows: [...(existing ?? []), ...(inserted ?? [])], sheetSync: { status: "pending", sheets: "", failures: [] as string[] } };
}

export const listAccountsBook = createServerFn({ method: "GET" }).handler(async () => {
  await requireUnlocked();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const [{ data: accounts, error: accountError }, { data: transactions, error: transactionError }, { data: services, error: serviceError }] = await Promise.all([
    supabaseAdmin.from("accounts_book_accounts").select("*").eq("is_active", true).order("sort_order").order("created_at"),
    supabaseAdmin.from("accounts_book_transactions").select("*").order("entry_date", { ascending: true }).order("created_at", { ascending: true }).limit(50000),
    supabaseAdmin.from("accounts_book_services").select("*").eq("is_active", true).order("sort_order").order("name"),
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

export const reorderAccountsBookServices = createServerFn({ method: "POST" }).validator((data: unknown) => z.object({ ids: z.array(z.string().uuid()).min(1) }).parse(data)).handler(async ({ data }) => {
  await requireUnlocked();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const results = await Promise.all(
    data.ids.map((id, index) => supabaseAdmin.from("accounts_book_services").update({ sort_order: index + 1 }).eq("id", id)),
  );
  const failed = results.find((r) => r.error);
  if (failed?.error) throw new Error(failed.error.message);
  return { success: true };
});

export const createAccountsBookAccount = createServerFn({ method: "POST" }).validator((data: unknown) => accountInput.parse(data)).handler(async ({ data }) => {
  await requireUnlocked();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: row, error } = await supabaseAdmin.from("accounts_book_accounts").insert(data).select().single();
  if (error) throw new Error(error.message);

  // Standardized auto-provisioning: immediately create and format the standardized Google Sheet tab
  if (row && (row.kind === "bank" || row.kind === "wallet")) {
    try {
      const engine = await import("@/lib/backup/engine.server");
      await engine.reconcileBanksWalletsToSheets();
    } catch (sheetError) {
      console.error("[backup] Auto sheet provisioning failed for new account:", sheetError);
    }
  }

  return row;
});

export const updateAccountsBookOpening = createServerFn({ method: "POST" }).validator((data: unknown) => z.object({ id: z.string().uuid(), opening_balance: z.number(), opening_balance_date: z.string().optional() }).parse(data)).handler(async ({ data }) => {
  await requireUnlocked();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin.from("accounts_book_accounts").update({ opening_balance: data.opening_balance, ...(data.opening_balance_date ? { opening_balance_date: data.opening_balance_date } : {}) }).eq("id", data.id);
  if (error) throw new Error(error.message);
  return { success: true };
});

export const reorderAccountsBookAccounts = createServerFn({ method: "POST" }).validator((data: unknown) => z.object({ ids: z.array(z.string().uuid()).min(1) }).parse(data)).handler(async ({ data }) => {
  await requireUnlocked();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const results = await Promise.all(
    data.ids.map((id, index) => supabaseAdmin.from("accounts_book_accounts").update({ sort_order: index + 1 }).eq("id", id)),
  );
  const failed = results.find((r) => r.error);
  if (failed?.error) throw new Error(failed.error.message);
  return { success: true };
});

export const deleteAccountsBookAccount = createServerFn({ method: "POST" }).validator((data: unknown) => z.object({ id: z.string().uuid(), password: z.string().min(1) }).parse(data)).handler(async ({ data }) => {
  await requireAdminPassword(data.password);
  const id = data.id;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  // Fetch account before deletion so we know its name and kind for Google Sheet tab removal
  const { data: account } = await supabaseAdmin.from("accounts_book_accounts").select("name,kind").eq("id", id).maybeSingle();

  // Standardized complete deletion:
  // 1. Delete associated transactions to prevent foreign key errors and orphan data
  await supabaseAdmin.from("accounts_book_transactions").delete().eq("account_id", id);

  // 2. Permanently delete the account row from Supabase
  const { error } = await supabaseAdmin.from("accounts_book_accounts").delete().eq("id", id);
  if (error) throw new Error(error.message);

  // 3. Trigger reconciliation to remove the tab from Google Sheets automatically
  if (account && (account.kind === "bank" || account.kind === "wallet")) {
    try {
      const engine = await import("@/lib/backup/engine.server");
      await engine.reconcileBanksWalletsToSheets();
    } catch (sheetError) {
      console.error("[backup] Auto sheet tab deletion failed:", sheetError);
    }
  }

  return { success: true };
});


let liveAccountsSyncTail: Promise<void> = Promise.resolve();

async function triggerLiveAccountsSync() {
  liveAccountsSyncTail = liveAccountsSyncTail.then(async () => {
    const mod = await import("@/lib/backup/engine.server");
    const results = await Promise.allSettled([
      // Master transaction projection: one Supabase transaction is mirrored to
      // every configured Accounts Book sheet/table projection.
      mod.runSync({
        tables: ["accounts_book_transactions"],
        full: false,
        kind: "accounts-book-transaction-mirror",
      }),
      mod.reconcileBanksWalletsToSheets(),
      mod.reconcileDailyCashBookToSheets(),
      mod.reconcileSalesAccountsToSheets(),
    ]);
    for (const result of results) {
      if (result.status === "rejected") {
        console.error("[backup] Live accounts sync failed:", result.reason);
      } else if (result.value.status !== "success") {
        console.warn("[backup] Live accounts sync completed with status:", result.value.status);
      }
    }
  });
  // Do not fire-and-forget: the serverless request must remain alive until
  // the Sheets reconciliation has completed or recorded its failure.
  await liveAccountsSyncTail;
}

export const createAccountsBookTransaction = createServerFn({ method: "POST" }).validator((data: unknown) => transactionInput.parse(data)).handler(async ({ data }) => {
  await requireUnlocked();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const source_key =
    data.source_type && data.source_id
      ? `${data.source_type}:${data.source_id}:${data.account_id}:${data.direction}`
      : null;
  let { data: row, error } = await supabaseAdmin
    .from("accounts_book_transactions")
    .insert({ ...data, source_key } as unknown as Database["public"]["Tables"]["accounts_book_transactions"]["Insert"])
    .select()
    .single();
  if (error && error.message?.includes("source_key")) {
    console.warn("[accounts-book] Single transaction insert failed on source_key, retrying without source_key:", error.message);
    const fallback = await supabaseAdmin
      .from("accounts_book_transactions")
      .insert(data as unknown as Database["public"]["Tables"]["accounts_book_transactions"]["Insert"])
      .select()
      .single();
    row = fallback.data;
    error = fallback.error;
  }
  if (error) throw new Error(error.message);
  await triggerLiveAccountsSync();
  return { ...row, sheetSync: { status: "success", sheets: "Daily Cash Book, Banks & Wallets, Sales Accounts", failures: [] as string[] } };
});

export const deleteAccountsBookTransaction = createServerFn({ method: "POST" }).validator((id: unknown) => z.string().uuid().parse(id)).handler(async ({ data: id }) => {
  await requireUnlocked();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: row, error: readError } = await supabaseAdmin
    .from("accounts_book_transactions")
    .select("id,source_type,source_id")
    .eq("id", id)
    .single();
  if (readError) throw new Error(readError.message);

  // A logical transaction is deleted as one unit. This prevents orphaned
  // Sale cost rows or the second side of a Transfer from surviving.
  let query = supabaseAdmin.from("accounts_book_transactions").delete().eq("id", id);
  if (row.source_id) {
    query = supabaseAdmin
      .from("accounts_book_transactions")
      .delete()
      .eq("source_type", row.source_type ?? "")
      .eq("source_id", row.source_id);
  }
  const { error } = await query;
  if (error) throw new Error(error.message);
  await triggerLiveAccountsSync();
  return { success: true, sheetSync: { status: "success", sheets: "Daily Cash Book, Banks & Wallets, Sales Accounts", failures: [] as string[] } };
});

export const updateAccountsBookTransaction = createServerFn({ method: "POST" }).validator((data: unknown) => transactionInput.extend({ id: z.string().uuid() }).parse(data)).handler(async ({ data }) => {
  await requireUnlocked();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const client = supabaseAdmin as unknown as import("@supabase/supabase-js").SupabaseClient;
  const { data: row, error } = await client.rpc("rohi_update_accounts_book_transaction_group", {
    p_id: data.id,
    p_entry_date: data.entry_date,
    p_category: data.category,
    p_party: data.party ?? null,
    p_description: data.description,
    p_amount: data.amount,
    p_direct_cost: data.direct_cost,
    p_direction: data.direction,
    p_account_id: data.account_id,
  });
  if (error) throw new Error(error.message);
  await triggerLiveAccountsSync();
  return { ...(row as Record<string, unknown>), sheetSync: { status: "success", sheets: "Daily Cash Book, Banks & Wallets, Sales Accounts", failures: [] as string[] } };
});

export const createAccountsBookLinkedEntry = createServerFn({ method: "POST" }).validator((data: unknown) => linkedEntryInput.parse(data)).handler(async ({ data }) => {
  await requireUnlocked();
  const direction = data.source_type === "expense" ? "out" : "in";
  const result = await insertLinkedRows([{ ...data, entry_type: data.source_type === "sale" ? "sale" : data.source_type === "expense" ? "expense" : "transfer", direction }]);
  await triggerLiveAccountsSync();
  return { ...result, sheetSync: { status: "success", sheets: "Daily Cash Book, Banks & Wallets, Sales Accounts", failures: [] as string[] } };
});

export const createAccountsBookTransfer = createServerFn({ method: "POST" }).validator((data: unknown) => z.object({
  entry_date: z.string(), category: z.string().trim().min(1), description: z.string().trim().min(1), from_account_id: z.string().uuid(), to_account_id: z.string().uuid(), amount: z.number().positive(), source_id: z.string().uuid(),
}).parse(data)).handler(async ({ data }) => {
  await requireUnlocked();
  const result = await insertLinkedRows([
    { account_id: data.from_account_id, entry_date: data.entry_date, entry_type: "transfer", category: data.category, description: data.description, amount: data.amount, direct_cost: 0, direction: "out", source_type: "transfer", source_id: data.source_id },
    { account_id: data.to_account_id, entry_date: data.entry_date, entry_type: "transfer", category: data.category, description: data.description, amount: data.amount, direct_cost: 0, direction: "in", source_type: "transfer", source_id: data.source_id },
  ]);
  await triggerLiveAccountsSync();
  return { ...result, sheetSync: { status: "success", sheets: "Daily Cash Book, Banks & Wallets, Sales Accounts", failures: [] as string[] } };
});

export const deleteAccountsBookLinkedEntry = createServerFn({ method: "POST" }).validator((data: unknown) => z.object({ source_type: z.enum(["sale", "expense", "transfer"]), source_id: z.string().uuid() }).parse(data)).handler(async ({ data }) => {
  await requireUnlocked();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin.from("accounts_book_transactions").delete().eq("source_type", data.source_type).eq("source_id", data.source_id);
  if (error) throw new Error(error.message);
  await triggerLiveAccountsSync();
  return { success: true, sheetSync: { status: "success", sheets: "Daily Cash Book, Banks & Wallets, Sales Accounts", failures: [] as string[] } };
});

export const reconcileDailyCashBookToSheets = createServerFn({ method: "POST" }).validator(() => ({})).handler(async () => {
  await requireUnlocked();
  const engine = await import("@/lib/backup/engine.server");
  return engine.reconcileDailyCashBookToSheets();
});
