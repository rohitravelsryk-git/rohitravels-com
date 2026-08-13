import { Bell } from "lucide-react";
import { Link } from "@tanstack/react-router";

type Variant = "header" | "sidebar";

export function LatestUpdatesButton({ variant = "header", className = "" }: { variant?: Variant; className?: string }) {
  if (variant === "sidebar") {
    return (
      <Link
        to="/updates"
        className={`flex w-full items-center gap-2 rounded-md border border-gold/40 bg-navy/40 px-3 py-2 text-left text-sm font-semibold text-gold hover:bg-navy/60 ${className}`}
      >
        <span className="w-5 text-gold"><Bell className="h-4 w-4" /></span> Latest Updates
      </Link>
    );
  }
  return (
    <Link
      to="/updates"
      className={`inline-flex h-[38px] items-center gap-2 rounded-full bg-gold px-4 text-[11px] font-black uppercase tracking-widest text-navy shadow-lg transition-all hover:scale-105 hover:bg-yellow-400 active:scale-95 ${className}`}
      aria-label="Latest updates"
    >
      <Bell className="h-4 w-4" aria-hidden="true" />
      Latest Updates
    </Link>
  );
}
