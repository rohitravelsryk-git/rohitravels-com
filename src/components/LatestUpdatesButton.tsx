import { Bell } from "lucide-react";

type Variant = "header" | "sidebar";

export function LatestUpdatesButton({ variant = "header", className = "" }: { variant?: Variant; className?: string }) {
  const onClick = () => {
    if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("rohi:open-latest"));
  };
  if (variant === "sidebar") {
    return (
      <button
        onClick={onClick}
        className={`flex w-full items-center gap-2 rounded-md border border-gold/40 bg-navy/40 px-3 py-2 text-left text-sm font-semibold text-gold hover:bg-navy/60 ${className}`}
      >
        <span className="w-5 text-gold"><Bell className="h-4 w-4" /></span> Latest Updates
      </button>
    );
  }
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-md bg-[#25D366] px-3 py-2 text-xs font-bold uppercase tracking-wide text-white shadow-sm hover:brightness-110 ${className}`}
      aria-label="Latest updates"
    >
      <Bell className="h-3.5 w-3.5" aria-hidden="true" />
      Latest Updates
    </button>
  );
}
