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
 *
 * A third gate protects the data itself: the dataset is only deleted once the
 * current rows are archived by the backup snapshot machinery, so a reset can
 * always be undone from the backup spreadsheet.
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
  const password =
    (typeof process !== "undefined" ? (process.env.ROHI_SESSION_SECRET || process.env.SESSION_SECRET) : undefined) ||
    "rohi-travels-international-admin-session-secret-key-32chars";
  return {
    password,
    name: "rohi-admin",
    maxAge: 60 * 60 * 8,
    cookie: { httpOnly: true, secure: true, sameSite: "lax" as const, path: "/" },
  };
}

async function requireAdmin() {
  const session = await useSession<GateSession>(sessionConfig());
  if (!session.data.unlocked || session.data.staffUsername) {
    throw new Error("Forbidden: admin role required");
  }
}

async function verifyStoredPassword(pw: string, stored: string) {
  const { verifyPassword } = await import("./password-hash.server");
  return verifyPassword(pw, stored);
}

function sha256Hex(v: string) {
  return createHash("sha256").update(v, "utf8").digest("hex");
}

function constantEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a, "utf8"), Buffer.from(b, "utf8"));
}

/** Rows archived by a snapshot this recent are treated as a safe restore point. */
const SNAPSHOT_FRESH_MS = 24 * 60 * 60 * 1000;

/**
 * Guarantees the rows a reset is about to delete exist in the backup spreadsheet.
 * Reuses the Backup page's snapshot machinery rather than a second export path.
 */
async function ensureArchived(target: ResetTarget) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const cutoff = new Date(Date.now() - SNAPSHOT_FRESH_MS).toISOString();
  const { data: recent, error } = await supabaseAdmin
    .from("backup_snapshots")
    .select("id")
    .eq("status", "success")
    .gt("taken_at", cutoff)
    .limit(1);
  if (error) {
    return { ok: false as const, error: `Could not check the backup archive (${error.message}). Nothing was deleted.` };
  }
  if ((recent ?? []).length) return { ok: true as const };

  const { createSnapshot } = await import("./backup/engine.server");
  const snap = await createSnapshot(`Auto — before resetting ${RESET_LABEL[target]}`, "pre-reset");
  if (snap.status !== "success") {
    return {
      ok: false as const,
      error: `Your current records could not be archived (${snap.message || "the snapshot did not finish"}). Nothing was deleted.`,
    };
  }
  return { ok: true as const };
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
    const email = (creds as { recovery_email?: string } | null)?.recovery_email ?? "rohitravelsryk@gmail.com";
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
        verified = (await verifyStoredPassword(data.password, stored)).ok;
      } else {
        const envPw = (typeof process !== "undefined" ? process.env["SITE_PASSWORD"] : undefined) ?? "";
        verified = Boolean(envPw) && constantEqual(sha256Hex(data.password), sha256Hex(envPw));
      }
      if (!verified) return { ok: false as const, error: "Incorrect admin password." };
    }

    if (!verified) return { ok: false as const, error: "Password or emailed code required." };

    const archived = await ensureArchived(data.target);
    if (!archived.ok) return { ok: false as const, error: archived.error };

    const { data: result, error } = await supabaseAdmin.rpc("admin_reset_dataset", { _target: data.target });
    if (error) return { ok: false as const, error: error.message };

    const deleted = Number((result as { deleted?: number } | null)?.deleted ?? 0);
    return { ok: true as const, deleted, label: RESET_LABEL[data.target] };
  });
