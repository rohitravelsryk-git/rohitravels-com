import { createFileRoute } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import { LatestUpdatesFeed } from "@/components/LatestUpdatesFeed";

export const Route = createFileRoute("/latest-updates")({
  head: () => ({
    meta: [
      { title: "Latest Updates | Rohi International Travels" },
      {
        name: "description",
        content:
          "All the latest group fare updates, seat availability and announcements from Rohi International Travels.",
      },
      { property: "og:title", content: "Latest Updates | Rohi International Travels" },
      {
        property: "og:description",
        content: "Live group fare announcements and seat availability updates.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: UpdatesPage,
});

function UpdatesPage() {
  return (
    <main className="min-h-screen bg-background text-navy font-sans relative animate-premium-fade">
      {/* Hero Header */}
      <div className="bg-navy py-14 text-white mt-[-1px]">
        <div className="mx-auto max-w-6xl px-4">
          <div className="flex items-center gap-3 text-gold">
            <Bell className="h-6 w-6" />
            <span className="text-xs font-bold uppercase tracking-[0.3em]">Updates &amp; News</span>
          </div>
          <h1 className="mt-3 font-sans text-4xl font-black md:text-5xl">Latest Updates</h1>
          <p className="mt-3 max-w-2xl text-white/80">
            Stay informed with the latest news and media from Rohi Travels
          </p>
        </div>
      </div>

      <LatestUpdatesFeed />
    </main>
  );
}
