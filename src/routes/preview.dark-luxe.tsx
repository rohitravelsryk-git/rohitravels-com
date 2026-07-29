import { createFileRoute } from "@tanstack/react-router";
import { PREVIEW_FARES } from "@/lib/preview-fares";
import { PreviewFrame } from "@/components/PreviewFrame";

export const Route = createFileRoute("/preview/dark-luxe")({
  component: Page,
  head: () => ({
    meta: [
      { title: "Dark Luxe Editorial Preview | Rohi International Travels" },
      { name: "description", content: "Design preview: dark luxe editorial layout with grain texture, magazine whitespace and Nastaliq accents." },
      { property: "og:title", content: "Dark Luxe Editorial Preview | Rohi International Travels" },
      { property: "og:description", content: "Dark luxe editorial layout with grain texture, magazine whitespace and Nastaliq accents." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function Page() {
  const [lead, ...rest] = PREVIEW_FARES;
  return (
    <PreviewFrame slug="dark-luxe">
      <div className="relative min-h-screen px-6 py-20 md:px-16" style={{ backgroundColor: "var(--navy)" }}>
        {/* grain */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.16] mix-blend-overlay"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'><filter id='n'><feTurbulence baseFrequency='0.85' numOctaves='3'/></filter><rect width='120' height='120' filter='url(%23n)' opacity='0.5'/></svg>\")",
          }}
        />

        <div className="relative mx-auto max-w-5xl">
          <header className="flex items-baseline justify-between border-b pb-6" style={{ borderColor: "color-mix(in oklab, var(--gold) 30%, transparent)" }}>
            <p className="font-serif text-xl font-bold italic" style={{ color: "var(--navy-foreground)" }}>Rohi International</p>
            <p className="text-[10px] font-bold uppercase tracking-[0.4em]" style={{ color: "var(--gold)" }}>Vol. 34 · Group Fares</p>
          </header>

          <h1
            className="mt-16 font-serif font-black leading-[0.88]"
            style={{ color: "var(--navy-foreground)", fontSize: "clamp(3rem, 8vw, 7rem)" }}
          >
            The Season of
            <br />
            <em className="font-light italic" style={{ color: "var(--gold)" }}>Departures</em>
          </h1>

          <div className="mt-14 grid gap-14 md:grid-cols-[1.4fr_1fr]">
            <article>
              <p className="text-[10px] font-bold uppercase tracking-[0.4em]" style={{ color: "var(--gold)" }}>Feature · {lead.group}</p>
              <h2 className="mt-4 font-serif text-5xl font-black leading-tight" style={{ color: "var(--navy-foreground)" }}>
                {lead.fromCity} to {lead.toCity}
              </h2>
              <p className="mt-3 text-3xl" dir="rtl" style={{ color: "var(--gold)" }}>{lead.urdu}</p>
              <p className="mt-8 max-w-lg text-sm leading-relaxed opacity-75" style={{ color: "var(--navy-foreground)" }}>
                <span className="float-left mr-3 font-serif text-6xl leading-[0.75] font-black" style={{ color: "var(--gold)" }}>A</span>
                confirmed block of {lead.seats} seats on {lead.airline}, departing {lead.dep}. Baggage {lead.bag}. Group documentation, visa handling and ticketing managed end to end by our Karachi desk — the way it has been done since 1991.
              </p>
              <div className="mt-10 flex items-center gap-6">
                <p className="font-serif text-4xl font-black" style={{ color: "var(--gold)" }}>{lead.fare}</p>
                <button className="rounded-none border-b-2 pb-1 text-xs font-bold uppercase tracking-[0.3em]" style={{ borderColor: "#25D366", color: "#25D366" }}>
                  Enquire on WhatsApp
                </button>
              </div>
            </article>

            <aside className="space-y-8 border-l pl-8" style={{ borderColor: "color-mix(in oklab, var(--gold) 25%, transparent)" }}>
              <p className="text-[10px] font-bold uppercase tracking-[0.4em]" style={{ color: "var(--gold)" }}>Also Departing</p>
              {rest.slice(0, 4).map((f) => (
                <div key={f.flight}>
                  <p className="font-serif text-xl font-bold" style={{ color: "var(--navy-foreground)" }}>{f.fromCity} — {f.toCity}</p>
                  <p className="text-lg" dir="rtl" style={{ color: "var(--gold)" }}>{f.urdu}</p>
                  <p className="mt-1 font-mono text-[10px] opacity-60" style={{ color: "var(--navy-foreground)" }}>{f.dep}</p>
                  <p className={`mt-1 font-bold ${f.fare.startsWith("PKR") ? "text-lg" : "text-[10px]"}`} style={{ color: "var(--gold)" }}>{f.fare}</p>
                </div>
              ))}
            </aside>
          </div>
        </div>
      </div>
    </PreviewFrame>
  );
}
