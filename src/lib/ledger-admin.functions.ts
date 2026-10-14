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
 * Calculates live balances and ledger entries for all registered agents,
 * and updates Google Sheets (Balances Overview, Agent_Transactions, and individual agent tabs).
 */
export async function syncAgentLedgersLiveInternal(): Promise<{ status: "success" | "failed"; count: number; error?: string }> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Include all registered agents (excluding only explicitly rejected ones)
    const { data: agents, error: agentsError } = await supabaseAdmin
      .from("agents")
      .select("user_id, agency_name, contact_person, cell_number, country_code, user_code, status")
      .neq("status", "rejected");

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
  agentUserId?: string;
  category: string;
  paxName?: string;
  country?: string;
  vendor?: string;
  saleAmount: number;
  entryDate: string;
}): Promise<{ ok: boolean; agent_user_id?: string; entry_id?: string }> {
  const agentQuery = (entry.agentName || "").trim();
  if ((!agentQuery && !entry.agentUserId) || Number(entry.saleAmount) <= 0) return { ok: false };

  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Fetch all registered agents to match safely in memory without brittle PostgREST query syntax errors
    const { data: allAgents, error: agentsError } = await supabaseAdmin
      .from("agents")
      .select("user_id, agency_name, contact_person, cell_number, country_code, user_code");

    if (agentsError || !allAgents || allAgents.length === 0) {
      console.warn("[agent-ledger] Could not fetch registered agents:", agentsError?.message);
      return { ok: false };
    }

    let matchedAgent: any = null;
    if (entry.agentUserId) {
      matchedAgent = allAgents.find((a: any) => a.user_id === entry.agentUserId);
    }
    if (!matchedAgent && agentQuery) {
      const q = agentQuery.toLowerCase().trim();
      matchedAgent = allAgents.find((a: any) => {
        const agency = (a.agency_name || "").toLowerCase().trim();
        const contact = (a.contact_person || "").toLowerCase().trim();
        const code = (a.user_code || "").toLowerCase().trim();
        return agency === q || contact === q || code === q;
      }) || allAgents.find((a: any) => {
        const agency = (a.agency_name || "").toLowerCase().trim();
        const contact = (a.contact_person || "").toLowerCase().trim();
        return agency.includes(q) || q.includes(agency) || (contact && (contact.includes(q) || q.includes(contact)));
      });
    }

    if (!matchedAgent) {
      console.info(`[agent-ledger] Agent "${agentQuery}" not found in registered agents; skipping ledger_manual_entries.`);
      return { ok: false };
    }

    const details = `${entry.category} - ${entry.paxName || "Booking"}${entry.country ? ` • ${entry.country}` : ""}${entry.vendor ? ` • Vendor: ${entry.vendor}` : ""} • Ref: ${entry.source_id}`;
    const date = entry.entryDate ? new Date(entry.entryDate).toISOString() : new Date().toISOString();

    // Check if an existing entry is already recorded for this sale source_id
    const { data: existing } = await supabaseAdmin
      .from("ledger_manual_entries")
      .select("id, agent_user_id, debit, details")
      .ilike("details", `%Ref: ${entry.source_id}%`)
      .maybeSingle();

    let entryId: string | undefined;

    if (existing) {
      const { data: updated, error: updateErr } = await supabaseAdmin
        .from("ledger_manual_entries")
        .update({
          agent_user_id: matchedAgent.user_id,
          date,
          details,
          debit: Number(entry.saleAmount) || 0,
          credit: 0,
        })
        .eq("id", existing.id)
        .select("id")
        .maybeSingle();
      if (updateErr) {
        console.warn("[agent-ledger] Could not update existing ledger_manual_entries:", updateErr.message);
        return { ok: false };
      }
      entryId = updated?.id;
    } else {
      const { data: inserted, error: insertErr } = await supabaseAdmin
        .from("ledger_manual_entries")
        .insert({
          agent_user_id: matchedAgent.user_id,
          date,
          details,
          debit: Number(entry.saleAmount) || 0,
          credit: 0,
        })
        .select("id")
        .maybeSingle();

      if (insertErr) {
        console.warn("[agent-ledger] Could not insert ledger_manual_entries:", insertErr.message);
        return { ok: false };
      }
      entryId = inserted?.id;
    }

    // Instant live sync to Google Sheets (Agent Ledger Accounts)
    try {
      await syncAgentLedgersLiveInternal();
    } catch (syncErr) {
      console.warn("[agent-ledger] Instant Google Sheet sync failed:", syncErr);
    }

    return { ok: true, agent_user_id: matchedAgent.user_id, entry_id: entryId };
  } catch (err) {
    console.warn("[agent-ledger] linkAgentLedgerEntry error:", err);
    return { ok: false };
  }
}

/**
 * Removes any linked agent ledger entries for a deleted sale transaction and live syncs to Google Sheets.
 */
export async function unlinkAgentLedgerEntries(sourceId: string): Promise<{ ok: boolean }> {
  if (!sourceId) return { ok: false };
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("ledger_manual_entries")
      .delete()
      .ilike("details", `%Ref: ${sourceId}%`);

    try {
      await syncAgentLedgersLiveInternal();
    } catch (syncErr) {
      console.warn("[agent-ledger] Live sync after unlink failed:", syncErr);
    }

    return { ok: true };
  } catch (err) {
    console.warn("[agent-ledger] unlinkAgentLedgerEntries error:", err);
    return { ok: false };
  }
}

/**
 * Synchronizes Airline Accounts transactions with Agent Sales into Supabase (ledger_manual_entries)
 * and triggers instant live sync to Google Sheets (Agent Ledger Accounts).
 */
