import { useEffect, useRef, useState } from "react";
import { Bell, X, Send } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { useChatPanelOpen } from "@/lib/chat-panel-state";
import { splitCaption } from "@/lib/update-caption";

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
  title = "Notifications",
}: AnnouncementToastProps & { title?: string }) {
  const navigate = useNavigate();
  const chatPanelOpen = useChatPanelOpen();
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(false);
  const [reply, setReply] = useState("");
  const timerRef = useRef<number | null>(null);
  const storageKey = `rohi.ann.lastSeen.${scope}`;

  useEffect(() => setMounted(true), []);

  // Remove the legacy service worker so no duplicate OS notification is shown.
  useEffect(() => {
    if (!mounted || typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .getRegistrations()
      .then((regs) => regs.forEach((r) => { if (r.active?.scriptURL.includes("rohi-sw.js")) r.unregister(); }))
      .catch(() => {});
  }, [mounted]);

  // Ask once for permission so signed-in agents still get a WhatsApp-style
  // desktop/mobile notification while they are on another tab or app.
  useEffect(() => {
    if (!mounted || typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission !== "default") return;
    const ask = () => { Notification.requestPermission().catch(() => {}); };
    window.addEventListener("pointerdown", ask, { once: true });
    return () => window.removeEventListener("pointerdown", ask);
  }, [mounted]);

  const markSeen = () => {
    try { if (updatedAt) window.localStorage.setItem(storageKey, updatedAt); } catch {}
    setUnread(false);
  };

  // Live refresh is handled by GlobalAnnouncement (React Query invalidation),
  // so no page reload is needed here.
  useEffect(() => {
    if (!mounted) return;
    const openHandler = () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      setOpen(true);
      timerRef.current = window.setTimeout(() => { setOpen(false); markSeen(); }, autoShowMs);
    };
    window.addEventListener("rohi:open-latest", openHandler);
    return () => {
      window.removeEventListener("rohi:open-latest", openHandler);
    };
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
    // WhatsApp-style notification outside the tab (browser must be running).
    try {
      if ("Notification" in window && Notification.permission === "granted") {
        const n = new Notification("Rohi International Travels", {
          body: text || "New update published",
          icon: imageUrl || "/favicon.png",
          image: imageUrl || undefined,
          tag: `rohi-update-${updatedAt}`,
        } as NotificationOptions);
        n.onclick = () => { window.focus(); n.close(); };
      }
    } catch {}
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => { setOpen(false); markSeen(); }, autoShowMs);
    return () => { if (timerRef.current) window.clearTimeout(timerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, enabled, updatedAt]);

  if (!mounted || !enabled || (!text && !imageUrl)) return null;

  const caption = splitCaption(text);

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
    const inAgentPortal =
      typeof window !== "undefined" && window.location.pathname.startsWith("/agent");
    navigate({ to: inAgentPortal ? "/agent/latest-updates" : "/latest-updates" });
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
            className="ann-toast pointer-events-auto w-full max-w-[420px] overflow-hidden rounded-2xl bg-white shadow-[0_18px_50px_-12px_rgba(0,0,0,0.45)] ring-1 ring-navy/10 sm:w-[420px]"
          >
            <div className="flex items-center gap-2 bg-[#D97757] px-3 py-2 text-white">
              <Bell className="h-3.5 w-3.5" />
              <span className="text-[10px] font-bold uppercase tracking-[0.18em]">{title}</span>
              <button
                onClick={closePopup}
                className="ml-auto rounded-full p-1 text-white/80 hover:bg-white/15 hover:text-white"
                aria-label="Dismiss"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Horizontal WhatsApp-style row: thumbnail left, caption right */}
            <button onClick={openUpdatesPage} className="flex w-full items-start gap-3 p-3 text-left">
              {imageUrl ? (
                <img
                  src={imageUrl}
                  alt="Latest Rohi travel update"
                  width={112}
                  height={112}
                  loading="lazy"
                  decoding="async"
                  className="h-16 w-16 shrink-0 rounded-xl object-cover ring-1 ring-navy/10"
                />
              ) : (
                <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-[#D97757]/10 text-[#D97757]">
                  <Bell className="h-6 w-6" />
                </span>
              )}

              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <p className="truncate text-[13px] font-semibold text-gray-900">Rohi International Travels</p>
                  <span className="ml-auto shrink-0 text-[10px] text-gray-400">now</span>
                </div>
                {caption.title && (
                  <p className="mt-0.5 line-clamp-2 text-[13px] font-semibold leading-snug text-gray-900">
                    {caption.title}
                  </p>
                )}
                {caption.body && (
                  <p className="mt-0.5 line-clamp-2 whitespace-pre-wrap text-[11.5px] leading-snug text-gray-500">
                    {caption.body}
                  </p>
                )}
                <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.15em] text-[#D97757]">
                  Tap to see all updates →
                </p>
              </div>
            </button>

            {/* Reply row */}
            <div className="flex items-center gap-2 border-t border-black/5 px-3 py-2.5">
              <input
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); sendReply(); } }}
                placeholder="Type a reply"
                className="flex-1 rounded-full bg-gray-100 px-3 py-2 text-[12.5px] text-gray-800 placeholder-gray-500 outline-none focus:bg-gray-50 focus:ring-2 focus:ring-[#D97757]/40"
              />
              <button
                onClick={sendReply}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-[#D97757] text-white hover:opacity-90"
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

      {/* Persistent pill - Only shown when there are unread notifications */}
      {unread && (
        <div
          className="fixed bottom-[92px] right-5 z-[9990] print:hidden"
          style={{ display: chatPanelOpen ? "none" : undefined }}
        >
          <button
            onClick={toggleOpen}
            className="ann-pill group relative inline-flex items-center gap-2 rounded-full bg-navy px-4 py-2.5 text-xs font-black uppercase tracking-wider text-gold shadow-2xl ring-2 ring-gold/70 transition-all hover:bg-navy/90 active:scale-95"
            aria-label="Latest updates"
          >
            <Bell className="h-4 w-4" />
            <span>Notifications</span>
            <span className="absolute -right-1 -top-1 h-3 w-3 animate-ping rounded-full bg-red-500" />
            <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-red-500 ring-2 ring-white" />
          </button>
        </div>
      )}

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
