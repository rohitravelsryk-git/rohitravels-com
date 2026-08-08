import { createServerFn } from "@tanstack/react-start";
import { useSession } from "@tanstack/react-start/server";
import { createHash, timingSafeEqual } from "node:crypto";
import { z } from "zod";

type GateSession = { unlocked?: boolean };

function sessionConfig() {
  const password = process.env.SESSION_SECRET;
  if (!password) throw new Error("SESSION_SECRET not set");
  return {
    password,
    name: "rohi-admin",
    maxAge: 60 * 60 * 8,
    cookie: {
      httpOnly: true,
      secure: true,
      sameSite: "none" as const,
      path: "/",
    },
  };
}

function passwordMatches(input: string, expected: string) {
  const a = createHash("sha256").update(input, "utf8").digest();
  const b = createHash("sha256").update(expected, "utf8").digest();
  return timingSafeEqual(a, b);
}

async function requireUnlocked() {
  const session = await useSession<GateSession>(sessionConfig());
  if (!session.data.unlocked) throw new Error("Unauthorized");
  return session;
}

export type Fare = {
  id: string;
  origin: string;
  origin_code: string;
  destination: string;
  destination_code: string;
  airline: string;
  flight_date: string;
  flight_number: string | null;
  depart_time: string | null;
  arrive_time: string | null;
  flight_details: string | null;
  baggage: string | null;
  meal: string | null;
  seats: string | null;
  category: string;
  price_text: string;
  pnr?: string | null;
  vendor_fare: string | null;
  vendor_name: string | null;
  is_featured: boolean;
  sort_order: number;
  group_type: string;
  updated_at: string;
  created_at: string;
};



export type Airline = { id: string; name: string; iata_code: string; logo_url: string | null };
export type Location = { id: string; city: string; code: string; urdu_name: string | null };
export type LuggageOption = { id: string; label: string; sort_order: number };

// ---------- Public read ----------
// Public list: strip internal vendor pricing / vendor name so anon/authenticated
// callers cannot harvest cost data. Admin panel uses listFaresAdmin below.
const PUBLIC_FARE_COLUMNS =
  "id,origin,origin_code,destination,destination_code,airline,flight_date,flight_number,depart_time,arrive_time,flight_details,baggage,meal,seats,category,price_text,is_featured,sort_order,group_type,updated_at,created_at";

export const listFares = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("fares")
    .select(PUBLIC_FARE_COLUMNS)
    .order("is_featured", { ascending: false })
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  // Ensure vendor fields are always null on the wire so nothing leaks through the type.
  return (data ?? []).map((f) => ({ ...f, vendor_fare: null, vendor_name: null })) as Fare[];
});

export const listFaresAdmin = createServerFn({ method: "GET" }).handler(async () => {
  await requireUnlocked();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("fares")
    .select("*")
    .order("is_featured", { ascending: false })
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as Fare[];
});


// ---------- Auth ----------
function hashPassword(pw: string) {
  return createHash("sha256").update(pw, "utf8").digest("hex");
}
function hashCode(code: string) {
  return createHash("sha256").update(code, "utf8").digest("hex");
}

async function getCreds() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("admin_credentials")
    .select("password_hash, recovery_email")
    .eq("id", true)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as { password_hash: string; recovery_email: string } | null;
}

export const checkAdminUnlocked = createServerFn({ method: "GET" }).handler(async () => {
  const session = await useSession<GateSession>(sessionConfig());
  return { unlocked: Boolean(session.data.unlocked) };
});

export const getRecoveryEmail = createServerFn({ method: "GET" }).handler(async () => {
  const creds = await getCreds();
  const email = creds?.recovery_email ?? "rohitravels@gmail.com";
  // mask: r****s@gmail.com
  const [name, domain] = email.split("@");
  const masked = name.length <= 2 ? name : `${name[0]}****${name[name.length - 1]}`;
  return { masked: `${masked}@${domain}` };
});

