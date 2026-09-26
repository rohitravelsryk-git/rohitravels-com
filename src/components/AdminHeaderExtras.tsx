import { useState } from "react";
import { MessageCircle } from "lucide-react";
import { useRouterState } from "@tanstack/react-router";
import { WhatsAppDirectDialog } from "@/components/WhatsAppDirectDialog";
import { AdminQuickActions } from "@/components/AdminQuickActions";

/**
 * Shared header actions for every admin sub-page.
 * - "Format Maker" / "All in 1" → terracotta quick actions (every admin tab)
 * - "WhatsApp"         → opens a direct-chat composer (country code + number)
 * Manage lists / Change password now live as standalone pills in the AdminTabs
 * nav bar, after the last folder.
 */
export function AdminHeaderExtras() {
  const [showWa, setShowWa] = useState(false);
  const { location } = useRouterState();

  // Enabled on all admin pages as per user request
  const isEnabled = true;

  return (
    <>
      <AdminQuickActions />
      {/* AdminNotifications is now globally mounted in __root for persistent tracking */}

      {isEnabled && (
        <button
          onClick={() => setShowWa(true)}
          className="ml-auto inline-flex items-center gap-2 rounded-lg bg-[var(--whatsapp)] px-3 py-1.5 text-xs font-medium text-white shadow-sm transition-colors hover:brightness-110"
        >
          <MessageCircle className="h-3.5 w-3.5" /> WhatsApp Direct
        </button>
      )}

      {showWa && <WhatsAppDirectDialog onClose={() => setShowWa(false)} />}

    </>
  );
}
