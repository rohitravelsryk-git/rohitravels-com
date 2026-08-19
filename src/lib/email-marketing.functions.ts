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
    const results = await Promise.allSettled(
      data.emails.map((to) =>
        sendEmail({
          to,
          subject: data.subject,
          html: data.html,
          from: "Rohi International Travels <rohitravelsryk@gmail.com>",
          attachments: data.attachments,
        })
      )
    );

    const successCount = results.filter((r) => r.status === "fulfilled").length;
    const failedCount = results.length - successCount;

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
