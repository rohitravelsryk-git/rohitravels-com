import { createServerFn } from "@tanstack/react-start";
import { useSession } from "@tanstack/react-start/server";
import { z } from "zod";
import {
  SITE_URL,
  signApprovalToken,
  sendMail,
  agentApprovedEmail,
} from "./agent-admin-helpers";

type GateSession = { unlocked?: boolean };

function sessionConfig() {
  const password = process.env.SESSION_SECRET;
  if (!password) throw new Error("SESSION_SECRET not set");
  return {
    password,
    name: "rohi-admin",
    maxAge: 60 * 60 * 8,
    cookie: {
      httpOnly: true, secure: true, sameSite: "none" as const, path: "/",
    },
  };
}

async function requireUnlocked() {
  const session = await useSession<GateSession>(sessionConfig());
  if (!session.data.unlocked) throw new Error("Unauthorized");
  return session;
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
  const { data, error } = await supabaseAdmin
    .from("agents")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as AgentRow[];
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
  .inputValidator((d: { user_id: string; status: "approved" | "rejected" | "pending" }) =>
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
    return { ok: true as const };
  });

// Re-export for other server code that needs the token signer
export { signApprovalToken };
