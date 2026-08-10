import { createServerFn } from "@tanstack/react-start";
import { useSession } from "@tanstack/react-start/server";
import { createHash, timingSafeEqual } from "node:crypto";
import { z } from "zod";

/**
 * Destructive "reset test data" actions for the admin panel.
 *
 * Each reset wipes one dataset and restarts its numbering (SR #, Booking IDs, Q#)
 * from 1. Because the action is irreversible it is gated twice: the caller must
 * hold an *admin* panel session, and must additionally re-prove identity with
 * the admin password or a one-time code emailed to the recovery address.
 */

type GateSession = { unlocked?: boolean; staffUsername?: string | null };

const TARGETS = ["group_tickets", "agent_bookings", "queries"] as const;
export type ResetTarget = (typeof TARGETS)[number];

export const RESET_LABEL: Record<ResetTarget, string> = {
  group_tickets: "Group Tickets Confirmed",
  agent_bookings: "All Booking Requests",
  queries: "Queries",
};

function sessionConfig() {
  const password = typeof process !== "undefined" ? process.env["SESSION_SECRET"] : undefined;
  if (!password) return { password: "fallback-secret-for-prerender", name: "rohi-admin-prerender" };
  return {
    password,
    name: "rohi-admin",
    maxAge: 60 * 60 * 8,
    cookie: { httpOnly: true, secure: true, sameSite: "none" as const, path: "/" },
  };
}

async function requireAdmin() {
  const session = await useSession<GateSession>(sessionConfig());
  if (!session.data.unlocked || session.data.staffUsername) {
    throw new Error("Forbidden: admin role required");
  }
}

function hashPassword(pw: string) {
  return createHash("sha256").update(pw, "utf8").digest("hex");
}

function constantEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a, "utf8"), Buffer.from(b, "utf8"));
}

/** Emails a 6-digit confirmation code to the admin recovery address. */
export const requestResetCode = createServerFn({ method: "POST" })
  .validator((d: { target: ResetTarget }) => z.object({ target: z.enum(TARGETS) }).parse(d))
  .handler(async ({ data }) => {
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: creds } = await supabaseAdmin
      .from("admin_credentials")
      .select("recovery_email")
      .eq("id", true)
      .maybeSingle();
    const email = (creds as { recovery_email?: string } | null)?.recovery_email ?? "raisabdulrazzaq@gmail.com";
    const { createLoginOtp } = await import("./login-otp.server");
    const otp = await createLoginOtp({
      purpose: "admin",
      subject: `reset:${data.target}`,
      email,
      who: `a data reset of "${RESET_LABEL[data.target]}"`,
    });
    return { ok: true as const, challenge: otp.challenge, maskedEmail: otp.maskedEmail, sent: otp.sent };
  });

/** Performs the reset after verifying the admin password OR an emailed code. */
export const performReset = createServerFn({ method: "POST" })
  .validator((d: { target: ResetTarget; password?: string; challenge?: string; code?: string }) =>
    z
      .object({
        target: z.enum(TARGETS),
        password: z.string().optional(),
        challenge: z.string().uuid().optional(),
        code: z.string().min(4).max(10).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let verified = false;
    if (data.challenge && data.code) {
      const { consumeLoginOtp } = await import("./login-otp.server");
      const res = await consumeLoginOtp({ challenge: data.challenge, code: data.code, purpose: "admin" });
      if (!res.ok) return { ok: false as const, error: res.error };
      if (res.subject !== `reset:${data.target}`) {
        return { ok: false as const, error: "This code is not valid for this reset." };
      }
      verified = true;
    } else if (data.password) {
      const { data: creds } = await supabaseAdmin
        .from("admin_credentials")
        .select("password_hash")
        .eq("id", true)
        .maybeSingle();
      const stored = (creds as { password_hash?: string } | null)?.password_hash ?? "";
      if (stored) {
        verified = constantEqual(hashPassword(data.password), stored);
      } else {
        const envPw = process.env["SITE_PASSWORD"] ?? "";
        verified = Boolean(envPw) && constantEqual(hashPassword(data.password), hashPassword(envPw));
      }
      if (!verified) return { ok: false as const, error: "Incorrect admin password." };
    }

    if (!verified) return { ok: false as const, error: "Password or emailed code required." };

    const { data: result, error } = await supabaseAdmin.rpc("admin_reset_dataset", { _target: data.target });
    if (error) return { ok: false as const, error: error.message };

    const deleted = Number((result as { deleted?: number } | null)?.deleted ?? 0);
    return { ok: true as const, deleted, label: RESET_LABEL[data.target] };
  });
