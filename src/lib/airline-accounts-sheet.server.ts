import { addSheet, applyRohiExportFormatting, batchUpdateSpreadsheet, batchWrite, buildRohiExportFormattingRequests, clearSheet, deleteSheet, getSpreadsheet, writeRange, quoteSheet } from "@/lib/backup/sheets.server";
import { airlineIataCode, airlineLogoUrl } from "@/lib/airline-branding";

// Mirrors the Airline Accounts database into ONE Google Sheet named "Airline Accounts".
// Tabs: "Airline Balance" (summary), per-airline statement tabs, and
// "_DATA" (hidden raw records for recovery). No SNAP tabs are ever created.
// One-way: database -> sheet. The database stays the source of truth.

const GATEWAY = "https://connector-gateway.lovable.dev/google_sheets/v4";
const SETTING_KEY = "airline_accounts_sheet_id";
const TITLE = "Airline Accounts";
const TABS = ["Airline Balance", "_DATA"] as const;

function headers() {
  const lovable = process.env.LOVABLE_API_KEY;
  const conn = process.env.GOOGLE_SHEETS_API_KEY;
  if (!lovable || !conn) throw new Error("Google Sheets is not connected");
  return {
    Authorization: `Bearer ${lovable}`,
    "X-Connection-Api-Key": conn,
    "Content-Type": "application/json",
  };
}

async function gw(path: string, init?: RequestInit) {
  const res = await fetch(`${GATEWAY}${path}`, { ...init, headers: headers() });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Google Sheets [${res.status}]: ${body.slice(0, 400)}`);
  }
  return res.json();
}

const n = (v: unknown) => {
  const x = Number(v);
  return v === null || v === undefined || v === "" || Number.isNaN(x) ? 0 : x;
};
const s = (v: unknown) => (v === null || v === undefined ? "" : String(v));

async function writeImageFormulas(
  id: string,
  cells: { sheetId: number; rowIndex: number; columnIndex: number; url: string }[],
) {
  const requests = cells
    .filter((cell) => cell.url)
    .map((cell) => ({
      updateCells: {
        start: { sheetId: cell.sheetId, rowIndex: cell.rowIndex, columnIndex: cell.columnIndex },
        rows: [{ values: [{ userEnteredValue: { formulaValue: `=IMAGE("${cell.url.replace(/"/g, '""')}")` } }] }],
        fields: "userEnteredValue",
      },
    }));
  if (!requests.length) return;
  await gw(`/spreadsheets/${id}:batchUpdate`, { method: "POST", body: JSON.stringify({ requests }) });
}

async function getAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

// Always the one designated "Airline Accounts" spreadsheet — never a self-created one.
const DESIGNATED_SHEET_ID = "1frL5ognuYHdtct0kHonvmORhUZm2IYestxUUCgKZD5Q";

async function ensureSpreadsheet(): Promise<string> {
  const id = DESIGNATED_SHEET_ID;
  const meta = await gw(`/spreadsheets/${id}?fields=sheets.properties`);
  const existingProps = (meta.sheets ?? []).map((x: any) => x.properties);
  const existing = new Set<string>(existingProps.map((p: any) => p.title));
  const missing = TABS.filter((t) => !existing.has(t));
  if (missing.length) {
    await gw(`/spreadsheets/${id}:batchUpdate`, {
      method: "POST",
      body: JSON.stringify({
        requests: missing.map((title) => ({ addSheet: { properties: { title, hidden: title === "_DATA", gridProperties: { frozenRowCount: title === "_DATA" ? 1 : 2 } } } })),
      }),
    });
  }

  // Re-fetch so newly-added tabs have a sheetId, then (re)apply the Warm Clay header
  // styling to the two visible tabs. Idempotent — safe to run on every sync.
  const freshMeta = missing.length ? await gw(`/spreadsheets/${id}?fields=sheets.properties`) : meta;
  const sheetIds = (freshMeta.sheets ?? []).map((x: any) => x.properties);
  await gw(`/spreadsheets/${id}:batchUpdate`, {
    method: "POST",
    body: JSON.stringify({
      requests: sheetIds
        .filter((p: any) => p.title !== "_DATA")
        .flatMap((p: any) => [
          {
            repeatCell: {
              range: { sheetId: p.sheetId, startRowIndex: 0, endRowIndex: 1 },
              cell: { userEnteredFormat: { backgroundColor: { red: 0.851, green: 0.467, blue: 0.341 }, textFormat: { bold: true, fontSize: 13, foregroundColor: { red: 1, green: 1, blue: 1 } } } },
              fields: "userEnteredFormat(backgroundColor,textFormat)",
            },
          },
          {
            repeatCell: {
              range: { sheetId: p.sheetId, startRowIndex: 1, endRowIndex: 2 },
              cell: { userEnteredFormat: { backgroundColor: { red: 0.078, green: 0.078, blue: 0.075 }, textFormat: { bold: true, foregroundColor: { red: 0.98, green: 0.976, blue: 0.961 } } } },
              fields: "userEnteredFormat(backgroundColor,textFormat)",
            },
          },
        ]),
    }),
  });
  return id;
}

