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
  const s = await useSession<GateSession>(sessionConfig());
  if (!s.data.unlocked) throw new Error("Unauthorized");
  return s;
}

export type Voucher = {
  id: string; sr: number; agent_name: string; passenger_name: string; pnr: string;
  voucher_amount: string; airline: string; expiry_date: string; notes: string; name: string;
  alert_date: string; days_left: string; status: string; created_at: string; updated_at: string;
};

export type PublicVoucher = Pick<Voucher, "id" | "sr" | "airline" | "expiry_date" | "passenger_name" | "created_at" | "updated_at">;

export const listVouchers = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.from("vouchers")
      .select("id,sr,airline,expiry_date,passenger_name,created_at,updated_at")
      .order("sr", { ascending: true }).order("created_at", { ascending: true });
    if (!error && Array.isArray(data) && data.length > 0) return data as PublicVoucher[];
    if (error) console.warn("[listVouchers] supabaseAdmin query returned error:", error.message);
  } catch (adminErr) { console.warn("[listVouchers] supabaseAdmin unavailable:", adminErr); }

  const { supabase } = await import("@/integrations/supabase/client");
  const { data, error } = await supabase.from("vouchers")
    .select("id,sr,airline,expiry_date,passenger_name,created_at,updated_at")
    .order("sr", { ascending: true }).order("created_at", { ascending: true });
  if (error) throw new Error("Live voucher data is temporarily unavailable. Please try again shortly.");
  return (data ?? []) as PublicVoucher[];
});

export const listVouchersAdmin = createServerFn({ method: "GET" }).handler(async () => {
  await requireUnlocked();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.from("vouchers").select("*")
    .order("sr", { ascending: true }).order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as Voucher[];
});

const voucherInput = z.object({
  sr: z.number().int().optional().default(0),
  agent_name: z.string().optional().default(""),
  passenger_name: z.string().optional().default(""),
  pnr: z.string().optional().default(""),
  voucher_amount: z.string().optional().default(""),
  airline: z.string().optional().default(""),
  expiry_date: z.string().optional().default(""),
  notes: z.string().optional().default(""),
});

const createVoucherInput = voucherInput.extend({
  agent_name: z.string().trim().min(1, "Agent Name is required"),
  passenger_name: z.string().trim().min(1, "Passenger Name is required"),
  airline: z.string().trim().min(1, "Airline is required"),
});

function withLegacy(d: z.infer<typeof voucherInput>) {
  return { ...d, name: d.passenger_name || d.pnr || d.agent_name || "", alert_date: "", days_left: "", status: "" };
}

export const createVoucher = createServerFn({ method: "POST" })
  .validator((d: unknown) => createVoucherInput.parse(d))
  .handler(async ({ data }) => {
    await requireUnlocked();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("vouchers").insert(withLegacy(data));
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const createVouchersBulk = createServerFn({ method: "POST" })
  .validator((d: unknown) => z.object({ items: z.array(createVoucherInput).min(1).max(500) }).parse(d))
  .handler(async ({ data }) => {
    await requireUnlocked();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const rows = data.items.map((it) => withLegacy(it));
    const { error } = await supabaseAdmin.from("vouchers").insert(rows);
    if (error) throw new Error(error.message);
    return { ok: true, count: rows.length };
  });

export const updateVoucher = createServerFn({ method: "POST" })
  .validator((d: unknown) => voucherInput.extend({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    await requireUnlocked();
    const { id, ...rest } = data;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("vouchers").update(withLegacy(rest)).eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteVoucher = createServerFn({ method: "POST" })
  .validator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    await requireUnlocked();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("vouchers").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
