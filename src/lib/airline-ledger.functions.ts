import { createServerFn } from "@tanstack/react-start";
import { useSession } from "@tanstack/react-start/server";
import { z } from "zod";

type GateSession = { unlocked?: boolean; staffUsername?: string | null };

function sessionConfig() {
  const password = typeof process !== "undefined" ? (process.env.ROHI_SESSION_SECRET || process.env.SESSION_SECRET) : undefined;
  if (!password) throw new Error("ROHI_SESSION_SECRET is not configured");
  return {
    password,
    name: "rohi-admin",
    maxAge: 60 * 60 * 8,
    cookie: { httpOnly: true, secure: true, sameSite: "lax" as const, path: "/" },
  };
}

async function requireUnlocked() {
  try {
    const s = await useSession<GateSession>(sessionConfig());
    if (!s.data.unlocked) throw new Error("Unauthorized");
    return s;
  } catch (e) {
    throw e;
  }
}

export type AirlineLedgerAirline = {
  id: string;
  name: string;
  code: string;
  openingBalance: number;
  openingBalanceDate: string;
  currency?: string;
  roe?: number;
  openingBalanceForeign?: number | null;
};
export type AirlineLedgerRow = {
  id: string;
  date?: string;
  transactionType?: string;
  agentName?: string;
  paxName?: string;
  sector?: string;
  pnr?: string;
  ticketSales?: number | string;
  debitInId?: string;
  creditFromId?: number | string;
  paxContact?: string;
  voidCharges?: number | string;
  currency?: string | null;
  roe?: number | string | null;
  foreignAmount?: number | string | null;
  receivedVia?: string | null;
  receivedViaAccountId?: string | null;
  agentReceived?: number | string | null;
};
export type AirlineLedgerData = {
  airlines: AirlineLedgerAirline[];
  agents: string[];
  transactions: Record<string, AirlineLedgerRow[]>;
  revision: number;
};

const rowSchema = z.object({
  id: z.string(),
  date: z.string().nullish(),
  transactionType: z.string().nullish(),
  agentName: z.string().nullish(),
  paxName: z.string().nullish(),
  sector: z.string().nullish(),
  pnr: z.string().nullish(),
  ticketSales: z.union([z.number(), z.string()]).nullish(),
  debitInId: z.string().nullish(),
  creditFromId: z.union([z.number(), z.string()]).nullish(),
  paxContact: z.string().nullish(),
  voidCharges: z.union([z.number(), z.string()]).nullish(),
  currency: z.string().nullish(),
  roe: z.union([z.number(), z.string()]).nullish(),
  foreignAmount: z.union([z.number(), z.string()]).nullish(),
  receivedVia: z.string().nullish(),
  receivedViaAccountId: z.string().nullish(),
  agentReceived: z.union([z.number(), z.string()]).nullish(),
});

const dataSchema = z.object({
  airlines: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      code: z.string(),
      openingBalance: z.union([z.number(), z.string()]).nullish(),
      openingBalanceDate: z.string().nullish(),
      currency: z.string().nullish(),
      roe: z.union([z.number(), z.string()]).nullish(),
      openingBalanceForeign: z.union([z.number(), z.string()]).nullish(),
    }),
  ),
  agents: z.array(z.string()),
  transactions: z.record(z.string(), z.array(rowSchema)),
});

const num = (v: unknown) => {
  if (v === "" || v === null || v === undefined) return null;
  const cleaned = typeof v === "string" ? v.replace(/,/g, "").trim() : v;
  const n = Number(cleaned);
  return Number.isNaN(n) ? null : n;
};
const str = (v: unknown) => (v === null || v === undefined || v === "" ? null : String(v));

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    promise.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); },
    );
  });
}

