// Google Sheets connector specifically for Master Ledger Accounts.
// SERVER ONLY — never import from browser code.
import {
  addSheet,
  batchUpdateSpreadsheet,
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

// Rohi Warm Clay Brand Palette
const BRAND_ACCENT = { red: 217 / 255, green: 119 / 255, blue: 87 / 255 }; // #D97757
const BRAND_DARK = { red: 20 / 255, green: 20 / 255, blue: 19 / 255 };     // #141413
const BRAND_CREAM = { red: 250 / 255, green: 249 / 255, blue: 245 / 255 }; // #FAF9F5
const BRAND_WHITE = { red: 1.0, green: 1.0, blue: 1.0 };

async function applyRohiExportFormat(
  spreadsheetId: string,
  sheetId: number,
  totalRows: number,
  columnCount: number,
  currencyColIndexes: number[] = []
) {
  const requests: any[] = [
    // Banner row 1
    {
      repeatCell: {
        range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: columnCount },
        cell: {
          userEnteredFormat: {
            backgroundColor: BRAND_ACCENT,
            horizontalAlignment: "CENTER",
            verticalAlignment: "MIDDLE",
            textFormat: { bold: true, fontSize: 13, foregroundColor: BRAND_WHITE },
          },
        },
        fields: "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)",
      },
    },
    // Header row 5 (Column Titles)
    {
      repeatCell: {
        range: { sheetId, startRowIndex: 4, endRowIndex: 5, startColumnIndex: 0, endColumnIndex: columnCount },
        cell: {
          userEnteredFormat: {
            backgroundColor: BRAND_DARK,
            horizontalAlignment: "CENTER",
            verticalAlignment: "MIDDLE",
            textFormat: { bold: true, fontSize: 10, foregroundColor: BRAND_WHITE },
          },
        },
        fields: "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)",
      },
    },
    // Alternating rows / cream background
    {
      repeatCell: {
        range: { sheetId, startRowIndex: 5, endRowIndex: Math.max(totalRows, 6), startColumnIndex: 0, endColumnIndex: columnCount },
        cell: {
          userEnteredFormat: {
            backgroundColor: BRAND_CREAM,
            textFormat: { fontSize: 9.5 },
            verticalAlignment: "MIDDLE",
          },
        },
        fields: "userEnteredFormat(backgroundColor,textFormat,verticalAlignment)",
      },
    },
    // Freeze top 5 rows
    {
      updateSheetProperties: {
        properties: {
          sheetId,
          gridProperties: { frozenRowCount: 5 },
        },
        fields: "gridProperties.frozenRowCount",
      },
    },
  ];

  for (const cIdx of currencyColIndexes) {
    requests.push({
      repeatCell: {
        range: { sheetId, startRowIndex: 5, endRowIndex: Math.max(totalRows, 6), startColumnIndex: cIdx, endColumnIndex: cIdx + 1 },
        cell: {
          userEnteredFormat: {
            numberFormat: { type: "NUMBER", pattern: "#,##0.00" },
            horizontalAlignment: "RIGHT",
          },
        },
        fields: "userEnteredFormat(numberFormat,horizontalAlignment)",
      },
    });
  }

  try {
    await batchUpdateSpreadsheet(spreadsheetId, requests);
  } catch (err) {
    console.warn("[ledger-sync] format warning for sheet " + sheetId + ":", err);
  }
}

/** 
 * Syncs ledger data to the master sheet.
 * Updates Balances Overview, Agent_Transactions, and individual agent tabs.
 */
