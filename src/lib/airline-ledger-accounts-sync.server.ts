import crypto from "crypto";
import { triggerLiveAccountsSync } from "@/lib/accounts-book.functions";

/**
 * Generate a deterministic RFC 4122 v5 UUID from an arbitrary airline transaction ID.
 * This guarantees idempotent linkage into PostgreSQL uuid columns without format errors.
 */
export function deterministicAirlineTxUuid(txId: string): string {
  const hash = crypto.createHash("sha1").update("rohi-airline-tx:" + txId).digest("hex");
  return [
    hash.substring(0, 8),
    hash.substring(8, 12),
    "5" + hash.substring(13, 16),
    ((parseInt(hash.substring(16, 18), 16) & 0x3f) | 0x80).toString(16) + hash.substring(18, 20),
    hash.substring(20, 32),
  ].join("-");
}

/**
 * Synchronize airline ticket sale receipts into Accounts Book and Daily Cash Book.
 * Top-up transactions are strictly excluded (they represent outgoing portal balance top-ups).
 * All ticket receipts with a designated "Received Via" account are idempotently written
 * or updated, while deleted or unlinked ticket receipts are safely reversed without orphans.
 */
export async function syncAirlineTransactionsToAccountsBook(
  transactions: any[],
  airlines: any[] = []
): Promise<{ processed: number; linked: number; updated: number; removed: number }> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1. Fetch active payment accounts (cash, bank, wallet)
    const { data: accounts, error: accErr } = await supabaseAdmin
      .from("accounts_book_accounts")
      .select("id, name, kind, is_active")
      .eq("is_active", true);

    if (accErr || !accounts || accounts.length === 0) {
      console.warn("[airline-accounts-sync] No active accounts found in accounts_book_accounts:", accErr?.message);
      return { processed: 0, linked: 0, updated: 0, removed: 0 };
    }

    const accountById = new Map<string, any>();
    const accountByName = new Map<string, any>();
    for (const acc of accounts) {
      accountById.set(acc.id, acc);
      accountByName.set(acc.name.toLowerCase().trim(), acc);
    }

    // 2. Fetch airline map for rich descriptions
    const airlineMap = new Map<string, string>();
    for (const a of airlines) {
      if (a.id) airlineMap.set(a.id, a.name || a.code || "Airline");
    }

    // 3. Fetch existing airline ticket entries in accounts_book_transactions
    const { data: existingEntries, error: existingErr } = await supabaseAdmin
      .from("accounts_book_transactions")
      .select("id, account_id, entry_date, entry_type, category, party, description, amount, direct_cost, direction, source_type, source_id, source_key")
      .eq("source_type", "airline_ticket");

    if (existingErr) {
      console.warn("[airline-accounts-sync] Could not read existing airline entries:", existingErr.message);
      return { processed: 0, linked: 0, updated: 0, removed: 0 };
    }

    const existingBySourceId = new Map<string, any>();
    for (const e of existingEntries || []) {
      if (e.source_id) {
        existingBySourceId.set(String(e.source_id), e);
      }
    }

    let linkedCount = 0;
    let updatedCount = 0;
    const activeDesiredSourceIds = new Set<string>();

    // 4. Iterate over current transactions
    for (const tx of transactions) {
      const txId = String(tx.id || "");
      if (!txId) continue;

      // Top Up is strictly outgoing top-up to the airline portal balance. Never a ticket receipt.
      const txType = String(tx.transaction_type || "Add Transaction").trim();
      if (txType === "Top Up") continue;

      const receivedViaAccountId = tx.received_via_account_id ? String(tx.received_via_account_id).trim() : null;
      const receivedVia = tx.received_via ? String(tx.received_via).trim() : null;

      // Find matched account
      let matchedAccount: any = null;
      if (receivedViaAccountId && accountById.has(receivedViaAccountId)) {
        matchedAccount = accountById.get(receivedViaAccountId);
      } else if (receivedVia && accountByName.has(receivedVia.toLowerCase())) {
        matchedAccount = accountByName.get(receivedVia.toLowerCase());
      }

      // If no payment account selected, this ticket is on credit / receivable only.
      if (!matchedAccount) continue;

      const sales = Number(tx.ticket_sales) || 0;
      const cost = Number(tx.credit_from_id) || 0;
      if (sales === 0 && !tx.pnr) continue;

      const isRefund = txType === "Cancel/Refund" || sales < 0;

      // Self-agent (Abdul Razzaq) counter sales are handled by the counter-sales
      // sync: the sale becomes a Counter Sales revenue record and only the money
      // actually received posts to the payment account. Skip here so the full
      // sale amount is never posted as a cash receipt.
      if (!isRefund && String(tx.agent_name || "").trim().toLowerCase() === "abdul razzaq") continue;

      const sourceId = deterministicAirlineTxUuid(txId);
      activeDesiredSourceIds.add(sourceId);

      const direction = isRefund ? "out" : "in";
      const amount = Math.abs(sales);
      const directCost = Math.max(cost, 0);
      const entryDate = tx.date ? String(tx.date).slice(0, 10) : new Date().toISOString().slice(0, 10);
      const airlineName = airlineMap.get(tx.airline_id) || "Airline";
      const party = tx.agent_name ? `${tx.agent_name}${tx.pax_name ? ` (${tx.pax_name})` : ""}` : (tx.pax_name || "Airline Ticket");
      const description = `Airline Ticket (${airlineName}) - ${tx.pax_name || "Pax"}${tx.pnr ? ` • PNR: ${tx.pnr}` : ""}${tx.sector ? ` • ${tx.sector}` : ""}${tx.agent_name ? ` • Agent: ${tx.agent_name}` : ""}`;
      const sourceKey = `airline_ticket:${txId}:${matchedAccount.id}:${direction}`;

      const existing = existingBySourceId.get(sourceId);

      if (existing) {
        // Check if anything changed
        const needsUpdate =
          existing.account_id !== matchedAccount.id ||
          existing.entry_date !== entryDate ||
          Number(existing.amount) !== amount ||
          Number(existing.direct_cost) !== directCost ||
          existing.direction !== direction ||
          existing.description !== description ||
          existing.party !== party;

        if (needsUpdate) {
          const updatePayload: any = {
            account_id: matchedAccount.id,
            entry_date: entryDate,
            entry_type: "sale",
            category: "Air Ticket",
            party,
            description,
            amount,
            direct_cost: directCost,
            direction,
            source_type: "airline_ticket",
            source_id: sourceId,
            source_key: sourceKey,
          };

          const { error: upErr } = await supabaseAdmin
            .from("accounts_book_transactions")
            .update(updatePayload)
            .eq("id", existing.id);

          if (upErr) {
            // Fallback without source_key if column not in cache
            delete updatePayload.source_key;
            await supabaseAdmin
              .from("accounts_book_transactions")
              .update(updatePayload)
              .eq("id", existing.id);
          }
          updatedCount++;
        }
      } else {
        // Insert new double-entry receipt
        const insertPayload: any = {
          account_id: matchedAccount.id,
          entry_date: entryDate,
          entry_type: "sale",
          category: "Air Ticket",
          party,
          description,
          amount,
          direct_cost: directCost,
          direction,
          source_type: "airline_ticket",
          source_id: sourceId,
          source_key: sourceKey,
        };

        const { error: insErr } = await supabaseAdmin
          .from("accounts_book_transactions")
          .insert(insertPayload);

        if (insErr) {
          // Fallback without source_key if column not in cache
          delete insertPayload.source_key;
          await supabaseAdmin
            .from("accounts_book_transactions")
            .insert(insertPayload);
        }
        linkedCount++;
      }
    }

    // 5. Clean up any orphaned receipts (e.g., ticket deleted or payment method unlinked)
    let removedCount = 0;
    for (const [existingSourceId, existingRow] of existingBySourceId.entries()) {
      if (!activeDesiredSourceIds.has(existingSourceId)) {
        await supabaseAdmin
          .from("accounts_book_transactions")
          .delete()
          .eq("id", existingRow.id);
        removedCount++;
      }
    }

    // 6. Trigger live Google Sheets sync if any changes occurred
    if (linkedCount > 0 || updatedCount > 0 || removedCount > 0) {
      try {
        // Awaited (not queued): the serverless runtime can terminate a detached
      // background promise as soon as this response returns, which silently
      // skipped the Google Sheet write for the Banks/Wallets and Daily Cash
      // tabs. Waiting here keeps the mirror write inside the request, exactly
      // like the other airline ledger sync steps.
      await triggerLiveAccountsSync(true, ["banks", "cash", "sales"]);
      } catch (sheetSyncErr) {
        console.warn("[airline-accounts-sync] Live accounts sheet sync failed:", sheetSyncErr);
      }
    }

    return {
      processed: transactions.length,
      linked: linkedCount,
      updated: updatedCount,
      removed: removedCount,
    };
  } catch (err) {
    console.warn("[airline-accounts-sync] Unexpected error in syncAirlineTransactionsToAccountsBook:", err);
    return { processed: 0, linked: 0, updated: 0, removed: 0 };
  }
}
