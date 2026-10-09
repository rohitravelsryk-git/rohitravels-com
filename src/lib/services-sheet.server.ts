import { DESIGNATED_SPREADSHEETS } from "./backup/engine.server";
import { getSpreadsheet, addSheet, writeRange, batchUpdateSpreadsheet } from "./backup/sheets.server";
import { listServices } from "./fares.functions";

export const SERVICES_SHEET_TAB = "Services";
export const ADDONS_SPREADSHEET_ID = DESIGNATED_SPREADSHEETS.addons;

export async function syncServicesToSheet(): Promise<{
  ok: boolean;
  count: number;
  url: string;
  tabId?: number;
}> {
  try {
    const services = await listServices();
    const spreadsheet = await getSpreadsheet(ADDONS_SPREADSHEET_ID);

    let sheetMeta = spreadsheet.sheets?.find(
      (s) => s.properties?.title?.toLowerCase().trim() === SERVICES_SHEET_TAB.toLowerCase().trim(),
    );

    let sheetId = sheetMeta?.properties?.sheetId;
    if (sheetId === undefined || sheetId === null) {
      const newId = await addSheet(ADDONS_SPREADSHEET_ID, SERVICES_SHEET_TAB);
      if (newId !== null) sheetId = newId;
    }

    const rows: unknown[][] = [
      ["ROHI INTERNATIONAL TRAVELS"],
      ["Sardar Market, Shahi Road, Rahim Yar Khan • 0305-6622988"],
      ["ADDONS - SERVICES"],
      [`Official Live Record • ${services.length} entries`],
      ["Service Name", "Photo URL", "Brief Description", "Sort Order", "ID", "Updated At"],
    ];

    for (const item of services) {
      rows.push([
        item.label,
        item.photo_url || "",
        item.description || "",
        item.sort_order ?? 100,
        item.id,
        item.created_at || new Date().toISOString(),
      ]);
    }

    const range = `${SERVICES_SHEET_TAB}!A1:F${rows.length}`;
    await writeRange(ADDONS_SPREADSHEET_ID, range, rows);

    // Apply Rohi Terracotta & Matte Black brand formatting if sheetId is known
    if (sheetId !== undefined && sheetId !== null) {
      const requests: any[] = [
        {
          updateSheetProperties: {
            properties: { sheetId, gridProperties: { frozenRowCount: 5 } },
            fields: "gridProperties.frozenRowCount",
          },
        },
        // Banner rows
        {
          repeatCell: {
            range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 6 },
            cell: {
              userEnteredFormat: {
                textFormat: { bold: true, fontSize: 14, foregroundColor: { red: 0.08, green: 0.08, blue: 0.075 } },
                horizontalAlignment: "CENTER",
              },
            },
            fields: "userEnteredFormat(textFormat,horizontalAlignment)",
          },
        },
        {
          repeatCell: {
            range: { sheetId, startRowIndex: 2, endRowIndex: 3, startColumnIndex: 0, endColumnIndex: 6 },
            cell: {
              userEnteredFormat: {
                backgroundColor: { red: 0.851, green: 0.467, blue: 0.341 }, // Warm Terracotta Clay #D97757
                textFormat: { bold: true, fontSize: 11, foregroundColor: { red: 1.0, green: 1.0, blue: 1.0 } },
                horizontalAlignment: "CENTER",
              },
            },
            fields: "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)",
          },
        },
        {
          repeatCell: {
            range: { sheetId, startRowIndex: 4, endRowIndex: 5, startColumnIndex: 0, endColumnIndex: 6 },
            cell: {
              userEnteredFormat: {
                backgroundColor: { red: 0.08, green: 0.08, blue: 0.075 }, // Matte Black #141413
                textFormat: { bold: true, fontSize: 10, foregroundColor: { red: 0.98, green: 0.976, blue: 0.96 } },
                horizontalAlignment: "LEFT",
              },
            },
            fields: "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)",
          },
        },
      ];

      await batchUpdateSpreadsheet(ADDONS_SPREADSHEET_ID, requests).catch((e) =>
        console.warn("[syncServicesToSheet] formatting warn:", e?.message),
      );
    }

    const tabUrl = sheetId !== undefined && sheetId !== null
      ? `https://docs.google.com/spreadsheets/d/${ADDONS_SPREADSHEET_ID}/edit#gid=${sheetId}`
      : `https://docs.google.com/spreadsheets/d/${ADDONS_SPREADSHEET_ID}/edit`;

    return {
      ok: true,
      count: services.length,
      url: tabUrl,
      tabId: sheetId,
    };
  } catch (error: any) {
    console.error("[syncServicesToSheet] error:", error?.message || error);
    return {
      ok: false,
      count: 0,
      url: `https://docs.google.com/spreadsheets/d/${ADDONS_SPREADSHEET_ID}/edit`,
    };
  }
}
