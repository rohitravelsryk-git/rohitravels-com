import { useQuery } from "@tanstack/react-query";
import { Bell, MessageCircle, Search, Calendar, X } from "lucide-react";
import { getAnnouncementHistory } from "@/lib/fares.functions";
import { splitCaption } from "@/lib/update-caption";
import { formatDateTimeShort } from "@/lib/date-format";
import { useState, useMemo, useEffect } from "react";

const WHATSAPP_NUMBER = "923056622988";

function fmt(d: string) {
  if (!d) return "";
  return formatDateTimeShort(d);
}

/**
 * Shared Latest Updates feed (cards + full-view modal).
 * Used by the public /latest-updates page and by the B2B agent portal page so
 * agents never leave the portal to read announcements.
 */
export function LatestUpdatesFeed({ compact = false }: { compact?: boolean }) {
  const [search, setSearch] = useState("");
  const [selectedUpdate, setSelectedUpdate] = useState<any>(null);

  const { data: history = [], isLoading } = useQuery({
    queryKey: ["site-settings", "announcement-history"],
    queryFn: () => getAnnouncementHistory(),
    // GlobalAnnouncement's site_settings subscription refreshes this key live.
    staleTime: 60_000,
  });

  const allUpdates = useMemo(() => {
    const list = [...history];
    if (!search.trim()) return list;
    const s = search.toLowerCase();
    return list.filter((item) => (item.text || "").toLowerCase().includes(s));
  }, [history, search]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelectedUpdate(null);
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, []);

  return (
    <>
      <div className={compact ? "" : "mx-auto max-w-6xl px-4 py-12"}>
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
                      alt="Rohi travel update"
                      width={1280} height={720} loading="lazy" decoding="async"
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  </div>
                ) : null}

                <div className="flex flex-1 flex-col p-5">
                  <div className="mb-3 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-navy/40">
                    <Calendar className="h-3 w-3" />
                    {fmt(item.updatedAt)}
                  </div>

                  {(() => {
                    const { title, body } = splitCaption(item.text);
                    return (
                      <>
                        <h3 className="mb-1.5 line-clamp-2 text-[15px] font-semibold leading-snug text-navy">
                          {title || "New Update"}
                        </h3>
                        {body && (
                          <p className="line-clamp-4 whitespace-pre-wrap text-[12.5px] leading-relaxed text-navy/60">
                            {body}
                          </p>
                        )}
                      </>
                    );
                  })()}

                  <div className="mt-auto border-t border-navy/5 pt-4">
                    <span className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.15em] text-gold transition-colors group-hover:text-navy">
                      More Info <span className="text-sm">→</span>
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
            className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-3xl bg-card animate-premium-scale shadow-[var(--shadow-lg)]"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setSelectedUpdate(null)}
              className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/80 text-navy shadow-lg backdrop-blur hover:bg-white hover:text-gold transition-colors"
            >
              <X className="h-6 w-6" />
            </button>

            <div className="flex flex-col md:flex-row">
              {selectedUpdate.imageUrl && (
                <div className="w-full bg-navy/5 md:w-1/2">
                  <img
                    src={selectedUpdate.imageUrl}
                    alt="Full-size Rohi travel update"
                    width={1280} height={720} loading="lazy" decoding="async"
                    className="h-auto w-full object-cover md:h-full"
                  />
                </div>
              )}

              <div className={`flex flex-1 flex-col p-6 md:p-10 ${selectedUpdate.imageUrl ? "md:w-1/2" : "w-full"}`}>
                <div className="mb-4 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-navy/40">
                  <Calendar className="h-3.5 w-3.5" />
                  {fmt(selectedUpdate.updatedAt)}
                </div>

                {(() => {
                  const { title, body } = splitCaption(selectedUpdate.text);
                  return (
                    <>
                      <h2 className="mb-3 text-xl font-semibold leading-snug text-navy sm:text-2xl">
                        {title || "Update Details"}
                      </h2>
                      {body && (
                        <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-navy/65">{body}</p>
                      )}
                    </>
                  );
                })()}


                <div className="mt-auto flex flex-col gap-4 pt-8 border-t border-navy/5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gold text-white shadow">
                      <Bell className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-[13px] font-semibold text-navy">Rohi Travels</p>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-navy/40">Official Announcement</p>
                    </div>
                  </div>

                  <a
                    href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
                      selectedUpdate.text ? `Re: ${selectedUpdate.text.slice(0, 140)}` : "Hi, I saw your latest update.",
                    )}`}
                    target="_blank"
                    rel="noopener"
                    className="inline-flex w-full items-center justify-center gap-2.5 rounded-full bg-gold py-3 text-[11px] font-bold uppercase tracking-[0.18em] text-white shadow-lg transition-all hover:opacity-90 active:scale-95"
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
    </>
  );
}
