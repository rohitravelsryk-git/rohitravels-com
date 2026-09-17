import { Bell } from "lucide-react";
import { Link } from "@tanstack/react-router";

type Variant = "header" | "sidebar";
type Tone = "light" | "dark";

export function LatestUpdatesButton({ variant = "header", tone = "light", className = "" }: { variant?: Variant; tone?: Tone; className?: string }) {
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
  // Icon-only, like a chat-widget notification bell — no label.
  const toneCls = tone === "dark"
    ? "text-navy-foreground/60 hover:bg-white/10 hover:text-gold"
    : "text-navy/60 hover:bg-navy/5 hover:text-gold";
  return (
    <Link
      to="/latest-updates"
      className={`relative inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full transition-all active:scale-95 ${toneCls} ${className}`}
      aria-label="Latest updates"
      title="Latest Updates"
    >
      <Bell className="h-[19px] w-[19px]" aria-hidden="true" />
      <span className="absolute right-[9px] top-[9px] flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-gold opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-gold" />
      </span>
    </Link>
  );
}
