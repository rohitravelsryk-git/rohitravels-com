import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Plane, Phone, MessageCircle, MapPin, Clock, Luggage, ShieldCheck, Headphones, Copy as CopyIcon, Printer, Facebook, Instagram, Mail, Users, Radio, Star, Zap, Bell } from "lucide-react";
import { listFares, listAirlines, listServices, getPsf, getAnnouncement, getBannerSettings, type Fare } from "@/lib/fares.functions";
import { LatestUpdatesButton } from "@/components/LatestUpdatesButton";
import { AnnouncementBanner } from "@/components/AnnouncementBanner";
import { useQuery } from "@tanstack/react-query";



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

export function openWhatsApp(text?: string) {
  const encoded = text ? `?text=${encodeURIComponent(text)}` : "";
  // wa.me: on mobile opens the WhatsApp app directly; on desktop shows the
  // "Continue to Chat" page letting the user choose WhatsApp Web or the Desktop app.
  const url = `${WA_LINK}${encoded}`;
  // Always open in a new tab; never navigate the current page away.
  window.open(url, "_blank", "noopener,noreferrer");
}

const CARD_STYLES = ["card-teal", "card-sage", "card-warm", "card-cool"] as const;

// Format any fare text to "15,000 PKR /-" when it contains a number.
// Non-numeric strings (e.g. "FARE ON WHATSAPP") are returned unchanged.
export function formatFare(priceText: string | null | undefined): string {
  if (!priceText) return priceText ?? "";
  const m = priceText.match(/(\d{1,3}(?:,\d{3})+|\d{3,})/);
  if (!m) return priceText;
  const n = parseInt(m[1].replace(/,/g, ""), 10);
  if (!Number.isFinite(n)) return priceText;
  return `${n.toLocaleString("en-US")} PKR /-`;
}

// Homepage commission: adds a markup to every fare's price_text on the public
// site only. Agent B2B portal + admin panel keep showing the raw price.
export function applyCommission(priceText: string | null | undefined, commission: number): string {
  if (!priceText) return priceText ?? "";
  const m = priceText.match(/(\d{1,3}(?:,\d{3})+|\d{3,})/);
  if (!m) return priceText;
  const n = parseInt(m[1].replace(/,/g, ""), 10);
  if (!Number.isFinite(n)) return priceText;
  return `${(n + (commission || 0)).toLocaleString("en-US")} PKR /-`;
}

