import { useEffect, useRef, useState } from "react";
import { Bell, X, Sparkles } from "lucide-react";

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

/**
 * WhatsApp-style "Latest Updates" notification.
 * - Auto-pops when a new update arrives (new updatedAt vs. lastSeen).
 * - Auto-hides after autoShowMs, collapsing into a floating "Latest Updates" pill.
 * - Pill has an unread dot; clicking toggles the popup.
 */
export function AnnouncementToast({
  enabled,
  text,
  imageUrl,
  updatedAt,
  autoShowMs = 8000,
  scope = "site",
}: AnnouncementToastProps) {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(false);
  const timerRef = useRef<number | null>(null);
  const storageKey = `rohi.ann.lastSeen.${scope}`;

  useEffect(() => setMounted(true), []);

  // Detect new update and auto-show
  useEffect(() => {
    if (!mounted || !enabled || (!text && !imageUrl)) return;
    const lastSeen = typeof window !== "undefined" ? window.localStorage.getItem(storageKey) : null;
    const isNew = !!updatedAt && updatedAt !== lastSeen;
    if (isNew) {
      setUnread(true);
      setOpen(true);
      if (timerRef.current) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => setOpen(false), autoShowMs);
    }
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [mounted, enabled, updatedAt, text, imageUrl, autoShowMs, storageKey]);

  if (!mounted || !enabled || (!text && !imageUrl)) return null;

  const markSeen = () => {
    try {
      if (updatedAt) window.localStorage.setItem(storageKey, updatedAt);
    } catch {}
    setUnread(false);
  };

  const toggleOpen = () => {
    setOpen((v) => {
      const next = !v;
      if (next) {
        if (timerRef.current) window.clearTimeout(timerRef.current);
      } else {
        markSeen();
      }
      return next;
    });
  };

  const closePopup = () => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    setOpen(false);
    markSeen();
  };

  return (
    <>
      {/* WhatsApp-style system notification — top-right on desktop, top-center on mobile */}
      <div className="pointer-events-none fixed inset-x-0 top-3 z-[9999] flex justify-center px-3 print:hidden sm:inset-x-auto sm:right-4 sm:top-4 sm:justify-end sm:px-0">
        {open && (
          <div
            role="alert"
            className="ann-toast pointer-events-auto w-full max-w-[380px] overflow-hidden rounded-xl bg-white shadow-[0_10px_40px_-10px_rgba(0,0,0,0.45)] ring-1 ring-black/10 sm:w-[380px]"
          >
            {/* Header — WhatsApp brand strip */}
            <div className="flex items-center gap-2 bg-[#25D366] px-3 py-1.5 text-white">
              <svg viewBox="0 0 32 32" className="h-4 w-4 fill-white" aria-hidden="true">
                <path d="M19.11 17.2c-.29-.14-1.7-.84-1.96-.94-.26-.1-.45-.14-.64.14-.19.29-.74.94-.9 1.13-.17.19-.33.22-.62.07-.29-.14-1.21-.45-2.31-1.42-.85-.76-1.43-1.7-1.6-1.98-.17-.29-.02-.44.13-.58.13-.13.29-.34.43-.5.14-.17.19-.29.29-.48.1-.19.05-.36-.02-.5-.07-.14-.64-1.55-.88-2.12-.23-.55-.47-.47-.64-.48h-.55c-.19 0-.5.07-.76.36-.26.29-1 1-.97 2.44.03 1.44 1.05 2.83 1.19 3.02.14.19 2.05 3.13 4.97 4.39.69.3 1.24.48 1.66.61.7.22 1.33.19 1.83.12.56-.08 1.7-.7 1.94-1.37.24-.67.24-1.25.17-1.37-.07-.12-.26-.19-.55-.33z"/>
                <path d="M27.2 4.8C24.24 1.83 20.28.19 16.05.19 7.5.19.55 7.14.55 15.68c0 2.73.71 5.4 2.07 7.75L.4 31.81l8.55-2.19c2.27 1.24 4.83 1.89 7.43 1.9h.01c8.55 0 15.5-6.96 15.5-15.5 0-4.14-1.6-8.03-4.69-11.22zm-11.15 23.85h-.01c-2.33 0-4.62-.63-6.61-1.81l-.47-.28-4.9 1.26 1.31-4.79-.3-.49a12.83 12.83 0 0 1-1.96-6.86c0-7.1 5.78-12.88 12.89-12.88 3.44 0 6.68 1.34 9.11 3.78 2.43 2.43 3.77 5.67 3.77 9.11 0 7.1-5.78 12.88-12.83 12.88z"/>
              </svg>
              <span className="text-[11px] font-semibold tracking-wide">WhatsApp</span>
              <span className="ml-auto text-[10px] font-medium text-white/85">now</span>
              <button
                onClick={closePopup}
                className="rounded p-0.5 text-white/90 hover:bg-white/15"
                aria-label="Dismiss"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Body — mimics a WhatsApp chat push */}
            <div className="flex gap-3 px-3 py-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#25D366] to-[#128C7E] text-white shadow-md ring-2 ring-white">
                <Bell className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="truncate text-[14px] font-bold text-gray-900">Rohi International Travels</p>
                  <span className="shrink-0 text-[10px] text-gray-500">now</span>
                </div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[#128C7E]">Latest Updates</p>
                {imageUrl && (
                  <img
                    src={imageUrl}
                    alt=""
                    className="mt-1.5 max-h-32 w-full rounded-md object-cover"
                    loading="eager"
                  />
                )}
                {text && (
                  <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-[13px] leading-snug text-gray-700">
                    {text}
                  </p>
                )}
              </div>
            </div>

            {/* Progress bar for auto-hide */}
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
              <span className="absolute -right-1 -top-1 flex h-3 w-3 items-center justify-center rounded-full bg-red-500 text-[8px] font-bold text-white ring-2 ring-white">
                <Sparkles className="h-2 w-2" />
              </span>
            </>
          )}
        </button>
      </div>

      <style>{`
        .ann-toast {
          animation: ann-toast-in .45s cubic-bezier(.2,.9,.25,1.1) both;
          transform-origin: top right;
        }
        @keyframes ann-toast-in {
          0%   { opacity: 0; transform: translate3d(20px, -10px, 0) scale(.92); }
          60%  { opacity: 1; transform: translate3d(-2px, 0, 0) scale(1.01); }
          100% { opacity: 1; transform: none; }
        }
        @media (max-width: 640px) {
          .ann-toast {
            transform-origin: top center;
            animation: ann-toast-in-mobile .4s cubic-bezier(.2,.9,.25,1.1) both;
          }
          @keyframes ann-toast-in-mobile {
            from { opacity: 0; transform: translate3d(0, -20px, 0); }
            to   { opacity: 1; transform: none; }
          }
        }
        .ann-progress {
          width: 100%;
          animation: ann-progress linear forwards;
          transform-origin: left;
        }
        @keyframes ann-progress {
          from { transform: scaleX(1); }
          to   { transform: scaleX(0); }
        }
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
