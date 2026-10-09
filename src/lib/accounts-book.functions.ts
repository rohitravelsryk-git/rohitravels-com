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

  // The database has a partial unique index on source_key, so ON CONFLICT
  // cannot safely infer the index predicate. Insert each logical projection
  // independently and recover the winner when a concurrent request hits the
  // unique guard. This makes sale/expense/transfer writes idempotent without
  // silently dropping the remaining rows in a multi-row group.
  const resultRows: any[] = [];

  for (const row of normalized) {
    if (row.source_key) {
      const { data: existing, error: lookupError } = await supabaseAdmin
        .from("accounts_book_transactions")
        .select("*")
        .eq("source_key", row.source_key)
        .maybeSingle();
      if (lookupError) throw new Error(lookupError.message);
      if (existing) {
        resultRows.push(existing);
        continue;
      }
    }

    let { data: inserted, error: insertError } = await supabaseAdmin
      .from("accounts_book_transactions")
      .insert(row as unknown as TransactionInsert)
      .select()
      .single();

    if (!insertError && inserted) {
      resultRows.push(inserted);
      continue;
    }

    // Never retry without source_key. The source_key is the database-level idempotency
    // contract for linked sale/expense/transfer projections. Dropping it would allow
    // duplicate ledger rows if a deployment ever drifts from the current schema.
    if (insertError?.code === "23505" && row.source_key) {
      const { data: recovered, error: recoverError } = await supabaseAdmin
        .from("accounts_book_transactions")
        .select("*")
        .eq("source_key", row.source_key)
        .maybeSingle();
      if (recoverError) throw new Error(recoverError.message);
      if (recovered) {
        resultRows.push(recovered);
        continue;
      }
    }

    throw new Error(insertError?.message || "Accounts Book transaction could not be saved.");
  }

  return {
    rows: resultRows,
    sheetSync: { status: "pending", sheets: "", failures: [] as string[] },
  };
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
  let sheetSync: { status: "success" | "failed"; sheets: string; failures: string[] } | undefined;
  if (row && (row.kind === "bank" || row.kind === "wallet")) {
    sheetSync = await triggerLiveAccountsSync();
  }

  return { ...row, ...(sheetSync ? { sheetSync } : {}) };
});

export const updateAccountsBookOpening = createServerFn({ method: "POST" }).validator((data: unknown) => z.object({ id: z.string().uuid(), opening_balance: z.number(), opening_balance_date: z.string().optional() }).parse(data)).handler(async ({ data }) => {
  await requireUnlocked();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin.from("accounts_book_accounts").update({ opening_balance: data.opening_balance, ...(data.opening_balance_date ? { opening_balance_date: data.opening_balance_date } : {}) }).eq("id", data.id);
  if (error) throw new Error(error.message);
  const sheetSync = await triggerLiveAccountsSync();
  return { success: true, sheetSync };
});

export const reorderAccountsBookAccounts = createServerFn({ method: "POST" }).validator((data: unknown) => z.object({ ids: z.array(z.string().uuid()).min(1) }).parse(data)).handler(async ({ data }) => {
  await requireUnlocked();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const results = await Promise.all(
    data.ids.map((id, index) => supabaseAdmin.from("accounts_book_accounts").update({ sort_order: index + 1 }).eq("id", id)),
  );
  const failed = results.find((r) => r.error);
  if (failed?.error) throw new Error(failed.error.message);
  const sheetSync = await triggerLiveAccountsSync();
  return { success: true, sheetSync };
});

export const deleteAccountsBookAccount = createServerFn({ method: "POST" }).validator((data: unknown) => z.object({ id: z.string().uuid(), password: z.string().min(1) }).parse(data)).handler(async ({ data }) => {
  await requireAdminPassword(data.password);
  const id = data.id;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  // Fetch account before deletion so we know its name and kind for Google Sheet tab removal
  const { data: account } = await supabaseAdmin.from("accounts_book_accounts").select("name,kind").eq("id", id).maybeSingle();

  // Check if account has any associated transactions
  const { count, error: countError } = await supabaseAdmin
    .from("accounts_book_transactions")
    .select("id", { count: "exact", head: true })
    .eq("account_id", id);
  if (countError) throw new Error(countError.message);

  if ((count ?? 0) > 0) {
    // Soft-archive to preserve complete ledger history, running balances, and transfer pairs
    const { error } = await supabaseAdmin
      .from("accounts_book_accounts")
      .update({ is_active: false })
      .eq("id", id);
    if (error) throw new Error(error.message);
  } else {
    // Only completely unused accounts can be safely removed
    const { error } = await supabaseAdmin.from("accounts_book_accounts").delete().eq("id", id);
    if (error) throw new Error(error.message);
  }

  // 3. Trigger reconciliation to remove the tab from Google Sheets automatically
  const sheetSync = account && (account.kind === "bank" || account.kind === "wallet")
    ? await triggerLiveAccountsSync()
    : undefined;

  return { success: true, ...(sheetSync ? { sheetSync } : {}) };
});