export const getAirlineLedgerData = createServerFn({ method: "GET" }).handler(async (): Promise<AirlineLedgerData> => {
  await requireUnlocked();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  // The four tables are read separately, so a save committing mid-read could
  // return a torn snapshot (old rows stamped with the new revision). Read the
  // revision before AND after the tables and retry until both match, so the
  // data returned always belongs to exactly one committed revision.
  let airlinesRes!: any;
  let agentsRes!: any;
  let txRes!: any;
  let revisionRes!: any;
  for (let attempt = 0; attempt < 4; attempt++) {
    const before: any = await supabaseAdmin.from("airline_ledger_meta").select("revision").eq("id", 1).maybeSingle();
    [airlinesRes, agentsRes, txRes, revisionRes] = await Promise.all([
      supabaseAdmin.from("airline_ledger_airlines").select("*").order("sort_order", { ascending: true }),
      supabaseAdmin.from("airline_ledger_agents").select("*").order("sort_order", { ascending: true }),
      supabaseAdmin.from("airline_ledger_transactions").select("*").order("date", { ascending: true }).order("sort_order", { ascending: true }),
      supabaseAdmin.from("airline_ledger_meta").select("revision").eq("id", 1).maybeSingle(),
    ]);
    if (before.error || revisionRes.error) break; // surfaced by the error check below
    if (Number(before.data?.revision ?? 1) === Number(revisionRes.data?.revision ?? 1)) break;
    if (attempt === 3) throw new Error("Airline ledger load failed: the ledger kept changing during the read. Please retry.");
  }

  for (const result of [airlinesRes, agentsRes, txRes, revisionRes]) {
    if (result.error) throw new Error(`Airline ledger load failed: ${result.error.message}`);
  }

  const airlines = (airlinesRes.data ?? []).map((a: any) => {
    const rawCode = a.code || "--";
    const name = a.name || "";
    const isG9 = rawCode === "G9" || /air\s*arabia/i.test(name);
    const code = (isG9 && (rawCode === "--" || !rawCode)) ? "G9" : rawCode;
    const isXY = code === "XY" || /flynas/i.test(name);
    const isF3 = code === "F3" || /flyadeal/i.test(name);

    // Carrier foreign currency defaults apply only when an account has not been explicitly configured
    const isCarrierForeign = isG9 || isXY || isF3;
    const defaultCurrency = isG9 ? "AED" : isXY ? "SAR" : isF3 ? "USD" : "PKR";
    const defaultRoe = isG9 ? 77.30 : isXY ? 75.50 : isF3 ? 284.00 : 1.0;

    const rawCurr = (a.currency && String(a.currency).trim()) || "";
    const rawRoe = Number(a.roe);
    const hasOpeningForeign = a.opening_balance_foreign !== null && a.opening_balance_foreign !== undefined;
    const openingForeignVal = hasOpeningForeign ? Number(a.opening_balance_foreign) : null;

    let currency = "PKR";
    let roe = 1;
    let isForeign = false;

    if (rawCurr && rawCurr !== "PKR") {
      currency = rawCurr;
      roe = rawRoe > 0 ? rawRoe : defaultRoe;
      isForeign = true;
    } else if (rawCurr === "PKR" && (!isCarrierForeign || openingForeignVal === 0 || rawRoe === 1)) {
      currency = "PKR";
      roe = 1;
      isForeign = false;
    } else if (isCarrierForeign) {
      currency = defaultCurrency;
      roe = rawRoe > 1 ? rawRoe : defaultRoe;
      isForeign = true;
    }

    const openingBalance = Number(a.opening_balance) || 0;
    const openingBalanceForeign = isForeign
      ? (openingForeignVal !== null && openingForeignVal !== 0 ? openingForeignVal : (openingBalance ? openingBalance / roe : (isG9 ? 215.77 : isXY ? 3775.52 : isF3 ? 120.67 : 0)))
      : (openingForeignVal === 0 ? 0 : null);

    return {
      id: a.id,
      name: a.name,
      code,
      openingBalance,
      openingBalanceDate: a.opening_balance_date ?? new Date().toISOString().slice(0, 10),
      currency,
      roe,
      openingBalanceForeign,
    };
  });
  const agents = (agentsRes.data ?? []).map((a: any) => a.name as string);
  const transactions: Record<string, AirlineLedgerRow[]> = {};
  for (const t of (txRes.data ?? []) as any[]) {
    const list = transactions[t.airline_id] ?? (transactions[t.airline_id] = []);
    const rawType = (t.transaction_type ?? "").trim();
    const sector = (t.sector ?? "").trim();
    const pax = (t.pax_name ?? "").trim();
    let resolvedType = rawType || "Add Transaction";
    if (rawType.toLowerCase() === "top up" || /top\s*up/i.test(sector) || /top\s*up/i.test(pax)) {
      resolvedType = "Top Up";
    } else if (
      ["cancel/refund", "refund"].includes(rawType.toLowerCase()) ||
      /refund|cancel/i.test(rawType) ||
      /refund|cancel/i.test(sector) ||
      /refund|cancel/i.test(pax)
    ) {
      resolvedType = "Cancel/Refund";
    }

    list.push({
      id: t.id,
      date: t.date ?? "",
      transactionType: resolvedType,
      agentName: t.agent_name ?? "",
      paxName: t.pax_name ?? "",
      sector: t.sector ?? "",
      pnr: t.pnr ?? "",
      ticketSales: t.ticket_sales !== null && t.ticket_sales !== undefined ? t.ticket_sales : "",
      debitInId: t.debit_in_id ? String(t.debit_in_id).replace(/,/g, "").trim() : "",
      creditFromId: t.credit_from_id !== null && t.credit_from_id !== undefined ? t.credit_from_id : "",
      paxContact: t.pax_contact ?? "",
      voidCharges: t.void_charges !== null && t.void_charges !== undefined ? t.void_charges : "",
      currency: t.currency ?? null,
      roe: t.roe ?? null,
      foreignAmount: t.foreign_amount ?? null,
      receivedVia: t.received_via ?? null,
      receivedViaAccountId: t.received_via_account_id ?? null,
      agentReceived: t.agent_received !== null && t.agent_received !== undefined ? t.agent_received : "",
    });
  }

  return {
    airlines,
    agents,
    transactions,
    revision: Number(revisionRes.data?.revision ?? 1),
  };
});

