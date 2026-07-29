import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Bell, Clock, MessageCircle } from "lucide-react";
import { getAnnouncement, getAnnouncementHistory } from "@/lib/fares.functions";

export const Route = createFileRoute("/updates")({
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

const WHATSAPP_NUMBER = "923056622988";

function fmt(d: string) {
  if (!d) return "";
  try {
    return new Date(d).toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return d;
  }
}

function UpdatesPage() {
  const { data: latest } = useQuery({
    queryKey: ["site-settings", "announcement"],
    queryFn: () => getAnnouncement(),
    staleTime: 30_000,
  });
  const { data: history = [] } = useQuery({
    queryKey: ["site-settings", "announcement-history"],
    queryFn: () => getAnnouncementHistory(),
    staleTime: 30_000,
  });

  const top = latest?.text || latest?.imageUrl ? latest : history[0];
  const previous = history.filter((h) => h.updatedAt !== top?.updatedAt);

  return (
    <main className="min-h-screen bg-navy text-white">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6 flex items-center gap-3">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 rounded-full border border-gold/40 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-gold hover:bg-gold/10"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Home
          </Link>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#25D366] px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-white">
            <Bell className="h-3.5 w-3.5" /> Latest Updates
          </span>
        </div>

        <h1 className="mb-6 font-serif text-3xl font-bold text-gold sm:text-4xl">Latest Updates</h1>

        {/* Featured / most recent — e-commerce product style */}
        {top ? (
          <section className="overflow-hidden rounded-2xl bg-white text-gray-900 shadow-2xl ring-1 ring-black/10">
            <div className="grid gap-0 md:grid-cols-2">
              <div className="bg-gray-50">
                {top.imageUrl ? (
                  <img
                    src={top.imageUrl}
                    alt="Most recent update from Rohi International Travels"
                    className="h-full max-h-[520px] w-full object-contain p-4"
                  />
                ) : (
                  <div className="flex h-64 items-center justify-center text-gray-400">
                    <Bell className="h-16 w-16" />
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-4 p-6 sm:p-8">
                <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-[#25D366]/15 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-[#128C7E]">
                  Most Recent
                </span>
                <p className="whitespace-pre-line text-lg font-semibold leading-relaxed sm:text-xl">
                  {top.text || "New update available"}
                </p>
                <p className="inline-flex items-center gap-1.5 text-xs text-gray-500">
                  <Clock className="h-3.5 w-3.5" /> {fmt(top.updatedAt)}
                </p>
                <a
                  href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
                    top.text ? `Re: ${top.text.slice(0, 140)}` : "Hi, I saw your latest update.",
                  )}`}
                  target="_blank"
                  rel="noopener"
                  className="mt-2 inline-flex w-fit items-center gap-2 rounded-full bg-[#25D366] px-5 py-3 text-sm font-bold uppercase tracking-wide text-white hover:brightness-110"
                >
                  <MessageCircle className="h-4 w-4" /> Enquire on WhatsApp
                </a>
              </div>
            </div>
          </section>
        ) : (
          <p className="rounded-xl border border-gold/30 bg-white/5 p-8 text-center text-white/70">
            No updates posted yet.
          </p>
        )}

        {/* Previous updates — product grid */}
        {previous.length > 0 && (
          <section className="mt-12">
            <h2 className="mb-4 font-serif text-xl font-bold text-gold">Previous Updates</h2>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {previous.map((item) => (
                <article
                  key={item.updatedAt}
                  className="overflow-hidden rounded-xl bg-white text-gray-900 shadow-lg ring-1 ring-black/10 transition hover:-translate-y-1 hover:shadow-2xl"
                >
                  {item.imageUrl ? (
                    <img
                      src={item.imageUrl}
                      alt="Previous update from Rohi International Travels"
                      className="h-44 w-full bg-gray-50 object-cover"
                    />
                  ) : (
                    <div className="flex h-44 items-center justify-center bg-gray-100 text-gray-400">
                      <Bell className="h-10 w-10" />
                    </div>
                  )}
                  <div className="p-4">
                    <p className="line-clamp-3 text-sm font-semibold uppercase leading-snug text-navy">
                      {item.text || "Update"}
                    </p>
                    <p className="mt-2 inline-flex items-center gap-1.5 text-[11px] text-gray-500">
                      <Clock className="h-3 w-3" /> {fmt(item.updatedAt)}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
