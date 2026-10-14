import { createServerFn } from "@tanstack/react-start";
import { useSession } from "@tanstack/react-start/server";
import { z } from "zod";
import {
  SITE_URL,
  signApprovalToken,
  sendMail,
  agentApprovedEmail,
} from "./agent-admin-helpers";

type GateSession = { unlocked?: boolean; staffUsername?: string | null };

function sessionConfig() {
  const password = typeof process !== "undefined" ? (process.env.ROHI_SESSION_SECRET || process.env.SESSION_SECRET) : undefined;
  if (!password) throw new Error("ROHI_SESSION_SECRET is not configured");
  return {
    password,
    name: "rohi-admin",
    maxAge: 60 * 60 * 8,
    cookie: {
      httpOnly: true, secure: true, sameSite: "lax" as const, path: "/",
    },
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

export type AgentRow = {
  user_id: string;
  user_code: string | null;
  agency_name: string;
  contact_person: string;
  email: string;
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
  const [agentsRes, vendorsRes] = await Promise.all([
    supabaseAdmin.from("agents").select("*").order("created_at", { ascending: false }),
    supabaseAdmin.from("vendors").select("id, name, vendor_code, contact_person, phone, email"),
  ]);
  if (agentsRes.error) throw new Error(agentsRes.error.message);

  const agents = (agentsRes.data ?? []) as AgentRow[];
  const vendors = vendorsRes.data ?? [];

  if (vendors.length === 0) return agents;

  const vendorNames = new Set(
    vendors.map((v: any) => (v.name || "").toLowerCase().trim()).filter(Boolean)
  );
  const vendorCodes = new Set(
    vendors.map((v: any) => (v.vendor_code || "").toLowerCase().trim()).filter(Boolean)
  );
  const vendorPhones = new Set(
    vendors.map((v: any) => (v.phone || "").replace(/\D/g, "")).filter((p: string) => p.length >= 7)
  );
  const vendorEmails = new Set(
    vendors.map((v: any) => (v.email || "").toLowerCase().trim()).filter(Boolean)
  );

  return agents.filter((agent) => {
    const aName = (agent.agency_name || "").toLowerCase().trim();
    if (aName && vendorNames.has(aName)) return false;

    const aCode = (agent.user_code || "").toLowerCase().trim();
    if (aCode && vendorCodes.has(aCode)) return false;

    const aPhone = (agent.cell_number || "").replace(/\D/g, "");
    if (aPhone && aPhone.length >= 7 && vendorPhones.has(aPhone)) return false;

    const aEmail = (agent.email || "").toLowerCase().trim();
    if (aEmail && vendorEmails.has(aEmail)) return false;

    return true;
  });
});

export const countPendingAgents = createServerFn({ method: "GET" }).handler(async () => {
  await requireUnlocked();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { count, error } = await supabaseAdmin
    .from("agents")
    .select("*", { count: "exact", head: true })
    .eq("status", "pending");
  if (error) throw new Error(error.message);
  return { count: count ?? 0 };
});

export const setAgentStatusAdmin = createServerFn({ method: "POST" })
  .validator((d: { user_id: string; status: "approved" | "rejected" | "pending" }) =>
    z.object({
      user_id: z.string().uuid(),
      status: z.enum(["approved", "rejected", "pending"]),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    await requireUnlocked();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: updated, error } = await supabaseAdmin
      .from("agents")
      .update({ status: data.status })
      .eq("user_id", data.user_id)
      .select("agency_name, contact_person, email, status")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (updated && data.status === "approved") {
      const loginUrl = `${SITE_URL.replace(/\/$/, "")}/agent/login`;
      await sendMail(
        updated.email,
        `Your agency ${updated.agency_name} has been approved`,
        agentApprovedEmail(updated.agency_name, updated.contact_person, loginUrl),
      );
    }
    try {
      const { syncAgentLedgersLiveInternal } = await import("@/lib/ledger-admin.functions");
      await syncAgentLedgersLiveInternal();
    } catch (sheetErr) {
      console.warn("[agent-admin] Google Sheets sync after status change failed:", sheetErr);
    }
    return { ok: true as const };
  });

// signApprovalToken is now async in helpers
export { signApprovalToken };

export const updateAgentAdmin = createServerFn({ method: "POST" })
  .validator((d: unknown) =>
    z.object({
      user_id: z.string().uuid(),
      agency_name: z.string().min(1),
      contact_person: z.string().min(1),
      city: z.string().default(""),
      country: z.string().default(""),
      country_code: z.string().default(""),
      cell_number: z.string().default(""),
      office_address: z.string().default(""),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    await requireUnlocked();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { user_id, ...patch } = data;
    const { error } = await supabaseAdmin.from("agents").update(patch).eq("user_id", user_id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const deleteAgentAdmin = createServerFn({ method: "POST" })
  .validator((d: { user_id: string }) => z.object({ user_id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    await requireUnlocked();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    
    // 1. Delete the auth user (this will cascade delete the agents record if RLS/Foreign keys are set, 
    // but we'll do both to be safe or if cascade isn't configured)
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(data.user_id);
    if (authError) throw new Error(`Auth deletion failed: ${authError.message}`);

    // 2. Delete agent record if it persists
    const { error: agentError } = await supabaseAdmin.from("agents").delete().eq("user_id", data.user_id);
    if (agentError) throw new Error(`Agent record deletion failed: ${agentError.message}`);

    // Instant Google Sheets sync: prune deleted agent's tab and update overview
    try {
      const { syncAgentLedgersLiveInternal } = await import("@/lib/ledger-admin.functions");
      await syncAgentLedgersLiveInternal();
    } catch (sheetErr) {
      console.warn("[agent-admin] Google Sheets sync after delete agent failed:", sheetErr);
    }

    return { ok: true as const };
  });

export const createAgentAdmin = createServerFn({ method: "POST" })
  .validator((d: unknown) =>
    z.object({
      agency_name: z.string().min(1),
      contact_person: z.string().min(1),
      email: z.string().email(),
      city: z.string().min(1),
      country_code: z.string().min(1),
      cell_number: z.string().min(1),
      office_address: z.string().optional(),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    await requireUnlocked();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1. Create Auth User
    const tempPassword = `RohiAgent${Math.floor(1000 + Math.random() * 9000)}!`;
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { role: 'agent' }
    });

    if (authError) throw new Error(authError.message);
    if (!authData.user) throw new Error("Failed to create auth user");

    // 2. Create Agent Record
    const user_code = `RA-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
    const { error: agentError } = await supabaseAdmin.from("agents").insert({
      user_id: authData.user.id,
      user_code,
      agency_name: data.agency_name,
      contact_person: data.contact_person,
      email: data.email,
      city: data.city,
      country_code: data.country_code,
      cell_number: data.cell_number,
      office_address: data.office_address || "",
      status: "approved" // Manually added agents are approved by default
    });

    if (agentError) {
      // Rollback auth user
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      throw new Error(agentError.message);
    }

    // Instant Google Sheets sync: create agent's tab and update Balances Overview
    try {
      const { syncAgentLedgersLiveInternal } = await import("@/lib/ledger-admin.functions");
      await syncAgentLedgersLiveInternal();
    } catch (sheetErr) {
      console.warn("[agent-admin] Google Sheets sync after create agent failed:", sheetErr);
    }

    return { ok: true as const, tempPassword };
  });

export const getRegistrationVisibility = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("site_settings")
    .select("value")
    .eq("key", "registration_hidden")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return { visible: data?.value !== "true" };
});

export const setRegistrationVisibility = createServerFn({ method: "POST" })
  .validator((d: { visible: boolean }) => z.object({ visible: z.boolean() }).parse(d))
  .handler(async ({ data }) => {
    await requireUnlocked();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("site_settings")
      .upsert({ 
        key: "registration_hidden", 
        value: String(!data.visible), 
        updated_at: new Date().toISOString() 
      }, { onConflict: "key" });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
