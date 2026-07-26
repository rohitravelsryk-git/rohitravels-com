import { useEffect, useRef, useState } from "react";
import { Bell, X, Send } from "lucide-react";

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
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(false);
  const timerRef = useRef<number | null>(null);
  const storageKey = `rohi.ann.lastSeen.${scope}`;
  const notifiedKey = `rohi.ann.notified.${scope}`;

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!mounted || typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/rohi-sw.js").catch(() => {});
    }
  }, [mounted]);

  useEffect(() => {
    if (!mounted || !enabled || (!text && !imageUrl)) return;
    const lastSeen = window.localStorage.getItem(storageKey);
    const lastNotified = window.localStorage.getItem(notifiedKey);
    const isNew = !!updatedAt && updatedAt !== lastSeen;
    if (isNew) {
      setUnread(true);
      setOpen(true);
      if (timerRef.current) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => setOpen(false), autoShowMs);

      if (updatedAt !== lastNotified && "Notification" in window && Notification.permission === "granted") {
        try {
          const n = new Notification("Rohi International Travels", {
            body: text || "New update from Rohi International Travels",
            icon: imageUrl || "/favicon.ico",
            badge: "/favicon.ico",
            tag: "rohi-latest-updates",
            requireInteraction: false,
          });
          n.onclick = () => { window.focus(); n.close(); };
          window.localStorage.setItem(notifiedKey, updatedAt);
        } catch {}
      }
    }
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [mounted, enabled, updatedAt, text, imageUrl, autoShowMs, storageKey, notifiedKey]);

  if (!mounted || !enabled || (!text && !imageUrl)) return null;

  const markSeen = () => {
    try { if (updatedAt) window.localStorage.setItem(storageKey, updatedAt); } catch {}
    setUnread(false);
  };

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

  const openWhatsApp = () => {
    const msg = encodeURIComponent(text ? `Re: ${text.slice(0, 120)}` : "Hi, I saw your latest update.");
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${msg}`, "_blank", "noopener");
  };

  return (
    <>
      <div className="pointer-events-none fixed inset-x-0 bottom-3 z-[9999] flex justify-center px-3 print:hidden sm:inset-x-auto sm:bottom-16 sm:right-4 sm:justify-end sm:px-0">
        {open && (
          <div
            role="alert"
            className="ann-toast pointer-events-auto w-full max-w-[360px] overflow-hidden rounded-2xl bg-white shadow-[0_18px_50px_-12px_rgba(0,0,0,0.45)] ring-1 ring-black/10 sm:w-[360px]"
          >
            {/* Green header — LATEST UPDATES / now / close */}
            <div className="flex items-center gap-2 bg-[#25D366] px-3 py-1.5 text-white">
              <span className="text-[11px] font-bold uppercase tracking-wider">Latest Updates</span>
              <span className="ml-auto text-[11px] opacity-90">now</span>
              <button
                onClick={closePopup}
                className="rounded p-0.5 text-white/90 hover:bg-white/15"
                aria-label="Dismiss"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Title row — bell avatar + name + now */}
            <div className="flex items-center gap-3 px-3 pt-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#25D366] text-white shadow">
                <Bell className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-semibold text-gray-900">Rohi International Travels</p>
              </div>
              <span className="text-[11px] text-gray-400">now</span>
            </div>

            {/* Image (if provided) */}
            {imageUrl && (
              <div className="px-3 pt-2">
                <img
                  src={imageUrl}
                  alt=""
                  className="h-auto w-full rounded-lg object-cover"
                />
              </div>
            )}

            {/* Caption */}
            {text && (
              <p className="px-3 pt-2 text-[13px] leading-snug text-gray-800">{text}</p>
            )}

            {/* Reply row */}
            <div className="flex items-center gap-2 px-3 py-3">
              <button
                onClick={openWhatsApp}
                className="flex-1 rounded-full bg-gray-100 px-3 py-2 text-left text-[12px] text-gray-500 hover:bg-gray-200"
              >
                Type a reply
              </button>
              <button
                onClick={openWhatsApp}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-[#25D366] text-white hover:brightness-110"
                aria-label="Send"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>

            <div className="h-0.5 w-full bg-black/5">
              <div className="ann-progress h-full bg-[#25D366]" style={{ animationDuration: `${autoShowMs}ms` }} />
            </div>
          </div>
        )}
      </div>

      {/* Persistent pill */}
      <div className="fixed bottom-4 right-4 z-[9998] print:hidden">
        <button
          onClick={toggleOpen}
          className="ann-pill group relative inline-flex items-center gap-2 rounded-full bg-[#25D366] px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-white shadow-xl ring-2 ring-white hover:brightness-110"
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
          0%, 100% { box-shadow: 0 6px 20px -4px rgba(37,211,102,.5), 0 0 0 0 rgba(37,211,102,.6); }
          50%      { box-shadow: 0 6px 20px -4px rgba(37,211,102,.5), 0 0 0 14px rgba(37,211,102,0); }
        }
        @media (prefers-reduced-motion: reduce) {
          .ann-toast, .ann-progress, .ann-pill { animation: none !important; }
        }
      `}</style>
    </>
  );
}
