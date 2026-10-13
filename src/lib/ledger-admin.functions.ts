import { createServerFn } from "@tanstack/react-start";
import { useSession } from "@tanstack/react-start/server";
import { z } from "zod";
import { bookingLedgerEntry } from "@/lib/ledger-format";

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
    if (s.data.staffUsername) throw new Error("Forbidden: admin role required");
    return s;
  } catch (e) {
    throw e;
  }
}

/**
 * Calculates live balances and ledger entries for all approved agents,
 * and updates Google Sheets (Balances Overview, Agent_Transactions, and individual agent tabs).
 */
export async function syncAgentLedgersLiveInternal(): Promise<{ status: "success" | "failed"; count: number; error?: string }> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: agents, error: agentsError } = await supabaseAdmin
      .from("agents")
      .select("user_id, agency_name, contact_person, cell_number, country_code, user_code")
      .eq("status", "approved");

    if (agentsError) throw new Error(agentsError.message);
    if (!agents || agents.length === 0) return { status: "success", count: 0 };

    const masterSyncData: any[] = [];
    const allTransactions: any[] = [];

    for (const agent of agents) {
      const { data: bookings } = await supabaseAdmin
        .from("agent_bookings")
        .select("id, created_at, seats, fare_on_demand, fare_snapshot, payment_status, status, passenger_names")
        .eq("agent_user_id", agent.user_id)
        .eq("status", "confirmed")
        .order("created_at", { ascending: true });

      const { data: manualEntries } = await supabaseAdmin
        .from("ledger_manual_entries")
        .select("*")
        .eq("agent_user_id", agent.user_id)
        .order("date", { ascending: true });

      let balance = 0;
      const ledgerRows: any[] = [];

      const combined = [
        ...(bookings ?? []).map((b: any) => ({ type: "booking" as const, ...b })),
        ...(manualEntries ?? []).map((m: any) => ({ type: "manual" as const, ...m, created_at: m.date })),
      ].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

      for (const item of combined) {
        let debit = 0;
        let credit = 0;
        let details = "";
        let id = item.id;
        let date = item.created_at;

        if (item.type === "booking") {
          const b = item;
          const unit = parseInt(String(b.fare_on_demand ?? b.fare_snapshot?.price_text ?? "").replace(/[^0-9]/g, ""), 10) || 0;
          debit = unit * (b.seats ?? 0);
          credit = 0;
          details = bookingLedgerEntry(b);
        } else {
          const m = item;
          debit = Number(m.debit) || 0;
          credit = Number(m.credit) || 0;
          details = m.details;
          date = m.date;
        }

        balance += debit - credit;

        ledgerRows.push({
          id,
          date,
          details,
          debit,
          credit,
          balance,
          isManual: item.type === "manual",
        });

        allTransactions.push({
          tx_id: id,
          date,
          agent_name: agent.agency_name,
          details,
          debit,
          credit,
          balance,
        });
      }

      const agentData = {
        ...agent,
        balance,
        contact: `${agent.country_code || ""} ${agent.cell_number || ""}`.trim(),
        ledger: ledgerRows,
      };
      masterSyncData.push(agentData);
    }

    if (masterSyncData.length > 0) {
      const { syncMasterLedger } = await import("./backup/ledger-sync.server");
      await syncMasterLedger(masterSyncData, allTransactions);
    }

    return { status: "success", count: masterSyncData.length };
  } catch (err: any) {
    console.error("[agent-ledger] syncAgentLedgersLiveInternal error:", err);
    return { status: "failed", count: 0, error: err?.message || String(err) };
  }
}

/**
 * Links a Sale entry from Accounts Book to the registered agent in Supabase ledger_manual_entries.
 */
export async function linkAgentLedgerEntry(entry: {
  source_id: string;
  agentName: string;
  category: string;
  paxName?: string;
  country?: string;
  vendor?: string;
  saleAmount: number;
  entryDate: string;
}): Promise<{ ok: boolean; agent_user_id?: string; entry_id?: string }> {
  const agentQuery = (entry.agentName || "").trim();
  if (!agentQuery || Number(entry.saleAmount) <= 0) return { ok: false };

  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Match against approved agents in public.agents
    const { data: agents } = await supabaseAdmin
      .from("agents")
      .select("user_id, agency_name, contact_person, cell_number, country_code")
      .or(`agency_name.ilike.%${agentQuery}%,contact_person.ilike.%${agentQuery}%`)
      .limit(1);

    const matchedAgent = agents && agents.length > 0 ? agents[0] : null;
    if (!matchedAgent) {
      console.info(`[agent-ledger] Agent "${agentQuery}" not found in registered agents; skipping ledger_manual_entries.`);
      return { ok: false };
    }

    const details = `${entry.category} - ${entry.paxName || "Booking"}${entry.country ? ` • ${entry.country}` : ""}${entry.vendor ? ` • Vendor: ${entry.vendor}` : ""} • Ref: ${entry.source_id}`;

    const { data: inserted, error } = await supabaseAdmin
      .from("ledger_manual_entries")
      .insert({
        agent_user_id: matchedAgent.user_id,
        date: new Date(entry.entryDate).toISOString(),
        details,
        debit: Number(entry.saleAmount) || 0,
        credit: 0,
      })
      .select("id")
      .maybeSingle();

    if (error) {
      console.warn("[agent-ledger] Could not insert ledger_manual_entries:", error.message);
      return { ok: false };
    }
    return { ok: true, agent_user_id: matchedAgent.user_id, entry_id: inserted?.id };
  } catch (err) {
    console.warn("[agent-ledger] linkAgentLedgerEntry error:", err);
    return { ok: false };
  }
}

