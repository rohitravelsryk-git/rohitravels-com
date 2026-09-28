import { useEffect, useState } from "react";
import { Link, useRouter } from "@tanstack/react-router";
import {
  BriefcaseBusiness,
  ChevronDown,
  CircleHelp,
  Globe2,
  Menu,
  Phone,
  ShieldCheck,
  UserRound,
  WalletCards,
  X,
} from "lucide-react";
import { LatestUpdatesButton } from "./LatestUpdatesButton";
import { useQuery } from "@tanstack/react-query";
import { getPsf } from "@/lib/fares.functions";

const PHONE_DISPLAY = "+92-0305-6622988";
const WA_PHONE = "923056622988";
const WA_LINK = `https://wa.me/${WA_PHONE}`;

type NavItem = {
  to: string;
  label: string;
  description?: string;
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

const navGroups: NavGroup[] = [
  {
    label: "Travel",
    items: [
      { to: "/our-services", label: "Our services", description: "Flights, visas and travel support." },
      { to: "/verify-visa", label: "Verify visa", description: "Check visa information and documents." },
      { to: "/calculators", label: "Travel calculators", description: "Useful fare and travel calculations." },
    ],
  },
  {
    label: "Offers",
    items: [
      { to: "/discount-vouchers", label: "Discount vouchers", description: "Explore available travel savings." },
      { to: "/latest-updates", label: "Latest updates", description: "New fares, announcements and news." },
    ],
  },
];

export function SiteHeader() {
  const router = useRouter();
  const path = router.state.location.pathname;
  const [hydrated, setHydrated] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openGroup, setOpenGroup] = useState<string | null>(null);

  useEffect(() => {
    setHydrated(true);
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
    setOpenGroup(null);
  }, [path]);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  const { data: psfData } = useQuery({
    queryKey: ["site-settings", "psf"],
    queryFn: () => getPsf(),
  });

  if (
    path === "/print-format" ||
    path === "/testing" ||
    path.startsWith("/admin") ||
    (path.startsWith("/agent") && path !== "/agent/login" && path !== "/agent/register")
  ) {
    return null;
  }

  const isActive = (to: string) =>
    to === "/" ? path === "/" : path === to || path.startsWith(`${to}/`);

  return (
    <header
      className={`sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur-xl transition-[box-shadow,border-color] duration-300 supports-[backdrop-filter]:bg-background/85 print:hidden ${
        scrolled ? "border-border shadow-[0_8px_28px_-14px_rgba(15,23,42,0.28)]" : "border-transparent"
      }`}
    >
      {/* Compact utility strip */}
      <div className="hidden border-b border-border/70 bg-secondary/40 lg:block">
        <div className="mx-auto flex h-9 max-w-[1440px] items-center justify-end gap-5 px-5 text-[11px] font-semibold text-muted-foreground">
          <button type="button" className="inline-flex items-center gap-1.5 transition-colors hover:text-foreground">
            <Globe2 className="h-3.5 w-3.5" /> English <ChevronDown className="h-3 w-3" />
          </button>
          <button type="button" className="inline-flex items-center gap-1.5 transition-colors hover:text-foreground">
            <WalletCards className="h-3.5 w-3.5" /> PKR <ChevronDown className="h-3 w-3" />
          </button>
          <a href="/contact-us" className="inline-flex items-center gap-1.5 transition-colors hover:text-foreground">
            <CircleHelp className="h-3.5 w-3.5" /> Help & Support
          </a>
          <a href="/agent/login" className="inline-flex items-center gap-1.5 transition-colors hover:text-foreground">
            <UserRound className="h-3.5 w-3.5" /> Agent login
          </a>
        </div>
      </div>

      <div className="mx-auto flex h-[68px] max-w-[1440px] items-center gap-4 px-4 sm:px-5">
        <div className="flex min-w-0 shrink-0 items-center gap-2">
          <Link to="/" className="group flex min-w-0 items-center gap-2.5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-navy/5 ring-1 ring-gold/40 transition duration-200 group-hover:scale-[1.03] group-hover:ring-gold">
              <img
                src="/favicon.png"
                alt="Rohi International Travels"
                width={512}
                height={454}
                loading="eager"
                decoding="async"
                fetchPriority="high"
                className="h-7 w-7 object-contain"
              />
            </span>
            <span className="hidden truncate text-[17px] font-bold leading-none tracking-[-0.02em] text-navy sm:block">
              Rohi International Travels
            </span>
          </Link>

          <Link
            to="/admin"
            title="Admin panel"
            aria-label="Admin panel"
            className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-lg text-navy/35 transition-colors hover:bg-navy/5 hover:text-navy sm:flex"
          >
            <ShieldCheck className="h-4 w-4" />
          </Link>
        </div>

        {/* Desktop airline-style navigation */}
        <nav aria-label="Main" className="hidden min-w-0 flex-1 items-center justify-center lg:flex">
          <div className="flex items-center gap-0.5">
            <Link
              to="/"
              className={`rounded-lg px-3 py-2 text-[13px] font-semibold transition-colors ${
                isActive("/") ? "bg-secondary text-navy" : "text-navy/70 hover:bg-secondary hover:text-navy"
              }`}
            >
              Home
            </Link>

            {navGroups.map((group) => {
              const open = openGroup === group.label;
              const active = group.items.some((item) => isActive(item.to));
              return (
                <div key={group.label} className="relative">
                  <button
                    type="button"
                    onClick={() => setOpenGroup(open ? null : group.label)}
                    aria-expanded={open}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[13px] font-semibold transition-colors ${
                      active || open ? "bg-secondary text-navy" : "text-navy/70 hover:bg-secondary hover:text-navy"
                    }`}
                  >
                    {group.label}
                    <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
                  </button>

                  {open && (
                    <div className="absolute left-1/2 top-full z-50 mt-2 w-[330px] -translate-x-1/2 rounded-2xl border border-border bg-background p-2 shadow-xl">
                      <div className="mb-1 px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">
                        {group.label}
                      </div>
                      <div className="space-y-0.5">
                        {group.items.map((item) => {
                          const ItemActive = isActive(item.to);
                          return (
                            <Link
                              key={item.to}
                              to={item.to}
                              onClick={() => setOpenGroup(null)}
                              className={`flex items-start gap-3 rounded-xl px-3 py-3 transition-colors ${
                                ItemActive ? "bg-secondary" : "hover:bg-secondary/70"
                              }`}
                            >
                              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gold/10 text-gold">
                                <BriefcaseBusiness className="h-4 w-4" />
                              </span>
                              <span className="min-w-0">
                                <span className="block text-[13px] font-bold text-foreground">{item.label}</span>
                                <span className="mt-0.5 block text-[11px] leading-4 text-muted-foreground">{item.description}</span>
                              </span>
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            <Link
              to="/contact-us"
              className={`rounded-lg px-3 py-2 text-[13px] font-semibold transition-colors ${
                isActive("/contact-us") ? "bg-secondary text-navy" : "text-navy/70 hover:bg-secondary hover:text-navy"
              }`}
            >
              Contact
            </Link>
          </div>
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-1.5">
          <a
            href={WA_LINK}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Chat with Rohi International Travels on WhatsApp at ${PHONE_DISPLAY}`}
            className="hidden items-center gap-1.5 rounded-lg px-2.5 py-2 text-[12px] font-bold text-whatsapp transition-colors hover:bg-secondary lg:inline-flex"
          >
            <Phone className="h-3.5 w-3.5" />
            <span className="xl:inline">{PHONE_DISPLAY}</span>
          </a>

          <LatestUpdatesButton key="latest-updates-btn" className="hidden xl:inline-flex" />

          <Link
            to="/agent/login"
            className="hidden items-center gap-1.5 rounded-lg px-3 py-2 text-[12px] font-semibold text-navy/70 transition-colors hover:bg-secondary hover:text-navy md:inline-flex lg:hidden"
          >
            <UserRound className="h-4 w-4" /> Login
          </Link>

          {hydrated && !psfData?.registrationHidden && (
            <Link
              to="/agent/register"
              className="hidden h-10 items-center gap-1.5 rounded-xl bg-gold px-4 text-[12px] font-bold text-gold-foreground shadow-sm transition-all hover:opacity-90 active:scale-[0.98] sm:inline-flex"
            >
              Register Agency
            </Link>
          )}

          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-background text-navy transition-colors hover:bg-secondary lg:hidden"
            aria-label="Open navigation"
            aria-expanded={mobileOpen}
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Mobile / tablet navigation drawer */}
      <div
        className={`fixed inset-0 z-[60] lg:hidden ${mobileOpen ? "pointer-events-auto" : "pointer-events-none"}`}
        aria-hidden={!mobileOpen}
      >
        <button
          type="button"
          aria-label="Close navigation"
          onClick={() => setMobileOpen(false)}
          className={`absolute inset-0 bg-navy/55 backdrop-blur-sm transition-opacity ${mobileOpen ? "opacity-100" : "opacity-0"}`}
        />

        <aside
          className={`absolute inset-y-0 right-0 flex w-[min(90vw,390px)] flex-col bg-background shadow-2xl transition-transform duration-300 ${mobileOpen ? "translate-x-0" : "translate-x-full"}`}
          aria-label="Mobile navigation"
        >
          <div className="flex min-h-[68px] items-center justify-between border-b border-border px-4">
            <Link to="/" onClick={() => setMobileOpen(false)} className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-navy/5 ring-1 ring-gold/40">
                <img src="/favicon.png" alt="" className="h-6 w-6 object-contain" />
              </span>
              <span className="text-sm font-bold text-navy">Rohi International Travels</span>
            </Link>
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground"
              aria-label="Close navigation"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            <Link
              to="/agent/register"
              onClick={() => setMobileOpen(false)}
              className="mb-4 flex min-h-12 w-full items-center justify-center rounded-xl bg-gold px-4 text-sm font-bold text-gold-foreground shadow-sm"
            >
              Register Your Agency
            </Link>

            <div className="space-y-1">
              <Link
                to="/"
                onClick={() => setMobileOpen(false)}
                className={`flex min-h-12 items-center rounded-xl px-3 text-sm font-bold ${
                  isActive("/") ? "bg-secondary text-navy" : "text-navy/75 hover:bg-secondary"
                }`}
              >
                Home
              </Link>

              {navGroups.map((group) => {
                const open = openGroup === group.label;
                return (
                  <div key={group.label} className="rounded-xl border border-border">
                    <button
                      type="button"
                      onClick={() => setOpenGroup(open ? null : group.label)}
                      className="flex min-h-12 w-full items-center justify-between px-3 text-sm font-bold text-navy"
                      aria-expanded={open}
                    >
                      {group.label}
                      <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
                    </button>
                    {open && (
                      <div className="border-t border-border px-2 pb-2 pt-1">
                        {group.items.map((item) => (
                          <Link
                            key={item.to}
                            to={item.to}
                            onClick={() => setMobileOpen(false)}
                            className="flex items-start gap-3 rounded-lg px-2 py-3 hover:bg-secondary"
                          >
                            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gold/10 text-gold">
                              <BriefcaseBusiness className="h-4 w-4" />
                            </span>
                            <span>
                              <span className="block text-sm font-semibold text-foreground">{item.label}</span>
                              <span className="block text-[11px] leading-4 text-muted-foreground">{item.description}</span>
                            </span>
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}

              <Link
                to="/contact-us"
                onClick={() => setMobileOpen(false)}
                className="flex min-h-12 items-center rounded-xl px-3 text-sm font-bold text-navy/75 hover:bg-secondary"
              >
                Contact us
              </Link>
              <a
                href={WA_LINK}
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-h-12 items-center gap-2 rounded-xl px-3 text-sm font-bold text-whatsapp hover:bg-secondary"
              >
                <Phone className="h-4 w-4" /> {PHONE_DISPLAY}
              </a>
              <Link
                to="/agent/login"
                onClick={() => setMobileOpen(false)}
                className="flex min-h-12 items-center gap-2 rounded-xl px-3 text-sm font-bold text-navy/75 hover:bg-secondary"
              >
                <UserRound className="h-4 w-4" /> Agent login
              </Link>
            </div>
          </div>
        </aside>
      </div>
    </header>
  );
}
