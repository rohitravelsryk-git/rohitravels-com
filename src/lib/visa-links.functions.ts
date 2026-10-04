import { createServerFn } from "@tanstack/react-start";
import { useSession } from "@tanstack/react-start/server";
import { z } from "zod";

type GateSession = { unlocked?: boolean };

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

export type VisaLink = {
  id: string;
  country: string;
  purpose: string;
  url: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

const linkInput = z.object({
  country: z.string().trim().min(1, "Country is required"),
  purpose: z.string().trim().min(1, "Purpose / description is required"),
  url: z.string().trim().url("Enter a valid URL, including https://"),
  sort_order: z.number().int().optional().default(0),
});

export const listVisaLinks = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("visa_verification_links")
    .select("*")
    .order("country", { ascending: true })
    .order("sort_order", { ascending: true });
  if (error) {
    console.error("[listVisaLinks] Database query error:", error.message);
    throw new Error("Visa verification link data is temporarily unavailable. Please try again shortly.");
  }
  return (data ?? []) as VisaLink[];
});

export const createVisaLink = createServerFn({ method: "POST" })
  .validator((d: unknown) => linkInput.parse(d))
  .handler(async ({ data }) => {
    await requireUnlocked();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: created, error } = await supabaseAdmin
      .from("visa_verification_links")
      .insert({
        country: data.country,
        purpose: data.purpose,
        url: data.url,
        sort_order: data.sort_order ?? 0,
      })
      .select("*")
      .limit(1);
    if (error) throw new Error(`Could not add visa link: ${error.message}`);
    const row = created?.[0] as VisaLink | undefined;
    if (!row) throw new Error("Could not add visa link: the database did not return the created record.");
    return row;
  });

export const updateVisaLink = createServerFn({ method: "POST" })
  .validator((d: unknown) => linkInput.extend({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    await requireUnlocked();
    const { id, ...rest } = data;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: updated, error } = await supabaseAdmin
      .from("visa_verification_links")
      .update(rest)
      .eq("id", id)
      .select("*")
      .limit(1);
    if (error) throw new Error(`Could not update visa link: ${error.message}`);
    const row = updated?.[0] as VisaLink | undefined;
    if (!row) throw new Error("Could not update visa link: record was not found or was not changed.");
    return row;
  });

/**
 * Mirrors the authoritative Visa Links table to the existing Addons worksheet.
 * Supabase remains the source of truth; this is a projection only.
 */
export const syncVisaLinksToAddons = createServerFn({ method: "POST" })
  .handler(async () => {
    await requireUnlocked();
    const engine = await import("@/lib/backup/engine.server");
    const result = await engine.runSync({
      full: true,
      tables: ["visa_verification_links"],
      kind: "visa-links-addons",
    });
    if (result.failures.length || result.warningCount) {
      throw new Error(
        result.failures.length
          ? result.failures.map((f) => f.message).join(" | ")
          : "Visa link saved in Supabase, but the Addons sheet mirror reported a warning.",
      );
    }
    return result;
  });

export const deleteVisaLink = createServerFn({ method: "POST" })
  .validator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    await requireUnlocked();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("visa_verification_links")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(`Could not delete visa link: ${error.message}`);
    return { ok: true };
  });
