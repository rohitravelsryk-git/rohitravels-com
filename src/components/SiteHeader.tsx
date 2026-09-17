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
    { to: "/services", label: "Our services" },
    { to: "/verify-visa", label: "Verify visa" },
    { to: "/discountvouchers", label: "Vouchers" },
    { to: "/calculator", label: "Calculators" },
    
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
          <div className="flex shrink-0 items-center gap-2">
            <Link to="/" className="group flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-navy/5 ring-1 ring-gold/40 transition-transform duration-300 group-hover:scale-105 group-hover:ring-gold">
                <img src="/favicon.png" alt="Rohi International Travels" className="h-7 w-7 object-contain" />
              </span>
              <span className="font-serif text-lg font-black leading-none text-navy">Rohi International Travels</span>
            </Link>
            <Link
              to="/admin"
              title="Admin panel"
              aria-label="Admin panel"
              className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-navy/40 transition-colors hover:bg-navy/5 hover:text-navy"
            >
              <ShieldCheck className="h-4 w-4" />
            </Link>
          </div>

          <nav aria-label="Main" className="flex flex-wrap items-center gap-0.5 lg:flex-nowrap lg:justify-end">
            <a
              href={WA_LINK}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Chat with Rohi International Travels on WhatsApp at ${PHONE_DISPLAY}`}
              className="mr-1.5 inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-2 text-[14px] font-bold text-whatsapp transition-colors hover:text-whatsapp/80"
            >
              <Phone className="h-3.5 w-3.5 shrink-0" /> {PHONE_DISPLAY}
            </a>

            <span className="mx-1 hidden h-5 w-px bg-border lg:block" />

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

            <LatestUpdatesButton key="latest-updates-btn" className="ml-1" />

            <Link
              to="/agent/login"
              className="ml-1 whitespace-nowrap rounded-md px-3 py-2 text-[15px] font-medium text-navy/75 transition-colors duration-150 hover:text-navy"
            >
              Agent login
            </Link>
            {hydrated && !psfData?.registrationHidden && (
              <Link
                to="/agent/register"
                className="ml-1 inline-flex h-10 items-center whitespace-nowrap rounded-lg bg-gold px-4 text-[14px] font-semibold text-gold-foreground shadow-sm transition-all hover:opacity-90 active:scale-[0.98]"
              >
                Register Your Agency
              </Link>
            )}
          </nav>
        </div>
      </header>
    </>
  );
}
