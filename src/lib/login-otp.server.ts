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
import { brandedEmailHtml, escapeEmailHtml, otpEmailBlock } from "./email-templates/brand-html";

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
  agent: "Rohi Travels Portal",
};

/** Staff-facing portals get admin-level mail treatment: no marketing-style
 * unsubscribe line on a security code. */
const STAFF_PORTALS: readonly string[] = ["Admin Panel", "Staff Access"];

/** Which flow the code belongs to — keeps sign-in and booking emails distinct. */
export type OtpKind = "signin" | "booking";

function otpEmailHtml(opts: { portal: string; code: string; who: string; kind: OtpKind }) {
  const { portal, code, who, kind } = opts;
  const isBooking = kind === "booking";
  const isStaffPortal = STAFF_PORTALS.includes(portal);
  const heading = isBooking ? "Your Booking OTP" : "Your one-time passcode";
  const intro = isBooking
    ? `A booking was requested for <strong>${escapeEmailHtml(who)}</strong>. Enter this code to confirm your booking.`
    : `A sign-in was requested for <strong>${escapeEmailHtml(who)}</strong>. Enter this code to finish signing in.`;
  const warn = isBooking
    ? `<b>Didn't request this?</b> Do not share this code — no booking will be created without it.`
    : `<b>Didn't request this?</b> Someone may have your password — change it right away.`;
  return brandedEmailHtml({
    category: `SECURITY & AUTHENTICATION · ${portal}`,
    title: heading,
    intro,
    body: `${otpEmailBlock(code, "This code expires in 10 minutes and can be used once.")}<p style="margin:0;color:#78716C;font-size:12px;line-height:19px">${warn}</p>`,
    ...(isBooking && !isStaffPortal
      ? {
          footerNote: "You received this email because of an action on Rohi International Travels.",
          unsubscribeUrl: "mailto:rohitravelsryk@gmail.com?subject=Unsubscribe%20from%20booking%20emails",
        }
      : {}),
  });
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
  /** Sign-in code (default) or booking confirmation code. */
  kind?: OtpKind;
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
  const kind: OtpKind = opts.kind ?? "signin";
  const who = opts.who ?? opts.subject ?? opts.email;
  const res = await sendAppMail({
    to: opts.email,
    subject:
      kind === "booking"
        ? `${portal} Booking OTP : ${code}`
        : `${portal} Sign-in code: ${code}`,
    html: otpEmailHtml({ portal, code, who, kind }),
    label: kind === "booking" ? "booking-otp" : "login-otp",
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
