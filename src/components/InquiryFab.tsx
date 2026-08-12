import { Link, useRouterState } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";
import { useChatPanelOpen } from "@/lib/chat-panel-state";

export function InquiryFab() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const chatOpen = useChatPanelOpen();
  if (pathname.startsWith("/admin")) return null;
  if (chatOpen) return null;

  return (
    <Link
      to="/inquiry"
      className="group fixed bottom-[152px] right-5 z-[9990] inline-flex items-center gap-2 rounded-full bg-gold px-4 py-3 text-xs font-black uppercase tracking-widest text-navy shadow-2xl ring-2 ring-gold/40 transition hover:scale-105 hover:bg-yellow-400 print:hidden sm:text-sm"
      aria-label="Send your query"
    >

      <span className="absolute inset-0 -z-10 animate-ping rounded-full bg-gold/50" />
      <Sparkles className="h-4 w-4" />
      Send Your Query
    </Link>
  );
}