export function airlineAccountsSheetUrl(id: string) {
  return `https://docs.google.com/spreadsheets/d/${id}/edit`;
}

export async function getAirlineAccountsSheetId() {
  return ensureSpreadsheet();
}



export function buildAirlineBalanceFormatRequests(sheetId: number, airlineCount: number): any[] {
  const dataEndRow = 2 + airlineCount;
  const totalRowIndex = dataEndRow + 1; // 1 blank row separator, then total row
  const BRAND_ACCENT = { red: 217 / 255, green: 119 / 255, blue: 87 / 255 };
  const BRAND_DARK = { red: 20 / 255, green: 20 / 255, blue: 19 / 255 };
  const BRAND_CREAM = { red: 250 / 255, green: 249 / 255, blue: 245 / 255 };
  const BRAND_WHITE = { red: 1, green: 1, blue: 1 };
  const BRAND_BORDER = { red: 231 / 255, green: 229 / 255, blue: 228 / 255 };
  const BRAND_TEXT = { red: 28 / 255, green: 25 / 255, blue: 23 / 255 };

  const requests: any[] = [
    { clearBasicFilter: { sheetId } },
    {
      updateSheetProperties: {
        properties: {
          sheetId,
          gridProperties: { columnCount: 4, frozenRowCount: 2 },
          tabColorStyle: { rgbColor: BRAND_ACCENT },
        },
        fields: "gridProperties.columnCount,gridProperties.frozenRowCount,tabColorStyle",
      },
    },
    { updateDimensionProperties: { range: { sheetId, dimension: 'COLUMNS', startIndex: 0, endIndex: 1 }, properties: { pixelSize: 200 }, fields: 'pixelSize' } },
    { updateDimensionProperties: { range: { sheetId, dimension: 'COLUMNS', startIndex: 1, endIndex: 2 }, properties: { pixelSize: 120 }, fields: 'pixelSize' } },
    { updateDimensionProperties: { range: { sheetId, dimension: 'COLUMNS', startIndex: 2, endIndex: 3 }, properties: { pixelSize: 190 }, fields: 'pixelSize' } },
    { updateDimensionProperties: { range: { sheetId, dimension: 'COLUMNS', startIndex: 3, endIndex: 4 }, properties: { pixelSize: 190 }, fields: 'pixelSize' } },
    { updateDimensionProperties: { range: { sheetId, dimension: 'ROWS', startIndex: 0, endIndex: 1 }, properties: { pixelSize: 42 }, fields: 'pixelSize' } },
    { updateDimensionProperties: { range: { sheetId, dimension: 'ROWS', startIndex: 1, endIndex: 2 }, properties: { pixelSize: 34 }, fields: 'pixelSize' } },
    { updateDimensionProperties: { range: { sheetId, dimension: 'ROWS', startIndex: 2, endIndex: dataEndRow }, properties: { pixelSize: 44 }, fields: 'pixelSize' } },
    { updateDimensionProperties: { range: { sheetId, dimension: 'ROWS', startIndex: dataEndRow, endIndex: totalRowIndex }, properties: { pixelSize: 16 }, fields: 'pixelSize' } },
    { updateDimensionProperties: { range: { sheetId, dimension: 'ROWS', startIndex: totalRowIndex, endIndex: totalRowIndex + 1 }, properties: { pixelSize: 38 }, fields: 'pixelSize' } },
    { mergeCells: { range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 4 }, mergeType: 'MERGE_ALL' } },
    {
      repeatCell: {
        range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 4 },
        cell: {
          userEnteredFormat: {
            backgroundColor: BRAND_ACCENT,
            horizontalAlignment: 'CENTER',
            verticalAlignment: 'MIDDLE',
            textFormat: { foregroundColor: BRAND_WHITE, fontSize: 12, bold: true },
          },
        },
        fields: 'userEnteredFormat(backgroundColor,horizontalAlignment,verticalAlignment,textFormat)',
      },
    },
    {
      repeatCell: {
        range: { sheetId, startRowIndex: 1, endRowIndex: 2, startColumnIndex: 0, endColumnIndex: 4 },
        cell: {
          userEnteredFormat: {
            backgroundColor: BRAND_DARK,
            horizontalAlignment: 'CENTER',
            verticalAlignment: 'MIDDLE',
            textFormat: { foregroundColor: BRAND_WHITE, fontSize: 10, bold: true },
            borders: { bottom: { style: 'SOLID_MEDIUM', color: BRAND_ACCENT } },
          },
        },
        fields: 'userEnteredFormat(backgroundColor,horizontalAlignment,verticalAlignment,textFormat,borders)',
      },
    },
    {
      repeatCell: {
        range: { sheetId, startRowIndex: totalRowIndex, endIndex: totalRowIndex + 1, startColumnIndex: 0, endColumnIndex: 4 },
        cell: {
          userEnteredFormat: {
            backgroundColor: BRAND_DARK,
            textFormat: { foregroundColor: BRAND_WHITE, fontSize: 11, bold: true },
            verticalAlignment: 'MIDDLE',
            borders: { top: { style: 'SOLID_MEDIUM', color: BRAND_ACCENT } },
          },
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat,verticalAlignment,borders)',
      },
    },
    {
      repeatCell: {
        range: { sheetId, startRowIndex: 2, endRowIndex: totalRowIndex + 1, startColumnIndex: 3, endColumnIndex: 4 },
        cell: {
          userEnteredFormat: {
            horizontalAlignment: 'RIGHT',
            numberFormat: { type: 'NUMBER', pattern: '#,##0;[Red](#,##0);0' },
          },
        },
        fields: 'userEnteredFormat(horizontalAlignment,numberFormat)',
      },
    },
  ];

  for (let r = 2; r < dataEndRow; r++) {
    const bg = (r % 2 === 0) ? BRAND_WHITE : BRAND_CREAM;
    requests.push({
      repeatCell: {
        range: { sheetId, startRowIndex: r, endRowIndex: r + 1, startColumnIndex: 0, endColumnIndex: 4 },
        cell: {
          userEnteredFormat: {
            backgroundColor: bg,
            verticalAlignment: 'MIDDLE',
            borders: { bottom: { style: 'SOLID', color: BRAND_BORDER } },
            textFormat: { foregroundColor: BRAND_TEXT, fontSize: 10 },
          },
        },
        fields: 'userEnteredFormat(backgroundColor,verticalAlignment,borders,textFormat)',
      },
    });
  }

  requests.push({
    repeatCell: {
      range: { sheetId, startRowIndex: 2, endRowIndex: dataEndRow, startColumnIndex: 0, endColumnIndex: 1 },
      cell: { userEnteredFormat: { horizontalAlignment: 'LEFT', textFormat: { bold: true } } },
      fields: 'userEnteredFormat(horizontalAlignment,textFormat.bold)',
    },
  });
  requests.push({
    repeatCell: {
      range: { sheetId, startRowIndex: 2, endRowIndex: dataEndRow, startColumnIndex: 1, endColumnIndex: 2 },
      cell: { userEnteredFormat: { horizontalAlignment: 'CENTER' } },
      fields: 'userEnteredFormat(horizontalAlignment)',
    },
  });
  requests.push({
    repeatCell: {
      range: { sheetId, startRowIndex: 2, endRowIndex: dataEndRow, startColumnIndex: 2, endColumnIndex: 3 },
      cell: { userEnteredFormat: { horizontalAlignment: 'RIGHT', textFormat: { bold: true, foregroundColor: BRAND_ACCENT } } },
      fields: 'userEnteredFormat(horizontalAlignment,textFormat)',
    },
  });

  return requests;
}

