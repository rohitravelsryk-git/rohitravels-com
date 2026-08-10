import { Bell } from "lucide-react";
import { Link } from "@tanstack/react-router";

type Variant = "header" | "sidebar";

export function LatestUpdatesButton({ variant = "header", className = "" }: { variant?: Variant; className?: string }) {
  if (variant === "sidebar") {
    return (
      <Link
        to="/latest-updates"
        className={`flex w-full items-center gap-2 rounded-md border border-gold/40 bg-navy/40 px-3 py-2 text-left text-sm font-semibold text-gold hover:bg-navy/60 ${className}`}
      >
        <span className="w-5 text-gold"><Bell className="h-4 w-4" /></span> Latest Updates
      </Link>
    );
  }
  return (
    <Link
      to="/latest-updates"
      className={`inline-flex items-center gap-1.5 rounded-md bg-[#25D366] px-3 py-2 text-xs font-bold uppercase tracking-wide text-white shadow-sm hover:brightness-110 ${className}`}
      aria-label="Latest updates"
    >
      <Bell className="h-3.5 w-3.5" aria-hidden="true" />
      Latest Updates
    </Link>
  );
}

