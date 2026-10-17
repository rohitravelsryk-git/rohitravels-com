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
 * Builds the unified party ledgers (combining agents, suppliers, and dual-role partners)
 * into a single unified Debit/Credit accounting model.
 */
export async function getUnifiedPartyLedgers(supabaseAdmin: any): Promise<{
  masterData: any[];
  allTransactions: any[];
}> {
  // 1. Fetch registered agents (excluding rejected)
  const { data: agents, error: agentsError } = await supabaseAdmin
    .from("agents")
    .select("user_id, agency_name, contact_person, cell_number, country_code, user_code, created_at, status")
    .neq("status", "rejected")
    .order("agency_name", { ascending: true });

  if (agentsError) throw new Error(agentsError.message);

  // 2. Fetch registered vendors/suppliers
  const { data: vendors } = await supabaseAdmin
    .from("vendors")
    .select("id, vendor_code, name, category, contact_person, phone, email, city, opening_balance, current_balance, is_active")
    .order("name", { ascending: true });

  // 3. Batch load bookings, agent manual entries, and vendor ledger entries
  const { data: allBookings } = await supabaseAdmin
    .from("agent_bookings")
    .select("id, agent_user_id, created_at, seats, fare_on_demand, fare_snapshot, payment_status, status, passenger_names")
    .eq("status", "confirmed")
    .order("created_at", { ascending: true });

  const { data: allManualEntries } = await supabaseAdmin
    .from("ledger_manual_entries")
    .select("*")
    .order("date", { ascending: true });

  const { data: allVendorLedger } = await (supabaseAdmin as any)
    .from("vendor_ledger")
    .select("*")
    .order("transaction_date", { ascending: true });

  // Index maps
  const bookingsByAgent = new Map<string, any[]>();
  for (const b of allBookings ?? []) {
    if (!b.agent_user_id) continue;
    const list = bookingsByAgent.get(b.agent_user_id) || [];
    list.push(b);
    bookingsByAgent.set(b.agent_user_id, list);
  }

  const manualByAgent = new Map<string, any[]>();
  for (const m of allManualEntries ?? []) {
    if (!m.agent_user_id) continue;
    const list = manualByAgent.get(m.agent_user_id) || [];
    list.push(m);
    manualByAgent.set(m.agent_user_id, list);
  }

  const vendorTxByVendorId = new Map<string, any[]>();
  for (const vtx of allVendorLedger ?? []) {
    if (!vtx.vendor_id) continue;
    const list = vendorTxByVendorId.get(vtx.vendor_id) || [];
    list.push(vtx);
    vendorTxByVendorId.set(vtx.vendor_id, list);
  }

  const masterData: any[] = [];
  const allTransactions: any[] = [];
  const processedVendorIds = new Set<string>();

  // Process Agents (and link any matching vendor account into the single ledger)
  for (const agent of agents ?? []) {
    const bookings = bookingsByAgent.get(agent.user_id) || [];
    const manualEntries = manualByAgent.get(agent.user_id) || [];

    // Check if an existing vendor matches this agent by name or phone
    const matchedVendor = (vendors ?? []).find((v: any) => {
      const vName = (v.name || "").toLowerCase().trim();
      const aName = (agent.agency_name || "").toLowerCase().trim();
      return vName && aName && (vName === aName || (v.phone && agent.cell_number && v.phone.replace(/\D/g, "") === agent.cell_number.replace(/\D/g, "")));
    });

    let vendorTxs: any[] = [];
    if (matchedVendor) {
      processedVendorIds.add(matchedVendor.id);
      vendorTxs = vendorTxByVendorId.get(matchedVendor.id) || [];
    }

    // Determine opening balance
    let openingBalance = Number((agent as any).opening_balance) || 0;
    if (openingBalance === 0 && matchedVendor) {
      openingBalance = Number(matchedVendor.opening_balance) || 0;
    }

    const regularManualEntries: any[] = [];
    for (const m of manualEntries) {
      const isOp = (m.details || "").toLowerCase().trim().startsWith("opening balance") || (m.details || "").toLowerCase().trim() === "opening";
      if (isOp && openingBalance === 0) {
        openingBalance = (Number(m.debit) || 0) - (Number(m.credit) || 0);
      } else {
        regularManualEntries.push(m);
      }
    }

    let balance = openingBalance;
    let totalDebits = openingBalance > 0 ? openingBalance : 0;
    let totalCredits = openingBalance < 0 ? Math.abs(openingBalance) : 0;
    const ledgerRows: any[] = [];

    if (openingBalance !== 0) {
      ledgerRows.push({
        id: `opening-${agent.user_id}`,
        date: agent.created_at || new Date().toISOString(),
        details: "Opening Balance",
        debit: openingBalance > 0 ? openingBalance : 0,
        credit: openingBalance < 0 ? Math.abs(openingBalance) : 0,
        balance: openingBalance,
        isManual: false,
        isOpening: true,
      });
    }

    const combined = [
      ...bookings.map((b: any) => ({ type: "booking" as const, ...b })),
      ...regularManualEntries.map((m: any) => ({ type: "manual" as const, ...m, created_at: m.date })),
      ...vendorTxs.map((v: any) => ({
        type: "vendor" as const,
        id: v.id,
        created_at: v.transaction_date || v.created_at,
        date: v.transaction_date || v.created_at,
        details: v.description || v.reference_no || "Purchase / Service",
        debit: Number(v.debit) || 0,
        credit: Number(v.credit) || 0,
      })),
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
        debit = Number(item.debit) || 0;
        credit = Number(item.credit) || 0;
        details = item.details;
        date = item.date || item.created_at;
      }

      balance += debit - credit;
      totalDebits += debit;
      totalCredits += credit;

      ledgerRows.push({
        id,
        date,
        details,
        debit,
        credit,
        balance,
        isManual: item.type !== "booking",
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

    masterData.push({
      ...agent,
      opening_balance: openingBalance,
      total_debits: totalDebits,
      total_credits: totalCredits,
      balance,
      contact: `${agent.country_code || ""} ${agent.cell_number || ""}`.trim(),
      party_type: matchedVendor ? "Agent & Supplier (Dual Role)" : "Agent",
      ledger: ledgerRows,
    });
  }

  // Process standalone Vendors/Suppliers that do not have an agent account
  for (const vendor of vendors ?? []) {
    if (processedVendorIds.has(vendor.id)) continue;

    const vendorTxs = vendorTxByVendorId.get(vendor.id) || [];
    let openingBalance = Number(vendor.opening_balance) || 0;
    let balance = openingBalance;
    let totalDebits = openingBalance > 0 ? openingBalance : 0;
    let totalCredits = openingBalance < 0 ? Math.abs(openingBalance) : 0;
    const ledgerRows: any[] = [];

    if (openingBalance !== 0) {
      ledgerRows.push({
        id: `opening-vnd-${vendor.id}`,
        date: vendor.created_at || new Date().toISOString(),
        details: "Opening Balance",
        debit: openingBalance > 0 ? openingBalance : 0,
        credit: openingBalance < 0 ? Math.abs(openingBalance) : 0,
        balance: openingBalance,
        isManual: false,
        isOpening: true,
      });
    }

    const sortedTxs = [...vendorTxs].sort(
      (a, b) => new Date(a.transaction_date).getTime() - new Date(b.transaction_date).getTime()
    );

    for (const v of sortedTxs) {
      const debit = Number(v.debit) || 0;
      const credit = Number(v.credit) || 0;
      balance += debit - credit;
      totalDebits += debit;
      totalCredits += credit;

      ledgerRows.push({
        id: v.id,
        date: v.transaction_date,
        details: v.description || v.reference_no || "Purchase / Service",
        debit,
        credit,
        balance,
        isManual: true,
      });

      allTransactions.push({
        tx_id: v.id,
        date: v.transaction_date,
        agent_name: vendor.name,
        details: v.description || v.reference_no || "Purchase / Service",
        debit,
        credit,
        balance,
      });
    }

    masterData.push({
      user_id: vendor.id,
      agency_name: vendor.name,
      contact_person: vendor.contact_person || vendor.name,
      cell_number: vendor.phone || "",
      country_code: "",
      user_code: vendor.vendor_code || "VND",
      created_at: vendor.created_at,
      opening_balance: openingBalance,
      total_debits: totalDebits,
      total_credits: totalCredits,
      balance,
      contact: vendor.phone || "—",
      party_type: "Supplier / Vendor",
      ledger: ledgerRows,
    });
  }

  // Sort masterData alphabetically by agency/company name
  masterData.sort((a, b) => (a.agency_name || "").localeCompare(b.agency_name || ""));

  return { masterData, allTransactions };
}

/**
 * Calculates live balances and ledger entries for all registered parties,
 * and updates Google Sheets (Balances Overview and individual party tabs — direct entries per agent).
 */
// Bounded wait for network/Sheet work: after the deadline the caller is
// released while the original promise keeps running in the background, so a
// slow backfill or Sheet rebuild can delay a page load but never hang it.
function withBackgroundTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timeout after ${ms}ms`)), ms);
    promise.then(
      (v) => { clearTimeout(t); resolve(v); },
      (e) => { clearTimeout(t); reject(e); },
    );
  });
}

export async function syncAgentLedgersLiveInternal(): Promise<{ status: "success" | "failed"; count: number; error?: string }> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { masterData, allTransactions } = await getUnifiedPartyLedgers(supabaseAdmin);
    if (masterData.length === 0) return { status: "success", count: 0 };

    const { syncMasterLedger } = await import("./backup/ledger-sync.server");
    await syncMasterLedger(masterData, allTransactions);

    return { status: "success", count: masterData.length };
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
  airlines: any[] = [],
  options?: { onlyTxIds?: string[] }
): Promise<{ processed: number; linked: number; errors: string[]; partyNames?: string[] }> {
  const errors: string[] = [];
  // Scoped mode (Add Record save path): post ONLY these transactions instead of
  // re-running the whole history, and mirror only the affected party tabs.
  // The unscoped full sync remains the reconcile/backfill path.
  const scopeSet = options?.onlyTxIds?.length ? new Set(options.onlyTxIds.map(String)) : null;
  const touchedPartyNames: string[] = [];
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: allAgents, error: agentsError } = await supabaseAdmin
      .from("agents")
      .select("user_id, agency_name, contact_person, cell_number, country_code, user_code");

    if (agentsError || !allAgents || allAgents.length === 0) {
      console.warn("[airline-to-agent-ledger] No registered agents found in database:", agentsError?.message);
      return { processed: 0, linked: 0, errors: [agentsError?.message || "no registered agents found in database"] };
    }

    const airlineMap = new Map<string, string>();
    for (const a of airlines) {
      if (a.id) airlineMap.set(a.id, a.name || a.code || "Airline");
    }

    const [ticketEntriesRes, receiptEntriesRes] = await Promise.all([
      supabaseAdmin
        .from("ledger_manual_entries")
        .select("id, details, debit, credit, date, agent_user_id")
        .ilike("details", "%Ref: AIRLINE-TX-%"),
      supabaseAdmin
        .from("ledger_manual_entries")
        .select("id, details, debit, credit, date, agent_user_id")
        .ilike("details", "%Ref: AIRLINE-RCV-%"),
    ]);
    const existingAirlineEntries = ticketEntriesRes.data;
    if (ticketEntriesRes.error || receiptEntriesRes.error) {
      console.warn(
        "[airline-to-agent-ledger] Could not read existing airline postings:",
        ticketEntriesRes.error?.message || receiptEntriesRes.error?.message,
      );
    }

    const existingByTxId = new Map<string, any>();
    for (const entry of existingAirlineEntries || []) {
      const match = String(entry.details || "").match(/Ref:\s*AIRLINE-TX-([^\s•]+)/);
      if (match && match[1]) {
        existingByTxId.set(match[1], entry);
      }
    }

    // Receipt postings ("Jazz Cash Received" style) carry their own link tag
    // (Ref: AIRLINE-RCV-<txId>) so they never collide with the ticket posting
    // of the same transaction. One transaction still drives both entries.
    const existingRcvByTxId = new Map<string, any>();
    const rcvExtrasByTxId = new Map<string, any[]>();
    for (const entry of receiptEntriesRes.data || []) {
      const match = String(entry.details || "").match(/Ref:\s*AIRLINE-RCV-([^\s•]+)/);
      if (match && match[1]) {
        const txKey = match[1];
        if (existingRcvByTxId.has(txKey)) {
          const extras = rcvExtrasByTxId.get(txKey) || [];
          extras.push(entry);
          rcvExtrasByTxId.set(txKey, extras);
        } else {
          existingRcvByTxId.set(txKey, entry);
        }
      }
    }

    let linkedCount = 0;
    const currentTxIdsWithAgent = new Set<string>();

    for (const tx of (scopeSet ? transactions.filter((t: any) => scopeSet.has(String(t.id))) : transactions)) {
      const rawAgent = String(tx.agent_name || "").trim();
      const ticketSales = Number(tx.ticket_sales) || 0;
      const transactionType = String(tx.transaction_type || "").trim().toLowerCase();
      // Refunds and top-ups affect the airline account only. They must never
      // create/update an automatic Agent Ledger entry; those are manual-only.
      const isRefundOrTopUp = transactionType === "cancel/refund" ||
        transactionType === "refund" || transactionType === "top up";
      const isAgentSale = !isRefundOrTopUp &&
        Boolean(rawAgent && rawAgent !== "—" && (ticketSales !== 0 || tx.pnr));

      if (!isAgentSale) {
        // Remove a previously auto-created agent entry if this transaction was
        // changed to a refund/top-up. Never touch manually entered ledger rows.
        if (isRefundOrTopUp) {
          const txId = String(tx.id || "");
          const existing = txId ? existingByTxId.get(txId) : null;
          if (existing) {
            if (scopeSet) {
              const ownerAgent = allAgents.find((a: any) => String(a.user_id) === String(existing.agent_user_id));
              if (ownerAgent) touchedPartyNames.push(String(ownerAgent.agency_name || ownerAgent.user_id || "").trim());
            }
            await supabaseAdmin.from("ledger_manual_entries").delete().eq("id", existing.id);
            existingByTxId.delete(txId);
          }
          const staleRcv = txId ? existingRcvByTxId.get(txId) : null;
          if (staleRcv) {
            await supabaseAdmin.from("ledger_manual_entries").delete().eq("id", staleRcv.id);
            existingRcvByTxId.delete(txId);
          }
        }
        continue;
      }

      const txId = String(tx.id || "");
      if (!txId) continue;
      currentTxIdsWithAgent.add(txId);

      const q = rawAgent.toLowerCase();
      let matchedAgent = allAgents.find((a: any) => {
        const agency = (a.agency_name || "").toLowerCase().trim();
        const contact = (a.contact_person || "").toLowerCase().trim();
        const code = (a.user_code || "").toLowerCase().trim();
        return agency === q || contact === q || code === q;
      }) || allAgents.find((a: any) => {
        const agency = (a.agency_name || "").toLowerCase().trim();
        const contact = (a.contact_person || "").toLowerCase().trim();
        return agency.includes(q) || q.includes(agency) || (contact && (contact.includes(q) || q.includes(contact)));
      });

      // Self counter sales: agent "Abdul Razzaq" books tickets at his own
      // counter, so he may not exist as a separately registered B2B agent.
      // Post those sales to the Rohi office agent account (the same fallback
      // the Pax Contact field uses) so the entry still lands in Ledger
      // Accounts instead of being silently dropped.
      if (!matchedAgent && q === "abdul razzaq") {
        matchedAgent = allAgents.find((a: any) => /rohi/i.test(String(a.agency_name ?? "")));
      }

      if (!matchedAgent) {
        const msg = `Transaction ${txId}: agent "${rawAgent}" not found in registered agents — ledger posting skipped.`;
        console.warn(`[airline-to-agent-ledger] ${msg}`);
        errors.push(msg);
        continue;
      }
      if (scopeSet) touchedPartyNames.push(String(matchedAgent.agency_name || matchedAgent.user_id || "").trim());

      const airlineName = airlineMap.get(tx.airline_id) || "Airline";
      // The agent ledger sale amount must include VOID Charges as part of the
      // total ticket value. Keep the source fields separate in Airline Accounts;
      // only the linked ledger posting uses their sum.
      const voidCharges = Number(tx.void_charges) || 0;
      const ledgerSalesAmount = ticketSales + voidCharges;
      const isRefund = String(tx.transaction_type || "").trim().toLowerCase() === "cancel/refund" || ledgerSalesAmount < 0;
      const debit = isRefund ? 0 : Math.max(ledgerSalesAmount, 0);
      const credit = isRefund ? Math.abs(ledgerSalesAmount) : 0;
      const date = tx.date ? new Date(tx.date).toISOString() : new Date().toISOString();

      const details = `Airline Ticket (${airlineName}) - ${tx.pax_name || "Pax"}${tx.pnr ? ` • PNR: ${tx.pnr}` : ""}${tx.sector ? ` • ${tx.sector}` : ""}${tx.transaction_type && tx.transaction_type !== "Add Transaction" ? ` • ${tx.transaction_type}` : ""} • Ref: AIRLINE-TX-${txId}`;

      let ticketInserted = false;
      const existing = existingByTxId.get(txId);
      if (existing) {
        if (
          existing.agent_user_id !== matchedAgent.user_id ||
          Number(existing.debit) !== debit ||
          Number(existing.credit) !== credit ||
          existing.details !== details
        ) {
          const upd = await supabaseAdmin
            .from("ledger_manual_entries")
            .update({
              agent_user_id: matchedAgent.user_id,
              date,
              details,
              debit,
              credit,
            })
            .eq("id", existing.id)
            .select("id");
          if (upd.error) {
            const msg = `Transaction ${txId}: updating ledger entry failed — ${upd.error.message}`;
            console.warn(`[airline-to-agent-ledger] ${msg}`);
            errors.push(msg);
          }
        }
        existingByTxId.delete(txId);
      } else {
        ticketInserted = true;
        const ins = await supabaseAdmin
          .from("ledger_manual_entries")
          .insert({
            agent_user_id: matchedAgent.user_id,
            date,
            details,
            debit,
            credit,
          })
          .select("id");
        if (ins.error) {
          const msg = `Transaction ${txId}: inserting ledger entry failed — ${ins.error.message}`;
          console.warn(`[airline-to-agent-ledger] ${msg}`);
          errors.push(msg);
        }
      }

      // Receipt posting: when the agent actually paid part of the ticket at
      // save time (Received Via selected and an amount received), the agent
      // ledger gets a SECOND, separately linked entry so the statement reads
      // as two clear lines — the ticket sale (Debit) and the payment received
      // (Credit, e.g. "Jazz Cash Received"). The transaction itself remains a
      // single atomic record in Supabase; both lines are derived and stay
      // idempotently linked, so edits, deletions and reconciles keep them in
      // step without duplicates or orphans.
      const agentReceived = Math.max(Number(tx.agent_received) || 0, 0);
      const receivedVia = String(tx.received_via || "").trim();
      const wantsReceipt =
        !isRefund && agentReceived > 0 && receivedVia.length > 0 && receivedVia.toLowerCase() !== "none";
      const receiptDetails = `${receivedVia} Received - ${tx.pax_name || "Pax"} • Rs ${agentReceived.toLocaleString("en-US")} • Ref: AIRLINE-RCV-${txId}`;

      const existingRcv = existingRcvByTxId.get(txId);
      if (wantsReceipt) {
        if (existingRcv && !ticketInserted) {
          if (
            existingRcv.agent_user_id !== matchedAgent.user_id ||
            Number(existingRcv.debit) !== 0 ||
            Number(existingRcv.credit) !== agentReceived ||
            existingRcv.details !== receiptDetails
          ) {
            const updRcv = await supabaseAdmin
              .from("ledger_manual_entries")
              .update({
                agent_user_id: matchedAgent.user_id,
                date,
                details: receiptDetails,
                debit: 0,
                credit: agentReceived,
              })
              .eq("id", existingRcv.id)
              .select("id");
            if (updRcv.error) {
              const msg = `Transaction ${txId}: updating receipt ledger entry failed — ${updRcv.error.message}`;
              console.warn(`[airline-to-agent-ledger] ${msg}`);
              errors.push(msg);
            }
          }
        } else {
          // A freshly inserted ticket line must stay FIRST in the statement:
          // drop any stale receipt line so the new one is created after the
          // ticket line and sorts after it by creation time.
          if (existingRcv) {
            await supabaseAdmin.from("ledger_manual_entries").delete().eq("id", existingRcv.id);
          }
          const insRcv = await supabaseAdmin
            .from("ledger_manual_entries")
            .insert({
              agent_user_id: matchedAgent.user_id,
              date,
              details: receiptDetails,
              debit: 0,
              credit: agentReceived,
            })
            .select("id");
          if (insRcv.error) {
            const msg = `Transaction ${txId}: inserting receipt ledger entry failed — ${insRcv.error.message}`;
            console.warn(`[airline-to-agent-ledger] ${msg}`);
            errors.push(msg);
          }
        }
      } else if (existingRcv) {
        // Received amount or Received Via was cleared on edit: the receipt
        // line must disappear so the statement never shows a stale payment.
        const delRcv = await supabaseAdmin.from("ledger_manual_entries").delete().eq("id", existingRcv.id);
        if (delRcv.error) {
          const msg = `Transaction ${txId}: removing stale receipt ledger entry failed — ${delRcv.error.message}`;
          console.warn(`[airline-to-agent-ledger] ${msg}`);
          errors.push(msg);
        }
      }
      // Prune duplicate receipt lines left behind by older bugs.
      for (const extra of rcvExtrasByTxId.get(txId) || []) {
        await supabaseAdmin.from("ledger_manual_entries").delete().eq("id", extra.id);
      }
      existingRcvByTxId.delete(txId);
      linkedCount++;
    }

    for (const [orphanedTxId, orphanedEntry] of existingByTxId.entries()) {
      // Scoped mode: only entries belonging to the scoped transactions may be
      // removed here — never touch the rest of the ledger history.
      if (scopeSet && !scopeSet.has(orphanedTxId)) continue;
      if (!currentTxIdsWithAgent.has(orphanedTxId)) {
        await supabaseAdmin.from("ledger_manual_entries").delete().eq("id", orphanedEntry.id);
      }
    }

    for (const [orphanedRcvTxId, orphanedRcvEntry] of existingRcvByTxId.entries()) {
      if (scopeSet && !scopeSet.has(orphanedRcvTxId)) continue;
      if (!currentTxIdsWithAgent.has(orphanedRcvTxId)) {
        await supabaseAdmin.from("ledger_manual_entries").delete().eq("id", orphanedRcvEntry.id);
      }
    }
    for (const extras of rcvExtrasByTxId.values()) {
      for (const extra of extras) {
        await supabaseAdmin.from("ledger_manual_entries").delete().eq("id", extra.id);
      }
    }

    // Scoped calls (save path) mirror ONLY Balances Overview + the affected
    // party tabs — a few Sheet writes instead of a full workbook rebuild, which
    // is what made the save wait exceed the 20s posting timeout.
    if (scopeSet && touchedPartyNames.length > 0) {
      try {
        const { syncAgentLedgerTabsNow } = await import("./backup/ledger-sync.server");
        const targeted = await withBackgroundTimeout(syncAgentLedgerTabsNow(touchedPartyNames), 30000);
        if (Number(targeted?.written ?? 0) > 0) {
          return { processed: transactions.length, linked: linkedCount, errors, partyNames: touchedPartyNames };
        }
        console.warn("[airline-to-agent-ledger] Targeted mirror matched no party tabs; falling back to full rebuild.");
      } catch (targetedErr) {
        console.warn("[airline-to-agent-ledger] Targeted Google Sheet sync failed, falling back to full rebuild:", targetedErr);
      }
    }

    try {
      await withBackgroundTimeout(syncAgentLedgersLiveInternal(), 90000);
    } catch (syncErr) {
      console.warn("[airline-to-agent-ledger] Google Sheet sync failed:", syncErr);
    }

    return { processed: transactions.length, linked: linkedCount, errors, partyNames: touchedPartyNames };
  } catch (err) {
    console.warn("[airline-to-agent-ledger] syncAirlineTransactionsToAgentLedgers error:", err);
    return { processed: 0, linked: 0, errors: [String(err instanceof Error ? err.message : err)] };
  }
}

/**
 * Self-healing reconcile for agent ledger postings: compares every committed
 * airline sale against the "Ref: AIRLINE-TX" links in ledger_manual_entries and
 * runs the idempotent posting sync when anything is missing or orphaned.
 * Never throws — failures are returned so pages can still load from committed data.
 */
export async function reconcileMissingAgentPostings(): Promise<{
  checked: number;
  missing: number;
  orphaned: number;
  linked: number;
  errors: string[];
}> {
  const errors: string[] = [];
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [txRes, entryRes, rcvEntryRes] = await Promise.all([
      (supabaseAdmin as any)
        .from("airline_ledger_transactions")
        .select("id, transaction_type, ticket_sales, pnr")
        .order("date", { ascending: true })
        .order("sort_order", { ascending: true }),
      (supabaseAdmin as any)
        .from("ledger_manual_entries")
        .select("id, details")
        .ilike("details", "%Ref: AIRLINE-TX-%"),
      (supabaseAdmin as any)
        .from("ledger_manual_entries")
        .select("id, details")
        .ilike("details", "%Ref: AIRLINE-RCV-%"),
    ]);
    if (txRes.error || entryRes.error || rcvEntryRes.error) {
      errors.push(txRes.error?.message || entryRes.error?.message || rcvEntryRes.error?.message || "reconcile check failed");
      return { checked: 0, missing: 0, orphaned: 0, linked: 0, errors };
    }

    // Receipt metadata (agent_received / received_via) only exists after
    // migration 20261016154500; skip receipt checks gracefully when absent.
    let receiptMeta: Map<string, { agent_received: any; received_via: any }> | null = null;
    try {
      const metaRes = await (supabaseAdmin as any)
        .from("airline_ledger_transactions")
        .select("id, agent_received, received_via");
      if (!metaRes.error) {
        receiptMeta = new Map<string, any>();
        for (const m of metaRes.data ?? []) {
          if (m?.id) receiptMeta.set(String(m.id), m);
        }
      }
    } catch {
      receiptMeta = null;
    }

    const txById = new Map<string, any>();
    for (const t of txRes.data ?? []) {
      if (t.id) txById.set(String(t.id), t);
    }
    const postedTxIds = new Set<string>();
    const orphanedEntries: any[] = [];
    for (const e of entryRes.data ?? []) {
      const m = String(e.details || "").match(/Ref:\s*AIRLINE-TX-([^\s•]+)/);
      if (!m || !m[1]) continue;
      if (txById.has(m[1])) postedTxIds.add(m[1]);
      else orphanedEntries.push(e);
    }
    const postedRcvTxIds = new Set<string>();
    const orphanedRcvEntries: any[] = [];
    for (const e of rcvEntryRes.data ?? []) {
      const m = String(e.details || "").match(/Ref:\s*AIRLINE-RCV-([^\s•]+)/);
      if (!m || !m[1]) continue;
      if (txById.has(m[1])) postedRcvTxIds.add(m[1]);
      else orphanedRcvEntries.push(e);
    }
    const missingSales = (txRes.data ?? []).filter((t: any) => {
      const type = String(t.transaction_type || "").trim().toLowerCase();
      const isRefundOrTopUp = type === "cancel/refund" || type === "refund" || type === "top up";
      if (isRefundOrTopUp) return false;
      const ticketSales = Number(t.ticket_sales) || 0;
      if (ticketSales === 0 && !t.pnr) return false;
      return !postedTxIds.has(String(t.id || ""));
    });
    const wantsReceiptFor = (t: any): boolean => {
      const type = String(t.transaction_type || "").trim().toLowerCase();
      if (type === "cancel/refund" || type === "refund" || type === "top up") return false;
      if (!receiptMeta) return false;
      const meta = receiptMeta.get(String(t.id || ""));
      const received = Math.max(Number(meta?.agent_received) || 0, 0);
      const via = String(meta?.received_via || "").trim();
      return received > 0 && via.length > 0 && via.toLowerCase() !== "none";
    };
    const missingReceipts = (txRes.data ?? []).filter(
      (t: any) => wantsReceiptFor(t) && !postedRcvTxIds.has(String(t.id || "")),
    );

    let linked = 0;
    if (missingSales.length > 0 || missingReceipts.length > 0 || orphanedEntries.length > 0 || orphanedRcvEntries.length > 0) {
      console.warn(
        `[agent-ledger] Reconciling agent ledger postings: ${missingSales.length} missing ticket, ${missingReceipts.length} missing receipt, ${orphanedEntries.length + orphanedRcvEntries.length} orphaned.`,
      );
      const airlinesRes = await (supabaseAdmin as any)
        .from("airline_ledger_airlines")
        .select("*")
        .order("sort_order", { ascending: true });
      if (!airlinesRes.error) {
        const syncResult = await withBackgroundTimeout(
          syncAirlineTransactionsToAgentLedgers(txRes.data ?? [], airlinesRes.data ?? []),
          120000,
        );
        linked = syncResult.linked ?? 0;
        if (syncResult.errors?.length) errors.push(...syncResult.errors);
      } else {
        errors.push(`airlines unavailable: ${airlinesRes.error.message}`);
        console.warn("[agent-ledger] Reconcile skipped, airlines unavailable:", airlinesRes.error.message);
      }
    }
    return {
      checked: txById.size,
      missing: missingSales.length + missingReceipts.length,
      orphaned: orphanedEntries.length + orphanedRcvEntries.length,
      linked,
      errors,
    };
  } catch (reconcileErr) {
    console.warn("[agent-ledger] Reconcile check failed (page still loads):", reconcileErr);
    errors.push(String(reconcileErr instanceof Error ? reconcileErr.message : reconcileErr));
    return { checked: 0, missing: 0, orphaned: 0, linked: 0, errors };
  }
}

let reconcileInFlight = false;

/**
 * Starts the self-healing reconcile without awaiting it, so page loads are
 * instant while the backfill continues in the background. A module-level
 * guard prevents concurrent loads from piling up duplicate reconciles.
 */
export function startAgentPostingReconcileDetached(): void {
  if (reconcileInFlight) return;
  reconcileInFlight = true;
  reconcileMissingAgentPostings()
    .then((result) => {
      if (result.errors && result.errors.length > 0) {
        console.warn("[agent-ledger] Background reconcile finished with errors:", result.errors);
      }
    })
    .catch((e) => {
      console.warn("[agent-ledger] Background reconcile failed:", e);
    })
    .finally(() => {
      reconcileInFlight = false;
    });
}

export const listAgentLedgersAdmin = createServerFn({ method: "GET" }).handler(async () => {
  await requireUnlocked();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  // Self-healing reconcile on page load: ensures every committed airline sale
  // has its agent-ledger posting. It starts detached so the page loads
  // instantly with committed data; the backfill continues in the background
  // and a refresh afterwards shows the completed result.
  startAgentPostingReconcileDetached();


  const { masterData } = await getUnifiedPartyLedgers(supabaseAdmin);
  return masterData;
});

export const syncAgentLedgersLiveAdmin = createServerFn({ method: "POST" }).handler(async () => {
  await requireUnlocked();
  return await syncAgentLedgersLiveInternal();
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

    // Check if this ID belongs to an agent or a vendor
    const { data: agent } = await supabaseAdmin
      .from("agents")
      .select("user_id")
      .eq("user_id", data.agent_user_id)
      .maybeSingle();

    if (agent) {
      const { error } = await supabaseAdmin.from("ledger_manual_entries").insert({
        agent_user_id: data.agent_user_id,
        date: data.date,
        details: data.details,
        debit: data.debit,
        credit: data.credit,
      });
      if (error) throw new Error(error.message);
    } else {
      // It's a vendor account
      const { error } = await (supabaseAdmin as any).from("vendor_ledger").insert({
        vendor_id: data.agent_user_id,
        transaction_date: data.date.slice(0, 10),
        reference_no: "MANUAL",
        description: data.details,
        debit: data.debit,
        credit: data.credit,
        balance: 0,
      });
      if (error) throw new Error(error.message);
    }

    // Instant live sync to designated Agent Ledger workbook
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

    // Try deleting from ledger_manual_entries first
    const { data: delAgent } = await supabaseAdmin
      .from("ledger_manual_entries")
      .delete()
      .eq("id", id)
      .select("id");

    if (!delAgent || delAgent.length === 0) {
      // If not in agent entries, delete from vendor_ledger
      await (supabaseAdmin as any).from("vendor_ledger").delete().eq("id", id);
    }

    // Instant live sync to designated Agent Ledger workbook
    try {
      await syncAgentLedgersLiveInternal();
    } catch (err) {
      console.warn("[agent-ledger] Sync after delete manual entry failed:", err);
    }
    return { success: true };
  });
