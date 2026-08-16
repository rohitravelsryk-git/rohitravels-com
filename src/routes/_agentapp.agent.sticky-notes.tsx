import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getStickyNote } from "@/lib/sticky-notes.functions";
import { Info, Lock } from "lucide-react";

export const Route = createFileRoute("/_agentapp/agent/sticky-notes")({
  ssr: false,
  component: AgentStickyNotesPage,
});

function AgentStickyNotesPage() {
  const { data: stickyNote, isLoading } = useQuery({
    queryKey: ["sticky-note"],
    queryFn: () => getStickyNote(),
    refetchInterval: 10000,
  });

  if (isLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center p-6 text-navy font-bold">
        Loading Sticky Notes...
      </div>
    );
  }

  if (!stickyNote?.is_enabled || !stickyNote?.content) {
    return (
      <div className="mx-auto max-w-4xl p-6 text-center">
        <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 text-gray-400">
          <Info className="h-8 w-8" />
        </div>
        <h2 className="text-xl font-bold text-gray-800">No active updates</h2>
        <p className="mt-2 text-sm text-gray-600">
          Check back later for confidential credentials and airline instructions.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl p-6 pb-24">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gold/20 text-gold">
            <Lock className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-serif font-black text-navy uppercase tracking-wider">Sticky Notes</h1>
            <p className="text-[10px] font-bold text-gold uppercase tracking-[0.2em]">Confidential Instructions</p>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 ring-1 ring-emerald-100">
          <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[10px] font-black text-emerald-600 uppercase">Live Sync</span>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gold/30 bg-white shadow-2xl">
        <div className="border-b border-gold/10 bg-navy px-6 py-3">
          <h3 className="text-xs font-black uppercase tracking-[0.3em] text-white">Agent Credentials & System Updates</h3>
        </div>
        <div className="bg-amber-50/30 p-8">
          <div className="whitespace-pre-wrap font-mono text-sm leading-relaxed text-navy selection:bg-gold/30">
            {stickyNote.content}
          </div>
        </div>
        <div className="border-t border-gold/10 bg-white px-6 py-3 text-center">
          <p className="text-[10px] font-bold text-navy/40 uppercase tracking-widest">
            Last updated: {stickyNote.updated_at ? new Date(stickyNote.updated_at).toLocaleString() : "Recently"}
          </p>
        </div>
      </div>

      <div className="mt-8 rounded-xl border border-navy/10 bg-navy/5 p-6 text-center">
        <p className="text-xs font-bold text-navy/70 leading-relaxed italic">
          Disclaimer: This information is for registered agents only. Do not share these credentials with third parties.
        </p>
      </div>
    </div>
  );
}
