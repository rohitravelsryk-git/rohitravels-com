import { addSheet, applyRohiExportFormatting, batchClear, batchUpdateSpreadsheet, batchWrite, buildRohiExportFormattingRequests, clearSheet, deleteSheet, getSpreadsheet, writeRange, quoteSheet } from "@/lib/backup/sheets.server";
import { airlineIataCode, airlineLogoUrl, airlineSheetLogoUrl } from "@/lib/airline-branding";

// Mirrors the Airline Accounts database into ONE Google Sheet named "Airline Accounts".
// Tabs: "Airline Balance" (summary) plus one statement tab per airline. Transactions
// are written directly into each airline's own tab. No SNAP tabs are ever created.
// One-way: database -> sheet. The database stays the source of truth.

const GATEWAY = "https://connector-gateway.lovable.dev/google_sheets/v4";
const SETTING_KEY = "airline_accounts_sheet_id";
const TITLE = "Airline Accounts";
const TABS = ["Airline Balance", "Airline Contact Details"] as const;

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

function parseCleanNumber(val: unknown): number {
  if (typeof val === "number") return Number.isFinite(val) ? val : 0;
  if (val === null || val === undefined || val === "") return 0;
  const cleaned = String(val).replace(/,/g, "").trim();
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : 0;
}

function classifyAirlineRow(r: any): { isIncrease: boolean; isTopUp: boolean; isRefund: boolean; resolvedType: string } {
  const txType = String(r.transaction_type || "").trim().toLowerCase();
  const sector = String(r.sector || "").trim().toLowerCase();
  const pax = String(r.pax_name || "").trim().toLowerCase();

  const isTopUp = txType === "top up" || /top\s*up/i.test(txType) || /top\s*up/i.test(sector) || /top\s*up/i.test(pax);
  const isRefund = txType === "cancel/refund" || txType === "refund" || /refund|cancel/i.test(txType) || /refund|cancel/i.test(sector) || /refund|cancel/i.test(pax);
  const isIncrease = isTopUp || isRefund;
  const resolvedType = isTopUp ? "Top Up" : isRefund ? "Cancel/Refund" : (r.transaction_type || "Add Transaction");

  return { isIncrease, isTopUp, isRefund, resolvedType };
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
        requests: missing.map((title) => ({ addSheet: { properties: { title, gridProperties: { frozenRowCount: 2 } } } })),
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
      requests: [
        ...sheetIds
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
      ],
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
        range: { sheetId, startRowIndex: totalRowIndex, endRowIndex: totalRowIndex + 1, startColumnIndex: 0, endColumnIndex: 4 },
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

function sortTransactionsByDate<T extends { date?: unknown; sort_order?: unknown }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const dateOrder = s(a.date).localeCompare(s(b.date));
    if (dateOrder) return dateOrder;
    return n(a.sort_order) - n(b.sort_order);
  });
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

/* ---------- shared builders (used by both the full rebuild and the fast targeted sync) ---------- */

// One canonical currency/ROE mode per airline. Previously this logic was
// duplicated between the summary and the statement builders with subtly
// different fallbacks; a single source keeps summary and statements consistent.
function airlineCurrencyMode(air: any): { curr: string; roeVal: number; isForeign: boolean } {
  const isG9 = air.code === "G9" || /air\s*arabia/i.test(air.name);
  const code = (isG9 && (!air.code || air.code === "--")) ? "G9" : air.code;
  const isXY = code === "XY" || /flynas/i.test(air.name);
  const isF3 = code === "F3" || /flyadeal/i.test(air.name);
  const isCarrierForeign = isG9 || isXY || isF3;
  const defaultCurrency = isG9 ? "AED" : isXY ? "SAR" : isF3 ? "USD" : "PKR";
  const defaultRoe = isG9 ? 77.30 : isXY ? 75.50 : isF3 ? 284.00 : 1;
  const rawCurr = (air.currency && air.currency.trim()) || "";
  const rawRoe = n(air.roe);
  const openingForeignVal = air.opening_balance_foreign !== null && air.opening_balance_foreign !== undefined ? n(air.opening_balance_foreign) : null;

  if (rawCurr && rawCurr !== "PKR") {
    return { curr: rawCurr, roeVal: rawRoe > 0 ? rawRoe : defaultRoe, isForeign: true };
  }
  if (rawCurr === "PKR" && (!isCarrierForeign || openingForeignVal === 0 || rawRoe === 1)) {
    return { curr: "PKR", roeVal: 1, isForeign: false };
  }
  if (isCarrierForeign) {
    return { curr: defaultCurrency, roeVal: rawRoe > 1 ? rawRoe : defaultRoe, isForeign: true };
  }
  return { curr: "PKR", roeVal: 1, isForeign: false };
}

