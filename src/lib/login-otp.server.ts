/**
 * Email one-time-passcode (2FA) support for every portal login.
 *
 * Flow: password is verified first, then a 6-digit code is stored hashed with a
 * short expiry and emailed to the account's registered address. The session is
 * only established after the code is verified, so a stolen password alone is
 * not enough to reach the admin panel, staff access or the B2B agent portal.
 *
 * Server-only: never import this from a component or from the module scope of a
 * `*.functions.ts` file — load it inside the handler with `await import(...)`.
 */
import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import { sendAppMail } from "./mailer";

export type OtpPurpose = "admin" | "staff" | "agent";

const CODE_TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;

function hashCode(code: string) {
  return createHash("sha256").update(code.trim(), "utf8").digest("hex");
}

function safeEqualHex(a: string, b: string) {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
}

export function maskEmail(email: string) {
  const [name = "", domain = ""] = email.split("@");
  const head = name.length <= 2 ? name : `${name[0]}****${name[name.length - 1]}`;
  return `${head}@${domain}`;
}

const PORTAL_LABEL: Record<OtpPurpose, string> = {
  admin: "Admin Panel",
  staff: "Staff Access",
  agent: "B2B Agent Portal",
};

function otpEmailHtml(portal: string, code: string, who: string) {
  return `<!doctype html><html><body style="margin:0;padding:0;background:#f8f4ee">
  <div style="padding:40px 20px">
    <div style="font-family:Georgia,'Times New Roman',serif;max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #e6e1d6;border-top:5px solid #e8b647;border-radius:12px;overflow:hidden">
      <div style="background:#0b2545;padding:24px;text-align:center">
        <p style="margin:0;color:#e8b647;font-size:10px;letter-spacing:3px;text-transform:uppercase;font-weight:bold">Rohi International Travels</p>
        <h1 style="margin:8px 0 0;color:#ffffff;font-size:20px">${portal} — Sign-in Code</h1>
      </div>
      <div style="padding:28px 24px;color:#3f4657;font-family:Arial,sans-serif">
        <p style="margin:0 0 16px;font-size:15px;line-height:1.6">A sign-in was requested for <b>${who}</b>. Enter this code to finish signing in:</p>
        <div style="background:#f8f4ee;padding:20px;text-align:center;border-radius:8px;margin:20px 0">
          <p style="margin:0;font-family:'Courier New',monospace;font-size:38px;font-weight:bold;letter-spacing:8px;color:#0b2545">${code}</p>
        </div>
        <p style="margin:0 0 12px;font-size:12px;color:#8a8f9c">This code expires in 10 minutes and can be used once.</p>
        <p style="margin:24px 0 0;font-size:12px;color:#a4331f;border-top:1px solid #eeeae0;padding-top:16px"><b>Didn't request this?</b> Someone may have your password — change it right away.</p>
      </div>
    </div>
  </div></body></html>`;
}

/** Creates + emails a one-time code. Returns the challenge id and masked email. */
export async function createLoginOtp(opts: {
  purpose: OtpPurpose;
  /** Username / user id / agency email the code belongs to. */
  subject: string;
  /** Where the code is delivered. */
  email: string;
  /** Human label shown in the email body. */
  who?: string;
}): Promise<{ challenge: string; maskedEmail: string; sent: boolean; error?: string }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const expiresAt = new Date(Date.now() + CODE_TTL_MS).toISOString();

  // Invalidate any earlier unused codes for the same subject/purpose.
  await supabaseAdmin
    .from("login_otps")
    .update({ used_at: new Date().toISOString() })
    .eq("purpose", opts.purpose)
    .eq("subject", opts.subject)
    .is("used_at", null);

  const { data, error } = await supabaseAdmin
    .from("login_otps")
    .insert({
      purpose: opts.purpose,
      subject: opts.subject,
      email: opts.email,
      code_hash: hashCode(code),
      expires_at: expiresAt,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Could not start verification");

  const portal = PORTAL_LABEL[opts.purpose];
  const res = await sendAppMail({
    to: opts.email,
    subject: `${portal} sign-in code: ${code}`,
    html: otpEmailHtml(portal, code, opts.who ?? opts.subject ?? opts.email),
    label: "login-otp",
  });

  return { challenge: data.id as string, maskedEmail: maskEmail(opts.email), sent: res.sent, error: res.error };
}

/** Verifies a code against a challenge id. Single use, attempt-limited. */
export async function consumeLoginOtp(opts: { challenge: string; code: string; purpose: OtpPurpose }): Promise<
  { ok: true; subject: string; email: string } | { ok: false; error: string }
> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: row } = await supabaseAdmin
    .from("login_otps")
    .select("id, purpose, subject, email, code_hash, attempts, expires_at, used_at")
    .eq("id", opts.challenge)
    .maybeSingle();

  if (!row || row.purpose !== opts.purpose) return { ok: false, error: "Verification expired. Please sign in again." };
  if (row.used_at) return { ok: false, error: "This code was already used. Please sign in again." };
  if (new Date(row.expires_at).getTime() < Date.now()) return { ok: false, error: "Code expired. Please sign in again." };
  if ((row.attempts ?? 0) >= MAX_ATTEMPTS) {
    await supabaseAdmin.from("login_otps").update({ used_at: new Date().toISOString() }).eq("id", row.id);
    return { ok: false, error: "Too many incorrect codes. Please sign in again." };
  }

  if (!safeEqualHex(hashCode(opts.code), row.code_hash)) {
    await supabaseAdmin.from("login_otps").update({ attempts: (row.attempts ?? 0) + 1 }).eq("id", row.id);
    const left = MAX_ATTEMPTS - ((row.attempts ?? 0) + 1);
    return { ok: false, error: left > 0 ? `Incorrect code. ${left} attempt${left > 1 ? "s" : ""} left.` : "Too many incorrect codes. Please sign in again." };
  }

  await supabaseAdmin.from("login_otps").update({ used_at: new Date().toISOString() }).eq("id", row.id);
  return { ok: true, subject: row.subject as string, email: row.email as string };
}
