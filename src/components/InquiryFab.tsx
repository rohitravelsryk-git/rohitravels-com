import { Link, useRouterState } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";
import { useChatPanelOpen } from "@/lib/chat-panel-state";

export function InquiryFab() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const chatOpen = useChatPanelOpen();
  if (pathname.startsWith("/admin")) return null;
  if (chatOpen) return null;

  return (
    <div className="fixed bottom-[92px] right-5 z-[9990] print:hidden">
      <Link
        to="/inquiry"
        className="group relative flex h-14 w-14 items-center justify-center rounded-full bg-gold text-navy shadow-2xl ring-2 ring-gold/40 transition hover:scale-105 hover:brightness-110"
        aria-label="Send your query"
      >
        <span className="absolute inset-0 -z-10 animate-ping rounded-full bg-gold/50" />
        <Sparkles className="h-6 w-6" />
        <span className="pointer-events-none absolute right-full mr-3 whitespace-nowrap rounded-lg bg-navy px-3 py-1.5 text-xs font-bold text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100">
          Send Your Query
        </span>
      </Link>
    </div>
  );
}

