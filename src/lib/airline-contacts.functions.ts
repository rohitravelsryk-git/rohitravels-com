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

export type AirlineContact = {
  id: string;
  airline_name: string;
  contact_number: string;
  sales_support: string;
  address: string;
  sort_order: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
};

export const DEFAULT_AIRLINE_CONTACTS: AirlineContact[] = [
  {
    "id": "contact-1",
    "airline_name": "PIA",
    "contact_number": "021-111-786-786",
    "sales_support": "salessupport.khi@piac.aero",
    "address": "",
    "sort_order": 10,
    "is_active": true
  },
  {
    "id": "contact-2",
    "airline_name": "AIR SIAL",
    "contact_number": "052-111-247-742",
    "sales_support": "",
    "address": "",
    "sort_order": 20,
    "is_active": true
  },
  {
    "id": "contact-3",
    "airline_name": "SERENE",
    "contact_number": "111-737-363",
    "sales_support": "salesupport@sereneair.com",
    "address": "",
    "sort_order": 30,
    "is_active": true
  },
  {
    "id": "contact-4",
    "airline_name": "AIRBLUE",
    "contact_number": "021-111-247-258",
    "sales_support": "",
    "address": "",
    "sort_order": 40,
    "is_active": true
  },
  {
    "id": "contact-5",
    "airline_name": "FLYJINNAH",
    "contact_number": "021-111-000-035, 021-38899502",
    "sales_support": "trade@flyjinnah.com",
    "address": "",
    "sort_order": 50,
    "is_active": true
  },
  {
    "id": "contact-6",
    "airline_name": "SAUDI AIRLINE",
    "contact_number": "Reservation: +92-21-111-747-300 Sales Office: +92-21-35147703 / 35147704",
    "sales_support": "slssupgrpkhi@saudia.com",
    "address": "",
    "sort_order": 60,
    "is_active": true
  },
  {
    "id": "contact-7",
    "airline_name": "EMIRATES",
    "contact_number": "021-111-225-535",
    "sales_support": "salessupportkhi@emirates.com",
    "address": "",
    "sort_order": 70,
    "is_active": true
  },
  {
    "id": "contact-8",
    "airline_name": "FLYDUBAI",
    "contact_number": "051-111-225-539",
    "sales_support": "support@flydubaipk.com",
    "address": "",
    "sort_order": 80,
    "is_active": true
  },
  {
    "id": "contact-9",
    "airline_name": "GULF AIR",
    "contact_number": "021-35675232, 021 35654483",
    "sales_support": "khi.salessupport@gulfair.com",
    "address": "",
    "sort_order": 90,
    "is_active": true
  },
  {
    "id": "contact-10",
    "airline_name": "OMAN AIR",
    "contact_number": "021-35693979-80",
    "sales_support": "khi.ctostaff@omanair.com",
    "address": "",
    "sort_order": 100,
    "is_active": true
  },
  {
    "id": "contact-11",
    "airline_name": "ETIHAD",
    "contact_number": "051-8109092 , 08-0090044385 INTERNATIONAL NUMBER",
    "sales_support": "pakssupport@etihad.ae\nccdocs@etihad.ae",
    "address": "",
    "sort_order": 110,
    "is_active": true
  },
  {
    "id": "contact-12",
    "airline_name": "QATAR",
    "contact_number": "Call CENTRE now 24/7 +92 21 38790002",
    "sales_support": "khireservation@pk.qatarairways.com",
    "address": "",
    "sort_order": 120,
    "is_active": true
  },
  {
    "id": "contact-13",
    "airline_name": "SRILANKAN",
    "contact_number": "021-35224437-38 , 0321-8209313",
    "sales_support": "ul_khiressup@srilankan.com\nkhireservations@srilankan.com\nul_khislsmgr@srilankan.com",
    "address": "",
    "sort_order": 130,
    "is_active": true
  },
  {
    "id": "contact-14",
    "airline_name": "THAI",
    "contact_number": "021-34320270-75",
    "sales_support": "khisalesthaiairways@gmail.com",
    "address": "Office # A-305, 3rd Floor, Fortune Tower, Shahrah-e-Faisal Road.",
    "sort_order": 140,
    "is_active": true
  },
  {
    "id": "contact-15",
    "airline_name": "TURKISH",
    "contact_number": "Call Center: PK: 00 800 900 33020 | UK: 0844 800 66 66 | USA: 1-800-874-8875",
    "sales_support": "KHISALES@thy.com\nKHICUSTOMER@THY.COM",
    "address": "Showroom 106, The Residence, Khaliq-uz-Zaman Road,\nClifton Block-8, Karachi - Pakistan",
    "sort_order": 150,
    "is_active": true
  },
  {
    "id": "contact-16",
    "airline_name": "PEGASUS",
    "contact_number": "021-35655374-75",
    "sales_support": "pegasuspk@gerrys.com.pk",
    "address": "",
    "sort_order": 160,
    "is_active": true
  },
  {
    "id": "contact-17",
    "airline_name": "JAZEERA",
    "contact_number": "021-35693816, 021-35693817",
    "sales_support": "j9khi.tro@gerrys.com.pk\nj9khi.tro2@gerrys.com.pk",
    "address": "",
    "sort_order": 170,
    "is_active": true
  },
  {
    "id": "contact-18",
    "airline_name": "HAHN AIR",
    "contact_number": "",
    "sales_support": "",
    "address": "",
    "sort_order": 180,
    "is_active": true
  },
  {
    "id": "contact-19",
    "airline_name": "KENYA",
    "contact_number": "",
    "sales_support": "kqkhi@gerrys.com.pk",
    "address": "",
    "sort_order": 190,
    "is_active": true
  },
  {
    "id": "contact-20",
    "airline_name": "ETHOPIAN",
    "contact_number": "(021) 35632418 , +92 300 2663220 (MANSOOR ALI)",
    "sales_support": "reservations.et@bukharigroup.com.pk",
    "address": "",
    "sort_order": 200,
    "is_active": true
  },
  {
    "id": "contact-21",
    "airline_name": "MALINDO",
    "contact_number": "021-35684012,13,14,16,17,18                 ( 03000341448  )   03268088700",
    "sales_support": "",
    "address": "",
    "sort_order": 210,
    "is_active": true
  },
  {
    "id": "contact-22",
    "airline_name": "AIR CHINA",
    "contact_number": "0092 333 2220054 (MR. SAAD)",
    "sales_support": "",
    "address": "",
    "sort_order": 220,
    "is_active": true
  },
  {
    "id": "contact-23",
    "airline_name": "MK/QF",
    "contact_number": "",
    "sales_support": "",
    "address": "",
    "sort_order": 230,
    "is_active": true
  },
  {
    "id": "contact-24",
    "airline_name": "AZERBAIJAN",
    "contact_number": "",
    "sales_support": "",
    "address": "",
    "sort_order": 240,
    "is_active": true
  },
  {
    "id": "contact-25",
    "airline_name": "RAWAND AIR",
    "contact_number": "",
    "sales_support": "",
    "address": "",
    "sort_order": 250,
    "is_active": true
  },
  {
    "id": "contact-26",
    "airline_name": "AIR ARABIA",
    "contact_number": "(+92 21) 35650967 / 68 / 69",
    "sales_support": "",
    "address": "Opposite Aisha Bawany Academy, Shara E Faisal Karachi",
    "sort_order": 260,
    "is_active": true
  },
  {
    "id": "contact-27",
    "airline_name": "SALAM AIR",
    "contact_number": "021-35634447        021-35634448.",
    "sales_support": "sales.khi@salamair.com",
    "address": "kashif Centre Sharae Faisal Karachi",
    "sort_order": 270,
    "is_active": true
  },
  {
    "id": "contact-28",
    "airline_name": "FLYNAS",
    "contact_number": "021-111552111",
    "sales_support": "",
    "address": "",
    "sort_order": 280,
    "is_active": true
  },
  {
    "id": "contact-29",
    "airline_name": "CATHAY",
    "contact_number": "",
    "sales_support": "parvez_naqvi@cathaypacific.com\njalees_nawaz@cathaypacific.com",
    "address": "",
    "sort_order": 290,
    "is_active": true
  },
  {
    "id": "contact-30",
    "airline_name": "FLYADEAL",
    "contact_number": "0370-3495558",
    "sales_support": "",
    "address": "",
    "sort_order": 300,
    "is_active": true
  },
  {
    "id": "contact-31",
    "airline_name": "AIRASIA",
    "contact_number": "0300-2663220 (Syed Mansoor Counter Supervisor), 0345-6000701 (Spo Adnan)",
    "sales_support": "sales@tcb.com.pk",
    "address": "KHI METRO POLE",
    "sort_order": 310,
    "is_active": true
  },
  {
    "id": "contact-32",
    "airline_name": "UZBEK AIRWAYS",
    "contact_number": "021-35641050,021-35641052, 0345-2167202 SHAHZAD JAFRI",
    "sales_support": "",
    "address": "KHI METRO POLE",
    "sort_order": 320,
    "is_active": true
  }
];

