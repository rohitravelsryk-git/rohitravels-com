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

export type AirlineLedgerAirline = { id: string; name: string; code: string; openingBalance: number; openingBalanceDate: string };
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
});

const dataSchema = z.object({
  airlines: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      code: z.string(),
      openingBalance: z.union([z.number(), z.string()]).nullish(),
      openingBalanceDate: z.string().nullish(),
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

export const getAirlineLedgerData = createServerFn({ method: "GET" }).handler(async (): Promise<AirlineLedgerData> => {
  await requireUnlocked();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const [airlinesRes, agentsRes, txRes, revisionRes] = await Promise.all([
    supabaseAdmin.from("airline_ledger_airlines").select("*").order("sort_order", { ascending: true }),
    supabaseAdmin.from("airline_ledger_agents").select("*").order("sort_order", { ascending: true }),
    supabaseAdmin.from("airline_ledger_transactions").select("*").order("sort_order", { ascending: true }),
    supabaseAdmin.from("airline_ledger_meta").select("revision").eq("id", 1).maybeSingle(),
  ]);

  for (const result of [airlinesRes, agentsRes, txRes, revisionRes]) {
    if (result.error) throw new Error(`Airline ledger load failed: ${result.error.message}`);
  }

  const airlines = (airlinesRes.data ?? []).map((a: any) => ({
    id: a.id,
    name: a.name,
    code: a.code,
    openingBalance: Number(a.opening_balance) || 0,
    openingBalanceDate: a.opening_balance_date ?? new Date().toISOString().slice(0, 10),
  }));
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
      airlines: data.data.airlines.map((a, i) => ({
        id: a.id,
        name: a.name,
        code: a.code || "--",
        opening_balance: num(a.openingBalance) ?? 0,
        opening_balance_date: str(a.openingBalanceDate) ?? new Date().toISOString().slice(0, 10),
        sort_order: i,
      })),
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
        })),
      ),
    };

    const { data: revision, error } = await supabaseAdmin.rpc("save_airline_ledger", {
      p_data: normalized,
      p_expected_revision: data.expectedRevision,
    });

    if (error) {
      if (error.message.includes("AIRLINE_LEDGER_CONFLICT")) {
        throw new Error("AIRLINE_LEDGER_CONFLICT: This ledger changed in another tab/session. Nothing was overwritten.");
      }
      throw new Error(`Airline ledger save failed: ${error.message}`);
    }

    const savedRevision = Number(revision);

    try {
      const { syncRohiFinancialBackup } = await import("@/lib/financial-google-backup");
      const [airlinesRes, txRes, accounts, accountTransactions, services] = await Promise.all([
        supabaseAdmin.from("airline_ledger_airlines").select("*").order("sort_order", { ascending: true }),
        supabaseAdmin.from("airline_ledger_transactions").select("*").order("sort_order", { ascending: true }),
        supabaseAdmin.from("accounts_book_accounts").select("*").order("created_at"),
        supabaseAdmin.from("accounts_book_transactions").select("*").order("entry_date").order("created_at"),
        supabaseAdmin.from("accounts_book_services").select("*").order("name"),
      ]);
      if (accounts.error || accountTransactions.error || services.error) {
        throw new Error(accounts.error?.message || accountTransactions.error?.message || services.error?.message || "Could not read Accounts Book backup snapshot");
      }
      const result = await syncRohiFinancialBackup({
        airlines: airlinesRes.data ?? [],
        airlineTransactions: txRes.data ?? [],
        accounts: accounts.data ?? [],
        accountTransactions: accountTransactions.data ?? [],
        services: services.data ?? [],
      }, savedRevision);
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
    } catch (backupError) {
      console.error("ROHI financial Google backup failed", backupError);
      await (supabaseAdmin as unknown as import("@supabase/supabase-js").SupabaseClient).from("rohi_financial_backup_sync").upsert({
        id: 1,
        status: "error",
        error_message: String(backupError instanceof Error ? backupError.message : backupError).slice(0, 1000),
        updated_at: new Date().toISOString(),
      });
    }

    try {
      const { syncAirlineAccountsSheet } = await import("@/lib/airline-accounts-sheet.server");
      await syncAirlineAccountsSheet(savedRevision);
    } catch (sheetError) {
      console.error("Airline Accounts Google Sheet sync failed", sheetError);
    }

    return { success: true, revision: savedRevision };
  });

// Creates (once) and refreshes the single "Airline Accounts" Google Sheet, returns its link.
export const syncAirlineAccountsGoogleSheet = createServerFn({ method: "POST" }).handler(async () => {
  await requireUnlocked();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.from("airline_ledger_meta").select("revision").eq("id", 1).maybeSingle();
  const { syncAirlineAccountsSheet } = await import("@/lib/airline-accounts-sheet.server");
  return syncAirlineAccountsSheet(Number(data?.revision ?? 1));
});