import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plane, Clock, Home, MessageCircle } from "lucide-react";

export const Route = createFileRoute("/coming-soon")({
  head: () => ({
    meta: [
      { title: "Coming Soon — Rohi International Travels" },
      {
        name: "description",
        content:
          "Something exciting is on the way from Rohi International Travels. Stay tuned — premium group fares and elite travel solutions.",
      },
      { property: "og:title", content: "Coming Soon — Rohi International Travels" },
      {
        property: "og:description",
        content: "Something exciting is on the way. Stay tuned for premium group fares and elite travel solutions.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: "https://rohitravels.com/coming-soon" }],
  }),
  component: ComingSoonPage,
});

function ComingSoonPage() {
  const target = new Date();
  target.setDate(target.getDate() + 14);
  target.setHours(0, 0, 0, 0);

  const [remaining, setRemaining] = useState(getRemaining(target));

  useEffect(() => {
    const id = setInterval(() => setRemaining(getRemaining(target)), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-navy px-4 text-navy-foreground animate-premium-fade">
      {/* Decorative gradient glow */}
      <div className="pointer-events-none absolute -top-40 left-1/2 h-[480px] w-[480px] -translate-x-1/2 rounded-full bg-gold/20 blur-[120px]" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-[360px] w-[360px] rounded-full bg-primary/20 blur-[120px]" />

      <div className="relative z-10 w-full max-w-xl text-center">
        <div className="mx-auto mb-8 flex h-20 w-20 items-center justify-center rounded-2xl border border-gold/30 bg-white/5 backdrop-blur">
          <Plane className="h-10 w-10 -rotate-45 text-gold" />
        </div>

        <p className="mb-3 text-xs font-bold uppercase tracking-[0.3em] text-gold">Rohi International Travels</p>
        <h1 className="font-serif text-4xl font-black leading-tight sm:text-5xl">Coming Soon</h1>
        <p className="mx-auto mt-4 max-w-md text-sm text-white/70">
          We're putting the finishing touches on something premium. Better fares, elite travel solutions, and a smarter
          booking experience — landing shortly.
        </p>

        {/* Countdown */}
        <div className="mt-10 grid grid-cols-4 gap-3">
          {[
            { label: "Days", value: remaining.days },
            { label: "Hours", value: remaining.hours },
            { label: "Minutes", value: remaining.minutes },
            { label: "Seconds", value: remaining.seconds },
          ].map((u) => (
            <div
              key={u.label}
              className="rounded-xl border border-white/10 bg-white/5 px-2 py-4 backdrop-blur"
            >
              <div className="font-serif text-3xl font-black tabular-nums text-gold">
                {String(u.value).padStart(2, "0")}
              </div>
              <div className="mt-1 text-[10px] font-semibold uppercase tracking-widest text-white/50">{u.label}</div>
            </div>
          ))}
        </div>

        <div className="mt-8 flex items-center justify-center gap-2 text-xs text-white/40">
          <Clock className="h-3.5 w-3.5" />
          Launching soon
        </div>

        {/* Actions */}
        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-full bg-gold px-6 py-3 text-sm font-bold text-gold-foreground transition hover:opacity-90"
          >
            <Home className="h-4 w-4" /> Back to Home
          </Link>
          <a
            href={`https://wa.me/923056622988`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-full border border-white/20 px-6 py-3 text-sm font-bold text-white transition hover:bg-white/10"
          >
            <MessageCircle className="h-4 w-4" /> Contact Us
          </a>
        </div>
      </div>
    </div>
  );
}

function getRemaining(target: Date) {
  const diff = Math.max(0, target.getTime() - Date.now());
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  const seconds = Math.floor((diff % 60000) / 1000);
  return { days, hours, minutes, seconds };
}
