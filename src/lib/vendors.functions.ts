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

    const { clearSheet, writeRange, quoteSheet, batchUpdateSpreadsheet, getSpreadsheet } = await import("@/lib/backup/sheets.server");

    const spreadsheetId = "1d5aNDN0mIL7rRpWgDCOAd0l59M8s8EUaUBSpRydxjqw";
    const tabName = "Vendors";

    // 1. Inspect sheet metadata
    let sheetId = 919527787;
    try {
      const meta = await getSpreadsheet(spreadsheetId);
      const found = (meta.sheets ?? []).find((s: any) => s.properties?.title === tabName);
      if (found?.properties?.sheetId !== undefined) {
        sheetId = found.properties.sheetId;
      }
    } catch (metaErr) {
      console.warn("[vendors] Error fetching sheet meta:", metaErr);
    }

    // 2. Build values with 5-row header structure matching Rohi International Travels export standard
    const values: unknown[][] = [
      ["ROHI INTERNATIONAL TRAVELS"],
      ["Sardar Market, Shahi Road, Rahim Yar Khan  •  0305-6622988"],
      ["VENDORS - REGISTERED SUPPLIERS"],
      [`Official Live Record • ${rows.length} entries`],
      [
        "Vendor Code",
        "Vendor Name",
        "Category",
        "Contact Person",
        "Phone",
        "Email",
        "City",
        "Opening Balance",
        "Current Balance",
        "Active",
        "ID",
        "Created At",
      ],
    ];

    for (const v of rows) {
      values.push([
        String(v.vendor_code || "").trim(),
        String(v.name || "").trim(),
        String(v.category || "Vendor").trim(),
        String(v.contact_person || "").trim(),
        String(v.phone || "").trim(),
        String(v.email || "").trim(),
        String(v.city || "").trim(),
        Number(v.opening_balance) || 0,
        Number(v.current_balance) || 0,
        v.is_active !== false ? "Yes" : "No",
        String(v.id || "").trim(),
        v.created_at || new Date().toISOString(),
      ]);
    }

    // 3. Clear and write
    await clearSheet(spreadsheetId, quoteSheet(tabName));
    await writeRange(spreadsheetId, `${quoteSheet(tabName)}!A1:L${values.length}`, values);

    // 4. Apply Rohi Warm Clay formatting
    const BRAND_ACCENT = { red: 217 / 255, green: 119 / 255, blue: 87 / 255 }; // #D97757
    const BRAND_DARK = { red: 20 / 255, green: 20 / 255, blue: 19 / 255 };     // #141413
    const BRAND_CREAM = { red: 250 / 255, green: 249 / 255, blue: 245 / 255 }; // #FAF9F5
    const BRAND_WHITE = { red: 1.0, green: 1.0, blue: 1.0 };
    const BRAND_BORDER = { red: 231 / 255, green: 229 / 255, blue: 228 / 255 }; // #E7E5E4

    const formatRequests: any[] = [
      // Banner row 1
      {
        repeatCell: {
          range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 12 },
          cell: {
            userEnteredFormat: {
              backgroundColor: BRAND_ACCENT,
              horizontalAlignment: "CENTER",
              verticalAlignment: "MIDDLE",
              textFormat: { bold: true, fontSize: 13, foregroundColor: BRAND_WHITE },
            },
          },
          fields: "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)",
        },
      },
      // Header row 5 (Column Titles)
      {
        repeatCell: {
          range: { sheetId, startRowIndex: 4, endRowIndex: 5, startColumnIndex: 0, endColumnIndex: 12 },
          cell: {
            userEnteredFormat: {
              backgroundColor: BRAND_DARK,
              horizontalAlignment: "CENTER",
              verticalAlignment: "MIDDLE",
              textFormat: { bold: true, fontSize: 10, foregroundColor: BRAND_WHITE },
            },
          },
          fields: "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)",
        },
      },
      // Alternating row background and borders
      {
        repeatCell: {
          range: { sheetId, startRowIndex: 5, endRowIndex: values.length, startColumnIndex: 0, endColumnIndex: 12 },
          cell: {
            userEnteredFormat: {
              backgroundColor: BRAND_CREAM,
              textFormat: { fontSize: 9.5 },
              verticalAlignment: "MIDDLE",
            },
          },
          fields: "userEnteredFormat(backgroundColor,textFormat,verticalAlignment)",
        },
      },
      // Currency format on Opening and Current Balance (Columns H & I -> indexes 7, 8)
      {
        repeatCell: {
          range: { sheetId, startRowIndex: 5, endRowIndex: values.length, startColumnIndex: 7, endColumnIndex: 9 },
          cell: {
            userEnteredFormat: {
              numberFormat: { type: "NUMBER", pattern: "#,##0.00" },
              horizontalAlignment: "RIGHT",
            },
          },
          fields: "userEnteredFormat(numberFormat,horizontalAlignment)",
        },
      },
    ];

    try {
      await batchUpdateSpreadsheet(spreadsheetId, formatRequests);
    } catch (fmtErr) {
      console.warn("[vendors] Formatting warning:", fmtErr);
    }

    return { status: "success", count: rows.length };
  } catch (err: any) {
    console.error("[vendors] syncVendorsSheet error:", err);
    return { status: "failed", count: 0, error: err?.message || String(err) };
  }
}


/**
 * Links a Sale entry purchase amount to a registered vendor in public.vendor_ledger
 * and updates public.vendors.current_balance atomically.
 */
export async function linkVendorLedgerEntry(entry: {
  source_id: string;
  vendorName: string;
  category: string;
  paxName?: string;
  agentName?: string;
  purchaseAmount: number;
  costPaidAccountId?: string | null;
  entryDate: string;
}): Promise<{ ok: boolean; vendor_id?: string; ledger_id?: string }> {
  const vendorQuery = (entry.vendorName || "").trim();
  const purchase = Number(entry.purchaseAmount) || 0;
  if (!vendorQuery || purchase <= 0) return { ok: false };

  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Match vendor in public.vendors
    const { data: vendors } = await supabaseAdmin
      .from("vendors")
      .select("id, name, vendor_code, current_balance, opening_balance")
      .or(`name.ilike.%${vendorQuery}%,vendor_code.ilike.%${vendorQuery}%`)
      .limit(1);

    const matchedVendor = vendors && vendors.length > 0 ? vendors[0] : null;
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
      await supabaseAdmin
        .from("vendors")
        .update({ current_balance: newBal, updated_at: new Date().toISOString() })
        .eq("id", matchedVendor.id);
    }

    return { ok: true, vendor_id: matchedVendor.id, ledger_id: inserted?.id };
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
    return { ok: true };
  } catch (err) {
    console.warn("[vendors] unlinkVendorLedgerEntries error:", err);
    return { ok: false };
  }
}