export const adminUnlock = createServerFn({ method: "POST" })
  .inputValidator((d: { password: string }) => z.object({ password: z.string().min(1) }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const creds = await getCreds();
    const currentHash = creds?.password_hash ?? "";
    const inputHash = hashPassword(data.password);

    let ok = false;
    if (currentHash) {
      ok = inputHash === currentHash;
    } else {
      // Bootstrap: use SITE_PASSWORD env until first change
      const envPw = process.env.SITE_PASSWORD;
      if (envPw && passwordMatches(data.password, envPw)) {
        ok = true;
        await supabaseAdmin
          .from("admin_credentials")
          .update({ password_hash: inputHash, updated_at: new Date().toISOString() })
          .eq("id", true);
      }
    }
    if (!ok) return { ok: false as const };
    const session = await useSession<GateSession>(sessionConfig());
    await session.update({ unlocked: true });
    return { ok: true as const };
  });

export const adminLogout = createServerFn({ method: "POST" }).handler(async () => {
  const session = await useSession<GateSession>(sessionConfig());
  await session.clear();
  return { ok: true as const };
});

export const verifyAdminPassword = createServerFn({ method: "POST" })
  .inputValidator((d: { password: string }) => z.object({ password: z.string().min(1) }).parse(d))
  .handler(async ({ data }) => {
    const creds = await getCreds();
    const currentHash = creds?.password_hash ?? "";
    if (currentHash) return { ok: hashPassword(data.password) === currentHash };
    const envPw = process.env.SITE_PASSWORD;
    return { ok: Boolean(envPw && passwordMatches(data.password, envPw)) };
  });



export const changeAdminPassword = createServerFn({ method: "POST" })
  .inputValidator((d: { currentPassword: string; newPassword: string }) =>
    z.object({
      currentPassword: z.string().min(1),
      newPassword: z.string().min(6, "New password must be at least 6 characters"),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    await requireUnlocked();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const creds = await getCreds();
    const currentHash = creds?.password_hash ?? "";
    const inputHash = hashPassword(data.currentPassword);
    let ok = false;
    if (currentHash) ok = inputHash === currentHash;
    else {
      const envPw = process.env.SITE_PASSWORD;
      ok = Boolean(envPw && passwordMatches(data.currentPassword, envPw));
    }
    if (!ok) return { ok: false as const, error: "Current password is incorrect" };
    const { error } = await supabaseAdmin
      .from("admin_credentials")
      .update({ password_hash: hashPassword(data.newPassword), updated_at: new Date().toISOString() })
      .eq("id", true);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const requestPasswordReset = createServerFn({ method: "POST" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const creds = await getCreds();
  const email = creds?.recovery_email ?? "rohitravels@gmail.com";
  // Generate a 6-digit code
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  // Invalidate previous unused codes
  await supabaseAdmin
    .from("admin_password_resets")
    .update({ used_at: new Date().toISOString() })
    .is("used_at", null);
  const { error } = await supabaseAdmin
    .from("admin_password_resets")
    .insert({ code_hash: hashCode(code), expires_at: expiresAt });
  if (error) throw new Error(error.message);

  // Send email via Lovable email API
  const apiKey = process.env.LOVABLE_API_KEY;
  let sent = false;
  let sendError: string | null = null;
  if (apiKey) {
    try {
      const res = await fetch("https://api.lovable.dev/emails/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          to: email,
          subject: "Rohi Admin — Password Reset Code",
          html: `<div style="font-family:Arial,sans-serif;padding:24px;max-width:520px;margin:auto">
            <h2 style="color:#0d3480;margin:0 0 12px">Rohi International Travels</h2>
            <p>Your admin password reset code is:</p>
            <div style="font-size:32px;font-weight:800;letter-spacing:8px;background:#f5f5f5;padding:16px;text-align:center;border-radius:8px;color:#0d3480">${code}</div>
            <p style="color:#666;font-size:13px;margin-top:16px">This code expires in 15 minutes. If you didn't request this, please ignore.</p>
          </div>`,
        }),
      });
      sent = res.ok;
      if (!res.ok) sendError = await res.text().catch(() => `HTTP ${res.status}`);
    } catch (e) {
      sendError = e instanceof Error ? e.message : String(e);
    }
  } else {
    sendError = "Email service not configured";
  }
  const [name, domain] = email.split("@");
  const masked = name.length <= 2 ? name : `${name[0]}****${name[name.length - 1]}`;
  return { ok: sent, maskedEmail: `${masked}@${domain}`, error: sendError };
});

