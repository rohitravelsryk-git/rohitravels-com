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

const SETTING_KEY = "admin_menu_layout";

export type AdminMenuGroup = { id: string; label?: string; tabIds: string[] };
export type AdminMenuLayout = { groups: AdminMenuGroup[]; favorites: string[] };

/**
 * The admin navbar arrangement (folder order, which menu sits in which folder,
 * standalone items and the favourites bar). It used to live in one browser's
 * local storage, so the arrangement "went back" on another device or whenever
 * that storage was cleared; it is stored on the site now, last save winning.
 */
export const getAdminMenuLayout = createServerFn({ method: "GET" }).handler(
  async (): Promise<AdminMenuLayout | null> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("site_settings")
      .select("value")
      .eq("key", SETTING_KEY)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data?.value) return null;
    try {
      const parsed = JSON.parse(data.value) as Partial<AdminMenuLayout>;
      const groups = Array.isArray(parsed?.groups)
        ? parsed.groups
            .filter((g): g is AdminMenuGroup => !!g && typeof g.id === "string" && Array.isArray(g.tabIds))
            .map((g) => ({
              id: g.id,
              ...(typeof g.label === "string" && g.label.trim() ? { label: g.label } : {}),
              tabIds: g.tabIds.filter((id): id is string => typeof id === "string"),
            }))
        : [];
      const favorites = Array.isArray(parsed?.favorites)
        ? parsed.favorites.filter((id): id is string => typeof id === "string")
        : [];
      return groups.length ? { groups, favorites } : null;
    } catch {
      return null;
    }
  },
);

const groupSchema = z.object({
  id: z.string().min(1).max(60),
  label: z.string().max(60).optional(),
  tabIds: z.array(z.string().min(1).max(60)).max(150),
});

export const saveAdminMenuLayout = createServerFn({ method: "POST" })
  .validator((d: unknown) =>
    z
      .object({
        groups: z.array(groupSchema).min(1).max(60),
        favorites: z.array(z.string().min(1).max(60)).max(150),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    await requireUnlocked();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("site_settings")
      .upsert(
        { key: SETTING_KEY, value: JSON.stringify(data), updated_at: new Date().toISOString() },
        { onConflict: "key" },
      );
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
