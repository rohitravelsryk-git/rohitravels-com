import { Plane, Ticket, FileText, Stamp, Link2, MessageSquare, Megaphone, Users, ShieldCheck, Printer, UserCog, Wallet, StickyNote, Landmark, QrCode, BookOpen, Calculator, Settings } from "lucide-react";

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
  { id: "calculators", to: "/admin/calculators", label: "Calculators", icon: Calculator, adminOnly: false },
  { id: "ok-to-board", to: "/admin/ok-to-board", label: "OK to Board", icon: Stamp },
  { id: "visa-links", to: "/admin/visa-links", label: "Visa Links", icon: Link2 },
  { id: "queries", to: "/admin/queries", label: "Queries", icon: MessageSquare, adminOnly: false },
  { id: "announcement-banner", to: "/admin/announcement-banner", label: "Announcement Banner", icon: Megaphone, adminOnly: false },
  { id: "announcement", to: "/admin/latest-updates", label: "Latest Updates", icon: Megaphone, adminOnly: false },
  { id: "backup", to: "/admin/backup", label: "Backup & Recovery", icon: ShieldCheck, adminOnly: false },
  { id: "staff", to: "/admin/staff", label: "Staff Access", icon: UserCog, adminOnly: false },
  { id: "ledger", to: "/admin/ledger", label: "Ledger Accounts", icon: Wallet },
  { id: "airline-ledger", to: "/admin/airline-ledger", label: "Airline Accounts", icon: Plane },
  { id: "accounts", to: "/admin/accounts", label: "Rohi Accounts Desk", icon: Wallet },
  { id: "accounts-book", to: "/admin/accounts-book", label: "Accounts Book", icon: BookOpen },

  { id: "bank-details", to: "/admin/bank-details", label: "Bank Details", icon: Landmark, adminOnly: false },
  { id: "sticky-notes", to: "/admin/sticky-notes", label: "Agent Sticky Notes", icon: StickyNote, adminOnly: false },
  { id: "barcode-generator", to: "/admin/barcode-generator", label: "Bar & QR Codes", icon: QrCode, adminOnly: false },
];

/** Logical "folders" that group the flat tab list into section dropdowns. */
export type TabGroupDef = {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  tabIds: string[];
};

export const TAB_GROUPS: TabGroupDef[] = [
  { id: "fares", label: "Fares & Tickets", icon: Plane, tabIds: ["fares", "tickets", "self-groups", "ok-to-board"] },
  { id: "agents", label: "Agents & Bookings", icon: Users, tabIds: ["agents", "bookings", "queries", "visa-links"] },
  { id: "finance", label: "Accounts & Finance", icon: Wallet, tabIds: ["ledger", "airline-ledger", "accounts", "accounts-book", "bank-details", "calculators"] },
  { id: "printing", label: "Printing & PDFs", icon: Printer, tabIds: ["ticket-format", "branded-ticket-pdf", "barcode-generator"] },
  { id: "marketing", label: "Marketing & Updates", icon: Megaphone, tabIds: ["marketing", "vouchers", "announcement-banner", "announcement"] },
  { id: "settings", label: "Team & Tools", icon: Settings, tabIds: ["sticky-notes", "staff", "backup"] },
];

/** Paths a staff member with the given allowed tab ids may open. */
export function allowedStaffPaths(tabIds: string[]): string[] {
  const set = new Set(tabIds);
  return ALL_TABS.filter((t) => set.has(t.id) && t.to !== "/admin").map((t) => t.to);
}
