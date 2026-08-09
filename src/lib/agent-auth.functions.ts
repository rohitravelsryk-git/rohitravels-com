import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  SITE_URL,
  signApprovalToken,
  sendMail,
  newAgentAdminEmail,
  agentWelcomeEmail,
} from "./agent-admin-helpers";

const registerSchema = z.object({
  agency_name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
  contact_person: z.string().min(1),
  city: z.string().min(1),
  country_code: z.string().min(1),
  cell_number: z.string().min(1),
  office_address: z.string().min(1),
});

export const registerAgent = createServerFn({ method: "POST" })
  .inputValidator((data) => registerSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const agencyName = data.agency_name.trim();
    const email = data.email.trim().toLowerCase();

    // Uniqueness: no two agencies with the same name or the same email.
    const { data: dupes } = await supabaseAdmin
      .from("agents")
      .select("agency_name, email");
    for (const d of (dupes ?? []) as { agency_name: string; email: string }[]) {
      if (d.agency_name?.trim().toLowerCase() === agencyName.toLowerCase()) {
        throw new Error("An agency is already registered with this agency name.");
      }
      if (d.email?.trim().toLowerCase() === email) {
        throw new Error("An agency is already registered with this email address.");
      }
    }

    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: data.password,
      email_confirm: true,
      user_metadata: { agency_name: agencyName },
    });
    if (createErr || !created.user) {
      throw new Error(createErr?.message ?? "Failed to create account");
    }

    const userId = created.user.id;

    // Unique sequential agency code, e.g. RIT-1001
    let userCode = "";
    try {
      const { count } = await supabaseAdmin
        .from("agents")
        .select("user_id", { count: "exact", head: true });
      userCode = `RIT-${String(1001 + (count ?? 0)).padStart(4, "0")}`;
    } catch { userCode = `RIT-${Date.now().toString().slice(-4)}`; }

    const { error: insErr } = await supabaseAdmin.from("agents").insert({
      user_id: userId,
      agency_name: agencyName,
      email,
      contact_person: data.contact_person,
      city: data.city,
      country_code: data.country_code,
      cell_number: data.cell_number,
      office_address: data.office_address,
      user_code: userCode,
    } as never);
    if (insErr) {
      await supabaseAdmin.auth.admin.deleteUser(userId);
      if (/duplicate|unique/i.test(insErr.message)) {
        throw new Error("An agency with this name or email already exists.");
      }
      throw new Error(insErr.message);
    }

    const details = {
      agency_name: agencyName,
      contact_person: data.contact_person,
      email,
      city: data.city,
      country_code: data.country_code,
      cell_number: data.cell_number,
      office_address: data.office_address,
      user_code: userCode,
    };
    const base = SITE_URL.replace(/\/$/, "");

    // Notify admin with one-click approve/reject links + newsletter receipt to registrant.
    try {
      const { data: creds } = await supabaseAdmin
        .from("admin_credentials")
        .select("recovery_email")
        .eq("id", true)
        .maybeSingle();
      const adminEmail = creds?.recovery_email ?? "raisabdulrazzaq@gmail.com";
      const approveLink = `${base}/api/public/agent-approve?token=${signApprovalToken(userId, "approved")}`;
      const rejectLink = `${base}/api/public/agent-approve?token=${signApprovalToken(userId, "rejected")}`;
      await sendMail(
        adminEmail,
        `New agency registration: ${agencyName} (${userCode})`,
        newAgentAdminEmail(details, approveLink, rejectLink, `${base}/admin/agents`),
      );
    } catch { /* email failure must not block signup */ }

    try {
      await sendMail(
        email,
        `Welcome to Rohi Travels B2B — ${agencyName} (${userCode})`,
        agentWelcomeEmail(details, base),
      );
    } catch { /* ignore */ }

    return { ok: true, user_code: userCode, agency_name: agencyName, email };
  });