// The exact PKR delta a transaction applies to the airline balance, plus the
// transaction's effective ROE used for the foreign running column.
function airlineBalanceDelta(r: any, isIncrease: boolean, isForeign: boolean, roeVal: number): { balanceDelta: number; txRoe: number } {
  const credit = parseCleanNumber(r.credit_from_id);
  const debitAmount = parseCleanNumber(r.debit_in_id);
  const salesAmount = parseCleanNumber(r.ticket_sales);
  const foreignAmount = parseCleanNumber(r.foreign_amount);
  const txRoe = parseCleanNumber(r.roe) || roeVal;

  let balanceDelta = 0;
  if (isIncrease) {
    if (debitAmount > 0) balanceDelta = debitAmount;
    else if (credit > 0) balanceDelta = credit;
    else if (salesAmount > 0) balanceDelta = salesAmount;
    else if (foreignAmount > 0 && isForeign) balanceDelta = Math.round(foreignAmount * txRoe);
  } else {
    balanceDelta = credit;
  }
  return { balanceDelta, txRoe };
}

// Builds the small "Airline Balance" summary tab exactly as the full rebuild does.
function buildAirlineBalanceSummary(airlines: any[], txs: any[]): { balance: unknown[][]; lastNonServiceRow: number } {
  const balance: unknown[][] = [
    ["✈  ROHI INTERNATIONAL TRAVELS  |   CURRENT AIRLINE BALANCES"],
    ["AIRLINE / CARRIER", "LOGO", "FOREIGN BALANCE (FX)", "CURRENT BALANCE (PKR)"],
  ];
  let lastNonServiceRow = 2;
  for (let idx = 0; idx < airlines.length; idx++) {
    const air = airlines[idx];
    const isServiceOnly = /other\s*service\s*providers/i.test(air.name);
    const rows = sortTransactionsByDate(txs.filter((r: any) => r.airline_id === air.id));
    let running = n(air.opening_balance);
    const { curr, roeVal, isForeign } = airlineCurrencyMode(air);
    let runningForeign = n(air.opening_balance_foreign) || (isForeign && roeVal ? (running / roeVal) : 0);
    for (const r of rows) {
      const { isIncrease } = classifyAirlineRow(r);
      const { balanceDelta, txRoe } = airlineBalanceDelta(r, isIncrease, isForeign, roeVal);
      running += isIncrease ? balanceDelta : -balanceDelta;
      const foreignAmount = parseCleanNumber(r.foreign_amount);
      const txForeignCr = foreignAmount > 0 ? foreignAmount : (isForeign ? (balanceDelta / txRoe) : 0);
      runningForeign += isIncrease ? txForeignCr : -txForeignCr;
    }
    const logoPng = isServiceOnly ? "" : airlineSheetLogoUrl(air.code, air.name);
    const logoFormula = logoPng ? `=IMAGE("${logoPng}", 1)` : "";
    if (isServiceOnly) {
      balance.push([air.name, logoFormula, "-", "-"]);
    } else {
      lastNonServiceRow = 3 + idx;
      const foreignBalance = isForeign
        ? `${runningForeign.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${curr}`
        : "-";
      balance.push([air.name, logoFormula, foreignBalance, running]);
    }
  }
  balance.push([]);
  balance.push(["TOTAL COMBINED BALANCE (PKR)", "", "-", `=SUM(D3:D${lastNonServiceRow})`]);
  return { balance, lastNonServiceRow };
}

const safeAirlineTabName = (raw: string) => {
  const clean = String(raw || "Airline").replace(/[\\/:*?\[\]]/g, " ").replace(/\s+/g, " ").trim();
  return (clean || "Airline").slice(0, 90);
};

type AirlineTabBuild = {
  tabName: string;
  specific: unknown[][];
  range: string;
  writeCols: number;
  formatTask: any;
};