/**
 * Removes any linked agent ledger entries for a deleted sale transaction.
 */
export async function unlinkAgentLedgerEntries(sourceId: string): Promise<{ ok: boolean }> {
  if (!sourceId) return { ok: false };
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("ledger_manual_entries")
      .delete()
      .ilike("details", `%Ref: ${sourceId}%`);
    return { ok: true };
  } catch (err) {
    console.warn("[agent-ledger] unlinkAgentLedgerEntries error:", err);
    return { ok: false };
  }
}

export const listAgentLedgersAdmin = createServerFn({ method: "GET" }).handler(async () => {
  await requireUnlocked();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  
  const { data: agents, error: agentsError } = await supabaseAdmin
    .from("agents")
    .select("user_id, agency_name, contact_person, cell_number, country_code, user_code")
    .eq("status", "approved");
  
  if (agentsError) throw new Error(agentsError.message);
  
  const results = [];
  const masterSyncData = [];
  const allTransactions = [];

  for (const agent of agents ?? []) {
    const { data: bookings } = await supabaseAdmin
      .from("agent_bookings")
      .select("id, created_at, seats, fare_on_demand, fare_snapshot, payment_status, status, passenger_names")
      .eq("agent_user_id", agent.user_id)
      .eq("status", "confirmed")
      .order("created_at", { ascending: true });

    const { data: manualEntries } = await supabaseAdmin
      .from("ledger_manual_entries")
      .select("*")
      .eq("agent_user_id", agent.user_id)
      .order("date", { ascending: true });

    let balance = 0;
    const ledgerRows = [];

    const combined = [
      ...(bookings ?? []).map((b: any) => ({ type: "booking" as const, ...b })),
      ...(manualEntries ?? []).map((m: any) => ({ type: "manual" as const, ...m, created_at: m.date })),
    ].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    for (const item of combined) {
      let debit = 0;
      let credit = 0;
      let details = "";
      let id = item.id;
      let date = item.created_at;

      if (item.type === "booking") {
        const b = item;
        const unit = parseInt(String(b.fare_on_demand ?? b.fare_snapshot?.price_text ?? "").replace(/[^0-9]/g, ""), 10) || 0;
        debit = unit * (b.seats ?? 0);
        credit = 0;
        details = bookingLedgerEntry(b);
      } else {
        const m = item;
        debit = Number(m.debit) || 0;
        credit = Number(m.credit) || 0;
        details = m.details;
        date = m.date;
      }

      balance += (debit - credit);

      ledgerRows.push({
        id,
        date,
        details,
        debit,
        credit,
        balance,
        isManual: item.type === "manual",
      });

      allTransactions.push({
        tx_id: id,
        date,
        agent_name: agent.agency_name,
        details,
        debit,
        credit,
        balance,
      });
    }
    
    const agentData = {
      ...agent,
      balance,
      contact: `${agent.country_code || ""} ${agent.cell_number || ""}`.trim(),
      ledger: ledgerRows,
    };
    results.push(agentData);
    masterSyncData.push(agentData);
  }
  
  if (masterSyncData.length > 0) {
    try {
      const { syncMasterLedger } = await import("./backup/ledger-sync.server");
      await syncMasterLedger(masterSyncData, allTransactions);
    } catch (e) {
      console.error("Master ledger sync failed:", e);
    }
  }
  
  return results;
});

export const addManualLedgerEntry = createServerFn({ method: "POST" })
  .validator((data: any) => z.object({
    agent_user_id: z.string(),
    date: z.string(),
    details: z.string(),
    debit: z.number(),
    credit: z.number(),
  }).parse(data))
  .handler(async ({ data }) => {
    await requireUnlocked();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    
    const { error } = await supabaseAdmin.from("ledger_manual_entries").insert({
      ...data,
    });
    
    if (error) throw new Error(error.message);
    // Instant live sync to Agent Ledger Accounts
    try {
      await syncAgentLedgersLiveInternal();
    } catch (err) {
      console.warn("[agent-ledger] Sync after manual entry failed:", err);
    }
    return { success: true };
  });

export const deleteManualLedgerEntry = createServerFn({ method: "POST" })
  .validator((id: any) => z.string().parse(id))
  .handler(async ({ data: id }) => {
    await requireUnlocked();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("ledger_manual_entries").delete().eq("id", id);
    if (error) throw new Error(error.message);
    // Instant live sync to Agent Ledger Accounts
    try {
      await syncAgentLedgersLiveInternal();
    } catch (err) {
      console.warn("[agent-ledger] Sync after delete manual entry failed:", err);
    }
    return { success: true };
  });
