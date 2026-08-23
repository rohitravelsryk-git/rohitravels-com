import { createFileRoute } from "@tanstack/react-router";
import { PreviewFrame } from "@/components/PreviewFrame";
import { useEffect, useRef, useState } from "react";

export const Route = createFileRoute("/preview/scroll-story")({
  component: ScrollStoryPreview,
  head: () => ({
    meta: [
      { title: "Scroll-Snap Story Preview | Rohi International Travels" },
      {
        name: "description",
        content:
          "Design preview: full-height scroll-snapping destination story sections with cinematic reveals for Rohi International Travels group fares.",
      },
      { property: "og:title", content: "Scroll-Snap Story Preview | Rohi International Travels" },
      {
        property: "og:description",
        content:
          "Design preview of full-height scroll-snapping destination story sections for live group fares.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

type Story = {
  code: string;
  city: string;
  urdu: string;
  kicker: string;
  route: string;
  fare: string;
  detail: string;
  baggage: string;
  tint: string;
};

const STORIES: Story[] = [
  {
    code: "JED",
    city: "Jeddah",
    urdu: "کراچی جدہ",
    kicker: "Umrah Group Special",
    route: "KHI → JED",
    fare: "FARE ON WHATSAPP",
    detail: "07 AUG · KHI JED 0800 1005 · Direct",
    baggage: "25 + 7 KG",
    tint: "oklch(0.55 0.13 165)",
  },
  {
    code: "ELQ",
    city: "Qassim",
    urdu: "کراچی قصیم",
    kicker: "Weekly Group Allocation",
    route: "KHI → ELQ",
    fare: "PKR 148,500",
    detail: "11 AUG · KHI SHJ 1045 1205 · SHJ ELQ 1530 1630",
    baggage: "20 + 10 KG",
    tint: "oklch(0.62 0.15 55)",
  },
  {
    code: "DXB",
    city: "Dubai",
    urdu: "کراچی دبئی",
    kicker: "Corporate Partner Rate",
    route: "KHI → DXB",
    fare: "PKR 92,000",
    detail: "14 AUG · KHI DXB 0230 0430 · Direct",
    baggage: "30 KG",
    tint: "oklch(0.58 0.12 240)",
  },
  {
    code: "RUH",
    city: "Riyadh",
    urdu: "لاہور ریاض",
    kicker: "Labour Group Fare",
    route: "LHE → RUH",
    fare: "FARE ON WHATSAPP",
    detail: "19 AUG · LHE RUH 1400 1640 · Direct",
    baggage: "20 + 10 KG",
    tint: "oklch(0.56 0.14 20)",
  },
];

function StorySection({ story, index }: { story: Story; index: number }) {
  const ref = useRef<HTMLElement | null>(null);
  const [active, setActive] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => setActive(entry.intersectionRatio > 0.55),
      { threshold: [0, 0.55, 1] },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <section
      ref={ref}
      id={`story-${story.code}`}
      className="relative flex h-screen snap-start snap-always items-center overflow-hidden"
      style={{ backgroundColor: "var(--navy)" }}
    >
      {/* cinematic backdrop */}
      <div
        className="absolute inset-0 transition-transform duration-[1800ms] ease-out"
        style={{
          transform: active ? "scale(1)" : "scale(1.14)",
          background: `radial-gradient(120% 90% at 78% 22%, ${story.tint} 0%, transparent 62%),
                       radial-gradient(90% 80% at 8% 92%, var(--gold) 0%, transparent 55%),
                       var(--navy)`,
          opacity: 0.9,
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(to right, color-mix(in oklab, var(--navy) 92%, transparent) 0%, color-mix(in oklab, var(--navy) 55%, transparent) 55%, transparent 100%)",
        }}
      />

      {/* giant ghost code */}
      <span
        className="pointer-events-none absolute right-[-2%] top-1/2 -translate-y-1/2 select-none font-serif font-black leading-none transition-all duration-1000"
        style={{
          fontSize: "clamp(9rem, 26vw, 24rem)",
          color: "var(--gold)",
          opacity: active ? 0.14 : 0,
          transform: `translateY(-50%) translateX(${active ? "0" : "6rem"})`,
        }}
      >
        {story.code}
      </span>

      <div className="relative z-10 mx-auto w-full max-w-6xl px-8">
        <div
          className="max-w-2xl transition-all duration-[900ms] ease-out"
          style={{
            opacity: active ? 1 : 0,
            transform: active ? "translateY(0)" : "translateY(2.5rem)",
          }}
        >
          <div className="mb-6 flex items-center gap-4">
            <span
              className="h-px w-14"
              style={{ backgroundColor: "var(--gold)" }}
            />
            <span
              className="text-[11px] font-bold uppercase tracking-[0.42em]"
              style={{ color: "var(--gold)" }}
            >
              {String(index + 1).padStart(2, "0")} · {story.kicker}
            </span>
          </div>

          <h2
            className="font-serif text-6xl font-black leading-[0.92] md:text-8xl"
            style={{ color: "var(--navy-foreground)" }}
          >
            {story.city}
          </h2>

          <p
            className="mt-4 text-3xl md:text-4xl"
            dir="rtl"
            style={{ color: "var(--gold)" }}
          >
            {story.urdu}
          </p>

          {/* animated route line */}
          <div className="mt-10 flex items-center gap-4">
            <span
              className="font-mono text-sm font-bold tracking-widest"
              style={{ color: "var(--navy-foreground)" }}
            >
              {story.route.split("→")[0].trim()}
            </span>
            <span className="relative h-px flex-1 overflow-hidden" style={{ backgroundColor: "color-mix(in oklab, var(--gold) 35%, transparent)" }}>
              <span
                className="absolute inset-y-0 left-0 transition-all duration-[1400ms] ease-out"
                style={{
                  width: active ? "100%" : "0%",
                  backgroundColor: "var(--gold)",
                }}
              />
            </span>
            <span
              aria-hidden
              className="transition-all duration-[1400ms] ease-out"
              style={{
                color: "var(--gold)",
                transform: active ? "translateX(0)" : "translateX(-3rem)",
                opacity: active ? 1 : 0,
              }}
            >
              ✈
            </span>
            <span
              className="font-mono text-sm font-bold tracking-widest"
              style={{ color: "var(--navy-foreground)" }}
            >
              {story.route.split("→")[1].trim()}
            </span>
          </div>

          {/* fare strip */}
          <div
            className="mt-10 inline-flex flex-wrap items-center gap-x-10 gap-y-5 rounded-2xl border px-8 py-6 backdrop-blur-xl"
            style={{
              borderColor: "color-mix(in oklab, var(--gold) 35%, transparent)",
              backgroundColor: "color-mix(in oklab, var(--navy) 55%, transparent)",
            }}
          >
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.3em] opacity-60" style={{ color: "var(--navy-foreground)" }}>
                Group Fare
              </p>
              <p
                className={`font-serif font-black ${story.fare.startsWith("PKR") ? "text-3xl" : "text-lg"}`}
                style={{ color: "var(--gold)" }}
              >
                {story.fare}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.3em] opacity-60" style={{ color: "var(--navy-foreground)" }}>
                Baggage
              </p>
              <p className="text-xl font-bold" style={{ color: "var(--navy-foreground)" }}>
                {story.baggage}
              </p>
            </div>
            <button
              className="rounded-xl px-7 py-3.5 text-sm font-bold text-white transition-transform hover:scale-105"
              style={{ backgroundColor: "#25D366" }}
            >
              Book on WhatsApp
            </button>
          </div>

          <p className="mt-6 font-mono text-xs tracking-wide opacity-70" style={{ color: "var(--navy-foreground)" }}>
            {story.detail}
          </p>
        </div>
      </div>
    </section>
  );
}

function ScrollStoryPreview() {
  const [current, setCurrent] = useState(0);
  const scrollerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const onScroll = () => {
      setCurrent(Math.round(el.scrollTop / el.clientHeight));
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  const go = (i: number) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTo({ top: i * el.clientHeight, behavior: "smooth" });
  };

  return (
    <PreviewFrame slug="scroll-story">
    <div className="relative h-screen w-full overflow-hidden" style={{ backgroundColor: "var(--navy)" }}>
      {/* header */}
      <header className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-center justify-between px-8 py-7">
        <div>
          <p className="font-serif text-lg font-bold" style={{ color: "var(--navy-foreground)" }}>
            Rohi International Travels
          </p>
          <p className="text-[10px] font-bold uppercase tracking-[0.35em]" style={{ color: "var(--gold)" }}>
            Preview · Scroll-Snap Story
          </p>
        </div>
        <span
          className="rounded-full border px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.3em]"
          style={{ borderColor: "var(--gold)", color: "var(--gold)" }}
        >
          Since 1991
        </span>
      </header>

      {/* dot nav */}
      <nav className="absolute right-8 top-1/2 z-30 flex -translate-y-1/2 flex-col items-end gap-5">
        {STORIES.map((s, i) => (
          <button
            key={s.code}
            onClick={() => go(i)}
            className="group flex items-center gap-3"
            aria-label={`Go to ${s.city}`}
          >
            <span
              className="font-mono text-[10px] font-bold tracking-widest transition-opacity"
              style={{
                color: "var(--gold)",
                opacity: current === i ? 1 : 0,
              }}
            >
              {s.code}
            </span>
            <span
              className="block rounded-full transition-all duration-500"
              style={{
                width: current === i ? "2.25rem" : "0.5rem",
                height: "0.5rem",
                backgroundColor: current === i ? "var(--gold)" : "color-mix(in oklab, var(--gold) 35%, transparent)",
              }}
            />
          </button>
        ))}
      </nav>

      {/* scroll hint */}
      <div
        className="pointer-events-none absolute bottom-7 left-1/2 z-30 -translate-x-1/2 text-[10px] font-bold uppercase tracking-[0.4em] transition-opacity"
        style={{ color: "var(--gold)", opacity: current === 0 ? 0.9 : 0 }}
      >
        Scroll ↓
      </div>

      <div
        ref={scrollerRef}
        className="h-screen snap-y snap-mandatory overflow-y-scroll scroll-smooth"
      >
        {STORIES.map((s, i) => (
          <StorySection key={s.code} story={s} index={i} />
        ))}
      </div>
    </div>
    </PreviewFrame>
  );
}
