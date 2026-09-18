import { createFileRoute } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import { LatestUpdatesFeed } from "@/components/LatestUpdatesFeed";

export const Route = createFileRoute("/_agentapp/agent/latest-updates")({
  head: () => ({
    meta: [
      { title: "Latest Updates | B2B Agent Portal | Rohi International Travels" },
      {
        name: "description",
        content:
          "Group fare announcements, seat availability and notices for Rohi International Travels B2B agents.",
      },
      { property: "og:title", content: "Latest Updates | B2B Agent Portal" },
      {
        property: "og:description",
        content: "Live group fare announcements and seat availability updates for agents.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AgentLatestUpdates,
});

function AgentLatestUpdates() {
  return (
    <div className="animate-premium-fade">
      <div className="mb-6 rounded-2xl bg-navy px-5 py-6 text-white">
        <div className="flex items-center gap-3 text-gold">
          <Bell className="h-5 w-5" />
          <span className="text-[11px] font-bold uppercase tracking-[0.3em]">Updates &amp; News</span>
        </div>
        <h1 className="mt-2 font-serif text-3xl font-black md:text-4xl">Latest Updates</h1>
        <p className="mt-2 max-w-2xl text-sm text-white/80">
          Latest group fares, seat availability and notices from Rohi Travels.
        </p>
      </div>

      <LatestUpdatesFeed compact />
    </div>
  );
}
