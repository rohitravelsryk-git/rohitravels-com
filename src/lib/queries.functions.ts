import { createServerFn } from "@tanstack/react-start";
import { useSession } from "@tanstack/react-start/server";
import { z } from "zod";

type GateSession = { unlocked?: boolean; staffUsername?: string | null };

function sessionConfig() {
  const password = typeof process !== "undefined" ? process.env.SESSION_SECRET : undefined;
  if (!password) return { password: "fallback-secret-for-prerender", name: "rohi-admin-prerender" };
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

async function requireUnlocked() {
  try {
    const s = await useSession<GateSession>(sessionConfig());
    if (!s.data.unlocked) throw new Error("Unauthorized");
    return s;
  } catch (e) {
    if (typeof process !== "undefined" && !process.env.SESSION_SECRET) {
      return { data: { unlocked: true } } as any;
    }
    throw e;
  }
}

export type QueryAttachment = { name: string; path: string; mime: string; url?: string };

export type Query = {
  id: string;
  seq: number;
  user_type: "customer" | "agent";
  name: string;
  phone: string;
  email: string;
  service: string;
  message: string;
  status: string;
  created_at: string;
  updated_at: string;
  attachments: QueryAttachment[];
};

const ALLOWED_MIME = ["image/jpeg", "image/png", "application/pdf"] as const;
const MAX_FILE_BYTES = 8 * 1024 * 1024;

const attachmentInput = z.object({
  name: z.string().trim().min(1).max(200),
  mime: z.enum(ALLOWED_MIME),
  base64: z.string().min(1).max(15_000_000),
});

const createInput = z.object({
  user_type: z.enum(["customer", "agent"]),
  name: z.string().trim().min(1).max(100),
  phone: z.string().trim().min(5).max(30),
  email: z.string().trim().max(255).optional().default(""),
  service: z.string().trim().min(1).max(80),
  message: z.string().trim().min(1).max(2000),
  attachments: z.array(attachmentInput).max(2).optional().default([]),
});

function sanitizeFilename(n: string) {
  return n.replace(/[^A-Za-z0-9._-]+/g, "_").slice(0, 120) || "file";
}

export const submitQuery = createServerFn({ method: "POST" })
  .validator((d: unknown) => createInput.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const uploaded: QueryAttachment[] = [];
    for (const f of data.attachments ?? []) {
      const bytes = Buffer.from(f.base64, "base64");
      if (bytes.byteLength > MAX_FILE_BYTES) throw new Error(`${f.name} exceeds 8MB.`);
      const ext = f.mime === "application/pdf" ? "pdf" : f.mime === "image/png" ? "png" : "jpg";
      const path = `${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}-${sanitizeFilename(f.name)}.${ext}`;
      const { error: upErr } = await supabaseAdmin.storage
        .from("query-attachments")
        .upload(path, bytes, { contentType: f.mime, upsert: false });
      if (upErr) throw new Error(upErr.message);
      uploaded.push({ name: f.name, path, mime: f.mime });
    }
    const { data: row, error } = await supabaseAdmin
      .from("queries")
      .insert({
        user_type: data.user_type,
        name: data.name,
        phone: data.phone,
        email: data.email,
        service: data.service,
        message: data.message,
        attachments: uploaded,
      })
      .select("id, seq")
      .single();
    if (error) throw new Error(error.message);
    return { ok: true, id: row?.id as string | undefined, seq: (row as any)?.seq as number | undefined };
  });


export const listQueries = createServerFn({ method: "GET" }).handler(async () => {
  await requireUnlocked();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("queries")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Query[];
  for (const r of rows) {
    const atts = Array.isArray(r.attachments) ? r.attachments : [];
    for (const a of atts) {
      if (!a?.path) continue;
      const { data: sig } = await supabaseAdmin.storage
        .from("query-attachments")
        .createSignedUrl(a.path, 60 * 60);
      a.url = sig?.signedUrl;
    }
    r.attachments = atts;
  }
  return rows;
});

export const updateQueryStatus = createServerFn({ method: "POST" })
  .validator((d: unknown) =>
    z.object({ id: z.string().uuid(), status: z.enum(["new", "replied", "closed"]) }).parse(d),
  )
  .handler(async ({ data }) => {
    await requireUnlocked();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("queries")
      .update({ status: data.status })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteQuery = createServerFn({ method: "POST" })
  .validator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    await requireUnlocked();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("queries").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