async function formatAirlineBalanceSheet(id: string, sheetId: number, airlineCount: number) {
  const requests = buildAirlineBalanceFormatRequests(sheetId, airlineCount);
  await batchUpdateSpreadsheet(id, requests);
}

async function oldFormatAirlineBalanceSheetUnused(id: string, sheetId: number, airlineCount: number) {
  const dataEndRow = 2 + airlineCount;
  const totalRowIndex = dataEndRow + 1; // 1 blank row separator, then total row
  const requests: any[] = [
    { clearBasicFilter: { sheetId } },
    {
      updateSheetProperties: {
        properties: {
          sheetId,
          gridProperties: { columnCount: 4, frozenRowCount: 2 },
        },
        fields: "gridProperties.columnCount,gridProperties.frozenRowCount",
      },
    },
    { updateDimensionProperties: { range: { sheetId, dimension: 'COLUMNS', startIndex: 0, endIndex: 1 }, properties: { pixelSize: 200 }, fields: 'pixelSize' } },
    { updateDimensionProperties: { range: { sheetId, dimension: 'COLUMNS', startIndex: 1, endIndex: 2 }, properties: { pixelSize: 120 }, fields: 'pixelSize' } },
    { updateDimensionProperties: { range: { sheetId, dimension: 'COLUMNS', startIndex: 2, endIndex: 3 }, properties: { pixelSize: 180 }, fields: 'pixelSize' } },
    { updateDimensionProperties: { range: { sheetId, dimension: 'COLUMNS', startIndex: 3, endIndex: 4 }, properties: { pixelSize: 180 }, fields: 'pixelSize' } },
    { updateDimensionProperties: { range: { sheetId, dimension: 'ROWS', startIndex: 0, endIndex: 1 }, properties: { pixelSize: 42 }, fields: 'pixelSize' } },
    { updateDimensionProperties: { range: { sheetId, dimension: 'ROWS', startIndex: 1, endIndex: 2 }, properties: { pixelSize: 36 }, fields: 'pixelSize' } },
    { updateDimensionProperties: { range: { sheetId, dimension: 'ROWS', startIndex: 2, endIndex: dataEndRow }, properties: { pixelSize: 48 }, fields: 'pixelSize' } },
    { updateDimensionProperties: { range: { sheetId, dimension: 'ROWS', startIndex: dataEndRow, endIndex: totalRowIndex }, properties: { pixelSize: 16 }, fields: 'pixelSize' } },
    { updateDimensionProperties: { range: { sheetId, dimension: 'ROWS', startIndex: totalRowIndex, endIndex: totalRowIndex + 1 }, properties: { pixelSize: 38 }, fields: 'pixelSize' } },
    { mergeCells: { range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 4 }, mergeType: 'MERGE_ALL' } },
    {
      repeatCell: {
        range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 4 },
        cell: {
          userEnteredFormat: {
            backgroundColor: { red: 0.078, green: 0.078, blue: 0.075 },
            horizontalAlignment: 'CENTER',
            verticalAlignment: 'MIDDLE',
            textFormat: { bold: true, fontSize: 12, foregroundColor: { red: 1.0, green: 1.0, blue: 1.0 } },
          },
        },
        fields: 'userEnteredFormat(backgroundColor,horizontalAlignment,verticalAlignment,textFormat)',
      },
    },
    {
      repeatCell: {
        range: { sheetId, startRowIndex: 1, endRowIndex: 2, startColumnIndex: 0, endColumnIndex: 4 },
        cell: {
          userEnteredFormat: {
            backgroundColor: { red: 0.851, green: 0.467, blue: 0.341 },
            verticalAlignment: 'MIDDLE',
            textFormat: { bold: true, fontSize: 10, foregroundColor: { red: 1.0, green: 1.0, blue: 1.0 } },
          },
        },
        fields: 'userEnteredFormat(backgroundColor,verticalAlignment,textFormat)',
      },
    },
    { repeatCell: { range: { sheetId, startRowIndex: 1, endRowIndex: 2, startColumnIndex: 0, endColumnIndex: 1 }, cell: { userEnteredFormat: { horizontalAlignment: 'LEFT' } }, fields: 'userEnteredFormat.horizontalAlignment' } },
    { repeatCell: { range: { sheetId, startRowIndex: 1, endRowIndex: 2, startColumnIndex: 1, endColumnIndex: 2 }, cell: { userEnteredFormat: { horizontalAlignment: 'CENTER' } }, fields: 'userEnteredFormat.horizontalAlignment' } },
    { repeatCell: { range: { sheetId, startRowIndex: 1, endRowIndex: 2, startColumnIndex: 2, endColumnIndex: 4 }, cell: { userEnteredFormat: { horizontalAlignment: 'RIGHT' } }, fields: 'userEnteredFormat.horizontalAlignment' } },
  ];

  for (let i = 2; i < dataEndRow; i++) {
    const bg = i % 2 === 0 ? { red: 0.98, green: 0.976, blue: 0.961 } : { red: 1.0, green: 1.0, blue: 1.0 };
    requests.push({
      repeatCell: {
        range: { sheetId, startRowIndex: i, endRowIndex: i + 1, startColumnIndex: 0, endColumnIndex: 4 },
        cell: { userEnteredFormat: { backgroundColor: bg } },
        fields: 'userEnteredFormat.backgroundColor',
      },
    });
  }

  requests.push(
    {
      repeatCell: {
        range: { sheetId, startRowIndex: 2, endRowIndex: dataEndRow, startColumnIndex: 0, endColumnIndex: 1 },
        cell: {
          userEnteredFormat: {
            verticalAlignment: 'MIDDLE',
            horizontalAlignment: 'LEFT',
            textFormat: { bold: true, fontSize: 11, foregroundColor: { red: 0.11, green: 0.098, blue: 0.09 } },
          },
        },
        fields: 'userEnteredFormat(verticalAlignment,horizontalAlignment,textFormat)',
      },
    },
    {
      repeatCell: {
        range: { sheetId, startRowIndex: 2, endRowIndex: dataEndRow, startColumnIndex: 1, endColumnIndex: 2 },
        cell: { userEnteredFormat: { verticalAlignment: 'MIDDLE', horizontalAlignment: 'CENTER' } },
        fields: 'userEnteredFormat(verticalAlignment,horizontalAlignment)',
      },
    },
    {
      repeatCell: {
        range: { sheetId, startRowIndex: 2, endRowIndex: dataEndRow, startColumnIndex: 2, endColumnIndex: 3 },
        cell: {
          userEnteredFormat: {
            verticalAlignment: 'MIDDLE',
            horizontalAlignment: 'RIGHT',
            textFormat: { fontSize: 10, foregroundColor: { red: 0.47, green: 0.44, blue: 0.42 } },
          },
        },
        fields: 'userEnteredFormat(verticalAlignment,horizontalAlignment,textFormat)',
      },
    },
    {
      repeatCell: {
        range: { sheetId, startRowIndex: 2, endRowIndex: dataEndRow, startColumnIndex: 3, endColumnIndex: 4 },
        cell: {
          userEnteredFormat: {
            verticalAlignment: 'MIDDLE',
            horizontalAlignment: 'RIGHT',
            numberFormat: { type: 'NUMBER', pattern: '#,##0;[Red](#,##0);0' },
            textFormat: { bold: true, fontSize: 11, foregroundColor: { red: 0.08, green: 0.08, blue: 0.08 } },
          },
        },
        fields: 'userEnteredFormat(verticalAlignment,horizontalAlignment,numberFormat,textFormat)',
      },
    },
    {
      updateBorders: {
        range: { sheetId, startRowIndex: 1, endRowIndex: dataEndRow, startColumnIndex: 0, endColumnIndex: 4 },
        top: { style: 'SOLID', color: { red: 0.8, green: 0.8, blue: 0.8 } },
        bottom: { style: 'SOLID', color: { red: 0.8, green: 0.8, blue: 0.8 } },
        innerHorizontal: { style: 'SOLID', color: { red: 0.9, green: 0.89, blue: 0.88 } },
      },
    },
    {
      repeatCell: {
        range: { sheetId, startRowIndex: totalRowIndex, endRowIndex: totalRowIndex + 1, startColumnIndex: 0, endColumnIndex: 4 },
        cell: {
          userEnteredFormat: {
            backgroundColor: { red: 0.078, green: 0.078, blue: 0.075 },
            verticalAlignment: 'MIDDLE',
            textFormat: { bold: true, fontSize: 11, foregroundColor: { red: 0.98, green: 0.976, blue: 0.961 } },
          },
        },
        fields: 'userEnteredFormat(backgroundColor,verticalAlignment,textFormat)',
      },
    },
    {
      repeatCell: {
        range: { sheetId, startRowIndex: totalRowIndex, endRowIndex: totalRowIndex + 1, startColumnIndex: 3, endColumnIndex: 4 },
        cell: {
          userEnteredFormat: {
            horizontalAlignment: 'RIGHT',
            numberFormat: { type: 'NUMBER', pattern: '#,##0;[Red](#,##0);0' },
            textFormat: { bold: true, fontSize: 12, foregroundColor: { red: 0.851, green: 0.467, blue: 0.341 } },
          },
        },
        fields: 'userEnteredFormat(horizontalAlignment,numberFormat,textFormat)',
      },
    },
    {
      updateBorders: {
        range: { sheetId, startRowIndex: totalRowIndex, endRowIndex: totalRowIndex + 1, startColumnIndex: 0, endColumnIndex: 4 },
        top: { style: 'SOLID', color: { red: 0.851, green: 0.467, blue: 0.341 } },
        bottom: { style: 'DOUBLE', color: { red: 0.851, green: 0.467, blue: 0.341 } },
      },
    },
  );
  await gw(`/spreadsheets/${id}:batchUpdate`, { method: "POST", body: JSON.stringify({ requests }) });
}