// Builds one airline's statement tab payload exactly as the full rebuild does.
// Pure computation — the caller owns every spreadsheet mutation, so the same
// builder serves the full rebuild and the fast per-transaction sync.
function buildAirlineTab(air: any, rows: any[], tabName: string, sheetId: number): AirlineTabBuild {
  const op = n(air.opening_balance);
  let running = op;
  const { curr, roeVal, isForeign } = airlineCurrencyMode(air);
  let runningForeign = n(air.opening_balance_foreign) || (isForeign && roeVal ? (running / roeVal) : 0);
  const opForeign = runningForeign;
  const isServiceOnly = /other\s*service\s*providers/i.test(air.name);

  if (isServiceOnly) {
    const specific: unknown[][] = [
      ["ROHI INTERNATIONAL TRAVELS", "", "", "", "", "", "", "", "", "", "", "", ""],
      ["Service Provider Account Statement", "", "", "", "", "", "", "", "", "", "", "", ""],
      [`Airline: ${s(air.name)}`, "", "", "", "", "", "", "", "", "", "", ""],
      [`Entries: ${rows.length} • All Tickets Record`, "", "", "", "", "", "", "", "", "", "", "", ""],
      ["Date", "Agent", "Passenger", "Sector", "PNR", "Ticket Sales", "Debit In ID", "Credit From ID", "Pax Contact #", "Void Charges", "Profit", "Running Balance", "Remarks"],
    ];
    for (const r of rows) {
      const sales = n(r.ticket_sales);
      const debit = n(r.debit_in_id);
      const credit = n(r.credit_from_id);
      const voids = n(r.void_charges);
      specific.push([
        formatSheetDate(r.date), s(r.agent_name), s(r.pax_name), s(r.sector), s(r.pnr), sales,
        debit > 0 ? debit : "", credit, s(r.pax_contact), voids, sales - credit, "-",
        [r.pax_name, r.sector, r.pnr].map((v: any) => s(v).trim()).filter(Boolean).join(" - "),
      ]);
    }
    return {
      tabName,
      specific,
      writeCols: 15,
      range: `'${tabName}'!A1:O${Math.max(5, specific.length)}`,
      formatTask: {
        sheetId, title: tabName, columnCount: 15, dataEndRow: specific.length,
        numericColumnStart: 5, numericColumnIndexes: [5, 6, 7, 8, 9, 11, 12, 13], dateColumnIndexes: [0],
      },
    };
  }

  const airlineCode = ((!air.code || air.code === "--") && /air\s*arabia/i.test(air.name)) ? "G9" : air.code;
  const airlineTitle = airlineCode ? `Airline: ${s(air.name)} • ${s(airlineCode)}` : `Airline: ${s(air.name)}`;
  const colCount = isForeign ? 17 : 14;
  const padRow = (row: unknown[]) => {
    const padded = [...row];
    while (padded.length < colCount) padded.push("");
    return padded.slice(0, colCount);
  };
  const headerRow: unknown[] = isForeign
    ? ["Date", "Agent", "Passenger", "Sector", "PNR", "Ticket Sales (PKR)", "Debit In ID (PKR)", `Debit In (${curr})`, "Credit From ID (PKR)", `Credit From (${curr})`, "Void Charges (PKR)", "Profit (PKR)", "Running Balance (PKR)", `Balance in (${curr})`, "Agent/Pax Contact #", "Remarks", "Received Via"]
    : ["Date", "Agent", "Passenger", "Sector", "PNR", "Ticket Sales (PKR)", "Debit In ID (PKR)", "Credit From ID (PKR)", "Void Charges (PKR)", "Profit (PKR)", "Running Balance (PKR)", "Agent/Pax Contact #", "Remarks", "Received Via"];
  const openingRow: unknown[] = isForeign
    ? [formatSheetDate(air.opening_balance_date) || "17-OCT-26", "", "", "", "", 0, 0, 0, 0, 0, 0, 0, op, opForeign, "", "OPENING BALANCE", ""]
    : [formatSheetDate(air.opening_balance_date) || "17-OCT-26", "", "", "", "", 0, 0, 0, 0, 0, op, "", "OPENING BALANCE", ""];
  const specific: unknown[][] = [
    ["ROHI INTERNATIONAL TRAVELS"],
    ["Airline Account Statement"],
    [airlineTitle],
    [""],
    headerRow,
    openingRow,
  ];

  for (const r of rows) {
    const { isIncrease, isTopUp, isRefund } = classifyAirlineRow(r);
    const credit = parseCleanNumber(r.credit_from_id);
    const debitAmount = parseCleanNumber(r.debit_in_id);
    const salesAmount = parseCleanNumber(r.ticket_sales);
    const { balanceDelta, txRoe } = airlineBalanceDelta(r, isIncrease, isForeign, roeVal);

    running += isIncrease ? balanceDelta : -balanceDelta;
    const foreignAmount = parseCleanNumber(r.foreign_amount);
    const txForeignCr = foreignAmount > 0 ? foreignAmount : (isForeign ? (balanceDelta / txRoe) : 0);
    runningForeign += isIncrease ? txForeignCr : -txForeignCr;

    const displayedSales = isIncrease ? 0 : salesAmount;
    const displayedDebit = isIncrease ? balanceDelta : (debitAmount > 0 ? debitAmount : "");
    const displayedCredit = isIncrease ? "" : credit;
    const voids = parseCleanNumber(r.void_charges);
    const profit = isIncrease ? 0 : displayedSales - (credit > 0 ? credit : 0);
    const tag = isRefund ? "REFUND" : isTopUp ? "TOP UP" : "";
    const remarks = [tag, r.pax_name, r.sector, r.pnr].map((v: any) => s(v).trim()).filter(Boolean).join(" - ");

    const debitFx = isIncrease ? txForeignCr : "";
    const creditFx = isIncrease ? "" : txForeignCr;
    specific.push(padRow(isForeign
      ? [
          formatSheetDate(r.date), s(r.agent_name), s(r.pax_name), s(r.sector), s(r.pnr),
          displayedSales, displayedDebit, debitFx, displayedCredit, creditFx,
          voids, profit, running, runningForeign, s(r.pax_contact), remarks, s(r.received_via),
        ]
      : [
          formatSheetDate(r.date), s(r.agent_name), s(r.pax_name), s(r.sector), s(r.pnr),
          displayedSales, displayedDebit, displayedCredit, voids, profit, running, s(r.pax_contact),
          remarks, s(r.received_via),
        ]));
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

  const rangeEnd = colCount === 17 ? "Q" : "N";
  return {
    tabName,
    specific,
    writeCols: colCount,
    range: `${quoteSheet(tabName)}!A1:${rangeEnd}${Math.max(20, specific.length)}`,
    formatTask: {
      sheetId,
      title: tabName,
      columnCount: colCount,
      dataEndRow: specific.length,
      numericColumnIndexes: isForeign ? [5, 6, 8, 10, 11, 12] : [5, 6, 7, 8, 9, 10],
      decimalColumnIndexes: isForeign ? [7, 9, 13] : [],
      dateColumnIndexes: [0],
      isServiceOnly: false,
    },
  };
}

// Width each airline tab's grid must have so the write below always fits:
// service-provider tabs keep their existing 15-column layout; foreign-currency
// airline statements use 17 columns and PKR statements use 14.
function airlineTabWidth(air: any): number {
  if (/other\s*service\s*providers/i.test(air.name)) return 15;
  return airlineCurrencyMode(air).isForeign ? 17 : 14;
}

/* ---------- Google Sheets sync (full rebuild) ---------- */

export async function syncAirlineAccountsSheet(revision: number) {
  const db = await getAdmin();
  const [a, t] = await Promise.all([
    db.from("airline_ledger_airlines").select("*").order("sort_order"),
    db.from("airline_ledger_transactions").select("*").order("date", { ascending: true }).order("sort_order", { ascending: true }),
  ]);
  if (a.error || t.error) throw new Error(a.error?.message || t.error?.message);
  const airlines = a.data ?? [];
  const txs = t.data ?? [];
  const id = await ensureSpreadsheet();
  const syncedAt = new Date().toISOString();

  const { balance } = buildAirlineBalanceSummary(airlines as any[], txs as any[]);

  // Every range (Airline Balance and every airline statement tab) is written in
  // ONE atomic batched call further below. Writing the summary first and the
  // statement tabs later in separate calls is what produced torn syncs: a quota
  // error or timeout between the two calls left the balance updated while
  // airline statement tabs stayed stale.

  // Single metadata read: reused for the stale-tab sweep, the new-tab ids, the
  // final tab ordering and the summary tab formatting after all data writes.
  const spreadsheet = await getSpreadsheet(id);
  const sheetMap = new Map<string, number>((spreadsheet.sheets ?? []).map((x) => [x.properties.title as string, x.properties.sheetId as number]));
  const usedNames = new Set<string>(sheetMap.keys());

  // Clear every mirrored tab (system tabs plus every airline statement tab) in
  // one call, then write the complete snapshot in one call. The only window
  // where tabs can be empty is between these two calls, and the save handler
  // retries the whole sync, so a failure here self-heals instead of leaving
  // stale statement rows behind.
  const tabsToClear = [
    ...TABS.map((tab) => `'${tab}'`),
    ...Array.from(sheetMap.keys())
      .filter((title) => title !== "Airline Balance" && title !== "Airline Contact Details")
      .map((title) => quoteSheet(title)),
  ];
  await batchClear(id, tabsToClear);

  const currentAirlineTabNames = new Set((airlines as any[]).map((air) => safeAirlineTabName(air.name)));
  const systemTabs = new Set(["Airline Balance", "Airline Contact Details"]);
  for (const [title, sheetId] of Array.from(sheetMap.entries())) {
    if (!systemTabs.has(title) && !currentAirlineTabNames.has(title)) {
      await deleteSheet(id, sheetId);
      sheetMap.delete(title);
      usedNames.delete(title);
    }
  }

  // Size each airline tab's grid BEFORE writing so the write always fits the
  // grid. The width must match the actual write width from buildAirlineTab
  // (15 for the service-provider tab, 16 for foreign-currency, 13 otherwise) —
  // a mismatch here is exactly what made every full sync fail with a grid
  // error and leave all tabs stale.
  const tabWidths = new Map<string, number>();
  for (const air of airlines as any[]) {
    const tabName = safeAirlineTabName(air.name);
    if (!sheetMap.has(tabName)) continue;
    tabWidths.set(tabName, airlineTabWidth(air));
  }
  const expandGridRequests = Array.from(sheetMap.entries())
    .filter(([title]) => title !== "Airline Balance" && title !== "Airline Contact Details")
    .map(([title, sId]) => ({
      updateSheetProperties: {
        properties: { sheetId: sId, gridProperties: { columnCount: tabWidths.get(title) ?? 13 } },
        fields: "gridProperties.columnCount",
      },
    }));
  if (expandGridRequests.length) await batchUpdateSpreadsheet(id, expandGridRequests);

  const valuesPayload: { range: string; values: unknown[][] }[] = [];
  const formatTasks: any[] = [];

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

    const rows = sortTransactionsByDate((txs as any[]).filter((r) => r.airline_id === air.id));
    const built = buildAirlineTab(air, rows, tabName, sheetId);
    valuesPayload.push({ range: built.range, values: built.specific });
    formatTasks.push(built.formatTask);
  }

  // 1. Write ALL sheet data (summary and every airline statement tab) in one
  // atomic batched call. Either the whole mirror matches the database or
  // the sync fails and is retried — a torn state is no longer possible.
  const allDataPayload = [
    { range: `'Airline Balance'!A1`, values: balance },
    ...valuesPayload,
  ];
  await batchWrite(id, allDataPayload, "USER_ENTERED");

  // 2. Formatting is cosmetic: run it best-effort so a formatting/rate-limit
  // failure can never mark a successful data sync as failed (which previously
  // left the status "error" while the data was actually current).
  try {
    const balSheetId = sheetMap.get("Airline Balance");
    if (balSheetId !== undefined) {
      await formatAirlineBalanceSheet(id, balSheetId, (airlines as any[]).length);
    }
  } catch (formatErr) {
    console.warn("[airline-sheet] Balance formatting skipped:", formatErr);
  }

  // 3. Keep Google Sheets tab order identical to the database/UI airline order.
  // sheetMap is already accurate: adds and deletes during this run were tracked locally.
  const finalSheetMap = sheetMap;
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
    try {
      await batchUpdateSpreadsheet(id, allFormatRequests);
    } catch (formatErr) {
      console.warn("[airline-sheet] Statement formatting skipped:", formatErr);
    }
  }

  return { spreadsheetId: id, url: airlineAccountsSheetUrl(id), syncedAt };
}

