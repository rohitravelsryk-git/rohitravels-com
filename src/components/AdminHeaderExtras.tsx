import { useState } from "react";
import { Settings, KeyRound } from "lucide-react";
import { ChangePasswordDialog } from "@/components/AdminPasswordDialogs";

/**
 * Shared header actions for every admin sub-page.
 * - "Manage lists"   → navigates to /admin?manage=1 (auto-opens the settings drawer).
 * - "Change password" → opens the ChangePasswordDialog inline.
 */
export function AdminHeaderExtras() {
  const [showPw, setShowPw] = useState(false);
  return (
    <>
      <a
        href="/admin?manage=1"
        className="inline-flex items-center gap-2 rounded-md border border-white/20 px-3 py-2 text-xs font-semibold hover:bg-white/10"
      >
        <Settings className="h-3.5 w-3.5" /> Manage lists
      </a>
      <button
        onClick={() => setShowPw(true)}
        className="inline-flex items-center gap-2 rounded-md border border-white/20 px-3 py-2 text-xs font-semibold hover:bg-white/10"
      >
        <KeyRound className="h-3.5 w-3.5" /> Change password
      </button>
      {showPw && <ChangePasswordDialog onClose={() => setShowPw(false)} />}
    </>
  );
}

