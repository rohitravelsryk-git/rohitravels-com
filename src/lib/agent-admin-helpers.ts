import { createHmac, timingSafeEqual } from "node:crypto";

export const SITE_URL =
  process.env.PUBLIC_SITE_URL ?? "https://rohitravels.lovable.app";

function secret() {
  const s = typeof process !== "undefined" ? process.env.SESSION_SECRET : undefined;
  if (!s) return "fallback-secret-for-prerender";
  return s;
}

export function signApprovalToken(userId: string, status: "approved" | "rejected") {
  const payload = `${userId}:${status}`;
  const sig = createHmac("sha256", secret()).update(payload).digest("hex");
  return `${Buffer.from(payload).toString("base64url")}.${sig}`;
}

export function verifyApprovalToken(token: string):
  | { ok: true; userId: string; status: "approved" | "rejected" }
  | { ok: false } {
  const [b64, sig] = token.split(".");
  if (!b64 || !sig) return { ok: false };
  let payload: string;
  try { payload = Buffer.from(b64, "base64url").toString("utf8"); } catch { return { ok: false }; }
  const expected = createHmac("sha256", secret()).update(payload).digest("hex");
  const a = Buffer.from(sig, "hex");
  const b = Buffer.from(expected, "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) return { ok: false };
  const [userId, status] = payload.split(":");
  if (!userId || (status !== "approved" && status !== "rejected")) return { ok: false };
  return { ok: true, userId, status };
}

export async function sendMail(to: string, subject: string, html: string) {
  const { sendAppMail } = await import("./mailer");
  return sendAppMail({ to, subject, html, label: "agent-portal" });
}

export function agentApprovedEmail(agencyName: string, contactPerson: string, loginUrl: string) {
  return `<div style="font-family:Arial,sans-serif;padding:24px;max-width:560px;margin:auto;color:#0b2545">
    <h2 style="color:#0b2545;margin:0 0 12px">Welcome aboard, ${escapeHtml(contactPerson)}!</h2>
    <p>Your agency <b>${escapeHtml(agencyName)}</b> has been <span style="color:#059669;font-weight:700">approved</span> on Rohi International Travels B2B portal.</p>
    <p>You can now sign in and access live group fares, bookings and more.</p>
    <p style="margin:24px 0"><a href="${loginUrl}" style="background:#f59e0b;color:#0b2545;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700">Sign in to Portal →</a></p>
    <p style="color:#666;font-size:13px">If the button doesn't work, open: ${loginUrl}</p>
  </div>`;
}

/** Newsletter-style welcome/receipt sent to the registrant. */
export function agentWelcomeEmail(a: {
  agency_name: string; contact_person: string; email: string; city: string;
  country_code: string; cell_number: string; office_address: string; user_code: string;
}, siteUrl: string) {
  return `<div style="margin:0;padding:0;background:#f8f4ee">
  <div style="font-family:Georgia,'Times New Roman',serif;max-width:640px;margin:auto;background:#f8f4ee">
    <div style="background:#0b2545;padding:28px 24px;text-align:center">
      <p style="margin:0;color:#e8b647;font-size:11px;letter-spacing:4px;text-transform:uppercase">Rohi International Travels</p>
      <h1 style="margin:8px 0 0;color:#fff;font-size:26px">Registration Received</h1>
      <div style="width:56px;height:2px;background:#e8b647;margin:12px auto 0"></div>
    </div>
    <div style="padding:28px 24px;color:#1f2937;font-family:Arial,sans-serif">
      <p style="font-size:15px;margin:0 0 12px">Dear <b>${escapeHtml(a.contact_person)}</b>,</p>
      <p style="font-size:14px;line-height:1.7;margin:0 0 18px">
        Thank you for registering <b>${escapeHtml(a.agency_name)}</b> with our B2B travel network.
        Your application has been received and is now <b style="color:#b45309">pending admin approval</b>.
        You will receive a confirmation email the moment your agency is approved.
      </p>
      <div style="background:#fff;border:1px solid #e7ded0;border-radius:10px;padding:16px;margin:0 0 20px">
        <p style="margin:0 0 10px;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#8a7355">Your agency code</p>
        <p style="margin:0;font-size:26px;font-weight:700;letter-spacing:3px;color:#0b2545">${escapeHtml(a.user_code)}</p>
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:14px;background:#fff;border:1px solid #e7ded0;border-radius:10px">
        ${row("Agency", a.agency_name)}
        ${row("Contact Person", a.contact_person)}
        ${row("Email", a.email)}
        ${row("Phone", `${a.country_code} ${a.cell_number}`)}
        ${row("City", a.city)}
        ${row("Address", a.office_address)}
      </table>
      <p style="margin:24px 0"><a href="${siteUrl}/agent/login" style="background:#e8b647;color:#0b2545;padding:13px 26px;border-radius:999px;text-decoration:none;font-weight:700;font-size:13px;letter-spacing:1px;text-transform:uppercase">Go to sign in →</a></p>
      <p style="color:#8a7355;font-size:12px;line-height:1.6;margin:20px 0 0;border-top:1px solid #e7ded0;padding-top:14px">
        Group fares · Umrah packages · Visa services — since 1991.<br/>
        You received this email because an agency registration was submitted with this address.
      </p>
    </div>
  </div>
</div>`;
}

export function newAgentAdminEmail(a: {
  agency_name: string; contact_person: string; email: string; city: string;
  country_code: string; cell_number: string; office_address: string; user_code?: string;
}, approveLink: string, rejectLink: string, panelLink: string) {
  return `<div style="font-family:Arial,sans-serif;padding:24px;max-width:640px;margin:auto;color:#0b2545;background:#f8f4ee">
    <h2 style="color:#0b2545;margin:0 0 8px">New Agency Registration</h2>
    <p style="color:#666;margin:0 0 16px">Pending your approval</p>
    <table style="width:100%;border-collapse:collapse;font-size:14px;background:#fff">
      ${a.user_code ? row("Agency Code", a.user_code) : ""}
      ${row("Agency", a.agency_name)}
      ${row("Contact Person", a.contact_person)}
      ${row("Email", a.email)}
      ${row("Phone", `${a.country_code} ${a.cell_number}`)}
      ${row("City", a.city)}
      ${row("Address", a.office_address)}
    </table>
    <div style="margin:24px 0;display:flex;gap:12px">
      <a href="${approveLink}" style="background:#059669;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700">✓ Approve</a>
      <a href="${rejectLink}" style="background:#dc2626;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700">✕ Reject</a>
    </div>
    <p style="color:#666;font-size:13px">Or manage all agents in the admin panel: <a href="${panelLink}">${panelLink}</a></p>
  </div>`;
}


function row(k: string, v: string) {
  return `<tr><td style="padding:6px 8px;color:#666;border-bottom:1px solid #eee;width:120px">${k}</td><td style="padding:6px 8px;border-bottom:1px solid #eee;font-weight:600">${escapeHtml(v)}</td></tr>`;
}
function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}
