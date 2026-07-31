import { Link, useRouter } from "@tanstack/react-router";
import { ArrowLeft, Home } from "lucide-react";

/**
 * Floating Back + Home controls shown on every page except the homepage.
 * Uses theme tokens so it matches the site palette/typography everywhere.
 */
export function PageNav() {
  const router = useRouter();
  const path = router.state.location.pathname;

  if (path === "/") return null;

  const pill =
    "inline-flex items-center gap-1.5 rounded-full border border-gold/30 bg-navy/90 px-3.5 py-2 text-[10px] font-bold uppercase tracking-widest text-navy-foreground shadow-lg backdrop-blur transition hover:border-gold hover:text-gold";

  return (
    <div className="fixed left-3 top-3 z-[90] flex items-center gap-2 print:hidden">
      <button type="button" onClick={() => router.history.back()} className={pill} aria-label="Go back">
        <ArrowLeft className="h-3.5 w-3.5" /> Back
      </button>
      <Link to="/" className={pill} aria-label="Go to homepage">
        <Home className="h-3.5 w-3.5" /> Home
      </Link>
    </div>
  );
}
