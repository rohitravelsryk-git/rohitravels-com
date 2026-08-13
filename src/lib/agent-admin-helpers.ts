import { createHmac, timingSafeEqual } from "node:crypto";

export const SITE_URL =
  (typeof process !== "undefined" ? process.env.PUBLIC_SITE_URL : undefined) ?? "https://rohitravels.lovable.app";

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
  return `<!doctype html>
<html>
<body style="margin:0;padding:0;background-color:#f9f9f9;font-family:'Helvetica Neue', Helvetica, Arial, sans-serif;">
  <div style="max-width:600px;margin:40px auto;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);">
    <div style="background-color:#0f172a;padding:24px;text-align:center;">
      <div style="color:#d4af37;text-transform:uppercase;font-size:12px;letter-spacing:2px;font-weight:bold;margin-bottom:8px;">ROHI INTERNATIONAL TRAVELS</div>
      <div style="color:#ffffff;font-size:24px;font-weight:600;">Welcome aboard, ${escapeHtml(contactPerson)}!</div>
    </div>
    
    <div style="padding:40px 48px;color:#1e293b;">
      <p style="margin:0 0 24px;font-size:16px;line-height:1.6;color:#475569;">
        Your agency <strong style="color:#0f172a;">${escapeHtml(agencyName)}</strong> has been <span style="color:#059669;font-weight:700;">approved</span> on the Rohi International Travels B2B portal.
      </p>
      
      <p style="margin:0 0 32px;font-size:16px;line-height:1.6;color:#475569;">
        You can now sign in and access live group fares, bookings and more.
      </p>
      
      <div style="text-align:center;margin-bottom:32px;">
        <a href="${loginUrl}" style="display:inline-block;background-color:#d4af37;color:#0f172a;padding:16px 32px;border-radius:8px;text-decoration:none;font-weight:700;font-size:16px;">Sign in to Portal →</a>
      </div>
      
      <p style="margin:0;font-size:13px;color:#94a3b8;text-align:center;">
        If the button doesn't work, copy this link: ${loginUrl}
      </p>
    </div>
    
    <div style="padding:24px 48px;border-top:1px solid #f1f5f9;text-align:center;">
      <p style="margin:0;font-size:12px;color:#94a3b8;">
        &copy; ${new Date().getFullYear()} Rohi International Travels. All rights reserved.
      </p>
    </div>
  </div>
</body>
</html>`;
}

/** Newsletter-style welcome/receipt sent to the registrant. */
export function agentWelcomeEmail(a: {
  agency_name: string; contact_person: string; email: string; city: string;
  country_code: string; cell_number: string; office_address: string; user_code: string;
}, siteUrl: string) {
  return `<!doctype html>
<html>
<body style="margin:0;padding:0;background-color:#f9f9f9;font-family:'Helvetica Neue', Helvetica, Arial, sans-serif;">
  <div style="max-width:600px;margin:40px auto;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);">
    <div style="background-color:#0f172a;padding:24px;text-align:center;">
      <div style="color:#d4af37;text-transform:uppercase;font-size:12px;letter-spacing:2px;font-weight:bold;margin-bottom:8px;">ROHI INTERNATIONAL TRAVELS</div>
      <div style="color:#ffffff;font-size:24px;font-weight:600;">Registration Received</div>
    </div>
    
    <div style="padding:40px 48px;color:#1e293b;">
      <h2 style="margin:0 0 16px;font-size:20px;font-weight:700;color:#0f172a;">Welcome ${escapeHtml(a.agency_name)}</h2>
      
      <p style="margin:0 0 24px;font-size:16px;line-height:1.6;color:#475569;">
        Dear <strong>${escapeHtml(a.contact_person)}</strong>, your application has been received and is now <span style="color:#b45309;font-weight:700;">pending admin approval</span>.
      </p>
      
      <div style="background-color:#f1f5f9;border:1px solid #e2e8f0;border-radius:8px;padding:20px;margin-bottom:32px;">
        <div style="text-transform:uppercase;font-size:11px;letter-spacing:2px;color:#64748b;margin-bottom:8px;font-weight:700;">Your Agency Code</div>
        <div style="font-size:28px;font-weight:700;letter-spacing:3px;color:#0f172a;">${escapeHtml(a.user_code)}</div>
      </div>
      
      <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:32px;">
        ${row("Agency", a.agency_name)}
        ${row("Contact", a.contact_person)}
        ${row("Email", a.email)}
        ${row("Phone", `${a.country_code} ${a.cell_number}`)}
        ${row("City", a.city)}
        ${row("Address", a.office_address)}
      </table>
      
      <div style="text-align:center;margin-bottom:32px;">
        <a href="${siteUrl}/agent/login" style="display:inline-block;background-color:#d4af37;color:#0f172a;padding:16px 32px;border-radius:8px;text-decoration:none;font-weight:700;font-size:16px;text-transform:uppercase;letter-spacing:1px;">Go to Portal →</a>
      </div>
      
      <p style="margin:0;font-size:13px;color:#94a3b8;line-height:1.6;">
        Group fares · Umrah packages · Visa services — since 1991.
      </p>
    </div>
  </div>
</body>
</html>`;
}

export function newAgentAdminEmail(a: {
  agency_name: string; contact_person: string; email: string; city: string;
  country_code: string; cell_number: string; office_address: string; user_code?: string;
}, approveLink: string, rejectLink: string, panelLink: string) {
  return `<!doctype html>
<html>
<body style="margin:0;padding:0;background-color:#f9f9f9;font-family:'Helvetica Neue', Helvetica, Arial, sans-serif;">
  <div style="max-width:640px;margin:40px auto;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);">
    <div style="background-color:#0f172a;padding:24px;text-align:center;">
      <div style="color:#d4af37;text-transform:uppercase;font-size:12px;letter-spacing:2px;font-weight:bold;margin-bottom:8px;">ADMIN NOTIFICATION</div>
      <div style="color:#ffffff;font-size:24px;font-weight:600;">New Agency Registration</div>
    </div>
    
    <div style="padding:40px 48px;color:#1e293b;">
      <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:32px;">
        ${a.user_code ? row("Code", a.user_code) : ""}
        ${row("Agency", a.agency_name)}
        ${row("Contact", a.contact_person)}
        ${row("Email", a.email)}
        ${row("Phone", `${a.country_code} ${a.cell_number}`)}
        ${row("City", a.city)}
        ${row("Address", a.office_address)}
      </table>
      
      <div style="display:flex;gap:12px;justify-content:center;margin-bottom:32px;">
        <a href="${approveLink}" style="display:inline-block;background-color:#059669;color:#ffffff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700;">✓ Approve</a>
        <a href="${rejectLink}" style="display:inline-block;background-color:#dc2626;color:#ffffff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700;">✕ Reject</a>
      </div>
      
      <p style="margin:0;font-size:13px;color:#94a3b8;text-align:center;">
        Manage all agents: <a href="${panelLink}" style="color:#d4af37;text-decoration:none;">${panelLink}</a>
      </p>
    </div>
  </div>
</body>
</html>`;
}


function row(k: string, v: string) {
  return `<tr><td style="padding:6px 8px;color:#666;border-bottom:1px solid #eee;width:120px">${k}</td><td style="padding:6px 8px;border-bottom:1px solid #eee;font-weight:600">${escapeHtml(v)}</td></tr>`;
}
function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}
