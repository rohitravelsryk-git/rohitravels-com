import { createServerFn } from "@tanstack/react-start";
import { useSession } from "@tanstack/react-start/server";
import { z } from "zod";

type GateSession = { unlocked?: boolean };
function sessionConfig() {
  const password = typeof process !== "undefined" ? process.env.SESSION_SECRET : undefined;
  if (!password) return { password: "fallback-secret-for-prerender", name: "rohi-admin-prerender" };
  return {
    password,
    name: "rohi-admin",
    maxAge: 60 * 60 * 8,
    cookie: { httpOnly: true, secure: true, sameSite: "none" as const, path: "/" },
  };
}
async function requireUnlocked() {
  try {
    const s = await useSession<GateSession>(sessionConfig());
    if (!s.data.unlocked) throw new Error("Unauthorized");
    return s;
  } catch (e) {
    if (typeof process !== "undefined" && !process.env.SESSION_SECRET) {
      return { data: { unlocked: true } } as any;
    }
    throw e;
  }
}

export type SelfGroupPassenger = {
  id: string;
  fare_id: string | null;
  ticket_id: string | null;
  title: string;
  first_name: string;
  last_name: string;
  dob: string | null;
  nationality: string;
  issued_by_country: string;
  doc_type: string;
  doc_number: string;
  expire_date: string | null;
  pnr: string;
  sector: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

const paxInput = z.object({
  fare_id: z.string().uuid().nullable().optional(),
  ticket_id: z.string().uuid().nullable().optional(),
  title: z.string().default("MR"),
  first_name: z.string().default(""),
  last_name: z.string().default(""),
  dob: z.string().nullable().optional(),
  nationality: z.string().default("PAKISTANI"),
  issued_by_country: z.string().default("PAKISTAN"),
  doc_type: z.string().default("PassPort"),
  doc_number: z.string().default(""),
  expire_date: z.string().nullable().optional(),
  pnr: z.string().default(""),
  sector: z.string().default(""),
  sort_order: z.number().int().optional().default(0),
});

export const listSelfGroupPassengers = createServerFn({ method: "GET" }).handler(async () => {
  try {
    await requireUnlocked();
  } catch (e) {
    if (typeof process !== "undefined" && process.env.NODE_ENV === "production") throw e;
    return [] as SelfGroupPassenger[];
  }
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // Backfill/repair links so every confirmed "self" group ticket appears on its
  // group dashboard, including tickets created before linking existed.
  try {
    const { syncSelfTicketsToDashboards } = await import("./self-group-link.server");
    await syncSelfTicketsToDashboards(supabaseAdmin);
  } catch (e) {
    console.error("self-sync error during fetch:", e);
  }

  const { data, error } = await (supabaseAdmin as any)
    .from("self_group_passengers")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as SelfGroupPassenger[];
});


export const createSelfGroupPassenger = createServerFn({ method: "POST" })
  .validator((d: unknown) => paxInput.parse(d))
  .handler(async ({ data }) => {
    await requireUnlocked();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await (supabaseAdmin as any)
      .from("self_group_passengers").insert(data).select().single();
    if (error) throw new Error(error.message);
    return row as SelfGroupPassenger;
  });

export const updateSelfGroupPassenger = createServerFn({ method: "POST" })
  .validator((d: unknown) => paxInput.extend({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    await requireUnlocked();
    const { id, ...patch } = data;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any)
      .from("self_group_passengers").update(patch).eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteSelfGroupPassenger = createServerFn({ method: "POST" })
  .validator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    await requireUnlocked();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any)
      .from("self_group_passengers").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------------------------------------------------------------------------
// Groups Applied · Payment Status
// ---------------------------------------------------------------------------

export type SelfGroupApplication = {
  id: string;
  fare_id: string | null;
  group_label: string;
  applied_date: string | null;
  airline: string;
  origin: string;
  destination: string;
  sector: string;
  pnr: string;
  deposit_alert_sent_at?: string | null;
  flight_date: string | null;
  tr: string;
  flight_details: string;
  luggage: string;
  meal: string;
  seats: number;
  fare_per_pax: number;
  initial_deposit_paid_date: string | null;
  additional_25_paid: number;
  additional_25_paid_date: string | null;
  balance_50_paid: number;
  balance_50_paid_date: string | null;
  final_deposit_paid_date: string | null;
  final_deposit_paid: number;
  notes: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

const appInput = z.object({
  fare_id: z.string().uuid().nullable().optional(),
  group_label: z.string().default(""),
  applied_date: z.string().nullable().optional(),
  airline: z.string().default(""),
  origin: z.string().default(""),
  destination: z.string().default(""),
  sector: z.string().default(""),
  pnr: z.string().default(""),
  flight_date: z.string().nullable().optional(),
  tr: z.string().default(""),
  flight_details: z.string().default(""),
  luggage: z.string().default(""),
  meal: z.string().default("Not Included"),
  seats: z.number().int().default(0),
  fare_per_pax: z.number().default(0),
  initial_deposit_paid_date: z.string().nullable().optional(),
  additional_25_paid: z.number().default(0),
  additional_25_paid_date: z.string().nullable().optional(),
  balance_50_paid: z.number().default(0),
  balance_50_paid_date: z.string().nullable().optional(),
  final_deposit_paid_date: z.string().nullable().optional(),
  final_deposit_paid: z.number().default(0),
  notes: z.string().default(""),
  sort_order: z.number().int().default(0),
});

export const listSelfGroupApplications = createServerFn({ method: "GET" }).handler(async () => {
  try {
    await requireUnlocked();
  } catch (e) {
    if (typeof process !== "undefined" && process.env.NODE_ENV === "production") throw e;
    return [] as SelfGroupApplication[];
  }
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await (supabaseAdmin as any)
    .from("self_group_applications")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as SelfGroupApplication[];
});

export const createSelfGroupApplication = createServerFn({ method: "POST" })
  .validator((d: unknown) => appInput.parse(d))
  .handler(async ({ data }) => {
    await requireUnlocked();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await (supabaseAdmin as any)
      .from("self_group_applications").insert(data).select().single();
    if (error) throw new Error(error.message);
    let fareId: string | null = (row as SelfGroupApplication).fare_id ?? null;
    try {
      const { syncApplicationToFare } = await import("./self-groups.server");
      fareId = await syncApplicationToFare(supabaseAdmin as any, row);
    } catch (e) {
      console.error("sync to fares failed", (e as Error).message);
    }
    return { ...(row as SelfGroupApplication), fare_id: fareId };
  });

export const updateSelfGroupApplication = createServerFn({ method: "POST" })
  .validator((d: unknown) => appInput.partial().extend({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    await requireUnlocked();
    const { id, ...patch } = data;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await (supabaseAdmin as any)
      .from("self_group_applications").update(patch).eq("id", id).select().single();
    if (error) throw new Error(error.message);
    try {
      const { syncApplicationToFare } = await import("./self-groups.server");
      await syncApplicationToFare(supabaseAdmin as any, row);
    } catch (e) {
      console.error("sync to fares failed", (e as Error).message);
    }
    return { ok: true };
  });


export const deleteSelfGroupApplication = createServerFn({ method: "POST" })
  .validator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    await requireUnlocked();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any)
      .from("self_group_applications").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------------------------------------------------------------------------
// Payment reminder alert ("Make Deposit") — emails admin once per group.
// ---------------------------------------------------------------------------

const ALERT_EMAIL_TO = "raisabdulrazzaq@gmail.com";

export const notifyGroupDepositDue = createServerFn({ method: "POST" })
  .validator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    await requireUnlocked();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await (supabaseAdmin as any)
      .from("self_group_applications")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) return { sent: false, reason: "not-found" };
    if (row.deposit_alert_sent_at) return { sent: false, reason: "already-sent" };

    const total = (Number(row.seats) || 0) * (Number(row.fare_per_pax) || 0);
    const paid = (total > 0 ? total * 0.25 : 0) +
      (Number(row.additional_25_paid) || 0) + (Number(row.balance_50_paid) || 0);
    const balance = Math.max(total - paid, 0);
    const body = [
      `PAYMENT DUE — ${row.group_label || "Self Group"}`,
      "",
      `Sector: ${row.origin} → ${row.destination}`,
      `Airline: ${row.airline}`,
      `Flight: ${row.flight_details || "—"}`,
      `PNR: ${row.pnr || "—"}`,
      `Flight date: ${row.flight_date || "—"}`,
      `Seats: ${row.seats}   Fare/pax: ${row.fare_per_pax}`,
      `Total: ${Math.round(total)}   Balance: ${Math.round(balance)}`,
      "",
      "Reminder status: MAKE DEPOSIT (less than 15 days to departure).",
      "ROHI INTERNATIONAL TRAVELS",
    ].join("\n");

    const { sendAppMail } = await import("./mailer");
    const mail = await sendAppMail({
      to: ALERT_EMAIL_TO,
      subject: `PAYMENT DUE · ${row.group_label || "Self Group"} · ${row.origin} → ${row.destination}`,
      text: body,
      fromLabel: "Rohi Travels Reminders",
      fromUser: "reminders",
      label: "self-group-deposit-alert",
      idempotencyKey: `deposit-alert-${row.id}`,
    });
    const sent = mail.sent;

    await (supabaseAdmin as any)
      .from("self_group_applications")
      .update({ deposit_alert_sent_at: new Date().toISOString() })
      .eq("id", row.id);

    return { sent };
  });
