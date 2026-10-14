import { createServerFn } from "@tanstack/react-start";
import { useSession } from "@tanstack/react-start/server";
import { z } from "zod";

type GateSession = { unlocked?: boolean; staffUsername?: string | null };

function sessionConfig() {
  const password = typeof process !== "undefined" ? (process.env.ROHI_SESSION_SECRET || process.env.SESSION_SECRET) : undefined;
  if (!password) throw new Error("ROHI_SESSION_SECRET is not configured");
  return {
    password,
    name: "rohi-admin",
    maxAge: 60 * 60 * 8,
    cookie: { httpOnly: true, secure: true, sameSite: "lax" as const, path: "/" },
  };
}

async function requireUnlocked() {
  try {
    const s = await useSession<GateSession>(sessionConfig());
    if (!s.data.unlocked) throw new Error("Unauthorized");
    return s;
  } catch (e) {
    throw e;
  }
}

export type Vendor = {
  id: string;
  vendor_code: string;
  name: string;
  category: string;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
  opening_balance: number;
  current_balance: number;
  is_active: boolean;
  notes: string | null;
  created_at?: string;
  updated_at?: string;
};

export const DEFAULT_VENDORS: Vendor[] = [
  {
    id: "04ae79c7-5aab-442a-996b-dbad46ff49bf",
    vendor_code: "VND-1001",
    name: "Rohi Travels",
    category: "Airline / GDS",
    contact_person: "Muhammad Irfan",
    phone: "0300-9670463",
    email: "rohitravels@gmail.com",
    city: "Rahim Yar Khan",
    opening_balance: 0,
    current_balance: 0,
    is_active: true,
    notes: "Official Partner",
    created_at: "2026-10-03T09:50:28.202Z",
  },
  {
    id: "11d6645f-dcd3-4dbc-beb1-1bc454c490d2",
    vendor_code: "VND-1002",
    name: "Madina Travels",
    category: "Vendor",
    contact_person: "Waqas Aslam",
    phone: "0302-3366762",
    email: "madinatravels.ryk@gmail.com",
    city: "Rahim Yar Khan",
    opening_balance: 0,
    current_balance: 0,
    is_active: true,
    notes: "Direct Supplier",
    created_at: "2026-10-03T09:50:28.202Z",
  },
];

const vendorInputSchema = z.object({
  vendor_code: z.string().trim().max(40).optional(),
  name: z.string().trim().min(1, "Vendor name is required").max(120),
  category: z.string().trim().default("Airline / GDS"),
  contact_person: z.string().trim().max(120).optional().nullable(),
  phone: z.string().trim().max(40).optional().nullable(),
  email: z.string().trim().max(160).optional().nullable(),
  city: z.string().trim().max(80).optional().nullable(),
  opening_balance: z.number().default(0),
  current_balance: z.number().default(0),
  is_active: z.boolean().default(true),
  notes: z.string().trim().max(1000).optional().nullable(),
});

/**
 * List all vendors for admin views.
 * Queries Supabase `public.vendors` table, falling back to DEFAULT_VENDORS if unmigrated or empty.
 */
export const listVendorsAdmin = createServerFn({ method: "GET" }).handler(async () => {
  await requireUnlocked();
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("vendors")
      .select("*")
      .order("vendor_code", { ascending: true });

    if (error) {
      console.warn("[vendors] Database query failed, using defaults:", error.message);
      return DEFAULT_VENDORS;
    }
    if (!data || data.length === 0) {
      return DEFAULT_VENDORS;
    }
    return data.map((v: any) => ({
      id: v.id,
      vendor_code: v.vendor_code || "VND-1000",
      name: v.name || "",
      category: v.category || "Vendor",
      contact_person: v.contact_person || null,
      phone: v.phone || null,
      email: v.email || null,
      city: v.city || null,
      opening_balance: Number(v.opening_balance) || 0,
      current_balance: Number(v.current_balance) || 0,
      is_active: v.is_active !== false,
      notes: v.notes || null,
      created_at: v.created_at,
      updated_at: v.updated_at,
    })) as Vendor[];
  } catch (err) {
    console.warn("[vendors] Falling back to default vendors:", err);
    return DEFAULT_VENDORS;
  }
});

