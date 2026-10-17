// Google Sheets connector specifically for Master Ledger Accounts.
// SERVER ONLY — never import from browser code.
import {
  addSheet,
  applyRohiExportFormatting,
  clearSheet,
  colLetter,
  deleteSheet,
  getSpreadsheet,
  quoteSheet,
  writeRange,
} from "./sheets.server";

export const MASTER_LEDGER_TITLE = "ROHI INTERNATIONAL TRAVELS MASTER LEDGER ACCOUNTS";

// Always the one designated "Agent Ledger Accounts" spreadsheet — never a self-created one.
const DESIGNATED_SHEET_ID = "1pjhTq_QSxMkOeWOjvJdxQOJZvWrc5Qspsbmuh4oiTxo";

export async function ensureMasterLedgerSheet(): Promise<{ id: string; url: string }> {
  const id = DESIGNATED_SHEET_ID;
  return { id, url: `https://docs.google.com/spreadsheets/d/${id}/edit` };
}

/** 
 * Syncs ledger data to the master sheet.
 * Updates Balances Overview, Agent_Transactions, and individual agent tabs
 * using the professional Rohi Warm Clay export standard (voucher & airline style).
 */
export async function syncMasterLedger(data: any[], allTransactions?: any[]) {
  const spreadsheet = await ensureMasterLedgerSheet();
  const spreadsheetId = spreadsheet.id;

  // Passenger receivable reporting (Ticket Sales / Received / Passenger
  // Remaining) is derived only from the authoritative airline transactions in
  // Supabase. A row is enriched only when its ledger line carries a valid
  // "Ref: AIRLINE-TX-<id>" link to a committed airline transaction; rows from
  // bookings, manual entries, or vendors stay untouched.
  const airlineTxById = new Map<string, { sales: number; recv: number | ""; rem: number | "" }>();
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: airlineTx, error: airlineTxErr } = await (supabaseAdmin as any)
      .from("airline_ledger_transactions")
      .select("id, ticket_sales, agent_received");
    if (airlineTxErr) throw new Error(airlineTxErr.message);
    for (const t of airlineTx ?? []) {
      const id = String(t.id || "");
      if (!id) continue;
      const sales = Number(t.ticket_sales) || 0;
      const rawRecv = t.agent_received;
      const recv = rawRecv === "" || rawRecv === null || rawRecv === undefined
        ? "" as const
        : (Number(rawRecv) || 0);
      const rem = recv === "" ? "" as const : sales - recv;
      airlineTxById.set(id, { sales, recv, rem });
    }
  } catch (enrichErr) {
    console.warn("[ledger-sync] Could not load airline transactions for passenger columns:", enrichErr);
  }

  const airlineRefOf = (details: any): string | null => {
    const m = String(details || "").match(/Ref:\s*AIRLINE-TX-([^\s•]+)/);
    return m && m[1] ? m[1] : null;
  };
  const emptyPax = { sales: "", recv: "", rem: "" } as const;
  const paxColsFor = (details: any) => {
    const ref = airlineRefOf(details);
    const tx = ref ? airlineTxById.get(ref) : null;
    if (!tx) return emptyPax;
    return { sales: tx.sales, recv: tx.recv, rem: tx.rem };
  };
  
  const info = await getSpreadsheet(spreadsheetId);
  const existingSheets = new Map<string, number>(
    (info.sheets ?? []).map((s: any) => [s.properties.title, s.properties.sheetId])
  );

  // 1. Update Balances Overview Sheet
  const overviewSheet = "Balances Overview";
  let overviewSheetId = existingSheets.get(overviewSheet) ?? null;
  if (overviewSheetId === null) {
    overviewSheetId = await addSheet(spreadsheetId, overviewSheet);
    if (overviewSheetId !== null) existingSheets.set(overviewSheet, overviewSheetId);
  }

  const overviewHeaders = [
    "Party Code",
    "Account / Party Name",
    "Type",
    "Contact Person",
    "Contact Phone",
    "Opening Balance (PKR)",
    "Total Debits (PKR)",
    "Total Credits (PKR)",
    "Outstanding Balance (PKR)",
    "Last Updated",
  ];

  const overviewValues: unknown[][] = [
    ["ROHI INTERNATIONAL TRAVELS"],
    ["Sardar Market, Shahi Road, Rahim Yar Khan  •  0305-6622988"],
    ["PARTY LEDGER ACCOUNTS - BALANCES OVERVIEW"],
    [`Official Live Record • ${data.length} registered accounts • Generated ${new Date().toISOString().slice(0, 10)}`],
    overviewHeaders,
  ];

  let sumOpening = 0;
  let sumDebits = 0;
  let sumCredits = 0;
  let sumBalance = 0;

  for (const a of data) {
    const opening = Number(a.opening_balance) || 0;
    const debits = Number(a.total_debits) || 0;
    const credits = Number(a.total_credits) || 0;
    const balance = Number(a.balance) || 0;

    sumOpening += opening;
    sumDebits += debits;
    sumCredits += credits;
    sumBalance += balance;

    overviewValues.push([
      String(a.user_code || "—").trim(),
      String(a.agency_name || "").trim(),
      String(a.party_type || "Agent").trim(),
      String(a.contact_person || "").trim(),
      String(a.contact || "").trim(),
      opening,
      debits,
      credits,
      balance,
      new Date().toISOString().slice(0, 10),
    ]);
  }

  // Grand Totals Row
  overviewValues.push([
    "TOTALS",
    `Grand Total (${data.length} Accounts)`,
    "—",
    "—",
    "—",
    sumOpening,
    sumDebits,
    sumCredits,
    sumBalance,
    new Date().toISOString().slice(0, 10),
  ]);

  await clearSheet(spreadsheetId, overviewSheet);
  await writeRange(
    spreadsheetId,
    `${quoteSheet(overviewSheet)}!A1:${colLetter(overviewHeaders.length - 1)}${overviewValues.length}`,
    overviewValues
  );

  if (overviewSheetId !== null) {
    try {
      await applyRohiExportFormatting(spreadsheetId, overviewSheetId, {
        columnCount: overviewHeaders.length,
        dataEndRow: overviewValues.length,
        numericColumnIndexes: [4, 5, 6, 7],
        hasTotalRow: true,
        totalRowIndex: overviewValues.length - 1,
      });
    } catch (fmtErr) {
      console.warn("[ledger-sync] Error applying formatting to Balances Overview:", fmtErr);
    }
  }

  // 2. Update Agent_Transactions Sheet
  const txSheet = "Agent_Transactions";
  let txSheetId = existingSheets.get(txSheet) ?? null;
  if (txSheetId === null) {
    txSheetId = await addSheet(spreadsheetId, txSheet);
    if (txSheetId !== null) existingSheets.set(txSheet, txSheetId);
  }

  // Compile transactions across all agents if not passed directly
  let txList = allTransactions ?? [];
  if (!allTransactions || allTransactions.length === 0) {
    txList = [];
    for (const a of data) {
      for (const row of a.ledger || []) {
        txList.push({
          tx_id: row.id,
          date: row.date,
          agent_name: a.agency_name,
          details: row.details,
          debit: row.debit,
          credit: row.credit,
          balance: row.balance,
        });
      }
    }
    txList.sort((x, y) => new Date(x.date).getTime() - new Date(y.date).getTime());
  }

  const txHeaders = [
    "Tx ID",
    "Date",
    "Agent Name",
    "PNR",
    "Type",
    "Ticket Sales (PKR)",
    "Received (PKR)",
    "Passenger Remaining (PKR)",
    "Debit (PKR)",
    "Credit (PKR)",
    "Balance (PKR)",
    "Description",
  ];

  const txValues: unknown[][] = [
    ["ROHI INTERNATIONAL TRAVELS"],
    ["Sardar Market, Shahi Road, Rahim Yar Khan  •  0305-6622988"],
    ["AGENT LEDGER ACCOUNTS - AGENT TRANSACTIONS JOURNAL"],
    [`Official Live Record • ${txList.length} journal entries across all agencies`],
    txHeaders,
  ];

  for (const t of txList) {
    const rawDate = t.date ? String(t.date).slice(0, 10) : "—";
    const pnrMatch = String(t.details || "").match(/PNR[:\s]+([A-Z0-9]+)/i);
    const pnr = pnrMatch ? pnrMatch[1] : "—";
    const type = (Number(t.debit) || 0) > 0 ? "Booking / Debit" : "Payment / Credit";
    const paxCols = paxColsFor(t.details);
    txValues.push([
      String(t.tx_id || "—").slice(0, 18),
      rawDate,
      String(t.agent_name || "—"),
      pnr,
      type,
      paxCols.sales,
      paxCols.recv,
      paxCols.rem,
      Number(t.debit) || 0,
      Number(t.credit) || 0,
      Number(t.balance) || 0,
      String(t.details || "—"),
    ]);
  }

  await clearSheet(spreadsheetId, txSheet);
  await writeRange(
    spreadsheetId,
    `${quoteSheet(txSheet)}!A1:${colLetter(txHeaders.length - 1)}${txValues.length}`,
    txValues
  );

  if (txSheetId !== null) {
    try {
      await applyRohiExportFormatting(spreadsheetId, txSheetId, {
        columnCount: txHeaders.length,
        dataEndRow: txValues.length,
        numericColumnIndexes: [5, 6, 7, 8, 9, 10],
        dateColumnIndexes: [1],
      });
    } catch (fmtErr) {
      console.warn("[ledger-sync] Error applying formatting to Agent_Transactions:", fmtErr);
    }
  }

  // 3. Update individual party tabs
  for (const agent of data) {
    const tabName = (agent.agency_name || "Account")
      .replace(/[\[\]\*\?:\/\\]/g, "_")
      .slice(0, 30)
      .trim();
    let tabSheetId = existingSheets.get(tabName) ?? null;
    if (tabSheetId === null) {
      tabSheetId = await addSheet(spreadsheetId, tabName);
      if (tabSheetId !== null) existingSheets.set(tabName, tabSheetId);
    }

    const ledgerHeaders = ["Date", "Details / Particulars", "Ticket Sales (PKR)", "Received (PKR)", "Passenger Remaining (PKR)", "Debit (PKR)", "Credit (PKR)", "Balance (PKR)"];
    const agentValues: unknown[][] = [
      ["ROHI INTERNATIONAL TRAVELS"],
      ["Sardar Market, Shahi Road, Rahim Yar Khan  •  0305-6622988"],
      [`PARTY STATEMENT - ${agent.agency_name.toUpperCase()}${agent.party_type ? ` (${agent.party_type.toUpperCase()})` : ""}`],
      [`Current Outstanding Balance: Rs ${Number(agent.balance || 0).toLocaleString()}  •  ${(agent.ledger || []).length} entries`],
      ledgerHeaders,
    ];

    let agentDebits = 0;
    let agentCredits = 0;
    let totalSales = 0;
    let totalRecv = 0;
    let totalRem = 0;
    let hasPaxCols = false;

    for (const l of agent.ledger || []) {
      const rawDate = l.date ? String(l.date).slice(0, 10) : "—";
      const d = Number(l.debit) || 0;
      const c = Number(l.credit) || 0;
      agentDebits += d;
      agentCredits += c;

      const paxCols = paxColsFor(l.details);
      if (typeof paxCols.sales === "number") {
        hasPaxCols = true;
        totalSales += paxCols.sales;
        if (typeof paxCols.recv === "number") totalRecv += paxCols.recv;
        if (typeof paxCols.rem === "number") totalRem += paxCols.rem;
      }

      agentValues.push([
        rawDate,
        String(l.details || "—"),
        paxCols.sales,
        paxCols.recv,
        paxCols.rem,
        d,
        c,
        Number(l.balance) || 0,
      ]);
    }

    // Totals row. Passenger totals are shown only when at least one row is a
    // linked airline transaction, so manual-only statements stay clean.
    agentValues.push([
      "TOTALS",
      "Statement Summary",
      hasPaxCols ? totalSales : "",
      hasPaxCols ? totalRecv : "",
      hasPaxCols ? totalRem : "",
      agentDebits,
      agentCredits,
      Number(agent.balance) || 0,
    ]);

    await clearSheet(spreadsheetId, tabName);
    await writeRange(
      spreadsheetId,
      `${quoteSheet(tabName)}!A1:${colLetter(ledgerHeaders.length - 1)}${agentValues.length}`,
      agentValues
    );

    if (tabSheetId !== null) {
      try {
        await applyRohiExportFormatting(spreadsheetId, tabSheetId, {
          columnCount: ledgerHeaders.length,
          dataEndRow: agentValues.length,
          numericColumnIndexes: [2, 3, 4, 5, 6, 7],
          dateColumnIndexes: [0],
          hasTotalRow: true,
          totalRowIndex: agentValues.length - 1,
        });
      } catch (fmtErr) {
        console.warn(`[ledger-sync] Error formatting agent sheet "${tabName}":`, fmtErr);
      }
    }
  }

  // 4. Prune tabs for deleted/unregistered parties and obsolete system tabs.
  // CRITICAL REQUIREMENT: Preserve all vendor data and tabs — no vendor sheets may ever be deleted.
  const protectedTabs = new Set([
    "Balances Overview",
    "Agent_Transactions",
    "README",
    "_DATA",
  ]);

  let vendorTabNames = new Set<string>();
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: dbVendors } = await (supabaseAdmin as any).from("vendors").select("name, vendor_code");
    if (dbVendors) {
      for (const v of dbVendors) {
        if (v.name) vendorTabNames.add(v.name.replace(/[\[\]\*\?:\/\\]/g, "_").slice(0, 30).trim().toLowerCase());
        if (v.vendor_code) vendorTabNames.add(v.vendor_code.replace(/[\[\]\*\?:\/\\]/g, "_").slice(0, 30).trim().toLowerCase());
      }
    }
  } catch (vErr) {
    console.warn("[ledger-sync] Could not read vendors for tab protection:", vErr);
  }

  const activePartyTabNames = new Set(
    data.map((a: any) =>
      (a.agency_name || "Account")
        .replace(/[\[\]\*\?:\/\\]/g, "_")
        .slice(0, 30)
        .trim()
        .toLowerCase()
    )
  );

  for (const [sheetTitle, sheetId] of existingSheets.entries()) {
    const lowerTitle = sheetTitle.toLowerCase().trim();
    if (protectedTabs.has(sheetTitle) || protectedTabs.has(lowerTitle)) continue;
    // Strict preservation of vendor tabs: never delete any tab associated with a vendor
    if (/vendor|supplier/i.test(sheetTitle) || vendorTabNames.has(lowerTitle)) continue;

    if (!activePartyTabNames.has(lowerTitle)) {
      try {
        console.info(`[ledger-sync] Deleting removed/obsolete tab: "${sheetTitle}" (sheetId: ${sheetId})`);
        await deleteSheet(spreadsheetId, sheetId);
      } catch (delErr) {
        console.warn(`[ledger-sync] Could not delete orphaned sheet "${sheetTitle}":`, delErr);
      }
    }
  }
  
  return spreadsheet;
}
