import { createHmac, timingSafeEqual } from "node:crypto";

export const SITE_URL =
  process.env.PUBLIC_SITE_URL ?? "https://rohitravels.lovable.app";

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error("SESSION_SECRET not set");
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
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) return { sent: false, error: "LOVABLE_API_KEY missing" };
  try {
    const res = await fetch("https://api.lovable.dev/emails/send", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ to, subject, html }),
    });
    if (!res.ok) return { sent: false, error: await res.text().catch(() => `HTTP ${res.status}`) };
    return { sent: true as const };
  } catch (e) {
    return { sent: false, error: e instanceof Error ? e.message : String(e) };
  }
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

export function newAgentAdminEmail(a: {
  agency_name: string; contact_person: string; email: string; city: string;
  country_code: string; cell_number: string; office_address: string;
}, approveLink: string, rejectLink: string, panelLink: string) {
  return `<div style="font-family:Arial,sans-serif;padding:24px;max-width:640px;margin:auto;color:#0b2545">
    <h2 style="color:#0b2545;margin:0 0 8px">New Agency Registration</h2>
    <p style="color:#666;margin:0 0 16px">Pending your approval</p>
    <table style="width:100%;border-collapse:collapse;font-size:14px">
      ${row("Agency", a.agency_name)}
      ${row("Contact", a.contact_person)}
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