/**
 * Backward compatible listVendors function used by admin.index.tsx, admin.tickets.tsx, and accounts-book.
 */
export const listVendors = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("vendors")
      .select("*")
      .order("name", { ascending: true });

    if (error || !data || data.length === 0) {
      return DEFAULT_VENDORS;
    }
    return data.map((v: any) => ({
      id: v.id,
      vendor_code: v.vendor_code || "VND-1000",
      name: v.name || "",
      category: v.category || "Vendor",
      contact_person: v.contact_person || null,
      phone: v.phone || null,
      email: v.email || null,
      city: v.city || null,
      opening_balance: Number(v.opening_balance) || 0,
      current_balance: Number(v.current_balance) || 0,
      is_active: v.is_active !== false,
      notes: v.notes || null,
      created_at: v.created_at,
      updated_at: v.updated_at,
    })) as Vendor[];
  } catch (err) {
    return DEFAULT_VENDORS;
  }
});

export const createVendor = createServerFn({ method: "POST" })
  .validator((d: unknown) => vendorInputSchema.parse(d))
  .handler(async ({ data }) => {
    await requireUnlocked();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Auto-generate vendor_code if missing
    let code = data.vendor_code;
    if (!code) {
      const { data: latest } = await supabaseAdmin
        .from("vendors")
        .select("vendor_code")
        .order("created_at", { ascending: false })
        .limit(1);
      const lastCode = latest?.[0]?.vendor_code;
      const numMatch = lastCode?.match(/\d+/);
      const nextNum = numMatch ? parseInt(numMatch[0], 10) + 1 : 1003;
      code = `VND-${nextNum}`;
    }

    const payload = {
      vendor_code: code,
      name: data.name,
      category: data.category,
      contact_person: data.contact_person ?? null,
      phone: data.phone ?? null,
      email: data.email ?? null,
      city: data.city ?? null,
      opening_balance: data.opening_balance ?? 0,
      current_balance: data.current_balance ?? data.opening_balance ?? 0,
      is_active: data.is_active ?? true,
      notes: data.notes ?? null,
    };

    const { data: inserted, error } = await supabaseAdmin
      .from("vendors")
      .insert(payload)
      .select()
      .single();

    if (error) throw new Error(error.message);

    // Trigger instant background sync to Google Sheets
    try {
      await syncVendorsSheetInternal();
    } catch (sheetErr) {
      console.warn("[vendors] Google Sheet sync failed after create:", sheetErr);
    }

    return { ok: true, vendor: inserted };
  });

export const updateVendor = createServerFn({ method: "POST" })
  .validator((d: unknown) => z.object({ id: z.string().uuid() }).merge(vendorInputSchema).parse(d))
  .handler(async ({ data }) => {
    await requireUnlocked();
    const { id, ...patch } = data;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: updated, error } = await supabaseAdmin
      .from("vendors")
      .update({
        ...patch,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) throw new Error(error.message);

    // Trigger instant background sync to Google Sheets
    try {
      await syncVendorsSheetInternal();
    } catch (sheetErr) {
      console.warn("[vendors] Google Sheet sync failed after update:", sheetErr);
    }

    return { ok: true, vendor: updated };
  });

export const deleteVendor = createServerFn({ method: "POST" })
  .validator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    await requireUnlocked();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("vendors").delete().eq("id", data.id);
    if (error) throw new Error(error.message);

    // Trigger instant background sync to Google Sheets
    try {
      await syncVendorsSheetInternal();
    } catch (sheetErr) {
      console.warn("[vendors] Google Sheet sync failed after delete:", sheetErr);
    }

    return { ok: true };
  });

