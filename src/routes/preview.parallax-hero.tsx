import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PREVIEW_FARES } from "@/lib/preview-fares";
import { PreviewFrame } from "@/components/PreviewFrame";

export const Route = createFileRoute("/preview/parallax-hero")({
  component: Page,
  head: () => ({
    meta: [
      { title: "Cinematic Parallax Hero Preview | Rohi International Travels" },
      { name: "description", content: "Design preview: full-bleed cinematic parallax hero with drifting depth layers for live group fares." },
      { property: "og:title", content: "Cinematic Parallax Hero Preview | Rohi International Travels" },
      { property: "og:description", content: "Full-bleed cinematic parallax hero with drifting depth layers for live group fares." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function Page() {
  const [y, setY] = useState(0);

  useEffect(() => {
    const onScroll = () => setY(window.scrollY);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <PreviewFrame slug="parallax-hero">
      <div className="min-h-[200vh]" style={{ backgroundColor: "var(--navy)" }}>
        <section className="relative flex h-screen items-center justify-center overflow-hidden">
          {/* layer 1 – sky */}
          <div
            className="absolute inset-0"
            style={{
              transform: `translateY(${y * 0.25}px) scale(1.15)`,
              background:
                "radial-gradient(90% 70% at 60% 20%, oklch(0.42 0.11 250) 0%, transparent 65%), radial-gradient(70% 60% at 15% 90%, var(--gold) 0%, transparent 55%), var(--navy)",
              opacity: 0.85,
            }}
          />
          {/* layer 2 – clouds */}
          <div
            className="absolute inset-0"
            style={{
              transform: `translateY(${y * 0.45}px)`,
              background:
                "radial-gradient(40% 18% at 22% 62%, rgba(255,255,255,0.14) 0%, transparent 70%), radial-gradient(34% 14% at 76% 42%, rgba(255,255,255,0.1) 0%, transparent 70%)",
            }}
          />
          {/* layer 3 – headline */}
          <div
            className="relative z-10 px-8 text-center"
            style={{ transform: `translateY(${y * -0.18}px)`, opacity: Math.max(0, 1 - y / 520) }}
          >
            <p className="text-[10px] font-bold uppercase tracking-[0.5em]" style={{ color: "var(--gold)" }}>
              Since 1991 · Live Group Fares
            </p>
            <h1
              className="mt-6 font-serif font-black leading-[0.9]"
              style={{ color: "var(--navy-foreground)", fontSize: "clamp(3rem, 9vw, 8rem)" }}
            >
              Fly Beyond
              <br />
              <span style={{ color: "var(--gold)" }}>The Ordinary</span>
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-sm opacity-75" style={{ color: "var(--navy-foreground)" }}>
              Karachi · Lahore · Islamabad → Jeddah, Riyadh, Dubai, Gassim. Group allocations released daily.
            </p>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
              <button className="rounded-xl px-8 py-4 text-sm font-bold text-white transition-transform hover:scale-105" style={{ backgroundColor: "#25D366" }}>
                Book on WhatsApp
              </button>
              <button className="rounded-xl border px-8 py-4 text-sm font-bold" style={{ borderColor: "var(--gold)", color: "var(--gold)" }}>
                View Live Fares
              </button>
            </div>
          </div>
          {/* layer 4 – foreground silhouette */}
          <div
            className="absolute inset-x-0 bottom-0 h-56"
            style={{
              transform: `translateY(${y * -0.32}px)`,
              background: "linear-gradient(to top, var(--navy) 22%, transparent)",
            }}
          />
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-[10px] font-bold uppercase tracking-[0.4em]" style={{ color: "var(--gold)", opacity: Math.max(0, 1 - y / 200) }}>
            Scroll ↓
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-8 py-24">
          <h2 className="font-serif text-4xl font-black" style={{ color: "var(--navy-foreground)" }}>Today&apos;s Allocations</h2>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {PREVIEW_FARES.slice(0, 3).map((f) => (
              <div key={f.flight} className="rounded-2xl border p-7" style={{ borderColor: "color-mix(in oklab, var(--gold) 25%, transparent)", backgroundColor: "rgba(255,255,255,0.04)" }}>
                <p className="text-[10px] font-bold uppercase tracking-[0.3em]" style={{ color: "var(--gold)" }}>{f.group}</p>
                <p className="mt-3 font-serif text-3xl font-black" style={{ color: "var(--navy-foreground)" }}>{f.from} → {f.to}</p>
                <p className="mt-1 text-xl" dir="rtl" style={{ color: "var(--gold)" }}>{f.urdu}</p>
                <p className="mt-5 font-mono text-[11px] opacity-70" style={{ color: "var(--navy-foreground)" }}>{f.dep} · {f.bag}</p>
                <p className={`mt-4 font-serif font-black ${f.fare.startsWith("PKR") ? "text-2xl" : "text-base"}`} style={{ color: "var(--gold)" }}>{f.fare}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </PreviewFrame>
  );
}
