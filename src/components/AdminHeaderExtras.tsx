import { useState } from "react";
import { Settings, KeyRound, ArrowLeft, Home, MessageCircle } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { ChangePasswordDialog } from "@/components/AdminPasswordDialogs";
import { AdminNotifications } from "@/components/AdminNotifications";
import { WhatsAppDirectDialog } from "@/components/WhatsAppDirectDialog";

/**
 * Shared header actions for every admin sub-page.
 * - "Back" / "Home"     → gold navigation buttons (present on every admin tab)
 * - "Scan reminders"   → link to /admin/tickets (reminder scan lives there)
 * - "Notifications"    → link to /admin/queries (query notifications live there)
 * - "WhatsApp"         → opens a direct-chat composer (country code + number)
 * - "Manage lists"     → navigates to /admin?manage=1 (auto-opens settings drawer)
 * - "Change password"  → opens the ChangePasswordDialog inline
 */
export function AdminHeaderExtras() {
  const [showPw, setShowPw] = useState(false);
  const [showWa, setShowWa] = useState(false);
  const btn = "inline-flex items-center gap-2 rounded-md border border-white/20 px-3 py-2 text-xs font-semibold hover:bg-white/10";
  const goldBtn = "inline-flex items-center gap-2 rounded-md border border-gold/60 bg-gold/15 px-3 py-2 text-xs font-bold uppercase tracking-wider text-gold hover:bg-gold hover:text-navy";

  return (
    <>
      <button
        onClick={() => { if (typeof window !== "undefined") window.history.back(); }}
        className={goldBtn}
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back
      </button>
      <Link to="/admin" className={goldBtn}>
        <Home className="h-3.5 w-3.5" /> Home
      </Link>
      <AdminNotifications />

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
