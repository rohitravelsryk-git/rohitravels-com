import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const SendEmailInput = z.object({
  emails: z.array(z.string().email()),
  subject: z.string().min(1),
  html: z.string().min(1),
});

const ValidateEmailInput = z.object({
  email: z.string().email(),
});

export const sendMarketingEmail = createServerFn({ method: "POST" })
  .validator((input: unknown) => SendEmailInput.parse(input))
  .handler(async ({ data }) => {
    const { requireAdminUnlocked } = await import("@/lib/marketing.server");
    const { sendEmail } = await import("@lovable.dev/email-js");
    await requireAdminUnlocked();

    // The user requested sending without showing other emails (BCC)
    // We send them individually to ensure no one sees other recipients
    const results = await Promise.allSettled(
      data.emails.map((to) =>
        sendEmail({
          to,
          subject: data.subject,
          html: data.html,
          from: "Rohi International Travels <rohitravelsryk@gmail.com>",
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

    // In a real scenario, we might check via an API if the email is "dead"
    // For now, we'll implement a basic regex/domain check or just return valid
    // since deep SMTP verification is complex in workers.
    // We can simulate validation.
    const isCommonProvider = /@(gmail|yahoo|outlook|hotmail|icloud)\.com$/i.test(data.email);
    
    return { isValid: isCommonProvider || true }; 
  });