/* ---------- Google Sheets sync (fast targeted path) ---------- */

/**
 * Rewrites ONLY the given airlines' statement tabs plus the small Airline
 * Balance summary tab. A transaction save touches one airline, so rebuilding
 * all tabs through the serialized gateway on every save is wasted work that
 * times out and leaves tabs stale. Falls back to the full rebuild in the
 * caller when a tab is missing (e.g. a newly added airline).
 */
export async function syncAirlineAccountsSheetFast(
  airlineIds: string[],
  revision: number
): Promise<{ applied: boolean; error?: string }> {
  const ids = Array.from(new Set((airlineIds || []).map((x) => String(x || "").trim()).filter(Boolean)));
  if (ids.length === 0) return { applied: false, error: "no airline selected" };

  const db = await getAdmin();
  const [a, t] = await Promise.all([
    db.from("airline_ledger_airlines").select("*").order("sort_order"),
    db.from("airline_ledger_transactions").select("*").order("date", { ascending: true }).order("sort_order", { ascending: true }),
  ]);
  if (a.error || t.error) return { applied: false, error: a.error?.message || t.error?.message };
  const airlines = a.data ?? [];
  const txs = t.data ?? [];
  const byId = new Map<string, any>((airlines as any[]).map((x) => [x.id, x]));
  const targets: any[] = [];
  for (const airlineId of ids) {
    const air = byId.get(airlineId);
    if (!air) return { applied: false, error: `airline not found: ${airlineId}` };
    targets.push(air);
  }

  const id = DESIGNATED_SHEET_ID;
  const spreadsheet = await getSpreadsheet(id);
  const sheetMap = new Map<string, number>((spreadsheet.sheets ?? []).map((x) => [x.properties.title as string, x.properties.sheetId as number]));
  const gridBySheetId = new Map<number, number>((spreadsheet.sheets ?? []).map((x) => [x.properties.sheetId as number, (x.properties as any).gridProperties?.columnCount ?? 0]));

  const tabNames = targets.map((air) => safeAirlineTabName(air.name));
  for (const tabName of tabNames) {
    if (!sheetMap.has(tabName)) return { applied: false, error: `airline tab missing: ${tabName}` };
  }

  const payloads = targets.map((air) => {
    const tabName = safeAirlineTabName(air.name);
    const rows = sortTransactionsByDate((txs as any[]).filter((r) => r.airline_id === air.id));
    return buildAirlineTab(air, rows, tabName, sheetMap.get(tabName)!);
  });

  // Make sure each touched tab's grid is at least as wide as its write.
  const expandGridRequests: any[] = [];
  for (const p of payloads) {
    const current = gridBySheetId.get(p.formatTask.sheetId) ?? 0;
    if (p.writeCols > current) {
      expandGridRequests.push({
        updateSheetProperties: {
          properties: { sheetId: p.formatTask.sheetId, gridProperties: { columnCount: p.writeCols } },
          fields: "gridProperties.columnCount",
        },
      });
    }
  }
  if (expandGridRequests.length) await batchUpdateSpreadsheet(id, expandGridRequests);

  const { balance } = buildAirlineBalanceSummary(airlines as any[], txs as any[]);
  await batchClear(id, [...tabNames.map((t) => quoteSheet(t)), `'Airline Balance'`]);
  await batchWrite(
    id,
    [{ range: `'Airline Balance'!A1`, values: balance }, ...payloads.map((p) => ({ range: p.range, values: p.specific }))],
    "USER_ENTERED"
  );

  // Formatting is cosmetic and best-effort, exactly like the full rebuild.
  try {
    const balSheetId = sheetMap.get("Airline Balance");
    if (balSheetId !== undefined) {
      await formatAirlineBalanceSheet(id, balSheetId, (airlines as any[]).length);
    }
  } catch (formatErr) {
    console.warn("[airline-sheet] Fast sync balance formatting skipped:", formatErr);
  }
  try {
    const allFormatRequests: any[] = [];
    for (const task of payloads.map((p) => p.formatTask)) {
      allFormatRequests.push(...buildRohiExportFormattingRequests(task.sheetId, task));
    }
    if (allFormatRequests.length) await batchUpdateSpreadsheet(id, allFormatRequests);
  } catch (formatErr) {
    console.warn("[airline-sheet] Fast sync statement formatting skipped:", formatErr);
  }

  return { applied: true };
}

