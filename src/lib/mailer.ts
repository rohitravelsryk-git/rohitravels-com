/**
 * Single place all app notification emails go through.
 *
 * Uses Lovable's managed email API with the project's verified sender domain.
 * The SDK is imported dynamically so this module stays safe to import from
 * `*.functions.ts` files (whose module scope also ships to the client bundle).
 */

const SENDER_DOMAIN = "email.rohitravels.com";
/** Address recipients see. Lovable sends through SENDER_DOMAIN, so if the root
 *  domain is not verified yet every mail retries on it rather than failing. */
const VISIBLE_DOMAIN = "rohitravels.com";
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

  const html = opts.html ?? (opts.text
    ? (await import("./email-templates/brand-html")).brandedEmailHtml({
        category: "OPERATIONAL NOTICE",
        title: opts.subject,
        body: `<div style="white-space:pre-line;font-size:14px;line-height:22px">${(await import("./email-templates/brand-html")).escapeEmailHtml(opts.text)}</div>`,
      })
    : undefined);
  if (!html) return { sent: false, error: "No email body" };

  const idempotencyKey = opts.idempotencyKey || crypto.randomUUID();
  const fromName = opts.fromLabel ?? FROM_NAME;
  const fromUser = opts.fromUser ?? "noreply";
  const plainText = opts.text ?? html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

  try {
    const { sendLovableEmail, EmailAPIError } = await import("@lovable.dev/email-js");
    const send = (domain: string, key: string) =>
      sendLovableEmail(
        {
          to: opts.to,
          from: `${fromName} <${fromUser}@${domain}>`,
          sender_domain: SENDER_DOMAIN,
          subject: opts.subject,
          html,
          text: plainText,
          purpose: "transactional",
          label: opts.label ?? "notification",
          idempotency_key: key,
          ...(opts.replyTo ? { reply_to: opts.replyTo } : {}),
        },
        { apiKey, sendUrl: typeof process !== "undefined" ? process.env.LOVABLE_SEND_URL : undefined },
      );
    try {
      await send(VISIBLE_DOMAIN, idempotencyKey);
      return { sent: true };
    } catch (first) {
      if (!(first instanceof EmailAPIError)) throw first;
      await send(SENDER_DOMAIN, `${idempotencyKey}-verified`);
      return { sent: true };
    }
  } catch (e) {
    return { sent: false, error: e instanceof Error ? e.message : String(e) };
  }
}
