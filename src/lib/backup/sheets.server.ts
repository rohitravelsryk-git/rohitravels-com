// Google Sheets access through the Lovable connector gateway.
// SERVER ONLY — never import from browser code.

const GATEWAY = "https://connector-gateway.lovable.dev/google_sheets/v4";

function keys() {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const connKey = process.env["GOOGLE_SHEETS_API_KEY"];
  if (!lovableKey || !connKey) {
    throw new Error(
      "Google Sheets is not connected (missing LOVABLE_API_KEY or GOOGLE_SHEETS_API_KEY).",
    );
  }
  return { lovableKey, connKey };
}

async function call<T>(
  method: "GET" | "POST" | "PUT",
  path: string,
  body?: unknown,
  attempt = 0,
): Promise<T> {
  const { lovableKey, connKey } = keys();
  const res = await fetch(`${GATEWAY}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": connKey,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  if (!res.ok) {
    const text = await res.text();
    // Retry transient failures with exponential backoff.
    const retryable = res.status === 429 || res.status >= 500;
    if (retryable && attempt < 4) {
      const waitMs = Math.min(16000, 500 * 2 ** attempt);
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

export async function addSheet(id: string, title: string): Promise<void> {
  await call("POST", `/spreadsheets/${id}:batchUpdate`, {
    requests: [{ addSheet: { properties: { title } } }],
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
