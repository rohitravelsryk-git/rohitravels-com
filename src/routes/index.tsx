import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Plane, Phone, MessageCircle, MapPin, Clock, Luggage, ShieldCheck, Headphones, Copy as CopyIcon, Printer, Facebook, Instagram, Mail, Users, Radio, Star, Zap, Bell, ArrowUpRight } from "lucide-react";
import { listFares, listAirlines, listServices, getPsf, getAnnouncement, getBannerSettings, type Fare, supabase } from "@/lib/fares.functions";
import { LatestUpdatesButton } from "@/components/LatestUpdatesButton";
import { AnnouncementBanner } from "@/components/AnnouncementBanner";
import { Button } from "@/components/ui/button";
import { Heading } from "@/components/ui/heading";
import { Text } from "@/components/ui/text";
import { EmptyState } from "@/components/ui/empty-state";
import { useQuery } from "@tanstack/react-query";
import { isReturnFare, isUmrahFare } from "@/lib/umrah";



const faresQuery = queryOptions({
  queryKey: ["fares"],
  queryFn: () => listFares(),
});

const airlinesQuery = queryOptions({
  queryKey: ["airlines"],
  queryFn: () => listAirlines(),
});

const servicesQuery = queryOptions({
  queryKey: ["inquiry-services"],
  queryFn: () => listServices(),
});

const psfQuery = queryOptions({
  queryKey: ["site-settings", "psf"],
  queryFn: () => getPsf(),
});

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Home | Rohi International Travels" },
      { name: "description", content: "Experience elite travel solutions with Rohi International Travels. We provide exclusive group fares, real-time airline updates, and professional B2B services since 1991." },
      { property: "og:title", content: "Home | Rohi International Travels" },
      { property: "og:description", content: "Experience elite travel solutions with Rohi International Travels. Exclusive group fares and professional B2B services." },
      { property: "og:url", content: "https://rohitravels.com/" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://rohitravels.com/" }],
  }),

  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(faresQuery),
      context.queryClient.ensureQueryData(airlinesQuery),
      context.queryClient.ensureQueryData(servicesQuery),
      context.queryClient.ensureQueryData(psfQuery),
    ]),
  component: Home,
  errorComponent: ({ error }) => (
    <div className="p-8 text-center text-destructive">Failed to load fares: {error.message}</div>
  ),
});

const PHONE = "0305 6622988";
const PHONE_TEL = "+923056622988";
const WA_PHONE = "923056622988";
const WA_LINK = `https://wa.me/${WA_PHONE}`;
const CARD_STYLES = ["destination-ocean", "destination-coral", "destination-forest", "destination-sky", "destination-sunset"] as const;

export function openWhatsApp(text?: string) {
  const encoded = text ? `?text=${encodeURIComponent(text)}` : "";
  // wa.me: on mobile opens the WhatsApp app directly; on desktop shows the
  // "Continue to Chat" page letting the user choose WhatsApp Web or the Desktop app.
  const url = `${WA_LINK}${encoded}`;
  // Always open in a new tab; never navigate the current page away.
  window.open(url, "_blank", "noopener,noreferrer");
}

// Format any fare text to "15,000 PKR" when it contains a number.
// Non-numeric strings (e.g. "FARE ON WHATSAPP") have any trailing arrow
// glyph stripped (some fares have "→" typed into price_text in the admin
// panel) and are otherwise returned unchanged.
export function formatFare(priceText: string | null | undefined): string {
  if (!priceText) return priceText ?? "";
  const m = priceText.match(/(\d{1,3}(?:,\d{3})+|\d{3,})/);
  if (!m) return priceText.replace(/\s*(→|->|>)+\s*$/, "").trim();
  const n = parseInt(m[1].replace(/,/g, ""), 10);
  if (!Number.isFinite(n)) return priceText.replace(/\s*(→|->|>)+\s*$/, "").trim();
  return `${n.toLocaleString("en-US")} PKR`;
}

// Homepage commission: adds a markup to every fare's price_text on the public
// site only. Agent B2B portal + admin panel keep showing the raw price.
export function applyCommission(priceText: string | null | undefined, commission: number): string {
  if (!priceText) return priceText ?? "";
  const m = priceText.match(/(\d{1,3}(?:,\d{3})+|\d{3,})/);
  if (!m) return priceText;
  const n = parseInt(m[1].replace(/,/g, ""), 10);
  if (!Number.isFinite(n)) return priceText;
  return `${(n + (commission || 0)).toLocaleString("en-US")} PKR`;
}

