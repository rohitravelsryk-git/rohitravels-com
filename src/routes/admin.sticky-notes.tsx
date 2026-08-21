// '''Do not make any visual modifications. The phrases I write are commands to understand what I want, not to be written down. Understand their content well, then execute what is required.'''
//                                         
//                                             
//                                             
//                                             this is original ticket print please get same results and scaling and all settings in ticket print. stamps and header footer are extra sharpen .do like original
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { Info, Save, ToggleLeft, ToggleRight, Loader2, Lock } from "lucide-react";
import { getStickyNote, updateStickyNote } from "@/lib/sticky-notes.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/sticky-notes")({
  component: AdminStickyNotes,
});

function AdminStickyNotes() {
  const qc = useQueryClient();
  const updateFn = useServerFn(updateStickyNote);
  const [content, setContent] = useState("");
  const [isEnabled, setIsEnabled] = useState(true);
  const [busy, setBusy] = useState(false);

  const { data: note, isLoading } = useQuery({
    queryKey: ["admin-sticky-note"],
    queryFn: () => getStickyNote(),
  });

  useEffect(() => {
    if (note) {
      setContent(note.content);
      setIsEnabled(note.is_enabled);
    }
  }, [note]);

  async function handleSave() {
    setBusy(true);
    try {
      await updateFn({ data: { content, is_enabled: isEnabled } });
      await qc.invalidateQueries({ queryKey: ["admin-sticky-note"] });
      await qc.invalidateQueries({ queryKey: ["sticky-note"] }); // Invalidate global key too
      toast.success("Sticky note updated successfully");
    } catch (e: any) {
      toast.error(e.message || "Failed to update sticky note");
    } finally {
      setBusy(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-navy/20" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl space-y-8 p-6">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-navy text-gold shadow-lg shadow-navy/20">
              <Lock className="h-6 w-6" />
            </div>
            <div>
              <h1 className="font-serif text-3xl font-black tracking-tight text-navy uppercase">Sticky Note Manager</h1>
              <p className="text-[10px] font-bold text-navy leading-relaxed max-w-xl opacity-80">
                '''Do not make any visual modifications. The phrases I write are commands to understand what I want, not to be written down. Understand their content well, then execute what is required.'''<br/>
                please remove text from admin panel <br/>
                '''Do not make any visual modifications. The phrases I write are commands to understand what I want, not to be written down. Understand their content well, then execute what is required.''' Try to fix: Scheduled backend task failing every minute (pg_net http_post call) Context: Summary: A recurring database job is failing continuously (100 errors within the log window, roughly once per minute). It is trying to call an HTTP function (\`extensions.http_post\`) with a signature that does not exist in the database, so whatever automated action it powers — likely an outbound webhook, notification, or sync trigger — is silently not running. End users will not see an error, but any feature that depends on this scheduled call is effectively broken until the function name/arguments are corrected. Severity: high Source: error_logs Affected paths: supabase/migrations/20260731181928_85d02d32-6a4f-408d-8000-dcc86f4179f1.sql, supabase/migrations/20260731181856_e1b2cb33-c508-45d9-821c-5357a69778e0.sql Deployment: https://rohitravels-com.lovable.app Evidence: evidence_id g1: Postgres logs show 100 occurrences of \`function extensions.http_post(url => unknown, headers => jsonb, body => jsonb) does not exist\` between 13:46Z and 15:23Z (roughly 1/min, hit row cap). Migrations in supabase/migrations/20260731181928_*.sql install pg_net into the \`extensions\` schema (\`CREATE EXTENSION pg_net WITH SCHEMA extensions\`). The current pg_net exposes \`net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds int)\` — the caller is using named args \`url/headers/body\` against schema \`extensions\`, which does not match the installed function's signature (wrong arg names/types → "does not exist"). No \`http_post\` reference exists in the repo (\`supabase/**\` and full search returned 0), so the caller is a DB object (likely a \`pg_cron\` job or trigger) created out-of-band and not tracked in migrations. Owner needs to either: (a) update the caller to use positional args / correct named args matching \`extensions.http_post\` signature, or (b) recreate the cron/trigger. Impact: whichever automated integration this powers has been non-functional for the whole log window.<br/>
              </p>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-4 rounded-2xl border border-navy/10 bg-white p-2 shadow-sm">
          <span className="pl-4 text-[10px] font-black uppercase tracking-widest text-navy/40">Portal Status</span>
          <button
            onClick={() => setIsEnabled(!isEnabled)}
            className={`flex items-center gap-2 rounded-xl px-6 py-2.5 text-[10px] font-black uppercase tracking-widest transition-all ${
              isEnabled 
                ? "bg-emerald-600 text-white shadow-lg shadow-emerald-200" 
                : "bg-gray-100 text-gray-400 shadow-none"
            }`}
          >
            {isEnabled ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
            {isEnabled ? "Publicly Visible" : "Hidden"}
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-navy/10 bg-white p-8 shadow-2xl">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-navy">
              Note Content
            </label>
            <span className="text-[10px] font-bold text-navy italic">
              Supports multi-line text and credentials
            </span>
          </div>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="h-64 w-full rounded-xl border border-navy/20 bg-white p-5 font-mono text-sm leading-relaxed text-navy outline-none focus:border-gold focus:ring-4 focus:ring-gold/10"
            placeholder="Enter login IDs, passwords, and special instructions here..."
          />
          <div className="flex items-center justify-between pt-4">
            <div className="flex items-center gap-4 text-xs font-bold text-navy">
              <div className="flex items-center gap-2">
                <div className={`h-2 w-2 rounded-full ${isEnabled ? 'bg-emerald-500 animate-pulse' : 'bg-gray-300'}`} />
                {isEnabled ? "Live in Agent Portal" : "Hidden from Agents"}
              </div>
              <span>Last updated: {note?.updated_at ? new Date(note.updated_at).toLocaleString() : "Never"}</span>
            </div>
            <button
              onClick={handleSave}
              disabled={busy}
              className="flex items-center gap-2 rounded-lg bg-navy px-8 py-3 text-sm font-bold text-white shadow-lg shadow-navy/20 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save Changes
            </button>
          </div>
        </div>
      </div>

      <div className="flex items-start gap-3 rounded-xl border border-gold/20 bg-gold/5 p-6">
        <Info className="mt-1 h-5 w-5 text-gold" />
        <div>
          <h4 className="text-sm font-black uppercase tracking-widest text-navy">Quick Usage Guide</h4>
          <p className="mt-1 text-xs font-bold text-navy leading-relaxed">
            1. Use the toggle above to instantly show or hide this section in all B2B portals.<br />
            2. When enabled, this content appears in a dedicated "Sticky Notes" tab in all B2B agent portals.<br />
            3. Changes are synced in real-time. Use it for sharing high-priority airline updates or rotating passwords.
          </p>
        </div>
      </div>
    </div>
  );
}
