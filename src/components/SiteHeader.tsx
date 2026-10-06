import { useEffect, useRef, useState } from "react";
import { Link, useRouter } from "@tanstack/react-router";
import {
  BriefcaseBusiness,
  ChevronDown,
  BadgePercent,
  Calculator,
  CircleHelp,
  FileCheck2,
  Globe2,
  Menu,
  MessageSquareText,
  Newspaper,
  Phone,
  Plane,
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
  const desktopMenuRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    if (openGroup !== "All Menu") return;

    const closeMenu = (event: MouseEvent) => {
      if (desktopMenuRef.current && !desktopMenuRef.current.contains(event.target as Node)) {
        setOpenGroup(null);
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenGroup(null);
    };

    const onScroll = () => setOpenGroup(null);

    document.addEventListener("mousedown", closeMenu);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      document.removeEventListener("mousedown", closeMenu);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", onScroll);
    };
  }, [openGroup]);

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

        {/* Desktop: one clear mega menu so every public destination is visible in one place */}
        <nav aria-label="Main" className="hidden min-w-0 flex-1 items-center justify-center lg:flex">
          <div className="flex items-center gap-1">
            <Link
              to="/"
              className={`rounded-lg px-3 py-2 text-[13px] font-semibold transition-colors ${isActive("/") ? "bg-secondary text-navy" : "text-navy/70 hover:bg-secondary hover:text-navy"}`}
            >
              Home
            </Link>

            <div ref={desktopMenuRef} className="relative">
              <button
                type="button"
                onClick={() => setOpenGroup(openGroup === "All Menu" ? null : "All Menu")}
                aria-expanded={openGroup === "All Menu"}
                aria-haspopup="menu"
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[13px] font-semibold transition-colors ${openGroup === "All Menu" ? "bg-secondary text-navy" : "text-navy/70 hover:bg-secondary hover:text-navy"}`}
              >
                <Menu className="h-4 w-4" />
                All Menu
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${openGroup === "All Menu" ? "rotate-180" : ""}`} />
              </button>

              {openGroup === "All Menu" && (
                <div
                  role="menu"
                  aria-label="All public website pages"
                  className="absolute left-1/2 top-full z-[70] mt-2 w-[min(900px,calc(100vw-32px))] -translate-x-1/2 rounded-2xl border border-border bg-background p-4 shadow-2xl"
                >
                  <div className="mb-3 flex items-center justify-between border-b border-border pb-3">
                    <div>
                      <p className="text-sm font-black text-navy">All Menu</p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">All public website pages in one place.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setOpenGroup(null)}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground"
                      aria-label="Close all menu"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div className="rounded-xl border border-border/80 bg-secondary/30 p-2">
                      <p className="px-2 pb-1.5 pt-1 text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">Travel</p>
                      <div className="space-y-0.5">
                        <Link to="/our-services" onClick={() => setOpenGroup(null)} className={`flex items-start gap-2.5 rounded-lg px-2 py-2.5 hover:bg-background ${isActive("/our-services") ? "bg-background" : ""}`}>
                          <Plane className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
                          <span><span className="block text-[12px] font-bold text-foreground">Our Services</span><span className="block text-[10px] leading-4 text-muted-foreground">Flights, visas and travel support</span></span>
                        </Link>
                        <Link to="/verify-visa" onClick={() => setOpenGroup(null)} className={`flex items-start gap-2.5 rounded-lg px-2 py-2.5 hover:bg-background ${isActive("/verify-visa") ? "bg-background" : ""}`}>
                          <FileCheck2 className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
                          <span><span className="block text-[12px] font-bold text-foreground">Verify Visa</span><span className="block text-[10px] leading-4 text-muted-foreground">Check visa information</span></span>
                        </Link>
                        <Link to="/calculators" onClick={() => setOpenGroup(null)} className={`flex items-start gap-2.5 rounded-lg px-2 py-2.5 hover:bg-background ${isActive("/calculators") ? "bg-background" : ""}`}>
                          <Calculator className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
                          <span><span className="block text-[12px] font-bold text-foreground">Travel Calculators</span><span className="block text-[10px] leading-4 text-muted-foreground">Useful travel calculations</span></span>
                        </Link>
                        <Link to="/pdf-tools" onClick={() => setOpenGroup(null)} className={`flex items-start gap-2.5 rounded-lg px-2 py-2.5 hover:bg-background ${isActive("/pdf-tools") ? "bg-background" : ""}`}>
                          <FileCheck2 className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
                          <span><span className="block text-[12px] font-bold text-foreground">PDF Tools</span><span className="block text-[10px] leading-4 text-muted-foreground">Useful document tools</span></span>
                        </Link>
                      </div>
                    </div>

                    <div className="rounded-xl border border-border/80 bg-secondary/30 p-2">
                      <p className="px-2 pb-1.5 pt-1 text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">Offers & Updates</p>
                      <div className="space-y-0.5">
                        <Link to="/discount-vouchers" onClick={() => setOpenGroup(null)} className={`flex items-start gap-2.5 rounded-lg px-2 py-2.5 hover:bg-background ${isActive("/discount-vouchers") ? "bg-background" : ""}`}>
                          <BadgePercent className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
                          <span><span className="block text-[12px] font-bold text-foreground">Discount Vouchers</span><span className="block text-[10px] leading-4 text-muted-foreground">View available voucher offers</span></span>
                        </Link>
                        <Link to="/latest-updates" onClick={() => setOpenGroup(null)} className={`flex items-start gap-2.5 rounded-lg px-2 py-2.5 hover:bg-background ${isActive("/latest-updates") ? "bg-background" : ""}`}>
                          <Newspaper className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
                          <span><span className="block text-[12px] font-bold text-foreground">Latest Updates</span><span className="block text-[10px] leading-4 text-muted-foreground">News and travel announcements</span></span>
                        </Link>
                        <Link to="/inquiry" onClick={() => setOpenGroup(null)} className={`flex items-start gap-2.5 rounded-lg px-2 py-2.5 hover:bg-background ${isActive("/inquiry") ? "bg-background" : ""}`}>
                          <MessageSquareText className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
                          <span><span className="block text-[12px] font-bold text-foreground">Travel Inquiry</span><span className="block text-[10px] leading-4 text-muted-foreground">Send a booking or travel request</span></span>
                        </Link>
                      </div>
                    </div>

                    <div className="rounded-xl border border-border/80 bg-secondary/30 p-2">
                      <p className="px-2 pb-1.5 pt-1 text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">Support & Agency</p>
                      <div className="space-y-0.5">
                        <Link to="/contact-us" onClick={() => setOpenGroup(null)} className={`flex items-start gap-2.5 rounded-lg px-2 py-2.5 hover:bg-background ${isActive("/contact-us") ? "bg-background" : ""}`}>
                          <CircleHelp className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
                          <span><span className="block text-[12px] font-bold text-foreground">Contact Us</span><span className="block text-[10px] leading-4 text-muted-foreground">Get help from Rohi</span></span>
                        </Link>
                        <Link to="/agent/login" onClick={() => setOpenGroup(null)} className={`flex items-start gap-2.5 rounded-lg px-2 py-2.5 hover:bg-background ${isActive("/agent/login") ? "bg-background" : ""}`}>
                          <UserRound className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
                          <span><span className="block text-[12px] font-bold text-foreground">Agent Login</span><span className="block text-[10px] leading-4 text-muted-foreground">Access your agency account</span></span>
                        </Link>
                        {!psfData?.registrationHidden && (
                          <Link to="/agent/register" onClick={() => setOpenGroup(null)} className="flex items-start gap-2.5 rounded-lg bg-gold/10 px-2 py-2.5 hover:bg-gold/15">
                            <UserRound className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
                            <span><span className="block text-[12px] font-black text-navy">Register Agency</span><span className="block text-[10px] leading-4 text-navy/65">Join the Rohi agent network</span></span>
                          </Link>
                        )}
                        <a href={WA_LINK} target="_blank" rel="noopener noreferrer" onClick={() => setOpenGroup(null)} className="flex items-start gap-2.5 rounded-lg px-2 py-2.5 hover:bg-background">
                          <Phone className="mt-0.5 h-4 w-4 shrink-0 text-whatsapp" />
                          <span><span className="block text-[12px] font-bold text-foreground">WhatsApp</span><span className="block text-[10px] leading-4 text-muted-foreground">{PHONE_DISPLAY}</span></span>
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
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
            className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-border bg-background px-3 text-navy transition-colors hover:bg-secondary lg:hidden"
            aria-label="Open all menu"
            aria-expanded={mobileOpen}
          >
            <Menu className="h-5 w-5" />
            <span className="text-xs font-bold">Menu</span>
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
            {!psfData?.registrationHidden && (
              <Link
                to="/agent/register"
                onClick={() => setMobileOpen(false)}
                className="mb-4 flex min-h-12 w-full items-center justify-center rounded-xl bg-gold px-4 text-sm font-bold text-gold-foreground shadow-sm"
              >
                Register Your Agency
              </Link>
            )}

            <div className="space-y-2">
              <div className="mb-2 flex items-center justify-between px-1">
                <div>
                  <p className="text-base font-black text-navy">All Menu</p>
                  <p className="text-[11px] text-muted-foreground">Everything on Rohi, one easy list.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileOpen(false)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-secondary hover:text-foreground"
                  aria-label="Close all menu"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <Link
                to="/"
                onClick={() => setMobileOpen(false)}
                className={`flex min-h-12 items-center rounded-xl px-3 text-sm font-bold ${isActive("/") ? "bg-secondary text-navy" : "text-navy/75 hover:bg-secondary"}`}
              >
                Home
              </Link>

              <div className="rounded-xl border border-border p-2">
                <p className="px-2 pb-1 pt-1 text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">Travel</p>
                {[
                  ["/our-services", "Our Services", "Flights, visas and travel support."],
                  ["/verify-visa", "Verify Visa", "Check visa information and documents."],
                  ["/calculators", "Travel Calculators", "Useful fare and travel calculations."],
                  ["/pdf-tools", "PDF Tools", "Useful document tools."],
                ].map(([to, label, description]) => (
                  <Link
                    key={to}
                    to={to}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-start gap-3 rounded-lg px-2 py-3 hover:bg-secondary ${isActive(to) ? "bg-secondary" : ""}`}
                  >
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gold/10 text-gold">
                      <BriefcaseBusiness className="h-4 w-4" />
                    </span>
                    <span>
                      <span className="block text-sm font-semibold text-foreground">{label}</span>
                      <span className="block text-[11px] leading-4 text-muted-foreground">{description}</span>
                    </span>
                  </Link>
                ))}
              </div>

              <div className="rounded-xl border border-border p-2">
                <p className="px-2 pb-1 pt-1 text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">Offers & Updates</p>
                {[
                  ["/discount-vouchers", "Discount Vouchers", "Explore available travel savings."],
                  ["/latest-updates", "Latest Updates", "New fares, announcements and news."],
                  ["/inquiry", "Travel Inquiry", "Send a booking or travel request."],
                ].map(([to, label, description]) => (
                  <Link
                    key={to}
                    to={to}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-start gap-3 rounded-lg px-2 py-3 hover:bg-secondary ${isActive(to) ? "bg-secondary" : ""}`}
                  >
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gold/10 text-gold">
                      <BadgePercent className="h-4 w-4" />
                    </span>
                    <span>
                      <span className="block text-sm font-semibold text-foreground">{label}</span>
                      <span className="block text-[11px] leading-4 text-muted-foreground">{description}</span>
                    </span>
                  </Link>
                ))}
              </div>

              <div className="rounded-xl border border-border p-2">
                <p className="px-2 pb-1 pt-1 text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">Support & Agency</p>
                <Link to="/contact-us" onClick={() => setMobileOpen(false)} className="flex min-h-12 items-center gap-2 rounded-lg px-2 text-sm font-bold text-navy/75 hover:bg-secondary">
                  <CircleHelp className="h-4 w-4" /> Contact Us
                </Link>
                <Link to="/agent/login" onClick={() => setMobileOpen(false)} className="flex min-h-12 items-center gap-2 rounded-lg px-2 text-sm font-bold text-navy/75 hover:bg-secondary">
                  <UserRound className="h-4 w-4" /> Agent Login
                </Link>
                {!psfData?.registrationHidden && (
                  <Link to="/agent/register" onClick={() => setMobileOpen(false)} className="flex min-h-12 items-center gap-2 rounded-lg bg-gold/10 px-2 text-sm font-black text-navy hover:bg-gold/15">
                    <UserRound className="h-4 w-4 text-gold" /> Register Agency
                  </Link>
                )}
                <a
                  href={WA_LINK}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setMobileOpen(false)}
                  className="flex min-h-12 items-center gap-2 rounded-lg px-2 text-sm font-bold text-whatsapp hover:bg-secondary"
                >
                  <Phone className="h-4 w-4" /> WhatsApp
                </a>
              </div>
            </div>            </div>
          </div>
        </aside>
      </div>
    </header>
  );
}
