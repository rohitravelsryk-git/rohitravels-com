import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/testing")({
  head: () => ({
    meta: [
      { title: "B2B Agents Portal | Rohi International Travels" },
      { name: "description", content: "ROHI International Travels B2B Agents Portal promo." },
      { property: "og:title", content: "B2B Agents Portal | Rohi International Travels" },
      { property: "og:description", content: "ROHI International Travels B2B Agents Portal promo." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TestingPage,
});

function TestingPage() {
  return (
    <iframe
      src="/rohi-promo.html"
      title="ROHI B2B Agents Portal Promo"
      className="fixed inset-0 h-screen w-screen border-0"
      style={{ top: 0, left: 0 }}
    />
  );
}
