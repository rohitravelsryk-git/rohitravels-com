import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { PREVIEW_FARES } from "@/lib/preview-fares";
import { PreviewFrame } from "@/components/PreviewFrame";

export const Route = createFileRoute("/preview/kinetic-type")({
  component: Page,
  head: () => ({
    meta: [
      { title: "Kinetic Typography Preview | Rohi International Travels" },
      { name: "description", content: "Design preview: oversized serif headline with an infinite route marquee and counting fare numbers." },
      { property: "og:title", content: "Kinetic Typography Preview | Rohi International Travels" },
      { property: "og:description", content: "Oversized serif headline with infinite route marquee and counting fare numbers." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function Counter({ value, prefix = "PKR " }: { value: number; prefix?: string }) {
  const [n, setN] = useState(0);
  const ref = useRef(0);
  useEffect(() => {
    const start = performance.now();
    const dur = 1600;
    const step = (now: number) => {
      const p = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      setN(Math.round(value * eased));
      if (p < 1) ref.current = requestAnimationFrame(step);
    };
    ref.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(ref.current);
  }, [value]);
  return <>{prefix}{n.toLocaleString()}</>;
}

function Page() {
  const marquee = PREVIEW_FARES.map((f) => `${f.from} → ${f.to}`);
  return (
    <PreviewFrame slug="kinetic-type">
      <div className="min-h-screen overflow-hidden py-16" style={{ backgroundColor: "var(--navy)" }}>
        <style>{`@keyframes marq { from { transform: translateX(0) } to { transform: translateX(-50%) } }`}</style>

        <div className="mx-auto max-w-6xl px-8">
          <p className="text-[10px] font-bold uppercase tracking-[0.45em]" style={{ color: "var(--gold)" }}>Preview · Kinetic Typography</p>
          <h1 className="mt-6 font-serif font-black leading-[0.82]" style={{ color: "var(--navy-foreground)", fontSize: "clamp(3.5rem, 12vw, 11rem)" }}>
            GROUP
            <br />
            <span style={{ color: "var(--gold)" }}>FARES</span>
            <span className="align-super text-[0.2em] tracking-[0.3em]"> LIVE</span>
          </h1>
        </div>

        {/* marquee */}
        <div className="mt-12 overflow-hidden border-y py-6" style={{ borderColor: "color-mix(in oklab, var(--gold) 25%, transparent)" }}>
          <div className="flex w-max gap-14" style={{ animation: "marq 22s linear infinite" }}>
            {[...marquee, ...marquee, ...marquee, ...marquee].map((m, i) => (
              <span key={i} className="whitespace-nowrap font-mono text-2xl font-bold tracking-[0.2em]" style={{ color: i % 2 ? "var(--gold)" : "var(--navy-foreground)" }}>
                {m} <span className="opacity-40">✈</span>
              </span>
            ))}
          </div>
        </div>

        {/* counting fares */}
        <div className="mx-auto mt-16 grid max-w-6xl gap-10 px-8 md:grid-cols-3">
          {PREVIEW_FARES.slice(0, 3).map((f) => (
            <div key={f.flight} className="border-t pt-6" style={{ borderColor: "color-mix(in oklab, var(--gold) 30%, transparent)" }}>
              <p className="text-[10px] font-bold uppercase tracking-[0.3em]" style={{ color: "var(--gold)" }}>{f.group} · {f.airline}</p>
              <p className="mt-3 font-serif text-4xl font-black" style={{ color: "var(--navy-foreground)" }}>{f.fromCity} → {f.toCity}</p>
              <p className="mt-1 text-2xl" dir="rtl" style={{ color: "var(--gold)" }}>{f.urdu}</p>
              <p className="mt-6 font-serif text-5xl font-black tabular-nums" style={{ color: "var(--gold)" }}>
                {f.fare.startsWith("PKR") ? <Counter value={Number(f.fare.replace(/\D/g, ""))} /> : <span className="text-xl">FARE ON WHATSAPP</span>}
              </p>
              <p className="mt-4 font-mono text-[11px] opacity-65" style={{ color: "var(--navy-foreground)" }}>{f.dep} · {f.bag} · {f.seats} seats</p>
            </div>
          ))}
        </div>
      </div>
    </PreviewFrame>
  );
}
