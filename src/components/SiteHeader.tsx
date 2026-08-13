import { Link, useRouter } from "@tanstack/react-router";
import { ArrowLeft, Bell, Headphones, Home, Phone, ShieldCheck } from "lucide-react";
import { LatestUpdatesButton } from "./LatestUpdatesButton";
import { useQuery } from "@tanstack/react-query";
import { getPsf } from "@/lib/fares.functions";

const PHONE = "0305 6622988";
const WA_PHONE = "923056622988";
const WA_LINK = `https://wa.me/${WA_PHONE}`;

/**
 * Full navigation bar shown on every public sub-page (Services, Inquiry,
 * Vouchers, etc.). Includes the Rohi logo, all menu links, WhatsApp button,
 * Agent Login + Register buttons, plus Back / Home controls.
 * Hidden on the homepage (which has its own header) and on admin/agent routes.
 */
export function SiteHeader() {
  const router = useRouter();
  const path = router.state.location.pathname;
  
  const { data: psfData } = useQuery({
    queryKey: ["site-settings", "psf"],
    queryFn: () => getPsf(),
  });

  // Don't render on admin/agent routes or print view
  if (path === "/print-format" || path.startsWith("/admin") || (path.startsWith("/agent") && path !== "/agent/login" && path !== "/agent/register")) return null;

  const navItems = [
    { to: "/discountvouchers", label: "Discount Vouchers" },
    { to: "/calculator", label: "Calculators" },
    { to: "/services", label: "Our Services" },
    { to: "/verify-visa", label: "Verify Visa" },
  ];

  return (
    <>
      {/* Top strip */}
      <div className="bg-navy text-navy-foreground text-xs print:hidden">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-2">
          <div className="flex flex-wrap items-center gap-4">
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-gold" /> Since 1991
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Headphones className="h-3.5 w-3.5 text-gold" /> 24/7 Support
            </span>
            <span className="inline-flex items-center gap-1.5 text-gold">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-gold opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-gold" />
              </span>
              LIVE GROUP FARES
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/admin"
              className="inline-flex items-center gap-1.5 rounded-sm border border-gold/60 bg-gold/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.25em] text-gold transition hover:bg-gold hover:text-gold-foreground"
            >
              <ShieldCheck className="h-3 w-3" /> Admin Panel
            </Link>
          </div>
        </div>
      </div>

      {/* Floating Back + Home - Fixed position but integrated look */}
      <div className="fixed left-3 top-[44px] z-[90] flex items-center gap-2 print:hidden lg:top-[44px]">
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

      {/* Main header */}
      <header className="sticky top-0 z-40 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 lg:flex-row lg:items-center lg:justify-between lg:gap-6">
          <Link to="/" className="flex shrink-0 items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-navy/5 ring-1 ring-gold/40">
              <img src="/favicon.png" alt="Rohi International Travels" className="h-10 w-10 object-contain" />
            </span>
            <h1 className="font-serif text-lg font-black uppercase leading-[1.05] tracking-[0.02em] text-navy sm:text-xl">
              Rohi <span className="text-gold">International</span>
              <br className="hidden sm:block" /> Travels
            </h1>
          </Link>

          <nav aria-label="Main" className="flex flex-wrap items-center gap-1.5 lg:justify-end">
            {navItems.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="inline-flex items-center rounded-full px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-navy/80 transition hover:bg-navy/5 hover:text-navy"
              >
                {item.label}
              </Link>
            ))}

            <span className="mx-1 hidden h-6 w-px bg-border lg:block" />

            <a
              href={WA_LINK}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Chat with Rohi International Travels on WhatsApp at ${PHONE}`}
              className="inline-flex items-center gap-1.5 rounded-full bg-whatsapp px-3.5 py-2 text-[11px] font-bold text-whatsapp-foreground shadow-sm transition hover:opacity-90"
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
            {!psfData?.registrationHidden && (
              <div className="flex items-center gap-2">
                <Link
                  to="/agent/register"
                  className="inline-flex h-[38px] items-center rounded-full bg-gold px-4 text-[11px] font-black uppercase tracking-widest text-navy shadow-sm transition-all hover:scale-105 hover:opacity-90 active:scale-95"
                >
                  Register
                </Link>
                <Link
                  to="/latest-updates"
                  className="inline-flex h-[38px] items-center gap-2 rounded-full bg-black px-4 text-[11px] font-black uppercase tracking-widest text-gold shadow-sm transition-all hover:scale-105 hover:opacity-90 active:scale-95"
                >
                  <Bell className="h-3.5 w-3.5" />
                  Latest Updates
                </Link>
              </div>
            )}
          </nav>
        </div>
      </header>
    </>
  );
}
