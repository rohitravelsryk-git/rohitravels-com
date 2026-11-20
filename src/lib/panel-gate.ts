import { useSession } from "@tanstack/react-start/server";

/**
 * Shared server-side gate for the admin panel session ("rohi-admin" cookie).
 *
 * - Administrators (unlocked session without a staff username) pass every check.
 * - Staff sessions pass only when the staff account is still active in the
 *   database AND one of the required menu tabs is in its allowed_tabs list.
 *   Permissions are read fresh from the database on every call, so revoking a
 *   tab or deactivating a staff user takes effect immediately.
 * - Calling with no tabs means "administrators only".
 *
 * Only call from inside server function handlers.
 */
type GateSession = { unlocked?: boolean; staffUsername?: string | null; staffTabs?: string[] };

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

export type PanelCaller = { role: "admin" } | { role: "staff"; username: string; tabs: string[] };

/** Returns the current panel caller, or null when the panel is locked. Never throws for a locked panel. */
export async function getPanelCaller(): Promise<PanelCaller | null> {
  const session = await useSession<GateSession>(sessionConfig());
  if (!session.data.unlocked) return null;
  const username = session.data.staffUsername;
  if (!username) return { role: "admin" };
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: row } = await supabaseAdmin
    .from("staff_users")
    .select("username, allowed_tabs, active")
    .eq("username", username)
    .maybeSingle();
  if (!row || !row.active) return null;
  const tabs = Array.isArray(row.allowed_tabs)
    ? (row.allowed_tabs as unknown[]).filter((t): t is string => typeof t === "string")
    : [];
  return { role: "staff", username: row.username, tabs };
}

/** Administrators always pass; staff pass only with one of `tabs`. Empty `tabs` = admin only. */
export async function requirePanelTab(tabs: string[] = []) {
  const caller = await getPanelCaller();
  if (!caller) throw new Error("Unauthorized");
  if (caller.role === "admin") return caller;
  if (tabs.length > 0 && tabs.some((t) => caller.tabs.includes(t))) return caller;
  throw new Error("Forbidden: you do not have access to this section");
}

export async function requirePanelAdmin() {
  return requirePanelTab([]);
}

/**
 * Verifies the signed-in agent from the request's bearer token (attached by the
 * client function middleware). Returns null when no valid sign-in is present.
 */
export async function getAgentCaller(): Promise<{ userId: string; email: string; approved: boolean } | null> {
  const { getRequest } = await import("@tanstack/react-start/server");
  const auth = getRequest()?.headers.get("authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return null;
  const token = auth.slice(7).trim();
  if (token.split(".").length !== 3) return null;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) return null;
  const { data: agent } = await supabaseAdmin
    .from("agents")
    .select("status")
    .eq("user_id", data.user.id)
    .maybeSingle();
  return {
    userId: data.user.id,
    email: (data.user.email ?? "").toLowerCase(),
    approved: agent?.status === "approved",
  };
}

/** Admin panel callers with one of `tabs`, or approved signed-in agents. */
export async function requirePanelTabOrApprovedAgent(tabs: string[]) {
  const panel = await getPanelCaller();
  if (panel && (panel.role === "admin" || tabs.some((t) => panel.tabs.includes(t)))) return { kind: "panel" as const };
  const agent = await getAgentCaller();
  if (agent?.approved) return { kind: "agent" as const, userId: agent.userId };
  throw new Error("Unauthorized");
}
