import { useEffect, useRef, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { MessageCircle, Phone, Send, Sparkles, X } from "lucide-react";
import { askAssistant } from "@/lib/assistant.functions";
import { setChatPanelOpen } from "@/lib/chat-panel-state";

const PHONE = "923056622988";
const AGENT = "Rohi International Travels";

const STARTERS = [
  "Dubai group fare",
  "Umrah group this winter",
  "Verify my visa",
  "Any discount vouchers?",
];

type Turn = { role: "user" | "assistant"; content: string; failed?: boolean };

function whatsappUrl(text?: string) {
  const query = text ? `&text=${encodeURIComponent(text)}` : "";
  if (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
    return `whatsapp://send?phone=${PHONE}${query}`;
  }
  return `https://web.whatsapp.com/send?phone=${PHONE}${query}`;
}

/**
 * Chat bubble in the corner: the assistant answers from the live fare list in a
 * second, and the WhatsApp handoff carries the whole conversation across so the
 * visitor never has to repeat themselves to a person.
 */
export function WhatsAppWidget() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);
  const [mounted, setMounted] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    setChatPanelOpen(open);
    return () => setChatPanelOpen(false);
  }, [open]);

  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [turns, busy, open]);

  if (pathname.startsWith("/admin")) return null;
  if (!mounted) return null;

  const history = turns.filter((t) => !t.failed).slice(-8);

  async function send(raw: string) {
    const question = raw.trim();
    if (!question || busy) return;
    const past = history;
    setTurns((t) => [...t, { role: "user", content: question }]);
    setMsg("");
    setBusy(true);
    try {
      const answer = await askAssistant({ data: { question, history: past } });
      setTurns((t) => [...t, { role: "assistant", content: answer }]);
    } catch (e) {
      // Visitors get one calm sentence; the gateway's own wording (credits,
      // missing key, 500s) is for the console, not for a customer's screen.
      console.error("assistant:", e);
      setTurns((t) => [
        ...t,
        {
          role: "assistant",
          content:
            "Sorry — I cannot answer that right now. Please WhatsApp us and a person will help you straight away.",
          failed: true,
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  /** Everything said so far travels with the visitor, so staff skip the questions. */
  function handoff() {
    const transcript = turns
      .filter((t) => !t.failed)
      .map((t) => `${t.role === "user" ? "Guest" : "Assistant"}: ${t.content}`)
      .join("\n\n");
    const text = transcript
      ? `Chat on rohitravels.com:\n\n${transcript.slice(-1600)}\n\nI would like to continue with a person, please.`
      : `Hello ${AGENT}! How can you help me today?`;
    const url = whatsappUrl(text);
    const w = window.open(url, "_blank", "noopener,noreferrer");
    if (!w) window.location.href = url;
  }

  const bubble =
    "max-w-[85%] rounded-lg px-3 py-2 text-[13px] leading-snug text-gray-800 shadow-sm";

  return (
    <div className="fixed bottom-5 right-5 z-[9999] flex flex-col items-end gap-3 print:hidden">
      {open && (
        <div className="w-[330px] max-w-[calc(100vw-2.5rem)] overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/10 animate-in fade-in slide-in-from-bottom-4 duration-200">
          <div className="flex items-center justify-between bg-[#075E54] px-4 py-3 text-white">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20">
                <MessageCircle className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-bold leading-tight">{AGENT}</p>
                <p className="text-[11px] text-white/80">
                  {busy ? "typing…" : "Online · answers from live fares"}
                </p>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="rounded p-1 hover:bg-white/10"
              aria-label="Close chat"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div
            ref={scroller}
            className="flex max-h-[46vh] min-h-[150px] flex-col gap-2 overflow-y-auto bg-[#ECE5DD] px-4 py-4"
          >
            {!turns.length && (
              <>
                <div className={`${bubble} self-start rounded-tl-none bg-white font-semibold`}>
                  Welcome to Rohi International Travels
                </div>
                <div className={`${bubble} self-start rounded-tl-none bg-white`}>
                  👋 Ask me about group fares, Umrah, vouchers or visas — I check our live list and
                  a person finishes the booking on WhatsApp.
                </div>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {STARTERS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      disabled={busy}
                      onClick={() => void send(s)}
                      className="rounded-full border border-[#075E54]/25 bg-white px-2.5 py-1 text-[11px] font-medium text-[#075E54] transition hover:bg-[#075E54] hover:text-white disabled:opacity-50"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </>
            )}

            {turns.map((t, i) => (
              <div
                key={i}
                className={[
                  bubble,
                  "whitespace-pre-wrap",
                  t.role === "user"
                    ? "ml-auto self-end rounded-tr-none bg-[#DCF8C6]"
                    : "self-start rounded-tl-none bg-white",
                  t.failed ? "border border-red-200 bg-red-50 text-red-800" : "",
                ].join(" ")}
              >
                {t.content}
              </div>
            ))}

            {busy && (
              <div className={`${bubble} self-start rounded-tl-none bg-white`}>
                <span className="inline-flex gap-1 py-1">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400 [animation-delay:120ms]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400 [animation-delay:240ms]" />
                </span>
              </div>
            )}
          </div>

          {turns.length > 0 && (
            <button
              type="button"
              onClick={handoff}
              className="flex w-full items-center justify-center gap-2 border-t border-gray-200 bg-[#F0F4C3] px-4 py-2 text-[12px] font-semibold text-[#075E54] transition hover:bg-[#E8EEB4]"
            >
              <Phone className="h-3.5 w-3.5" />
              Continue with a person on WhatsApp
            </button>
          )}

          <div className="flex items-center gap-2 border-t border-gray-200 bg-white p-2">
            <input
              type="text"
              value={msg}
              onChange={(e) => setMsg(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void send(msg)}
              maxLength={500}
              placeholder="Ask about fares, Umrah, visas…"
              className="flex-1 rounded-full bg-gray-100 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#25D366]"
            />
            <button
              onClick={() => void send(msg)}
              disabled={busy || !msg.trim()}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-[#25D366] text-white transition hover:brightness-105 disabled:opacity-50"
              aria-label="Send message"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
          <p className="flex items-center gap-1.5 bg-white px-3 pb-2 text-[10px] text-gray-400">
            <Sparkles className="h-3 w-3" />
            Instant answers from our published fares. Booking and payments always go through a
            person.
          </p>
        </div>
      )}
      <button
        onClick={() => setOpen((v) => !v)}
        className="group relative flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-2xl transition hover:scale-105"
        aria-label="Chat with Rohi assistant"
      >
        {!open && (
          <span className="absolute inset-0 animate-ping rounded-full bg-[#25D366] opacity-40" />
        )}
        {open ? <X className="h-5 w-5" /> : <MessageCircle className="h-7 w-7" />}
      </button>
    </div>
  );
}
