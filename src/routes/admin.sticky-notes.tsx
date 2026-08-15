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
          <h1 className="flex items-center gap-2 font-serif text-3xl font-black text-navy">
            <StickyNote className="h-8 w-8 text-gold" />
            Agent Portal Sticky Notes
          </h1>
          <p className="mt-2 text-sm text-navy/60">
            Publish confidential instructions, airline IDs, and passwords directly to all B2B agents.
          </p>
        </div>

        <button
          onClick={() => setIsEnabled(!isEnabled)}
          className={`flex items-center gap-2 rounded-full px-4 py-2 text-[11px] font-black uppercase tracking-widest transition-all shadow-md ${
            isEnabled 
              ? "bg-emerald-500 text-white ring-1 ring-emerald-600" 
              : "bg-gray-200 text-gray-500 ring-1 ring-gray-300"
          }`}
        >
          <Power className="h-3.5 w-3.5" />
          {isEnabled ? "SYSTEM ENABLED" : "SYSTEM DISABLED"}
        </button>
      </div>

      <div className="rounded-2xl border border-navy/10 bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <label className="text-[10px] font-black uppercase tracking-[0.2em] text-navy/70">
            Content & Instructions
          </label>
          <span className="text-[10px] font-bold text-navy/40 italic">
            Supports plain text. Shared in real-time with all agents.
          </span>
        </div>

        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Enter confidential airline IDs, passwords, and booking instructions here..."
          className="h-[400px] w-full rounded-xl border border-navy/10 bg-gray-50 p-6 font-mono text-sm leading-relaxed text-navy outline-none focus:border-gold/50 focus:ring-2 focus:ring-gold/20"
        />

        <div className="mt-6 flex items-center justify-between border-t border-navy/5 pt-6">
          <div className="flex items-center gap-4 text-xs text-navy/50">
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

      <div className="mt-8 rounded-xl bg-gold/10 p-4 ring-1 ring-gold/30">
        <h3 className="text-[10px] font-black uppercase tracking-widest text-navy">Pro Tip</h3>
        <p className="mt-1 text-xs text-navy/70 leading-relaxed">
          Use this to share real-time updates for specific flights or temporary system passwords. 
          When you toggle "System Disabled", the sticky note section will completely disappear from all agent screens.
        </p>
      </div>
    </div>
  );
}
