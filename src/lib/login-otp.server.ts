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
  return `<!doctype html><html><body style="margin:0;padding:0;background-color:#ffffff;font-family:Arial,sans-serif">
  <div style="max-width:500px;margin:20px auto;border:1px solid #eeeeee;border-radius:8px;overflow:hidden;box-shadow:0 2px 10px rgba(0,0,0,0.05)">
    <div style="padding:0">
      <table border="0" cellpadding="0" cellspacing="0" width="100%">
        <tr>
          <td width="50%" style="background-color:#7a147a;height:80px;text-align:center;color:#ffffff;font-weight:bold;font-size:24px">
            <span style="display:inline-block;vertical-align:middle;margin-right:8px">=</span>flyadeal
            <div style="font-size:10px;font-weight:normal;margin-top:2px;letter-spacing:1px;font-family:serif">طيران أديل</div>
          </td>
          <td width="16.6%" style="background-color:#ccff00;text-align:center;color:#7a147a;font-weight:bold;font-size:18px">fly</td>
          <td width="16.6%" style="background-color:#991f85;text-align:center;color:#ffffff;font-weight:bold;font-size:18px">fly+</td>
          <td width="16.6%" style="background-color:#4c2975;text-align:center;color:#ffffff;font-weight:bold;font-size:18px">flyMax</td>
        </tr>
      </table>
    </div>
    <div style="padding:32px 24px;color:#333333">
      <h2 style="margin:0 0 16px;font-size:18px;font-weight:bold">Thanks for joining ${portal}!</h2>
      <p style="margin:0 0 24px;font-size:15px;line-height:1.5;color:#555555">To complete your registration we need you to verify your account by entering this security code.</p>
      <div style="background-color:#999999;padding:16px;text-align:center;border-radius:4px;margin-bottom:24px">
        <span style="color:#ffffff;font-size:28px;font-weight:bold;letter-spacing:4px;font-family:monospace">${code}</span>
      </div>
      <p style="margin:0 0 32px;font-size:14px;color:#666666">This code will be valid for 10 minutes only, so hurry or just ask for another one later.</p>
      <p style="margin:0;font-size:15px;color:#333333">Thanks,<br>The ${portal} team</p>
    </div>
    <div style="padding:0 24px 20px">
      <div style="border-top:1px solid #eeeeee;padding-top:16px;text-align:center">
        <p style="margin:0;font-size:12px;color:#999999">flyadeal.com</p>
      </div>
    </div>
    <div style="background-color:#7a147a;padding:12px;text-align:center">
      <div style="display:inline-block;opacity:0.6">
        <table border="0" cellpadding="0" cellspacing="0">
          <tr>
            <td style="padding:0 8px"><div style="width:20px;height:20px;background-color:#ffffff;opacity:0.2;border-radius:2px"></div></td>
            <td style="padding:0 8px"><div style="width:20px;height:20px;background-color:#ffffff;opacity:0.2;border-radius:2px"></div></td>
            <td style="padding:0 8px"><div style="width:20px;height:20px;background-color:#ffffff;opacity:0.2;border-radius:2px"></div></td>
          </tr>
        </table>
      </div>
    </div>
  </div>
</body></html>`;
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