export const toggleVendorStatusAdmin = createServerFn({ method: "POST" })
  .validator((d: { id: string; is_active: boolean }) => z.object({ id: z.string().uuid(), is_active: z.boolean() }).parse(d))
  .handler(async ({ data }) => {
    await requireUnlocked();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("vendors")
      .update({ is_active: data.is_active, updated_at: new Date().toISOString() })
      .eq("id", data.id);

    if (error) throw new Error(error.message);

    try {
      await syncVendorsSheetInternal();
    } catch (sheetErr) {
      console.warn("[vendors] Google Sheet sync failed after status toggle:", sheetErr);
    }

    return { ok: true };
  });

/**
 * Manual live sync trigger for UI button
 */
export const syncVendorsLive = createServerFn({ method: "POST" }).handler(async () => {
  await requireUnlocked();
  return await syncVendorsSheetInternal();
});

/**
 * Core Google Sheets synchronizer for the dedicated Vendors workbook
 * Spreadsheet ID: 1d5aNDN0mIL7rRpWgDCOAd0l59M8s8EUaUBSpRydxjqw
 * Tab: 'Vendors'
 */
export async function syncVendorsSheetInternal(): Promise<{ status: "success" | "failed"; count: number; error?: string }> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let rows: Vendor[] = [];
    try {
      const { data, error } = await supabaseAdmin
        .from("vendors")
        .select("*")
        .order("vendor_code", { ascending: true });
      if (!error && data && data.length > 0) {
        rows = data as Vendor[];
      }
    } catch (e) {
      console.warn("[vendors] Could not fetch vendors from DB for sheet sync:", e);
    }

    if (!rows.length) {
      rows = DEFAULT_VENDORS;
    }

    // Fetch all vendor ledger entries
    let allLedgerRows: any[] = [];
    try {
      const { data: lData } = await supabaseAdmin
        .from("vendor_ledger")
        .select("*")
        .order("transaction_date", { ascending: true })
        .order("created_at", { ascending: true });
      if (lData) allLedgerRows = lData;
    } catch (lErr) {
      console.warn("[vendors] Could not fetch vendor_ledger entries for sheet sync:", lErr);
    }

    const {
      addSheet,
      deleteSheet,
      clearSheet,
      writeRange,
      quoteSheet,
      applyRohiExportFormatting,
      getSpreadsheet,
      colLetter,
    } = await import("@/lib/backup/sheets.server");

    const spreadsheetId = "1d5aNDN0mIL7rRpWgDCOAd0l59M8s8EUaUBSpRydxjqw";

    // Inspect existing sheets
    const meta = await getSpreadsheet(spreadsheetId);
    const existingSheets = new Map<string, number>(
      (meta.sheets ?? []).map((s: any) => [s.properties.title, s.properties.sheetId])
    );

    // ==========================================
    // 1. Tab 'Vendors': Directory of registered vendors
    // ==========================================
    const tabName = "Vendors";
    let directorySheetId = existingSheets.get(tabName) ?? null;
    if (directorySheetId === null) {
      directorySheetId = await addSheet(spreadsheetId, tabName);
      if (directorySheetId !== null) existingSheets.set(tabName, directorySheetId);
    }

    const dirHeaders = [
      "Vendor Code",
      "Vendor Name",
      "Category",
      "Contact Person",
      "Phone",
      "Email",
      "City",
      "Opening Balance (PKR)",
      "Current Balance (PKR)",
      "Active",
      "Created At",
    ];

    const dirValues: unknown[][] = [
      ["ROHI INTERNATIONAL TRAVELS"],
      ["Sardar Market, Shahi Road, Rahim Yar Khan  •  0305-6622988"],
      ["VENDORS & SUPPLIERS - DIRECTORY & BALANCES"],
      [`Official Live Record • ${rows.length} registered vendors • Generated ${new Date().toISOString().slice(0, 10)}`],
      dirHeaders,
    ];

    let sumOpening = 0;
    let sumCurrent = 0;

    for (const v of rows) {
      const op = Number(v.opening_balance) || 0;
      const cur = Number(v.current_balance) || 0;
      sumOpening += op;
      sumCurrent += cur;

      dirValues.push([
        String(v.vendor_code || "").trim(),
        String(v.name || "").trim(),
        String(v.category || "Vendor").trim(),
        String(v.contact_person || "").trim(),
        String(v.phone || "").trim(),
        String(v.email || "").trim(),
        String(v.city || "").trim(),
        op,
        cur,
        v.is_active !== false ? "Yes" : "No",
        String(v.created_at || new Date().toISOString()).slice(0, 10),
      ]);
    }

    // Grand totals
    dirValues.push([
      "TOTALS",
      `Grand Total (${rows.length} Vendors)`,
      "—",
      "—",
      "—",
      "—",
      "—",
      sumOpening,
      sumCurrent,
      "—",
      new Date().toISOString().slice(0, 10),
    ]);

    await clearSheet(spreadsheetId, tabName);
    await writeRange(spreadsheetId, `${quoteSheet(tabName)}!A1:${colLetter(dirHeaders.length - 1)}${dirValues.length}`, dirValues);
    if (directorySheetId !== null) {
      try {
        await applyRohiExportFormatting(spreadsheetId, directorySheetId, {
          columnCount: dirHeaders.length,
          dataEndRow: dirValues.length,
          numericColumnIndexes: [7, 8],
          hasTotalRow: true,
          totalRowIndex: dirValues.length - 1,
        });
      } catch (fErr) {
        console.warn("[vendors] Format error on Vendors tab:", fErr);
      }
    }

    // ==========================================
    // 2. Tab 'Registered Vendors': Master Vendors Ledger
    // ==========================================
    const ledgerTabName = "Registered Vendors";
    let ledgerSheetId = existingSheets.get(ledgerTabName) ?? null;
    if (ledgerSheetId === null) {
      ledgerSheetId = await addSheet(spreadsheetId, ledgerTabName);
      if (ledgerSheetId !== null) existingSheets.set(ledgerTabName, ledgerSheetId);
    }

    const vendorMap = new Map<string, Vendor>(rows.map((v) => [v.id, v]));

    const ledgerHeaders = [
      "Tx ID",
      "Date",
      "Vendor Name",
      "Vendor Code",
      "Category",
      "Reference",
      "Debit (Paid PKR)",
      "Credit (Cost PKR)",
      "Balance (PKR)",
      "Description",
    ];

    const masterLedgerValues: unknown[][] = [
      ["ROHI INTERNATIONAL TRAVELS"],
      ["Sardar Market, Shahi Road, Rahim Yar Khan  •  0305-6622988"],
      ["VENDORS LEDGER - REGISTERED VENDORS TRANSACTIONS JOURNAL"],
      [`Official Live Record • ${allLedgerRows.length} entries across all registered vendors`],
      ledgerHeaders,
    ];

    for (const l of allLedgerRows) {
      const v = vendorMap.get(l.vendor_id);
      const rawDate = l.transaction_date ? String(l.transaction_date).slice(0, 10) : "—";
      masterLedgerValues.push([
        String(l.id || "—").slice(0, 18),
        rawDate,
        v ? v.name : "—",
        v ? v.vendor_code : "—",
        v ? v.category : "Vendor",
        String(l.reference_no || "—"),
        Number(l.debit) || 0,
        Number(l.credit) || 0,
        Number(l.balance) || 0,
        String(l.description || "—"),
      ]);
    }

    await clearSheet(spreadsheetId, ledgerTabName);
    await writeRange(spreadsheetId, `${quoteSheet(ledgerTabName)}!A1:${colLetter(ledgerHeaders.length - 1)}${masterLedgerValues.length}`, masterLedgerValues);
    if (ledgerSheetId !== null) {
      try {
        await applyRohiExportFormatting(spreadsheetId, ledgerSheetId, {
          columnCount: ledgerHeaders.length,
          dataEndRow: masterLedgerValues.length,
          numericColumnIndexes: [6, 7, 8],
          dateColumnIndexes: [1],
        });
      } catch (fErr) {
        console.warn("[vendors] Format error on Registered Vendors tab:", fErr);
      }
    }

    // ==========================================
    // 3. Individual Statement Tabs for Each Registered Vendor
    // ==========================================
    for (const v of rows) {
      const vendorTab = v.name.slice(0, 30);
      let vSheetId = existingSheets.get(vendorTab) ?? null;
      if (vSheetId === null) {
        vSheetId = await addSheet(spreadsheetId, vendorTab);
        if (vSheetId !== null) existingSheets.set(vendorTab, vSheetId);
      }

      const vLedger = allLedgerRows.filter((l) => l.vendor_id === v.id);
      const statementHeaders = [
        "Date",
        "Reference",
        "Details / Description",
        "Debit (Paid PKR)",
        "Credit (Cost PKR)",
        "Balance (PKR)",
      ];

      const vValues: unknown[][] = [
        ["ROHI INTERNATIONAL TRAVELS"],
        ["Sardar Market, Shahi Road, Rahim Yar Khan  •  0305-6622988"],
        [`VENDOR STATEMENT - ${v.name.toUpperCase()}`],
        [`Current Outstanding Balance: Rs ${Number(v.current_balance || 0).toLocaleString()}  •  ${vLedger.length} entries`],
        statementHeaders,
      ];

      let vDebits = 0;
      let vCredits = 0;

      // Add opening balance row if non-zero
      if (Number(v.opening_balance) !== 0) {
        const op = Number(v.opening_balance);
        vValues.push([
          String(v.created_at || new Date().toISOString()).slice(0, 10),
          "OPENING",
          "Opening Balance",
          0,
          op > 0 ? op : 0,
          op,
        ]);
        if (op > 0) vCredits += op;
      }

      for (const l of vLedger) {
        const rawDate = l.transaction_date ? String(l.transaction_date).slice(0, 10) : "—";
        const d = Number(l.debit) || 0;
        const c = Number(l.credit) || 0;
        vDebits += d;
        vCredits += c;
        vValues.push([
          rawDate,
          String(l.reference_no || "—"),
          String(l.description || "—"),
          d,
          c,
          Number(l.balance) || 0,
        ]);
      }

      // Totals Row
      vValues.push([
        "TOTALS",
        "Summary",
        "Statement Total",
        vDebits,
        vCredits,
        Number(v.current_balance) || 0,
      ]);

      await clearSheet(spreadsheetId, vendorTab);
      await writeRange(spreadsheetId, `${quoteSheet(vendorTab)}!A1:${colLetter(statementHeaders.length - 1)}${vValues.length}`, vValues);
      if (vSheetId !== null) {
        try {
          await applyRohiExportFormatting(spreadsheetId, vSheetId, {
            columnCount: statementHeaders.length,
            dataEndRow: vValues.length,
            numericColumnIndexes: [3, 4, 5],
            dateColumnIndexes: [0],
            hasTotalRow: true,
            totalRowIndex: vValues.length - 1,
          });
        } catch (fErr) {
          console.warn(`[vendors] Format error on tab "${vendorTab}":`, fErr);
        }
      }
    }

    // ==========================================
    // 4. Prune Tabs for Deleted Vendors
    // ==========================================
    const protectedTabs = new Set(["Vendors", "Registered Vendors", "README", "_DATA"]);
    const activeVendorNames = new Set(rows.map((v) => v.name.slice(0, 30).trim().toLowerCase()));

    for (const [sheetTitle, sheetId] of existingSheets.entries()) {
      if (protectedTabs.has(sheetTitle)) continue;
      if (!activeVendorNames.has(sheetTitle.toLowerCase().trim())) {
        try {
          console.info(`[vendors] Deleting removed vendor tab: "${sheetTitle}" (sheetId: ${sheetId})`);
          await deleteSheet(spreadsheetId, sheetId);
        } catch (delErr) {
          console.warn(`[vendors] Could not delete orphaned sheet "${sheetTitle}":`, delErr);
        }
      }
    }

    return { status: "success", count: rows.length };
  } catch (err: any) {
    console.error("[vendors] syncVendorsSheet error:", err);
    return { status: "failed", count: 0, error: err?.message || String(err) };
  }
}

