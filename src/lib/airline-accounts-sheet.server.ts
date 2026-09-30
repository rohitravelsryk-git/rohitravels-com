// Mirrors the Airline Accounts database into ONE Google Sheet named "Airline Accounts".
// Tabs: "Airline Balance" (summary), "Airline Ledger" (statement/details),
// "_DATA" (hidden raw records for recovery). No SNAP tabs are ever created.
// One-way: database -> sheet. The database stays the source of truth.

const GATEWAY = "https://connector-gateway.lovable.dev/google_sheets/v4";
const SETTING_KEY = "airline_accounts_sheet_id";
const TITLE = "Airline Accounts";
const TABS = ["Airline Balance", "Airline Ledger", "_DATA"] as const;

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

async function getAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function ensureSpreadsheet(): Promise<string> {
  const db = await getAdmin();
  const { data } = await db.from("site_settings").select("value").eq("key", SETTING_KEY).maybeSingle();
  let id = data?.value || "";

  if (id) {
    try {
      const meta = await gw(`/spreadsheets/${id}?fields=sheets.properties`);
      const existing = new Set<string>((meta.sheets ?? []).map((x: any) => x.properties?.title));
      const missing = TABS.filter((t) => !existing.has(t));
      if (missing.length) {
        await gw(`/spreadsheets/${id}:batchUpdate`, {
          method: "POST",
          body: JSON.stringify({
            requests: missing.map((title) => ({ addSheet: { properties: { title, hidden: title === "_DATA" } } })),
          }),
        });
      }
      return id;
    } catch (e) {
      if (!String(e).includes("[404]")) throw e;
      id = ""; // sheet was deleted in Drive: create a fresh one
    }
  }

  const created = await gw(`/spreadsheets`, {
    method: "POST",
    body: JSON.stringify({
      properties: { title: TITLE },
      sheets: TABS.map((title) => ({
        properties: { title, hidden: title === "_DATA", gridProperties: { frozenRowCount: title === "_DATA" ? 1 : 2 } },
      })),
    }),
  });
  id = created.spreadsheetId as string;
  await db.from("site_settings").upsert({ key: SETTING_KEY, value: id, updated_at: new Date().toISOString() });

  // Warm Clay header styling on the two visible tabs.
  const sheetIds = (created.sheets ?? []).map((x: any) => x.properties);
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
    ["AIRLINE", "CODE", "OPENING BALANCE", "OPENING DATE", "ENTRIES", "TOTAL TICKET SALES", "TOTAL CREDIT", "TOTAL VOID CHARGES", "PROFIT", "CURRENT BALANCE"],
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
    balance.push([air.name, air.code, n(air.opening_balance), s(air.opening_balance_date), rows.length, sales, credit, voids, sales - credit, running]);
    tot.sales += sales; tot.credit += credit; tot.voids += voids; tot.profit += sales - credit; tot.bal += running;
  }
  balance.push([], ["TOTAL", "", "", "", txs.length, tot.sales, tot.credit, tot.voids, tot.profit, tot.bal]);

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
  return { spreadsheetId: id, url: airlineAccountsSheetUrl(id), syncedAt };
}
