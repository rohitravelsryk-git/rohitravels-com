import { createServerFn } from "@tanstack/react-start";
import { useSession } from "@tanstack/react-start/server";
import { z } from "zod";

type GateSession = { unlocked?: boolean };

function sessionConfig() {
  const password = typeof process !== "undefined" ? process.env.SESSION_SECRET : undefined;
  if (!password) throw new Error("Server misconfigured: SESSION_SECRET is not set");
  return {
    password,
    name: "rohi-admin",
    maxAge: 60 * 60 * 8,
    cookie: { httpOnly: true, secure: true, sameSite: "none" as const, path: "/" },
  };
}

async function requireUnlocked() {
  const s = await useSession<GateSession>(sessionConfig());
  if (!s.data.unlocked) throw new Error("Unauthorized");
  return s;
}

const SETTING_KEY = "admin_tab_order";

/** Tab ids in the order the admin last dragged them, newest save winning. */
export const getAdminTabOrder = createServerFn({ method: "GET" }).handler(async (): Promise<string[]> => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("site_settings")
    .select("value")
    .eq("key", SETTING_KEY)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.value) return [];
  try {
    const parsed = JSON.parse(data.value);
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
});

export const saveAdminTabOrder = createServerFn({ method: "POST" })
  .validator((d: unknown) => z.object({ order: z.array(z.string().min(1).max(60)).max(80) }).parse(d))
  .handler(async ({ data }) => {
    await requireUnlocked();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("site_settings")
      .upsert(
        { key: SETTING_KEY, value: JSON.stringify(data.order), updated_at: new Date().toISOString() },
        { onConflict: "key" },
      );
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