export const resetPasswordWithCode = createServerFn({ method: "POST" })
  .inputValidator((d: { code: string; newPassword: string }) =>
    z.object({
      code: z.string().min(4),
      newPassword: z.string().min(6, "New password must be at least 6 characters"),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const codeHash = hashCode(data.code.trim());
    const { data: row, error } = await supabaseAdmin
      .from("admin_password_resets")
      .select("id, expires_at, used_at")
      .eq("code_hash", codeHash)
      .is("used_at", null)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) return { ok: false as const, error: "Invalid or expired code" };
    const nowIso = new Date().toISOString();
    await supabaseAdmin
      .from("admin_password_resets")
      .update({ used_at: nowIso })
      .eq("id", row.id);
    const { error: upErr } = await supabaseAdmin
      .from("admin_credentials")
      .update({ password_hash: hashPassword(data.newPassword), updated_at: nowIso })
      .eq("id", true);
    if (upErr) throw new Error(upErr.message);
    return { ok: true as const };
  });



// ---------- Admin CRUD ----------
const fareInput = z.object({
  origin: z.string().min(1),
  origin_code: z.string().min(1),
  destination: z.string().min(1),
  destination_code: z.string().min(1),
  airline: z.string().min(1),
  flight_date: z.string().optional().default(""),
  flight_number: z.string().optional().nullable(),
  depart_time: z.string().optional().nullable(),
  arrive_time: z.string().optional().nullable(),
  flight_details: z.string().optional().nullable(),
  baggage: z.string().optional().nullable(),
  meal: z.string().optional().nullable(),
  seats: z.string().optional().nullable(),
  category: z.string().optional().default("JEDDAH"),
  price_text: z.string().min(1),
  vendor_fare: z.string().optional().nullable(),
  vendor_name: z.string().optional().nullable(),
  is_featured: z.boolean().optional().default(false),
  group_type: z.enum(["self", "party"]).optional().default("party"),

  sort_order: z.number().int().optional().default(0),
});


export const createFare = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => fareInput.parse(d))
  .handler(async ({ data }) => {
    await requireUnlocked();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("fares").insert(data);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateFare = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => fareInput.extend({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    await requireUnlocked();
    const { id, ...rest } = data;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("fares").update(rest).eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteFare = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    await requireUnlocked();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("fares").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Lookup tables (airlines / locations / luggage) ----------
export const listAirlines = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.from("airlines").select("*").order("name");
  if (error) throw new Error(error.message);
  return (data ?? []) as Airline[];
});

const airlineInput = z.object({
  name: z.string().min(1),
  iata_code: z.string().min(1).max(3),
  logo_url: z.string().url().optional().nullable().or(z.literal("")),
});

export const createAirline = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => airlineInput.parse(d))
  .handler(async ({ data }) => {
    await requireUnlocked();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("airlines").insert({
      name: data.name,
      iata_code: data.iata_code.toUpperCase(),
      logo_url: data.logo_url || null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteAirline = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    await requireUnlocked();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("airlines").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateAirline = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).merge(airlineInput).parse(d))
  .handler(async ({ data }) => {
    await requireUnlocked();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("airlines")
      .update({ name: data.name, iata_code: data.iata_code.toUpperCase(), logo_url: data.logo_url || null })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const bulkCreateAirlines = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ rows: z.array(airlineInput).min(1).max(500) }).parse(d))
  .handler(async ({ data }) => {
    await requireUnlocked();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const rows = data.rows.map((r) => ({
      name: r.name,
      iata_code: r.iata_code.toUpperCase(),
      logo_url: r.logo_url || null,
    }));
    const { error } = await supabaseAdmin.from("airlines").insert(rows);
    if (error) throw new Error(error.message);
    return { ok: true, count: rows.length };
  });

export const listLocations = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.from("locations").select("*").order("city");
  if (error) throw new Error(error.message);
  return (data ?? []) as Location[];
});

