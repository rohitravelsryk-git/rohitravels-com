import { createServerFn } from "@tanstack/react-start";
import { useSession } from "@tanstack/react-start/server";
import { z } from "zod";

type GateSession = { unlocked?: boolean; staffUsername?: string | null };

function sessionConfig() {
  const password = typeof process !== "undefined" ? process.env.SESSION_SECRET : undefined;
  if (!password) return { password: "fallback-secret-for-prerender", name: "rohi-admin-prerender" };
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
    if (typeof process !== "undefined" && !process.env.SESSION_SECRET) {
      return { data: { unlocked: true } } as any;
    }
    throw e;
  }
}

export type AirlineLedgerAirline = { id: string; name: string; code: string; openingBalance: number };
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

export const getAirlineLedgerData = createServerFn({ method: "GET" }).handler(async (): Promise<AirlineLedgerData | null> => {
  await requireUnlocked();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const [airlinesRes, agentsRes, txRes] = await Promise.all([
    supabaseAdmin.from("airline_ledger_airlines").select("*").order("sort_order", { ascending: true }),
    supabaseAdmin.from("airline_ledger_agents").select("*").order("sort_order", { ascending: true }),
    supabaseAdmin.from("airline_ledger_transactions").select("*").order("sort_order", { ascending: true }),
  ]);

  const airlines = (airlinesRes.data ?? []).map((a: any) => ({
    id: a.id,
    name: a.name,
    code: a.code,
    openingBalance: Number(a.opening_balance) || 0,
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

  if (!airlines.length && !agents.length && !Object.keys(transactions).length) return null;
  return { airlines, agents, transactions };
});

export const saveAirlineLedgerData = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => dataSchema.parse(data))
  .handler(async ({ data }) => {
    await requireUnlocked();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const airlineRows = data.airlines.map((a, i) => ({
      id: a.id,
      name: a.name,
      code: a.code || "--",
      opening_balance: num(a.openingBalance) ?? 0,
      sort_order: i,
    }));
    const agentRows = data.agents.map((name, i) => ({ name, sort_order: i }));
    const txRows: any[] = [];
    for (const [airlineId, rows] of Object.entries(data.transactions)) {
      rows.forEach((r, i) => {
        txRows.push({
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
        });
      });
    }

    // Full replace keeps the client's autosave-on-change shape authoritative.
    await supabaseAdmin.from("airline_ledger_transactions").delete().neq("id", "__none__");
    await supabaseAdmin.from("airline_ledger_airlines").delete().neq("id", "__none__");
    await supabaseAdmin.from("airline_ledger_agents").delete().neq("name", "__none__");

    if (airlineRows.length) {
      const { error } = await supabaseAdmin.from("airline_ledger_airlines").insert(airlineRows);
      if (error) throw new Error(error.message);
    }
    if (agentRows.length) {
      const { error } = await supabaseAdmin.from("airline_ledger_agents").insert(agentRows);
      if (error) throw new Error(error.message);
    }
    if (txRows.length) {
      const { error } = await supabaseAdmin.from("airline_ledger_transactions").insert(txRows);
      if (error) throw new Error(error.message);
    }
    return { success: true };
  });
