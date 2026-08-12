import { useState, useEffect } from "react";
import { MessageSquare, Send, X, Phone, Clock } from "lucide-react";
import { useChatPanel } from "@/lib/chat-panel-state";

export function WhatsAppWidget() {
  const { isOpen, setIsOpen } = useChatPanel();
  const [msg, setMsg] = useState("");
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  function send() {
    if (!msg.trim()) return;
    const text = encodeURIComponent(msg.trim());
    window.open(`https://wa.me/923056622988?text=${text}`, "_blank");
    setMsg("");
    setIsOpen(false);
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 left-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg transition-all hover:scale-110 active:scale-95 group overflow-hidden"
        title="Chat with us on WhatsApp"
      >
        <div className="absolute inset-0 bg-white/20 translate-y-full transition-transform group-hover:translate-y-0" />
        <MessageSquare className="h-7 w-7 relative z-10" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 left-6 z-50 w-[90vw] max-w-[340px] animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/5">
        <div className="bg-[#075e54] p-4 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20">
                  <Phone className="h-5 w-5" />
                </div>
                <div className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-[#075e54] bg-[#25D366]" />
              </div>
              <div>
                <p className="text-sm font-bold">Rohi Support</p>
                <div className="flex items-center gap-1 text-[10px] opacity-80">
                  <Clock className="h-3 w-3" />
                  <span>Online • Typical reply 5m</span>
                </div>
              </div>
            </div>
            <button onClick={() => setIsOpen(false)} className="rounded-full p-1 hover:bg-white/10">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="bg-[#e5ddd5] p-4">
          <div className="mb-4 inline-block rounded-lg bg-white p-3 text-xs text-gray-800 shadow-sm relative before:absolute before:left-[-6px] before:top-2 before:h-3 before:w-3 before:bg-white before:[clip-path:polygon(100%_0,0_50%,100%_100%)]">
            Hello! How can we help you today with fares or bookings?
          </div>
        </div>

        <div className="bg-white p-3">
          <div className="flex items-end gap-2">
            <div className="relative flex-1">
              <textarea
                value={msg}
                onChange={(e) => setMsg(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                placeholder="Type your message..."
                className="w-full min-h-[44px] max-h-32 rounded-xl bg-gray-100 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#25D366]/30 resize-none transition-all"
                rows={1}
              />
            </div>
            <button
              onClick={send}
              disabled={!msg.trim()}
              className="flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-xl bg-[#25D366] text-white transition-all hover:bg-[#128C7E] active:scale-95 disabled:opacity-50 disabled:grayscale"
            >
              <Send className="h-5 w-5" />
            </button>
          </div>
          <p className="mt-2 text-center text-[10px] text-gray-400">
            Powered by Rohi International Travels
          </p>
        </div>
      </div>
    </div>
  );
}
