import crypto from "crypto";
import { triggerLiveAccountsSync } from "@/lib/accounts-book.functions";

/**
 * Deterministic RFC 4122 v5 UUID for counter-sale records, derived from the
 * airline transaction id so every sync is idempotent (same id every time).
 */
function counterSaleUuid(txId: string, seed: string): string {
  const hash = crypto.createHash("sha1").update(seed + txId).digest("hex");
  return [
    hash.substring(0, 8),
    hash.substring(8, 12),
    "5" + hash.substring(13, 16),
    ((parseInt(hash.substring(16, 18), 16) & 0x3f) | 0x80).toString(16) + hash.substring(18, 20),
    hash.substring(20, 32),
  ].join("-");
}

// The owner's own counter sales: agent "Abdul Razzaq" in Airline Accounts.
const SELF_AGENT = "abdul razzaq";
const COUNTER_SALES_CATEGORY = "Counter Sales";

/**
 * Post self-agent (Abdul Razzaq) airline counter sales into Accounts Book:
 *
 * 1. A revenue record in Sales Accounts > "Counter Sales" carrying the full
 *    Ticket Sales value, the supplier cost (for profit) and the passenger's
 *    remaining balance in the details.
 * 2. A cash receipt on the selected "Received Via" account for ONLY the money
 *    actually received — the remaining balance is collected later and those
 *    payments are added to the ledger manually, never auto-posted.
 *
 * The revenue record is a sale record, not a cash movement, so every cash view
 * (bank/wallet statements, cash book, cash balance) excludes it by source_type
 * and shows only the receipt. Everything is idempotent per transaction id.
 */