/**
 * Lists all vendors with complete ledger calculation for the admin panel.
 */
export const listVendorLedgersAdmin = createServerFn({ method: "GET" }).handler(async () => {
  await requireUnlocked();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: vendors, error: vErr } = await supabaseAdmin
    .from("vendors")
    .select("*")
    .order("vendor_code", { ascending: true });

  if (vErr) throw new Error(vErr.message);

  const { data: allLedger, error: lErr } = await supabaseAdmin
    .from("vendor_ledger")
    .select("*")
    .order("transaction_date", { ascending: true })
    .order("created_at", { ascending: true });

  const ledgerByVendor = new Map<string, any[]>();
  for (const row of allLedger ?? []) {
    const list = ledgerByVendor.get(row.vendor_id) || [];
    list.push(row);
    ledgerByVendor.set(row.vendor_id, list);
  }

  const results = [];
  for (const v of vendors ?? []) {
    const opening = Number(v.opening_balance) || 0;
    const entries = ledgerByVendor.get(v.id) || [];

    let totalDebits = 0;
    let totalCredits = 0;
    let runningBalance = opening;
    const ledgerRows: any[] = [];

    if (opening !== 0) {
      ledgerRows.push({
        id: `opening-${v.id}`,
        date: v.created_at || new Date().toISOString(),
        reference_no: "OPENING",
        description: "Opening Balance",
        debit: 0,
        credit: opening,
        balance: opening,
        isManual: false,
        isOpening: true,
      });
      totalCredits += opening;
    }

    for (const item of entries) {
      const debit = Number(item.debit) || 0;
      const credit = Number(item.credit) || 0;
      runningBalance += (credit - debit);
      totalDebits += debit;
      totalCredits += credit;

      ledgerRows.push({
        id: item.id,
        date: item.transaction_date || item.created_at,
        reference_no: item.reference_no || "—",
        description: item.description || "—",
        debit,
        credit,
        balance: runningBalance,
        isManual: true,
      });
    }

    results.push({
      ...v,
      opening_balance: opening,
      total_debits: totalDebits,
      total_credits: totalCredits,
      balance: runningBalance,
      ledger: ledgerRows,
    });
  }

  return results;
});