const locationInput = z.object({
  city: z.string().min(1),
  code: z.string().min(1).max(4),
  urdu_name: z.string().optional().nullable(),
});

export const createLocation = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => locationInput.parse(d))
  .handler(async ({ data }) => {
    await requireUnlocked();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("locations").insert({
      city: data.city.toUpperCase(),
      code: data.code.toUpperCase(),
      urdu_name: (data.urdu_name || "").replace(/دبئی/g, "دوبئی") || null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteLocation = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    await requireUnlocked();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("locations").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listLuggage = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.from("luggage_options").select("*").order("sort_order");
  if (error) throw new Error(error.message);
  return (data ?? []) as LuggageOption[];
});

export const createLuggage = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ label: z.string().min(1) }).parse(d))
  .handler(async ({ data }) => {
    await requireUnlocked();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("luggage_options").insert({ label: data.label });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteLuggage = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    await requireUnlocked();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("luggage_options").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });


// ---------- Inquiry services (dropdown on /inquiry) ----------
export type InquiryService = { id: string; label: string; sort_order: number };

export const listServices = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("inquiry_services")
    .select("id,label,sort_order")
    .order("sort_order", { ascending: true })
    .order("label", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as InquiryService[];
});

export const createService = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ label: z.string().trim().min(1).max(80), sort_order: z.number().int().optional().default(100) }).parse(d),
  )
  .handler(async ({ data }) => {
    await requireUnlocked();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("inquiry_services").insert({ label: data.label, sort_order: data.sort_order });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteService = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    await requireUnlocked();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("inquiry_services").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Edit + bulk helpers for manage lists ----------
export const updateLocation = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).merge(locationInput).parse(d))
  .handler(async ({ data }) => {
    await requireUnlocked();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("locations")
      .update({
        city: data.city.toUpperCase(),
        code: data.code.toUpperCase(),
        urdu_name: (data.urdu_name || "").replace(/دبئی/g, "دوبئی") || null,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const bulkCreateLocations = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ rows: z.array(locationInput).min(1).max(500) }).parse(d))
  .handler(async ({ data }) => {
    await requireUnlocked();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const rows = data.rows.map((r) => ({
      city: r.city.toUpperCase(),
      code: r.code.toUpperCase(),
      urdu_name: (r.urdu_name || "").replace(/دبئی/g, "دوبئی") || null,
    }));
    const { error } = await supabaseAdmin.from("locations").insert(rows);
    if (error) throw new Error(error.message);
    return { ok: true, count: rows.length };
  });

export const updateLuggage = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), label: z.string().trim().min(1) }).parse(d))
  .handler(async ({ data }) => {
    await requireUnlocked();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("luggage_options").update({ label: data.label }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const bulkCreateLuggage = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ labels: z.array(z.string().trim().min(1)).min(1).max(500) }).parse(d))
  .handler(async ({ data }) => {
    await requireUnlocked();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("luggage_options").insert(data.labels.map((label) => ({ label })));
    if (error) throw new Error(error.message);
    return { ok: true, count: data.labels.length };
  });

