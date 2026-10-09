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
  const n = Number(v);
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
      supabaseAdmin.from("airline_ledger_transactions").select("*").order("sort_order", { ascending: true }),
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

    const defaultCurrency = isG9 ? "AED" : isXY ? "SAR" : isF3 ? "USD" : "PKR";
    const defaultRoe = isG9 ? 77.30 : isXY ? 75.50 : isF3 ? 284.00 : 1.0;

    const currency = a.currency || defaultCurrency;
    const roe = Number(a.roe) || defaultRoe;
    const openingBalance = Number(a.opening_balance) || 0;
    const openingBalanceForeign = a.opening_balance_foreign !== null && a.opening_balance_foreign !== undefined
      ? Number(a.opening_balance_foreign)
      : (currency !== "PKR" ? (openingBalance ? openingBalance / roe : (isG9 ? 215.77 : isXY ? 3775.52 : isF3 ? 120.67 : 0)) : null);

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
    list.push({
      id: t.id,
      date: t.date ?? "",
      agentName: t.agent_name ?? "",
      paxName: t.pax_name ?? "",
      sector: t.sector ?? "",
      pnr: t.pnr ?? "",
      ticketSales: t.ticket_sales ?? "",
      debitInId: t.debit_in_id ?? "",
      creditFromId: t.credit_from_id ?? "",
      paxContact: t.pax_contact ?? "",
      voidCharges: t.void_charges ?? "",
      currency: t.currency ?? null,
      roe: t.roe ?? null,
      foreignAmount: t.foreign_amount ?? null,
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
          agent_name: str(r.agentName),
          pax_name: str(r.paxName),
          sector: str(r.sector),
          pnr: str(r.pnr),
          ticket_sales: num(r.ticketSales),
          debit_in_id: str(r.debitInId),
          credit_from_id: num(r.creditFromId),
          pax_contact: str(r.paxContact),
          void_charges: num(r.voidCharges),
          sort_order: i,
          currency: str(r.currency),
          roe: num(r.roe),
          foreign_amount: num(r.foreignAmount),
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
        supabaseAdmin.from("airline_ledger_transactions").select("*").order("sort_order", { ascending: true }),
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
      supabaseAdmin.from("airline_ledger_transactions").select("*").order("sort_order", { ascending: true }),
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

    // Database commit is authoritative and durable. Trigger Google Sheets backup
    // asynchronously in the background so the HTTP response returns immediately (<100ms)
    // without stalling the user or risking data loss if the tab is closed/refreshed.
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

      try {
        const { syncAirlineLedgerGoogleSheetNow } = await import("@/lib/airline-ledger-google-sync");
        await withTimeout(syncAirlineLedgerGoogleSheetNow(savedRevision), 15000, "Airline ledger Google Sheet sync");
      } catch (sheetErr) {
        console.error("Async airline ledger Google Sheet sync failed:", sheetErr);
      }
    })().catch((err) => console.error("Background sync runner error:", err));

    return {
      success: true,
      revision: savedRevision,
      persisted: true,
      syncPending: false,
      syncError: null,
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

    const firstAttempt = await supabaseAdmin.rpc("reorder_airline_ledger", {
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
        const retry = await supabaseAdmin.rpc("reorder_airline_ledger", {
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
