// Google Sheets connector specifically for Master Ledger Accounts.
// SERVER ONLY — never import from browser code.
import {
  addSheet,
  appendRows,
  applyBrandFormatting,
  batchWrite,
  clearSheet,
  colLetter,
  createSpreadsheet,
  getSpreadsheet,
  quoteSheet,
  readRange,
  writeRange,
} from "./sheets.server";

/** Best-effort brand styling — a formatting failure must never fail a data sync. */
async function tryFormat(spreadsheetId: string, sheetId: number | null, columnCount: number) {
  if (sheetId === null) return;
  try {
    await applyBrandFormatting(spreadsheetId, sheetId, { headerRowIndex: 0, columnCount });
  } catch (err) {
    console.error("[ledger-sync] brand formatting skipped:", err instanceof Error ? err.message : err);
  }
}
import { sheetNameFor } from "./engine.server";

export const MASTER_LEDGER_TITLE = "ROHI INTERNATIONAL TRAVELS MASTER LEDGER ACCOUNTS";

type Admin = Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];

async function admin(): Promise<Admin> {
  const mod = await import("@/integrations/supabase/client.server");
  return mod.supabaseAdmin;
}

async function getSetting(key: string): Promise<string | null> {
  const db = await admin();
  const { data } = await db.from("backup_settings").select("value").eq("key", key).maybeSingle();
  return data?.value ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  const db = await admin();
  await db.from("backup_settings").upsert({ key, value, updated_at: new Date().toISOString() });
}

// Always the one designated "Agent Ledger Accounts" spreadsheet — never a self-created one.
const DESIGNATED_SHEET_ID = "1pjhTq_QSxMkOeWOjvJdxQOJZvWrc5Qspsbmuh4oiTxo";

export async function ensureMasterLedgerSheet(): Promise<{ id: string; url: string }> {
  const id = DESIGNATED_SHEET_ID;
  return { id, url: `https://docs.google.com/spreadsheets/d/${id}/edit` };
}

/** 
 * Syncs ledger data to the master sheet.
 * We'll create one sheet per agent or a single combined sheet.
 * The user mentioned "not to create multiple sheets", so we'll use one master sheet.
 */
export async function syncMasterLedger(data: any[]) {
    const spreadsheet = await ensureMasterLedgerSheet();
    const spreadsheetId = spreadsheet.id;
    
    const info = await getSpreadsheet(spreadsheetId);
    const existingSheets = new Map<string, number>((info.sheets ?? []).map((s: any) => [s.properties.title, s.properties.sheetId]));

    // 1. Update Overview Sheet
    const overviewSheet = "Balances Overview";
    let overviewSheetId = existingSheets.get(overviewSheet) ?? null;
    if (overviewSheetId === null) {
        overviewSheetId = await addSheet(spreadsheetId, overviewSheet);
        if (overviewSheetId !== null) existingSheets.set(overviewSheet, overviewSheetId);
    }

    const headers = ["Agent Code", "Agency Name", "Contact Person", "Contact Phone", "Outstanding Balance", "Last Updated"];
    const rows = data.map(a => [
        a.user_code || "—",
        a.agency_name,
        a.contact_person,
        a.contact,
        a.balance,
        new Date().toISOString()
    ]);
    
    await clearSheet(spreadsheetId, overviewSheet);
    await writeRange(spreadsheetId, `${quoteSheet(overviewSheet)}!A1:${colLetter(headers.length - 1)}1`, [headers]);
    await appendRows(spreadsheetId, overviewSheet, rows);
    await tryFormat(spreadsheetId, overviewSheetId, headers.length);

    // 2. Update individual agent tabs
    for (const agent of data) {
        const tabName = agent.agency_name.slice(0, 30); // Google Sheets limit
        let tabSheetId = existingSheets.get(tabName) ?? null;
        if (tabSheetId === null) {
            tabSheetId = await addSheet(spreadsheetId, tabName);
            if (tabSheetId !== null) existingSheets.set(tabName, tabSheetId);
        }

        const ledgerHeaders = ["Date", "Details", "Debit", "Credit", "Balance"];
        const ledgerRows = (agent.ledger || []).map((l: any) => [
            new Date(l.date).toLocaleDateString("en-GB").replace(/\//g, "-"),
            l.details,
            l.debit,
            l.credit,
            l.balance
        ]);
        
        await clearSheet(spreadsheetId, tabName);
        await writeRange(spreadsheetId, `${quoteSheet(tabName)}!A1:${colLetter(ledgerHeaders.length - 1)}1`, [ledgerHeaders]);
        if (ledgerRows.length > 0) {
            await appendRows(spreadsheetId, tabName, ledgerRows);
        }
        await tryFormat(spreadsheetId, tabSheetId, ledgerHeaders.length);
    }
    
    return spreadsheet;
}
