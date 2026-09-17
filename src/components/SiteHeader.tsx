import { Link, useRouter } from "@tanstack/react-router";
import { ArrowLeft, Bell, ChevronDown, Headphones, Home, Menu, Phone, ShieldCheck, X } from "lucide-react";
import { motion } from "framer-motion";
import { LatestUpdatesButton } from "./LatestUpdatesButton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useQuery } from "@tanstack/react-query";
import { getPsf } from "@/lib/fares.functions";
import { useEffect, useState } from "react";


const PHONE_DISPLAY = "+92-0305-6622988";
const WA_PHONE = "923056622988";
const WA_LINK = `https://wa.me/${WA_PHONE}`;

/**
 * Single consolidated navigation header shown on every public page,
 * including the homepage — "Minimal, Airblue-style" (Concept 3).
 * Only Agent Login / Register stay visible as buttons on the right;
 * WhatsApp, Latest Updates and Admin Panel live behind one small menu
 * icon so the primary row never fights for space.
 * Hidden on admin/agent routes and the print view.
 */
export function SiteHeader() {
  const router = useRouter();
  const path = router.state.location.pathname;
  const [hydrated, setHydrated] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);

  useEffect(() => {
    setHydrated(true);
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setMoreOpen(false);
  }, [path]);

  
  const { data: psfData } = useQuery({
    queryKey: ["site-settings", "psf"],
    queryFn: () => getPsf(),
  });

  // Don't render on admin/agent routes or print view
  if (path === "/print-format" || path === "/testing" || path.startsWith("/admin") || (path.startsWith("/agent") && path !== "/agent/login" && path !== "/agent/register")) return null;

  const primaryNavItems = [
    { to: "/services", label: "Our Services" },
    { to: "/verify-visa", label: "Verify Visa" },
    { to: "/test", label: "Test Page" },
  ];
  const toolsNavItems = [
    { to: "/discountvouchers", label: "Vouchers" },
    { to: "/calculator", label: "Calculators" },
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

            <button
              type="button"
              onClick={() => setMoreOpen((v) => !v)}
              aria-expanded={moreOpen}
              aria-label="More options"
              className="relative flex h-9 w-9 items-center justify-center rounded-full border border-border text-navy/70 transition hover:border-gold/50 hover:text-gold lg:hidden"
            >
              {moreOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </div>

          <nav aria-label="Main" className="flex flex-wrap items-center gap-0.5 lg:flex-nowrap lg:justify-end">
            {primaryNavItems.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="whitespace-nowrap rounded-md px-3 py-2 text-[15px] font-medium text-navy/75 transition-colors duration-150 hover:text-navy"
              >
                {item.label}
              </Link>
            ))}

            <DropdownMenu onOpenChange={setToolsOpen}>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="inline-flex items-center gap-1 whitespace-nowrap rounded-md px-3 py-2 text-[15px] font-medium text-navy/75 transition-colors duration-150 hover:text-navy"
                >
                  Tools
                  <motion.span animate={{ rotate: toolsOpen ? 180 : 0 }} transition={{ duration: 0.2, ease: "easeOut" }}>
                    <ChevronDown className="h-3.5 w-3.5" />
                  </motion.span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[180px]">
                {toolsNavItems.map((item) => (
                  <DropdownMenuItem key={item.to} asChild>
                    <Link to={item.to} className="cursor-pointer text-[14px] font-medium">
                      {item.label}
                    </Link>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <span className="mx-2 hidden h-5 w-px bg-border lg:block" />

            {/* Secondary utilities live behind one menu icon — desktop */}
            <button
              type="button"
              onClick={() => setMoreOpen((v) => !v)}
              aria-expanded={moreOpen}
              aria-label="More options"
              title="More"
              className="hidden h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-navy/60 transition-colors hover:bg-navy/5 hover:text-navy lg:inline-flex"
            >
              {moreOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>

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
          </nav>
        </div>

        {moreOpen && (
          <div className="border-t border-border bg-background/98 px-4 py-3 animate-fade-up">
            <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-2.5">
              <a
                href={WA_LINK}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Chat with Rohi International Travels on WhatsApp at ${PHONE_DISPLAY}`}
                className="inline-flex items-center gap-1.5 rounded-lg bg-whatsapp px-3.5 py-2 text-[13px] font-medium text-whatsapp-foreground shadow-sm transition hover:opacity-90"
              >
                <Phone className="h-3.5 w-3.5" /> {PHONE_DISPLAY}
              </a>
              <LatestUpdatesButton key="latest-updates-btn-mobile" />
              <Link
                to="/admin"
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3.5 py-2 text-[13px] font-medium text-navy/70 transition hover:border-gold/50 hover:text-gold"
              >
                <ShieldCheck className="h-3.5 w-3.5" /> Admin Panel
              </Link>
            </div>
          </div>
        )}
      </header>
    </>
  );
}