export const saveAirlineLedgerData = createServerFn({ method: "POST" })
  .validator((data: unknown) => z.object({
    expectedRevision: z.number().int().nonnegative(),
    data: dataSchema,
  }).parse(data))
  .handler(async ({ data }) => {
    await requireUnlocked();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const normalized = {
      airlines: data.data.airlines.map((a, i) => {
        const isG9 = a.code === "G9" || /air\s*arabia/i.test(a.name);
        const code = (isG9 && (!a.code || a.code === "--")) ? "G9" : (a.code || "--");
        return {
          id: a.id,
          name: a.name,
          code,
          opening_balance: num(a.openingBalance) ?? 0,
          opening_balance_date: str(a.openingBalanceDate) ?? new Date().toISOString().slice(0, 10),
          sort_order: i,
          currency: str(a.currency) || "PKR",
          roe: num(a.roe) ?? 1,
          opening_balance_foreign: num(a.openingBalanceForeign),
        };
      }),
      agents: data.data.agents.map((name, i) => ({ name, sort_order: i })),
      transactions: Object.entries(data.data.transactions).flatMap(([airlineId, rows]) =>
        rows.map((r, i) => ({
          id: r.id,
          airline_id: airlineId,
          date: str(r.date),
          transaction_type: (() => {
            const rawType = str(r.transactionType) || "Add Transaction";
            const sector = str(r.sector) || "";
            const pax = str(r.paxName) || "";
            if (rawType.toLowerCase() === "top up" || /top\s*up/i.test(sector) || /top\s*up/i.test(pax)) return "Top Up";
            if (["cancel/refund", "refund"].includes(rawType.toLowerCase()) || /refund|cancel/i.test(rawType) || /refund|cancel/i.test(sector) || /refund|cancel/i.test(pax)) return "Cancel/Refund";
            return rawType;
          })(),
          agent_name: str(r.agentName),
          pax_name: str(r.paxName),
          sector: str(r.sector),
          pnr: str(r.pnr),
          ticket_sales: num(r.ticketSales),
          debit_in_id: str(r.debitInId) ? String(r.debitInId).replace(/,/g, "").trim() : null,
          credit_from_id: num(r.creditFromId),
          pax_contact: str(r.paxContact),
          void_charges: num(r.voidCharges),
          sort_order: i,
          currency: str(r.currency),
          roe: num(r.roe),
          foreign_amount: num(r.foreignAmount),
          received_via: str(r.receivedVia),
          received_via_account_id: str(r.receivedViaAccountId),
          agent_received: num(r.agentReceived),
        })),
      ),
    };

    const { data: revision, error } = await supabaseAdmin.rpc("save_airline_ledger", {
      p_data: normalized,
      p_expected_revision: data.expectedRevision,
    });

    let savedRevision = Number(revision);

    if (error) {
      if (error.message.includes("AIRLINE_LEDGER_CONFLICT")) {
        throw new Error("AIRLINE_LEDGER_CONFLICT: This ledger changed in another tab/session. Nothing was overwritten.");
      }

      // A network/server response can be lost after the database transaction
      // has already committed. Before declaring the save failed, re-read the
      // authoritative ledger and check whether it already exactly matches the
      // snapshot the user submitted. This prevents a successful financial save
      // from being reported as a failure merely because the response was lost.
      const [checkAirlines, checkAgents, checkTransactions, checkMeta] = await Promise.all([
        supabaseAdmin.from("airline_ledger_airlines").select("*").order("sort_order", { ascending: true }),
        supabaseAdmin.from("airline_ledger_agents").select("name,sort_order").order("sort_order", { ascending: true }),
        supabaseAdmin.from("airline_ledger_transactions").select("*").order("date", { ascending: true }).order("sort_order", { ascending: true }),
        supabaseAdmin.from("airline_ledger_meta").select("revision").eq("id", 1).maybeSingle(),
      ]);

      const currentSnapshot = {
        airlines: (checkAirlines.data ?? []).map((a: any) => ({
          id: a.id,
          name: a.name,
          code: a.code || "--",
          opening_balance: Number(a.opening_balance) || 0,
          opening_balance_date: a.opening_balance_date,
          sort_order: Number(a.sort_order) || 0,
          currency: a.currency || "PKR",
          roe: Number(a.roe) || 1,
          opening_balance_foreign: a.opening_balance_foreign !== null ? Number(a.opening_balance_foreign) : null,
        })),
        agents: (checkAgents.data ?? []).map((a: any) => ({
          name: a.name,
          sort_order: Number(a.sort_order) || 0,
        })),
        transactions: (checkTransactions.data ?? []).map((t: any) => ({
          id: t.id,
          airline_id: t.airline_id,
          date: t.date,
          agent_name: t.agent_name,
          pax_name: t.pax_name,
          sector: t.sector,
          pnr: t.pnr,
          ticket_sales: t.ticket_sales,
          debit_in_id: t.debit_in_id,
          credit_from_id: t.credit_from_id,
          pax_contact: t.pax_contact,
          void_charges: t.void_charges,
          sort_order: Number(t.sort_order) || 0,
          agent_received: t.agent_received !== null && t.agent_received !== undefined ? t.agent_received : null,
        })),
      };

      const submittedFingerprint = JSON.stringify(normalized);
      const currentFingerprint = JSON.stringify(currentSnapshot);
      const currentRevision = Number(checkMeta.data?.revision ?? 0);

      if (!checkAirlines.error && !checkAgents.error && !checkTransactions.error && submittedFingerprint === currentFingerprint) {
        savedRevision = currentRevision || data.expectedRevision;
        console.warn("Airline ledger save response was lost after commit; confirmed by re-reading the committed snapshot.");
      } else {
        throw new Error(`Airline ledger save failed: ${error.message}`);
      }
    }

    // Re-read the committed database snapshot once. The database is the source
    // of truth; every backup/mirror below uses this exact post-commit snapshot.
    const [airlinesRes, agentsRes, txRes] = await Promise.all([
      supabaseAdmin.from("airline_ledger_airlines").select("*").order("sort_order", { ascending: true }),
      supabaseAdmin.from("airline_ledger_agents").select("name,sort_order").order("sort_order", { ascending: true }),
      supabaseAdmin.from("airline_ledger_transactions").select("*").order("date", { ascending: true }).order("sort_order", { ascending: true }),
    ]);
    if (airlinesRes.error || agentsRes.error || txRes.error) {
      const message =
        "Airline ledger saved at revision " + savedRevision + ", but the committed snapshot could not be reloaded: " +
        (airlinesRes.error?.message || agentsRes.error?.message || txRes.error?.message);
      console.error(message);
      await (supabaseAdmin as unknown as import("@supabase/supabase-js").SupabaseClient).from("airline_ledger_google_sync").upsert({
        id: 1,
        status: "error",
        error_message: message.slice(0, 1000),
      });
      return { success: true, revision: savedRevision, persisted: true, syncPending: true };
    }

    const committedSnapshot = {
      airlines: airlinesRes.data ?? [],
      agents: agentsRes.data ?? [],
      transactions: txRes.data ?? [],
    };

    // Agent ledger and Accounts Book postings (agent sales, ticket receipts,
    // counter sales) run in the awaited Promise.allSettled below — a detached
    // background promise can be killed by the serverless runtime before it
    // finishes, silently skipping those ledgers.

    // Downstream mirrors (Agent ledgers, Accounts Book receipts, Financial
    // backup, Airline Google Sheet) complete BEFORE the response returns,
    // using the same pattern as Accounts Book's triggerLiveAccountsSync. A
    // detached background promise can be killed by the serverless runtime as
    // soon as the response is sent, which silently skipped the Google Sheet
    // write and left the workbook stale. Awaiting guarantees the mirror runs;
    // individual timeouts keep the wait bounded.
    let sheetSynced = true;
    let sheetSyncError: string | null = null;
    await Promise.allSettled([
      (async () => {
        try {
          const { syncAirlineTransactionsToAgentLedgers } = await import("@/lib/ledger-admin.functions");
          await withTimeout(syncAirlineTransactionsToAgentLedgers(committedSnapshot.transactions, committedSnapshot.airlines), 20000, "Agent ledger sync");
        } catch (agentSyncErr) {
          console.warn("[airline-ledger] Error syncing airline agent sales to agent ledgers:", agentSyncErr);
        }
      })(),
      (async () => {
        try {
          const { syncAirlineTransactionsToAccountsBook } = await import("@/lib/airline-ledger-accounts-sync.server");
          await withTimeout(syncAirlineTransactionsToAccountsBook(committedSnapshot.transactions, committedSnapshot.airlines), 30000, "Accounts Book receipt sync");
        } catch (accountSyncErr) {
          console.warn("[airline-ledger] Error syncing ticket receipts to Accounts Book:", accountSyncErr);
        }
      })(),
      (async () => {
        try {
          const { syncAirlineCounterSalesToSalesAccounts } = await import("@/lib/airline-ledger-counter-sales.server");
          await withTimeout(syncAirlineCounterSalesToSalesAccounts(committedSnapshot.transactions, committedSnapshot.airlines), 30000, "Counter sales sync");
        } catch (counterSalesErr) {
          console.warn("[airline-ledger] Error syncing counter sales to Sales Accounts:", counterSalesErr);
        }
      })(),
      (async () => {
        try {
          const { syncRohiFinancialBackup } = await import("@/lib/financial-google-backup");
          const [accounts, accountTransactions, services] = await Promise.all([
            supabaseAdmin.from("accounts_book_accounts").select("*").order("created_at"),
            supabaseAdmin.from("accounts_book_transactions").select("*").order("entry_date").order("created_at"),
            supabaseAdmin.from("accounts_book_services").select("*").order("name"),
          ]);
          if (!accounts.error && !accountTransactions.error && !services.error) {
            const result = await withTimeout(syncRohiFinancialBackup({
              airlines: committedSnapshot.airlines,
              airlineTransactions: committedSnapshot.transactions,
              accounts: accounts.data ?? [],
              accountTransactions: accountTransactions.data ?? [],
              services: services.data ?? [],
            }, savedRevision), 15000, "Financial Google backup");
            if (result.synced) {
              await (supabaseAdmin as unknown as import("@supabase/supabase-js").SupabaseClient).from("rohi_financial_backup_sync").upsert({
                id: 1,
                last_source_revision: result.revision,
                last_synced_at: result.syncedAt,
                status: "synced",
                error_message: null,
                sheet_id: process.env.ROHI_FINANCIAL_BACKUP_SHEET_ID ?? null,
                updated_at: new Date().toISOString(),
              });
            }
          }
        } catch (backupErr) {
          console.error("Async financial Google backup failed:", backupErr);
        }
      })(),
      (async () => {
        try {
          const { syncAirlineLedgerGoogleSheetNow } = await import("@/lib/airline-ledger-google-sync");
          const result = await withTimeout(syncAirlineLedgerGoogleSheetNow(savedRevision), 45000, "Airline ledger Google Sheet sync");
          if (!result.synced) {
            sheetSynced = false;
            sheetSyncError = result.error ?? "Airline Google Sheet sync failed";
            console.error("Airline Sheet sync failed after database save:", sheetSyncError);
          }
        } catch (error) {
          sheetSynced = false;
          sheetSyncError = String(error instanceof Error ? error.message : error);
          console.error("Airline Sheet sync failed after database save:", sheetSyncError);
          await (supabaseAdmin as unknown as import("@supabase/supabase-js").SupabaseClient)
            .from("airline_ledger_google_sync").upsert({ id: 1, status: "error", error_message: sheetSyncError.slice(0, 1000) });
        }
      })(),
    ]);

    return {
      success: true,
      revision: savedRevision,
      persisted: true,
      syncPending: !sheetSynced,
      syncError: sheetSyncError,
    };
  });

