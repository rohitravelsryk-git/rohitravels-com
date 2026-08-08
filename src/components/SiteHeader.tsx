import { Link, useRouter } from "@tanstack/react-router";
import { ArrowLeft, Home, Phone, ShieldCheck } from "lucide-react";
import rohiLogo from "@/assets/rohi-logo.png.asset.json";

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

  // Don't render on homepage (it has its own header) or admin/agent routes
  if (path === "/" || path.startsWith("/admin") || path.startsWith("/agent")) return null;

  const navItems = [
    { to: "/discountvouchers", label: "Vouchers" },
    { to: "/calculator", label: "Calculators" },
    { to: "/services", label: "Services" },
    { to: "/verify-visa", label: "Verify Visa" },
  ];

  return (
    <>
      {/* Floating Back + Home */}
      <div className="fixed left-3 top-3 z-[90] flex items-center gap-2 print:hidden">
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
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 lg:flex-row lg:items-center lg:justify-between lg:gap-6">
          <Link to="/" className="flex shrink-0 items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-navy/5 ring-1 ring-gold/40">
              <img src={rohiLogo.url} alt="Rohi International Travels" className="h-10 w-10 object-contain" />
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

            <Link
              to="/agent/login"
              className="inline-flex items-center rounded-full bg-navy px-3.5 py-2 text-[11px] font-bold uppercase tracking-wide text-navy-foreground shadow-sm transition hover:opacity-90"
            >
              Agent Login
            </Link>
            <Link
              to="/agent/register"
              className="inline-flex items-center rounded-full bg-gold px-3.5 py-2 text-[11px] font-bold uppercase tracking-wide text-navy shadow-sm transition hover:opacity-90"
            >
              Register Your Agency
            </Link>
            <Link
              to="/admin"
              className="inline-flex items-center gap-1.5 rounded-full border border-gold/60 bg-gold/10 px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-gold transition hover:bg-gold hover:text-gold-foreground"
            >
              <ShieldCheck className="h-3 w-3" /> Admin
            </Link>
          </nav>
        </div>
      </header>
    </>
  );
}
