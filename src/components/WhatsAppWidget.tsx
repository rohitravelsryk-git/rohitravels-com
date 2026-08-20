import { useEffect, useState } from "react";
import { MessageCircle, X, Send } from "lucide-react";
import { setChatPanelOpen } from "@/lib/chat-panel-state";

const PHONE = "923056622988";
const AGENT = "Rohi International Travels";

function whatsappUrl(text?: string) {
  const query = text ? `&text=${encodeURIComponent(text)}` : "";
  if (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
    return `whatsapp://send?phone=${PHONE}${query}`;
  }
  return `https://web.whatsapp.com/send?phone=${PHONE}${query}`;
}

export function WhatsAppWidget() {
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    setChatPanelOpen(open);
    return () => setChatPanelOpen(false);
  }, [open]);
  if (!mounted) return null;

  const send = () => {
    const url = whatsappUrl(msg.trim());
    const w = window.open(url, "_blank", "noopener,noreferrer");
    if (!w) window.location.href = url;
  };

  return (
    <div className="fixed bottom-5 right-5 z-[9999] flex flex-col items-end gap-3 print:hidden">
      {open && (
        <div className="w-[320px] overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/10 animate-in fade-in slide-in-from-bottom-4 duration-200">
          <div className="flex items-center justify-between bg-[#075E54] px-4 py-3 text-white">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20">
                <MessageCircle className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-bold leading-tight">{AGENT}</p>
                <p className="text-[11px] text-white/80">Typically replies within minutes</p>
              </div>
            </div>
            <button onClick={() => setOpen(false)} className="rounded p-1 hover:bg-white/10" aria-label="Close">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="bg-[#ECE5DD] px-4 py-5 space-y-2">
            <div className="max-w-[85%] rounded-lg rounded-tl-none bg-white px-3 py-2 text-[13px] font-semibold text-gray-800 shadow-sm">
              Welcome to Rohi International Travels
              <div className="mt-1 text-right text-[10px] text-gray-400">now</div>
            </div>
            <div className="max-w-[85%] rounded-lg rounded-tl-none bg-white px-3 py-2 text-[13px] text-gray-800 shadow-sm">
              👋 Hi there! How can we help you plan your trip today?
              <div className="mt-1 text-right text-[10px] text-gray-400">now</div>
            </div>
          </div>
          <div className="flex items-center gap-2 border-t border-gray-200 bg-white p-2">
            <input
              type="text"
              value={msg}
              onChange={(e) => setMsg(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder="Type your message…"
              className="flex-1 rounded-full bg-gray-100 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#25D366]"
            />
            <button
              onClick={send}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-[#25D366] text-white transition hover:brightness-105"
              aria-label="Send on WhatsApp"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
      <button
        onClick={() => setOpen((v) => !v)}
        className="group relative flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-2xl transition hover:scale-105"
        aria-label="Chat on WhatsApp 0305 6622988"
      >
        {!open && (
          <span className="absolute inset-0 animate-ping rounded-full bg-[#25D366] opacity-40" />
        )}
        {open ? <X className="h-5 w-5" /> : <MessageCircle className="h-7 w-7" />}
      </button>

    </div>
  );
}
