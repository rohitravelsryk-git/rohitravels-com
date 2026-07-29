import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { PREVIEW_FARES } from "@/lib/preview-fares";
import { PreviewFrame } from "@/components/PreviewFrame";

export const Route = createFileRoute("/preview/tilt-cards")({
  component: Page,
  head: () => ({
    meta: [
      { title: "3D Tilt Fare Cards Preview | Rohi International Travels" },
      { name: "description", content: "Design preview: fare cards that tilt toward the cursor with a sweeping gold sheen." },
      { property: "og:title", content: "3D Tilt Fare Cards Preview | Rohi International Travels" },
      { property: "og:description", content: "Fare cards that tilt toward the cursor with a sweeping gold sheen." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function TiltCard({ f }: { f: (typeof PREVIEW_FARES)[number] }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [t, setT] = useState({ rx: 0, ry: 0, mx: 50, my: 50, on: false });

  const move = (e: React.MouseEvent) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    setT({ rx: (0.5 - py) * 14, ry: (px - 0.5) * 16, mx: px * 100, my: py * 100, on: true });
  };

  return (
    <div style={{ perspective: "1200px" }}>
      <div
        ref={ref}
        onMouseMove={move}
        onMouseLeave={() => setT({ rx: 0, ry: 0, mx: 50, my: 50, on: false })}
        className="relative overflow-hidden rounded-3xl border p-8 transition-transform duration-200 ease-out"
        style={{
          borderColor: "color-mix(in oklab, var(--gold) 30%, transparent)",
          backgroundColor: "color-mix(in oklab, var(--navy-foreground) 6%, transparent)",
          transform: `rotateX(${t.rx}deg) rotateY(${t.ry}deg) scale(${t.on ? 1.03 : 1})`,
          transformStyle: "preserve-3d",
          boxShadow: t.on ? "0 40px 70px -35px rgba(0,0,0,0.9)" : "0 20px 40px -30px rgba(0,0,0,0.7)",
        }}
      >
        {/* sheen */}
        <div
          className="pointer-events-none absolute inset-0 transition-opacity duration-300"
          style={{
            opacity: t.on ? 1 : 0,
            background: `radial-gradient(45% 45% at ${t.mx}% ${t.my}%, color-mix(in oklab, var(--gold) 34%, transparent) 0%, transparent 70%)`,
          }}
        />
        <div style={{ transform: "translateZ(45px)" }} className="relative">
          <div className="flex items-center justify-between">
            <span className="rounded-full px-3 py-1 text-[9px] font-bold uppercase tracking-[0.24em]" style={{ backgroundColor: "var(--gold)", color: "var(--gold-foreground)" }}>{f.group}</span>
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] opacity-60" style={{ color: "var(--navy-foreground)" }}>{f.airline}</span>
          </div>
          <p className="mt-6 font-serif text-4xl font-black leading-none" style={{ color: "var(--navy-foreground)" }}>{f.from} → {f.to}</p>
          <p className="mt-2 text-2xl" dir="rtl" style={{ color: "var(--gold)" }}>{f.urdu}</p>
          <p className="mt-5 font-mono text-[11px] opacity-70" style={{ color: "var(--navy-foreground)" }}>{f.dep}</p>
          <p className="font-mono text-[11px] opacity-70" style={{ color: "var(--navy-foreground)" }}>{f.flight} · {f.bag} · {f.seats} seats</p>
          <div className="mt-7 flex items-center justify-between">
            <p className={`font-serif font-black ${f.fare.startsWith("PKR") ? "text-3xl" : "text-sm"}`} style={{ color: "var(--gold)" }}>{f.fare}</p>
            <button className="rounded-xl px-5 py-2.5 text-xs font-bold text-white" style={{ backgroundColor: "#25D366" }}>Book</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Page() {
  return (
    <PreviewFrame slug="tilt-cards">
      <div className="min-h-screen px-6 py-16 md:px-12" style={{ backgroundColor: "var(--navy)" }}>
        <div className="mx-auto max-w-6xl">
          <p className="text-[10px] font-bold uppercase tracking-[0.45em]" style={{ color: "var(--gold)" }}>Preview · 3D Tilt Cards</p>
          <h1 className="mt-3 font-serif text-5xl font-black" style={{ color: "var(--navy-foreground)" }}>Move Your Cursor Over a Fare</h1>
          <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {PREVIEW_FARES.map((f) => (
              <TiltCard key={f.flight} f={f} />
            ))}
          </div>
        </div>
      </div>
    </PreviewFrame>
  );
}