function Home() {
  const { data: fares, refetch, isFetching } = useSuspenseQuery(faresQuery);
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
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [appliedOrigin, setAppliedOrigin] = useState("");
  const [appliedDestination, setAppliedDestination] = useState("");
  const [originFocus, setOriginFocus] = useState(false);
  const [destFocus, setDestFocus] = useState(false);

  const categories = useMemo(() => {
    const s = new Set<string>();
    fares.forEach((f) => {
      if (f.destination) s.add(f.destination.toUpperCase());
    });
    const base = ["ALL", ...Array.from(s).sort()];
    if (fares.some(f => f.category?.toUpperCase() === "UMRAH" || (f.flight_details && f.flight_details.includes("--- RETURN ---")))) {
       if (!base.includes("UMRAH")) base.push("UMRAH");
    }
    return base;
  }, [fares]);

  const originOptions = useMemo(() => {
    const m = new Map<string, { city: string; code: string }>();
    fares.forEach((f) => m.set(`${f.origin}|${f.origin_code}`, { city: f.origin, code: f.origin_code }));
    return Array.from(m.values());
  }, [fares]);
  const destinationOptions = useMemo(() => {
    const m = new Map<string, { city: string; code: string }>();
    fares.forEach((f) => m.set(`${f.destination}|${f.destination_code}`, { city: f.destination, code: f.destination_code }));
    return Array.from(m.values());
  }, [fares]);

  const matchLocation = (needle: string, city: string, code: string) => {
    const n = needle.trim().toLowerCase();
    if (!n) return true;
    return city.toLowerCase().includes(n) || code.toLowerCase().includes(n);
  };

  const originSuggestions = useMemo(
    () => (origin.trim() ? originOptions.filter((o) => matchLocation(origin, o.city, o.code)).slice(0, 8) : []),
    [origin, originOptions],
  );
  const destSuggestions = useMemo(
    () => (destination.trim() ? destinationOptions.filter((o) => matchLocation(destination, o.city, o.code)).slice(0, 8) : []),
    [destination, destinationOptions],
  );

  const filtered = useMemo(() => {
    return fares.filter((f) => {
      if (activeCat === "UMRAH") {
        return f.category?.toUpperCase() === "UMRAH" || f.flight_details?.includes("--- RETURN ---");
      }
      if (activeCat !== "ALL" && f.destination?.toUpperCase() !== activeCat) return false;
      if (appliedOrigin && !matchLocation(appliedOrigin, f.origin, f.origin_code)) return false;
      if (appliedDestination && !matchLocation(appliedDestination, f.destination, f.destination_code)) return false;
      return true;
    });
  }, [fares, activeCat, appliedOrigin, appliedDestination]);

  const applySearch = () => {
    setAppliedOrigin(origin);
    setAppliedDestination(destination);
    setActiveCat("ALL");
    setOriginFocus(false);
    setDestFocus(false);
  };

  const buildBookNowText = (f: Fare, lines: string[]) => {
    const isReturn = f.flight_details?.includes("--- RETURN ---") || f.category?.toUpperCase() === "UMRAH";
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
  const clearSearch = () => {
    setOrigin("");
    setDestination("");
    setAppliedOrigin("");
    setAppliedDestination("");
    setActiveCat("ALL");
  };
  const hasSearch = Boolean(appliedOrigin || appliedDestination || origin || destination);

  // Auto-rotate hero through all fares
  useEffect(() => {
    if (fares.length <= 1) return;
    const t = setInterval(() => setHeroIdx((i) => (i + 1) % fares.length), 6000);
    return () => clearInterval(t);
  }, [fares.length]);

  // Preload the next hero image so the crossfade is seamless
  useEffect(() => {
    if (fares.length <= 1) return;
    const next = fares[(heroIdx + 1) % fares.length];
    if (!next) return;
    const img = new Image();
    img.src = heroImageFor(next);
  }, [heroIdx, fares]);


  const hero: Fare | undefined = fares[heroIdx];

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
      <section className="relative flex min-h-[600px] flex-col justify-center overflow-hidden bg-[#020408]">
        {/* Cinematic Background */}
        <div className="absolute inset-0 z-0">
          {/* Main Hero Image with Ken Burns */}
          <div className="absolute inset-0 overflow-hidden">
             <div className="absolute inset-0 bg-hero opacity-60 animate-ken-burns scale-110" />
          </div>

          {/* Depth Overlays */}
          <div className="absolute inset-0 bg-gradient-to-b from-[#020408]/95 via-[#020408]/30 to-[#020408]" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#020408]/95 via-transparent to-[#020408]/95" />
          
          {/* Animated Atmospheric Elements */}
          <div className="absolute top-1/4 left-1/4 h-[600px] w-[600px] rounded-full bg-gold/10 blur-[120px] animate-pulse mix-blend-screen" />
          <div className="absolute bottom-1/4 right-1/4 h-[700px] w-[700px] rounded-full bg-navy/30 blur-[150px] animate-float-slow" />
          
          {/* Stellar Grid / Texture */}
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-15 mix-blend-screen animate-star" />
          <div className="absolute inset-0 opacity-10 mix-blend-overlay animate-grid-pulse" 
               style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)', backgroundSize: '50px 50px' }} 
          />
          
          {/* Cinematic Light Sweeps */}
          <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-transparent -translate-x-full animate-[sweep_10s_ease-in-out_infinite]" />
          <div className="absolute inset-0 bg-gradient-to-bl from-transparent via-gold/5 to-transparent translate-x-full animate-[sweep_12s_ease-in-out_infinite_reverse]" />
        </div>
        


        <div className="relative mx-auto grid w-full max-w-7xl items-center gap-10 px-4 pt-0 pb-12 lg:grid-cols-[0.8fr_1.2fr]">
          <div className="animate-fade-up">
            <div className="space-y-4">
              <h2 className="font-serif text-5xl font-black leading-[0.85] tracking-tight text-white md:text-6xl lg:text-7xl">
                {hero ? (
                  <>
                    <span className="text-white/90 drop-shadow-sm">{hero.origin}</span>
                    <br />
                    <span className="text-navy-foreground/40 text-4xl md:text-5xl">TO</span>
                    <br />
                    <span className="text-gold drop-shadow-[0_0_15px_rgba(212,175,55,0.3)]">{hero.destination}</span>
                  </>
                ) : (
                  <>
                    Your <span className="text-white/90 drop-shadow-sm">trusted</span>
                    <br />
                    partner for<br />
                    <span className="text-gold drop-shadow-[0_0_15px_rgba(212,175,55,0.3)]">better fares.</span>
                  </>
                )}
              </h2>

              <p className="max-w-md text-sm leading-relaxed text-white/60">
                {hero ? (
                  <>
                    Live group fare on {hero.airline} for {formatFlightDate(hero.flight_date || hero.flight_date)}. 
                    {hero.baggage ? ` Includes ${hero.baggage} baggage.` : ""}
                  </>
                ) : (
                  "Unlock competitive group fares, smart ticketing support and dependable travel solutions built for modern travel agents."
                )}
              </p>
            </div>
          </div>

          <div>



          {/* Agent discount highlight banner */}
          {!psfData?.registrationHidden && (
            <Link
              to="/agent/register"
              className="group relative mt-3 block overflow-hidden rounded-2xl border border-gold/40 bg-navy/40 px-6 py-4 text-center backdrop-blur-md transition-all hover:border-gold hover:shadow-[0_0_40px_-10px_rgba(212,175,55,0.4)]"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-gold/5 via-transparent to-gold/5 opacity-0 transition-opacity group-hover:opacity-100" />
              <div className="relative flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
                <span className="rounded-full bg-gold px-3 py-1 text-[10px] font-black uppercase tracking-[0.25em] text-navy shadow-lg shadow-gold/20">
                  Agent Exclusive
                </span>
                <span className="font-serif text-xl font-black uppercase tracking-tight text-white md:text-2xl">
                  Elevate Your Business with <span className="text-gold">Premium Fares</span>
                </span>
                <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-gold underline-offset-8 transition-all group-hover:gap-4 group-hover:underline">
                  Register Agency <span className="text-lg">→</span>
                </div>
              </div>
            </Link>
          )}



          {hero ? (
            <div key={hero.id} className="mt-1 grid animate-title-reveal items-center gap-8 lg:grid-cols-[1.4fr_1fr]">

              {/* Centerpiece — Urdu names, GROUP divider, airline logo (photo is now full hero bg) */}
              <div className="relative md:p-0">

                <div className="relative p-1 text-center md:p-2 animate-title-reveal">
                  <div
                    className="flex flex-col items-center justify-center gap-4"
                    dir="ltr"
                  >
                    {/* Restructured: city name above, code below, tightened vertical space */}
                    <div className="flex flex-col items-center justify-center">
                      <div className="flex items-center justify-center gap-8 font-serif text-3xl font-black tracking-widest text-white uppercase md:text-4xl">
                        <div className="flex flex-col items-center leading-tight">
                          <span className="text-xl md:text-2xl opacity-60 font-medium tracking-normal">{hero.origin}</span>
                          <span className="mt-0.5 text-4xl md:text-5xl font-black tracking-[0.1em] text-white leading-none">{hero.origin_code}</span>
                        </div>
                        <div className="flex flex-col items-center justify-center self-center mt-[10px] mx-2">
                          <span className="h-px w-10 bg-white/30" />
                          <span className="text-[16px] font-black text-white/50 mt-1">→</span>
                        </div>
                        <div className="flex flex-col items-center leading-tight">
                          <span className="text-xl md:text-2xl opacity-60 font-medium tracking-normal">{hero.destination}</span>
                          <span className="mt-0.5 text-4xl md:text-5xl font-black tracking-[0.1em] text-white leading-none">{hero.destination_code}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col items-center justify-center gap-2 text-white">
                      <div className="flex items-center justify-center gap-6" dir="rtl">
                        <span className="font-urdu text-3xl font-black tracking-tighter md:text-[4rem] text-gold drop-shadow-[0_8px_30px_rgba(212,175,55,0.2)] whitespace-nowrap leading-[1.2]">
                          {urduName(hero.origin, hero.origin_code)}
                        </span>
                        <span className="font-urdu text-3xl font-black tracking-tighter md:text-[4rem] text-gold drop-shadow-[0_8px_30px_rgba(212,175,55,0.2)] whitespace-nowrap leading-[1.2]">
                          {urduName(hero.destination, hero.destination_code)}
                        </span>
                      </div>
                      {hero.flight_details?.includes("--- RETURN ---") && (
                        <div className="flex items-center justify-center gap-4 -mt-2" dir="rtl">
                          <span className="font-urdu text-2xl font-black tracking-tighter md:text-[3rem] text-gold/80 drop-shadow-[0_4px_15px_rgba(212,175,55,0.1)] whitespace-nowrap leading-[1.2]">
                             (واپسی) {urduName(hero.origin, hero.origin_code)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mx-auto mt-8 flex max-w-md items-center gap-3">
                    <span className="h-px flex-1 bg-white/25" />
                    <Plane className="h-5 w-5 animate-fly-up text-gold" />
                    <span className="h-px flex-1 bg-white/25" />
                  </div>
                  <p className="mt-3 text-[11px] font-bold tracking-[0.4em] text-white/70">GROUP</p>

                  <div className="mt-2 flex justify-center">
                    <AirlineLogo name={hero.airline} height={60} />
                  </div>



                </div>

              </div>


              {/* Details panel */}
              <div>
                <div className="inline-flex items-center gap-2 text-xs font-semibold tracking-widest text-white/70">
                  <Clock className="h-3.5 w-3.5 text-gold" /> FLIGHT SCHEDULE
                  <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-gold/20 px-2 py-0.5 text-[10px] text-gold ring-1 ring-gold/40">
                    {isConnecting(hero) ? "CONNECTING" : "DIRECT"}
                  </span>
                </div>
                <div className="mt-2 space-y-1 font-mono text-base font-bold text-white">
                  {(() => {
                    const isReturn = hero.flight_details?.includes("--- RETURN ---");
                    if (isReturn) {
                      const [dep, ret] = (hero.flight_details || "").split("--- RETURN ---").map(s => s.trim());
                      return (
                        <div className="space-y-3">
                          <div className="space-y-1">
                            <p className="text-[10px] text-gold/60 tracking-widest font-sans font-black uppercase">Departure</p>
                            {dep.split(/\r?\n/).map((line, i) => <p key={i}>{line}</p>)}
                          </div>
                          <div className="space-y-1">
                            <p className="text-[10px] text-gold/60 tracking-widest font-sans font-black uppercase">Return</p>
                            {ret.split(/\r?\n/).map((line, i) => <p key={i}>{line}</p>)}
                          </div>
                        </div>
                      );
                    }
                    return ((hero.flight_details && hero.flight_details.trim())
                      ? hero.flight_details.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
                      : [formatFlightLine(hero)].filter(Boolean)
                    ).map((line, i) => (
                      <p key={i}>{line}</p>
                    ));
                  })()}
                  {!hero.flight_details?.includes("--- RETURN ---") && hero.flight_number && (
                    <p className="text-white/70">· {hero.flight_number}</p>
                  )}
                </div>
                {hero.baggage && (
                  <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/5 px-3 py-1 text-xs font-semibold text-gold ring-1 ring-gold/40">
                    <Luggage className="h-3 w-3" /> {hero.baggage}
                  </span>
                )}
                <p className="mt-6 text-[11px] font-semibold tracking-[0.3em] text-white/60 uppercase">Group Fare</p>
                <p className="text-4xl font-black text-gold md:text-5xl">
                  {(() => {
                    const displayPrice = applyCommission(hero.price_text, commission);
                    return formatFare(displayPrice);
                  })()}
                </p>
                <button
                  type="button"
                  onClick={() => openWhatsApp(buildBookNowText(hero, (hero.flight_details && hero.flight_details.trim()) ? hero.flight_details.split(/\r?\n/).map((l) => l.trim()).filter(Boolean) : [formatFlightLine(hero)].filter(Boolean)))}
                  className="group relative mt-4 inline-flex items-center gap-3 overflow-hidden rounded-xl bg-gold px-6 py-4 text-sm font-black uppercase tracking-widest text-navy shadow-[0_10px_30px_-10px_rgba(212,175,55,0.5)] transition-all hover:-translate-y-1 hover:shadow-[0_20px_40px_-10px_rgba(212,175,55,0.6)] active:scale-95"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 -translate-x-full group-hover:animate-[sweep_1.5s_ease-in-out_infinite]" />
                  <MessageCircle className="h-5 w-5 fill-navy" />
                  <span>Book Now</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-10 text-center text-white/70">No fares yet. Add some from the admin panel.</div>
          )}

          {/* Rotation indicator */}
          {fares.length > 1 && (
            <div className="mt-8 flex justify-center gap-1.5">
              {fares.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setHeroIdx(i)}
                  aria-label={`Show fare ${i + 1}`}
                  className={`h-1.5 rounded-full transition-all ${
                    i === heroIdx ? "w-8 bg-gold" : "w-1.5 bg-white/25 hover:bg-white/40"
                  }`}
                />
              ))}
            </div>
          )}
          </div>
        </div>

      </section>

      {/* Search + Filters */}
      <section className="mx-auto max-w-7xl px-4 -mt-8 relative z-10">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            applySearch();
          }}
          className="grid gap-3 rounded-xl bg-card p-3 shadow-[var(--shadow-card)] ring-1 ring-border md:grid-cols-[1fr_1fr_auto]"
        >
          <div className="relative">
            <label className="flex items-center gap-3 rounded-lg px-4 py-3 ring-1 ring-transparent focus-within:ring-gold">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <div className="flex-1">
                <div className="text-[10px] font-bold tracking-widest text-muted-foreground">ORIGIN</div>
                <input
                  value={origin}
                  onChange={(e) => setOrigin(e.target.value)}
                  onFocus={() => setOriginFocus(true)}
                  onBlur={() => setTimeout(() => setOriginFocus(false), 150)}
                  placeholder="e.g. Karachi or KHI"
                  className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
                />
              </div>
              {origin && (
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setOrigin("");
                  }}
                  className="text-muted-foreground hover:text-foreground"
                  aria-label="Clear origin"
                >
                  ×
                </button>
              )}
            </label>
            {originFocus && originSuggestions.length > 0 && (
              <ul className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-border bg-popover shadow-lg">
                {originSuggestions.map((o) => (
                  <li key={`${o.city}-${o.code}`}>
                    <button
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setOrigin(o.city);
                        setOriginFocus(false);
                      }}
                      className="flex w-full items-center justify-between px-4 py-2 text-left text-sm hover:bg-muted"
                    >
                      <span className="font-semibold">{o.city}</span>
                      <span className="text-xs text-muted-foreground">{o.code}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="relative">
            <label className="flex items-center gap-3 rounded-lg px-4 py-3 ring-1 ring-transparent focus-within:ring-gold">
              <Plane className="h-4 w-4 text-muted-foreground" />
              <div className="flex-1">
                <div className="text-[10px] font-bold tracking-widest text-muted-foreground">DESTINATION</div>
                <input
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  onFocus={() => setDestFocus(true)}
                  onBlur={() => setTimeout(() => setDestFocus(false), 150)}
                  placeholder="e.g. Jeddah or JED"
                  className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
                />
              </div>
              {destination && (
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setDestination("");
                  }}
                  className="text-muted-foreground hover:text-foreground"
                  aria-label="Clear destination"
                >
                  ×
                </button>
              )}
            </label>
            {destFocus && destSuggestions.length > 0 && (
              <ul className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-border bg-popover shadow-lg">
                {destSuggestions.map((o) => (
                  <li key={`${o.city}-${o.code}`}>
                    <button
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setDestination(o.city);
                        setDestFocus(false);
                      }}
                      className="flex w-full items-center justify-between px-4 py-2 text-left text-sm hover:bg-muted"
                    >
                      <span className="font-semibold">{o.city}</span>
                      <span className="text-xs text-muted-foreground">{o.code}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <button
            type="submit"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-gold px-6 py-3 text-sm font-bold text-gold-foreground shadow-sm hover:brightness-95"
          >
            <Plane className="h-4 w-4" /> VIEW FARES
          </button>
        </form>

        {hasSearch && (
          <button
            type="button"
            onClick={clearSearch}
            className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground"
          >
            × Clear search
          </button>
        )}

        <div className="mt-6 flex flex-wrap items-center gap-2">
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => {
                setActiveCat(c);
                setOrigin("");
                setDestination("");
                setAppliedOrigin("");
                setAppliedDestination("");
              }}
              className={`rounded-full px-4 py-1.5 text-xs font-bold tracking-widest transition ${
                activeCat === c
                  ? "bg-navy text-navy-foreground ring-1 ring-gold"
                  : "bg-secondary text-secondary-foreground hover:bg-muted"
              }`}
            >
              {c === "ALL" ? "ALL DESTINATIONS" : c}
            </button>
          ))}
        </div>
      </section>

      {/* Trending destinations */}
      <section className="mx-auto mt-10 max-w-7xl px-4">
        <div>
          <h2 className="font-serif text-2xl font-black text-navy">TRENDING DESTINATIONS</h2>
          <p className="text-sm text-muted-foreground">Tap a tile to filter live fares</p>
        </div>
        <div className="mt-5 grid gap-3 grid-cols-2 md:grid-cols-4 lg:grid-cols-7">
          <div className="relative overflow-hidden rounded-xl bg-navy p-3 text-white shadow-[var(--shadow-hero)] col-span-2 lg:col-span-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2 py-0.5 text-[9px] font-bold tracking-widest text-gold ring-1 ring-white/20">
              <span className="h-1 w-1 rounded-full bg-gold" /> LIVE
            </span>
            <p className="mt-2 font-serif text-3xl font-black leading-none">{fares.length}</p>
            <p className="mt-1 text-[9px] font-bold tracking-[0.25em] text-white/70">GROUP FARES</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <div className="rounded-md bg-white/5 p-2 ring-1 ring-white/10">
                <p className="text-[9px] font-bold tracking-widest text-white/60">AIRLINES</p>
                <p className="mt-0.5 font-serif text-lg font-black text-white">
                  {new Set(fares.map((f) => f.airline)).size}
                </p>
              </div>
              <div className="rounded-md bg-white/5 p-2 ring-1 ring-white/10">
                <p className="text-[9px] font-bold tracking-widest text-white/60">ROUTES</p>
                <p className="mt-0.5 font-serif text-lg font-black text-white">
                  {new Set(fares.map((f) => `${f.origin_code}-${f.destination_code}`)).size}
                </p>
              </div>
            </div>
          </div>
          {(() => {
            const m = new Map<string, { city: string; code: string; count: number }>();
            fares.forEach((f) => {
              const key = f.destination_code || f.destination;
              const prev = m.get(key);
              if (prev) prev.count += 1;
              else m.set(key, { city: f.destination, code: f.destination_code, count: 1 });
            });
            return Array.from(m.values())
              .sort((a, b) => b.count - a.count)
              .map((d, i) => (
                <button
                  key={d.code || d.city}
                  onClick={() => {
                    setOrigin("");
                    setDestination(d.city);
                    setAppliedOrigin("");
                    setAppliedDestination(d.city);
                    setActiveCat("ALL");
                  }}
                  className={`${CARD_STYLES[i % CARD_STYLES.length]} group relative overflow-hidden rounded-xl p-3 text-left text-white shadow-[var(--shadow-card)] transition hover:-translate-y-0.5`}
                >
                  <span className="rounded bg-black/25 px-1.5 py-0.5 text-[9px] font-bold tracking-widest text-white/90">
                    {d.code || "—"}
                  </span>
                  <p className="mt-4 font-serif text-lg font-black leading-tight">{d.city.toUpperCase()}</p>
                  <p className="mt-0.5 text-[10px] text-white/85">
                    {d.count} {d.count === 1 ? "fare" : "fares"}
                  </p>
                </button>
              ));
          })()}
        </div>

      </section>

      {/* Fare list */}
      <section className="mx-auto mt-12 max-w-7xl px-4 pb-16">
        <div className="flex items-baseline justify-between">
          <h2 className="font-serif text-2xl font-black text-navy">
            {activeCat === "ALL" ? "ALL LIVE FARES" : activeCat}
          </h2>
          <p className="text-xs font-semibold text-muted-foreground">
            {filtered.length} {filtered.length === 1 ? "result" : "results"}
          </p>
        </div>
        <div className="mt-5 grid gap-4 grid-cols-1">
          {filtered.map((f) => (
            <FareCard key={f.id} f={f} commission={commission} />
          ))}
          {filtered.length === 0 && (
            <p className="col-span-full py-10 text-center text-sm text-muted-foreground">
              No fares match your filter.
            </p>
          )}
        </div>
      </section>
      </main>

      {/* Our Services — rotating marquee */}
      {services.length > 0 && (
        <section id="our-services" className="bg-gradient-to-b from-secondary/40 via-white to-secondary/40 py-16 mb-12 md:mb-16">
          <div className="mx-auto max-w-7xl px-4">
            <div className="mb-8 text-center">
              <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-gold">What we offer</p>
              <h2 className="mt-1 font-serif text-3xl font-black text-navy md:text-4xl">Our Services</h2>
              <div className="mx-auto mt-2 h-0.5 w-16 bg-gold" />
              <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground">Tap any service to send an instant WhatsApp inquiry — we reply within minutes.</p>
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
                      className="group/card relative flex h-44 w-64 flex-shrink-0 overflow-hidden rounded-2xl border border-gold/30 shadow-xl ring-1 ring-black/5 transition hover:-translate-y-1 hover:shadow-2xl hover:ring-gold"
                    >
                      <img
                        src={img}
                        alt={`Travel service: ${s.label}`}
                        loading="lazy"
                        className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover/card:scale-110"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-navy via-navy/60 to-transparent" />
                      <div className="relative z-10 mt-auto flex w-full items-end justify-between gap-2 p-4">
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-gold">Book now</p>
                          <h3 className="mt-1 font-serif text-lg font-black leading-tight text-white drop-shadow">{s.label}</h3>
                        </div>
                        <span className="inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-gold text-navy shadow-lg transition group-hover/card:scale-110">
                          <Plane className="h-4 w-4" aria-hidden="true" />
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
            <p className="mt-8 text-center text-xs text-muted-foreground">
              Need one of these? <Link to="/inquiry" className="font-semibold text-navy hover:text-gold hover:underline">Send your query</Link> and we'll respond on WhatsApp.
            </p>
          </div>
        </section>
      )}



      {/* Footer */}
      <footer className="bg-navy text-navy-foreground">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 md:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-1">
            <div className="flex items-center gap-3">
              <img src="/favicon.png" alt="Rohi International Travels" className="h-20 w-20 object-contain drop-shadow-lg" />
              <div>
                <p className="font-serif text-lg font-black leading-tight">ROHI INTERNATIONAL TRAVELS</p>
                
              </div>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-white/70">
              Trusted Travel Partner delivering live group fares One Way Groups like UAE, Oman, Saudia Arabia also Umrah Groups, System Ticketing also available with fast service. After Sales Support, B2B System and Group Fares. Feel free to contact us 24/7.
            </p>
            <div className="mt-5 flex items-center gap-2">
              <a href="https://www.facebook.com/rohitravelsryk" target="_blank" rel="noopener noreferrer" aria-label="Facebook" className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 transition hover:bg-gold hover:text-navy">
                <Facebook className="h-4 w-4" />
              </a>
              <a href="https://www.instagram.com/rohitravels/" target="_blank" rel="noopener noreferrer" aria-label="Instagram" className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 transition hover:bg-gold hover:text-navy">
                <Instagram className="h-4 w-4" />
              </a>
              <a href="https://www.tiktok.com/@rohitravelsryk" target="_blank" rel="noopener noreferrer" aria-label="TikTok" className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 transition hover:bg-gold hover:text-navy">
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
                  <path d="M19.6 6.3a5.6 5.6 0 0 1-3.3-1.1 5.6 5.6 0 0 1-2.2-3.7h-3.3v13.5a2.7 2.7 0 1 1-2.7-2.7c.3 0 .5 0 .8.1V8.9a6 6 0 0 0-.8-.1 6 6 0 1 0 6 6V8.5a8.9 8.9 0 0 0 5.5 1.9V7.1a5.5 5.5 0 0 1-0-.8z"/>
                </svg>
              </a>
            </div>
          </div>

          <div>
            <p className="text-xs font-bold tracking-widest text-gold">CONTACT</p>
            <a href={`tel:${PHONE_TEL}`} className="mt-3 flex items-center gap-2 text-sm text-white/90 hover:text-gold">
              <Phone className="h-4 w-4" /> {PHONE}
            </a>
            <a href={WA_LINK} onClick={(e) => { e.preventDefault(); openWhatsApp(); }} target="_blank" rel="noopener noreferrer" className="mt-2 flex items-center gap-2 text-sm text-white/90 hover:text-gold">
              <MessageCircle className="h-4 w-4 text-whatsapp" /> WhatsApp {PHONE}
            </a>
            <a href="mailto:rohitravels@gmail.com" className="mt-2 flex items-center gap-2 text-sm text-white/90 hover:text-gold">
              <Mail className="h-4 w-4" /> rohitravels@gmail.com
            </a>
            <a href="https://chat.whatsapp.com/HqDEujBmo0pESFjeb7Pikx" target="_blank" rel="noopener noreferrer" className="mt-4 flex items-center gap-2 rounded-lg bg-whatsapp/15 px-3 py-2 text-xs font-bold text-whatsapp hover:bg-whatsapp/25">
              <Users className="h-4 w-4" /> Join WhatsApp Community
            </a>
            <a href="https://whatsapp.com/channel/0029VaDCohpDuMReHyrIgs1f" target="_blank" rel="noopener noreferrer" className="mt-2 flex items-center gap-2 rounded-lg bg-whatsapp/15 px-3 py-2 text-xs font-bold text-whatsapp hover:bg-whatsapp/25">
              <Radio className="h-4 w-4" /> Follow WhatsApp Channel
            </a>
            <a href="https://g.page/r/CU1NtsPDbGPiEAE/review" target="_blank" rel="noopener noreferrer" className="mt-2 flex items-center gap-2 rounded-lg bg-gold/15 px-3 py-2 text-xs font-bold text-gold hover:bg-gold/25">
              <Star className="h-4 w-4" /> Leave a Google Review
            </a>
          </div>

          <div>
            <p className="text-xs font-bold tracking-widest text-gold">LIVE FARES</p>
            <p className="mt-3 text-sm text-white/70">
              Send your query to get best and cheapest rates.
            </p>
            <a href="mailto:rohitravels@gmail.com" className="mt-3 flex items-center gap-2 text-sm text-white/90 hover:text-gold">
              <Mail className="h-4 w-4" /> rohitravels@gmail.com
            </a>
            <a href={WA_LINK} onClick={(e) => { e.preventDefault(); openWhatsApp(); }} target="_blank" rel="noopener noreferrer" className="mt-2 flex items-center gap-2 text-sm text-white/90 hover:text-gold">
              <MessageCircle className="h-4 w-4 text-whatsapp" /> {PHONE}
            </a>
          </div>

          <div>
            <p className="text-xs font-bold tracking-widest text-gold">FIND US</p>
            <div className="mt-3 overflow-hidden rounded-lg border border-white/10">
              <iframe
                title="Rohi International Travels — Google Maps"
                src="https://www.google.com/maps?q=Rohi+International+Travels,+Rahim+Yar+Khan&output=embed"
                width="100%"
                height="180"
                style={{ border: 0 }}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                allowFullScreen
              />
            </div>
            <a href="https://www.google.com/maps/place/Rohi+International+Travels/@28.4225455,70.3078476,17z" target="_blank" rel="noopener noreferrer" className="mt-2 flex items-center gap-2 text-xs text-white/70 hover:text-gold">
              <MapPin className="h-3.5 w-3.5" /> Open in Google Maps
            </a>
          </div>
        </div>
        <div className="border-t border-white/10 py-4 text-center text-xs text-white/50">
          © {new Date().getFullYear()} Rohi International Travels. All rights reserved.
        </div>
      </footer>

    </div>
  );
}

