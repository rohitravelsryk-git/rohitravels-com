import { createServerFn } from "@tanstack/react-start";
import { useSession } from "@tanstack/react-start/server";
import { z } from "zod";

type GateSession = { unlocked?: boolean; staffUsername?: string | null };

function sessionConfig() {
  const password = typeof process !== "undefined" ? process.env.SESSION_SECRET : undefined;
  if (!password) throw new Error("Server misconfigured: SESSION_SECRET is not set");
  return {
    password,
    name: "rohi-admin",
    maxAge: 60 * 60 * 8,
    cookie: { httpOnly: true, secure: true, sameSite: "none" as const, path: "/" },
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
    supabaseAdmin.rpc("get_airline_ledger_revision"),
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
    revision: Number(revisionRes.data ?? 1),
  };
});

export const saveAirlineLedgerData = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({
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

    // Google Sheets is strictly a downstream backup. A Sheets failure NEVER
    // rolls back or blocks the authoritative Supabase financial save.
    try {
      const { syncAirlineLedgerToGoogleSheet } = await import("@/lib/airline-ledger-google-sync");
      const [airlinesRes, agentsRes, txRes] = await Promise.all([
        supabaseAdmin.from("airline_ledger_airlines").select("*").order("sort_order", { ascending: true }),
        supabaseAdmin.from("airline_ledger_agents").select("*").order("sort_order", { ascending: true }),
        supabaseAdmin.from("airline_ledger_transactions").select("*").order("sort_order", { ascending: true }),
      ]);
      if (airlinesRes.error || agentsRes.error || txRes.error) {
        throw new Error(airlinesRes.error?.message || agentsRes.error?.message || txRes.error?.message || "Could not read saved ledger snapshot");
      }
      const result = await syncAirlineLedgerToGoogleSheet({
        airlines: (airlinesRes.data ?? []) as any,
        agents: (agentsRes.data ?? []) as any,
        transactions: (txRes.data ?? []) as any,
      }, savedRevision);

      await supabaseAdmin.from("airline_ledger_google_sync").upsert({
        id: 1,
        last_synced_revision: result.synced ? savedRevision : null,
        last_synced_at: result.synced ? new Date().toISOString() : null,
        status: result.configured ? (result.synced ? "synced" : "not_configured") : "not_configured",
        error_message: null,
      });
    } catch (syncError) {
      console.error("Airline ledger Google Sheets mirror failed", syncError);
      await supabaseAdmin.from("airline_ledger_google_sync").upsert({
        id: 1,
        status: "error",
        error_message: String(syncError instanceof Error ? syncError.message : syncError).slice(0, 1000),
      });
    }

    return { success: true, revision: savedRevision };
  });