export async function syncMasterLedger(data: any[], allTransactions?: any[]) {
  const spreadsheet = await ensureMasterLedgerSheet();
  const spreadsheetId = spreadsheet.id;
  
  const info = await getSpreadsheet(spreadsheetId);
  const existingSheets = new Map<string, number>((info.sheets ?? []).map((s: any) => [s.properties.title, s.properties.sheetId]));

  // 1. Update Balances Overview Sheet
  const overviewSheet = "Balances Overview";
  let overviewSheetId = existingSheets.get(overviewSheet) ?? null;
  if (overviewSheetId === null) {
    overviewSheetId = await addSheet(spreadsheetId, overviewSheet);
    if (overviewSheetId !== null) existingSheets.set(overviewSheet, overviewSheetId);
  }

  const overviewHeaders = ["Agent Code", "Agency Name", "Contact Person", "Contact Phone", "Outstanding Balance", "Last Updated"];
  const overviewValues: unknown[][] = [
    ["ROHI INTERNATIONAL TRAVELS"],
    ["Sardar Market, Shahi Road, Rahim Yar Khan  •  0305-6622988"],
    ["AGENT LEDGER ACCOUNTS - BALANCES OVERVIEW"],
    [`Official Live Record • ${data.length} registered agents`],
    overviewHeaders,
  ];

  for (const a of data) {
    overviewValues.push([
      String(a.user_code || "—").trim(),
      String(a.agency_name || "").trim(),
      String(a.contact_person || "").trim(),
      String(a.contact || "").trim(),
      Number(a.balance) || 0,
      new Date().toISOString().slice(0, 10),
    ]);
  }

  await clearSheet(spreadsheetId, overviewSheet);
  await writeRange(spreadsheetId, `${quoteSheet(overviewSheet)}!A1:${colLetter(overviewHeaders.length - 1)}${overviewValues.length}`, overviewValues);
  if (overviewSheetId !== null) {
    await applyRohiExportFormat(spreadsheetId, overviewSheetId, overviewValues.length, overviewHeaders.length, [4]);
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

  const txHeaders = ["Tx ID", "Date", "Agent Name", "PNR", "Type", "Debit (PKR)", "Credit (PKR)", "Balance (PKR)", "Description", "Slip Ref"];
  const txValues: unknown[][] = [
    ["ROHI INTERNATIONAL TRAVELS"],
    ["Sardar Market, Shahi Road, Rahim Yar Khan  •  0305-6622988"],
    ["AGENT LEDGER ACCOUNTS - AGENT TRANSACTIONS"],
    [`Official Live Record • ${txList.length} entries`],
    txHeaders,
  ];

  for (const t of txList) {
    const rawDate = t.date ? new Date(t.date).toLocaleDateString("en-GB").replace(/\//g, "-") : "—";
    const pnrMatch = String(t.details || "").match(/PNR[:\s]+([A-Z0-9]+)/i);
    const pnr = pnrMatch ? pnrMatch[1] : "—";
    const type = (Number(t.debit) || 0) > 0 ? "Booking / Debit" : "Payment / Credit";
    txValues.push([
      String(t.tx_id || "—").slice(0, 18),
      rawDate,
      String(t.agent_name || "—"),
      pnr,
      type,
      Number(t.debit) || 0,
      Number(t.credit) || 0,
      Number(t.balance) || 0,
      String(t.details || "—"),
      "—",
    ]);
  }

  await clearSheet(spreadsheetId, txSheet);
  await writeRange(spreadsheetId, `${quoteSheet(txSheet)}!A1:${colLetter(txHeaders.length - 1)}${txValues.length}`, txValues);
  if (txSheetId !== null) {
    await applyRohiExportFormat(spreadsheetId, txSheetId, txValues.length, txHeaders.length, [5, 6, 7]);
  }

  // 3. Update individual agent tabs
  for (const agent of data) {
    const tabName = agent.agency_name.slice(0, 30);
    let tabSheetId = existingSheets.get(tabName) ?? null;
    if (tabSheetId === null) {
      tabSheetId = await addSheet(spreadsheetId, tabName);
      if (tabSheetId !== null) existingSheets.set(tabName, tabSheetId);
    }

    const ledgerHeaders = ["Date", "Details", "Debit (PKR)", "Credit (PKR)", "Balance (PKR)"];
    const agentValues: unknown[][] = [
      ["ROHI INTERNATIONAL TRAVELS"],
      ["Sardar Market, Shahi Road, Rahim Yar Khan  •  0305-6622988"],
      [`AGENT STATEMENT - ${agent.agency_name.toUpperCase()}`],
      [`Current Outstanding Balance: Rs ${Number(agent.balance || 0).toLocaleString()}  •  ${(agent.ledger || []).length} entries`],
      ledgerHeaders,
    ];

    for (const l of agent.ledger || []) {
      const rawDate = l.date ? new Date(l.date).toLocaleDateString("en-GB").replace(/\//g, "-") : "—";
      agentValues.push([
        rawDate,
        String(l.details || "—"),
        Number(l.debit) || 0,
        Number(l.credit) || 0,
        Number(l.balance) || 0,
      ]);
    }

    await clearSheet(spreadsheetId, tabName);
    await writeRange(spreadsheetId, `${quoteSheet(tabName)}!A1:${colLetter(ledgerHeaders.length - 1)}${agentValues.length}`, agentValues);
    if (tabSheetId !== null) {
      await applyRohiExportFormat(spreadsheetId, tabSheetId, agentValues.length, ledgerHeaders.length, [2, 3, 4]);
    }
  }

  // 4. Prune tabs for deleted agents (protected system tabs are preserved)
  const protectedTabs = new Set([
    "Balances Overview",
    "Agent_Transactions",
    "Agent_Directory",
    "README",
    "_DATA",
  ]);
  const activeAgentTabNames = new Set(
    data.map((a: any) => String(a.agency_name || "").slice(0, 30).trim().toLowerCase())
  );

  for (const [sheetTitle, sheetId] of existingSheets.entries()) {
    if (protectedTabs.has(sheetTitle)) continue;
    if (!activeAgentTabNames.has(sheetTitle.toLowerCase().trim())) {
      try {
        console.info(`[ledger-sync] Deleting removed agent tab: "${sheetTitle}" (sheetId: ${sheetId})`);
        await deleteSheet(spreadsheetId, sheetId);
      } catch (delErr) {
        console.warn(`[ledger-sync] Could not delete orphaned sheet "${sheetTitle}":`, delErr);
      }
    }
  }
  
  return spreadsheet;
}