export const reorderAirlineLedger = createServerFn({ method: "POST" })
  .validator((data: unknown) => z.object({
    expectedRevision: z.number().int().nonnegative(),
    airlineIds: z.array(z.string()).min(1),
  }).parse(data))
  .handler(async ({ data }) => {
    await requireUnlocked();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let savedRevision = 0;
    let error: any = null;

    const firstAttempt = await (supabaseAdmin as unknown as import("@supabase/supabase-js").SupabaseClient).rpc("reorder_airline_ledger", {
      p_airline_ids: data.airlineIds,
      p_expected_revision: data.expectedRevision,
    });
    savedRevision = Number(firstAttempt.data);
    error = firstAttempt.error;

    if (error) {
      if (error.message.includes("AIRLINE_LEDGER_CONFLICT")) {
        // Reordering changes only sort_order, never financial values. If another
        // save advanced the ledger revision meanwhile, retry the same order
        // against the current revision instead of making a harmless drag fail.
        const { data: meta, error: metaError } = await supabaseAdmin
          .from("airline_ledger_meta")
          .select("revision")
          .eq("id", 1)
          .maybeSingle();
        if (metaError) throw new Error(`Airline order save failed: ${metaError.message}`);
        const currentRevision = Number(meta?.revision ?? 0);
        if (!Number.isFinite(currentRevision) || currentRevision <= 0) {
          throw new Error("Airline order save failed: current ledger revision is unavailable.");
        }
        const retry = await (supabaseAdmin as unknown as import("@supabase/supabase-js").SupabaseClient).rpc("reorder_airline_ledger", {
          p_airline_ids: data.airlineIds,
          p_expected_revision: currentRevision,
        });
        savedRevision = Number(retry.data);
        error = retry.error;
      }
      if (error) {
        throw new Error(`Airline order save failed: ${error.message}`);
      }
    }

    if (!Number.isFinite(savedRevision) || savedRevision <= 0) {
      throw new Error("Airline order save was not confirmed by the secure backend.");
    }

    // Database order is authoritative. Run Sheet mirror in background so reordering is instant.
    (async () => {
      try {
        const { syncAirlineLedgerGoogleSheetNow } = await import("@/lib/airline-ledger-google-sync");
        await syncAirlineLedgerGoogleSheetNow(savedRevision);
      } catch (sheetErr) {
        console.error("Async airline reorder Google Sheet sync failed:", sheetErr);
      }
    })().catch((err) => console.error("Background reorder sync error:", err));

    return { success: true, persisted: true, revision: savedRevision, syncPending: false, syncError: null };
  });

