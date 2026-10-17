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
 * Updates Balances Overview and individual agent party tabs (direct entries per agent)
 * using the professional Rohi Warm Clay export standard (voucher & airline style).
 */
export async function syncMasterLedger(data: any[], _allTransactions?: any[]) {
  const spreadsheet = await ensureMasterLedgerSheet();
  const spreadsheetId = spreadsheet.id;

  // The Description column mirrors the website's "Ledger Entry" text for
  // airline-linked rows: "Pax - Sector - PNR - Airline Code", composed exactly
  // as the Airline Accounts page composes it. Only rows carrying a valid
  // "Ref: AIRLINE-TX-<id>" link are rewritten; bookings, manual entries, and
  // vendor rows keep their existing details text. The details text stored in
  // Supabase is never modified — this is presentation only in the mirror.
  const airlineEntryById = new Map<string, string>();
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [txRes, airlineRes] = await Promise.all([
      (supabaseAdmin as any)
        .from("airline_ledger_transactions")
        .select("id, pax_name, pnr, sector, airline_id"),
      (supabaseAdmin as any)
        .from("airline_ledger_airlines")
        .select("id, code, name"),
    ]);
    if (txRes.error) throw new Error(txRes.error.message);
    if (airlineRes.error) throw new Error(airlineRes.error.message);
    const codeById = new Map<string, string>();
    for (const a of airlineRes.data ?? []) {
      const label = String(a.code || "").trim() || String(a.name || "").trim();
      if (a.id && label) codeById.set(String(a.id), label);
    }
    for (const t of txRes.data ?? []) {
      const id = String(t.id || "");
      if (!id) continue;
      const entry = [t.pax_name, t.sector, t.pnr, codeById.get(String(t.airline_id || ""))]
        .map((v: any) => String(v || "").trim())
        .filter(Boolean)
        .join(" - ");
      airlineEntryById.set(id, entry);
    }
  } catch (enrichErr) {
    console.warn("[ledger-sync] Could not load airline transactions for Ledger Entry text:", enrichErr);
  }

  const airlineRefOf = (details: any): string | null => {
    const m = String(details || "").match(/Ref:\s*AIRLINE-TX-([^\s•]+)/);
    return m && m[1] ? m[1] : null;
  };
  const ledgerEntryFor = (details: any): string | null => {
    const ref = airlineRefOf(details);
    return ref ? (airlineEntryById.get(ref) ?? null) : null;
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

  // 2. Update individual party tabs (direct entries — each agent's own tab is
  // the single mirror of their statement, with no separate journal tab).

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

    const ledgerHeaders = ["Date", "Description", "Debit (PKR)", "Credit (PKR)", "Balance (PKR)"];
    const agentValues: unknown[][] = [
      ["ROHI INTERNATIONAL TRAVELS"],
      ["Sardar Market, Shahi Road, Rahim Yar Khan  •  0305-6622988"],
      [`${agent.agency_name.toUpperCase()}`],
      [`Current Outstanding Balance: Rs ${Number(agent.balance || 0).toLocaleString()}  •  ${(agent.ledger || []).length} entries`],
      ledgerHeaders,
    ];

    let agentDebits = 0;
    let agentCredits = 0;

    for (const l of agent.ledger || []) {
      const rawDate = l.date ? String(l.date).slice(0, 10) : "—";
      const d = Number(l.debit) || 0;
      const c = Number(l.credit) || 0;
      agentDebits += d;
      agentCredits += c;

      // Airline-linked rows show the website's Ledger Entry text; everything
      // else keeps its stored details text.
      const description = ledgerEntryFor(l.details) ?? String(l.details || "—");

      agentValues.push([
        rawDate,
        description,
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
          numericColumnIndexes: [2, 3, 4],
          dateColumnIndexes: [0],
          hasTotalRow: true,
          totalRowIndex: agentValues.length - 1,
        });
      } catch (fmtErr) {
        console.warn(`[ledger-sync] Error formatting agent sheet "${tabName}":`, fmtErr);
      }
    }
  }

  // 3. Prune tabs for deleted/unregistered parties and obsolete system tabs.
  // CRITICAL REQUIREMENT: Preserve all vendor data and tabs — no vendor sheets may ever be deleted.
  const protectedTabs = new Set([
    "Balances Overview",
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