export async function syncAirlineTransactionsToAgentLedgers(
  transactions: any[],
  airlines: any[] = []
): Promise<{ processed: number; linked: number }> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1. Fetch all registered agents
    const { data: allAgents, error: agentsError } = await supabaseAdmin
      .from("agents")
      .select("user_id, agency_name, contact_person, cell_number, country_code, user_code");

    if (agentsError || !allAgents || allAgents.length === 0) {
      console.warn("[airline-to-agent-ledger] No registered agents found in database:", agentsError?.message);
      return { processed: 0, linked: 0 };
    }

    // Map airlines by ID
    const airlineMap = new Map<string, string>();
    for (const a of airlines) {
      if (a.id) airlineMap.set(a.id, a.name || a.code || "Airline");
    }

    // 2. Fetch existing manual entries linked to airline transactions
    const { data: existingAirlineEntries } = await supabaseAdmin
      .from("ledger_manual_entries")
      .select("id, details, debit, credit, date, agent_user_id")
      .ilike("details", "%Ref: AIRLINE-TX-%");

    const existingByTxId = new Map<string, any>();
    for (const entry of existingAirlineEntries || []) {
      const match = String(entry.details || "").match(/Ref:\s*AIRLINE-TX-([^\s•]+)/);
      if (match && match[1]) {
        existingByTxId.set(match[1], entry);
      }
    }

    let linkedCount = 0;
    const currentTxIdsWithAgent = new Set<string>();

    // 3. Process each transaction
    for (const tx of transactions) {
      const rawAgent = String(tx.agent_name || "").trim();
      const ticketSales = Number(tx.ticket_sales) || 0;
      const isAgentSale = Boolean(rawAgent && rawAgent !== "—" && (ticketSales !== 0 || tx.pnr));

      if (!isAgentSale) continue;

      const txId = String(tx.id || "");
      if (!txId) continue;
      currentTxIdsWithAgent.add(txId);

      // Match agent safely in memory
      const q = rawAgent.toLowerCase();
      const matchedAgent = allAgents.find((a: any) => {
        const agency = (a.agency_name || "").toLowerCase().trim();
        const contact = (a.contact_person || "").toLowerCase().trim();
        const code = (a.user_code || "").toLowerCase().trim();
        return agency === q || contact === q || code === q;
      }) || allAgents.find((a: any) => {
        const agency = (a.agency_name || "").toLowerCase().trim();
        const contact = (a.contact_person || "").toLowerCase().trim();
        return agency.includes(q) || q.includes(agency) || (contact && (contact.includes(q) || q.includes(contact)));
      });

      if (!matchedAgent) {
        console.info(`[airline-to-agent-ledger] Agent "${rawAgent}" not found in registered agents for airline tx ${txId}`);
        continue;
      }

      const airlineName = airlineMap.get(tx.airline_id) || "Airline";
      const isRefund = tx.transaction_type === "Cancel/Refund" || ticketSales < 0;
      const debit = isRefund ? 0 : Math.max(ticketSales, 0);
      const credit = isRefund ? Math.abs(ticketSales) : 0;
      const date = tx.date ? new Date(tx.date).toISOString() : new Date().toISOString();

      const details = `Airline Ticket (${airlineName}) - ${tx.pax_name || "Pax"}${tx.pnr ? ` • PNR: ${tx.pnr}` : ""}${tx.sector ? ` • ${tx.sector}` : ""}${tx.transaction_type && tx.transaction_type !== "Add Transaction" ? ` • ${tx.transaction_type}` : ""} • Ref: AIRLINE-TX-${txId}`;

      const existing = existingByTxId.get(txId);
      if (existing) {
        if (
          existing.agent_user_id !== matchedAgent.user_id ||
          Number(existing.debit) !== debit ||
          Number(existing.credit) !== credit ||
          existing.details !== details
        ) {
          await supabaseAdmin
            .from("ledger_manual_entries")
            .update({
              agent_user_id: matchedAgent.user_id,
              date,
              details,
              debit,
              credit,
            })
            .eq("id", existing.id);
        }
        existingByTxId.delete(txId); // Mark as active/retained
      } else {
        await supabaseAdmin.from("ledger_manual_entries").insert({
          agent_user_id: matchedAgent.user_id,
          date,
          details,
          debit,
          credit,
        });
      }
      linkedCount++;
    }

    // 4. Clean up any orphaned airline ledger entries whose transaction was deleted or agent removed
    for (const [orphanedTxId, orphanedEntry] of existingByTxId.entries()) {
      if (!currentTxIdsWithAgent.has(orphanedTxId)) {
        await supabaseAdmin.from("ledger_manual_entries").delete().eq("id", orphanedEntry.id);
      }
    }

    // 5. Trigger live Google Sheets sync to Agent Ledger
    try {
      await syncAgentLedgersLiveInternal();
    } catch (syncErr) {
      console.warn("[airline-to-agent-ledger] Google Sheet sync failed:", syncErr);
    }

    return { processed: transactions.length, linked: linkedCount };
  } catch (err) {
    console.warn("[airline-to-agent-ledger] syncAirlineTransactionsToAgentLedgers error:", err);
    return { processed: 0, linked: 0 };
  }
}

export const listAgentLedgersAdmin = createServerFn({ method: "GET" }).handler(async () => {
  await requireUnlocked();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  
  const { data: agents, error: agentsError } = await supabaseAdmin
    .from("agents")
    .select("user_id, agency_name, contact_person, cell_number, country_code, user_code")
    .neq("status", "rejected");
  
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