/**
 * Adds a manual ledger entry for a vendor and updates their balance.
 */
export const addVendorManualLedgerEntry = createServerFn({ method: "POST" })
  .validator((d: any) =>
    z.object({
      vendor_id: z.string().uuid(),
      date: z.string().min(8),
      reference_no: z.string().optional().default("MANUAL"),
      description: z.string().min(1),
      debit: z.number().nonnegative().default(0),
      credit: z.number().nonnegative().default(0),
    }).parse(d)
  )
  .handler(async ({ data }) => {
    await requireUnlocked();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Fetch vendor current balance
    const { data: vRecord } = await supabaseAdmin
      .from("vendors")
      .select("id, current_balance")
      .eq("id", data.vendor_id)
      .maybeSingle();

    const currentBal = Number(vRecord?.current_balance || 0);
    const newBal = currentBal + (data.credit - data.debit);

    const { data: inserted, error: insertErr } = await supabaseAdmin
      .from("vendor_ledger")
      .insert({
        vendor_id: data.vendor_id,
        transaction_date: data.date,
        reference_no: data.reference_no,
        description: data.description,
        debit: data.debit,
        credit: data.credit,
        balance: newBal,
      })
      .select()
      .maybeSingle();

    if (insertErr) throw new Error(insertErr.message);

    await supabaseAdmin
      .from("vendors")
      .update({ current_balance: newBal, updated_at: new Date().toISOString() })
      .eq("id", data.vendor_id);

    // Instant Google Sheets sync in background
    (async () => {
      try {
        await syncVendorsSheetInternal();
      } catch (sheetErr) {
        console.warn("[vendors] Google Sheet sync failed after manual entry:", sheetErr);
      }
    })();

    return { ok: true, entry: inserted };
  });

