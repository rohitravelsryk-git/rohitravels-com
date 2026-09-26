import { useState } from "react";
import { Sparkles } from "lucide-react";
import { FormatMakerDialog } from "@/components/FormatMakerDialog";

const ALL_IN_1_URL =
  "https://docs.google.com/document/d/12tbbEUe2QgxE0aa3nBvjjhL2WEekrVN6tk7S6-m9EQo/edit?usp=drive_link";

const pill =
  "inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent)] px-3 py-1.5 text-[13px] font-medium text-white shadow-sm transition-colors hover:bg-[var(--accent-hover)]";

/**
 * Format Maker + All in 1 actions, rendered in the header of every admin page
 * (via AdminHeaderExtras) so they stay reachable from any tab. The dialog
 * fetches its own lists when the page doesn't already have them.
 */
export function AdminQuickActions() {
  const [showFormatMaker, setShowFormatMaker] = useState(false);
  return (
    <>
      <button onClick={() => setShowFormatMaker(true)} className={pill}>
        <Sparkles className="h-3.5 w-3.5" /> Format Maker
      </button>
      <a href={ALL_IN_1_URL} target="_blank" rel="noopener noreferrer" className={pill}>
        <Sparkles className="h-3.5 w-3.5" /> All in 1
      </a>
      <FormatMakerDialog open={showFormatMaker} onClose={() => setShowFormatMaker(false)} />
    </>
  );
}