export const listActivePaymentAccounts = createServerFn({ method: "GET" }).handler(async () => {
  await requireUnlocked();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("accounts_book_accounts")
    .select("id, name, kind, is_active")
    .eq("is_active", true);

  if (error || !data) {
    console.warn("[airline-ledger] Failed to list payment accounts:", error?.message);
    return [];
  }

  // Sort cash accounts first ("Cash in Hand"), then banks & wallets alphabetically
  return [...data].sort((a, b) => {
    if (a.kind === "cash" && b.kind !== "cash") return -1;
    if (a.kind !== "cash" && b.kind === "cash") return 1;
    return a.name.localeCompare(b.name);
  });
});



// The agent_received column (agent/counter sale "Received" amount) is added by
// migration 20261016154500_airline_ledger_agent_received.sql. Databases that have
// not applied the migration yet must still be able to save transactions, so the
// column is probed once per server instance and only written when it exists.
let agentReceivedColumnSupported: boolean | null = null;
async function airlineTxSupportsAgentReceived(supabase: any): Promise<boolean> {
  if (agentReceivedColumnSupported !== null) return agentReceivedColumnSupported;
  try {
    const { error } = await supabase.from("airline_ledger_transactions").select("agent_received").limit(1);
    agentReceivedColumnSupported = !error;
    if (error) console.warn("[airline-ledger] agent_received column unavailable (run migration 20261016154500):", error.message);
  } catch (e: any) {
    agentReceivedColumnSupported = false;
    console.warn("[airline-ledger] agent_received probe failed:", e?.message);
  }
  return agentReceivedColumnSupported;
}