function formatSheetDate(val: unknown): string {
  if (!val) return "";
  const s = String(val).trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) {
    const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
    const yr = m[1].slice(-2);
    const mo = months[parseInt(m[2], 10) - 1] || m[2];
    return `${m[3]}-${mo}-${yr}`;
  }
  return s;
}

export async function syncAirlineAccountsSheet(revision: number) {
  const db = await getAdmin();
  const [a, t] = await Promise.all([
    db.from("airline_ledger_airlines").select("*").order("sort_order"),
    db.from("airline_ledger_transactions").select("*").order("sort_order"),
  ]);
  if (a.error || t.error) throw new Error(a.error?.message || t.error?.message);
  const airlines = a.data ?? [];
  const txs = t.data ?? [];
  const id = await ensureSpreadsheet();
  const syncedAt = new Date().toISOString();

  // Airline Balance summary tab (Airport FID board style):
  // Columns: AIRLINE / CARRIER, LOGO, FOREIGN BALANCE (FX), CURRENT BALANCE (PKR)
  const balance: unknown[][] = [
    ["✈  ROHI INTERNATIONAL TRAVELS  |   CURRENT AIRLINE BALANCES"],
    ["AIRLINE / CARRIER", "LOGO", "FOREIGN BALANCE (FX)", "CURRENT BALANCE (PKR)"],
  ];
  let totalPkr = 0;
  let lastNonServiceRow = 2;
  for (let idx = 0; idx < (airlines as any[]).length; idx++) {
    const air = (airlines as any[])[idx];
    const isServiceOnly = /other\s*service\s*providers/i.test(air.name);
    const rows = (txs as any[]).filter((r) => r.airline_id === air.id);
    let running = n(air.opening_balance);

    const isG9 = air.code === "G9" || /air\s*arabia/i.test(air.name);
    const code = (isG9 && (!air.code || air.code === "--")) ? "G9" : air.code;
    const isXY = air.code === "XY" || /flynas/i.test(air.name);
    const isF3 = air.code === "F3" || /flyadeal/i.test(air.name);
    const defaultCurrency = isG9 ? "AED" : isXY ? "SAR" : isF3 ? "USD" : "PKR";
    const defaultRoe = isG9 ? 77.30 : isXY ? 75.50 : isF3 ? 284.00 : 1;
    const curr = (air.currency && air.currency.trim()) || defaultCurrency;
    const roeVal = n(air.roe) || defaultRoe;
    const isForeign = curr !== "PKR";

    let runningForeign = n(air.opening_balance_foreign) || (isForeign && roeVal ? (running / roeVal) : 0);
    for (const r of rows) {
      const credit = n(r.credit_from_id);
      running -= credit;
      const txRoe = n(r.roe) || roeVal;
      const txForeignCr = r.foreign_amount !== undefined && r.foreign_amount !== null && r.foreign_amount !== ""
        ? n(r.foreign_amount)
        : (isForeign ? (credit / txRoe) : 0);
      runningForeign -= txForeignCr;
    }

    const explicitCode = String(air.code ?? "").trim().toUpperCase();
    const isSial = explicitCode === "PF" || /sial/i.test(air.name);
    const iata = airlineIataCode(air.name, air.code);
    const logoPng = isSial
      ? "https://upload.wikimedia.org/wikipedia/commons/5/55/AirSial.png"
      : (iata ? `https://images.kiwi.com/airlines/64/${iata}.png` : "");
    const logoFormula = logoPng ? `=IMAGE("${logoPng}", 1)` : "";

    if (isServiceOnly) {
      balance.push([air.name, logoFormula, "-", "-"]);
    } else {
      totalPkr += running;
      lastNonServiceRow = 3 + idx;
      const foreignBalance = isForeign
        ? `${runningForeign.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${curr}`
        : "-";
      balance.push([air.name, logoFormula, foreignBalance, running]);
    }
  }
  const lastBalanceRow = 2 + (airlines as any[]).length;
  balance.push([]);
  // Sum formula excludes Other Service Providers if it is at the end or sums actual range
  balance.push(["TOTAL COMBINED BALANCE (PKR)", "", "-", `=SUM(D3:D${lastNonServiceRow})`]);

  const data: unknown[][] = [
    ["TYPE", "ID", "AIRLINE_ID", "NAME/DATE", "CODE/AGENT", "OPENING_BALANCE/PAX", "OPENING_DATE/SECTOR", "PNR", "TICKET_SALES", "DEBIT_IN_ID", "CREDIT_FROM_ID", "PAX_CONTACT", "VOID_CHARGES", "SORT_ORDER"],
    ...(airlines as any[]).map((x) => ["airline", x.id, "", x.name, x.code, n(x.opening_balance), s(x.opening_balance_date), "", "", "", "", "", "", x.sort_order]),
    ...(txs as any[]).map((r) => ["transaction", r.id, r.airline_id, s(r.date), s(r.agent_name), s(r.pax_name), s(r.sector), s(r.pnr), s(r.ticket_sales), s(r.debit_in_id), s(r.credit_from_id), s(r.pax_contact), s(r.void_charges), r.sort_order]),
    [],
    ["META", `revision ${revision}`, syncedAt],
  ];

  await gw(`/spreadsheets/${id}/values:batchClear`, {
    method: "POST",
    body: JSON.stringify({ ranges: TABS.map((tab) => `'${tab}'`) }),
  });
  await gw(`/spreadsheets/${id}/values:batchUpdate`, {
    method: "POST",
    body: JSON.stringify({
      valueInputOption: "USER_ENTERED",
      data: [
        { range: `'Airline Balance'!A1`, values: balance },
        { range: `'_DATA'!A1`, values: data },
      ],
    }),
  });

  const summarySpreadsheet = await getSpreadsheet(id);
  const summarySheetId = (summarySpreadsheet.sheets ?? []).find((x) => x.properties.title === "Airline Balance")?.properties.sheetId;
  if (summarySheetId !== undefined) {
    await formatAirlineBalanceSheet(id, summarySheetId, (airlines as any[]).length);
  }

  // Create/refresh one dedicated tab for every airline, using standard Rohi export formatting
  // without forced filter views and with exact 11 columns.
  const spreadsheet = await getSpreadsheet(id);
  const sheetMap = new Map<string, number>((spreadsheet.sheets ?? []).map((x) => [x.properties.title as string, x.properties.sheetId as number]));
  const usedNames = new Set<string>(sheetMap.keys());

  const safeAirlineTabName = (raw: string) => {
    const clean = String(raw || "Airline").replace(/[\\/:*?\[\]]/g, " ").replace(/\s+/g, " ").trim();
    return (clean || "Airline").slice(0, 90);
  };

  const currentAirlineTabNames = new Set((airlines as any[]).map((air) => safeAirlineTabName(air.name)));
  const systemTabs = new Set(["Airline Balance", "_DATA"]);
  for (const [title, sheetId] of Array.from(sheetMap.entries())) {
    if (!systemTabs.has(title) && !currentAirlineTabNames.has(title)) {
      await deleteSheet(id, sheetId);
      sheetMap.delete(title);
      usedNames.delete(title);
    }
  }

  for (const air of airlines as any[]) {
    const baseName = safeAirlineTabName(air.name);
    let tabName = baseName;
    let suffix = 2;
    while (usedNames.has(tabName) && sheetMap.get(tabName) === undefined) {
      tabName = `${baseName.slice(0, 85)} ${suffix++}`;
    }

    let sheetId = sheetMap.get(tabName);
    if (sheetId === undefined) {
      const createdSheetId = await addSheet(id, tabName);
      if (createdSheetId === null) continue;
      sheetId = createdSheetId;
      sheetMap.set(tabName, sheetId);
      usedNames.add(tabName);
    }

    const rows = (txs as any[]).filter((r) => r.airline_id === air.id);
    const op = n(air.opening_balance);
    let running = op;
    const isForeign = air.currency && air.currency !== "PKR";
    const curr = air.currency || "PKR";
    const roeVal = n(air.roe) || 1;
    let runningForeign = n(air.opening_balance_foreign) || (isForeign && roeVal ? (running / roeVal) : 0);
    const opForeign = runningForeign;

    const isServiceOnly = /other\s*service\s*providers/i.test(air.name);
    if (isServiceOnly) {
      const specific: unknown[][] = [
        ["ROHI INTERNATIONAL TRAVELS", "", "", "", "", "", "", "", "", "", ""],
        ["Service Provider Account Statement", "", "", "", "", "", "", "", "", "", ""],
        [`Airline: ${s(air.name)}`, "", "", "", "", "", "", "", "", "", ""],
        [`Entries: ${rows.length} • All Tickets Record`, "", "", "", "", "", "", "", "", "", ""],
        ["Date", "Agent", "Passenger", "Sector", "PNR", "Ticket Sales", "Credit From ID", "Void Charges", "Profit", "Running Balance", "Remarks"],
      ];
      for (const r of rows) {
        const sales = n(r.ticket_sales);
        const credit = n(r.credit_from_id);
        const voids = n(r.void_charges);
        specific.push([
          formatSheetDate(r.date),
          s(r.agent_name),
          s(r.pax_name),
          s(r.sector),
          s(r.pnr),
          sales,
          credit,
          voids,
          sales - credit,
          "-",
          [r.pax_name, r.sector, r.pnr].map((v) => s(v).trim()).filter(Boolean).join(" - "),
        ]);
      }
      valuesPayload.push({
        range: `'${tabName}'!A1:K${Math.max(5, specific.length)}`,
        values: specific,
      });
      formatTasks.push({
        sheetId,
        title: tabName,
        columnCount: 11,
        dataEndRow: specific.length,
        numericColumnStart: 5,
        numericColumnIndexes: [5, 6, 7, 8],
        dateColumnIndexes: [0],
      });
      continue;
    }

    const airlineCode = ((!air.code || air.code === "--") && /air\s*arabia/i.test(air.name)) ? "G9" : air.code;
    const airlineTitle = airlineCode ? `Airline: ${s(air.name)} • ${s(airlineCode)}` : `Airline: ${s(air.name)}`;
    const specific: unknown[][] = [
      ["ROHI INTERNATIONAL TRAVELS", "", "", "", "", "", "", "", "", "", ""],
      ["Airline Account Statement", "", "", "", "", "", "", "", "", "", ""],
      [airlineTitle, "", "", "", "", "", "", "", "", "", ""],
      ["", "", "", "", "", "", "", "", "", "", ""],
      ["Date", "Agent", "Passenger", "Sector", "PNR", "Ticket Sales", "Credit From ID", "Void Charges", "Profit", "Running Balance", "Remarks"],
      [formatSheetDate(air.opening_balance_date) || "08-OCT-26", "", "", "", "", 0, "", 0, 0, op, "OPENING BALANCE"],
    ];

    for (const r of rows) {
      const credit = n(r.credit_from_id);
      running -= credit;
      const txRoe = n(r.roe) || roeVal;
      const txForeignCr = r.foreign_amount !== undefined && r.foreign_amount !== null && r.foreign_amount !== ""
        ? n(r.foreign_amount)
        : (isForeign ? (credit / txRoe) : 0);
      runningForeign -= txForeignCr;
      const sales = n(r.ticket_sales);
      const voids = n(r.void_charges);
      specific.push([
        formatSheetDate(r.date),
        s(r.agent_name),
        s(r.pax_name),
        s(r.sector),
        s(r.pnr),
        sales,
        credit,
        voids,
        sales - credit,
        running,
        [r.pax_name, r.sector, r.pnr].map((v) => s(v).trim()).filter(Boolean).join(" - "),
      ]);
    }

    if (op === 0 && rows.length === 0 && running === 0) {
      specific[3][0] = isForeign
        ? `Opening Balance: 0 • Entries: 0 • Current Balance: 0 (0.00 ${curr})`
        : "Opening Balance: 0 • Entries: 0 • Current Balance: 0";
    } else {
      const opStr = op.toLocaleString();
      const balStr = running.toLocaleString();
      specific[3][0] = isForeign
        ? `Opening Balance: ${opStr} (${opForeign.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${curr}) • Entries: ${rows.length} • Current Balance: ${balStr} (${runningForeign.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${curr})`
        : `Opening Balance: ${opStr} • Entries: ${rows.length} • Current Balance: ${balStr}`;
    }

    valuesPayload.push({
      range: `${quoteSheet(tabName)}!A1:K${Math.max(20, specific.length)}`,
      values: specific,
    });
    formatTasks.push({
      sheetId,
      title: tabName,
      columnCount: 11,
      dataEndRow: specific.length,
      numericColumnIndexes: [5, 6, 7, 8, 9],
      dateColumnIndexes: [0],
      isServiceOnly: false,
    });
  }

  // 1. Write all sheet data in one batched call
  await batchWrite(id, valuesPayload, "USER_ENTERED");

  // 2. Format Airline Balance summary sheet
  const balSheetId = sheetMap.get("Airline Balance");
  if (balSheetId !== undefined) {
    await formatAirlineBalanceSheet(id, balSheetId, (airlines as any[]).length);
  }

  // 3. Keep Google Sheets tab order identical to the database/UI airline order.
  const finalSpreadsheet = await getSpreadsheet(id);
  const finalSheetMap = new Map<string, number>(
    (finalSpreadsheet.sheets ?? []).map((x) => [x.properties.title as string, x.properties.sheetId as number]),
  );
  const orderRequests = (airlines as any[])
    .map((air, index) => {
      const sheetId = finalSheetMap.get(safeAirlineTabName(air.name));
      return sheetId === undefined ? null : {
        updateSheetProperties: {
          properties: { sheetId, index: 3 + index },
          fields: "index",
        },
      };
    })
    .filter(Boolean);

  // 4. Batch format all statement tabs in one atomic call to avoid rate limits
  const allFormatRequests: any[] = [];
  for (const task of formatTasks) {
    allFormatRequests.push(...buildRohiExportFormattingRequests(task.sheetId, task));
  }
  if (orderRequests.length) {
    allFormatRequests.push(...orderRequests);
  }
  if (allFormatRequests.length > 0) {
    await batchUpdateSpreadsheet(id, allFormatRequests);
  }

  return { spreadsheetId: id, url: airlineAccountsSheetUrl(id), syncedAt };
}
