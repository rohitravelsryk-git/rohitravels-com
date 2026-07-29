import { createFileRoute } from "@tanstack/react-router";
import { PREVIEW_FARES } from "@/lib/preview-fares";
import { PreviewFrame } from "@/components/PreviewFrame";

export const Route = createFileRoute("/preview/bento")({
  component: Page,
  head: () => ({
    meta: [
      { title: "Bento Grid Glass Preview | Rohi International Travels" },
      { name: "description", content: "Design preview: asymmetric bento grid of frosted glass fare tiles with gold hairline borders." },
      { property: "og:title", content: "Bento Grid Glass Preview | Rohi International Travels" },
      { property: "og:description", content: "Asymmetric bento grid of frosted glass fare tiles with gold hairline borders." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

const glass = {
  borderColor: "color-mix(in oklab, var(--gold) 28%, transparent)",
  backgroundColor: "color-mix(in oklab, var(--navy-foreground) 6%, transparent)",
};

function Page() {
  const [a, b, c, d] = PREVIEW_FARES;
  return (
    <PreviewFrame slug="bento">
      <div className="relative min-h-screen overflow-hidden px-5 py-14 md:px-10" style={{ backgroundColor: "var(--navy)" }}>
        <div className="pointer-events-none absolute -left-32 top-10 h-[520px] w-[520px] rounded-full blur-[140px]" style={{ backgroundColor: "var(--gold)", opacity: 0.14 }} />
        <div className="pointer-events-none absolute -right-24 bottom-0 h-[460px] w-[460px] rounded-full blur-[130px]" style={{ backgroundColor: "oklch(0.5 0.12 240)", opacity: 0.3 }} />

        <div className="relative mx-auto max-w-6xl">
          <p className="text-[10px] font-bold uppercase tracking-[0.45em]" style={{ color: "var(--gold)" }}>Preview · Bento Glass</p>
          <h1 className="mt-3 font-serif text-5xl font-black md:text-6xl" style={{ color: "var(--navy-foreground)" }}>Live Fare Bento</h1>

          <div className="mt-10 grid auto-rows-[minmax(150px,auto)] grid-cols-2 gap-4 lg:grid-cols-4">
            {/* hero tile */}
            <div className="col-span-2 row-span-2 flex flex-col justify-between rounded-3xl border p-8 backdrop-blur-2xl" style={glass}>
              <div className="flex items-center justify-between">
                <span className="rounded-full px-3 py-1 text-[9px] font-bold uppercase tracking-[0.24em]" style={{ backgroundColor: "var(--gold)", color: "var(--gold-foreground)" }}>{a.group}</span>
                <span className="text-2xl" dir="rtl" style={{ color: "var(--gold)" }}>{a.urdu}</span>
              </div>
              <div className="mt-8">
                <p className="font-serif text-6xl font-black leading-none" style={{ color: "var(--navy-foreground)" }}>{a.fromCity}</p>
                <p className="font-serif text-6xl font-black leading-none" style={{ color: "var(--gold)" }}>→ {a.toCity}</p>
                <p className="mt-5 font-mono text-xs opacity-70" style={{ color: "var(--navy-foreground)" }}>{a.dep} · {a.flight} · {a.bag}</p>
              </div>
              <button className="mt-8 w-fit rounded-xl px-7 py-3.5 text-sm font-bold text-white transition-transform hover:scale-105" style={{ backgroundColor: "#25D366" }}>Book on WhatsApp</button>
            </div>

            {/* fare tile */}
            <div className="col-span-2 rounded-3xl border p-7 backdrop-blur-2xl lg:col-span-2" style={glass}>
              <p className="text-[10px] font-bold uppercase tracking-[0.3em] opacity-60" style={{ color: "var(--navy-foreground)" }}>Group Fare</p>
              <p className="mt-2 font-serif text-5xl font-black" style={{ color: "var(--gold)" }}>{a.fare}</p>
              <p className="mt-2 text-xs opacity-60" style={{ color: "var(--navy-foreground)" }}>{a.seats} seats remaining</p>
            </div>

            {/* stat tiles */}
            <div className="rounded-3xl border p-6 backdrop-blur-2xl" style={glass}>
              <p className="font-serif text-4xl font-black" style={{ color: "var(--navy-foreground)" }}>34</p>
              <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.24em]" style={{ color: "var(--gold)" }}>Years</p>
            </div>
            <div className="rounded-3xl border p-6 backdrop-blur-2xl" style={glass}>
              <p className="font-serif text-4xl font-black" style={{ color: "var(--navy-foreground)" }}>06</p>
              <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.24em]" style={{ color: "var(--gold)" }}>Live routes</p>
            </div>

            {/* small fare tiles */}
            {[b, c, d].map((f) => (
              <div key={f.flight} className="rounded-3xl border p-6 backdrop-blur-2xl transition-transform hover:-translate-y-1" style={glass}>
                <p className="text-[9px] font-bold uppercase tracking-[0.24em]" style={{ color: "var(--gold)" }}>{f.group}</p>
                <p className="mt-2 font-serif text-2xl font-black" style={{ color: "var(--navy-foreground)" }}>{f.from} → {f.to}</p>
                <p className="text-lg" dir="rtl" style={{ color: "var(--gold)" }}>{f.urdu}</p>
                <p className={`mt-4 font-bold ${f.fare.startsWith("PKR") ? "text-xl" : "text-[11px]"}`} style={{ color: "var(--gold)" }}>{f.fare}</p>
              </div>
            ))}

            <div className="rounded-3xl border p-6 backdrop-blur-2xl" style={{ ...glass, backgroundColor: "#25D366" }}>
              <p className="font-serif text-2xl font-black text-white">Need a custom group?</p>
              <p className="mt-2 text-xs text-white/80">0305 6622988</p>
            </div>
          </div>
        </div>
      </div>
    </PreviewFrame>
  );
}
