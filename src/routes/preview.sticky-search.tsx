import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PREVIEW_FARES } from "@/lib/preview-fares";
import { PreviewFrame } from "@/components/PreviewFrame";

export const Route = createFileRoute("/preview/sticky-search")({
  component: Page,
  head: () => ({
    meta: [
      { title: "Sticky Search Morph Preview | Rohi International Travels" },
      { name: "description", content: "Design preview: hero search bar that morphs into a floating gold pill as the page scrolls." },
      { property: "og:title", content: "Sticky Search Morph Preview | Rohi International Travels" },
      { property: "og:description", content: "Hero search bar that morphs into a floating gold pill as the page scrolls." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function Page() {
  const [y, setY] = useState(0);
  useEffect(() => {
    const on = () => setY(window.scrollY);
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);

  const p = Math.min(1, y / 320);
  const shrunk = p > 0.6;

  return (
    <PreviewFrame slug="sticky-search">
      <div className="min-h-[240vh]" style={{ backgroundColor: "var(--navy)" }}>
        {/* morphing search */}
        <div className="fixed inset-x-0 top-0 z-40 flex justify-center px-6 pt-6">
          <div
            className="flex items-center gap-4 border backdrop-blur-2xl transition-all duration-300 ease-out"
            style={{
              width: shrunk ? "auto" : "min(100%, 62rem)",
              borderRadius: shrunk ? "999px" : "1.25rem",
              padding: shrunk ? "0.6rem 0.9rem" : "1rem 1.25rem",
              borderColor: "color-mix(in oklab, var(--gold) 40%, transparent)",
              backgroundColor: shrunk ? "var(--gold)" : "color-mix(in oklab, var(--navy) 70%, transparent)",
              boxShadow: shrunk ? "0 18px 40px -18px rgba(0,0,0,0.8)" : "none",
            }}
          >
            {shrunk ? (
              <span className="flex items-center gap-3 px-3 text-xs font-bold uppercase tracking-[0.25em]" style={{ color: "var(--gold-foreground)" }}>
                🔍 KHI → JED · 07 AUG
              </span>
            ) : (
              <>
                <Field label="Origin" value="Karachi (KHI)" />
                <Divider />
                <Field label="Destination" value="Jeddah (JED)" />
                <Divider />
                <Field label="Travel Date" value="07 Aug 2026" />
                <button className="ml-auto rounded-xl px-8 py-3.5 text-xs font-bold uppercase tracking-[0.2em]" style={{ backgroundColor: "var(--gold)", color: "var(--gold-foreground)" }}>
                  Search Fares
                </button>
              </>
            )}
          </div>
        </div>

        <section className="flex h-screen flex-col items-center justify-center px-8 text-center">
          <p className="text-[10px] font-bold uppercase tracking-[0.45em]" style={{ color: "var(--gold)" }}>Preview · Sticky Search Morph</p>
          <h1 className="mt-6 font-serif font-black leading-[0.9]" style={{ color: "var(--navy-foreground)", fontSize: "clamp(3rem, 9vw, 7rem)" }}>
            Search Once.
            <br />
            <span style={{ color: "var(--gold)" }}>Book Anywhere.</span>
          </h1>
          <p className="mt-8 text-xs uppercase tracking-[0.4em] opacity-60" style={{ color: "var(--navy-foreground)" }}>Scroll to watch the bar morph ↓</p>
        </section>

        <section className="mx-auto max-w-5xl px-8 pb-32">
          <div className="space-y-4">
            {PREVIEW_FARES.map((f) => (
              <div key={f.flight} className="flex flex-wrap items-center justify-between gap-6 rounded-2xl border p-6" style={{ borderColor: "color-mix(in oklab, var(--gold) 22%, transparent)", backgroundColor: "rgba(255,255,255,0.04)" }}>
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-[0.3em]" style={{ color: "var(--gold)" }}>{f.group} · {f.airline}</p>
                  <p className="mt-1 font-serif text-2xl font-black" style={{ color: "var(--navy-foreground)" }}>{f.fromCity} → {f.toCity}</p>
                  <p className="text-lg" dir="rtl" style={{ color: "var(--gold)" }}>{f.urdu}</p>
                </div>
                <p className="font-mono text-[11px] opacity-70" style={{ color: "var(--navy-foreground)" }}>{f.dep}<br />{f.flight} · {f.bag}</p>
                <p className={`font-serif font-black ${f.fare.startsWith("PKR") ? "text-2xl" : "text-xs"}`} style={{ color: "var(--gold)" }}>{f.fare}</p>
                <button className="rounded-xl px-6 py-3 text-xs font-bold text-white" style={{ backgroundColor: "#25D366" }}>Book on WhatsApp</button>
              </div>
            ))}
          </div>
        </section>
      </div>
    </PreviewFrame>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex-1 px-4">
      <p className="text-[9px] font-bold uppercase tracking-[0.3em]" style={{ color: "var(--gold)" }}>{label}</p>
      <p className="mt-0.5 text-sm font-semibold" style={{ color: "var(--navy-foreground)" }}>{value}</p>
    </div>
  );
}

function Divider() {
  return <span className="h-9 w-px" style={{ backgroundColor: "color-mix(in oklab, var(--gold) 30%, transparent)" }} />;
}
