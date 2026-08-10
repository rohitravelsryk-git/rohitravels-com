import { useState } from "react";
import { MessageCircle, X, Send } from "lucide-react";

const COUNTRY_CODES = ["92", "966", "971", "968", "974", "965", "973", "90", "44", "1"];

function buildUrl(code: string, number: string, text: string, type: "web" | "app") {
  const phone = `${code}${number}`.replace(/\D/g, "");
  const query = text.trim() ? `&text=${encodeURIComponent(text.trim())}` : "";
  if (type === "app") {
    return `whatsapp://send?phone=${phone}${query}`;
  }
  return `https://web.whatsapp.com/send?phone=${phone}${query}`;
}

/** Admin-only quick WhatsApp composer: country code + number → opens WhatsApp web/app. */
export function WhatsAppDirectDialog({ onClose }: { onClose: () => void }) {
  const [code, setCode] = useState("+92");
  const [number, setNumber] = useState("");
  const [text, setText] = useState("");
  const [type, setType] = useState<"web" | "app">("web");
  const [error, setError] = useState("");

  const send = () => {
    const digits = number.replace(/\D/g, "").replace(/^0+/, "");
    if (digits.length < 6 || digits.length > 15) {
      setError("Enter a valid phone number (without leading 0).");
      return;
    }
    if (!/^\d{1,4}$/.test(code.replace(/\D/g, ""))) {
      setError("Enter a valid country code.");
      return;
    }
    setError("");
    const url = buildUrl(code, digits, text, type);
    // User wants current page to stay as it was.
    // For WhatsApp App (protocol), window.open might open a blank tab or just trigger the app.
    // Standard behavior for protocols is window.location if not opening a tab.
    if (type === "app") {
      window.location.href = url;
    } else {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  };

  const input = "w-full rounded-md border border-navy/25 bg-white px-3 py-2 text-sm text-navy outline-none focus:ring-2 focus:ring-[#25D366]";

  return (
    <div className="fixed inset-0 z-[10001] flex items-center justify-center bg-navy/60 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md overflow-hidden rounded-2xl bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between bg-[#075E54] px-4 py-3 text-white">
          <div className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5" />
            <p className="text-sm font-bold">Direct WhatsApp Chat</p>
          </div>
          <button onClick={onClose} className="rounded p-1 hover:bg-white/10" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3 p-4">
          <div className="grid grid-cols-[100px_1fr] gap-3">
            <div>
              <label className="mb-1 block text-[10px] font-black uppercase tracking-wider text-navy/60">Country code</label>
              <input
                className={input}
                list="wa-country-codes"
                value={code}
                onChange={(e) => {
                  let val = e.target.value.replace(/[^\d+]/g, "");
                  if (val && !val.startsWith("+")) val = "+" + val;
                  setCode(val);
                }}
                placeholder="+92"
                maxLength={5}
              />
              <datalist id="wa-country-codes">
                {COUNTRY_CODES.map((c) => <option key={c} value={`+${c}`} />)}
              </datalist>
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-black uppercase tracking-wider text-navy/60">Phone number</label>
              <input
                className={input}
                value={number}
                onChange={(e) => setNumber(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && send()}
                placeholder="3056622988"
                maxLength={20}
                inputMode="numeric"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-[10px] font-black uppercase tracking-wider text-navy/60">Open via</label>
            <div className="flex gap-4">
              <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-navy">
                <input
                  type="radio"
                  name="wa-type"
                  value="web"
                  checked={type === "web"}
                  onChange={() => setType("web")}
                  className="accent-[#075E54]"
                />
                WhatsApp Web
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-navy">
                <input
                  type="radio"
                  name="wa-type"
                  value="app"
                  checked={type === "app"}
                  onChange={() => setType("app")}
                  className="accent-[#075E54]"
                />
                WhatsApp App
              </label>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-[10px] font-black uppercase tracking-wider text-navy/60">Message (optional)</label>
            <textarea
              className={`${input} min-h-[90px] resize-y`}
              value={text}
              onChange={(e) => setText(e.target.value.slice(0, 1000))}
              placeholder="Type the message to pre-fill in WhatsApp…"
              maxLength={1000}
            />
          </div>

          <div className="rounded-md border border-dashed border-navy/20 bg-muted/30 p-2 text-center">
            <p className="text-[10px] font-bold uppercase tracking-widest text-navy/40">
              Note: Attachments must be added manually inside WhatsApp after opening the chat
            </p>
          </div>

          {error && <p className="text-xs font-semibold text-red-600">{error}</p>}

          <p className="text-[11px] text-muted-foreground">
            Opens WhatsApp {type === "web" ? "Web" : "App"} for
            {" "}<span className="font-mono font-bold">{code.startsWith("+") ? code : "+" + code}{number.replace(/\D/g, "").replace(/^0+/, "")}</span>
          </p>

          <button
            onClick={send}
            className="flex w-full items-center justify-center gap-2 rounded-md bg-[#25D366] px-4 py-2.5 text-sm font-bold text-white transition hover:brightness-105"
          >
            <Send className="h-4 w-4" /> Send WhatsApp
          </button>
        </div>
      </div>
    </div>
  );
}
