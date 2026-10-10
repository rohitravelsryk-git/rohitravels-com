import { createServerFn } from "@tanstack/react-start";
import { useSession } from "@tanstack/react-start/server";
import { z } from "zod";

type GateSession = { unlocked?: boolean; staffUsername?: string | null };

function sessionConfig() {
  const password = typeof process !== "undefined" ? (process.env.ROHI_SESSION_SECRET || process.env.SESSION_SECRET) : undefined;
  if (!password) throw new Error("ROHI_SESSION_SECRET is not configured");
  return { password, name: "rohi-admin", maxAge: 60 * 60 * 8, cookie: { httpOnly: true, secure: true, sameSite: "lax" as const, path: "/" } };
}

async function requireUnlocked() {
  const s = await useSession<GateSession>(sessionConfig());
  if (!s.data.unlocked) throw new Error("Unauthorized");
  return s;
}

export type BankWallet = {
  id: string;
  name: string;
  kind: "bank" | "wallet";
  website_url: string | null;
  logo_url: string | null;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
};

const TABLE_HELP =
  "The Banks & Wallets table is missing in the production database. Run supabase/migrations/20261011090000_bank_wallet_addons.sql once in the Supabase SQL Editor, then try again.";

// Empty -> null. A bare domain gets https:// added. Plain http:// is rejected.
const urlField = z.preprocess((v) => {
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (!t) return null;
  if (/^https:\/\//i.test(t)) return t;
  if (/^http:\/\//i.test(t)) return t; // fails the https refine below with a clear message
  return `https://${t}`;
}, z.string().max(500).url("Enter a valid web address").refine((u) => /^https:\/\//i.test(u), "Web address must start with https://").nullable());

const fields = {
  name: z.string().trim().min(1, "Bank / wallet name is required").max(80),
  kind: z.enum(["bank", "wallet"]).default("bank"),
  website_url: urlField,
  logo_url: urlField,
};

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as import("@supabase/supabase-js").SupabaseClient;
}

function friendly(error: { message: string; code?: string }, name?: string) {
  if (error.code === "23505") return `"${name ?? "That name"}" is already in your banks & wallets list.`;
  if (/bank_wallet_addons/i.test(error.message) && /(does not exist|schema cache|relation)/i.test(error.message)) return TABLE_HELP;
  return error.message;
}

export const listBanksWallets = createServerFn({ method: "GET" }).handler(async () => {
  await requireUnlocked();
  const db = await admin();
  const { data, error } = await db.from("bank_wallet_addons").select("*").order("sort_order", { ascending: true }).order("name", { ascending: true });
  if (error) throw new Error(friendly(error));
  return (data ?? []) as BankWallet[];
});

export const createBankWallet = createServerFn({ method: "POST" })
  .validator((d: unknown) => z.object(fields).parse(d))
  .handler(async ({ data }) => {
    await requireUnlocked();
    const db = await admin();
    const { data: created, error } = await db.from("bank_wallet_addons").insert({ ...data }).select("*").limit(1);
    if (error) throw new Error(friendly(error, data.name));
    return (created?.[0] ?? null) as BankWallet | null;
  });

export const updateBankWallet = createServerFn({ method: "POST" })
  .validator((d: unknown) => z.object({ id: z.string().uuid(), ...fields }).parse(d))
  .handler(async ({ data }) => {
    await requireUnlocked();
    const db = await admin();
    const { id, ...rest } = data;
    const { data: updated, error } = await db
      .from("bank_wallet_addons")
      .update({ ...rest, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("*")
      .limit(1);
    if (error) throw new Error(friendly(error, data.name));
    if (!updated || updated.length === 0) throw new Error("Bank / wallet was not found. Refresh the page and try again.");
    return updated[0] as BankWallet;
  });

export const deleteBankWallet = createServerFn({ method: "POST" })
  .validator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    await requireUnlocked();
    const db = await admin();
    const { error } = await db.from("bank_wallet_addons").delete().eq("id", data.id);
    if (error) throw new Error(friendly(error));
    return { ok: true };
  });