export const listAirlineContacts = createServerFn({ method: "GET" }).handler(async () => {
  await requireUnlocked();
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("airline_contacts")
      .select("*")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("airline_name", { ascending: true });

    if (error || !data || data.length === 0) {
      return DEFAULT_AIRLINE_CONTACTS;
    }
    return data as AirlineContact[];
  } catch (err) {
    console.warn("[airline-contacts] Falling back to default contacts:", err);
    return DEFAULT_AIRLINE_CONTACTS;
  }
});

export const createAirlineContact = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    z
      .object({
        airline_name: z.string().trim().min(1, "Airline name is required"),
        contact_number: z.string().default(""),
        sales_support: z.string().default(""),
        address: z.string().default(""),
        sort_order: z.number().default(100),
      })
      .parse(data)
  )
  .handler(async ({ data }) => {
    await requireUnlocked();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: inserted, error } = await supabaseAdmin
      .from("airline_contacts")
      .insert({
        airline_name: data.airline_name,
        contact_number: data.contact_number,
        sales_support: data.sales_support,
        address: data.address,
        sort_order: data.sort_order,
        is_active: true,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);

    // Live instant sync to Google Sheets tab 'Airline Contact Details'
    let sheetSync = null;
    try {
      const { syncAirlineContactDetailsSheet } = await import("@/lib/airline-accounts-sheet.server");
      sheetSync = await syncAirlineContactDetailsSheet();
    } catch (syncErr) {
      console.warn("[airline-contacts] Google sheet sync failed after create:", syncErr);
    }

    return { success: true, contact: inserted as AirlineContact, sheetSync };
  });

