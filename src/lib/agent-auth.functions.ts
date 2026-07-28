import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  SITE_URL,
  signApprovalToken,
  sendMail,
  newAgentAdminEmail,
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

    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { agency_name: data.agency_name },
    });
    if (createErr || !created.user) {
      throw new Error(createErr?.message ?? "Failed to create account");
    }

    const userId = created.user.id;
    const { error: insErr } = await supabaseAdmin.from("agents").insert({
      user_id: userId,
      agency_name: data.agency_name,
      email: data.email,
      contact_person: data.contact_person,
      city: data.city,
      country_code: data.country_code,
      cell_number: data.cell_number,
      office_address: data.office_address,
    });
    if (insErr) {
      await supabaseAdmin.auth.admin.deleteUser(userId);
      throw new Error(insErr.message);
    }

    // Notify admin by email with one-click approve/reject links.
    try {
      const { data: creds } = await supabaseAdmin
        .from("admin_credentials")
        .select("recovery_email")
        .eq("id", true)
        .maybeSingle();
      const adminEmail = creds?.recovery_email ?? "rohitravels@gmail.com";
      const base = SITE_URL.replace(/\/$/, "");
      const approveLink = `${base}/api/public/agent-approve?token=${signApprovalToken(userId, "approved")}`;
      const rejectLink = `${base}/api/public/agent-approve?token=${signApprovalToken(userId, "rejected")}`;
      const panelLink = `${base}/admin/agents`;
      await sendMail(
        adminEmail,
        `New agency registration: ${data.agency_name}`,
        newAgentAdminEmail(
          {
            agency_name: data.agency_name,
            contact_person: data.contact_person,
            email: data.email,
            city: data.city,
            country_code: data.country_code,
            cell_number: data.cell_number,
            office_address: data.office_address,
          },
          approveLink, rejectLink, panelLink,
        ),
      );
    } catch { /* email failure must not block signup */ }

    return { ok: true };
  });
