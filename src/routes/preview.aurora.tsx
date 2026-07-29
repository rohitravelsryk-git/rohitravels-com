import { createFileRoute } from "@tanstack/react-router";
import { PREVIEW_FARES } from "@/lib/preview-fares";
import { PreviewFrame } from "@/components/PreviewFrame";

export const Route = createFileRoute("/preview/aurora")({
  component: Page,
  head: () => ({
    meta: [
      { title: "Aurora Gradient Mesh Preview | Rohi International Travels" },
      { name: "description", content: "Design preview: slow-moving gold aurora light blooms behind a navy hero with live group fares." },
      { property: "og:title", content: "Aurora Gradient Mesh Preview | Rohi International Travels" },
      { property: "og:description", content: "Slow-moving gold aurora light blooms behind a navy hero with live group fares." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function Page() {
  return (
    <PreviewFrame slug="aurora">
      <div className="relative min-h-screen overflow-hidden px-6 py-20 md:px-12" style={{ backgroundColor: "var(--navy)" }}>
        <style>{`
          @keyframes drift1 { 0%,100% { transform: translate3d(-8%, -6%, 0) scale(1) } 50% { transform: translate3d(12%, 8%, 0) scale(1.25) } }
          @keyframes drift2 { 0%,100% { transform: translate3d(10%, 12%, 0) scale(1.15) } 50% { transform: translate3d(-12%, -8%, 0) scale(0.95) } }
          @keyframes drift3 { 0%,100% { transform: translate3d(4%, 14%, 0) scale(1) } 50% { transform: translate3d(-6%, -12%, 0) scale(1.3) } }
        `}</style>

        <div className="pointer-events-none absolute left-[10%] top-[5%] h-[620px] w-[620px] rounded-full blur-[150px]" style={{ backgroundColor: "var(--gold)", opacity: 0.22, animation: "drift1 18s ease-in-out infinite" }} />
        <div className="pointer-events-none absolute right-[5%] top-[25%] h-[540px] w-[540px] rounded-full blur-[150px]" style={{ backgroundColor: "oklch(0.55 0.14 250)", opacity: 0.45, animation: "drift2 24s ease-in-out infinite" }} />
        <div className="pointer-events-none absolute bottom-[0%] left-[35%] h-[500px] w-[500px] rounded-full blur-[160px]" style={{ backgroundColor: "oklch(0.6 0.13 165)", opacity: 0.28, animation: "drift3 21s ease-in-out infinite" }} />

        <div className="relative mx-auto max-w-6xl">
          <p className="text-[10px] font-bold uppercase tracking-[0.45em]" style={{ color: "var(--gold)" }}>Preview · Aurora Gradient Mesh</p>
          <h1 className="mt-6 max-w-3xl font-serif font-black leading-[0.9]" style={{ color: "var(--navy-foreground)", fontSize: "clamp(3rem, 8vw, 6.5rem)" }}>
            Light Up Your <span style={{ color: "var(--gold)" }}>Next Journey</span>
          </h1>
          <p className="mt-6 max-w-xl text-sm opacity-75" style={{ color: "var(--navy-foreground)" }}>
            Confirmed group blocks on Air Arabia, Flyadeal, Salam Air and Flynas — released and updated live from our Karachi desk.
          </p>

          <div className="mt-10 flex flex-wrap gap-4">
            <button className="rounded-xl px-8 py-4 text-sm font-bold text-white transition-transform hover:scale-105" style={{ backgroundColor: "#25D366" }}>Book on WhatsApp</button>
            <button className="rounded-xl border px-8 py-4 text-sm font-bold backdrop-blur-xl" style={{ borderColor: "var(--gold)", color: "var(--gold)" }}>Agent Login</button>
          </div>

          <div className="mt-16 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {PREVIEW_FARES.map((f) => (
              <div key={f.flight} className="rounded-3xl border p-7 backdrop-blur-2xl transition-transform hover:-translate-y-1" style={{ borderColor: "rgba(255,255,255,0.12)", backgroundColor: "rgba(255,255,255,0.07)" }}>
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-bold uppercase tracking-[0.26em]" style={{ color: "var(--gold)" }}>{f.group}</span>
                  <span className="text-[10px] opacity-60" style={{ color: "var(--navy-foreground)" }}>{f.seats} seats</span>
                </div>
                <p className="mt-4 font-serif text-3xl font-black" style={{ color: "var(--navy-foreground)" }}>{f.from} → {f.to}</p>
                <p className="text-xl" dir="rtl" style={{ color: "var(--gold)" }}>{f.urdu}</p>
                <p className="mt-4 font-mono text-[11px] opacity-65" style={{ color: "var(--navy-foreground)" }}>{f.dep} · {f.bag}</p>
                <p className={`mt-4 font-serif font-black ${f.fare.startsWith("PKR") ? "text-2xl" : "text-sm"}`} style={{ color: "var(--gold)" }}>{f.fare}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </PreviewFrame>
  );
}
