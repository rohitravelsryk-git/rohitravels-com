import { useEffect, useRef, useState } from "react";
import { Bell, X, Send } from "lucide-react";

export type AnnouncementToastProps = {
  enabled: boolean;
  text: string;
  imageUrl: string;
  updatedAt: string;
  /** How long to auto-show the popup in ms (default 8s) */
  autoShowMs?: number;
  /** Optional storage key suffix to separate seen-state per surface */
  scope?: string;
};

const WHATSAPP_NUMBER = "923056622988";

/**
 * Windows WhatsApp-style toast pinned to the bottom-right.
 * - Auto-pops when a new update arrives.
 * - Auto-hides after autoShowMs, collapsing into a floating pill.
 * - Also fires OS-level Notification (works while tab is backgrounded).
 */
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

  // Ask for OS notification permission once (silently ignored if denied).
  useEffect(() => {
    if (!mounted || typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
    // Register a lightweight service worker so notifications persist even when tab is hidden.
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/rohi-sw.js").catch(() => {});
    }
  }, [mounted]);

  // Detect a new update and auto-show + fire OS notification
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

      // OS-level notification — only once per updatedAt
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
      {/* Windows-style WhatsApp toast — bottom-right */}
      <div className="pointer-events-none fixed inset-x-0 bottom-3 z-[9999] flex justify-center px-3 print:hidden sm:inset-x-auto sm:bottom-16 sm:right-4 sm:justify-end sm:px-0">
        {open && (
          <div
            role="alert"
            className="ann-toast pointer-events-auto w-full max-w-[360px] overflow-hidden rounded-xl bg-white shadow-[0_18px_50px_-12px_rgba(0,0,0,0.55)] ring-1 ring-black/10 sm:w-[360px]"
          >
            {/* Header — WhatsApp app label with close */}
            <div className="flex items-center gap-2 border-b border-black/5 px-3 py-2 text-gray-700">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#25D366]">
                <svg viewBox="0 0 32 32" className="h-3 w-3 fill-white" aria-hidden="true">
                  <path d="M27.2 4.8C24.24 1.83 20.28.19 16.05.19 7.5.19.55 7.14.55 15.68c0 2.73.71 5.4 2.07 7.75L.4 31.81l8.55-2.19c2.27 1.24 4.83 1.89 7.43 1.9h.01c8.55 0 15.5-6.96 15.5-15.5 0-4.14-1.6-8.03-4.69-11.22z"/>
                </svg>
              </span>
              <span className="text-[12px] font-semibold text-gray-800">WhatsApp</span>
              <span className="ml-auto text-[16px] leading-none text-gray-400">…</span>
              <button
                onClick={closePopup}
                className="ml-1 rounded p-0.5 text-gray-400 hover:bg-black/5 hover:text-gray-700"
                aria-label="Dismiss"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Body — contact avatar + name + caption */}
            <div className="flex items-center gap-3 px-3 py-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-[#25D366] to-[#128C7E] text-white ring-2 ring-white shadow">
                {imageUrl ? (
                  <img src={imageUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <Bell className="h-6 w-6" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-semibold text-gray-900">Rohi International Travels</p>
                <p className="mt-0.5 line-clamp-2 text-[13px] leading-snug text-gray-600">
                  {text || "New update"}
                </p>
              </div>
            </div>

            {/* Reply row — WhatsApp style */}
            <div className="flex items-center gap-2 px-3 pb-3">
              <button
                onClick={openWhatsApp}
                className="flex-1 rounded-full bg-gray-100 px-3 py-2 text-left text-[12px] text-gray-500 hover:bg-gray-200"
              >
                Type a reply
              </button>
              <button
                onClick={openWhatsApp}
                className="flex h-8 w-14 items-center justify-center rounded-full bg-[#25D366] text-[11px] font-semibold text-white hover:brightness-110"
                aria-label="Send"
              >
                <Send className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Auto-hide progress */}
            <div className="h-0.5 w-full bg-black/5">
              <div className="ann-progress h-full bg-[#25D366]" style={{ animationDuration: `${autoShowMs}ms` }} />
            </div>
          </div>
        )}
      </div>

      {/* Persistent collapsed pill — bottom-right, always visible */}
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
