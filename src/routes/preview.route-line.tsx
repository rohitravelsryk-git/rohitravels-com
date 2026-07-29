import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { PREVIEW_FARES } from "@/lib/preview-fares";
import { PreviewFrame } from "@/components/PreviewFrame";

export const Route = createFileRoute("/preview/route-line")({
  component: Page,
  head: () => ({
    meta: [
      { title: "Animated Route Line Preview | Rohi International Travels" },
      { name: "description", content: "Design preview: SVG flight paths that draw themselves with a plane travelling origin to destination." },
      { property: "og:title", content: "Animated Route Line Preview | Rohi International Travels" },
      { property: "og:description", content: "SVG flight paths that draw themselves with a plane travelling origin to destination." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function RouteCard({ f, i }: { f: (typeof PREVIEW_FARES)[number]; i: number }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [on, setOn] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setOn(true), { threshold: 0.4 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const pathId = `arc-${i}`;
  return (
    <div
      ref={ref}
      className="rounded-3xl border p-8"
      style={{ borderColor: "color-mix(in oklab, var(--gold) 25%, transparent)", backgroundColor: "rgba(255,255,255,0.04)" }}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.3em]" style={{ color: "var(--gold)" }}>{f.group} · {f.airline}</p>
          <p className="mt-2 font-serif text-3xl font-black" style={{ color: "var(--navy-foreground)" }}>{f.fromCity} → {f.toCity}</p>
        </div>
        <p className="text-2xl" dir="rtl" style={{ color: "var(--gold)" }}>{f.urdu}</p>
      </div>

      <svg viewBox="0 0 600 130" className="mt-6 w-full" role="img" aria-label={`Flight path ${f.from} to ${f.to}`}>
        <defs>
          <path id={pathId} d="M40,100 Q300,-10 560,100" fill="none" />
        </defs>
        <path
          d="M40,100 Q300,-10 560,100"
          fill="none"
          stroke="var(--gold)"
          strokeWidth="2"
          strokeDasharray="700"
          strokeDashoffset={on ? 0 : 700}
          style={{ transition: "stroke-dashoffset 2s ease-out", opacity: 0.85 }}
        />
        <circle cx="40" cy="100" r="6" fill="var(--gold)" />
        <circle cx="560" cy="100" r="6" fill="#25D366" />
        <text x="26" y="124" fill="var(--gold)" fontSize="16" fontFamily="monospace" fontWeight="bold">{f.from}</text>
        <text x="536" y="124" fill="var(--gold)" fontSize="16" fontFamily="monospace" fontWeight="bold">{f.to}</text>
        {on && (
          <g>
            <text fontSize="20" fill="var(--gold)">
              ✈
              <animateMotion dur="2s" fill="freeze" rotate="auto">
                <mpath href={`#${pathId}`} />
              </animateMotion>
            </text>
          </g>
        )}
      </svg>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
        <p className="font-mono text-[11px] opacity-70" style={{ color: "var(--navy-foreground)" }}>{f.dep} · {f.flight} · {f.bag}</p>
        <p className={`font-serif font-black ${f.fare.startsWith("PKR") ? "text-2xl" : "text-sm"}`} style={{ color: "var(--gold)" }}>{f.fare}</p>
      </div>
    </div>
  );
}

function Page() {
  return (
    <PreviewFrame slug="route-line">
      <div className="min-h-screen px-6 py-16 md:px-10" style={{ backgroundColor: "var(--navy)" }}>
        <div className="mx-auto max-w-4xl">
          <p className="text-[10px] font-bold uppercase tracking-[0.45em]" style={{ color: "var(--gold)" }}>Preview · Animated Route Line</p>
          <h1 className="mt-3 font-serif text-5xl font-black" style={{ color: "var(--navy-foreground)" }}>Every Sector, Drawn</h1>
          <div className="mt-10 space-y-6">
            {PREVIEW_FARES.slice(0, 4).map((f, i) => (
              <RouteCard key={f.flight} f={f} i={i} />
            ))}
          </div>
        </div>
      </div>
    </PreviewFrame>
  );
}