export async function syncAirlineCounterSalesToSalesAccounts(
  transactions: any[],
  airlines: any[] = []
): Promise<{ processed: number; linked: number; updated: number; removed: number }> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1. Make sure the "Counter Sales" category exists so the Sales Accounts tab
    //    and its Google Sheet tab have a home for these records.
    const { data: services } = await supabaseAdmin
      .from("accounts_book_services")
      .select("id, name");
    const hasCategory = (services ?? []).some((s: any) =>
      String(s.name ?? "").trim().toLowerCase() === COUNTER_SALES_CATEGORY.toLowerCase());
    if (!hasCategory) {
      await supabaseAdmin.from("accounts_book_services").insert({ name: COUNTER_SALES_CATEGORY });
    }

    // 2. Payment accounts: the received-via account carries the cash receipt;
    //    with no account selected the workspace cash account is a neutral
    //    metadata fallback for the revenue record (never a cash movement).
    const { data: accounts, error: accErr } = await supabaseAdmin
      .from("accounts_book_accounts")
      .select("id, name, kind, is_active")
      .eq("is_active", true);
    if (accErr || !accounts || accounts.length === 0) {
      console.warn("[airline-counter-sales] No active accounts found:", accErr?.message);
      return { processed: 0, linked: 0, updated: 0, removed: 0 };
    }
    const accountById = new Map<string, any>();
    const accountByName = new Map<string, any>();
    for (const acc of accounts) {
      accountById.set(acc.id, acc);
      accountByName.set(String(acc.name).toLowerCase().trim(), acc);
    }
    const cashAccount = accounts.find((a: any) => a.kind === "cash") ?? null;

    const airlineMap = new Map<string, string>();
    for (const a of airlines) {
      if (a.id) airlineMap.set(a.id, a.name || a.code || "Airline");
    }

    // 3. Existing counter-sale records (revenue + receipts) for idempotent updates.
    const { data: existingRows, error: existingErr } = await supabaseAdmin
      .from("accounts_book_transactions")
      .select("id, account_id, entry_date, entry_type, category, party, description, amount, direct_cost, direction, source_type, source_id, source_key")
      .in("source_type", ["airline_counter_sale", "airline_counter_receipt"]);
    if (existingErr) {
      console.warn("[airline-counter-sales] Could not read existing records:", existingErr.message);
      return { processed: 0, linked: 0, updated: 0, removed: 0 };
    }
    const existingBySourceId = new Map<string, any>();
    for (const e of existingRows ?? []) {
      if (e.source_id) existingBySourceId.set(String(e.source_id), e);
    }

    const desired = new Map<string, any>();
    let processed = 0;

    for (const tx of transactions) {
      const txId = String(tx.id || "");
      if (!txId) continue;
      const txType = String(tx.transaction_type || "Add Transaction").trim();
      if (txType === "Top Up" || txType === "Cancel/Refund") continue;
      if (String(tx.agent_name || "").trim().toLowerCase() !== SELF_AGENT) continue;

      const sales = Number(tx.ticket_sales) || 0;
      if (sales <= 0) continue;
      processed++;

      const airlineName = airlineMap.get(tx.airline_id) || "Airline";
      const entryDate = tx.date ? String(tx.date).slice(0, 10) : new Date().toISOString().slice(0, 10);
      const agentName = String(tx.agent_name).trim();
      const receivedRaw = tx.agent_received;
      const received = receivedRaw === null || receivedRaw === undefined || String(receivedRaw).trim() === ""
        ? 0
        : (Number(receivedRaw) || 0);
      const remaining = Math.max(sales - received, 0);
      const cost = Math.max(Number(tx.credit_from_id) || 0, 0);

      // Resolve the received-via account for the cash receipt.
      let receiptAccount: any = null;
      const viaId = tx.received_via_account_id ? String(tx.received_via_account_id).trim() : null;
      const viaName = tx.received_via ? String(tx.received_via).trim() : null;
      if (viaId && accountById.has(viaId)) receiptAccount = accountById.get(viaId);
      else if (viaName && accountByName.has(viaName.toLowerCase())) receiptAccount = accountByName.get(viaName.toLowerCase());

      // Revenue record: the full ticket sale in Sales Accounts > Counter Sales,
      // with all details (pax, PNR, sector, contact, Ticket Sales, Remaining).
      const saleSourceId = counterSaleUuid(txId, "rohi-airline-counter-sale:");
      const saleAccount = receiptAccount ?? cashAccount;
      if (saleAccount) {
        const visible = [
          tx.pax_name ? `Pax: ${tx.pax_name}` : "",
          tx.pnr ? `PNR: ${tx.pnr}` : "",
          tx.sector ? String(tx.sector) : "",
          `Ticket Sales: ${sales} PKR`,
          `Passenger Remaining: ${remaining} PKR`,
        ].filter(Boolean).join(" • ");
        const meta: Record<string, string> = { agent: agentName, vendor: airlineName };
        if (tx.pax_name) meta.pax = String(tx.pax_name);
        if (tx.pax_contact) meta.contact = String(tx.pax_contact);
        const description = `${visible} [[SALE_META:${JSON.stringify(meta)}]]`;

        desired.set(saleSourceId, {
          account_id: saleAccount.id,
          entry_date: entryDate,
          entry_type: "sale",
          category: COUNTER_SALES_CATEGORY,
          party: agentName,
          description,
          amount: sales,
          direct_cost: cost,
          direction: "in",
          source_type: "airline_counter_sale",
          source_id: saleSourceId,
          source_key: `airline_counter_sale:${txId}`,
        });
      }

      // Cash receipt: only the money actually received, on the chosen account.
      if (receiptAccount && received > 0) {
        const receiptSourceId = counterSaleUuid(txId, "rohi-airline-counter-receipt:");
        const receiptDescription = `Airline Ticket (${airlineName}) - ${tx.pax_name || "Pax"}${tx.pnr ? ` • PNR: ${tx.pnr}` : ""}${tx.sector ? ` • ${tx.sector}` : ""} • Agent: ${agentName} • Received: ${received} PKR`;
        desired.set(receiptSourceId, {
          account_id: receiptAccount.id,
          entry_date: entryDate,
          entry_type: "manual",
          category: receiptAccount.kind === "cash" ? "Cash Book" : "Bank Ledger",
          party: agentName,
          description: receiptDescription,
          amount: received,
          direct_cost: 0,
          direction: "in",
          source_type: "airline_counter_receipt",
          source_id: receiptSourceId,
          source_key: `airline_counter_receipt:${txId}:${receiptAccount.id}:in`,
        });
      }
    }

    let linked = 0;
    let updated = 0;
    let removed = 0;

    for (const [sourceId, payload] of desired) {
      const existing = existingBySourceId.get(sourceId);
      const needsUpdate = !existing ||
        existing.account_id !== payload.account_id ||
        existing.entry_date !== payload.entry_date ||
        existing.entry_type !== payload.entry_type ||
        existing.category !== payload.category ||
        existing.party !== payload.party ||
        existing.description !== payload.description ||
        Number(existing.amount) !== payload.amount ||
        Number(existing.direct_cost) !== payload.direct_cost ||
        existing.direction !== payload.direction ||
        existing.source_key !== payload.source_key;
      if (existing && !needsUpdate) continue;
      if (existing) {
        const { error: upErr } = await supabaseAdmin
          .from("accounts_book_transactions")
          .update(payload)
          .eq("id", existing.id);
        if (upErr) {
          const fallback: any = { ...payload };
          delete fallback.source_key;
          await supabaseAdmin.from("accounts_book_transactions").update(fallback).eq("id", existing.id);
        }
        updated++;
      } else {
        const { error: insErr } = await supabaseAdmin
          .from("accounts_book_transactions")
          .insert(payload);
        if (insErr) {
          const fallback: any = { ...payload };
          delete fallback.source_key;
          await supabaseAdmin.from("accounts_book_transactions").insert(fallback);
        }
        linked++;
      }
    }

    // Records whose transaction no longer qualifies (agent changed, became a
    // refund/top-up, deleted, or the received amount dropped to zero) are removed.
    for (const [sourceId, existingRow] of existingBySourceId) {
      if (!desired.has(sourceId)) {
        await supabaseAdmin.from("accounts_book_transactions").delete().eq("id", existingRow.id);
        removed++;
      }
    }

    if (linked || updated || removed) {
      try {
        // Awaited (not queued): a detached background promise can be terminated by
      // the serverless runtime after the response, silently skipping the
      // Banks/Wallets, Daily Cash and Sales Accounts sheet writes. Waiting
      // here keeps the mirror write inside the request, like the other sync
      // steps in the airline save flow.
      await triggerLiveAccountsSync(true, ["banks", "cash", "sales"]);
      } catch (syncErr) {
        console.warn("[airline-counter-sales] Live sheet sync failed:", syncErr);
      }
    }

    return { processed, linked, updated, removed };
  } catch (err) {
    console.warn("[airline-counter-sales] sync error:", err);
    return { processed: 0, linked: 0, updated: 0, removed: 0 };
  }
}
