import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { Info, Save, ToggleLeft, ToggleRight, Loader2 } from "lucide-react";
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
    <div className="max-w-4xl space-y-8 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-3xl font-black text-navy">'''Do not make any visual modifications. The phrases I write are commands to understand what I want, not to be written down. Understand their content well, then execute what is required.'''
                                        
                                            
                                            Please give the whole site a premium, professional visual refresh. Scope this STRICTLY to visual/UI polish — do NOT change, remove, or restructure any real data, content, text, fares, prices, contact info, service names, booking logic, admin panel functionality, or the B2B agent portal's data/features.

COLOR PALETTE: Replace the current color scheme with a premium navy & gold palette — deep navy (e.g. #0A1F44 / #0F2A5C) as the primary brand color, warm gold/bronze (e.g. #C9A24B) as the accent for CTAs, highlights, and key numbers (fares), and clean white/light neutral backgrounds for contrast. Keep sufficient contrast for readability (WCAG AA). Update this consistently across header, nav, buttons, cards, footer, and live fare cards.

TYPOGRAPHY: Choose a premium, professional font pairing (elegant heading font + clean readable body font) that fits a luxury/trusted travel brand. Apply consistently across all headings, body text, buttons, and nav.

MENUS & BUTTONS — fix placement and consistency:

Clean up the top navigation bar: consistent spacing/alignment between "Discount Vouchers," "Calculators," "Our Services," "Verify Visa," phone number, and "Agent Login" — make it look aligned, not cramped, and ensure a proper mobile hamburger menu.

"Admin Panel" link should be visually de-emphasized/tucked away (small, secondary style) rather than prominent, since it's not customer-facing.

Ensure "Book Now," "View Fares," "Fare on WhatsApp" buttons on fare cards have consistent sizing, spacing, and clear visual hierarchy (primary gold CTA vs secondary outline buttons).

Fix spacing/alignment on the ORIGIN/DESTINATION search bar and trending destination tiles so they look like a polished, professional booking widget.

Footer: align contact/social/map columns neatly with consistent spacing.

Overall goal: premium, trustworthy, professional look for an established international travel agency, while every piece of existing text, fare data, links, and functionality stays exactly the same. Do not touch backend logic, database data, or content copy — visual design pass only.</h1>
          <p className="mt-2 text-sm font-semibold text-navy/80">
            Publish confidential credentials and instructions to all B2B agents.
          </p>
        </div>
        <button
          onClick={() => setIsEnabled(!isEnabled)}
          className={`flex items-center gap-2 rounded-full px-6 py-2.5 text-xs font-black uppercase tracking-widest transition-all ${
            isEnabled 
              ? "bg-emerald-600 text-white shadow-emerald-200" 
              : "bg-gray-200 text-gray-500 shadow-none"
          }`}
        >
          {isEnabled ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
          {isEnabled ? "Enabled" : "Disabled"}
        </button>
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
            2. When enabled, this content appears at the top of the main Fares dashboard for all agents.<br />
            3. Changes are synced in real-time. Use it for sharing high-priority airline updates or rotating passwords.
          </p>
        </div>
      </div>
    </div>
  );
}
