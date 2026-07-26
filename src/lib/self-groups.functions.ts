import { createServerFn } from "@tanstack/react-start";
import { useSession } from "@tanstack/react-start/server";
import { z } from "zod";

type GateSession = { unlocked?: boolean };
function sessionConfig() {
  const password = process.env.SESSION_SECRET;
  if (!password) throw new Error("SESSION_SECRET not set");
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
  await requireUnlocked();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await (supabaseAdmin as any)
    .from("self_group_passengers")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as SelfGroupPassenger[];
});

export const createSelfGroupPassenger = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => paxInput.parse(d))
  .handler(async ({ data }) => {
    await requireUnlocked();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await (supabaseAdmin as any)
      .from("self_group_passengers").insert(data).select().single();
    if (error) throw new Error(error.message);
    return row as SelfGroupPassenger;
  });

export const updateSelfGroupPassenger = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => paxInput.extend({ id: z.string().uuid() }).parse(d))
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
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    await requireUnlocked();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any)
      .from("self_group_passengers").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