export const updateAirlineContact = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    z
      .object({
        id: z.string(),
        airline_name: z.string().trim().min(1, "Airline name is required"),
        contact_number: z.string().default(""),
        sales_support: z.string().default(""),
        address: z.string().default(""),
        sort_order: z.number().optional(),
      })
      .parse(data)
  )
  .handler(async ({ data }) => {
    await requireUnlocked();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const updatePayload: Record<string, unknown> = {
      airline_name: data.airline_name,
      contact_number: data.contact_number,
      sales_support: data.sales_support,
      address: data.address,
      updated_at: new Date().toISOString(),
    };
    if (typeof data.sort_order === "number") {
      updatePayload.sort_order = data.sort_order;
    }

    const { data: updated, error } = await supabaseAdmin
      .from("airline_contacts")
      .update(updatePayload)
      .eq("id", data.id)
      .select()
      .single();

    if (error) throw new Error(error.message);

    // Live instant sync to Google Sheets tab 'Airline Contact Details'
    let sheetSync = null;
    try {
      const { syncAirlineContactDetailsSheet } = await import("@/lib/airline-accounts-sheet.server");
      sheetSync = await syncAirlineContactDetailsSheet();
    } catch (syncErr) {
      console.warn("[airline-contacts] Google sheet sync failed after update:", syncErr);
    }

    return { success: true, contact: updated as AirlineContact, sheetSync };
  });

export const deleteAirlineContact = createServerFn({ method: "POST" })
  .validator((data: unknown) => z.object({ id: z.string() }).parse(data))
  .handler(async ({ data }) => {
    await requireUnlocked();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("airline_contacts")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("id", data.id);

    if (error) throw new Error(error.message);

    // Live instant sync to Google Sheets tab 'Airline Contact Details'
    let sheetSync = null;
    try {
      const { syncAirlineContactDetailsSheet } = await import("@/lib/airline-accounts-sheet.server");
      sheetSync = await syncAirlineContactDetailsSheet();
    } catch (syncErr) {
      console.warn("[airline-contacts] Google sheet sync failed after delete:", syncErr);
    }

    return { success: true, sheetSync };
  });

export const reorderAirlineContacts = createServerFn({ method: "POST" })
  .validator((data: unknown) => z.object({ ids: z.array(z.string()).min(1) }).parse(data))
  .handler(async ({ data }) => {
    await requireUnlocked();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const updates = data.ids.map((id, index) =>
      supabaseAdmin
        .from("airline_contacts")
        .update({ sort_order: (index + 1) * 10, updated_at: new Date().toISOString() })
        .eq("id", id)
    );
    await Promise.all(updates);

    let sheetSync = null;
    try {
      const { syncAirlineContactDetailsSheet } = await import("@/lib/airline-accounts-sheet.server");
      sheetSync = await syncAirlineContactDetailsSheet();
    } catch (syncErr) {
      console.warn("[airline-contacts] Google sheet sync failed after reorder:", syncErr);
    }

    return { success: true, sheetSync };
  });

export const syncAirlineContactsLive = createServerFn({ method: "POST" })
  .validator(() => ({}))
  .handler(async () => {
    await requireUnlocked();
    const { syncAirlineContactDetailsSheet } = await import("@/lib/airline-accounts-sheet.server");
    return await syncAirlineContactDetailsSheet();
  });
