import { Link, useRouter } from "@tanstack/react-router";
import { ArrowLeft, Headphones, Home, Phone, ShieldCheck } from "lucide-react";
import { LatestUpdatesButton } from "./LatestUpdatesButton";
import { useQuery } from "@tanstack/react-query";
import { getPsf } from "@/lib/fares.functions";
import { useEffect, useState } from "react";


const PHONE = "0305 6622988";
const WA_PHONE = "923056622988";
const WA_LINK = `https://wa.me/${WA_PHONE}`;

/**
 * Single consolidated navigation header shown on every public page,
 * including the homepage. Includes the Rohi logo + trust line, all menu
 * links, WhatsApp button, Agent Login / Register, one Latest Updates
 * button, and a subtle Admin Panel link — all inside one header block
 * (no separate stacked utility strip). Hidden on admin/agent routes and
 * the print view.
 */
export function SiteHeader() {
  const router = useRouter();
  const path = router.state.location.pathname;
  const [hydrated, setHydrated] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    setHydrated(true);
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  
  const { data: psfData } = useQuery({
    queryKey: ["site-settings", "psf"],
    queryFn: () => getPsf(),
  });

  // Don't render on admin/agent routes or print view
  if (path === "/print-format" || path === "/testing" || path.startsWith("/admin") || (path.startsWith("/agent") && path !== "/agent/login" && path !== "/agent/register")) return null;

  const navItems = [
    { to: "/discountvouchers", label: "Vouchers" },
    { to: "/calculator", label: "Calculators" },
    { to: "/services", label: "Our Services" },
    { to: "/verify-visa", label: "Verify Visa" },
    { to: "/testing", label: "Testing" },
  ];

  return (
    <>
      {/* Floating Back + Home - Fixed position but integrated look */}
      {path !== "/" && (
        <div className="fixed left-3 top-[10px] z-[90] flex items-center gap-2 print:hidden">
          <button
            type="button"
            onClick={() => router.history.back()}
            className="inline-flex items-center gap-1.5 rounded-full border border-gold/30 bg-navy/90 px-3.5 py-2 text-[10px] font-bold uppercase tracking-widest text-navy-foreground shadow-lg backdrop-blur transition hover:border-gold hover:text-gold"
            aria-label="Go back"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back
          </button>
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 rounded-full border border-gold/30 bg-navy/90 px-3.5 py-2 text-[10px] font-bold uppercase tracking-widest text-navy-foreground shadow-lg backdrop-blur transition hover:border-gold hover:text-gold"
            aria-label="Go to homepage"
          >
            <Home className="h-3.5 w-3.5" /> Home
          </Link>
        </div>
      )}

      {/* Single consolidated header */}
      <header
        className={`sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur transition-[box-shadow,border-color] duration-300 supports-[backdrop-filter]:bg-background/80 print:hidden ${
          scrolled ? "border-border shadow-[0_4px_20px_-8px_rgba(15,23,42,0.15)]" : "border-transparent"
        }`}
      >
        <div className="mx-auto flex max-w-7xl flex-col gap-2.5 px-4 py-3 lg:flex-row lg:items-center lg:justify-between lg:gap-6">
          <div className="flex shrink-0 items-center justify-between gap-3 lg:justify-start">
            <Link to="/" className="group flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-navy/5 ring-1 ring-gold/40 transition-transform duration-300 group-hover:scale-105 group-hover:ring-gold">
                <img src="/favicon.png" alt="Rohi International Travels" className="h-10 w-10 object-contain" />
              </span>
              <span>
                <span className="block font-serif text-lg font-black uppercase leading-[1.05] tracking-[0.02em] text-navy sm:text-xl">
                  Rohi <span className="text-gold">International</span>
                  <br className="hidden sm:block" /> Travels
                </span>
                <span className="mt-1 hidden items-center gap-2.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground sm:flex">
                  <span className="inline-flex items-center gap-1">
                    <ShieldCheck className="h-3 w-3 text-gold" /> Since 1991
                  </span>
                  <span className="text-border">·</span>
                  <span className="inline-flex items-center gap-1">
                    <Headphones className="h-3 w-3 text-gold" /> 24/7 Support
                  </span>
                  <span className="text-border">·</span>
                  <span className="inline-flex items-center gap-1 text-gold">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-gold opacity-75" />
                      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-gold" />
                    </span>
                    Live Group Fares
                  </span>
                </span>
              </span>
            </Link>

            <Link
              to="/admin"
              className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-[9px] font-bold uppercase tracking-widest text-muted-foreground transition hover:border-gold/50 hover:text-gold lg:hidden"
            >
              <ShieldCheck className="h-3 w-3" /> Admin
            </Link>
          </div>

          <nav aria-label="Main" className="flex flex-wrap items-center gap-1.5 lg:justify-end">
            {navItems.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="group relative inline-flex items-center rounded-full px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-navy/80 transition-all duration-[var(--duration-base)] ease-[var(--ease-premium)] hover:bg-navy/5 hover:text-navy"
              >
                {item.label}
                <span className="pointer-events-none absolute bottom-1 left-3 right-3 h-[2px] origin-left scale-x-0 bg-gold transition-transform duration-300 ease-[var(--ease-premium)] group-hover:scale-x-100" />
              </Link>
            ))}

            <span className="mx-1 hidden h-6 w-px bg-border lg:block" />

            <a
              href={WA_LINK}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Chat with Rohi International Travels on WhatsApp at ${PHONE}`}
              className="inline-flex items-center gap-1.5 rounded-full bg-whatsapp px-3.5 py-2 text-[11px] font-bold text-whatsapp-foreground shadow-sm transition hover:scale-105 hover:opacity-90 active:scale-95"
            >
              <Phone className="h-3.5 w-3.5" aria-hidden="true" />
              {PHONE}
            </a>

            <LatestUpdatesButton key="latest-updates-btn" className="hidden lg:inline-flex" />

            <Link
              to="/agent/login"
              className="inline-flex h-[38px] items-center rounded-full bg-navy px-4 text-[11px] font-black uppercase tracking-widest text-navy-foreground shadow-sm transition-all hover:scale-105 hover:opacity-90 active:scale-95"
            >
              Agent Login
            </Link>
            {hydrated && !psfData?.registrationHidden && (
              <Link
                to="/agent/register"
                className="inline-flex h-[38px] items-center rounded-full bg-gold px-4 text-[11px] font-black uppercase tracking-widest text-navy shadow-sm transition-all hover:scale-105 hover:opacity-90 active:scale-95"
              >
                Register
              </Link>
            )}

            <Link
              to="/admin"
              className="hidden items-center gap-1.5 rounded-full border border-border px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground transition hover:border-gold/50 hover:text-gold lg:inline-flex"
            >
              <ShieldCheck className="h-3 w-3" /> Admin Panel
            </Link>
          </nav>
        </div>
      </header>
    </>
  );
}