let liveAccountsSyncTail: Promise<void> = Promise.resolve();

async function triggerLiveAccountsSync(): Promise<{ status: "success" | "failed"; sheets: string; failures: string[] }> {
  const failures: string[] = [];
  const completed: string[] = [];
  liveAccountsSyncTail = liveAccountsSyncTail.then(async () => {
    const mod = await import("@/lib/backup/engine.server");

    // IMPORTANT: Google Sheets has per-user/per-project write quotas. These
    // projections must run sequentially. Running four reconciliations with
    // Promise.allSettled() caused concurrent clear/write requests and 429
    // rate-limit failures, leaving Banks & Wallets stale even though Supabase
    // was correct.
    const syncs: Array<[string, () => Promise<any>]> = [
      [
        "transaction projections",
        () =>
          mod.runSync({
            tables: ["accounts_book_transactions"],
            full: true,
            kind: "accounts-book-transaction-projections-full",
          }),
      ],
      // Specialized reconciliations run AFTER the generic projection pass so their
      // approved human-facing layouts are the final state of the workbook.
      ["Banks & Wallets", () => mod.reconcileBanksWalletsToSheets()],
      ["Daily Cash Book", () => mod.reconcileDailyCashBookToSheets()],
      ["Sales Accounts", () => mod.reconcileSalesAccountsToSheets()],
    ];

    for (const [name, sync] of syncs) {
      try {
        const result = await sync();
        if (result.status !== "success") {
          const detail = Array.isArray(result.failures) && result.failures.length
            ? result.failures.map((item: any) => item.message || String(item)).join("; ")
            : String(result.status || "unknown status");
          failures.push(name + ": " + detail);
          console.warn("[backup] Live accounts sync completed with status:", name, result.status, detail);
        } else {
          completed.push(name);
        }
      } catch (error) {
        // Continue the remaining projections so one transient Sheets failure
        // cannot prevent the other ledgers from being refreshed.
        const message = error instanceof Error ? error.message : String(error);
        failures.push(name + ": " + message);
        console.error("[backup] Live accounts sync failed:", name, error);
      }
    }
  });

  // Do not fire-and-forget: keep the server request alive until the queued
  // sequential reconciliations have completed or recorded their failures.
  await liveAccountsSyncTail;
  return { status: failures.length === 0 ? "success" : "failed", sheets: completed.join(", "), failures };
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
  const sheetSync = await triggerLiveAccountsSync();
  return { ...row, sheetSync };
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
  const sheetSync = await triggerLiveAccountsSync();
  return { success: true, sheetSync };
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
  const sheetSync = await triggerLiveAccountsSync();
  return { ...(row as Record<string, unknown>), sheetSync };
});

export const createAccountsBookLinkedEntry = createServerFn({ method: "POST" }).validator((data: unknown) => linkedEntryInput.parse(data)).handler(async ({ data }) => {
  await requireUnlocked();
  const direction = data.source_type === "expense" ? "out" : "in";
  const result = await insertLinkedRows([{ ...data, entry_type: data.source_type === "sale" ? "sale" : data.source_type === "expense" ? "expense" : "transfer", direction }]);
  const sheetSync = await triggerLiveAccountsSync();
  return { ...result, sheetSync };
});

export const createAccountsBookTransfer = createServerFn({ method: "POST" }).validator((data: unknown) => z.object({
  entry_date: z.string(), category: z.string().trim().min(1), description: z.string().trim().min(1), from_account_id: z.string().uuid(), to_account_id: z.string().uuid(), amount: z.number().positive(), source_id: z.string().uuid(),
}).parse(data)).handler(async ({ data }) => {
  await requireUnlocked();
  const result = await insertLinkedRows([
    { account_id: data.from_account_id, entry_date: data.entry_date, entry_type: "transfer", category: data.category, description: data.description, amount: data.amount, direct_cost: 0, direction: "out", source_type: "transfer", source_id: data.source_id },
    { account_id: data.to_account_id, entry_date: data.entry_date, entry_type: "transfer", category: data.category, description: data.description, amount: data.amount, direct_cost: 0, direction: "in", source_type: "transfer", source_id: data.source_id },
  ]);
  const sheetSync = await triggerLiveAccountsSync();
  return { ...result, sheetSync };
});

export const deleteAccountsBookLinkedEntry = createServerFn({ method: "POST" }).validator((data: unknown) => z.object({ source_type: z.enum(["sale", "expense", "transfer"]), source_id: z.string().uuid() }).parse(data)).handler(async ({ data }) => {
  await requireUnlocked();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin.from("accounts_book_transactions").delete().eq("source_type", data.source_type).eq("source_id", data.source_id);
  if (error) throw new Error(error.message);
  const sheetSync = await triggerLiveAccountsSync();
  return { success: true, sheetSync };
});

export const reconcileDailyCashBookToSheets = createServerFn({ method: "POST" }).validator(() => ({})).handler(async () => {
  await requireUnlocked();
  const engine = await import("@/lib/backup/engine.server");
  return engine.reconcileDailyCashBookToSheets();
});