export async function syncAirlineContactDetailsSheet(customContacts?: any[]): Promise<{ status: "success" | "failed"; sheet: string; error?: string }> {
  try {
    let contacts = customContacts;
    if (!contacts || !contacts.length) {
      try {
        const db = await getAdmin();
        const { data, error } = await (db as any)
          .from("airline_contacts")
          .select("*")
          .eq("is_active", true)
          .order("sort_order", { ascending: true })
          .order("airline_name", { ascending: true });
        if (!error && data && data.length) {
          contacts = data;
        }
      } catch (dbErr) {
        console.warn("[airline-accounts-sheet] Could not read airline_contacts from DB, using fallback:", dbErr);
      }
    }

    if (!contacts || !contacts.length) {
      const { DEFAULT_AIRLINE_CONTACTS } = await import("@/lib/airline-contacts.functions");
      contacts = DEFAULT_AIRLINE_CONTACTS;
    }

    const id = await ensureSpreadsheet();
    const tabName = "Airline Contact Details";

    // Ensure tab exists and get its sheetId
    const meta = await gw(`/spreadsheets/${id}?fields=sheets.properties`);
    const sheetMap = new Map<string, number>(
      (meta.sheets ?? []).map((x: any) => [x.properties.title as string, x.properties.sheetId as number])
    );

    let sheetId = sheetMap.get(tabName);
    if (sheetId === undefined) {
      const addRes = await gw(`/spreadsheets/${id}:batchUpdate`, {
        method: "POST",
        body: JSON.stringify({
          requests: [
            {
              addSheet: {
                properties: {
                  title: tabName,
                  index: 1,
                  tabColorStyle: { rgbColor: { red: 217 / 255, green: 119 / 255, blue: 87 / 255 } },
                  gridProperties: { rowCount: Math.max(100, contacts.length + 10), columnCount: 10, frozenRowCount: 2 },
                },
              },
            },
          ],
        }),
      });
      sheetId = addRes.replies[0].addSheet.properties.sheetId;
    } else {
      // Ensure grid has at least 10 columns
      await gw(`/spreadsheets/${id}:batchUpdate`, {
        method: "POST",
        body: JSON.stringify({
          requests: [
            {
              updateSheetProperties: {
                properties: {
                  sheetId,
                  gridProperties: { columnCount: 10, frozenRowCount: 2 },
                },
                fields: "gridProperties(columnCount,frozenRowCount)",
              },
            },
          ],
        }),
      });
    }

    // Build values across 10 columns:
    // Airline Name, Contact Person, Contact Number, Sales Support, Top UP Email, OTB Email, Bank Name, Account Title, IBAN, Address
    const values: unknown[][] = [
      ["✈  ROHI INTERNATIONAL TRAVELS  |  AIRLINE CONTACT DETAILS", "", "", "", "", "", "", "", "", ""],
      [
        "AIRLINE NAME",
        "CONTACT PERSON",
        "AIRLINE CONTACT NUMBER",
        "SALES SUPPORT",
        "TOP UP EMAIL",
        "OTB EMAIL",
        "BANK NAME",
        "ACCOUNT TITLE",
        "IBAN",
        "ADDRESS",
      ],
    ];

    for (const c of contacts) {
      values.push([
        String(c.airline_name || "").trim(),
        String(c.contact_person || "").trim(),
        String(c.contact_number || "").trim(),
        String(c.sales_support || "").trim(),
        String(c.topup_email || "").trim(),
        String(c.otb_email || "").trim(),
        String(c.bank_name || "").trim(),
        String(c.account_title || "").trim(),
        String(c.iban || "").trim(),
        String(c.address || "").trim(),
      ]);
    }

    // Clear and write across A:J
    await clearSheet(id, tabName);
    await writeRange(id, `${quoteSheet(tabName)}!A1:J${values.length}`, values);

    // Apply Rohi Warm Clay formatting
    const BRAND_ACCENT = { red: 217 / 255, green: 119 / 255, blue: 87 / 255 };
    const BRAND_DARK = { red: 20 / 255, green: 20 / 255, blue: 19 / 255 };
    const BRAND_CREAM = { red: 250 / 255, green: 249 / 255, blue: 245 / 255 };
    const BRAND_WHITE = { red: 1.0, green: 1.0, blue: 1.0 };
    const BRAND_BORDER = { red: 231 / 255, green: 229 / 255, blue: 228 / 255 };
    const BRAND_TEXT = { red: 28 / 255, green: 25 / 255, blue: 23 / 255 };

    const formatRequests: any[] = [
      {
        mergeCells: {
          range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 10 },
          mergeType: "MERGE_ALL",
        },
      },
      {
        repeatCell: {
          range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 10 },
          cell: {
            userEnteredFormat: {
              backgroundColor: BRAND_ACCENT,
              horizontalAlignment: "CENTER",
              verticalAlignment: "MIDDLE",
              textFormat: { bold: true, fontSize: 12, foregroundColor: BRAND_WHITE },
            },
          },
          fields: "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)",
        },
      },
      {
        repeatCell: {
          range: { sheetId, startRowIndex: 1, endRowIndex: 2, startColumnIndex: 0, endColumnIndex: 10 },
          cell: {
            userEnteredFormat: {
              backgroundColor: BRAND_DARK,
              horizontalAlignment: "CENTER",
              verticalAlignment: "MIDDLE",
              textFormat: { bold: true, fontSize: 10, foregroundColor: BRAND_CREAM },
            },
          },
          fields: "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)",
        },
      },
      {
        repeatCell: {
          range: { sheetId, startRowIndex: 2, endRowIndex: values.length, startColumnIndex: 0, endColumnIndex: 10 },
          cell: {
            userEnteredFormat: {
              backgroundColor: BRAND_CREAM,
              verticalAlignment: "MIDDLE",
              wrapStrategy: "WRAP",
              textFormat: { fontSize: 10, foregroundColor: BRAND_TEXT },
            },
          },
          fields: "userEnteredFormat(backgroundColor,textFormat,verticalAlignment,wrapStrategy)",
        },
      },
      {
        repeatCell: {
          range: { sheetId, startRowIndex: 2, endRowIndex: values.length, startColumnIndex: 0, endColumnIndex: 1 },
          cell: {
            userEnteredFormat: {
              horizontalAlignment: "CENTER",
              textFormat: { bold: true, fontSize: 10, foregroundColor: BRAND_TEXT },
            },
          },
          fields: "userEnteredFormat(horizontalAlignment,textFormat)",
        },
      },
      // Column widths: Airline Name, Contact Person, Number, Sales Support, Top UP, OTB, Bank, Title, IBAN, Address
      { updateDimensionProperties: { range: { sheetId, dimension: "COLUMNS", startIndex: 0, endIndex: 1 }, properties: { pixelSize: 140 }, fields: "pixelSize" } },
      { updateDimensionProperties: { range: { sheetId, dimension: "COLUMNS", startIndex: 1, endIndex: 2 }, properties: { pixelSize: 160 }, fields: "pixelSize" } },
      { updateDimensionProperties: { range: { sheetId, dimension: "COLUMNS", startIndex: 2, endIndex: 3 }, properties: { pixelSize: 190 }, fields: "pixelSize" } },
      { updateDimensionProperties: { range: { sheetId, dimension: "COLUMNS", startIndex: 3, endIndex: 4 }, properties: { pixelSize: 220 }, fields: "pixelSize" } },
      { updateDimensionProperties: { range: { sheetId, dimension: "COLUMNS", startIndex: 4, endIndex: 5 }, properties: { pixelSize: 200 }, fields: "pixelSize" } },
      { updateDimensionProperties: { range: { sheetId, dimension: "COLUMNS", startIndex: 5, endIndex: 6 }, properties: { pixelSize: 200 }, fields: "pixelSize" } },
      { updateDimensionProperties: { range: { sheetId, dimension: "COLUMNS", startIndex: 6, endIndex: 7 }, properties: { pixelSize: 140 }, fields: "pixelSize" } },
      { updateDimensionProperties: { range: { sheetId, dimension: "COLUMNS", startIndex: 7, endIndex: 8 }, properties: { pixelSize: 170 }, fields: "pixelSize" } },
      { updateDimensionProperties: { range: { sheetId, dimension: "COLUMNS", startIndex: 8, endIndex: 9 }, properties: { pixelSize: 220 }, fields: "pixelSize" } },
      { updateDimensionProperties: { range: { sheetId, dimension: "COLUMNS", startIndex: 9, endIndex: 10 }, properties: { pixelSize: 280 }, fields: "pixelSize" } },
      { updateDimensionProperties: { range: { sheetId, dimension: "ROWS", startIndex: 0, endIndex: 1 }, properties: { pixelSize: 40 }, fields: "pixelSize" } },
      { updateDimensionProperties: { range: { sheetId, dimension: "ROWS", startIndex: 1, endIndex: 2 }, properties: { pixelSize: 34 }, fields: "pixelSize" } },
      {
        updateBorders: {
          range: { sheetId, startRowIndex: 0, endRowIndex: values.length, startColumnIndex: 0, endColumnIndex: 10 },
          top: { style: "SOLID", color: BRAND_BORDER },
          bottom: { style: "SOLID", color: BRAND_BORDER },
          left: { style: "SOLID", color: BRAND_BORDER },
          right: { style: "SOLID", color: BRAND_BORDER },
          innerHorizontal: { style: "SOLID", color: BRAND_BORDER },
          innerVertical: { style: "SOLID", color: BRAND_BORDER },
        },
      },
    ];

    await gw(`/spreadsheets/${id}:batchUpdate`, {
      method: "POST",
      body: JSON.stringify({ requests: formatRequests }),
    });

    return { status: "success", sheet: tabName };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[airline-accounts-sheet] syncAirlineContactDetailsSheet error:", err);
    return { status: "failed", sheet: "Airline Contact Details", error: msg };
  }
}
