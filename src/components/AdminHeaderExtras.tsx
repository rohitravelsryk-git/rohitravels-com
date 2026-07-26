import { useState } from "react";
import { Settings, KeyRound, RefreshCw, Bell } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { ChangePasswordDialog } from "@/components/AdminPasswordDialogs";

/**
 * Shared header actions for every admin sub-page.
 * - "Scan reminders"   → link to /admin/tickets (reminder scan lives there)
 * - "Notifications"    → link to /admin/queries (query notifications live there)
 * - "Manage lists"     → navigates to /admin?manage=1 (auto-opens settings drawer)
 * - "Change password"  → opens the ChangePasswordDialog inline
 */
export function AdminHeaderExtras() {
  const [showPw, setShowPw] = useState(false);
  const btn = "inline-flex items-center gap-2 rounded-md border border-white/20 px-3 py-2 text-xs font-semibold hover:bg-white/10";
  return (
    <>
      <Link to="/admin/tickets" className={btn}>
        <RefreshCw className="h-3.5 w-3.5" /> Scan reminders
      </Link>
      <Link to="/admin/queries" className={btn}>
        <Bell className="h-3.5 w-3.5" /> Notifications
      </Link>
      <a href="/admin?manage=1" className={btn}>
        <Settings className="h-3.5 w-3.5" /> Manage lists
      </a>
      <button onClick={() => setShowPw(true)} className={btn}>
        <KeyRound className="h-3.5 w-3.5" /> Change password
      </button>
      {showPw && <ChangePasswordDialog onClose={() => setShowPw(false)} />}
    </>
  );
}
