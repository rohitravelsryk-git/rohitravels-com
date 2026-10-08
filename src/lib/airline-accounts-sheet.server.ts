import { addSheet, applyRohiExportFormatting, clearSheet, deleteSheet, getSpreadsheet, writeRange, quoteSheet } from "@/lib/backup/sheets.server";
import { airlineIataCode, airlineLogoUrl } from "@/lib/airline-branding";

// Mirrors the Airline Accounts database into ONE Google Sheet named "Airline Accounts".
// Tabs: "Airline Balance" (summary), "Airline Ledger" (statement/details),
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

  const balance: unknown[][] = [
    [`ROHI INTERNATIONAL TRAVELS — AIRLINE BALANCE  (updated ${syncedAt.slice(0, 16).replace("T", " ")} UTC, revision ${revision})`],
    ["LOGO", "AIRLINE", "IATA", "OPENING BALANCE", "OPENING DATE", "ENTRIES", "TOTAL TICKET SALES", "TOTAL CREDIT", "TOTAL VOID CHARGES", "PROFIT", "CURRENT BALANCE"],
  ];
  const ledger: unknown[][] = [
    ["ROHI INTERNATIONAL TRAVELS — AIRLINE LEDGER / STATEMENT"],
    ["AIRLINE", "CODE", "SR #", "DATE", "AGENT", "PASSENGER", "SECTOR", "PNR", "TICKET SALES", "DEBIT IN ID", "CREDIT FROM ID", "PROFIT", "BALANCE", "CONTACT", "VOID CHARGES", "LEDGER ENTRY"],
  ];
  const tot = { sales: 0, credit: 0, voids: 0, profit: 0, bal: 0 };

  for (const air of airlines as any[]) {
    const rows = (txs as any[]).filter((r) => r.airline_id === air.id);
    let running = n(air.opening_balance);
    let sales = 0, credit = 0, voids = 0;
    ledger.push([air.name, air.code, "", s(air.opening_balance_date), "", "", "", "", "", "", "", "", running, "", "", "OPENING BALANCE"]);
    rows.forEach((r, i) => {
      const c = n(r.credit_from_id);
      running -= c;
      sales += n(r.ticket_sales); credit += c; voids += n(r.void_charges);
      ledger.push([
        air.name, air.code, i + 1, s(r.date), s(r.agent_name), s(r.pax_name), s(r.sector), s(r.pnr),
        n(r.ticket_sales), s(r.debit_in_id), c, n(r.ticket_sales) - c, running, s(r.pax_contact), n(r.void_charges),
        [r.pax_name, r.sector, r.pnr, air.code].map((v) => s(v).trim()).filter(Boolean).join(" - "),
      ]);
    });
    ledger.push([]);
    const iata = airlineIataCode(air.name, air.code);
    balance.push(["", air.name, iata, n(air.opening_balance), s(air.opening_balance_date), rows.length, sales, credit, voids, sales - credit, running]);
    tot.sales += sales; tot.credit += credit; tot.voids += voids; tot.profit += sales - credit; tot.bal += running;
  }
  balance.push([], ["", "TOTAL", "", "", "", txs.length, tot.sales, tot.credit, tot.voids, tot.profit, tot.bal]);

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
      valueInputOption: "RAW",
      data: [
        { range: `'Airline Balance'!A1`, values: balance },
        { range: `'Airline Ledger'!A1`, values: ledger },
        { range: `'_DATA'!A1`, values: data },
      ],
    }),
  });
  const summarySpreadsheet = await getSpreadsheet(id);
  const summarySheetId = (summarySpreadsheet.sheets ?? []).find((x) => x.properties.title === "Airline Balance")?.properties.sheetId;
  if (summarySheetId !== undefined) {
    await writeImageFormulas(
      id,
      (airlines as any[]).map((air, index) => ({
        sheetId: summarySheetId,
        rowIndex: 2 + index,
        columnIndex: 0,
        url: airlineLogoUrl(air.code, air.name) ?? "",
      })),
    );
  }

  // Create/refresh one dedicated tab for every airline, using the exact same
  // Rohi export layout, typography, spacing, filters, number formats, frozen
  // header and accent tab color as the Banks & Wallets account tabs.
  const spreadsheet = await getSpreadsheet(id);
  const sheetMap = new Map((spreadsheet.sheets ?? []).map((x) => [x.properties.title, x.properties.sheetId] as const));
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
    let running = n(air.opening_balance);
    const specific: unknown[][] = [
      ["ROHI INTERNATIONAL TRAVELS", "", "", "", "", "", "", "", "", "", ""],
      [`Airline: ${s(air.name)}${s(air.code) ? `  •  ${s(air.code)}` : ""}`, "", "", "", "", "", "", "", "", "", ""],
      ["Airline Account Statement", "", "", "", "", "", "", "", "", "", ""],
      [`Opening Balance: ${running.toLocaleString()}  •  Entries: ${rows.length}  •  Current Balance: ${running.toLocaleString()}`, "", "", "", "", "", "", "", "", "", ""],
      ["Date", "Agent", "Passenger", "Sector", "PNR", "Ticket Sales", "Credit From ID", "Void Charges", "Profit", "Running Balance", "Remarks"],
      [s(air.opening_balance_date), "", "", "", "", 0, "", 0, 0, running, "OPENING BALANCE"],
    ];

    for (const r of rows) {
      const credit = n(r.credit_from_id);
      running -= credit;
      const sales = n(r.ticket_sales);
      const voids = n(r.void_charges);
      specific.push([
        s(r.date),
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

    await clearSheet(id, tabName);
    await writeRange(id, `${quoteSheet(tabName)}!A1:K${specific.length}`, specific);
    await applyRohiExportFormatting(id, sheetId, {
      columnCount: 11,
      dataEndRow: specific.length,
      numericColumnIndexes: [5, 6, 7, 8, 9],
      dateColumnIndexes: [0],
    });
  }

  // Keep Google Sheets tab order identical to the database/UI airline order.
  const finalSpreadsheet = await getSpreadsheet(id);
  const finalSheetMap = new Map(
    (finalSpreadsheet.sheets ?? []).map((x) => [x.properties.title, x.properties.sheetId] as const),
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
  if (orderRequests.length) {
    await gw(`/spreadsheets/${id}:batchUpdate`, {
      method: "POST",
      body: JSON.stringify({ requests: orderRequests }),
    });
  }

  return { spreadsheetId: id, url: airlineAccountsSheetUrl(id), syncedAt };
}
