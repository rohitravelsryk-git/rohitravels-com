import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { Home, Info, Save, ToggleLeft, ToggleRight, Loader2, Lock, Plane, LogOut } from "lucide-react";
import { getStickyNote, updateStickyNote } from "@/lib/sticky-notes.functions";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AdminHeaderExtras } from "@/components/AdminHeaderExtras";
import { AdminTabs } from "@/components/AdminTabs";
import { AdminPageHeading } from "@/components/AdminPageHeading";
import { adminLogout } from "@/lib/fares.functions";
import { formatDateTimeShort } from "@/lib/date-format";
import { useRouter } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/sticky-notes")({
  ssr: false,
  component: AdminStickyNotes,
});

async function fetchStickyNoteDirect() {
  try {
    const res = await getStickyNote();
    if (res) return res;
  } catch (err) {
    console.warn("getStickyNote server function failed, falling back to direct query:", err);
  }
  // Client-side direct fallback
  const { data } = await supabase
    .from("b2b_sticky_notes")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(1);
  return data && data.length > 0 ? data[0] : null;
}

function AdminStickyNotes() {
  const qc = useQueryClient();
  const router = useRouter();
  const updateFn = useServerFn(updateStickyNote);
  const logoutFn = useServerFn(adminLogout);
  const [content, setContent] = useState("");
  const [isEnabled, setIsEnabled] = useState(true);
  const [busy, setBusy] = useState(false);

  const { data: note, isLoading } = useQuery({
    queryKey: ["admin-sticky-note"],
    queryFn: fetchStickyNoteDirect,
    staleTime: 30_000,
    retry: 1,
  });

  useEffect(() => {
    if (note) {
      setContent(note.content || "");
      setIsEnabled(note.is_enabled ?? true);
    }
  }, [note]);

  async function handleSave() {
    setBusy(true);
    try {
      let saved = false;
      try {
        await updateFn({ data: { content, is_enabled: isEnabled } });
        saved = true;
      } catch (err) {
        console.warn("updateFn server call failed, trying direct update:", err);
      }

      if (!saved) {
        const { data: existing } = await supabase
          .from("b2b_sticky_notes")
          .select("id")
          .limit(1)
          .maybeSingle();

        if (existing?.id) {
          await supabase
            .from("b2b_sticky_notes")
            .update({ content, is_enabled: isEnabled, updated_at: new Date().toISOString() })
            .eq("id", existing.id);
        } else {
          await supabase
            .from("b2b_sticky_notes")
            .insert({ content, is_enabled: isEnabled });
        }
      }

      await qc.invalidateQueries({ queryKey: ["admin-sticky-note"] });
      await qc.invalidateQueries({ queryKey: ["sticky-note"] });
      toast.success("Sticky note updated successfully");
    } catch (e: any) {
      toast.error(e.message || "Failed to update sticky note");
    } finally {
      setBusy(false);
    }
  }

  async function handleLogout() {
    await logoutFn();
    await qc.invalidateQueries({ queryKey: ["admin", "status"] });
    router.invalidate();
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#D97757]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F4EFEA] animate-premium-fade">
      <header className="border-b border-[#E7E5E4] bg-[#141413] text-white">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#D97757]">
              <Plane className="h-5 w-5 -rotate-45 text-white" />
            </div>
            <div>
              <p className="font-sans text-lg font-semibold">Admin Panel</p>
              <p className="text-[11px] font-medium text-[#78716C]">Sticky Notes Manager</p>
            </div>
          </div>
          <div className="flex gap-2">
            <AdminHeaderExtras />
            <a href="/" className="inline-flex items-center gap-1.5 rounded-full border border-[#3d3d3a] bg-[#262624] px-3 py-1.5 text-[13px] font-medium text-white transition-colors hover:border-[#55554f] hover:bg-[#34342f]"><Home className="h-3.5 w-3.5" /> Home</a>
            <button onClick={handleLogout} className="inline-flex items-center gap-2 rounded-lg bg-[#D97757] px-3 py-1.5 text-[13px] font-medium text-white transition-colors hover:bg-[#c66849]">
              <LogOut className="h-3.5 w-3.5" /> Logout
            </button>
          </div>
        </div>
        <AdminTabs />
      </header>

      <main className="mx-auto max-w-5xl space-y-8 px-4 py-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <AdminPageHeading
              icon={Lock}
              label="Sticky Note Manager"
              description="Manage the private operational note shared with approved B2B agents."
            />
          </div>
          
          <div className="flex items-center gap-4 rounded-2xl border border-[#E7E5E4] bg-[#FAF9F5] p-2 shadow-sm">
            <span className="pl-4 text-[10px] font-black uppercase tracking-widest text-[#78716C]">Portal Status</span>
            <button
              onClick={() => setIsEnabled(!isEnabled)}
              className={}
            >
              {isEnabled ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
              {isEnabled ? "Publicly Visible" : "Hidden"}
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-[#E7E5E4] bg-[#FAF9F5] p-8 shadow-xl">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-black uppercase tracking-[0.2em] text-[#1C1917]">
                Note Content
              </label>
              <span className="text-[11px] font-semibold text-[#78716C] italic">
                Supports multi-line text and credentials
              </span>
            </div>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="h-64 w-full rounded-xl border border-[#E7E5E4] bg-white p-5 font-mono text-sm leading-relaxed text-[#1C1917] outline-none focus:border-[#D97757] focus:ring-4 focus:ring-[#D97757]/10"
              placeholder="Enter login IDs, passwords, and special instructions here..."
            />
            <div className="flex items-center justify-between pt-4">
              <div className="flex items-center gap-4 text-xs font-semibold text-[#78716C]">
                <div className="flex items-center gap-2">
                  <div className={} />
                  <span className="text-[#1C1917]">{isEnabled ? "Live in Agent Portal" : "Hidden from Agents"}</span>
                </div>
                <span>Last updated: {note?.updated_at ? formatDateTimeShort(note.updated_at) : "Never"}</span>
              </div>
              <button
                onClick={handleSave}
                disabled={busy}
                className="flex items-center gap-2 rounded-xl bg-[#141413] px-8 py-3 text-sm font-bold text-white shadow-lg transition-all hover:bg-[#D97757] active:scale-[0.98] disabled:opacity-50"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save Changes
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-start gap-3 rounded-xl border border-[#D97757]/30 bg-[#D97757]/10 p-6">
          <Info className="mt-1 h-5 w-5 text-[#D97757] shrink-0" />
          <div>
            <h4 className="text-sm font-black uppercase tracking-widest text-[#1C1917]">Quick Usage Guide</h4>
            <p className="mt-1 text-xs font-medium text-[#78716C] leading-relaxed">
              1. Use the toggle above to instantly show or hide this section in all B2B portals.<br />
              2. When enabled, this content appears in a dedicated Sticky Notes tab in all B2B agent portals.<br />
              3. Changes are synced in real-time. Use it for sharing high-priority airline updates or rotating passwords.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