export const saveAirlineTransactionAtomic = createServerFn({ method: "POST" })
  .validator((data: unknown) => z.object({
    airlineId: z.string().min(1),
    row: z.object({
      id: z.string().optional().nullable(),
      date: z.string().optional().nullable(),
      transactionType: z.string().optional().nullable(),
      agentName: z.string().optional().nullable(),
      paxName: z.string().optional().nullable(),
      sector: z.string().optional().nullable(),
      pnr: z.string().optional().nullable(),
      ticketSales: z.union([z.number(), z.string(), z.null()]).optional(),
      debitInId: z.union([z.number(), z.string(), z.null()]).optional(),
      creditFromId: z.union([z.number(), z.string(), z.null()]).optional(),
      paxContact: z.string().optional().nullable(),
      voidCharges: z.union([z.number(), z.string(), z.null()]).optional(),
      currency: z.string().optional().nullable(),
      roe: z.union([z.number(), z.string(), z.null()]).optional(),
      foreignAmount: z.union([z.number(), z.string(), z.null()]).optional(),
      receivedVia: z.string().optional().nullable(),
      agentReceived: z.union([z.number(), z.string(), z.null()]).optional(),
      receivedViaAccountId: z.string().optional().nullable(),
    }),
  }).parse(data))
  .handler(async ({ data }) => {
    await requireUnlocked();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const airlineId = data.airlineId;
    const r = data.row;

    const cleanNum = (v: unknown): number | null => {
      if (v === "" || v === null || v === undefined) return null;
      const cleaned = typeof v === "string" ? v.replace(/,/g, "").trim() : v;
      const n = Number(cleaned);
      return Number.isNaN(n) ? null : n;
    };

    const cleanStr = (v: unknown): string | null => {
      if (v === null || v === undefined) return null;
      const s = String(v).trim();
      return s ? s : null;
    };

    const rawType = cleanStr(r.transactionType) || "Add Transaction";
    const sector = cleanStr(r.sector) || "";
    const pax = cleanStr(r.paxName) || "";

    let resolvedType = rawType;
    if (rawType.toLowerCase() === "top up" || /top\s*up/i.test(sector) || /top\s*up/i.test(pax)) {
      resolvedType = "Top Up";
    } else if (
      ["cancel/refund", "refund"].includes(rawType.toLowerCase()) ||
      /refund|cancel/i.test(rawType) ||
      /refund|cancel/i.test(sector) ||
      /refund|cancel/i.test(pax)
    ) {
      resolvedType = "Cancel/Refund";
    }

    const isTopUp = resolvedType === "Top Up";
    const isRefund = resolvedType === "Cancel/Refund";

    const rowId = cleanStr(r.id) || (Math.random().toString(36).slice(2, 10) + Date.now().toString(36));
    const date = cleanStr(r.date) || new Date().toISOString().slice(0, 10);
    const paxName = cleanStr(r.paxName) || (isTopUp ? "Top Up Portal" : isRefund ? "Refund Record" : "Pax");
    const agentName = cleanStr(r.agentName);
    const pnr = cleanStr(r.pnr);
    const ticketSales = cleanNum(r.ticketSales);
    const creditFromId = cleanNum(r.creditFromId);
    const debitInId = cleanStr(r.debitInId) ? String(r.debitInId).replace(/,/g, "").trim() : null;
    const paxContact = cleanStr(r.paxContact);
    const voidCharges = cleanNum(r.voidCharges);
    const currency = cleanStr(r.currency) || "PKR";
    const roe = cleanNum(r.roe) || 1;
    const foreignAmount = cleanNum(r.foreignAmount);
    const receivedVia = isTopUp ? null : cleanStr(r.receivedVia);
    const receivedViaAccountId = isTopUp ? null : cleanStr(r.receivedViaAccountId);
    // Agent / counter sale breakdown: how much of the ticket sale was received.
    // Remaining (recovery balance) is derived as ticket_sales - agent_received.
    const agentReceived = isTopUp || isRefund ? null : cleanNum(r.agentReceived);

    const recordToUpsert: any = {
      id: rowId,
      airline_id: airlineId,
      date,
      agent_name: agentName,
      pax_name: paxName,
      sector: sector || null,
      pnr,
      ticket_sales: ticketSales,
      debit_in_id: debitInId,
      credit_from_id: creditFromId,
      pax_contact: paxContact,
      void_charges: voidCharges,
      currency,
      roe,
      foreign_amount: foreignAmount,
      transaction_type: resolvedType,
      received_via: receivedVia,
      received_via_account_id: receivedViaAccountId,
    };
    if (agentReceived !== null && await airlineTxSupportsAgentReceived(supabaseAdmin)) {
      recordToUpsert.agent_received = agentReceived;
    }

    let { error: upsertErr } = await supabaseAdmin
      .from("airline_ledger_transactions")
      .upsert(recordToUpsert, { onConflict: "id" });

    // Defensive retry: if the probe was stale and the database still lacks the
    // column, save the transaction without the agent breakdown rather than
    // failing the whole financial entry.
    if (upsertErr && /agent_received/i.test(upsertErr.message || "")) {
      agentReceivedColumnSupported = false;
      const retryRecord = { ...recordToUpsert };
      delete retryRecord.agent_received;
      const retry = await supabaseAdmin
        .from("airline_ledger_transactions")
        .upsert(retryRecord, { onConflict: "id" });
      upsertErr = retry.error;
    }

    if (upsertErr) {
      throw new Error(`Failed to save airline transaction: ${upsertErr.message}`);
    }

    const { data: meta } = await supabaseAdmin
      .from("airline_ledger_meta")
      .select("revision")
      .eq("id", 1)
      .maybeSingle();

    const newRevision = Number(meta?.revision ?? 1);

    // Run downstream syncs in parallel: Agent ledgers, Accounts Book, Airline Google Sheet, Financial Backup
    try {
      const [airlinesRes, txRes] = await Promise.all([
        supabaseAdmin.from("airline_ledger_airlines").select("*").order("sort_order", { ascending: true }),
        supabaseAdmin.from("airline_ledger_transactions").select("*").order("date", { ascending: true }).order("sort_order", { ascending: true }),
      ]);

      const allAirlines = airlinesRes.data || [];
      const allTransactions = txRes.data || [];

      // Fire-and-forget: the database row is committed, so the response must not
      // wait for the Google Sheet rebuilds (up to ~45s each). Each sync marks its
      // own status row, and the admin page's status poller + on-open sync heal
      // any run that fails. Blocking the response here made every save appear to
      // hang for ~45s and triggered the browser "changes will not be saved"
      // warning when the user refreshed during the wait.
      void Promise.allSettled([
        (async () => {
          try {
            const { syncAirlineTransactionsToAgentLedgers } = await import("@/lib/ledger-admin.functions");
            await syncAirlineTransactionsToAgentLedgers(allTransactions, allAirlines);
          } catch (e) {
            console.warn("[airline-atomic] Agent ledger sync:", e);
          }
        })(),
        (async () => {
          try {
            const { syncAirlineTransactionsToAccountsBook } = await import("@/lib/airline-ledger-accounts-sync.server");
            await syncAirlineTransactionsToAccountsBook(allTransactions, allAirlines);
          } catch (e) {
            console.warn("[airline-atomic] Accounts book sync:", e);
          }
        })(),
        (async () => {
          try {
            const { syncAirlineLedgerGoogleSheetNow } = await import("@/lib/airline-ledger-google-sync");
            await syncAirlineLedgerGoogleSheetNow(newRevision);
          } catch (e) {
            console.warn("[airline-atomic] Airline Google Sheet sync:", e);
          }
        })(),
        (async () => {
          try {
            const { syncRohiFinancialBackup } = await import("@/lib/financial-google-backup");
            const [accounts, accountTransactions, services] = await Promise.all([
              supabaseAdmin.from("accounts_book_accounts").select("*"),
              supabaseAdmin.from("accounts_book_transactions").select("*"),
              supabaseAdmin.from("accounts_book_services").select("*"),
            ]);
            await syncRohiFinancialBackup({
              airlines: allAirlines,
              airlineTransactions: allTransactions,
              accounts: accounts.data || [],
              accountTransactions: accountTransactions.data || [],
              services: services.data || [],
            }, newRevision);
          } catch (e) {
            console.warn("[airline-atomic] Financial backup sync:", e);
          }
        })(),
      ]);
    } catch (bgErr) {
      console.warn("[airline-atomic] Downstream sync runner error:", bgErr);
    }

    return {
      success: true,
      revision: newRevision,
      row: {
        id: rowId,
        date,
        transactionType: resolvedType,
        agentName: agentName || "",
        paxName,
        sector: sector || "",
        pnr: pnr || "",
        ticketSales: ticketSales !== null ? ticketSales : "",
        debitInId: debitInId ?? "",
        creditFromId: creditFromId !== null ? creditFromId : "",
        paxContact: paxContact ?? "",
        voidCharges: voidCharges !== null ? voidCharges : "",
        currency,
        roe,
        foreignAmount,
        receivedVia,
        receivedViaAccountId,
        agentReceived: agentReceived !== null ? agentReceived : "",
      },
    };
  });

