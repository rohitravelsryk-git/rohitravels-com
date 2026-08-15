import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useEffect } from "react";
import { StickyNote, Save, Power, CheckCircle2, AlertCircle } from "lucide-react";
import { getStickyNote, updateStickyNote } from "@/lib/sticky-notes.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/sticky-notes")({
  component: StickyNotesAdminPage,
});

function StickyNotesAdminPage() {
  const { data: note, isLoading } = useQuery({
    queryKey: ["sticky-note", "admin"],
    queryFn: () => getStickyNote(),
  });

  const updateFn = useServerFn(updateStickyNote);
  const qc = useQueryClient();

  const [content, setContent] = useState("");
  const [isEnabled, setIsEnabled] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (note) {
      setContent(note.content || "");
      setIsEnabled(note.is_enabled ?? true);
    }
  }, [note]);

  async function handleSave() {
    setBusy(true);
    try {
      await updateFn({ data: { content, is_enabled: isEnabled } });
      await qc.invalidateQueries({ queryKey: ["sticky-note"] });
      toast.success("Sticky note updated successfully");
    } catch (e: any) {
      toast.error(e.message || "Failed to update sticky note");
    } finally {
      setBusy(false);
    }
  }

  if (isLoading) return <div className="p-10 text-center text-white/50">Loading sticky note settings...</div>;

  return (
    <div className="mx-auto max-w-4xl p-6">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 font-serif text-3xl font-black text-white">
            <StickyNote className="h-8 w-8 text-gold" />
            Agent Portal Sticky Notes
          </h1>
          <p className="mt-2 text-sm text-white/60">
            Publish confidential instructions, airline IDs, and passwords directly to all B2B agents.
          </p>
        </div>

        <button
          onClick={() => setIsEnabled(!isEnabled)}
          className={`flex items-center gap-2 rounded-full px-4 py-2 text-xs font-black uppercase tracking-widest transition-all ${
            isEnabled 
              ? "bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/50" 
              : "bg-white/5 text-white/40 ring-1 ring-white/10"
          }`}
        >
          <Power className="h-3.5 w-3.5" />
          {isEnabled ? "System Enabled" : "System Disabled"}
        </button>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur-sm">
        <div className="mb-4 flex items-center justify-between">
          <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gold/80">
            Content & Instructions
          </label>
          <span className="text-[10px] font-bold text-white/40 italic">
            Supports plain text. Shared in real-time with all agents.
          </span>
        </div>

        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Enter confidential airline IDs, passwords, and booking instructions here..."
          className="h-64 w-full rounded-xl border border-white/10 bg-navy/40 p-5 font-mono text-sm leading-relaxed text-white outline-none focus:border-gold/50 focus:ring-2 focus:ring-gold/20"
        />

        <div className="mt-6 flex items-center justify-between border-t border-white/5 pt-6">
          <div className="flex items-center gap-4 text-xs text-white/50">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
              Auto-saved state
            </div>
            <div className="flex items-center gap-1.5">
              <AlertCircle className="h-3.5 w-3.5 text-gold" />
              Confidential Area
            </div>
          </div>

          <button
            onClick={handleSave}
            disabled={busy}
            className="flex items-center gap-2 rounded-xl bg-gold px-8 py-3 text-sm font-black uppercase tracking-widest text-navy transition-all hover:scale-[1.02] hover:shadow-lg hover:shadow-gold/20 active:scale-95 disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {busy ? "Updating..." : "Publish to Agents"}
          </button>
        </div>
      </div>

      <div className="mt-8 rounded-xl bg-gold/5 p-4 ring-1 ring-gold/20">
        <h3 className="text-[10px] font-black uppercase tracking-widest text-gold">Pro Tip</h3>
        <p className="mt-1 text-xs text-white/70 leading-relaxed">
          Use this to share real-time updates for specific flights or temporary system passwords. 
          When you toggle "System Disabled", the sticky note section will completely disappear from all agent screens.
        </p>
      </div>
    </div>
  );
}
