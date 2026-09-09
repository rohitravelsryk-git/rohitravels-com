import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/testing")({
  head: () => ({
    meta: [
      { title: "Testing | Rohi International Travels" },
      { name: "description", content: "Testing page for Rohi International Travels." },
      { property: "og:title", content: "Testing | Rohi International Travels" },
      { property: "og:description", content: "Testing page for Rohi International Travels." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TestingPage,
});

function TestingPage() {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-7xl flex-col items-center justify-center px-4 py-16">
      <h1 className="font-serif text-3xl font-black uppercase tracking-wide text-navy">Testing</h1>
      <p className="mt-4 text-2xl font-bold tracking-[0.3em] text-gold">ABC12345</p>
    </main>
  );
}
