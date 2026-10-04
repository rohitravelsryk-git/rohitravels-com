// Google Sheets access through the Lovable connector gateway.
// SERVER ONLY — never import from browser code.

const GATEWAY = "https://connector-gateway.lovable.dev/google_sheets/v4";

function keys() {
  const lovableKey = typeof process !== "undefined" ? process.env["LOVABLE_API_KEY"] : undefined;
  const connKey = typeof process !== "undefined" ? process.env["GOOGLE_SHEETS_API_KEY"] : undefined;
  if (!lovableKey || !connKey) {
    throw new Error(
      "Google Sheets is not connected (missing LOVABLE_API_KEY or GOOGLE_SHEETS_API_KEY).",
    );
  }
  return { lovableKey, connKey };
}

let gatewayTail: Promise<void> = Promise.resolve();
let lastGatewayRequestAt = 0;

async function acquireGatewaySlot(): Promise<() => void> {
  let release!: () => void;
  const turn = new Promise<void>((resolve) => { release = resolve; });
  const previous = gatewayTail;
  gatewayTail = previous.then(() => turn);
  await previous;

  const waitMs = Math.max(0, 1050 - (Date.now() - lastGatewayRequestAt));
  if (waitMs) await new Promise((resolve) => setTimeout(resolve, waitMs));
  lastGatewayRequestAt = Date.now();
  return release;
}

function retryDelayMs(attempt: number, retryAfterHeader: string | null): number {
  const retryAfterSeconds = retryAfterHeader ? Number(retryAfterHeader) : NaN;
  if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds >= 0) {
    return Math.min(64_000, Math.max(1_000, Math.ceil(retryAfterSeconds * 1000)));
  }
  const base = Math.min(64_000, 1_000 * 2 ** attempt);
  return base + Math.floor(Math.random() * 1_000);
}

