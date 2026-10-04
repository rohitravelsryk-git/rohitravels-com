import { useState } from "react";
import { MessageCircle } from "lucide-react";
import { WhatsAppDirectDialog } from "@/components/WhatsAppDirectDialog";
import { AdminQuickActions } from "@/components/AdminQuickActions";

/** Shared admin header actions. Visual styling follows the canonical Rohi design system. */
export function AdminHeaderExtras() {
  const [showWa, setShowWa] = useState(false);

  return (
    <>
      <AdminQuickActions />
      {/* AdminNotifications is globally mounted in __root for persistent tracking */}
      <button
        type="button"
        onClick={() => setShowWa(true)}
        className="inline-flex min-h-9 items-center gap-1.5 rounded-[var(--rohi-radius-md)] border border-[var(--rohi-border-strong)] bg-[var(--rohi-surface-strong)] px-3 py-1.5 text-[13px] font-medium text-[var(--rohi-text-inverse)] shadow-[var(--rohi-shadow-sm)] transition-[background-color,border-color,box-shadow] duration-[var(--duration-fast)] ease-[var(--ease-premium)] hover:border-[var(--rohi-brand)] hover:bg-[var(--rohi-surface-stronger)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rohi-brand)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--rohi-surface)]"
      >
        <MessageCircle className="h-3.5 w-3.5 text-[var(--rohi-brand)]" />
        WhatsApp Direct
      </button>

      {showWa && <WhatsAppDirectDialog onClose={() => setShowWa(false)} />}
    </>
  );
}
