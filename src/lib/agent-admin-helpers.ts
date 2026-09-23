// Moved node:crypto imports to server-only functions to fix browser runtime error
import { brandedEmailHtml, emailRows, escapeEmailHtml } from "./email-templates/brand-html";

export const SITE_URL =
  (typeof process !== "undefined" ? process.env.PUBLIC_SITE_URL : undefined) ?? "https://rohitravels.com";

function secret() {
  const s = typeof process !== "undefined" ? process.env.SESSION_SECRET : undefined;
  if (!s) throw new Error("Server misconfigured: SESSION_SECRET is not set");
  return s;
}

export async function signApprovalToken(userId: string, status: "approved" | "rejected") {
  const { createHmac } = await import("node:crypto");
  const payload = `${userId}:${status}`;
  const sig = createHmac("sha256", secret()).update(payload).digest("hex");
  return `${Buffer.from(payload).toString("base64url")}.${sig}`;
}

export async function verifyApprovalToken(token: string): Promise<
  | { ok: true; userId: string; status: "approved" | "rejected" }
  | { ok: false }
> {
  const { createHmac, timingSafeEqual } = await import("node:crypto");
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
  return brandedEmailHtml({
    category: "B2B AGENT PORTAL",
    title: `Welcome aboard, ${contactPerson}!`,
    intro: `Your agency <strong>${escapeEmailHtml(agencyName)}</strong> has been approved. You can now access live group fares, bookings, and agent services.`,
    action: { label: "Sign in to portal", url: loginUrl },
    body: `<p style="color:#78716C;font-size:12px;line-height:19px">Fallback URL: ${escapeEmailHtml(loginUrl)}</p>`,
  });
}

/** Newsletter-style welcome/receipt sent to the registrant. */
export function agentWelcomeEmail(a: {
  agency_name: string; contact_person: string; email: string; city: string;
  country_code: string; cell_number: string; office_address: string; user_code: string;
}, siteUrl: string) {
  return brandedEmailHtml({
    category: "B2B AGENT PORTAL",
    title: "Registration received",
    intro: `Dear <strong>${escapeEmailHtml(a.contact_person)}</strong>, we received the registration for <strong>${escapeEmailHtml(a.agency_name)}</strong>. It is now under KYC review.`,
    body: emailRows([["Agency ID", a.user_code], ["Agency", a.agency_name], ["Contact Person", a.contact_person], ["Email", a.email], ["Phone", `${a.country_code} ${a.cell_number}`], ["City", a.city], ["Address", a.office_address]]),
    action: { label: "Go to sign in", url: `${siteUrl}/agent/login` },
  });
}

export function newAgentAdminEmail(a: {
  agency_name: string; contact_person: string; email: string; city: string;
  country_code: string; cell_number: string; office_address: string; user_code?: string;
}, approveLink: string, rejectLink: string, panelLink: string) {
  return brandedEmailHtml({
    category: "ADMIN & STAFF OPERATIONS",
    title: "New agent registration pending KYC",
    intro: "A new B2B agency application requires review.",
    body: emailRows([...(a.user_code ? [["Agency Code", a.user_code] as [string, string]] : []), ["Agency", a.agency_name], ["Contact Person", a.contact_person], ["Email", a.email], ["Phone", `${a.country_code} ${a.cell_number}`], ["City", a.city], ["Address", a.office_address]]),
    action: { label: "Approve agent", url: approveLink },
    secondaryAction: { label: "Reject agent", url: rejectLink },
  }) + `<!-- Admin panel: ${escapeEmailHtml(panelLink)} -->`;
}


function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}
