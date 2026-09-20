import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  ShieldCheck, Headphones, Phone, Bell, ChevronDown, Menu, X,
} from "lucide-react";

export const Route = createFileRoute("/preview/header-concepts")({
  component: Page,
  head: () => ({
    meta: [
      { title: "Header Redesign Concepts | Rohi International Travels" },
      { name: "description", content: "Three real, working header strategies to compare side by side." },
      { name: "robots", content: "noindex" },
    ],
  }),
});

const PHONE = "0305 6622988";
const WA_LINK = "https://wa.me/923056622988";
const navItems = [
  { to: "/discount-vouchers", label: "Vouchers" },
  { to: "/calculators", label: "Calculators" },
  { to: "/our-services", label: "Our Services" },
  { to: "/verify-visa", label: "Verify Visa" },
  { to: "/testing", label: "Testing" },
];

/* ---------------------------------------------------------------------- *
 * Concept 1 — Compact Utility Cluster
 * Nav becomes plain text (no pill backgrounds → far less visual weight).
 * WhatsApp / Admin / Latest Updates collapse into small icon-only buttons
 * with tooltips. Agent Login + Register become one connected segmented
 * pill instead of two separate floating buttons.
 * ---------------------------------------------------------------------- */
function HeaderConcept1() {
  return (
    <header className="w-full border-b border-border bg-background">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
        <Link to="/" className="flex shrink-0 items-center gap-2.5">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-navy/5 ring-1 ring-gold/40">
            <img src="/favicon.png" alt="Rohi International Travels logo" width={512} height={454} loading="eager" decoding="async" fetchPriority="high" className="h-8 w-8 object-contain" />
          </span>
          <span className="font-serif text-base font-black uppercase leading-none tracking-wide text-navy">
            Rohi <span className="text-gold">International</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-5 lg:flex">
          {navItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="text-[12px] font-semibold text-navy/70 transition hover:text-navy"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-1.5">
          <a
            href={WA_LINK}
            target="_blank"
            rel="noopener noreferrer"
            title={`WhatsApp ${PHONE}`}
            className="hidden h-9 w-9 items-center justify-center rounded-full bg-whatsapp text-whatsapp-foreground shadow-sm transition hover:scale-105 sm:inline-flex"
          >
            <Phone className="h-4 w-4" />
          </a>
          <Link
            to="/latest-updates"
            title="Latest Updates"
            className="hidden h-9 w-9 items-center justify-center rounded-full border border-border text-navy/70 transition hover:border-gold hover:text-gold sm:inline-flex"
          >
            <Bell className="h-4 w-4" />
          </Link>
          <Link
            to="/admin"
            title="Admin Panel"
            className="hidden h-9 w-9 items-center justify-center rounded-full border border-border text-navy/70 transition hover:border-gold hover:text-gold sm:inline-flex"
          >
            <ShieldCheck className="h-4 w-4" />
          </Link>

          <span className="mx-1 h-6 w-px bg-border" />

          <div className="flex items-center overflow-hidden rounded-full border border-navy">
            <Link to="/agent/login" className="bg-navy px-3.5 py-2 text-[11px] font-black uppercase tracking-widest text-navy-foreground">
              Login
            </Link>
            <Link to="/agent/register" className="bg-gold px-3.5 py-2 text-[11px] font-black uppercase tracking-widest text-navy">
              Register
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}

/* ---------------------------------------------------------------------- *
 * Concept 2 — Primary Nav + "More" Overflow
 * Only the 3 most-used links stay visible; Verify Visa / Testing / Admin
 * tuck into a "More" dropdown. WhatsApp stays a real button (it drives
 * bookings). Login + Register + Latest Updates collapse into a single
 * "Agent Portal" dropdown so there's only ONE button on the far right.
 * ---------------------------------------------------------------------- */
function HeaderConcept2() {
  const [moreOpen, setMoreOpen] = useState(false);
  const [portalOpen, setPortalOpen] = useState(false);

  return (
    <header className="w-full border-b border-border bg-background">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
        <Link to="/" className="flex shrink-0 items-center gap-2.5">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-navy/5 ring-1 ring-gold/40">
            <img src="/favicon.png" alt="Rohi International Travels logo" width={512} height={454} loading="eager" decoding="async" fetchPriority="high" className="h-8 w-8 object-contain" />
          </span>
          <span className="font-serif text-base font-black uppercase leading-none tracking-wide text-navy">
            Rohi <span className="text-gold">International</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 lg:flex">
          {navItems.slice(0, 3).map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="rounded-full px-3 py-2 text-[12px] font-bold text-navy/70 transition hover:bg-navy/5 hover:text-navy"
            >
              {item.label}
            </Link>
          ))}
          <div className="relative">
            <button
              type="button"
              onClick={() => setMoreOpen((v) => !v)}
              className="flex items-center gap-1 rounded-full px-3 py-2 text-[12px] font-bold text-navy/70 transition hover:bg-navy/5 hover:text-navy"
            >
              More <ChevronDown className={`h-3.5 w-3.5 transition-transform ${moreOpen ? "rotate-180" : ""}`} />
            </button>
            {moreOpen && (
              <div className="absolute left-0 top-full mt-1 w-44 rounded-xl border border-border bg-background py-1.5 shadow-lg">
                {navItems.slice(3).map((item) => (
                  <Link key={item.to} to={item.to} className="block px-4 py-2 text-[12px] font-semibold text-navy/80 hover:bg-navy/5">
                    {item.label}
                  </Link>
                ))}
                <Link to="/admin" className="block px-4 py-2 text-[12px] font-semibold text-navy/80 hover:bg-navy/5">
                  Admin Panel
                </Link>
              </div>
            )}
          </div>
        </nav>

        <div className="flex items-center gap-2">
          <a
            href={WA_LINK}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden items-center gap-1.5 rounded-full bg-whatsapp px-3.5 py-2 text-[11px] font-bold text-whatsapp-foreground shadow-sm transition hover:scale-105 sm:inline-flex"
          >
            <Phone className="h-3.5 w-3.5" /> {PHONE}
          </a>

          <div className="relative">
            <button
              type="button"
              onClick={() => setPortalOpen((v) => !v)}
              className="inline-flex h-[38px] items-center gap-1.5 rounded-full bg-navy px-4 text-[11px] font-black uppercase tracking-widest text-navy-foreground shadow-sm transition hover:opacity-90"
            >
              Agent Portal <ChevronDown className={`h-3.5 w-3.5 transition-transform ${portalOpen ? "rotate-180" : ""}`} />
            </button>
            {portalOpen && (
              <div className="absolute right-0 top-full mt-1 w-48 rounded-xl border border-border bg-background py-1.5 shadow-lg">
                <Link to="/agent/login" className="block px-4 py-2 text-[12px] font-bold text-navy hover:bg-navy/5">Agent Login</Link>
                <Link to="/agent/register" className="block px-4 py-2 text-[12px] font-bold text-gold hover:bg-navy/5">Register Agency</Link>
                <Link to="/latest-updates" className="flex items-center gap-1.5 px-4 py-2 text-[12px] font-bold text-navy/80 hover:bg-navy/5">
                  <Bell className="h-3.5 w-3.5" /> Latest Updates
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

/* ---------------------------------------------------------------------- *
 * Concept 3 — Minimal, Airblue-style
 * Closest to the reference you gave: logo, plain-text nav, and just TWO
 * buttons on the right (Login / Register). Everything else — WhatsApp,
 * Latest Updates, Admin Panel — lives behind one small menu icon so the
 * primary row never fights for space.
 * ---------------------------------------------------------------------- */
function HeaderConcept3() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="w-full border-b border-border bg-background">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
        <Link to="/" className="flex shrink-0 items-center gap-2.5">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-navy/5 ring-1 ring-gold/40">
            <img src="/favicon.png" alt="Rohi International Travels logo" width={512} height={454} loading="eager" decoding="async" fetchPriority="high" className="h-8 w-8 object-contain" />
          </span>
          <span className="font-serif text-base font-black uppercase leading-none tracking-wide text-navy">
            Rohi <span className="text-gold">International</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-6 lg:flex">
          {navItems.map((item) => (
            <Link key={item.to} to={item.to} className="text-[12px] font-semibold text-navy/70 transition hover:text-navy">
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            title="More"
            className="relative flex h-9 w-9 items-center justify-center rounded-full border border-border text-navy/70 transition hover:border-gold hover:text-gold"
          >
            {menuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
          <Link
            to="/agent/login"
            className="inline-flex h-[38px] items-center rounded-full border border-navy px-4 text-[11px] font-black uppercase tracking-widest text-navy transition hover:bg-navy hover:text-navy-foreground"
          >
            Login
          </Link>
          <Link
            to="/agent/register"
            className="inline-flex h-[38px] items-center rounded-full bg-gold px-4 text-[11px] font-black uppercase tracking-widest text-navy shadow-sm transition hover:opacity-90"
          >
            Signup
          </Link>
        </div>
      </div>

      {menuOpen && (
        <div className="border-t border-border bg-background/98 px-4 py-3">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3">
            <a href={WA_LINK} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-full bg-whatsapp px-3.5 py-2 text-[11px] font-bold text-whatsapp-foreground">
              <Phone className="h-3.5 w-3.5" /> {PHONE}
            </a>
            <Link to="/latest-updates" className="inline-flex items-center gap-1.5 rounded-full border border-border px-3.5 py-2 text-[11px] font-bold text-navy">
              <Bell className="h-3.5 w-3.5" /> Latest Updates
            </Link>
            <Link to="/admin" className="inline-flex items-center gap-1.5 rounded-full border border-border px-3.5 py-2 text-[11px] font-bold text-navy/70">
              <ShieldCheck className="h-3.5 w-3.5" /> Admin Panel
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}

function Block({ n, title, tagline, children }: { n: number; title: string; tagline: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-border pb-12">
      <div className="mx-auto max-w-7xl px-4 pt-10">
        <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-gold">Concept {n}</p>
        <h2 className="mt-1 font-serif text-2xl font-black text-navy">{title}</h2>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{tagline}</p>
      </div>
      <div className="mt-5 overflow-hidden rounded-2xl border border-border shadow-sm">
        {children}
      </div>
    </div>
  );
}

function Page() {
  return (
    <div className="min-h-screen bg-secondary/20 pb-24">
      <div className="border-b border-border bg-navy px-4 py-6 text-center">
        <p className="text-[10px] font-bold uppercase tracking-[0.4em] text-gold">Preview · Header Strategies</p>
        <h1 className="mt-2 font-serif text-3xl font-black text-navy-foreground">Three Real, Working Options</h1>
        <p className="mx-auto mt-2 max-w-xl text-sm text-navy-foreground/70">
          Every link and button below is live — click around. Tell me the number you like, or ask me to just pick the best one.
        </p>
        <Link to="/" className="mt-4 inline-block text-[11px] font-bold uppercase tracking-widest text-gold underline underline-offset-4">
          ← Back to homepage
        </Link>
      </div>

      <Block n={1} title="Compact Utility Cluster" tagline="Nav becomes plain text (lighter, less boxy). WhatsApp / Latest Updates / Admin shrink to small icon buttons. Login + Register merge into one connected pill.">
        <HeaderConcept1 />
      </Block>

      <Block n={2} title="Primary Nav + Overflow" tagline="Only your 3 most-used links stay visible; the rest tuck into a “More” menu. Login, Register and Latest Updates merge into a single “Agent Portal” dropdown — just one button on the right.">
        <HeaderConcept2 />
      </Block>

      <Block n={3} title="Minimal, Airblue-style" tagline="Closest to the reference site you shared: logo, plain nav, and just two buttons (Login / Signup). WhatsApp, Latest Updates and Admin Panel live behind one small menu icon.">
        <HeaderConcept3 />
      </Block>
    </div>
  );
}
