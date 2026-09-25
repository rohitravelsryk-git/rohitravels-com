import { createFileRoute } from "@tanstack/react-router";
import { queryOptions } from "@tanstack/react-query";
import { Calculator as CalcIcon } from "lucide-react";
import { getCalculatorsContent } from "@/lib/calculators.functions";
import { CalculatorsBoard, calculatorsQueryKey, useCalculatorsContent } from "@/components/CalculatorsBoard";

export const calculatorsContentOptions = queryOptions({
  queryKey: calculatorsQueryKey,
  queryFn: () => getCalculatorsContent(),
});

export const Route = createFileRoute("/calculators")({
  head: () => ({
    meta: [
      { title: "Date Calculator — Rohi International Travels" },
      { name: "description", content: "Add/subtract days, calculate age or duration, and count days between two dates." },
      { property: "og:title", content: "Date Calculator — Rohi International Travels" },
      { property: "og:description", content: "Handy date tools for travel agents: add/subtract days, age & duration, day counter." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://rohitravels.com/calculators" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://rohitravels.com/calculators" }],
  }),
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(calculatorsContentOptions);
  },
  component: CalculatorPage,
});

/**
 * Public shell for the Calculators page. The wording, tool names, order and
 * visibility all come from the admin panel's Calculators tab, so this route
 * renders whatever the admin currently has published.
 */
function CalculatorPage() {
  const content = useCalculatorsContent();
  if (!content) return <div className="min-h-screen bg-background" />;

  return (
    <div className="min-h-screen bg-background text-navy animate-premium-fade">
      <section className="bg-navy text-navy-foreground">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:py-14">
          <div className="flex items-center gap-3 text-gold">
            <CalcIcon className="h-5 w-5" aria-hidden="true" />
            <span className="text-xs font-bold uppercase tracking-[0.3em]">{content.eyebrow}</span>
          </div>
          <h1 className="mt-3 font-sans text-4xl font-black sm:text-5xl">{content.title}</h1>
          {content.intro && (
            <p className="mt-3 max-w-2xl text-sm text-navy-foreground/75 sm:text-base">{content.intro}</p>
          )}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-10 sm:py-14">
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gold/15 text-navy">
            <CalcIcon className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-sans text-2xl font-black text-navy">{content.heading}</h2>
            {content.subheading && <p className="text-sm text-muted-foreground">{content.subheading}</p>}
          </div>
        </div>

        <CalculatorsBoard content={content} />
      </section>
    </div>
  );
}
