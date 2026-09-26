import { useState } from "react";
import { MessageCircle } from "lucide-react";
import { WhatsAppDirectDialog } from "@/components/WhatsAppDirectDialog";
import { AdminQuickActions } from "@/components/AdminQuickActions";

/**
 * Shared header actions for every admin page.
 * - "Format Maker" / "All in 1" → terracotta quick actions (every admin tab)
 * - "WhatsApp Direct" → opens a direct-chat composer (country code + number)
 * Manage lists / Change password live as standalone pills in the AdminTabs nav bar.
 */
export function AdminHeaderExtras() {
  const [showWa, setShowWa] = useState(false);

  return (
    <>
      <AdminQuickActions />
      {/* AdminNotifications is globally mounted in __root for persistent tracking */}
      <button
        onClick={() => setShowWa(true)}
        className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--whatsapp)] px-3 py-1.5 text-[13px] font-medium text-white shadow-sm transition-colors hover:brightness-110"
      >
        <MessageCircle className="h-3.5 w-3.5" /> WhatsApp Direct
      </button>

      {showWa && <WhatsAppDirectDialog onClose={() => setShowWa(false)} />}
    </>
  );
}
