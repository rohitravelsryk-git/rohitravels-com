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
  // Ensure we have a clean 6-digit code with spaces for the design
  const spacedCode = code.split('').join(' ');
  
  return `<!doctype html>
<html>
<body style="margin:0;padding:0;background-color:#f9f9f9;font-family:'Helvetica Neue', Helvetica, Arial, sans-serif;">
  <div style="max-width:600px;margin:40px auto;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);">
    <!-- Header -->
    <div style="background-color:#0f172a;padding:24px;text-align:center;">
      <div style="color:#d4af37;text-transform:uppercase;font-size:12px;letter-spacing:2px;font-weight:bold;margin-bottom:8px;">ROHI INTERNATIONAL TRAVELS</div>
      <div style="color:#ffffff;font-size:24px;font-weight:600;letter-spacing:0.5px;">${portal} — Sign-in code</div>
    </div>
    
    <!-- Body -->
    <div style="padding:40px 48px;color:#1e293b;">
      <h1 style="margin:0 0 24px;font-size:24px;font-weight:700;color:#0f172a;">Welcome ${who}</h1>
      
      <p style="margin:0 0 32px;font-size:16px;line-height:1.6;color:#475569;">
        A sign-in was requested for this account. Enter this code to finish signing in:
      </p>
      
      <div style="text-align:center;margin-bottom:32px;">
        <div style="display:inline-block;font-family:monospace;font-size:42px;font-weight:700;letter-spacing:8px;color:#0f172a;padding:20px 40px;background-color:#f1f5f9;border-radius:8px;">
          ${spacedCode}
        </div>
      </div>
      
      <p style="margin:0 0 12px;font-size:14px;color:#64748b;">
        This code expires in 10 minutes and can be used once.
      </p>
      
      <p style="margin:0;font-size:14px;color:#b91c1c;font-weight:500;">
        Didn't request this? Someone may have your password — change it right away.
      </p>
    </div>
    
    <!-- Footer -->
    <div style="padding:24px 48px;border-top:1px solid #f1f5f9;text-align:center;">
      <p style="margin:0 0 8px;font-size:12px;color:#94a3b8;">
        You received this email because of an action on Rohi International Travels.
      </p>
      <a href="https://rohitravels.com" style="font-size:12px;color:#d4af37;text-decoration:none;font-weight:600;">Unsubscribe from these emails</a>
    </div>
  </div>
</body>
</html>`;
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
  console.log(`[createLoginOtp] Attempting to send code ${code} to ${opts.email} for ${portal}`);
  const res = await sendAppMail({
    to: opts.email,
    subject: `${portal} sign-in code: ${code}`,
    html: otpEmailHtml(portal, code, opts.who ?? opts.subject ?? opts.email),
    label: "login-otp",
  });

  if (!res.sent) {
    console.error(`[createLoginOtp] FAILED to send code to ${opts.email}: ${res.error}`);
  } else {
    console.log(`[createLoginOtp] Successfully sent code to ${opts.email}`);
  }

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
