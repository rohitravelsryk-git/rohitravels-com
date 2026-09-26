import { createFileRoute } from "@tanstack/react-router";
import { queryOptions } from "@tanstack/react-query";
import { getCalculatorsContent } from "@/lib/calculators.functions";
import { CalculatorsBoard, calculatorsQueryKey, useCalculatorsContent } from "@/components/CalculatorsBoard";

export const Route = createFileRoute("/_agentapp/agent/calculators")({
  head: () => ({
    meta: [
      { title: "Calculators — Rohi Agent Portal" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(
      queryOptions({ queryKey: calculatorsQueryKey, queryFn: () => getCalculatorsContent() }),
    );
  },
  component: AgentCalculatorsPage,
});

/**
 * B2B copy of the Calculators tools. It renders the same admin-authored content
 * as the public page — editing it in the admin panel updates both instantly.
 */
function AgentCalculatorsPage() {
  const content = useCalculatorsContent();
  if (!content) return <div className="p-5 text-sm text-gray-500">Loading…</div>;

  return (
    <div className="p-3 md:p-5 animate-premium-fade">
      <div className="mb-6">
        {content.eyebrow && <p className="text-[10px] font-black uppercase tracking-[0.3em] text-gold">{content.eyebrow}</p>}
        <h1 className="mt-1 text-xl font-semibold text-gray-800">{content.title}</h1>
        {content.intro && <p className="mt-1 text-sm text-gray-500">{content.intro}</p>}
      </div>

      <div className="rounded-xl border border-navy/10 bg-white p-4 shadow-md sm:p-6">
        {content.heading && <h2 className="mb-5 font-sans text-lg font-black text-navy">{content.heading}</h2>}
        <CalculatorsBoard content={content} />
      </div>
    </div>
  );
}