/**
 * Deletes a manual vendor ledger entry and recalculates the vendor balance.
 */
export const deleteVendorManualLedgerEntry = createServerFn({ method: "POST" })
  .validator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    await requireUnlocked();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: row } = await supabaseAdmin
      .from("vendor_ledger")
      .select("vendor_id")
      .eq("id", data.id)
      .maybeSingle();

    if (!row) throw new Error("Entry not found");
    const vendorId = row.vendor_id;

    const { error: delErr } = await supabaseAdmin
      .from("vendor_ledger")
      .delete()
      .eq("id", data.id);

    if (delErr) throw new Error(delErr.message);

    // Recalculate balance
    const { data: vRecord } = await supabaseAdmin
      .from("vendors")
      .select("opening_balance")
      .eq("id", vendorId)
      .maybeSingle();

    const { data: remaining } = await supabaseAdmin
      .from("vendor_ledger")
      .select("debit, credit")
      .eq("vendor_id", vendorId);

    const opening = Number(vRecord?.opening_balance || 0);
    const totalCredit = (remaining || []).reduce((acc: number, r: any) => acc + (Number(r.credit) || 0), 0);
    const totalDebit = (remaining || []).reduce((acc: number, r: any) => acc + (Number(r.debit) || 0), 0);
    const currentBalance = opening + totalCredit - totalDebit;

    await supabaseAdmin
      .from("vendors")
      .update({ current_balance: currentBalance, updated_at: new Date().toISOString() })
      .eq("id", vendorId);

    (async () => {
      try {
        await syncVendorsSheetInternal();
      } catch (sheetErr) {
        console.warn("[vendors] Google Sheet sync failed after entry delete:", sheetErr);
      }
    })();

    return { ok: true };
  });