export const updateService = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), label: z.string().trim().min(1).max(80) }).parse(d))
  .handler(async ({ data }) => {
    await requireUnlocked();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("inquiry_services").update({ label: data.label }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const bulkCreateServices = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ labels: z.array(z.string().trim().min(1).max(80)).min(1).max(500) }).parse(d))
  .handler(async ({ data }) => {
    await requireUnlocked();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("inquiry_services")
      .insert(data.labels.map((label) => ({ label, sort_order: 100 })));
    if (error) throw new Error(error.message);
    return { ok: true, count: data.labels.length };
  });

// ---------- Vendors ----------
export type Vendor = {
  id: string;
  name: string;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
};

export const listVendors = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("vendors")
    .select("id,name,contact_person,phone,email,notes")
    .order("name", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as Vendor[];
});

const vendorInput = z.object({
  name: z.string().trim().min(1).max(120),
  contact_person: z.string().trim().max(120).optional().nullable(),
  phone: z.string().trim().max(40).optional().nullable(),
  email: z.string().trim().max(160).optional().nullable(),
  notes: z.string().trim().max(1000).optional().nullable(),
});

export const createVendor = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => vendorInput.parse(d))
  .handler(async ({ data }) => {
    await requireUnlocked();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("vendors").insert(data);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateVendor = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).merge(vendorInput).parse(d))
  .handler(async ({ data }) => {
    await requireUnlocked();
    const { id, ...patch } = data;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("vendors").update(patch).eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteVendor = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    await requireUnlocked();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("vendors").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Site settings (e.g. PSF markup on homepage) ----------
export const getPsf = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("site_settings")
    .select("value")
    .eq("key", "psf")
    .maybeSingle();
  if (error) throw new Error(error.message);
  const n = Number(data?.value ?? 0);
  return { psf: Number.isFinite(n) ? n : 0 };
});

export const setPsf = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ psf: z.number().int().min(0).max(1000000) }).parse(d))
  .handler(async ({ data }) => {
    await requireUnlocked();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("site_settings")
      .upsert({ key: "psf", value: String(data.psf), updated_at: new Date().toISOString() }, { onConflict: "key" });
    if (error) throw new Error(error.message);
    return { ok: true, psf: data.psf };
  });

// ---------- Announcement (Latest Updates notification) ----------
export type Announcement = {
  enabled: boolean;
  text: string;
  imageUrl: string; // may be a data URL of an uploaded image
  linkUrl: string; // deprecated, kept for backwards compatibility
  updatedAt: string;
};

const defaultAnnouncement: Announcement = { enabled: false, text: "", imageUrl: "", linkUrl: "", updatedAt: "" };

export const getAnnouncement = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("site_settings")
    .select("value, updated_at")
    .eq("key", "announcement")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.value) return defaultAnnouncement;
  try {
    const parsed = JSON.parse(data.value);
    return { ...defaultAnnouncement, ...parsed, updatedAt: data.updated_at ?? "" } as Announcement;
  } catch {
    return defaultAnnouncement;
  }
});

export type AnnouncementHistoryItem = { text: string; imageUrl: string; updatedAt: string };

export const getAnnouncementHistory = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("site_settings")
    .select("value")
    .eq("key", "announcement_history")
    .maybeSingle();
  if (!data?.value) return [] as AnnouncementHistoryItem[];
  try {
    const parsed = JSON.parse(data.value);
    return Array.isArray(parsed) ? (parsed as AnnouncementHistoryItem[]) : [];
  } catch {
    return [] as AnnouncementHistoryItem[];
  }
});

