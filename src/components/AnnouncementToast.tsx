import { useEffect, useRef, useState } from "react";
import { Bell, X, Send } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { useChatPanelOpen } from "@/lib/chat-panel-state";

export type AnnouncementToastProps = {
  enabled: boolean;
  text: string;
  imageUrl: string;
  updatedAt: string;
  autoShowMs?: number;
  scope?: string;
};

const WHATSAPP_NUMBER = "923056622988";

export function AnnouncementToast({
  enabled,
  text,
  imageUrl,
  updatedAt,
  autoShowMs = 9000,
  scope = "site",
}: AnnouncementToastProps) {
  const navigate = useNavigate();
  const chatPanelOpen = useChatPanelOpen();
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(false);
  const [reply, setReply] = useState("");
  const timerRef = useRef<number | null>(null);
  const storageKey = `rohi.ann.lastSeen.${scope}`;

  useEffect(() => setMounted(true), []);

  // Remove the legacy service worker so no OS/Chrome notification is ever shown.
  useEffect(() => {
    if (!mounted || typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .getRegistrations()
      .then((regs) => regs.forEach((r) => { if (r.active?.scriptURL.includes("rohi-sw.js")) r.unregister(); }))
      .catch(() => {});
  }, [mounted]);

  const markSeen = () => {
    try { if (updatedAt) window.localStorage.setItem(storageKey, updatedAt); } catch {}
    setUnread(false);
  };

  useEffect(() => {
    if (!mounted) return;
    const openHandler = () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      setOpen(true);
      timerRef.current = window.setTimeout(() => { setOpen(false); markSeen(); }, autoShowMs);
    };
    window.addEventListener("rohi:open-latest", openHandler);
    return () => window.removeEventListener("rohi:open-latest", openHandler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, autoShowMs, updatedAt]);

  // Auto-show exactly once per published update.
  useEffect(() => {
    if (!mounted || !enabled || !updatedAt || (!text && !imageUrl)) return;
    let lastSeen: string | null = null;
    try { lastSeen = window.localStorage.getItem(storageKey); } catch {}
    if (lastSeen === updatedAt) return;
    setUnread(true);
    setOpen(true);
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => { setOpen(false); markSeen(); }, autoShowMs);
    return () => { if (timerRef.current) window.clearTimeout(timerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, enabled, updatedAt]);

  if (!mounted || !enabled || (!text && !imageUrl)) return null;

  const toggleOpen = () => {
    setOpen((v) => {
      const next = !v;
      if (next) { if (timerRef.current) window.clearTimeout(timerRef.current); }
      else { markSeen(); }
      return next;
    });
  };

  const closePopup = () => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    setOpen(false);
    markSeen();
  };

  const openUpdatesPage = () => {
    closePopup();
    navigate({ to: "/updates" });
  };

  const sendReply = () => {
    const body = reply.trim() || (text ? `Re: ${text.slice(0, 120)}` : "Hi, I saw your latest update.");
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(body)}`, "_blank", "noopener");
    setReply("");
  };

  return (
    <>
      <div className="pointer-events-none fixed inset-x-0 bottom-3 z-[9999] flex justify-center px-3 print:hidden sm:inset-x-auto sm:bottom-16 sm:right-4 sm:justify-end sm:px-0">
        {open && (
          <div
            role="alert"
            className="ann-toast pointer-events-auto w-full max-w-[360px] overflow-hidden rounded-2xl bg-white shadow-[0_18px_50px_-12px_rgba(0,0,0,0.45)] ring-1 ring-navy/15 sm:w-[360px]"
          >
            {/* Navy/gold header — LATEST UPDATES / close */}
            <div className="flex items-center gap-2 bg-navy px-3 py-1.5 text-white">
              <span className="text-[11px] font-black uppercase tracking-[0.18em] text-gold">Latest Updates</span>
              <button
                onClick={closePopup}
                className="ml-auto rounded p-0.5 text-white/90 hover:bg-white/15"
                aria-label="Dismiss"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <button onClick={openUpdatesPage} className="block w-full text-left">
              {/* Title row */}
              <div className="flex items-center gap-3 px-3 pt-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-navy text-gold shadow ring-1 ring-gold/40">
                  <Bell className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-semibold text-gray-900">Rohi International Travels</p>
                </div>
                <span className="text-[11px] text-gray-400">now</span>
              </div>

              {imageUrl && (
                <div className="px-3 pt-2">
                  <img src={imageUrl} alt="" className="h-auto w-full rounded-lg object-cover" />
                </div>
              )}

              {text && <p className="px-3 pt-2 text-[13px] leading-snug text-gray-800">{text}</p>}

              <p className="px-3 pt-2 text-[11px] font-bold uppercase tracking-wide text-navy">
                Tap to see all updates →
              </p>
            </button>

            {/* Reply row */}
            <div className="flex items-center gap-2 px-3 py-3">
              <input
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); sendReply(); } }}
                placeholder="Type a reply"
                className="flex-1 rounded-full bg-gray-100 px-3 py-2 text-[13px] text-gray-800 placeholder-gray-500 outline-none focus:bg-gray-50 focus:ring-2 focus:ring-gold/50"
              />
              <button
                onClick={sendReply}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-navy text-gold hover:bg-navy/90"
                aria-label="Send"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>

            <div className="h-0.5 w-full bg-black/5">
              <div className="ann-progress h-full bg-gold" style={{ animationDuration: `${autoShowMs}ms` }} />
            </div>
          </div>
        )}
      </div>

      {/* Persistent pill */}
      <div className="fixed bottom-[92px] right-5 z-[9980] print:hidden" style={{ display: chatPanelOpen ? "none" : undefined }}>
        <button
          onClick={toggleOpen}
          className="ann-pill group relative inline-flex items-center gap-2 rounded-full bg-navy px-4 py-2.5 text-xs font-black uppercase tracking-wider text-gold shadow-xl ring-2 ring-gold/70 hover:bg-navy/90"
          aria-label="Latest updates"
        >
          <Bell className="h-4 w-4" />
          <span>Latest Updates</span>
          {unread && (
            <>
              <span className="absolute -right-1 -top-1 h-3 w-3 animate-ping rounded-full bg-red-500" />
              <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-red-500 ring-2 ring-white" />
            </>
          )}
        </button>
      </div>

      <style>{`
        .ann-toast {
          animation: ann-toast-in .4s cubic-bezier(.2,.9,.25,1.1) both;
          transform-origin: bottom right;
        }
        @keyframes ann-toast-in {
          0%   { opacity: 0; transform: translate3d(20px, 20px, 0) scale(.95); }
          100% { opacity: 1; transform: none; }
        }
        @media (max-width: 640px) {
          .ann-toast {
            transform-origin: bottom center;
            animation: ann-toast-in-mobile .35s cubic-bezier(.2,.9,.25,1.1) both;
          }
          @keyframes ann-toast-in-mobile {
            from { opacity: 0; transform: translate3d(0, 24px, 0); }
            to   { opacity: 1; transform: none; }
          }
        }
        .ann-progress { width: 100%; animation: ann-progress linear forwards; transform-origin: left; }
        @keyframes ann-progress { from { transform: scaleX(1); } to { transform: scaleX(0); } }
        .ann-pill { animation: ann-pill-pulse 2.4s ease-in-out infinite; }
        @keyframes ann-pill-pulse {
          0%, 100% { box-shadow: 0 6px 20px -4px rgba(11,37,69,.5), 0 0 0 0 rgba(200,164,80,.65); }
          50%      { box-shadow: 0 6px 20px -4px rgba(11,37,69,.5), 0 0 0 14px rgba(200,164,80,0); }
        }
        @media (prefers-reduced-motion: reduce) {
          .ann-toast, .ann-progress, .ann-pill { animation: none !important; }
        }
      `}</style>
    </>
  );
}
