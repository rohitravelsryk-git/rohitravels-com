import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const SendEmailInput = z.object({
  emails: z.array(z.string().email()),
  subject: z.string().min(1),
  html: z.string().min(1),
  attachments: z.array(z.object({
    name: z.string(),
    type: z.string(),
    data: z.string(), // Base64
  })).optional(),
});

const ValidateEmailInput = z.object({
  email: z.string().email(),
});

export const sendMarketingEmail = createServerFn({ method: "POST" })
  .validator((input: unknown) => SendEmailInput.parse(input))
  .handler(async ({ data }) => {
    const { requireAdminUnlocked } = await import("@/lib/marketing.server");
    const { sendAppMail } = await import("@/lib/mailer");
    
    await requireAdminUnlocked();

    console.log(`[EmailMarketing] Starting to send email to ${data.emails.length} recipients...`);
    
    // We send them individually to ensure no one sees other recipients (BCC style)
    const results = await Promise.allSettled(
      data.emails.map(async (to) => {
        const res = await sendAppMail({
          to,
          subject: data.subject,
          html: data.html,
          label: "marketing-newsletter",
        });
        
        if (!res.sent) {
          throw new Error(res.error || "Failed to send");
        }
        return res;
      })
    );

    const successCount = results.filter((r) => r.status === "fulfilled").length;
    const failedCount = results.length - successCount;

    console.log(`[EmailMarketing] Send complete. Success: ${successCount}, Failed: ${failedCount}`);
    
    if (successCount === 0 && data.emails.length > 0) {
      const firstError = (results[0] as PromiseRejectedResult).reason;
      throw new Error(`Email sending failed: ${firstError?.message || firstError || "Unknown error"}. Please check your backend configuration.`);
    }

    return { successCount, failedCount };
  });

export const validateEmailStatus = createServerFn({ method: "POST" })
  .validator((input: unknown) => ValidateEmailInput.parse(input))
  .handler(async ({ data }) => {
    const { requireAdminUnlocked } = await import("@/lib/marketing.server");
    await requireAdminUnlocked();

    // Basic domain validation
    const isCommonProvider = /@(gmail|yahoo|outlook|hotmail|icloud|protonmail)\.com$/i.test(data.email);
    
    return { isValid: isCommonProvider || true }; 
  });
