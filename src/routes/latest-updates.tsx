import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Bell, Clock, MessageCircle, Search, Calendar } from "lucide-react";
import { getAnnouncement, getAnnouncementHistory } from "@/lib/fares.functions";
import { useState, useMemo } from "react";

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
  const [search, setSearch] = useState("");
  
  const { data: latest } = useQuery({
    queryKey: ["site-settings", "latest-update-toast"],
    queryFn: () => getAnnouncement(),
    staleTime: 5000,
    refetchInterval: 10000,
  });
  
  const { data: history = [] } = useQuery({
    queryKey: ["site-settings", "announcement-history"],
    queryFn: () => getAnnouncementHistory(),
    staleTime: 5000,
    refetchInterval: 10000,
  });

  const allUpdates = useMemo(() => {
    const list = [...history];
    
    // De-duplicate: Ensure we don't show the same update twice if it's both in latest and history
    if (!search.trim()) return list;
    
    const s = search.toLowerCase();
    return list.filter(item => 
      (item.text || "").toLowerCase().includes(s)
    );
  }, [history, search]);

  return (
    <main className="min-h-screen bg-[#FDFBF7] text-navy font-sans">
      {/* Hero Header */}
      <div className="bg-navy py-12 text-white">
        <div className="mx-auto max-w-6xl px-4">
          <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
            <Link
              to="/"
              className="inline-flex items-center gap-2 rounded-full border border-gold/40 bg-white/5 px-4 py-2 text-xs font-bold uppercase tracking-widest text-gold hover:bg-gold/10"
            >
              <ArrowLeft className="h-4 w-4" /> Back to Home
            </Link>
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gold/20 text-gold ring-1 ring-gold/40">
                <Bell className="h-5 w-5" />
              </span>
              <h1 className="font-serif text-3xl font-black uppercase tracking-tight sm:text-4xl">Latest Updates</h1>
            </div>
          </div>
          <p className="max-w-2xl text-lg text-white/70">
            Stay informed with the latest news and media from Rohi Travels
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-12">
        {/* Search Bar */}
        <div className="mb-10 flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="relative w-full max-w-md">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-navy/40" />
            <input
              type="text"
              placeholder="Search updates..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-12 w-full rounded-xl border border-navy/10 bg-white pl-11 pr-4 text-sm font-medium outline-none ring-gold/20 transition focus:border-gold focus:ring-4"
            />
          </div>
        </div>

        {/* Updates Grid */}
        {allUpdates.length > 0 ? (
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {allUpdates.map((item, idx) => (
              <article
                key={item.updatedAt || idx}
                className="group flex flex-col overflow-hidden rounded-2xl border border-navy/10 bg-white shadow-sm transition-all hover:border-gold/30 hover:shadow-xl hover:-translate-y-1"
              >
                {item.imageUrl ? (
                  <div className="relative aspect-video overflow-hidden bg-navy/5">
                    <img
                      src={item.imageUrl}
                      alt="Update"
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  </div>
                ) : null}
                
                <div className="flex flex-1 flex-col p-6">
                  <div className="mb-4 flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-navy/40">
                    <Calendar className="h-3.5 w-3.5" />
                    {fmt(item.updatedAt)}
                  </div>
                  
                  <h3 className="mb-4 font-serif text-xl font-black text-navy whitespace-pre-wrap">
                    {item.text || "New Update"}
                  </h3>
                  
                  <div className="mt-auto pt-6 border-t border-navy/5">
                    <a
                      href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
                        item.text ? `Re: ${item.text.slice(0, 140)}` : "Hi, I saw your latest update.",
                      )}`}
                      target="_blank"
                      rel="noopener"
                      className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.15em] text-gold hover:text-navy transition-colors"
                    >
                      Read More <span className="text-base">→</span>
                    </a>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="rounded-3xl border border-dashed border-navy/20 bg-white py-20 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-navy/5 text-navy/20">
              <Bell className="h-8 w-8" />
            </div>
            <p className="text-lg font-bold text-navy/40">No updates found.</p>
          </div>
        )}
      </div>
    </main>
  );
}