export const setAnnouncement = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({
      enabled: z.boolean(),
      text: z.string().max(2000).default(""),
      imageUrl: z.string().max(3_000_000).default(""), // supports uploaded image data URLs
      linkUrl: z.string().max(2000).default(""),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    await requireUnlocked();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const now = new Date().toISOString();
    const { error } = await supabaseAdmin
      .from("site_settings")
      .upsert(
        { key: "announcement", value: JSON.stringify(data), updated_at: now },
        { onConflict: "key" },
      );
    if (error) throw new Error(error.message);

    // Append to the update archive (most recent first, capped at 50).
    if (data.text || data.imageUrl) {
      const { data: histRow } = await supabaseAdmin
        .from("site_settings")
        .select("value")
        .eq("key", "announcement_history")
        .maybeSingle();
      let history: AnnouncementHistoryItem[] = [];
      try {
        const parsed = histRow?.value ? JSON.parse(histRow.value) : [];
        if (Array.isArray(parsed)) history = parsed;
      } catch {
        history = [];
      }
      history = [{ text: data.text, imageUrl: data.imageUrl, updatedAt: now }, ...history].slice(0, 50);
      await supabaseAdmin
        .from("site_settings")
        .upsert(
          { key: "announcement_history", value: JSON.stringify(history), updated_at: now },
          { onConflict: "key" },
        );
    }
    return { ok: true, updatedAt: now };
  });


// ---------- Agents (admin management) ----------
export type AgentRow = {
  user_id: string;
  agency_name: string;
  email: string;
  contact_person: string;
  city: string;
  country_code: string;
  cell_number: string;
  office_address: string;
  status: "pending" | "approved" | "rejected";
  created_at: string;
};

export const listAgentsAdmin = createServerFn({ method: "GET" }).handler(async () => {
  await requireUnlocked();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("agents")
    .select("user_id,agency_name,email,contact_person,city,country_code,cell_number,office_address,status,created_at")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as AgentRow[];
});

const agentCreateInput = z.object({
  agency_name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
  contact_person: z.string().min(1),
  city: z.string().min(1),
  country_code: z.string().min(1),
  cell_number: z.string().min(1),
  office_address: z.string().min(1),
  status: z.enum(["pending", "approved", "rejected"]).optional().default("approved"),
});

export const createAgentAdmin = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => agentCreateInput.parse(d))
  .handler(async ({ data }) => {
    await requireUnlocked();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { agency_name: data.agency_name },
    });
    if (createErr || !created.user) throw new Error(createErr?.message ?? "Failed to create user");
    const userId = created.user.id;
    const { error: insErr } = await supabaseAdmin.from("agents").insert({
      user_id: userId,
      agency_name: data.agency_name,
      email: data.email,
      contact_person: data.contact_person,
      city: data.city,
      country_code: data.country_code,
      cell_number: data.cell_number,
      office_address: data.office_address,
      status: data.status,
    });
    if (insErr) {
      await supabaseAdmin.auth.admin.deleteUser(userId);
      throw new Error(insErr.message);
    }
    return { ok: true };
  });

const agentUpdateInput = z.object({
  user_id: z.string().uuid(),
  agency_name: z.string().min(1),
  contact_person: z.string().min(1),
  city: z.string().min(1),
  country_code: z.string().min(1),
  cell_number: z.string().min(1),
  office_address: z.string().min(1),
  status: z.enum(["pending", "approved", "rejected"]),
  new_password: z.string().min(6).optional().nullable(),
});

export const updateAgentAdmin = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => agentUpdateInput.parse(d))
  .handler(async ({ data }) => {
    await requireUnlocked();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { user_id, new_password, ...rest } = data;
    const { error } = await supabaseAdmin.from("agents").update(rest).eq("user_id", user_id);
    if (error) throw new Error(error.message);
    if (new_password) {
      const { error: pwErr } = await supabaseAdmin.auth.admin.updateUserById(user_id, { password: new_password });
      if (pwErr) throw new Error(pwErr.message);
    }
    return { ok: true };
  });

export const deleteAgentAdmin = createServerFn({ method: "POST" })
  .inputValidator((d: { user_id: string }) => z.object({ user_id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    await requireUnlocked();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("agents").delete().eq("user_id", data.user_id);
    await supabaseAdmin.auth.admin.deleteUser(data.user_id).catch(() => {});
    return { ok: true };
  });
