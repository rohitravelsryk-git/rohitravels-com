import { createFileRoute, Link } from "@tanstack/react-router";
import { PREVIEW_TEMPLATES } from "@/lib/preview-fares";

export const Route = createFileRoute("/preview/")({
  component: PreviewIndex,
  head: () => ({
    meta: [
      { title: "Design Template Previews | Rohi International Travels" },
      { name: "description", content: "Browse ten premium motion-graphic homepage design templates for Rohi International Travels live group fares." },
      { property: "og:title", content: "Design Template Previews | Rohi International Travels" },
      { property: "og:description", content: "Ten premium motion-graphic homepage design directions for live group fares." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function PreviewIndex() {
  return (
    <div className="min-h-screen px-6 py-16 md:px-12" style={{ backgroundColor: "var(--navy)" }}>
      <div className="mx-auto max-w-6xl">
        <p className="text-[10px] font-bold uppercase tracking-[0.45em]" style={{ color: "var(--gold)" }}>
          Rohi International Travels · Design Lab
        </p>
        <h1 className="mt-3 font-serif text-5xl font-black md:text-6xl" style={{ color: "var(--navy-foreground)" }}>
          Ten Premium Templates
        </h1>
        <p className="mt-4 max-w-2xl text-sm opacity-70" style={{ color: "var(--navy-foreground)" }}>
          Each card opens a live, animated preview. None of these change your existing site — pick the one you want and I&apos;ll build it into the homepage.
        </p>

        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {PREVIEW_TEMPLATES.map((t) => (
            <Link
              key={t.slug}
              to={`/preview/${t.slug}` as string}
              className="group relative overflow-hidden rounded-2xl border p-7 transition-all hover:-translate-y-1"
              style={{
                borderColor: "color-mix(in oklab, var(--gold) 25%, transparent)",
                backgroundColor: "color-mix(in oklab, var(--navy-foreground) 5%, transparent)",
              }}
            >
              <span
                className="absolute -right-3 -top-5 font-serif text-7xl font-black opacity-10 transition-opacity group-hover:opacity-25"
                style={{ color: "var(--gold)" }}
              >
                {String(t.n).padStart(2, "0")}
              </span>
              <h2 className="font-serif text-2xl font-bold" style={{ color: "var(--navy-foreground)" }}>
                {t.name}
              </h2>
              <p className="mt-3 text-xs leading-relaxed opacity-65" style={{ color: "var(--navy-foreground)" }}>
                {t.desc}
              </p>
              <span
                className="mt-6 inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.28em]"
                style={{ color: "var(--gold)" }}
              >
                Open preview <span className="transition-transform group-hover:translate-x-1">→</span>
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
