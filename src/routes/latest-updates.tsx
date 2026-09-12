import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Bell, Clock, MessageCircle, Search, Calendar, X } from "lucide-react";
import { getAnnouncementHistory } from "@/lib/fares.functions";
import { useState, useMemo, useEffect } from "react";

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
  const [selectedUpdate, setSelectedUpdate] = useState<any>(null);
  
  const { data: history = [], isLoading } = useQuery({
    queryKey: ["site-settings", "announcement-history"],
    queryFn: () => getAnnouncementHistory(),
    staleTime: 5000,
    refetchInterval: 10000,
  });

  const allUpdates = useMemo(() => {
    const list = [...history];
    
    if (!search.trim()) return list;
    
    const s = search.toLowerCase();
    return list.filter(item => 
      (item.text || "").toLowerCase().includes(s)
    );
  }, [history, search]);

  // Handle escape key to close modal
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelectedUpdate(null);
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, []);

  return (
    <main className="min-h-screen bg-background text-navy font-sans relative animate-premium-fade">
      {/* Hero Header */}
      <div className="bg-navy py-12 text-white mt-[-1px]">
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

        {isLoading ? (
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-64 animate-pulse rounded-2xl bg-navy/5" />
            ))}
          </div>
        ) : allUpdates.length > 0 ? (
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {allUpdates.map((item, idx) => (
              <article
                key={item.updatedAt || idx}
                onClick={() => setSelectedUpdate(item)}
                className="group flex cursor-pointer flex-col overflow-hidden rounded-2xl border border-navy/10 bg-white shadow-sm transition-all hover:border-gold/30 hover:shadow-xl hover:-translate-y-1"
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
                  
                  <h3 className="mb-4 line-clamp-3 font-serif text-xl font-black text-navy whitespace-pre-wrap">
                    {item.text || "New Update"}
                  </h3>
                  
                  <div className="mt-auto pt-6 border-t border-navy/5">
                    <span className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.15em] text-gold group-hover:text-navy transition-colors">
                      More Info <span className="text-base">→</span>
                    </span>
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

      {/* Detailed Full View Modal */}
      {selectedUpdate && (
        <div 
          className="fixed inset-0 z-[1000] flex items-center justify-center bg-navy/80 p-4 backdrop-blur-sm transition-opacity duration-300"
          onClick={() => setSelectedUpdate(null)}
        >
          <div 
            className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-3xl bg-[#FDFBF7] shadow-2xl transition-transform duration-300 scale-100"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              onClick={() => setSelectedUpdate(null)}
              className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/80 text-navy shadow-lg backdrop-blur hover:bg-white hover:text-gold transition-colors"
            >
              <X className="h-6 w-6" />
            </button>

            {/* Modal Content */}
            <div className="flex flex-col md:flex-row">
              {/* Image Column */}
              {selectedUpdate.imageUrl && (
                <div className="w-full bg-navy/5 md:w-1/2">
                  <img
                    src={selectedUpdate.imageUrl}
                    alt="Update Full View"
                    className="h-auto w-full object-cover md:h-full"
                  />
                </div>
              )}

              {/* Text Column */}
              <div className={`flex flex-1 flex-col p-8 md:p-12 ${selectedUpdate.imageUrl ? "md:w-1/2" : "w-full"}`}>
                <div className="mb-6 flex items-center gap-3 text-xs font-bold uppercase tracking-[0.2em] text-navy/40">
                  <Calendar className="h-4 w-4" />
                  {fmt(selectedUpdate.updatedAt)}
                </div>

                <h2 className="mb-8 font-serif text-3xl font-black leading-tight text-navy sm:text-4xl whitespace-pre-wrap">
                  {selectedUpdate.text || "Update Details"}
                </h2>

                <div className="mt-auto flex flex-col gap-6 pt-10 border-t border-navy/5">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-navy text-gold shadow-lg">
                      <Bell className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-navy uppercase tracking-widest">Rohi Travels</p>
                      <p className="text-[11px] text-navy/40 uppercase tracking-widest font-bold">Official Announcement</p>
                    </div>
                  </div>

                  <a
                    href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
                      selectedUpdate.text ? `Re: ${selectedUpdate.text.slice(0, 140)}` : "Hi, I saw your latest update.",
                    )}`}
                    target="_blank"
                    rel="noopener"
                    className="inline-flex w-full items-center justify-center gap-3 rounded-full bg-navy py-4 text-sm font-black uppercase tracking-[0.2em] text-gold shadow-xl hover:bg-navy/90 hover:scale-[1.02] active:scale-95 transition-all"
                  >
                    <MessageCircle className="h-5 w-5" />
                    More Info On WhatsApp
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