/**
 * Links a Sale entry purchase amount to a registered vendor in public.vendor_ledger
 * and updates public.vendors.current_balance atomically.
 */
export async function linkVendorLedgerEntry(entry: {
  source_id: string;
  vendorName: string;
  vendorId?: string;
  category: string;
  paxName?: string;
  agentName?: string;
  purchaseAmount: number;
  costPaidAccountId?: string | null;
  entryDate: string;
}): Promise<{ ok: boolean; vendor_id?: string; ledger_id?: string }> {
  const vendorQuery = (entry.vendorName || "").trim();
  const purchase = Number(entry.purchaseAmount) || 0;
  if ((!vendorQuery && !entry.vendorId) || purchase <= 0) return { ok: false };

  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: vendors, error: vErr } = await supabaseAdmin
      .from("vendors")
      .select("id, name, vendor_code, current_balance, opening_balance");

    if (vErr || !vendors || vendors.length === 0) {
      console.warn("[vendors] No vendors found in database:", vErr?.message);
      return { ok: false };
    }

    let matchedVendor: any = null;
    if (entry.vendorId) {
      matchedVendor = vendors.find((v: any) => v.id === entry.vendorId);
    }
    if (!matchedVendor && vendorQuery) {
      const q = vendorQuery.toLowerCase().trim();
      matchedVendor = vendors.find((v: any) => {
        const name = (v.name || "").toLowerCase().trim();
        const code = (v.vendor_code || "").toLowerCase().trim();
        return name === q || code === q;
      }) || vendors.find((v: any) => {
        const name = (v.name || "").toLowerCase().trim();
        const code = (v.vendor_code || "").toLowerCase().trim();
        return name.includes(q) || q.includes(name) || code.includes(q);
      });
    }

    if (!matchedVendor) {
      console.info(`[vendors] Vendor "${vendorQuery}" not found in registered vendors; skipping vendor_ledger insertion.`);
      return { ok: false };
    }

    const description = `${entry.category} - ${entry.paxName || "Purchase"}${entry.agentName ? ` • Agent: ${entry.agentName}` : ""} • Ref: ${entry.source_id}`;
    const costPaid = Boolean(entry.costPaidAccountId);
    const debit = costPaid ? purchase : 0;
    const credit = purchase;
    const currentBal = Number(matchedVendor.current_balance) || 0;
    const newBal = currentBal + (credit - debit);

    const { data: existing } = await supabaseAdmin
      .from("vendor_ledger")
      .select("id, balance, debit, credit")
      .eq("reference_no", entry.source_id)
      .maybeSingle();

    let ledgerId: string | undefined;

    if (existing) {
      const { data: updated, error: updateErr } = await supabaseAdmin
        .from("vendor_ledger")
        .update({
          vendor_id: matchedVendor.id,
          transaction_date: entry.entryDate,
          description,
          debit,
          credit,
          balance: newBal,
        })
        .eq("id", existing.id)
        .select("id")
        .maybeSingle();

      if (updateErr) {
        console.warn("[vendors] Could not update vendor_ledger row:", updateErr.message);
      } else {
        ledgerId = updated?.id;
        await supabaseAdmin
          .from("vendors")
          .update({ current_balance: newBal, updated_at: new Date().toISOString() })
          .eq("id", matchedVendor.id);
      }
    } else {
      const { data: inserted, error: ledgerError } = await supabaseAdmin
        .from("vendor_ledger")
        .insert({
          vendor_id: matchedVendor.id,
          transaction_date: entry.entryDate,
          reference_no: entry.source_id,
          description,
          debit,
          credit,
          balance: newBal,
        })
        .select("id")
        .maybeSingle();

      if (ledgerError) {
        console.warn("[vendors] Could not insert vendor_ledger row:", ledgerError.message);
      } else {
        ledgerId = inserted?.id;
        await supabaseAdmin
          .from("vendors")
          .update({ current_balance: newBal, updated_at: new Date().toISOString() })
          .eq("id", matchedVendor.id);
      }
    }

    // Trigger instant background sync to Google Sheets
    (async () => {
      try {
        await syncVendorsSheetInternal();
      } catch (sheetErr) {
        console.warn("[vendors] Instant Google Sheet sync failed:", sheetErr);
      }
    })();

    return { ok: true, vendor_id: matchedVendor.id, ledger_id: ledgerId };
  } catch (err) {
    console.warn("[vendors] linkVendorLedgerEntry error:", err);
    return { ok: false };
  }
}

