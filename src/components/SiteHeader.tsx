import { Link, useRouter } from "@tanstack/react-router";
import { Phone, ShieldCheck } from "lucide-react";
import { LatestUpdatesButton } from "./LatestUpdatesButton";
import { useQuery } from "@tanstack/react-query";
import { getPsf } from "@/lib/fares.functions";
import { useEffect, useState } from "react";


const PHONE_DISPLAY = "+92-0305-6622988";
const WA_PHONE = "923056622988";
const WA_LINK = `https://wa.me/${WA_PHONE}`;

/**
 * Single consolidated navigation header shown on every public page,
 * including the homepage. Every nav item and action button is a
 * standalone, always-visible item in one row (wrapping on narrow
 * screens) — no dropdowns, no hidden "more" panel. Only Admin Panel
 * stays as a small subtle icon-link since it's not a customer-facing
 * action. Hidden on admin/agent routes and the print view.
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
    { to: "/services", label: "Our Services" },
    { to: "/verify-visa", label: "Verify Visa" },
    { to: "/discountvouchers", label: "Vouchers" },
    { to: "/calculator", label: "Calculators" },
    { to: "/test", label: "Test Page" },
  ];

  return (
    <>
      {/* Single consolidated header */}
      <header
        className={`sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur transition-[box-shadow,border-color] duration-300 supports-[backdrop-filter]:bg-background/80 print:hidden ${
          scrolled ? "border-border shadow-[0_4px_20px_-8px_rgba(15,23,42,0.15)]" : "border-transparent"
        }`}
      >
        <div className="mx-auto flex max-w-7xl flex-col gap-2.5 px-4 py-3 lg:flex-row lg:items-center lg:justify-between lg:gap-6">
          <Link to="/" className="group flex shrink-0 items-center gap-3">
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
                  <Phone className="h-3 w-3 text-gold" /> 24/7 Support
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

          <nav aria-label="Main" className="flex flex-wrap items-center gap-0.5 lg:flex-nowrap lg:justify-end">
            {navItems.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="whitespace-nowrap rounded-md px-3 py-2 text-[15px] font-medium text-navy/75 transition-colors duration-150 hover:text-navy"
              >
                {item.label}
              </Link>
            ))}

            <span className="mx-1.5 hidden h-5 w-px bg-border lg:block" />

            <a
              href={WA_LINK}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Chat with Rohi International Travels on WhatsApp at ${PHONE_DISPLAY}`}
              className="group ml-2 flex flex-col items-start leading-tight"
            >
              <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">24/7 Helpline</span>
              <span className="inline-flex items-center gap-1.5 text-[14px] font-bold text-whatsapp transition-colors group-hover:text-whatsapp/80">
                <Phone className="h-3.5 w-3.5" /> {PHONE_DISPLAY}
              </span>
            </a>

            <LatestUpdatesButton key="latest-updates-btn" className="ml-1" />

            <Link
              to="/agent/login"
              className="ml-1 whitespace-nowrap rounded-md px-3 py-2 text-[15px] font-medium text-navy/75 transition-colors duration-150 hover:text-navy"
            >
              Agent Login
            </Link>
            {hydrated && !psfData?.registrationHidden && (
              <Link
                to="/agent/register"
                className="ml-1 inline-flex h-10 items-center whitespace-nowrap rounded-lg bg-gold px-4 text-[14px] font-semibold text-gold-foreground shadow-sm transition-all hover:opacity-90 active:scale-[0.98]"
              >
                Register agency
              </Link>
            )}

            <Link
              to="/admin"
              title="Admin Panel"
              aria-label="Admin Panel"
              className="ml-1 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-navy/40 transition-colors hover:bg-navy/5 hover:text-navy"
            >
              <ShieldCheck className="h-4 w-4" />
            </Link>
          </nav>
        </div>
      </header>
    </>
  );
}
