/**
 * Single place all app notification emails go through.
 *
 * Uses Lovable's managed email API with the project's verified sender domain.
 * The SDK is imported dynamically so this module stays safe to import from
 * `*.functions.ts` files (whose module scope also ships to the client bundle).
 */

const SENDER_DOMAIN = "rohitravels.com";
const FROM_NAME = "Rohi International Travels";

export type MailResult = { sent: boolean; error?: string };

export async function sendAppMail(opts: {
  to: string;
  subject: string;
  html?: string;
  text?: string;
  fromLabel?: string;
  fromUser?: string;
  replyTo?: string;
  label?: string;
  idempotencyKey?: string;
}): Promise<MailResult> {
  const apiKey = typeof process !== "undefined" ? process.env.LOVABLE_API_KEY : undefined;
  if (!apiKey) return { sent: false, error: "LOVABLE_API_KEY missing" };

  const html = opts.html ?? (opts.text ? `<pre style="font-family:Arial,sans-serif;font-size:14px;white-space:pre-wrap">${opts.text}</pre>` : undefined);
  if (!html) return { sent: false, error: "No email body" };

  try {
    const { sendLovableEmail, EmailAPIError } = await import("@lovable.dev/email-js");
    try {
      await sendLovableEmail(
        {
          to: opts.to,
          from: `${opts.fromLabel ?? FROM_NAME} <${opts.fromUser ?? "noreply"}@${SENDER_DOMAIN}>`,
          sender_domain: SENDER_DOMAIN,
          subject: opts.subject,
          html,
          text: opts.text ?? html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
          purpose: "transactional",
          label: opts.label ?? "notification",
          idempotency_key: opts.idempotencyKey || crypto.randomUUID(),
          ...(opts.replyTo ? { reply_to: opts.replyTo } : {}),
        },
        { apiKey, sendUrl: typeof process !== "undefined" ? process.env.LOVABLE_SEND_URL : undefined },
      );
      return { sent: true };
    } catch (e) {
      if (e instanceof EmailAPIError) return { sent: false, error: `${e.code}` };
      throw e;
    }
  } catch (e) {
    return { sent: false, error: e instanceof Error ? e.message : String(e) };
  }
}
