// Google Sheets connector specifically for Master Ledger Accounts.
// SERVER ONLY — never import from browser code.
import {
  addSheet,
  appendRows,
  batchWrite,
  clearSheet,
  colLetter,
  createSpreadsheet,
  getSpreadsheet,
  quoteSheet,
  readRange,
  writeRange,
} from "./sheets.server";
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

export async function ensureMasterLedgerSheet(): Promise<{ id: string; url: string }> {
  const existing = await getSetting("master_ledger_spreadsheet_id");
  if (existing) {
    try {
      const info = await getSpreadsheet(existing);
      return { id: info.spreadsheetId, url: info.spreadsheetUrl ?? `https://docs.google.com/spreadsheets/d/${info.spreadsheetId}/edit` };
    } catch {
        // Fallback if ID is invalid or inaccessible
    }
  }
  const created = await createSpreadsheet(MASTER_LEDGER_TITLE);
  await setSetting("master_ledger_spreadsheet_id", created.spreadsheetId);
  return {
    id: created.spreadsheetId,
    url: created.spreadsheetUrl ?? `https://docs.google.com/spreadsheets/d/${created.spreadsheetId}/edit`,
  };
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
    const existingSheets = new Set((info.sheets ?? []).map((s: any) => s.properties.title));
    
    // 1. Update Overview Sheet
    const overviewSheet = "Balances Overview";
    if (!existingSheets.has(overviewSheet)) {
        await addSheet(spreadsheetId, overviewSheet);
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

    // 2. Update individual agent tabs
    for (const agent of data) {
        const tabName = agent.agency_name.slice(0, 30); // Google Sheets limit
        if (!existingSheets.has(tabName)) {
            await addSheet(spreadsheetId, tabName);
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
    }
    
    return spreadsheet;
}