async function call<T>(
  method: "GET" | "POST" | "PUT",
  path: string,
  body?: unknown,
  attempt = 0,
): Promise<T> {
  const { lovableKey, connKey } = keys();
  const release = await acquireGatewaySlot();
  let res: Response;
  try {
    res = await fetch(`${GATEWAY}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": connKey,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  } finally {
    release();
  }

  if (!res.ok) {
    const text = await res.text();
    const retryable = res.status === 429 || res.status >= 500;
    if (retryable && attempt < 6) {
      const waitMs = retryDelayMs(attempt, res.headers.get("retry-after"));
      await new Promise((r) => setTimeout(r, waitMs));
      return call<T>(method, path, body, attempt + 1);
    }
    throw new Error(`Google Sheets request failed [${res.status}] ${method} ${path}: ${text}`);
  }
  return (await res.json()) as T;
}

export type SpreadsheetInfo = {
  spreadsheetId: string;
  spreadsheetUrl?: string;
  sheets?: { properties: { sheetId: number; title: string } }[];
};

export async function createSpreadsheet(title: string): Promise<SpreadsheetInfo> {
  return call<SpreadsheetInfo>("POST", "/spreadsheets", {
    properties: { title },
    sheets: [{ properties: { title: "README" } }],
  });
}

export async function getSpreadsheet(id: string): Promise<SpreadsheetInfo> {
  return call<SpreadsheetInfo>(
    "GET",
    `/spreadsheets/${id}?fields=spreadsheetId,spreadsheetUrl,sheets.properties`,
  );
}

export async function addSheet(id: string, title: string): Promise<number | null> {
  const res = await call<{ replies?: { addSheet?: { properties?: { sheetId?: number } } }[] }>(
    "POST",
    `/spreadsheets/${id}:batchUpdate`,
    { requests: [{ addSheet: { properties: { title } } }] },
  );
  return res.replies?.[0]?.addSheet?.properties?.sheetId ?? null;
}

export async function deleteSheet(id: string, sheetId: number): Promise<void> {
  await call(
    "POST",
    `/spreadsheets/${id}:batchUpdate`,
    { requests: [{ deleteSheet: { sheetId } }] },
  );
}

// ---------- brand formatting (shared "Rohi" look across every Google Sheet tab) ----------
// Same palette as the Excel/PDF exports in src/lib/table-export.ts:
// accent #D97757 (banner), #141413 near-black (header row), #FAF9F5 off-white (header text / banding).
const BRAND = {
  accent: { red: 0.851, green: 0.467, blue: 0.341 }, // #D97757
  dark: { red: 0.078, green: 0.078, blue: 0.075 }, // #141413
  offWhite: { red: 0.98, green: 0.976, blue: 0.961 }, // #FAF9F5
  white: { red: 1, green: 1, blue: 1 },
};

/**
 * Applies the shared Rohi brand look to one worksheet tab: an optional accent-colored
 * title banner row, a dark bold header row, a frozen header, and light row banding.
 * Best-effort — callers should swallow errors so formatting never blocks a data sync.
 */
export async function applyBrandFormatting(
  spreadsheetId: string,
  sheetId: number,
  opts: { headerRowIndex: number; columnCount: number; hasTitleBanner?: boolean },
): Promise<void> {
  const { headerRowIndex, columnCount, hasTitleBanner = false } = opts;
  const endCol = Math.max(columnCount, 1);
  const requests: any[] = [];

  if (hasTitleBanner && headerRowIndex > 0) {
    requests.push({
      repeatCell: {
        range: { sheetId, startRowIndex: 0, endRowIndex: headerRowIndex, startColumnIndex: 0, endColumnIndex: endCol },
        cell: { userEnteredFormat: { backgroundColor: BRAND.accent, textFormat: { bold: true, fontSize: 13, foregroundColor: BRAND.white } } },
        fields: "userEnteredFormat(backgroundColor,textFormat)",
      },
    });
  }

  requests.push({
    repeatCell: {
      range: { sheetId, startRowIndex: headerRowIndex, endRowIndex: headerRowIndex + 1, startColumnIndex: 0, endColumnIndex: endCol },
      cell: { userEnteredFormat: { backgroundColor: BRAND.dark, textFormat: { bold: true, foregroundColor: BRAND.offWhite } } },
      fields: "userEnteredFormat(backgroundColor,textFormat)",
    },
  });

  requests.push({
    updateSheetProperties: {
      properties: { sheetId, gridProperties: { frozenRowCount: headerRowIndex + 1 } },
      fields: "gridProperties.frozenRowCount",
    },
  });

  // Header color + frozen row are idempotent (safe to re-apply on every sync run).
  await call("POST", `/spreadsheets/${spreadsheetId}:batchUpdate`, { requests });

  // Row banding can only be added once per overlapping range — a repeat sync run
  // would error here, so this runs as its own best-effort call the caller can ignore.
  await call("POST", `/spreadsheets/${spreadsheetId}:batchUpdate`, {
    requests: [
      {
        addBanding: {
          bandedRange: {
            range: { sheetId, startRowIndex: headerRowIndex + 1, startColumnIndex: 0, endColumnIndex: endCol },
            rowProperties: { firstBandColor: BRAND.white, secondBandColor: BRAND.offWhite },
          },
        },
      },
    ],
  });
}

export async function readRange(id: string, range: string): Promise<string[][]> {
  const out = await call<{ values?: string[][] }>(
    "GET",
    `/spreadsheets/${id}/values/${range}?valueRenderOption=UNFORMATTED_VALUE`,
  );
  return out.values ?? [];
}

export async function writeRange(id: string, range: string, values: unknown[][]): Promise<void> {
  await call("PUT", `/spreadsheets/${id}/values/${range}?valueInputOption=RAW`, {
    range,
    majorDimension: "ROWS",
    values,
  });
}

export async function batchWrite(
  id: string,
  data: { range: string; values: unknown[][] }[],
): Promise<void> {
  if (!data.length) return;
  // Sheets caps request size; chunk conservatively.
  for (let i = 0; i < data.length; i += 200) {
    await call("POST", `/spreadsheets/${id}/values:batchUpdate`, {
      valueInputOption: "RAW",
      data: data.slice(i, i + 200).map((d) => ({ ...d, majorDimension: "ROWS" })),
    });
  }
}

export async function appendRows(id: string, sheet: string, values: unknown[][]): Promise<void> {
  if (!values.length) return;
  for (let i = 0; i < values.length; i += 2000) {
    await call(
      "POST",
      `/spreadsheets/${id}/values/${quoteSheet(sheet)}!A1:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
      { majorDimension: "ROWS", values: values.slice(i, i + 2000) },
    );
  }
}

export async function clearSheet(id: string, sheet: string): Promise<void> {
  await call("POST", `/spreadsheets/${id}/values/${quoteSheet(sheet)}!A:ZZ:clear`, {});
}

export function quoteSheet(name: string): string {
  return `'${name.replace(/'/g, "''")}'`;
}

// Column index (0-based) -> A1 letters.
export function colLetter(index: number): string {
  let n = index + 1;
  let s = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}