export const deleteAirlineTransactionAtomic = createServerFn({ method: "POST" })
  .validator((data: unknown) => z.object({
    airlineId: z.string().min(1),
    transactionId: z.string().min(1),
  }).parse(data))
  .handler(async ({ data }) => {
    await requireUnlocked();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: deletedRows, error: delErr } = await supabaseAdmin
      .from("airline_ledger_transactions")
      .delete()
      .eq("id", data.transactionId)
      .select("id");

    if (delErr) {
      throw new Error(`Failed to delete airline transaction: ${delErr.message}`);
    }
    if (!Array.isArray(deletedRows) || deletedRows.length === 0) {
      // A delete that matches zero rows must never look successful: the screen
      // would hide the row while the database (and every mirror, including the
      // Google Sheet tabs) still has it, and the next rebuild writes it back.
      throw new Error(
        "This transaction was not found in the database (it may already be deleted, or this screen is showing stale data). Refresh the Airline Accounts page and try again."
      );
    }

    const { data: meta } = await supabaseAdmin
      .from("airline_ledger_meta")
      .select("revision")
      .eq("id", 1)
      .maybeSingle();

    const newRevision = Number(meta?.revision ?? 1);

    // Run downstream syncs in parallel: Agent ledgers, Accounts Book, Airline Google Sheet, Financial Backup
    try {
      const [airlinesRes, txRes] = await Promise.all([
        supabaseAdmin.from("airline_ledger_airlines").select("*").order("sort_order", { ascending: true }),
        supabaseAdmin.from("airline_ledger_transactions").select("*").order("date", { ascending: true }).order("sort_order", { ascending: true }),
      ]);

      const allAirlines = airlinesRes.data || [];
      const allTransactions = txRes.data || [];

      // Downstream mirrors complete BEFORE the response returns (Accounts Book
      // pattern). A detached background promise can be killed by the serverless
      // runtime once the response is sent, which silently skipped the Google
      // Sheet write after deletes. Individual timeouts keep the wait bounded.
      const settledDelete = await Promise.allSettled([
        (async () => {
          try {
            const { syncAirlineTransactionsToAgentLedgers } = await import("@/lib/ledger-admin.functions");
            await syncAirlineTransactionsToAgentLedgers(allTransactions, allAirlines);
          } catch (e) {
            console.warn("[airline-atomic-delete] Agent ledger sync:", e);
          }
        })(),
        (async () => {
          try {
            const { syncAirlineTransactionsToAccountsBook } = await import("@/lib/airline-ledger-accounts-sync.server");
            await syncAirlineTransactionsToAccountsBook(allTransactions, allAirlines);
          } catch (e) {
            console.warn("[airline-atomic-delete] Accounts book sync:", e);
          }
        })(),
        (async () => {
          try {
            const { syncAirlineCounterSalesToSalesAccounts } = await import("@/lib/airline-ledger-counter-sales.server");
            await syncAirlineCounterSalesToSalesAccounts(allTransactions, allAirlines);
          } catch (e) {
            console.warn("[airline-atomic-delete] Counter sales sync:", e);
          }
        })(),
        (async () => {
          try {
            const { syncAirlineLedgerGoogleSheetNow } = await import("@/lib/airline-ledger-google-sync");
            const sheetRes = await syncAirlineLedgerGoogleSheetNow(newRevision);
            return { sheetSynced: sheetRes.synced === true, sheetSyncError: sheetRes.error ?? null };
          } catch (e) {
            console.warn("[airline-atomic-delete] Airline Google Sheet sync:", e);
            return { sheetSynced: false, sheetSyncError: String(e instanceof Error ? e.message : e) };
          }
        })(),
        (async () => {
          try {
            const { syncRohiFinancialBackup } = await import("@/lib/financial-google-backup");
            const [accounts, accountTransactions, services] = await Promise.all([
              supabaseAdmin.from("accounts_book_accounts").select("*"),
              supabaseAdmin.from("accounts_book_transactions").select("*"),
              supabaseAdmin.from("accounts_book_services").select("*"),
            ]);
            await syncRohiFinancialBackup({
              airlines: allAirlines,
              airlineTransactions: allTransactions,
              accounts: accounts.data || [],
              accountTransactions: accountTransactions.data || [],
              services: services.data || [],
            }, newRevision);
          } catch (e) {
            console.warn("[airline-atomic-delete] Financial backup sync:", e);
          }
        })(),
      ]);
    } catch (bgErr) {
      console.warn("[airline-atomic-delete] Downstream sync runner error:", bgErr);
    }

    const sheetsOutcome: any =
      settledDelete[2] && settledDelete[2].status === "fulfilled" ? (settledDelete[2] as any).value : null;

    return {
      success: true,
      revision: newRevision,
      sheetSynced: sheetsOutcome ? sheetsOutcome.sheetSynced === true : false,
      sheetSyncError: sheetsOutcome?.sheetSyncError ?? null,
    };
  });
