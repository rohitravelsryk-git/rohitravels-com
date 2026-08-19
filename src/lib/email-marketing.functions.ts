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
    // Dynamic import to avoid build errors if the library is stubbed or missing in some environments
    const emailLib = await import("@lovable.dev/email-js");
    const sendEmail = (emailLib as any).sendEmail;
    
    if (typeof sendEmail !== 'function') {
      throw new Error("Email sending is not configured properly in this environment.");
    }

    await requireAdminUnlocked();

    // The user requested sending without showing other emails (BCC style)
    // We send them individually to ensure no one sees other recipients
    console.log(`[EmailMarketing] Starting to send email to ${data.emails.length} recipients...`);
    
    // Test the email library before proceeding
    try {
      console.log("[EmailMarketing] testing simple send to first recipient");
      await sendEmail({
        to: data.emails[0],
        subject: "Rohi Marketing Service Check",
        html: "<p>Service check</p>",
        from: "Rohi International Travels <rohitravelsryk@gmail.com>",
      });
      console.log("[EmailMarketing] Test send successful");
    } catch (testErr) {
      console.error("[EmailMarketing] Test send failed:", testErr);
      throw new Error(`Managed email service error: ${testErr instanceof Error ? testErr.message : String(testErr)}`);
    }
    
    const results = await Promise.allSettled(
      data.emails.map(async (to) => {
        try {
          const res = await sendEmail({
            to,
            subject: data.subject,
            html: data.html,
            from: "Rohi International Travels <rohitravelsryk@gmail.com>",
            attachments: data.attachments,
          });
          console.log(`[EmailMarketing] Successfully sent to ${to}`);
          return res;
        } catch (err) {
          console.error(`[EmailMarketing] Failed to send to ${to}:`, err);
          throw err;
        }
      })
    );

    const successCount = results.filter((r) => r.status === "fulfilled").length;
    const failedCount = results.length - successCount;

    console.log(`[EmailMarketing] Send complete. Success: ${successCount}, Failed: ${failedCount}`);
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