/**
 * Removes any linked vendor ledger entries for a deleted sale transaction
 * and recalculates the vendor balance.
 */
export async function unlinkVendorLedgerEntries(sourceId: string): Promise<{ ok: boolean }> {
  if (!sourceId) return { ok: false };
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: vEntries } = await supabaseAdmin
      .from("vendor_ledger")
      .select("id, vendor_id, debit, credit")
      .eq("reference_no", sourceId);

    if (vEntries && vEntries.length > 0) {
      const vendorIds = Array.from(new Set(vEntries.map((e: any) => e.vendor_id)));
      await supabaseAdmin.from("vendor_ledger").delete().eq("reference_no", sourceId);

      for (const vId of vendorIds) {
        const { data: vRecord } = await supabaseAdmin.from("vendors").select("opening_balance").eq("id", vId).maybeSingle();
        const { data: remaining } = await supabaseAdmin.from("vendor_ledger").select("debit, credit").eq("vendor_id", vId);
        const opening = Number(vRecord?.opening_balance || 0);
        const totalCredit = (remaining || []).reduce((acc: number, r: any) => acc + (Number(r.credit) || 0), 0);
        const totalDebit = (remaining || []).reduce((acc: number, r: any) => acc + (Number(r.debit) || 0), 0);
        const currentBalance = opening + totalCredit - totalDebit;
        await supabaseAdmin.from("vendors").update({ current_balance: currentBalance, updated_at: new Date().toISOString() }).eq("id", vId);
      }
    }

    (async () => {
      try {
        await syncVendorsSheetInternal();
      } catch (sheetErr) {
        console.warn("[vendors] Instant Google Sheet sync after unlink failed:", sheetErr);
      }
    })();

    return { ok: true };
  } catch (err) {
    console.warn("[vendors] unlinkVendorLedgerEntries error:", err);
    return { ok: false };
  }
}
