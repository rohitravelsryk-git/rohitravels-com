import { Plane, Ticket, FileText, Stamp, Link2, MessageSquare, Megaphone, Users, ShieldCheck, Printer, UserCog, Wallet, StickyNote, Landmark, QrCode, BarChart3 } from "lucide-react";

export type TabDef = {
  id: string;
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  /** hidden from staff users (admin only) */
  adminOnly?: boolean;
};

export const ALL_TABS: TabDef[] = [
  { id: "fares", to: "/admin", label: "Group Fares", icon: Plane },
  { id: "tickets", to: "/admin/tickets", label: "Group Tickets Confirmed", icon: Ticket },
  { id: "self-groups", to: "/admin/self-groups", label: "Self Groups", icon: Users },
  { id: "agents", to: "/admin/agents", label: "Registered Agents", icon: Users, adminOnly: false },
  { id: "bookings", to: "/admin/bookings", label: "Agent Group Bookings", icon: Ticket, adminOnly: false },
  { id: "ticket-format", to: "/admin/group-ticket-format", label: "Print Group Tickets", icon: FileText },
  { id: "branded-ticket-pdf", to: "/print-format", label: "Print Tickets", icon: Printer },
  { id: "marketing", to: "/admin/marketing", label: "Marketing", icon: Megaphone, adminOnly: false },
  { id: "vouchers", to: "/admin/vouchers", label: "Discount Vouchers", icon: Ticket, adminOnly: false },
  { id: "ok-to-board", to: "/admin/ok-to-board", label: "OK to Board", icon: Stamp },
  { id: "visa-links", to: "/admin/visa-links", label: "Visa Links", icon: Link2 },
  { id: "queries", to: "/admin/queries", label: "Queries", icon: MessageSquare, adminOnly: false },
  { id: "announcement-banner", to: "/admin/announcement-banner", label: "Announcement Banner", icon: Megaphone, adminOnly: false },
  { id: "announcement", to: "/admin/latest-updates", label: "Latest Updates", icon: Megaphone, adminOnly: false },
  { id: "backup", to: "/admin/backup", label: "Backup & Recovery", icon: ShieldCheck, adminOnly: false },
  { id: "staff", to: "/admin/staff", label: "Staff Access", icon: UserCog, adminOnly: false },
  { id: "ledger", to: "/admin/ledger", label: "Ledger Accounts", icon: Wallet },
  { id: "bank-details", to: "/admin/bank-details", label: "Bank Details", icon: Landmark, adminOnly: false },
  { id: "sticky-notes", to: "/admin/sticky-notes", label: "Agent Sticky Notes", icon: StickyNote, adminOnly: false },
  { id: "barcode-generator", to: "/admin/barcode-generator", label: "Bar & QR Codes", icon: QrCode, adminOnly: false },
];

/** Paths a staff member with the given allowed tab ids may open. */
export function allowedStaffPaths(tabIds: string[]): string[] {
  const set = new Set(tabIds);
  return ALL_TABS.filter((t) => set.has(t.id) && t.to !== "/admin").map((t) => t.to);
}