function isConnecting(f: Fare) {
  const scheduleLines = cleanFlightLines(f);
  // Match IATA sectors like "KHI MCT" in the schedule lines
  const segments = scheduleLines.map(line => {
    const m = line.match(/\b([A-Z]{3})\s*[-\/→\s]\s*([A-Z]{3})\b/);
    return m ? `${m[1]} ${m[2]}` : null;
  }).filter(Boolean);
  
  // If we have more than one unique sector, or it's a return fare, it's not a simple direct one-way
  return segments.length > 1 || (f.flight_details?.includes("--- RETURN ---") ?? false);
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

function normalizeBaggageText(value?: string | null) {
  return (value ?? "").replace(/\s*KG$/i, " KG").replace(/\s+/g, " ").trim();
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
  const rawLines = (f.flight_details ?? "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const flightLinePattern = /^\d{1,2}\s+[A-Z]{3}\s+[A-Z]{3}\s+[A-Z]{3}\s+\d{3,4}\s+\d{3,4}$/i;
  const datedLinePattern = /^\d{1,2}\s+[A-Z]{3}\b/i;
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

  // Extract unique sectors from schedule lines (e.g. KHI MCT, MCT MED)
  const segments = scheduleLines.map(line => {
    // Look for patterns like KHI MCT or KHI-MCT or KHI/MCT
    const m = line.match(/\b([A-Z]{3})\s*[-\/→\s]\s*([A-Z]{3})\b/);
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
    <article className="group relative overflow-hidden rounded-2xl bg-card shadow-[var(--shadow-card)] ring-1 ring-border transition hover:-translate-y-0.5 hover:ring-gold/60">
      <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)_minmax(220px,0.7fr)]">
        {/* LEFT: Route + airline */}
        <div className="relative p-6 md:p-7">
          <div className="grid grid-cols-[1fr_auto] gap-4">
            <div className="min-w-0">
              <h4 className="font-serif text-2xl font-black tracking-tight text-navy md:text-3xl">
                {f.origin.toUpperCase()}
                <span className="mx-2 text-navy/80">→</span>
                {f.destination.toUpperCase()}
                {isReturn && (
                  <>
                    <span className="mx-2 text-navy/80">→</span>
                    {f.origin.toUpperCase()}
                  </>
                )}
              </h4>
              <p className="mt-1 text-xs font-bold tracking-[0.25em] text-muted-foreground">
                {f.origin_code} <span className="mx-1">→</span> {f.destination_code}
              </p>
            </div>
            <div
              className="font-urdu flex flex-col items-center justify-center self-center"
              lang="ur"
              dir="rtl"
            >
              <div className="flex items-center justify-center gap-2 px-2 py-0.5 rounded-md align-middle">
                <span className="inline-flex items-center justify-center text-[28px] leading-none !text-black">
                  {urduName(f.origin, f.origin_code)} {urduName(f.destination, f.destination_code)} {isReturn ? urduName(f.origin, f.origin_code) : ""}
                </span>
                <span className="text-gold text-xs font-bold mr-2">{isReturn ? "(عمرہ)" : ""}</span>
              </div>
            </div>
          </div>

          <div className="mt-5 flex items-center gap-3">
            <span className="h-px flex-1 bg-border" />
            <Plane className="h-4 w-4 animate-fly-up text-gold" />
            <span className="h-px flex-1 bg-border" />
          </div>
          <p className={`mt-2 text-center text-[10px] font-bold tracking-[0.35em] ${isDirect ? "text-emerald-600" : "text-gold"}`}>
            {isDirect ? "DIRECT FLIGHT" : "CONNECTING FLIGHT"}
          </p>

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

          <div className="mt-3 space-y-1.5 font-mono text-sm font-bold text-navy">
            {scheduleLines.length > 0 ? (
              scheduleLines.map((line, i) => {
                const parts = line.split(/\s+/);
                const isDay = /^\d{1,2}$/.test(parts[0] ?? "");
                const dateTok = isDay ? `${parts[0]} ${parts[1] ?? ""}`.trim() : parts[0] ?? "";
                const rest = (isDay ? parts.slice(2) : parts.slice(1)).join(" ");
                return (
                  <p key={i} className="flex items-center gap-2">
                    <span
                      className="inline-block rounded bg-muted px-1.5 py-0.5 text-[11px] font-black tracking-wide text-navy"
                    >
                      {dateTok}
                    </span>
                    <span>{rest}</span>
                  </p>
                );
              })
            ) : (
              <p className="text-muted-foreground">—</p>
            )}
          </div>

          {f.baggage && (
            <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-gold/15 px-3 py-1 text-[11px] font-bold text-navy ring-1 ring-gold/40">
              <Luggage className="h-3 w-3 text-gold" /> {f.baggage}
            </span>
          )}

          {f.flight_number && (
            <p className="mt-3 font-mono text-[11px] tracking-widest text-muted-foreground">
              FLIGHT <span className="font-bold text-navy">{f.flight_number}</span>
            </p>
          )}
        </div>


        {/* RIGHT: Navy CTA panel */}
        <div className="relative overflow-hidden bg-navy p-6 text-navy-foreground">
          <div className="pointer-events-none absolute inset-0 bg-plane-lines opacity-60" />
          <div className="relative flex h-full flex-col items-center justify-center gap-3 text-center">
            <p className="text-[10px] font-bold tracking-[0.4em] text-gold">GROUP FARE</p>
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


            <p className="text-[10px] text-white/60">Instant WhatsApp booking</p>
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
  ISTANBUL: "استنبول", GASSIM: "قصیم", QASSIM: "قصیم", ELQ: "قصیم",
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
  JAZEERA: "J9", JAZEERAAIRWAYS: "J9",
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
};

export function AirlineLogo({ name, height = 40, className = "" }: { name: string; height?: number; className?: string }) {
  const iata = airlineIata(name);
  if (!iata) {
    return <span className={`text-xs font-bold tracking-wide ${className}`}>{name}</span>;
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
      style={{ height, width: "auto", background: "transparent" }}
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









