import { useState } from "react";
import { Settings, KeyRound, ArrowLeft, Home, MessageCircle } from "lucide-react";
import { Link, useRouterState } from "@tanstack/react-router";
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
  const { location } = useRouterState();
  
  // Enabled on all admin pages as per user request
  const isEnabled = true;

  const btn = "inline-flex items-center gap-2 rounded-lg border border-[var(--border-default)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]";
  const goldBtn = "inline-flex items-center gap-2 rounded-lg border border-[rgba(217,119,87,0.35)] bg-[var(--bg-accent-tint)] px-3 py-1.5 text-xs font-medium text-[var(--accent-ink)] transition-colors hover:bg-[var(--accent)] hover:text-white";

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
      {/* AdminNotifications is now globally mounted in __root for persistent tracking */}

      {isEnabled && (
        <button
          onClick={() => setShowWa(true)}
          className="ml-auto inline-flex items-center gap-2 rounded-lg border border-[var(--whatsapp)]/40 bg-[var(--whatsapp)]/10 px-3 py-1.5 text-xs font-medium text-[var(--whatsapp)] transition-colors hover:bg-[var(--whatsapp)] hover:text-white"
        >
          <MessageCircle className="h-3.5 w-3.5" /> WhatsApp Direct
        </button>
      )}

      <a href="/admin?manage=1" className={btn}>
        <Settings className="h-3.5 w-3.5" /> Manage lists
      </a>

      <button onClick={() => setShowPw(true)} className={btn}>
        <KeyRound className="h-3.5 w-3.5" /> Change password
      </button>
      {showPw && <ChangePasswordDialog onClose={() => setShowPw(false)} />}
      {showWa && <WhatsAppDirectDialog onClose={() => setShowWa(false)} />}

    </>
  );
}
