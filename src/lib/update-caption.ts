/**
 * Latest Updates captions are entered as free text in the admin panel.
 * The first line (or first sentence) is treated as the caption heading and
 * the rest as smaller body content, so posts render professionally in the
 * public feed, the agent portal and the WhatsApp-style notification.
 */
export function splitCaption(raw?: string | null): { title: string; body: string } {
  const text = (raw ?? "").trim();
  if (!text) return { title: "", body: "" };

  const nl = text.indexOf("\n");
  if (nl > -1) {
    return { title: text.slice(0, nl).trim(), body: text.slice(nl + 1).trim() };
  }
  // Single-line caption: split on the first sentence end when it's long.
  if (text.length > 90) {
    const m = text.match(/^(.{20,90}?[.!?—–-])\s+(.+)$/s);
    if (m) return { title: m[1].trim(), body: m[2].trim() };
    const cut = text.lastIndexOf(" ", 80);
    if (cut > 30) return { title: text.slice(0, cut).trim(), body: text.slice(cut).trim() };
  }
  return { title: text, body: "" };
}
