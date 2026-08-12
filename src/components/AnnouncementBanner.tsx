import { Megaphone, Sparkles } from "lucide-react";

export type AnnouncementProps = {
  enabled: boolean;
  text: string;
  imageUrl: string;
  linkUrl: string;
};

export function AnnouncementBanner({ text, imageUrl, linkUrl }: AnnouncementProps) {
  const content = (
    <div className="ann-banner relative isolate overflow-hidden rounded-none border-y border-gold/40 shadow-[0_10px_30px_-10px_rgba(0,0,0,0.45)] min-h-[5rem] flex items-center">
      {/* Animated conic gradient backdrop */}
      <div className="ann-aurora absolute inset-0 -z-10" aria-hidden />
      {/* Soft plane grid lines */}
      <div className="pointer-events-none absolute inset-0 -z-10 bg-plane-lines opacity-20" aria-hidden />
      {/* Sweeping shimmer */}
      <div className="ann-shimmer pointer-events-none absolute inset-0 -z-10" aria-hidden />
      {/* Floating sparkles */}
      <span className="ann-spark ann-spark-1" aria-hidden />
      <span className="ann-spark ann-spark-2" aria-hidden />
      <span className="ann-spark ann-spark-3" aria-hidden />

      <div className="relative mx-auto flex w-full max-w-7xl items-center gap-4 px-4 py-2 md:gap-5">
        {/* Animated pill */}
        <span className="ann-pill inline-flex shrink-0 items-center gap-1.5 rounded-full bg-gold px-3 py-1 text-[10px] font-black uppercase tracking-[0.25em] text-navy shadow-md">
          <Megaphone className="h-3 w-3 ann-bell" />
          Flash
        </span>

        {imageUrl && (
          <div className="shrink-0 flex items-center justify-center p-1">
            <img
              src={imageUrl}
              alt=""
              className="ann-img block h-auto max-h-16 w-auto max-w-[120px] rounded-md object-contain shadow-lg ring-1 ring-white/30"
              loading="eager"
            />
          </div>
        )}

        {/* Marquee text for all screens */}
        {text && (
          <div className="relative flex-1 overflow-hidden">
            <div className="ann-marquee whitespace-nowrap">
              <span className="ann-text mx-8 inline-flex items-center gap-3 text-sm font-semibold text-white">
                <Sparkles className="h-3.5 w-3.5 text-gold" /> {text}
              </span>
              <span className="ann-text mx-8 inline-flex items-center gap-3 text-sm font-semibold text-white" aria-hidden>
                <Sparkles className="h-3.5 w-3.5 text-gold" /> {text}
              </span>
            </div>
          </div>
        )}
      </div>

      <style>{`
        .ann-banner { background: linear-gradient(90deg, oklch(0.16 0.045 260), oklch(0.22 0.06 260), oklch(0.16 0.045 260)); }
        .ann-aurora {
          background:
            radial-gradient(60% 120% at 15% 40%, oklch(0.85 0.15 85 / 0.35), transparent 60%),
            radial-gradient(50% 120% at 85% 60%, oklch(0.7 0.18 320 / 0.28), transparent 60%),
            conic-gradient(from 0deg at 50% 50%, oklch(0.85 0.15 85 / 0.15), oklch(0.7 0.18 320 / 0.15), oklch(0.6 0.2 220 / 0.15), oklch(0.85 0.15 85 / 0.15));
          filter: blur(20px);
          animation: ann-spin 14s linear infinite;
        }
        @keyframes ann-spin { to { transform: rotate(360deg); } }

        .ann-shimmer::before {
          content: "";
          position: absolute; inset: 0;
          background: linear-gradient(115deg, transparent 30%, rgba(255,255,255,0.14) 45%, rgba(255,255,255,0.28) 50%, rgba(255,255,255,0.14) 55%, transparent 70%);
          transform: translateX(-100%);
          animation: ann-sweep 3.6s cubic-bezier(.4,0,.2,1) infinite;
        }
        @keyframes ann-sweep { to { transform: translateX(100%); } }

        .ann-pill { animation: ann-pop .8s cubic-bezier(.34,1.56,.64,1) both, ann-pulse 2.4s ease-in-out 1s infinite; }
        @keyframes ann-pop { from { opacity: 0; transform: translateY(6px) scale(.9); } to { opacity: 1; transform: none; } }
        @keyframes ann-pulse { 0%,100% { box-shadow: 0 0 0 0 oklch(0.85 0.15 85 / .55); } 50% { box-shadow: 0 0 0 10px oklch(0.85 0.15 85 / 0); } }
        .ann-bell { animation: ann-swing 1.6s ease-in-out infinite; transform-origin: 50% 10%; }
        @keyframes ann-swing { 0%,100% { transform: rotate(-12deg); } 50% { transform: rotate(12deg); } }

        .ann-img { animation: ann-in .7s cubic-bezier(.2,.8,.2,1) both; display: block !important; }
        @keyframes ann-in { from { opacity: 0; transform: translateY(8px) scale(.96); } to { opacity: 1; transform: none; } }

        .ann-fade { animation: ann-in .9s .1s cubic-bezier(.2,.8,.2,1) both; }
        .ann-text-gradient {
          background: linear-gradient(90deg, #fff 0%, oklch(0.9 0.14 85) 25%, #fff 50%, oklch(0.9 0.14 85) 75%, #fff 100%);
          background-size: 200% 100%;
          -webkit-background-clip: text; background-clip: text;
          color: transparent;
          animation: ann-flow 6s linear infinite;
        }
        @keyframes ann-flow { to { background-position: -200% 0; } }

        .ann-marquee { display: flex; width: max-content; animation: ann-marq 18s linear infinite; }
        @keyframes ann-marq { to { transform: translateX(-50%); } }

        .ann-spark { position: absolute; width: 6px; height: 6px; border-radius: 9999px; background: oklch(0.9 0.14 85); box-shadow: 0 0 12px 2px oklch(0.9 0.14 85 / .8); opacity: 0; }
        .ann-spark-1 { top: 20%; left: 10%; animation: ann-twinkle 3.2s ease-in-out .2s infinite; }
        .ann-spark-2 { top: 65%; left: 55%; animation: ann-twinkle 2.6s ease-in-out .9s infinite; }
        .ann-spark-3 { top: 30%; left: 88%; animation: ann-twinkle 3.8s ease-in-out 1.4s infinite; }
        @keyframes ann-twinkle { 0%,100% { opacity: 0; transform: scale(.6); } 50% { opacity: 1; transform: scale(1.2); } }

        @media (prefers-reduced-motion: reduce) {
          .ann-aurora, .ann-shimmer::before, .ann-pill, .ann-bell, .ann-img, .ann-fade, .ann-text-gradient, .ann-marquee, .ann-spark { animation: none !important; }
          .ann-text-gradient { color: #fff; background: none; -webkit-background-clip: initial; background-clip: initial; }
        }
      `}</style>
    </div>
  );

  if (linkUrl) {
    return (
      <a href={linkUrl} target="_blank" rel="noopener noreferrer" className="block transition hover:brightness-110">
        {content}
      </a>
    );
  }
  return content;
}