function Home() {
  const qc = useQueryClient();
  const { data: fares, refetch, isFetching } = useSuspenseQuery(faresQuery);

  useEffect(() => {
    const channel = supabase
      .channel("public-fares-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "fares" }, () => {
        qc.invalidateQueries({ queryKey: ["fares"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);

  const { data: airlines } = useSuspenseQuery(airlinesQuery);
  const { data: services } = useSuspenseQuery(servicesQuery);
  const { data: psfData } = useSuspenseQuery(psfQuery);

  
  const { data: bannerData } = useQuery({
    queryKey: ["site-settings", "banner_settings"],
    queryFn: () => getBannerSettings(),
  });

  const commission = psfData?.psf ?? 0;

  for (const a of airlines) {
    if (a.name && a.iata_code) {
      DYNAMIC_AIRLINE_IATA[a.name.toUpperCase().replace(/[^A-Z0-9]/g, "")] = a.iata_code.toUpperCase().replace(/[^A-Z0-9]/g, "");
    }
  }
  const [heroIdx, setHeroIdx] = useState(0);
  const [activeCat, setActiveCat] = useState<string>("ALL");

  const categories = useMemo(() => {
    const s = new Set<string>();
    fares.forEach((f) => {
      if (f.destination) s.add(f.destination.toUpperCase());
    });
    const base = ["ALL", ...Array.from(s).sort()];
    if (fares.some((f) => isUmrahFare(f))) {
       if (!base.includes("UMRAH")) base.push("UMRAH");
    }
    return base;
  }, [fares]);

  const filtered = useMemo(() => {
    return fares.filter((f) => {
      if (activeCat === "UMRAH") {
        return isUmrahFare(f);
      }
      if (activeCat !== "ALL" && f.destination?.toUpperCase() !== activeCat) return false;
      return true;
    });
  }, [fares, activeCat]);

  const buildBookNowText = (f: Fare, lines: string[]) => {
    const isReturn = isReturnFare(f);
    let body = "";
    if (isReturn) {
      const [dep, ret] = (f.flight_details || "").split("--- RETURN ---").map(s => s.trim());
      body = `*Departure:*\n${dep}\n\n*Return:*\n${ret}`;
    } else {
      body = lines.join("\n\n");
    }

    return `Salaam, I want to book this fare:
*${f.origin.toUpperCase()} → ${f.destination.toUpperCase()}*

*${f.airline.toUpperCase()}*

${body}

Baggage: *${normalizeBaggageText(f.baggage)}*

Fare: *${applyCommission(f.price_text, psfData?.psf ?? 0)}*`;
  };
  // Hero spotlights Group Fares only — the ones agents can book as a block,
  // managed via the Group Fares fields in the admin panel.
  const heroFares = useMemo(
    () => fares.filter((f) => f.group_type === "self" || f.group_type === "party"),
    [fares]
  );

  // Auto-rotate the featured Group Fare every 4.5 seconds.
  useEffect(() => {
    if (heroFares.length <= 1) return;
    const t = setInterval(() => setHeroIdx((i) => (i + 1) % heroFares.length), 4500);
    return () => clearInterval(t);
  }, [heroFares.length]);

  // Preload the next hero image so the crossfade is seamless
  useEffect(() => {
    if (heroFares.length <= 1) return;
    const next = heroFares[(heroIdx + 1) % heroFares.length];
    if (!next) return;
    const img = new Image();
    img.src = heroImageFor(next);
  }, [heroIdx, heroFares]);


  // Keep the spotlight valid when fares are added or deleted in the admin panel.
  useEffect(() => {
    if (heroFares.length && heroIdx >= heroFares.length) setHeroIdx(0);
  }, [heroFares.length, heroIdx]);

  const hero: Fare | undefined = heroFares[heroIdx];

  const byCategory = useMemo(() => {
    const m = new Map<string, number>();
    fares.forEach((f) => m.set(f.category, (m.get(f.category) ?? 0) + 1));
    return m;
  }, [fares]);

  return (

    <div className="min-h-screen bg-background">
      {/* Latest updates notification is mounted globally in __root via <GlobalAnnouncement /> */}

      
      <GlobalAnnouncementBanner />



      {/* Latest Updates notification is mounted globally in __root via <GlobalAnnouncement /> */}



      {/* Hero */}
      <main>
      <section className="hero-premium relative overflow-hidden px-4 py-8 md:px-8 md:py-12">
        <div className="hero-mosaic-pattern pointer-events-none absolute inset-0" aria-hidden="true" />
        <div className="mx-auto max-w-7xl">
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }} className="relative mx-auto max-w-4xl text-center">
            <Text variant="small" className="mb-3 text-xs font-semibold uppercase text-accent leading-[normal]">Travel expertise since 1991</Text>
            <Heading level={1} className="text-4xl font-medium uppercase leading-[1.02] text-foreground sm:text-5xl lg:text-7xl tracking-normal">
              Rohi <span className="text-accent">International</span> Travels
            </Heading>
            <Text variant="small" className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">Live group fares, B2B Ticketing, Travel Insurance, Appointments, Visit Visas—brought together all in one place.</Text>
          </motion.div>

          {hero && (
            <AnimatePresence mode="wait">
              <motion.div
                key={hero.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.45 }}
                className="relative mx-auto mt-7 grid max-w-5xl overflow-hidden rounded-lg bg-primary text-primary-foreground shadow-hero md:grid-cols-[0.9fr_1.1fr]"
              >
                <div className="relative z-10 hidden flex-col justify-between p-5 md:flex md:p-7">
                  <div>
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase text-primary-foreground/60">
                      <span className="h-2 w-2 rounded-full bg-booking-green" /> Live group fare
                    </div>
                    <Text variant="small" className="font-urdu mt-3 text-[30px] leading-[1.7] text-primary-foreground md:text-[42px]" lang="ur" dir="rtl">
                      {urduName(hero.origin, hero.origin_code)} {urduName(hero.destination, hero.destination_code)}
                    </Text>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-3">
                    {!psfData?.registrationHidden && <Button asChild size="lg" variant="outline" className="border-primary-foreground/25 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"><Link to="/agent/register">Register your agency</Link></Button>}
                  </div>
                </div>

                <div className="relative flex items-center justify-center overflow-hidden bg-secondary p-4 md:p-5">
                  <div className="hero-work-orbit absolute h-64 w-64 rounded-full border border-border md:h-80 md:w-80" aria-hidden="true" />
                  <div className="hero-work-orbit-reverse absolute h-44 w-44 rounded-full border border-border" aria-hidden="true" />
                  <div className="relative z-10 w-full max-w-md rounded-lg border border-border bg-card p-4 text-card-foreground shadow-lg md:p-5">
                    <div className="flex items-start justify-between gap-4 border-b border-border pb-3">
                      <div className="min-w-0">
                        <Text variant="small" className="text-xs font-semibold uppercase text-muted-foreground leading-[normal]">Featured live fare</Text>
                        <Text variant="body" className="mt-1 font-serif text-2xl font-semibold text-foreground leading-[normal]">{hero.origin} to {hero.destination}</Text>
                        {hero.airline && (
                          <div className="mt-2 flex items-center gap-2">
                            <AirlineLogo name={hero.airline} height={26} />
                            <span className="truncate text-xs font-semibold text-muted-foreground">{hero.airline}</span>
                          </div>
                        )}
                      </div>
                      <span className="shrink-0 rounded-full bg-booking-blue-soft px-3 py-1 text-xs font-semibold text-booking-ink">{classifyRoute(hero) === "DIRECT" ? "Direct" : classifyRoute(hero) === "CONNECTING" ? "Connecting" : "Direct / Connecting"}</span>
                    </div>
                    <div className="space-y-2 py-3 text-sm">
                      <div>
                        <Text variant="small" className="text-xs text-muted-foreground leading-[normal]">Flight details</Text>
                        <div className="mt-1 space-y-0.5 font-mono text-[12px] font-semibold uppercase leading-snug">
                          {cleanFlightLines(hero).slice(0, 3).map((line) => (
                            <Text variant="body" key={line} className="text-[inherit] leading-[inherit] text-inherit">{formatScheduleLine(line)}</Text>
                          ))}
                        </div>
                      </div>
                      <div><Text variant="small" className="text-xs text-muted-foreground leading-[normal]">Baggage</Text><Text variant="body" className="mt-1 font-semibold text-[inherit] text-inherit leading-[normal]">{normalizeBaggageText(hero.baggage) || "Included"}</Text></div>
                    </div>
                    <div className="flex items-end justify-between gap-4 border-t border-border pt-3">
                      <div><Text variant="small" className="text-xs text-muted-foreground leading-[normal]">Current fare</Text><Text variant="body" className="mt-1 text-xl font-bold text-foreground leading-[normal]">{formatFare(applyCommission(hero.price_text, commission))}</Text></div>
                    </div>
                    <div className="mt-4 flex gap-2">
                      <Button className="flex-1" onClick={() => openWhatsApp(buildBookNowText(hero, (hero.flight_details && hero.flight_details.trim()) ? hero.flight_details.split(/\r?\n/).map((line) => line.trim()).filter(Boolean) : [formatFlightLine(hero)].filter(Boolean)))}>Book this fare</Button>
                      {!psfData?.registrationHidden && <Button asChild variant="outline" className="flex-1 md:hidden"><Link to="/agent/register">Register</Link></Button>}
                    </div>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
          )}
        </div>

      </section>




      {/* Trending destinations */}
      <section className="mx-auto mt-12 max-w-7xl px-4">
        <motion.div initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.4 }}>
          <Text variant="small" className="text-xs font-semibold uppercase text-accent leading-[normal]">Explore current routes</Text>
          <Heading level={2} className="mt-1 font-serif text-3xl font-semibold text-foreground md:text-4xl tracking-normal">Trending Destinations</Heading>
          <Text variant="small" className="mt-2 text-sm text-muted-foreground leading-[normal]">Choose a destination to see every available live fare.</Text>
        </motion.div>
        <div className="mt-6 flex flex-col gap-4 lg:flex-row">
          <motion.div initial={{ opacity: 0, x: -18 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} className="relative shrink-0 overflow-hidden rounded-lg bg-primary p-5 text-primary-foreground shadow-hero lg:w-64">
            <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase text-primary-foreground/70"><span className="h-2 w-2 rounded-full bg-booking-green" /> Live inventory</span>
            <Text variant="body" className="mt-5 font-serif text-5xl font-semibold leading-none text-inherit">{fares.length}</Text>
            <Text variant="small" className="mt-2 text-xs uppercase text-primary-foreground/70 leading-[normal]">Group fares available</Text>
            <div className="mt-6 flex gap-6 border-t border-primary-foreground/15 pt-4">
              <div><Text variant="body" className="text-2xl font-semibold text-inherit leading-[normal]">{new Set(fares.map((f) => f.airline)).size}</Text><Text variant="small" className="text-xs text-primary-foreground/60 leading-[normal]">Airlines</Text></div>
              <div><Text variant="body" className="text-2xl font-semibold text-inherit leading-[normal]">{new Set(fares.map((f) => `${f.origin_code}-${f.destination_code}`)).size}</Text><Text variant="small" className="text-xs text-primary-foreground/60 leading-[normal]">Routes</Text></div>
            </div>
          </motion.div>

          <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {(() => {
              const m = new Map<string, { city: string; code: string; count: number }>();
              fares.forEach((f) => {
                const key = f.destination_code || f.destination;
                const prev = m.get(key);
                if (prev) prev.count += 1;
                else m.set(key, { city: f.destination, code: f.destination_code, count: 1 });
              });
              return Array.from(m.values()).sort((a, b) => b.count - a.count).map((d, i) => (
                <motion.button
                  key={d.code || d.city}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.25 }}
                  transition={{ delay: Math.min(i, 7) * 0.06, duration: 0.5 }}
                  whileHover={{ y: -5 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setActiveCat(d.city.toUpperCase())}
                  className={`${CARD_STYLES[i % CARD_STYLES.length]} group relative min-h-40 overflow-hidden rounded-lg p-5 text-left text-primary-foreground shadow-md`}
                >
                  <span className="relative text-xs font-semibold uppercase text-primary-foreground/75">{d.code || "Destination"}</span>
                  <div className="relative mt-10 flex items-end justify-between gap-3">
                    <div><Text variant="body" className="font-serif text-2xl font-semibold text-inherit leading-[normal]">{d.city}</Text><Text variant="small" className="mt-1 text-xs text-primary-foreground/75 leading-[normal]">{d.count} live {d.count === 1 ? "fare" : "fares"}</Text></div>
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-foreground/15 transition-transform group-hover:rotate-45"><ArrowUpRight className="h-5 w-5" /></span>
                  </div>
                </motion.button>
              ));
            })()}
          </div>
        </div>

        {/* Destination filter pills */}
        <div className="mt-6 flex snap-x flex-wrap gap-2 pb-2" aria-label="Filter fares by destination">
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setActiveCat(c)}
              className={`min-h-10 shrink-0 snap-start rounded-full px-5 text-xs font-bold uppercase transition ${
                activeCat === c
                  ? "bg-primary text-primary-foreground shadow-md ring-2 ring-accent/40"
                  : "border border-border bg-card text-card-foreground hover:border-accent hover:bg-secondary"
              }`}
            >
              {c === "ALL" ? "ALL DESTINATIONS" : c}
            </button>
          ))}
        </div>
      </section>

      {/* Fare list */}
      <section className="mx-auto mt-12 max-w-7xl px-4 pb-16 animate-premium-fade-up">
        <div className="flex items-baseline justify-between">
          <Heading level={2} className="font-serif text-2xl font-black text-navy tracking-normal">
            {activeCat === "ALL" ? "ALL LIVE FARES" : activeCat}
          </Heading>
          <Text variant="small" className="text-xs font-semibold text-muted-foreground leading-[normal]">
            {filtered.length} {filtered.length === 1 ? "result" : "results"}
          </Text>
        </div>
        <div className="mt-5 grid gap-4 grid-cols-1">
          {filtered.map((f, i) => (
            <div key={f.id} className="animate-premium-fade-up" style={{ animationDelay: `${Math.min(i, 6) * 45}ms` }}>
              <FareCard f={f} commission={commission} />
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="col-span-full [&>div]:rounded-none [&>div]:bg-transparent [&>div]:p-10 [&>div]:shadow-none [&_h3]:text-sm [&_h3]:font-normal [&_h3]:tracking-normal [&_h3]:text-muted-foreground [&_p]:hidden">
              <EmptyState title="No fares match your filter." description="" />
            </div>
          )}
        </div>
      </section>
      </main>

      {/* Our Services — rotating marquee */}
      {services.length > 0 && (
        <section id="our-services" className="bg-gradient-to-b from-secondary/40 via-white to-secondary/40 py-16 mb-12 md:mb-16 animate-premium-fade-up">
          <div className="mx-auto max-w-7xl px-4">
            <div className="mb-8 text-center">
              <Text variant="small" className="text-[11px] font-semibold uppercase tracking-[0.3em] text-gold leading-[normal]">What we offer</Text>
              <Heading level={2} className="mt-1 font-serif text-3xl font-black text-navy md:text-4xl tracking-normal">Our Services</Heading>
              <div className="mx-auto mt-2 h-0.5 w-16 bg-gold" />
              <Text variant="small" className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground leading-[normal]">Tap any service to send an instant inquiry — we reply within minutes.</Text>
            </div>
            <div className="group relative overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_6%,black_94%,transparent)]">
              <div className="flex w-max gap-5 animate-marquee group-hover:[animation-play-state:paused] py-2">
                {[...services, ...services].map((s, i) => {
                  const img = serviceImageFor(s.label);
                  return (
                    <Link
                      key={`${s.id}-${i}`}
                      to="/inquiry"
                      search={{ service: s.label }}
                      className="group/card relative flex h-44 w-64 flex-shrink-0 overflow-hidden rounded-2xl border border-gold/30 shadow-lg ring-1 ring-black/5 transition-all duration-[var(--duration-base)] ease-[var(--ease-premium)] hover:-translate-y-1.5 hover:shadow-xl hover:ring-gold"
                    >
                      <img
                        src={img}
                        alt={`Travel service: ${s.label}`}
                        loading="lazy"
                        width={800} height={600} decoding="async"
                        className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover/card:scale-110"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-navy via-navy/60 to-transparent" />
                      <div className="relative z-10 mt-auto flex w-full items-end justify-between gap-2 p-4">
                        <div>
                          <Text variant="small" className="text-[10px] font-semibold uppercase tracking-[0.25em] text-gold leading-[normal]">Book now</Text>
                          <Heading level={3} className="mt-1 font-serif text-lg font-black leading-tight text-white drop-shadow tracking-normal">{s.label}</Heading>
                        </div>
                        <span className="inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-gold text-white shadow-lg transition group-hover/card:scale-110">
                          <Plane className="h-4 w-4" aria-hidden="true" />
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
            <div className="mt-8 text-center">
              <Text variant="small" className="text-xs text-muted-foreground leading-[normal]">Need one of these?</Text>
              <Link
                to="/inquiry"
                className="mt-3 inline-flex h-[38px] items-center gap-2 rounded-full bg-gold px-4 text-[11px] font-black uppercase tracking-widest text-gold-foreground shadow-sm transition-all hover:scale-105 hover:opacity-90 active:scale-95"
              >
                Send Your Query
              </Link>
            </div>
          </div>
        </section>
      )}



      {/* Footer rendered globally by __root.tsx */}

    </div>
  );
}

const MONTH_ABBRS = new Set(["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"]);

function isConnecting(f: Fare) {
  const scheduleLines = cleanFlightLines(f);
  // Match IATA sectors like "KHI MCT" in the schedule lines — strip each
  // line's leading date token first, and exclude month abbreviations
  // (SEP, OCT...) from the match, so neither is ever mistaken for an
  // airport code.
  const segments = scheduleLines.map(line => {
    const dateMatch = line.match(/^(\d{1,2}\s*[A-Za-z]{3})/);
    const rest = dateMatch ? line.slice(dateMatch[1].length) : line;
    const m = rest.match(/\b([A-Z]{3})\s*[-\/→\s]\s*([A-Z]{3})\b/);
    if (!m || MONTH_ABBRS.has(m[1]) || MONTH_ABBRS.has(m[2])) return null;
    return `${m[1]} ${m[2]}`;
  }).filter(Boolean);

  // Multiple dates on the SAME route (e.g. three direct KHI→JED departures)
  // must not be mistaken for a connecting itinerary — dedupe the distinct
  // route pairs before deciding. Only a genuine multi-leg chain (KHI→MCT,
  // then MCT→MED) has more than one unique pair.
  const uniqueSegments = new Set(segments);
  return uniqueSegments.size > 1 || (f.flight_details?.includes("--- RETURN ---") ?? false);
}

/** Classifies a fare's routing as DIRECT, CONNECTING, or MIXED by checking
 * each scheduled date's own line for how many distinct airport codes it
 * touches (2 codes = direct that day, 3+ = a stopover that day), rather
 * than judging the whole fare from just its first date. Month abbreviations
 * (SEP, OCT, ...) are excluded from the code count so a plain dated direct
 * line isn't miscounted as a 3-code stopover. */
function classifyRoute(f: Fare): "DIRECT" | "CONNECTING" | "MIXED" {
  const scheduleLines = cleanFlightLines(f);
  if (!scheduleLines.length) return isConnecting(f) ? "CONNECTING" : "DIRECT";
  let anyDirect = false;
  let anyConnecting = false;
  for (const line of scheduleLines) {
    // Strip the leading date token first, and also exclude month
    // abbreviations from the remaining matches — "SEP", "OCT", "MAY" etc.
    // are 3-letter month abbreviations that would otherwise get
    // miscounted as a third "airport code" and wrongly flag a direct
    // flight as connecting.
    const dateMatch = line.match(/^(\d{1,2}\s*[A-Za-z]{3})/);
    const rest = dateMatch ? line.slice(dateMatch[1].length) : line;
    const codes = new Set((rest.match(/\b[A-Z]{3}\b/g) || []).filter((c) => !/^\d/.test(c) && !MONTH_ABBRS.has(c)));
    if (codes.size >= 3) anyConnecting = true;
    else anyDirect = true;
  }
  if (f.flight_details?.includes("--- RETURN ---")) anyConnecting = true;
  if (anyDirect && anyConnecting) return "MIXED";
  return anyConnecting ? "CONNECTING" : "DIRECT";
}

export function formatFlightDate(d: string) {
  if (!d) return "";
  // Check for both ddMMM and dd MMM formats
  const formatted = d.replace(/^(\d{1,2})\s*([A-Za-z]{3})$/i, "$1 $2").toUpperCase();
  return formatted;
}
export function formatFlightLine(f: { flight_date: string; origin_code: string; destination_code: string; depart_time?: string | null; arrive_time?: string | null }) {
  return [formatFlightDate(f.flight_date), f.origin_code?.toUpperCase(), f.destination_code?.toUpperCase(), f.depart_time, f.arrive_time]
    .filter(Boolean).join(" ");
}

/** Reformats one raw schedule line into "DATE FROM→TO DEP-ARR" using the
 * first leg's origin/departure and the last leg's destination/arrival —
 * computed live from the airport codes and times actually present in the
 * line, not hardcoded per route. No intermediate stopover airport is ever
 * shown here (in English or Urdu); the DIRECT/CONNECTING/MIXED pill alone
 * signals a stopover. Falls back to the original line untouched if it
 * doesn't cleanly parse into matching code/time pairs. */
export function formatScheduleLine(line: string): string {
  const dateMatch = line.match(/^(\d{1,2}\s*[A-Za-z]{3})/);
  const date = dateMatch ? formatFlightDate(dateMatch[1]) : "";
  const rest = dateMatch ? line.slice(dateMatch[1].length) : line;

  const codes = (rest.match(/\b[A-Z]{3}\b/g) || []).filter((c) => !/^\d/.test(c) && !MONTH_ABBRS.has(c));
  const times = rest.match(/\b\d{3,4}\b/g) || [];

  if (codes.length < 2 || times.length < 2 || codes.length % 2 !== 0 || times.length % 2 !== 0 || codes.length !== times.length) {
    return line;
  }

  // Collapse to just the overall origin -> final destination, using the
  // first leg's departure time and the last leg's arrival time. No
  // stopover city/airport or intermediate leg is shown, even for
  // connecting flights — the CONNECTING status pill elsewhere is what
  // signals that.
  const origin = codes[0];
  const finalDest = codes[codes.length - 1];
  const depTime = times[0];
  const arrTime = times[times.length - 1];
  return [date, `${origin}→${finalDest} ${depTime}-${arrTime}`].filter(Boolean).join(" ");
}

function normalizeBaggageText(value?: string | null) {
  return (value ?? "")
    .replace(/\s*KG$/i, " KG")
    .replace(/\+(\d)(?!\d)/g, "+0$1")
    .replace(/\s+/g, " ")
    .trim();
}

function uniqueCleanLines(lines: string[]) {
  const seen = new Set<string>();
  return lines
    .map((line) => line.replace(/\*/g, "").replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .filter((line) => {
      const key = line.toUpperCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function cleanFlightLines(f: Fare) {
  const rawLines = (f.flight_details ?? "").replace(/--- RETURN ---/g, "\n").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const flightLinePattern = /^\d{1,2}\s*[A-Z]{3}/i;
  const datedLinePattern = /^\d{1,2}\s*[A-Z]{3}/i;
  // console.log('DEBUG cleanFlightLines:', { rawLines });
  const fallback = formatFlightLine(f);

  if (!rawLines.length) return fallback ? [fallback] : [];

  const flightOnly = rawLines.filter((line) => flightLinePattern.test(line) || datedLinePattern.test(line));
  if (flightOnly.length) return uniqueCleanLines(flightOnly);

  return uniqueCleanLines(rawLines).filter((line) => {
    const plain = line.replace(/[*_~]/g, "").trim();
    if (/^(book|fare|baggage)\s*:/i.test(plain)) return false;
    if (/wa\.me|whatsapp|rohi international|abdul razzaq|0305|923056622988/i.test(plain)) return false;
    return true;
  });
}

function buildBookNowText(f: Fare, scheduleLines: string[]) {
  const baggage = normalizeBaggageText(f.baggage);
  const fareText = (f.price_text || "FARE ON WHATSAPP").replace(/^fare\s*:\s*/i, "").trim() || "FARE ON WHATSAPP";
  const firstLeg = scheduleLines[0];
  const flag = firstLeg ? (URDU_MAP[f.destination.toUpperCase().replace(/\s+/g, "")] ? "🇸🇦" : "✈️") : "✈️";

  // Check if it's a direct flight: 
  // 1. Only one schedule line
  // 2. The flight codes in that line match the fare's origin/destination codes
  const isDirect = scheduleLines.length === 1;
  return [
    `${flag} *${f.origin.toUpperCase()} → ${f.destination.toUpperCase()}*`,
    "",
    `*${f.airline.toUpperCase()}*`,
    "",
    scheduleLines.join("\n\n"),
    "",
    baggage ? `Baggage: *${baggage}*` : "",
    `Fare: *${fareText}*`,
  ].filter(line => line !== undefined).join("\n");
}

function FareCard({ f, commission = 0 }: { f: Fare; commission?: number }) {
  const [copied, setCopied] = useState(false);
  const scheduleLines = cleanFlightLines(f);
  const displayPrice = applyCommission(f.price_text, commission);

  // Extract unique sectors from schedule lines (e.g. KHI MCT, MCT MED).
  // Strip each line's leading date token first — otherwise a month
  // abbreviation like "SEP"/"OCT" gets matched as the first airport code
  // in the pair (e.g. "SEP KHI"), wrongly flagging a direct flight as a
  // stopover.
  const segments = scheduleLines.map(line => {
    const dateMatch = line.match(/^(\d{1,2}\s*[A-Za-z]{3})/);
    const rest = dateMatch ? line.slice(dateMatch[1].length) : line;
    // Look for patterns like KHI MCT or KHI-MCT or KHI/MCT
    const m = rest.match(/\b([A-Z]{3})\s*[-\/→\s]\s*([A-Z]{3})\b/);
    return m ? `${m[1]} ${m[2]}` : null;
  }).filter(Boolean);

  const isReturn = f.flight_details?.includes("--- RETURN ---");
  const isDirect = segments.length <= 1 && !isReturn;

  const firstLeg = scheduleLines[0];
  const lastLeg = scheduleLines[scheduleLines.length - 1];
  const flag = firstLeg ? (URDU_MAP[f.destination.toUpperCase().replace(/\s+/g, "")] ? "🇸🇦" : "✈️") : "✈️";

  let copyBody = "";
  if (isReturn) {
    const [dep, ret] = (f.flight_details || "").split("--- RETURN ---").map(s => s.trim());
    copyBody = `*Departure:*\n${dep}\n\n*Return:*\n${ret}`;
  } else {
    copyBody = scheduleLines.join("\n\n");
  }

  const copyText = `${flag} *${f.origin.toUpperCase()} → ${f.destination.toUpperCase()}*

*${f.airline.toUpperCase()}*

${copyBody}

Baggage: *${normalizeBaggageText(f.baggage)}*

Fare: *${displayPrice}*`;

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(copyText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  return (
    <article className="group relative overflow-hidden rounded-2xl bg-card shadow-[var(--shadow-card)] ring-1 ring-border transition-all duration-[var(--duration-base)] ease-[var(--ease-premium)] hover:-translate-y-1 hover:shadow-[var(--shadow-lg)] hover:ring-gold/60">
      <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)_minmax(220px,0.7fr)]">
        {/* LEFT: Route + airline */}
        <div className="relative p-4 md:p-5">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 md:gap-3">
            <div className="min-w-0">
              <h4 className="flex flex-wrap items-center gap-x-1 gap-y-0.5 font-serif text-base font-black leading-[1.05] tracking-tight text-navy sm:text-lg md:gap-x-1.5 md:text-xl">
                <span className="whitespace-nowrap">{f.origin.toUpperCase()}</span>
                <span className="text-navy/80">→</span>
                <span className="whitespace-nowrap">{f.destination.toUpperCase()}</span>
                {isReturn && (
                  <>
                    <span className="text-navy/80">→</span>
                    <span className="whitespace-nowrap">{f.origin.toUpperCase()}</span>
                  </>
                )}
              </h4>
              <Text variant="small" className="mt-1 text-[9px] font-bold tracking-[0.12em] text-muted-foreground sm:text-[10px] md:tracking-[0.16em] leading-[normal]">
                {f.origin_code} <span className="mx-0.5">→</span> {f.destination_code}{isReturn ? <><span className="mx-0.5">→</span> {f.origin_code}</> : null}
              </Text>
            </div>
            <div className="font-urdu flex min-w-0 flex-col items-center justify-center self-center" lang="ur" dir="rtl">
              <div className="flex items-center justify-center gap-1 px-1 py-0.5 align-middle">
                <span className="inline-flex max-w-[7rem] items-center justify-center whitespace-normal text-center text-[18px] leading-tight !text-black md:max-w-[10rem] md:text-[24px]">
                  {urduName(f.origin, f.origin_code)} {urduName(f.destination, f.destination_code)} {isReturn ? urduName(f.origin, f.origin_code) : ""}
                </span>
                <span className="text-gold text-[10px] font-bold">{isReturn ? "(عمرہ)" : ""}</span>
              </div>
            </div>
          </div>

          <div className="mt-5 flex items-center gap-3">
            <span className="h-px flex-1 bg-border" />
            <Plane className="h-4 w-4 animate-fly-up text-gold" />
            <span className="h-px flex-1 bg-border" />
          </div>
          <Text variant="small" className={`mt-2 text-center text-[10px] font-bold tracking-[0.35em] ${isDirect ? "text-emerald-600" : "text-gold"}`}>
            {isDirect ? "DIRECT FLIGHT" : "CONNECTING FLIGHT"}
          </Text>

          <div className="mt-3 flex items-center justify-center">
            <AirlineLogo name={f.airline} height={44} />
          </div>
        </div>


        {/* MIDDLE: Schedule + copy */}
        <div className="relative border-t border-dashed border-border p-6 md:border-l md:border-t-0 md:p-7">
          <span className="pointer-events-none absolute -left-2 top-0 hidden h-4 w-4 -translate-y-1/2 rounded-full bg-background ring-1 ring-border md:block" />
          <span className="pointer-events-none absolute -left-2 bottom-0 hidden h-4 w-4 translate-y-1/2 rounded-full bg-background ring-1 ring-border md:block" />


          <div className="flex items-start justify-between gap-3">
            <div className="inline-flex items-center gap-2 px-2 py-1 text-[11px] font-bold tracking-[0.25em] !text-black">
              <Clock className="h-3.5 w-3.5 text-gold" /> FLIGHT SCHEDULE
            </div>
            <button
              onClick={onCopy}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1.5 text-[10px] font-bold tracking-widest text-navy transition hover:bg-secondary"
              title="Copy fare details"
            >
              <CopyIcon className="h-3 w-3" /> {copied ? "COPIED" : "COPY"}
            </button>
          </div>

          <div className="mt-3 space-y-1 font-mono text-[13px] font-medium tracking-tight text-navy">
            {scheduleLines.length > 0 ? (
              scheduleLines.map((line, i) => {
                const parts = line.split(/\s+/);
                const isDay = /^\d{1,2}$/.test(parts[0] ?? "");
                const dateTok = isDay ? `${parts[0]} ${parts[1] ?? ""}`.trim() : parts[0] ?? "";
                const rest = (isDay ? parts.slice(2) : parts.slice(1)).join(" ");
                return (
                  <Text variant="body" key={i} className="flex items-center gap-2 text-[inherit] leading-[inherit] text-navy">
                    <span>{dateTok}</span>
                    <span>{rest}</span>
                  </Text>
                );
              })
            ) : (
              <Text variant="body" className="text-muted-foreground text-[inherit] leading-[normal]">—</Text>
            )}
          </div>

          {f.baggage && (
            <span className="mt-3 flex items-center gap-1.5 font-mono text-sm font-bold text-navy">
              <Luggage className="h-3.5 w-3.5 text-gold" /> {f.baggage}
            </span>
          )}

          {f.flight_number && (
            <Text variant="small" className="mt-3 font-mono text-[11px] tracking-widest text-muted-foreground leading-[normal]">
              FLIGHT <span className="font-bold text-navy">{f.flight_number}</span>
            </Text>
          )}
        </div>


        {/* RIGHT: Navy CTA panel */}
        <div className="relative overflow-hidden bg-navy p-6 text-navy-foreground">
          <div className="pointer-events-none absolute inset-0 bg-plane-lines opacity-60" />
          <div className="relative flex h-full flex-col items-center justify-center gap-3 text-center">
            <div className="flex flex-col items-center gap-2">
              <Text variant="small" className="text-[10px] font-bold tracking-[0.4em] text-gold uppercase leading-[normal]">GROUP FARE</Text>
              {(() => {
                const currentSeats = String(f.seats || "");
                const match = currentSeats.match(/(\d+)\s+out\s+of\s+(\d+)/i);
                if (match && parseInt(match[1], 10) === 0 && f.group_type === "self") {
                  return (
                    <span className="inline-flex items-center gap-1 rounded bg-gold px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-navy shadow-sm ring-1 ring-gold/30">
                      Sold
                    </span>
                  );
                }
                return null;
              })()}
            </div>
            {(() => {
              const displayPrice = applyCommission(f.price_text, commission);
              const isNumeric = /\d/.test(displayPrice);
              return (
                <div
                  className={`w-full rounded-lg bg-white/5 px-3 py-2.5 font-black tracking-wide text-gold ring-1 ring-white/15 whitespace-nowrap overflow-hidden text-ellipsis ${
                    isNumeric ? "text-xl md:text-2xl" : "text-sm md:text-base tracking-widest"
                  }`}
                  title={displayPrice}
                >
                  {formatFare(displayPrice)}
                </div>
              );
            })()}
            <button
              type="button"
              onClick={() => {
                openWhatsApp(buildBookNowText({ ...f, price_text: displayPrice }, scheduleLines));
              }}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-gold px-5 py-3 text-sm font-black tracking-wide text-gold-foreground shadow-lg transition hover:brightness-95"
            >
              <MessageCircle className="h-4 w-4" /> BOOK NOW
            </button>


            <Text variant="small" className="text-[10px] text-white/60 leading-[normal]">Instant WhatsApp booking</Text>
          </div>
        </div>
      </div>
    </article>
  );
}

const ARABIC_AIRLINE: Record<string, string> = {
  FLYADEAL: "طيران أديل",
  FLYNAS: "طيران ناس",
  SAUDIA: "السعودية",
  FLYDUBAI: "فلاي دبي",
  EMIRATES: "طيران الإمارات",
  QATAR: "القطرية",
  QATARAIRWAYS: "القطرية",
  ETIHAD: "الاتحاد",
  ETIHADAIRWAYS: "الاتحاد",
  OMANAIR: "الطيران العماني",
  SALAMAIR: "طيران السلام",
  GULFAIR: "طيران الخليج",
  KUWAITAIRWAYS: "الخطوط الكويتية",
  TURKISHAIRLINES: "الخطوط التركية",
  AIRARABIA: "العربية للطيران",
  PIA: "پی آئی اے",
};

function arabicAirline(name: string) {
  if (!name) return "";
  const key = name.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return ARABIC_AIRLINE[key] ?? "";
}

function titleCase(s: string) {
  return s
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}


function catCode(cat: string) {
  const codes: Record<string, string> = {
    JEDDAH: "JED", RIYADH: "RUH", MUSCAT: "MCT", UMRAH: "UMRAH", DUBAI: "DXB", MEDINA: "MED",
  };
  return codes[cat.toUpperCase()] ?? cat.slice(0, 3).toUpperCase();
}

const URDU_MAP: Record<string, string> = {
  JEDDAH: "جدہ", RIYADH: "ریاض", MUSCAT: "مسقط", UMRAH: "عمرہ", MEDINA: "مدینہ",
  MADINAH: "مدینہ", DUBAI: "دوبئی", LAHORE: "لاہور", KARACHI: "کراچی",
  ISLAMABAD: "اسلام آباد", PESHAWAR: "پشاور", MULTAN: "ملتان", QUETTA: "کوئٹہ",
  FAISALABAD: "فیصل آباد", SIALKOT: "سیالکوٹ", DAMMAM: "دمام", DOHA: "دوحہ",
  ABUDHABI: "ابوظہبی", SHARJAH: "شارجہ", BAHRAIN: "بحرین", KUWAIT: "کویت",
  ISTANBUL: "استنبول", QASSIM: "قصیم", ELQ: "قصیم",
  MCT: "مسقط", JED: "جدہ", MED: "مدینہ", KHI: "کراچی", LHE: "لاہور",
  ISB: "اسلام آباد", PEW: "پشاور", MUX: "ملتان", UET: "کوئٹہ", LYP: "فیصل آباد",
  SKT: "سیالکوٹ", DMM: "دمام", DOH: "دوحہ", AUH: "ابوظہبی", SHJ: "شارجہ",
  BAH: "بحرین", KWI: "کویت", IST: "استنبول", RUH: "ریاض", DXB: "دوبئی",
};

export function urduName(name: string, code?: string) {
  if (code) {
    const codeKey = code.toUpperCase().trim();
    if (URDU_MAP[codeKey]) return URDU_MAP[codeKey];
  }
  if (!name) return "";
  const key = name.toUpperCase().replace(/\s+/g, "");
  return URDU_MAP[key] ?? URDU_MAP[name.toUpperCase()] ?? name;
}

const KAABA = "https://images.unsplash.com/photo-1591604129939-f1efa4d9f7fa?auto=format&fit=crop&w=1920&q=80"; // High-quality Kaaba
const NABAWI = "https://images.unsplash.com/photo-1566492031773-4f4e44671857?auto=format&fit=crop&w=1920&q=80"; // High-quality Madinah Mosque
const KAABA_HERO = "https://images.unsplash.com/photo-1591604129939-f1efa4d9f7fa?auto=format&fit=crop&w=1920&q=80";



const SERVICE_IMAGE_RULES: Array<[RegExp, string]> = [
  [/umrah|makkah|mecca|hajj|ziarat/i, KAABA_HERO],
  [/madinah|medina|nabawi/i, NABAWI],
  [/visa|passport|appointment|navttc|embass/i, "https://images.unsplash.com/photo-1569503689347-cddac6ba64f5?auto=format&fit=crop&w=800&q=80"],
  [/void|dummy|itinerary/i, "https://images.unsplash.com/photo-1436491865332-7a61a109cc05?auto=format&fit=crop&w=800&q=80"],
  [/discount|voucher|deal|offer|promo/i, "https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=800&q=80"],
  [/hotel|stay|accommodation/i, "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=800&q=80"],
  [/tour|holiday|package|vacation/i, "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80"],
  [/transfer|transport|car/i, "https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?auto=format&fit=crop&w=800&q=80"],
  [/insurance/i, "https://images.unsplash.com/photo-1450101499163-c8848c66ca85?auto=format&fit=crop&w=800&q=80"],
  [/group|fare|ticket|flight|airline/i, "https://images.unsplash.com/photo-1436491865332-7a61a109cc05?auto=format&fit=crop&w=800&q=80"],
];
const SERVICE_DEFAULT_IMAGE = "https://images.unsplash.com/photo-1502920917128-1aa500764cbd?auto=format&fit=crop&w=800&q=80";
export function serviceImageFor(label: string): string {
  for (const [rx, url] of SERVICE_IMAGE_RULES) if (rx.test(label)) return url;
  return SERVICE_DEFAULT_IMAGE;
}

const DESTINATION_IMAGES: Record<string, string> = {
  JEDDAH: "https://images.unsplash.com/photo-1541336318489-083b9d27064d?auto=format&fit=crop&w=1920&q=80", // High-quality Jeddah Corniche/Cityscape landmark
  MAKKAH: KAABA_HERO,
  MECCA: KAABA_HERO,
  UMRAH: KAABA_HERO,
  MEDINA: NABAWI,
  MADINAH: NABAWI,
  RIYADH: "https://images.unsplash.com/photo-1580674285054-bed31e145f59?auto=format&fit=crop&w=1920&q=80",
  DAMMAM: "https://images.unsplash.com/photo-1627932681534-1f5927c3e742?auto=format&fit=crop&w=1920&q=80",
  MUSCAT: "https://images.unsplash.com/photo-1549468057-5b7fa1a41d7a?auto=format&fit=crop&w=1920&q=80",
  DUBAI: "https://images.unsplash.com/photo-1512453979798-5ea266f8880c?auto=format&fit=crop&w=1920&q=80",
  ABUDHABI: "https://images.unsplash.com/photo-1580674684081-7617fbf3d745?auto=format&fit=crop&w=1920&q=80",
  "ABU DHABI": "https://images.unsplash.com/photo-1580674684081-7617fbf3d745?auto=format&fit=crop&w=1920&q=80",
  SHARJAH: "https://images.unsplash.com/photo-1606552467727-414edce6c2ca?auto=format&fit=crop&w=1920&q=80",
  DOHA: "https://images.unsplash.com/photo-1594913785162-e6785b49dea3?auto=format&fit=crop&w=1920&q=80",
  KUWAIT: "https://images.unsplash.com/photo-1560935579-24b553c306d9?auto=format&fit=crop&w=1920&q=80",
  BAHRAIN: "https://images.unsplash.com/photo-1548777123-e216912df7d8?auto=format&fit=crop&w=1920&q=80",
  MANAMA: "https://images.unsplash.com/photo-1548777123-e216912df7d8?auto=format&fit=crop&w=1920&q=80",
  ISTANBUL: "https://images.unsplash.com/photo-1524231757912-21f4fe3a7200?auto=format&fit=crop&w=1920&q=80",
  KARACHI: "https://images.unsplash.com/photo-1601758178553-7b960c92fba1?auto=format&fit=crop&w=1920&q=80",
  LAHORE: "https://images.unsplash.com/photo-1590483861877-c990cc765e9f?auto=format&fit=crop&w=1920&q=80",
  ISLAMABAD: "https://images.unsplash.com/photo-1603588231599-272ec2201d4a?auto=format&fit=crop&w=1920&q=80",
};



export const DESTINATION_FALLBACK = KAABA_HERO;



export function destinationImage(name: string) {
  if (!name) return DESTINATION_IMAGES.JEDDAH;
  const key = name.toUpperCase().replace(/\s+/g, "");
  return DESTINATION_IMAGES[key] ?? DESTINATION_FALLBACK;
}

// Airline-branded aircraft photography — shown in the hero when a fare's airline matches.
const AIRLINE_IMAGES: Record<string, string> = {
  SALAMAIR: "/__l5e/assets-v1/c3af1936-874e-44c8-b4fd-d5839ae4e6e3/al-salamair.jpg",
  FLYNAS: "/__l5e/assets-v1/cf9f824f-ebe0-43b8-ad9c-3698cf3e7e30/al-flynas.jpg",
  FLYADEAL: "/__l5e/assets-v1/07d8badd-ca1e-4a8e-9573-9855679f6088/al-flyadeal.jpg",
  SAUDIA: "/__l5e/assets-v1/15419c0e-52be-4beb-b354-8f9dff23d689/al-saudia.jpg",
  SAUDIARABIANAIRLINES: "/__l5e/assets-v1/15419c0e-52be-4beb-b354-8f9dff23d689/al-saudia.jpg",
  PIA: "/__l5e/assets-v1/65747335-4a2b-4ac3-bf3c-118b4ab72352/al-pia.jpg",
  PAKISTANINTERNATIONAL: "/__l5e/assets-v1/65747335-4a2b-4ac3-bf3c-118b4ab72352/al-pia.jpg",
  PAKISTANINTERNATIONALAIRLINES: "/__l5e/assets-v1/65747335-4a2b-4ac3-bf3c-118b4ab72352/al-pia.jpg",
  EMIRATES: "/__l5e/assets-v1/1cce554f-16c2-4c8c-a3e7-7692676042c6/al-emirates.jpg",
  ETIHAD: "/__l5e/assets-v1/a1254ee9-ba8c-424a-9d6a-b210ada95fa0/al-etihad.jpg",
  ETIHADAIRWAYS: "/__l5e/assets-v1/a1254ee9-ba8c-424a-9d6a-b210ada95fa0/al-etihad.jpg",
  QATAR: "/__l5e/assets-v1/8e23bf25-7b02-4bf1-8315-c1fe2a1a0e6e/al-qatar.jpg",
  QATARAIRWAYS: "/__l5e/assets-v1/8e23bf25-7b02-4bf1-8315-c1fe2a1a0e6e/al-qatar.jpg",
  AIRARABIA: "/__l5e/assets-v1/401d7687-cd31-420d-82bc-1150451f9205/al-airarabia.jpg",
  FLYDUBAI: "/__l5e/assets-v1/4b7e2cd9-fb3d-45d4-be96-d1d961599a54/al-flydubai.jpg",
  OMAN: "/__l5e/assets-v1/7bdb8b5e-d5ec-4a95-a187-f9d1420ca79f/al-omanair.jpg",
  OMANAIR: "/__l5e/assets-v1/7bdb8b5e-d5ec-4a95-a187-f9d1420ca79f/al-omanair.jpg",
  GULF: "/__l5e/assets-v1/0360e3f0-60db-4bec-b2ae-15c99a2efefb/al-gulfair.jpg",
  GULFAIR: "/__l5e/assets-v1/0360e3f0-60db-4bec-b2ae-15c99a2efefb/al-gulfair.jpg",
  KUWAITAIRWAYS: "/__l5e/assets-v1/15f7feda-47bb-4f3d-a1d7-6dc1a66bedbe/al-kuwaitairways.jpg",
  TURKISH: "/__l5e/assets-v1/675fa88d-0df8-4137-bc24-d1738f8333a1/al-turkish.jpg",
  TURKISHAIRLINES: "/__l5e/assets-v1/675fa88d-0df8-4137-bc24-d1738f8333a1/al-turkish.jpg",
  JAZEERA: "/__l5e/assets-v1/6af0da41-5603-476c-aff9-cbe6a6bfcd98/al-jazeera.jpg",
  JAZEERAAIRWAYS: "/__l5e/assets-v1/6af0da41-5603-476c-aff9-cbe6a6bfcd98/al-jazeera.jpg",
  AIRBLUE: "/__l5e/assets-v1/b4f483bb-4731-42cc-9b5a-677e4481ecd1/al-airblue.jpg",
  AIRSIAL: "/__l5e/assets-v1/59c9f5fd-d013-4412-927d-0b70b8184aac/al-airsial.jpg",
  SERENE: "/__l5e/assets-v1/f101ffbc-56b2-41fa-870c-dfe5fb9f7555/al-sereneair.jpg",
  SEREINAIR: "/__l5e/assets-v1/f101ffbc-56b2-41fa-870c-dfe5fb9f7555/al-sereneair.jpg",
  SERENEAIR: "/__l5e/assets-v1/f101ffbc-56b2-41fa-870c-dfe5fb9f7555/al-sereneair.jpg",
};

export function airlineImage(airline: string | null | undefined): string | null {
  if (!airline) return null;
  const key = airline.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return AIRLINE_IMAGES[key] ?? null;
}

// Hero image: always show the destination landmark as the main background to satisfy "city images behind text".
export function heroImageFor(fare: { destination: string }): string {
  return destinationImage(fare.destination);
}




const AIRLINE_IATA: Record<string, string> = {
  FLYNAS: "XY", FLYADEAL: "F3", SAUDIA: "SV", SAUDIARABIANAIRLINES: "SV",
  PIA: "PK", PAKISTANINTERNATIONAL: "PK", PAKISTANINTERNATIONALAIRLINES: "PK",
  EMIRATES: "EK", ETIHAD: "EY", ETIHADAIRWAYS: "EY", QATAR: "QR", QATARAIRWAYS: "QR",
  AIRARABIA: "G9", FLYDUBAI: "FZ", OMAN: "WY", OMANAIR: "WY", SALAMAIR: "OV",
  GULF: "GF", GULFAIR: "GF", KUWAITAIRWAYS: "KU", TURKISH: "TK", TURKISHAIRLINES: "TK",
  SERENE: "ER", SERENEAIR: "ER", AIRBLUE: "PA", AIRSIAL: "PF",
  JAZEERA: "J9", JAZEERAAIRWAYS: "J9", FLYJINNAH: "9P", JINNAHAIRLINES: "9P",
};

export const DYNAMIC_AIRLINE_IATA: Record<string, string> = {};

function airlineIata(name: string): string | null {
  if (!name) return null;
  const compact = name.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return DYNAMIC_AIRLINE_IATA[compact] ?? AIRLINE_IATA[compact] ?? null;
}

// Official carrier logos hosted on Wikimedia (transparent SVG/PNG, no watermark).
const AIRLINE_LOGO_OVERRIDES: Record<string, string> = {
  XY: "https://upload.wikimedia.org/wikipedia/commons/6/62/Flynas_Logo.svg",
  F3: "https://upload.wikimedia.org/wikipedia/commons/7/73/Flyadeal_Logo.svg",
  OV: "https://upload.wikimedia.org/wikipedia/commons/2/2f/SalamAir.png",
  FZ: "https://upload.wikimedia.org/wikipedia/commons/7/79/Fly_Dubai_logo_2010_03.svg",
  G9: "https://upload.wikimedia.org/wikipedia/commons/8/84/Air_Arabia_logo_2018.svg",
  PA: "https://upload.wikimedia.org/wikipedia/commons/f/fb/Airblue_Logo.svg",
  PF: "https://upload.wikimedia.org/wikipedia/commons/3/30/Fly_Sial_logo.svg",
  J9: "https://upload.wikimedia.org/wikipedia/commons/6/6d/Jazeera_Airways_logo.svg",
  KU: "https://upload.wikimedia.org/wikipedia/commons/f/f5/Kuwait_Airways_wordmark.svg",
  PK: "https://upload.wikimedia.org/wikipedia/commons/a/a9/Pakistan_International_Airlines_Logo.svg",
  QR: "https://upload.wikimedia.org/wikipedia/commons/7/75/Qatar_Airways_logo.svg",
  ER: "https://upload.wikimedia.org/wikipedia/commons/5/53/SereneAir.svg",
  "9P": "https://upload.wikimedia.org/wikipedia/commons/c/cb/Fly_Jinnah_logo2.png",
};

export function AirlineLogo({ name, height = 40, className = "" }: { name: string; height?: number; className?: string }) {
  const iata = airlineIata(name);
  if (!iata) {
    return <span className={`px-0.5 text-center text-[9px] font-bold uppercase leading-tight tracking-wide ${className}`}>{name}</span>;
  }
  const cleanIata = iata.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const override = AIRLINE_LOGO_OVERRIDES[cleanIata];
  const primary = override ?? `https://logo.clearbit.com/${name.toLowerCase().replace(/\s+/g, "")}.com`;
  const secondary = `https://daisycon.io/images/airline/?width=900&height=450&color=ffffff00&iata=${cleanIata}`;
  const fallback = `https://images.kiwi.com/airlines/128/${cleanIata}.png`;
  return (
    <img
      src={primary}
      alt={`${name} logo`}
      loading="lazy"
      decoding="async"
      width={900} height={450}
      style={{ maxHeight: height, maxWidth: "100%", width: "auto", height: "auto", background: "transparent" }}
      className={`inline-block object-contain mix-blend-multiply brightness-90 contrast-125 ${className}`}
      onError={(e) => {
        const t = e.currentTarget;
        if (t.dataset.stage === "1") {
           t.dataset.stage = "2";
           t.src = fallback;
        } else if (!t.dataset.stage) {
           t.dataset.stage = "1";
           t.src = secondary;
        }
      }}
    />
  );
}

function GlobalAnnouncementBanner() {
  const { data: bannerData } = useQuery({
    queryKey: ["site-settings", "banner_settings"],
    queryFn: () => getBannerSettings(),
  });
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    setHydrated(true);
  }, []);

  if (!hydrated || !bannerData?.enabled) return null;

  return (
    <div className="border-b border-gold/20 bg-navy/5">
      <AnnouncementBanner
        enabled={bannerData.enabled}
        text={bannerData.text}
        imageUrl={bannerData.imageUrl}
        linkUrl={bannerData.linkUrl}
      />
    </div>
  );
}









