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
    <div className="fixed right-4 top-20 z-[9998] flex flex-col items-end gap-2 print:hidden md:right-6">
      {open && (
        <div className="ann-toast w-[320px] overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/10">
          {/* Header — WhatsApp-style */}
          <div className="flex items-center justify-between bg-[#075E54] px-3 py-2 text-white">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20">
                <Bell className="h-4 w-4" />
              </div>
              <div className="leading-tight">
                <p className="text-[13px] font-bold">Latest Updates</p>
                <p className="text-[10px] text-white/80">Rohi International Travels</p>
              </div>
            </div>
            <button
              onClick={closePopup}
              className="rounded p-1 hover:bg-white/10"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Body */}
          <div className="bg-[#ECE5DD] px-3 py-3">
            <div className="ann-bubble relative max-w-full rounded-lg rounded-tl-none bg-white px-3 py-2 shadow-sm">
              {imageUrl && (
                <img
                  src={imageUrl}
                  alt=""
                  className="mb-2 max-h-40 w-full rounded-md object-cover"
                  loading="eager"
                />
              )}
              {text && (
                <p className="whitespace-pre-wrap text-[13px] font-semibold leading-snug text-gray-800">
                  {text}
                </p>
              )}
              <div className="mt-1 flex items-center justify-end gap-1 text-[10px] text-gray-400">
                <Sparkles className="h-3 w-3 text-amber-500" />
                <span>now</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Collapsed toggle pill */}
      <button
        onClick={toggleOpen}
        className="ann-pill group relative inline-flex items-center gap-2 rounded-full bg-navy px-3 py-2 text-xs font-bold uppercase tracking-wider text-navy-foreground shadow-lg ring-1 ring-gold/40 hover:brightness-110"
        aria-label="Latest updates"
      >
        <Bell className="h-3.5 w-3.5 text-gold" />
        <span>Latest Updates</span>
        {unread && (
          <>
            <span className="absolute -right-1 -top-1 h-2.5 w-2.5 animate-ping rounded-full bg-red-500" />
            <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-red-500" />
          </>
        )}
      </button>

      <style>{`
        .ann-toast { animation: ann-toast-in .35s cubic-bezier(.2,.8,.2,1) both; }
        @keyframes ann-toast-in {
          from { opacity: 0; transform: translateY(-8px) scale(.96); }
          to   { opacity: 1; transform: none; }
        }
        .ann-bubble { animation: ann-bubble-in .5s .1s ease-out both; }
        @keyframes ann-bubble-in {
          from { opacity: 0; transform: translateY(4px); }
          to   { opacity: 1; transform: none; }
        }
        .ann-pill { animation: ann-pill-pulse 2.6s ease-in-out infinite; }
        @keyframes ann-pill-pulse {
          0%, 100% { box-shadow: 0 6px 16px -6px rgba(0,0,0,.35), 0 0 0 0 rgba(212,175,55,.55); }
          50%      { box-shadow: 0 6px 16px -6px rgba(0,0,0,.35), 0 0 0 10px rgba(212,175,55,0); }
        }
        @media (prefers-reduced-motion: reduce) {
          .ann-toast, .ann-bubble, .ann-pill { animation: none !important; }
        }
      `}</style>
    </div>
  );
}
