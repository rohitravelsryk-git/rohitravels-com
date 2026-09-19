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
      <h1 className="mb-4 flex items-center gap-2 text-xl font-semibold text-gray-800">
        <Bell className="h-5 w-5 text-navy" /> Latest Updates
      </h1>

      <LatestUpdatesFeed compact />
    </div>
  );
}
