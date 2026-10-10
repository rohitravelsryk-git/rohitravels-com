import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Check, ChevronDown, ExternalLink, GripVertical, Home, LogOut, Menu, Pencil, RefreshCw, Save, Wallet, X } from "lucide-react";
import { adminLogout, verifyAdminPassword } from "@/lib/fares.functions";
import { AdminHeaderExtras } from "@/components/AdminHeaderExtras";import { AdminTabs } from "@/components/AdminTabs";
import { downloadExcel, downloadPdf } from "@/lib/table-export";
import {
  createAccountsBookAccount,
  createAccountsBookGroupTransaction,
  createAccountsBookLinkedEntry,
  createAccountsBookService,
  createAccountsBookTransaction,
  createAccountsBookTransfer,
  deleteAccountsBookAccount,
  deleteAccountsBookService,
  deleteAccountsBookTransaction,
  listAccountsBook,
  updateAccountsBookTransaction,
  updateAccountsBookAccount,
  reconcileBanksWalletsToSheets,
  syncAccountsBookAccountSettingsToSheets,
  reconcileDailyCashBookToSheets,
  reconcileExpensesToSheets,
  updateAccountsBookOpening,
  reorderAccountsBookAccounts,
  reorderAccountsBookServices,
} from "@/lib/accounts-book.functions";
import { formatDateShort } from "@/lib/date-format";


export const Route = createFileRoute("/admin/accounts-book")({
  head: () => ({
    meta: [{ title: "Accounts Book — Rohi Admin" }],
  }),
  component: AccountsBookClone,
});

/* ============================= TYPES ============================= */
type Kind = "cash" | "bank" | "wallet";
type Account = { id: string; name: string; kind: Kind; opening_balance: number; opening_balance_date?: string | null; logo_url?: string | null };
type Txn = {
  id: string;
  account_id: string;
  entry_date: string;
  entry_type: string;
  category: string;
  party: string | null;
  description: string;
  amount: number;
  direct_cost: number;
  direction: "in" | "out";
  source_type?: string | null;
  source_id?: string | null;
};
type Service = { id: string; name: string };
type TabId = "dashboard" | "cashbook" | "bank" | "sales" | "expenses" | "reports" | "cashcount" | "settings";

const EXPENSE_PREFIX = "EXP: ";
const DEFAULT_SALES_CATS = ["Counter Sales", "Visa Processing", "Group Tickets", "Umrah", "Insurance", "Protect", "Appointments", "Refunds"];
const DEFAULT_EXPENSE_CATS = ["Home Expense", "Office Expense"];

const TAB_GROUPS: { header: string | null; tabs: { id: TabId; label: string }[] }[] = [
  { header: null, tabs: [{ id: "dashboard", label: "Dashboard" }] },
  { header: null, tabs: [{ id: "cashbook", label: "Daily Cash Book" }] },
  { header: null, tabs: [{ id: "bank", label: "Banks & Wallets" }] },
  { header: null, tabs: [{ id: "sales", label: "Sales Accounts" }] },
  { header: null, tabs: [{ id: "expenses", label: "Expenses" }] },
  { header: "Analysis", tabs: [{ id: "reports", label: "Profit & Loss Statement" }] },
  { header: null, tabs: [{ id: "cashcount", label: "Cash Counter" }] },
  { header: null, tabs: [{ id: "settings", label: "Settings" }] },
];
const TAB_NUMBERS: Record<TabId, string> = {
  dashboard: "01",
  cashbook: "02",
  bank: "03",
  sales: "04",
  expenses: "05",
  reports: "06",
  cashcount: "07",
  settings: "08",
};

/* ============================= HELPERS ============================= */
const fmt = (n: unknown) => (Number(n) || 0).toLocaleString("en-PK", { maximumFractionDigits: 0 });
const todayISO = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};
const monthKey = (d: string) => (d || "").slice(0, 7);
function monthLabel(key: string) {
  if (!key) return "—";
  const [y, m] = key.split("-");
  const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${names[parseInt(m ?? "1", 10) - 1]} ${y}`;
}

function accountBrand(name: string, kind: Kind) {
  const n = name.toLowerCase();
  const known: Record<string, { short: string; bg: string; fg: string }> = {
    jazzcash: { short: "JC", bg: "#7B1FA2", fg: "#fff" },
    easypaisa: { short: "EP", bg: "#008C45", fg: "#fff" },
    hbl: { short: "HBL", bg: "#006B3C", fg: "#fff" },
    ubl: { short: "UBL", bg: "#0057A8", fg: "#fff" },
    meezan: { short: "MB", bg: "#006B54", fg: "#fff" },
    allied: { short: "ABL", bg: "#004B8D", fg: "#fff" },
    abl: { short: "ABL", bg: "#004B8D", fg: "#fff" },
    mcb: { short: "MCB", bg: "#003A70", fg: "#fff" },
    bankalfalah: { short: "BAFL", bg: "#B71C1C", fg: "#fff" },
  };
  const key = Object.keys(known).find((k) => n.includes(k));
  if (key) return known[key];
  const initials = name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((x) => x[0]?.toUpperCase()).join("") || (kind === "wallet" ? "W" : "B");
  return { short: initials, bg: kind === "wallet" ? "#6D597A" : "#355070", fg: "#fff" };
}

function BankWalletLogo({ account }: { account: Account }) {
  const brand = accountBrand(account.name, account.kind);
  return (
    <div
      aria-label={account.name + " logo"}
      title={account.name}
      style={{
        width: 54, height: 54, borderRadius: 14, background: brand.bg, color: brand.fg,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontWeight: 900, fontSize: brand.short.length > 3 ? 10 : 13,
        letterSpacing: ".02em", boxShadow: "0 6px 16px rgba(20,20,19,.14)", flexShrink: 0,
      }}
    >
      {brand.short}
    </div>
  );
}

// Website used to look up each bank/wallet's own brand icon. Unknown accounts
// (and any icon that fails to load) fall back to the coloured initials badge.
function bankDomain(name: string): string | null {
  const lower = name.toLowerCase();
  const compact = lower.replace(/[^a-z0-9]/g, "");
  const tokens = lower.split(/[^a-z0-9]+/).filter(Boolean);
  const inc = (...parts: string[]) => parts.some((p) => compact.includes(p));
  const word = (...codes: string[]) => codes.some((c) => tokens.includes(c));
  if (inc("jazzcash")) return "jazzcash.com.pk";
  if (inc("easypaisa", "easypaysa")) return "easypaisa.com.pk";
  if (inc("nayapay")) return "nayapay.com";
  if (inc("sadapay")) return "sadapay.pk";
  if (inc("meezan")) return "meezanbank.com";
  if (inc("alhabib") || word("bah")) return "bankalhabib.com";
  if (inc("habibmetro") || word("hmb")) return "hmb.com.pk";
  if (word("hbl") || inc("habibbank")) return "hbl.com";
  if (word("ubl") || inc("unitedbank")) return "ubl.com.pk";
  if (word("abl") || inc("alliedbank")) return "abl.com";
  if (word("mcb")) return "mcb.com.pk";
  if (inc("alfalah")) return "bankalfalah.com";
  if (inc("askari")) return "askaribank.com";
  if (inc("faysal")) return "faysalbank.com";
  if (inc("soneri")) return "soneribank.com";
  if (inc("standardchartered")) return "sc.com";
  if (inc("bankislami")) return "bankislami.com.pk";
  if (inc("dubaiislamic") || word("dib")) return "dibpak.com";
  if (inc("bankofpunjab") || word("bop")) return "bop.com.pk";
  if (inc("nationalbank") || word("nbp")) return "nbp.com.pk";
  if (inc("jsbank") || word("jsbl")) return "jsbl.com";
  if (inc("silkbank")) return "silkbank.com.pk";
  return null;
}

function BankLogo({ account, size = 46 }: { account: Account; size?: number }) {
  const domain = bankDomain(account.name);
  const logoUrl = account.logo_url?.trim();
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [domain, logoUrl]);
  if ((!logoUrl && !domain) || failed) return <BankWalletLogo account={account} />;
  return (
    <img
      src={logoUrl || `https://t1.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&url=${encodeURIComponent(`https://${domain}`)}&size=128`}
      alt={`${account.name} logo`}
      title={account.name}
      loading="lazy"
      decoding="async"
      width={size}
      height={size}
      style={{ width: size, height: size, objectFit: "contain" }}
      onError={() => setFailed(true)}
    />
  );
}

// Same card layout as the "Current Balance By Airline" cards on Airline Accounts.
function BankWalletAccountCards({
  accounts,
  transactions,
  activeId,
  onSelect,
  draggedId,
  onDragChange,
  onReorder,
}: {
  accounts: Account[];
  transactions: Txn[];
  activeId?: string;
  onSelect: (id: string) => void;
  draggedId: string | null;
  onDragChange: (id: string | null) => void;
  onReorder: (ids: string[]) => void;
}) {
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [localOrder, setLocalOrder] = useState<string[]>([]);
  useEffect(() => {
    setLocalOrder(accounts.map((account) => account.id));
  }, [accounts.map((account) => account.id).join("|")]);
  const orderedAccounts = useMemo(() => {
    const byId = new Map(accounts.map((account) => [account.id, account]));
    const ordered = localOrder.map((id) => byId.get(id)).filter((account): account is Account => Boolean(account));
    for (const account of accounts) if (!ordered.some((item) => item.id === account.id)) ordered.push(account);
    return ordered;
  }, [accounts, localOrder]);
  const dropAccount = (targetId: string) => {
    if (!draggedId || draggedId === targetId) { setDropTargetId(null); return; }
    const ids = orderedAccounts.map((account) => account.id);
    const from = ids.indexOf(draggedId);
    const to = ids.indexOf(targetId);
    if (from < 0 || to < 0) return;
    ids.splice(from, 1);
    ids.splice(to, 0, draggedId);
    setLocalOrder(ids);
    setDropTargetId(null);
    onDragChange(null);
    onReorder(ids);
  };
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 12, margin: "6px 0 18px" }}>
      {orderedAccounts.map((account) => {
        const rows = transactions.filter((t) => t.account_id === account.id);
        const balance = finalBalance(rows, account.opening_balance);
        const active = account.id === activeId;
        return (
          <button
            key={account.id}
            type="button"
            draggable
            className={`bank-account-card ${draggedId === account.id ? "is-dragging" : ""} ${dropTargetId === account.id ? "drop-target" : ""}`}
            onClick={() => { if (!draggedId) onSelect(account.id); }}
            onDragStart={(event) => {
              event.dataTransfer.effectAllowed = "move";
              event.dataTransfer.setData("text/plain", account.id);
              onDragChange(account.id);
            }}
            onDragOver={(event) => {
              event.preventDefault();
              event.dataTransfer.dropEffect = "move";
              if (draggedId && draggedId !== account.id) setDropTargetId(account.id);
            }}
            onDragLeave={() => setDropTargetId((current) => current === account.id ? null : current)}
            onDrop={(event) => { event.preventDefault(); dropAccount(account.id); }}
            onDragEnd={() => { onDragChange(null); setDropTargetId(null); }}
            title={`Drag to reorder • Open ${account.name} ledger`}
            style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: 0, textAlign: "center", background: "transparent", border: "none", padding: 0, cursor: draggedId === account.id ? "grabbing" : "grab", color: "var(--foreground)" }}
          >
            <div style={{
              width: "100%", background: "var(--card)", boxSizing: "border-box",
              border: `1px solid ${active ? "var(--accent)" : "var(--border)"}`,
              boxShadow: active ? "0 0 0 1px var(--accent), 0 6px 16px rgba(20,20,19,.10)" : "var(--shadow-sm)",
              borderRadius: 14, padding: "16px 14px 18px",
              display: "flex", flexDirection: "column", alignItems: "center",
              transition: "border-color .18s ease, box-shadow .18s ease",
            }}>
              <div style={{ width: "100%", height: 52, display: "flex", alignItems: "center", justifyContent: "center", padding: "2px 6px", boxSizing: "border-box" }}>
                <BankLogo account={account} />
              </div>
              <div style={{ width: "100%", height: 1, background: "var(--border)", margin: "12px 0 10px" }} />
              <div style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--muted-foreground)" }}>Current Balance</div>
                <div style={{ marginTop: 4, fontSize: 20, fontWeight: 800, lineHeight: 1.2, fontVariantNumeric: "tabular-nums", color: balance < 0 ? "var(--error)" : "var(--foreground)" }}>
                  {fmt(balance)} <span style={{ fontSize: 13, fontWeight: 700, color: "var(--accent)", marginLeft: 3 }}>PKR</span>
                </div>
              </div>
            </div>
            <div style={{ marginTop: 8, fontSize: 13, fontWeight: 700, maxWidth: "100%", padding: "0 4px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{account.name}</div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--muted-foreground)" }}>
              {account.kind === "wallet" ? "Wallet" : "Bank"} · Drag to move
            </div>
          </button>
        );
      })}
    </div>
  );
}

const byDate = (rows: Txn[]) => [...rows].sort((a, b) => (a.entry_date || "").localeCompare(b.entry_date || "") || a.id.localeCompare(b.id));
function withRunning(rows: Txn[], opening: number) {
  let bal = Number(opening) || 0;
  return byDate(rows).map((row) => {
    bal += row.direction === "in" ? Number(row.amount) : -Number(row.amount);
    return { ...row, balance: bal };
  });
}
const finalBalance = (rows: Txn[], opening: number) =>
  (Number(opening) || 0) + rows.reduce((total, row) => total + (row.direction === "in" ? Number(row.amount) : -Number(row.amount)), 0);

/* ============================= OPENING BALANCES & DRAG-AND-DROP ============================= */
function BankWalletOpeningRow({
  account, txns, onEdit, onRemove, isDragging, isOver, onDragStart, onDragOver, onDragLeave, onDrop, onDragEnd,
}: {
  account: Account; txns: Txn[]; onEdit: (account: Account) => void; onRemove: () => void;
  isDragging: boolean; isOver: boolean;
  onDragStart: (e: React.DragEvent) => void; onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void; onDrop: (e: React.DragEvent) => void; onDragEnd: (e: React.DragEvent) => void;
}) {
  const currentBalance = finalBalance(txns.filter((t) => t.account_id === account.id), account.opening_balance);
  return (
    <tr draggable onDragStart={onDragStart} onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop} onDragEnd={onDragEnd}
      style={{ opacity: isDragging ? 0.45 : 1, borderTop: isOver ? "2px solid var(--accent, #D97757)" : undefined,
        background: isOver ? "rgba(217, 119, 87, 0.08)" : undefined, transition: "background 0.15s ease" }}>
      <td style={{ width: 38, textAlign: "center", padding: "10px 4px 10px 12px", cursor: "grab", color: "var(--muted-foreground)" }} title="Drag to reorder account sequence"><GripVertical size={16} /></td>
      <td><div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><BankLogo account={account} size={34} /></div>
        <div><div style={{ fontWeight: 650, color: "var(--foreground)", fontSize: 13.5 }}>{account.name}</div></div>
      </div></td>
      <td><span style={{ textTransform: "uppercase", fontSize: 10.5, fontWeight: 700, letterSpacing: ".06em", padding: "3px 8px", borderRadius: 5,
        background: account.kind === "wallet" ? "rgba(217,119,87,.14)" : "rgba(0,0,0,0.06)",
        color: account.kind === "wallet" ? "var(--accent, #D97757)" : "var(--foreground)" }}>{account.kind}</span></td>
      <td className="num" style={{ fontWeight: 600 }}>{fmt(account.opening_balance)} PKR</td>
      <td>{formatDateShort(account.opening_balance_date || todayISO())}</td>
      <td className="num" style={{ fontWeight: 700, color: currentBalance < 0 ? "var(--error)" : "var(--foreground)" }}>{fmt(currentBalance)} PKR</td>
      <td><div style={{ display: "flex", justifyContent: "flex-end", gap: 7, flexWrap: "wrap" }}>
        <button type="button" className="btn small" onClick={() => onEdit(account)} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><Pencil size={12} /> Edit</button>
        <button type="button" className="icon-btn danger" onClick={onRemove} title={`Delete ${account.name}`} style={{ fontSize: 12 }}>Delete</button>
      </div></td>
    </tr>
  );
}

function BanksWalletsOpeningTable({
  banks,
  txns,
  onEditAccount,
  onReorder,
  onDeleteAccount,
}: {
  banks: Account[];
  txns: Txn[];
  onEditAccount: (account: Account) => void;
  onReorder: (ids: string[]) => void;
  onDeleteAccount: (account: Account) => void;
}) {
  const [localBanks, setLocalBanks] = useState<Account[]>(banks);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  useEffect(() => {
    setLocalBanks(banks);
  }, [banks]);

  const handleDrop = (targetId: string) => {
    if (!draggedId || draggedId === targetId) {
      setDragOverId(null);
      setDraggedId(null);
      return;
    }
    const currentIds = localBanks.map((b) => b.id);
    const from = currentIds.indexOf(draggedId);
    const to = currentIds.indexOf(targetId);
    if (from < 0 || to < 0) return;
    const nextList = [...localBanks];
    const [moved] = nextList.splice(from, 1);
    nextList.splice(to, 0, moved);
    setLocalBanks(nextList);
    setDragOverId(null);
    setDraggedId(null);
    onReorder(nextList.map((b) => b.id));
  };

  return (
    <table className="dashboard-table" style={{ marginTop: 8 }}>
      <thead>
        <tr>
          <th style={{ width: 38 }} title="Drag handle"></th>
          <th>Account</th>
          <th>Type</th>
          <th className="num">Opening Balance (PKR)</th>
          <th>Opening Date</th>
          <th className="num">Current Balance</th>
          <th style={{ textAlign: "right" }}>Actions</th>
        </tr>
      </thead>
      <tbody>
        {localBanks.map((account) => (
          <BankWalletOpeningRow
            key={account.id}
            account={account}
            txns={txns}
            onEdit={onEditAccount}
            onRemove={() => onDeleteAccount(account)}
            isDragging={draggedId === account.id}
            isOver={dragOverId === account.id && draggedId !== account.id}
            onDragStart={(e) => {
              setDraggedId(account.id);
              e.dataTransfer.effectAllowed = "move";
              e.dataTransfer.setData("text/plain", account.id);
            }}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              if (draggedId !== account.id) setDragOverId(account.id);
            }}
            onDragLeave={() => setDragOverId((cur) => (cur === account.id ? null : cur))}
            onDrop={(e) => {
              e.preventDefault();
              handleDrop(account.id);
            }}
            onDragEnd={() => {
              setDraggedId(null);
              setDragOverId(null);
            }}
          />
        ))}
        {localBanks.length === 0 && (
          <tr className="empty-row">
            <td colSpan={7}>No bank or wallet accounts configured yet. Click &ldquo;+ Add Account&rdquo; above.</td>
          </tr>
        )}
      </tbody>
    </table>
  );
}

function CashOpeningRow({
  cash,
  onSave,
}: {
  cash: Account;
  onSave: (id: string, opening: number, date: string) => Promise<void>;
}) {
  const [opening, setOpening] = useState(String(cash.opening_balance ?? 0));
  const [openingDate, setOpeningDate] = useState(cash.opening_balance_date ?? todayISO());
  const [isSaving, setIsSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(() => {
    setOpening(String(cash.opening_balance ?? 0));
    setOpeningDate(cash.opening_balance_date ?? todayISO());
  }, [cash.opening_balance, cash.opening_balance_date]);

  const numOpening = Number(opening) || 0;
  const isDirty = numOpening !== Number(cash.opening_balance ?? 0) || openingDate !== (cash.opening_balance_date ?? todayISO());

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(cash.id, numOpening, openingDate);
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 2400);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <tr>
      <td style={{ fontWeight: 650 }}>{cash.name}</td>
      <td className="num">
        <input
          className="opening-input"
          type="number"
          value={opening}
          onChange={(e) => setOpening(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") void handleSave(); }}
          style={{ borderColor: isDirty ? "var(--accent, #D97757)" : undefined, fontWeight: 650 }}
        />
      </td>
      <td>
        <input
          className="opening-input"
          type="date"
          value={openingDate}
          onChange={(e) => setOpeningDate(e.target.value)}
          style={{ borderColor: isDirty ? "var(--accent, #D97757)" : undefined }}
        />
      </td>
      <td>
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button
            type="button"
            className={`btn small ${savedFlash ? "success" : isDirty ? "primary" : "ghost"}`}
            onClick={handleSave}
            disabled={isSaving}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              padding: "6px 12px",
              minWidth: 80,
              fontSize: 12,
              fontWeight: 650,
              background: savedFlash ? "#2b8a3e" : isDirty ? "var(--accent, #D97757)" : undefined,
              color: savedFlash || isDirty ? "#FAF9F5" : undefined,
              borderColor: savedFlash ? "#2b8a3e" : isDirty ? "var(--accent, #D97757)" : undefined,
              transition: "all 0.18s ease",
            }}
            title={isDirty ? "Save changes to Supabase & sync to Google Sheets" : "Cash opening balance is saved"}
          >
            {isSaving ? (
              <>
                <RefreshCw size={12} className="animate-spin" />
                <span>Saving…</span>
              </>
            ) : savedFlash ? (
              <>
                <Check size={12} />
                <span>Saved!</span>
              </>
            ) : (
              <>
                <Save size={12} />
                <span>Save</span>
              </>
            )}
          </button>
        </div>
      </td>
    </tr>
  );
}


/* ============================= STYLE (warm charcoal/terracotta palette, matches site design system) ============================= */
const STYLE = `
.rohi-ab{--ink:var(--foreground);--ink-2:var(--background);--paper:var(--card);--line:var(--border);--brass:var(--accent-ink);--brass-dark:var(--accent-ink);--teal:var(--success);--teal-dark:var(--success);--crimson:var(--error);--crimson-dark:var(--error);--ink-soft:var(--muted-foreground);--cream:var(--foreground);--cream-dim:var(--muted-foreground);--shadow:var(--shadow-md);--radius:12px;--ease:cubic-bezier(0.16,1,0.3,1);
font-family:var(--font-sans);background:var(--background);color:var(--foreground);min-height:100vh;width:100%;}
.rohi-ab h2,.rohi-ab h3{font-family:var(--font-sans);}
.rohi-ab .mono{font-variant-numeric:tabular-nums;font-variant-numeric:tabular-nums;}
.rohi-ab .shell{display:flex;min-height:100vh;}
.rohi-ab .side{width:230px;flex:0 0 230px;background:var(--card);position:relative;display:flex;flex-direction:column;border-right:1px solid var(--border);}
.rohi-ab .side::before{content:"";position:absolute;left:14px;top:0;bottom:0;border-left:2px dashed var(--border);}
.rohi-ab .brand{padding:26px 22px 18px 30px;}
.rohi-ab .brand .eyebrow{font-size:10.5px;letter-spacing:.18em;text-transform:uppercase;color:var(--brass);font-weight:600;}
.rohi-ab .brand h1{font-family:var(--font-sans);font-size:20px;line-height:1.25;margin:6px 0 0;font-weight:600;color:var(--cream);}
.rohi-ab .tabs{display:flex;flex-direction:column;margin-top:6px;padding-left:6px;}
.rohi-ab .tab-btn{all:unset;cursor:pointer;padding:12px 22px 12px 30px;font-size:14.5px;font-weight:500;color:var(--cream-dim);border-left:3px solid transparent;display:flex;align-items:center;gap:10px;transition:color .22s var(--ease),background-color .22s var(--ease),border-color .22s var(--ease);}
.rohi-ab .tab-btn .num{font-variant-numeric:tabular-nums;font-size:11px;color:var(--muted-foreground);width:16px;}
.rohi-ab .tab-btn:hover{color:var(--cream);background:var(--muted);}
.rohi-ab .tab-btn.active{color:var(--cream);border-left-color:var(--brass);background:var(--bg-accent-tint);}
.rohi-ab .tab-btn.active .num{color:var(--brass);}
.rohi-ab .tab-group + .tab-group{margin-top:8px;padding-top:12px;border-top:1px solid var(--border);}
.rohi-ab .tab-group-label{padding:0 22px 6px 30px;font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--muted-foreground);font-weight:600;}
.rohi-ab .tab-group-toggle{all:unset;box-sizing:border-box;width:100%;display:flex;align-items:center;justify-content:space-between;gap:8px;text-align:left;cursor:pointer;padding:7px 16px 7px 30px;border-radius:7px;transition:color .18s ease,background .18s ease;}
.rohi-ab .tab-group-toggle:hover,.rohi-ab .tab-group-toggle.active-group{color:var(--foreground);background:var(--muted);}
.rohi-ab .group-chevron{transition:transform .18s ease;flex:0 0 auto;}
.rohi-ab .group-chevron.collapsed{transform:rotate(-90deg);}
.rohi-ab .tab-group.contains-active .tab-group-toggle.active-group{color:var(--accent-ink);}
.rohi-ab .bank-account-card[draggable="true"]{cursor:grab;touch-action:pan-y;}
.rohi-ab .bank-account-card.is-dragging{opacity:.45;transform:scale(.98);}
.rohi-ab .bank-account-card.drop-target{outline:2px dashed var(--accent);outline-offset:2px;}

.rohi-ab .side-foot{margin-top:auto;padding:18px 22px 22px 30px;font-size:11px;color:var(--muted-foreground);line-height:1.6;}
.rohi-ab .save-dot{display:inline-block;width:6px;height:6px;border-radius:50%;background:var(--teal);margin-right:6px;vertical-align:middle;}
.rohi-ab .main{flex:1;min-width:0;width:100%;padding:30px clamp(18px,3vw,48px) 60px;max-width:none;background:var(--background);}
.rohi-ab .page-head{display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:22px;flex-wrap:wrap;gap:12px;}
.rohi-ab .page-head h2{font-size:26px;margin:0;color:var(--cream);font-weight:600;}
.rohi-ab .page-head p{margin:4px 0 0;color:var(--cream-dim);font-size:13px;}
.rohi-ab .btn{all:unset;cursor:pointer;font-weight:600;font-size:13px;padding:10px 16px;border-radius:8px;background:var(--brass);color:var(--ink);text-align:center;transition:background-color .22s var(--ease),transform .14s var(--ease);}
.rohi-ab .btn:hover{background:var(--brass-dark);}
.rohi-ab .btn:active{transform:scale(0.98);}
.rohi-ab .btn.ghost{background:transparent;border:1px solid var(--border);color:var(--cream);}
.rohi-ab .btn.ghost:hover{background:var(--border);}
.rohi-ab .btn.small{padding:7px 11px;font-size:12px;}
.rohi-ab .modal .btn.ghost{color:var(--ink);border-color:var(--line);}
.rohi-ab .ledger{background:var(--paper);color:var(--ink);border-radius:var(--radius);box-shadow:var(--shadow);position:relative;overflow:hidden;margin-bottom:22px;}
.rohi-ab .ledger::before{content:"";position:absolute;top:0;bottom:0;left:52px;width:1px;background:var(--border);}
.rohi-ab .ledger-inner{padding:20px 24px 22px 68px;}
.rohi-ab .ledger h3{font-size:15px;margin:0 0 14px;color:var(--ink);font-weight:600;}
.rohi-ab .ledger h3 .sub{font-weight:400;color:var(--ink-soft);font-size:12.5px;margin-left:8px;}
.rohi-ab .cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:14px;margin-bottom:22px;}
.rohi-ab .card{background:var(--paper);color:var(--ink);border-radius:var(--radius);padding:16px 18px;box-shadow:var(--shadow);transition:transform .22s var(--ease),box-shadow .22s var(--ease);}
.rohi-ab .card:hover{transform:translateY(-2px);box-shadow:0 14px 32px rgba(20,20,19,.12);}
.rohi-ab .card .label{font-size:11px;text-transform:uppercase;letter-spacing:.09em;color:var(--ink-soft);font-weight:600;}
.rohi-ab .card .value{font-variant-numeric:tabular-nums;font-size:23px;font-weight:600;margin-top:6px;}
.rohi-ab .card .value.pos{color:var(--teal-dark);}
.rohi-ab .card .value.neg{color:var(--crimson-dark);}
.rohi-ab .card .foot{font-size:11.5px;color:var(--ink-soft);margin-top:4px;}
.rohi-ab table{width:100%;border-collapse:collapse;font-size:13px;}
.rohi-ab thead th{text-align:left;font-size:10.5px;text-transform:uppercase;letter-spacing:.07em;color:var(--ink-soft);padding:6px 10px;border-bottom:1.5px solid var(--line);font-weight:600;white-space:nowrap;}
.rohi-ab tbody td{padding:8px 10px;border-bottom:1px solid var(--line);vertical-align:top;}
.rohi-ab tbody tr{transition:background-color .18s var(--ease);}
.rohi-ab tbody tr:hover{background:var(--bg-accent-tint);}
.rohi-ab td.num,.rohi-ab th.num{text-align:right;font-variant-numeric:tabular-nums;}
.rohi-ab .in-amt{color:var(--teal-dark);font-variant-numeric:tabular-nums;}
.rohi-ab .out-amt{color:var(--crimson-dark);font-variant-numeric:tabular-nums;}
.rohi-ab .badge{font-size:10px;font-weight:600;padding:2px 7px;border-radius:20px;text-transform:uppercase;letter-spacing:.04em;display:inline-block;}
.rohi-ab .badge.link{background:var(--success-soft);color:var(--teal-dark);}
.rohi-ab .badge.manual{background:var(--muted);color:var(--ink-soft);}
.rohi-ab .icon-btn{all:unset;cursor:pointer;color:var(--ink-soft);font-size:12px;padding:3px 7px;border-radius:6px;transition:background-color .18s var(--ease),color .18s var(--ease);}
.rohi-ab .dashboard-actions{display:flex;align-items:center;justify-content:flex-end;gap:3px;white-space:nowrap;}
.rohi-ab .dashboard-actions .icon-btn{padding:4px 6px;font-size:11px;line-height:1.2;}
.rohi-ab .dashboard-actions .icon-btn:hover{background:var(--muted);color:var(--ink);}
.rohi-ab .dashboard-actions .icon-btn.danger:hover{background:var(--error-soft);color:var(--crimson-dark);}
.rohi-ab .dashboard-table th,.rohi-ab .dashboard-table td{padding-left:8px;padding-right:8px;}
.rohi-ab .dashboard-table td.description-cell{max-width:360px;}
.rohi-ab .dashboard-table td.description-cell>div:first-child{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.rohi-ab .dashboard-table td.actions-cell{width:1%;white-space:nowrap;}
.rohi-ab .icon-btn:hover{background:var(--error-soft);color:var(--crimson-dark);}
.rohi-ab .empty-row td{text-align:center;color:var(--ink-soft);font-style:italic;padding:20px;}
.rohi-ab .pillbar{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px;align-items:center;}
.rohi-ab .pill{all:unset;cursor:pointer;font-size:12.5px;font-weight:600;padding:7px 14px;border-radius:20px;background:var(--ink-2);color:var(--cream-dim);border:1px solid var(--border);transition:background-color .2s var(--ease),color .2s var(--ease),border-color .2s var(--ease);}
.rohi-ab .pill.active{background:var(--brass);color:var(--ink);border-color:var(--brass);}
.rohi-ab .pill.add{background:transparent;border:1px dashed var(--border);color:var(--cream-dim);}
.rohi-ab .pill[draggable="true"]{cursor:grab;}
.rohi-ab .pill.dragging{opacity:.4;}
.rohi-ab .ledger .pill{background:var(--muted);color:var(--ink);border-color:var(--line);}
.rohi-ab .overlay{position:fixed;inset:0;background:rgba(20,20,19,.45);display:flex;align-items:center;justify-content:center;z-index:60;padding:20px;animation:rohiAbFadeIn .18s var(--ease);}
.rohi-ab .modal{background:var(--paper);color:var(--ink);width:100%;max-width:460px;border-radius:16px;padding:24px 26px 22px;box-shadow:0 24px 60px rgba(20,20,19,.18);max-height:88vh;overflow:auto;animation:rohiAbScaleIn .22s var(--ease);}
.rohi-ab .modal-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:4px;}
.rohi-ab .modal-head h3{margin:0;}
.rohi-ab .modal-close{all:unset;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;border:1px solid var(--line);border-radius:8px;color:var(--ink-soft);background:var(--card);}
.rohi-ab .modal-close:hover{background:var(--muted);color:var(--ink);}
@keyframes rohiAbFadeIn{from{opacity:0}to{opacity:1}}
@keyframes rohiAbScaleIn{from{opacity:0;transform:scale(.97)}to{opacity:1;transform:scale(1)}}
.rohi-ab .modal h3{margin:0 0 4px;font-size:18px;}
.rohi-ab .modal-sub{font-size:12.5px;color:var(--ink-soft);margin-bottom:16px;}
.rohi-ab .field{margin-bottom:13px;}
.rohi-ab .field label{display:block;font-size:11.5px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:var(--ink-soft);margin-bottom:5px;}
.rohi-ab .field input,.rohi-ab .field select{width:100%;padding:9px 10px;border:1px solid var(--line);border-radius:8px;background:var(--card);font-family:var(--font-sans);font-size:13.5px;color:var(--ink);transition:border-color .18s var(--ease),box-shadow .18s var(--ease);}
.rohi-ab .field input:focus,.rohi-ab .field select:focus{outline:none;border-color:var(--brass);box-shadow:0 0 0 3px var(--accent-subtle);}
.rohi-ab .field-row{display:grid;grid-template-columns:1fr 1fr;gap:10px;}
.rohi-ab .modal-actions{display:flex;justify-content:flex-end;gap:10px;margin-top:18px;}
.rohi-ab .hint{font-size:11.5px;color:var(--ink-soft);margin-top:3px;}
.rohi-ab .txseg{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px;padding:4px;margin-bottom:12px;border:1px solid var(--line);border-radius:10px;background:var(--muted);}
.rohi-ab .txseg button{padding:9px 6px;border-radius:7px;border:1px solid transparent;background:transparent;color:var(--ink-soft);font-size:12.5px;font-weight:600;cursor:pointer;white-space:nowrap;}
.rohi-ab .txseg button.on{background:var(--foreground);color:var(--background);box-shadow:0 1px 3px rgba(0,0,0,.18);}
.rohi-ab .posting{margin-top:12px;border:1px dashed var(--line);border-radius:10px;padding:10px 12px;background:var(--muted);}
.rohi-ab .posting h4{margin:0 0 6px;font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--ink-soft);}
.rohi-ab .posting .leg{display:flex;justify-content:space-between;gap:10px;font-size:12.5px;padding:3px 0;}
.rohi-ab .posting .leg b{font-weight:700;}
.rohi-ab .posting .leg span{color:var(--ink-soft);text-align:right;}
.rohi-ab .divider{border:none;border-top:1px solid var(--line);margin:16px 0;}
.rohi-ab .month-strong td{font-weight:600;background:var(--bg-accent-tint);}
.rohi-ab .opening-input{width:130px;text-align:right;border:1px solid var(--line);border-radius:6px;padding:5px;font-variant-numeric:tabular-nums;}
.rohi-ab .cashbook-head{display:flex;justify-content:space-between;align-items:flex-end;gap:12px;flex-wrap:wrap;margin-bottom:18px;}
.rohi-ab .cashbook-head h2{font-size:28px;margin:0;font-weight:700;}
.rohi-ab .cashbook-head p{margin:5px 0 0;color:var(--ink-soft);font-size:13px;}
.rohi-ab .cashbook-tools{display:flex;gap:8px;align-items:center;flex-wrap:wrap;}
.rohi-ab .cashbook-tools .field{margin:0;width:auto;}
.rohi-ab .cashbook-summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;margin-bottom:22px;}
.rohi-ab .cashbook-panel{background:var(--paper);color:var(--ink);border-radius:var(--radius);box-shadow:var(--shadow);padding:20px 22px;margin-bottom:22px;}
.rohi-ab .cashbook-panel h3{font-size:15px;margin:0 0 3px;font-weight:600;}
.rohi-ab .cashbook-panel .sub{font-size:12px;color:var(--ink-soft);}
.rohi-ab .cashbook-table-wrap{overflow-x:auto;border:1px solid var(--line);border-radius:10px;}
.rohi-ab .cashbook-table{min-width:760px;}
.rohi-ab .cashbook-days{display:flex;flex-wrap:wrap;gap:7px;}
.rohi-ab .cashbook-day{width:40px;height:38px;border:1px solid var(--line);border-radius:8px;background:var(--card);color:var(--ink);cursor:pointer;font-size:12px;}
.rohi-ab .cashbook-day.active{background:var(--ink);color:var(--ink-2);border-color:var(--ink);}
.rohi-ab .cashbook-day.has-data{background:var(--bg-accent-tint);}
.rohi-ab .cashbook-chart{display:flex;height:220px;align-items:flex-end;gap:3px;border-bottom:1px solid var(--line);padding-top:8px;}
.rohi-ab .cashbook-bar{height:100%;flex:1;display:flex;align-items:flex-end;justify-content:center;gap:1px;cursor:pointer;min-width:4px;}
.rohi-ab .cashbook-bar span{width:48%;min-height:0;border-radius:4px 4px 0 0;background:var(--success);}
.rohi-ab .cashbook-bar span:last-child{background:var(--brass);}
.rohi-ab .cashbook-two-col{display:grid;grid-template-columns:1.7fr 1fr;gap:14px;}
.rohi-ab .cashbook-denoms{display:grid;grid-template-columns:1fr 1fr;gap:8px;}
.rohi-ab .cashbook-denom{display:flex;align-items:center;justify-content:space-between;border:1px solid var(--line);border-radius:8px;padding:8px 10px;font-size:12px;}
.rohi-ab .cashbook-denom input{width:64px;text-align:center;border:1px solid var(--line);border-radius:6px;padding:4px;background:var(--card);color:var(--ink);}
.rohi-ab .cashbook-cash-total{grid-column:1/-1;background:var(--ink);color:var(--ink-2);border-radius:8px;padding:10px 12px;display:flex;justify-content:space-between;font-weight:700;}
@media(max-width:900px){.rohi-ab .cashbook-summary{grid-template-columns:repeat(2,minmax(0,1fr));}.rohi-ab .cashbook-two-col{grid-template-columns:1fr;}}
@media(max-width:560px){.rohi-ab .cashbook-summary{grid-template-columns:1fr;}}
@media (prefers-reduced-motion: reduce){
.rohi-ab *{animation-duration:.01ms !important;transition-duration:.01ms !important;}
}
@media (max-width:880px){
.rohi-ab .side{position:fixed;inset:0 auto 0 0;z-index:70;width:min(88vw,300px);transform:translateX(-100%);transition:transform .25s var(--ease);box-shadow:var(--shadow);}
.rohi-ab .side.mobile-open{transform:translateX(0);}
.rohi-ab .brand h1,.rohi-ab .tab-btn .label,.rohi-ab .side-foot,.rohi-ab .tab-group-label{display:block;}
.rohi-ab .main{padding:22px 16px 50px;}
.rohi-ab .ledger-inner{padding:18px 16px 20px 40px;}
.rohi-ab .ledger::before{left:26px;}
.rohi-ab .field-row{grid-template-columns:1fr;}
.rohi-ab .mobile-ledger-menu{display:inline-flex;}
}

.rohi-ab .settings-tabs{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 18px;padding-bottom:14px;border-bottom:2px solid var(--border);}
.rohi-ab .settings-tab{all:unset;cursor:pointer;padding:9px 14px;border:1px solid var(--border);border-radius:8px;background:var(--card);color:var(--muted-foreground);font-size:13px;font-weight:600;transition:background-color .18s var(--ease),color .18s var(--ease),border-color .18s var(--ease);}
.rohi-ab .settings-tab:hover{background:var(--muted);color:var(--foreground);}
.rohi-ab .settings-tab.active{background:var(--accent);border-color:var(--accent);color:var(--accent-foreground);}
.rohi-ab .settings-section{margin-top:0;padding-top:18px;border-top:0;}\n.rohi-ab .reconcile-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-width:188px;position:relative;overflow:hidden;}\n.rohi-ab .reconcile-btn:disabled{cursor:not-allowed;opacity:1;background:var(--muted);color:var(--muted-foreground);border-color:var(--border);box-shadow:none;}\n.rohi-ab .reconcile-btn.is-running{background:var(--ink);color:var(--ink-2);box-shadow:0 8px 22px rgba(20,20,19,.16);}\n.rohi-ab .reconcile-btn .reconcile-icon{flex:0 0 auto;}\n.rohi-ab .reconcile-btn .reconcile-icon.spin{animation:rohiReconcileSpin 1s linear infinite;}\n.rohi-ab .reconcile-btn.is-running::after{content:"";position:absolute;left:-35%;top:0;width:35%;height:100%;background:linear-gradient(90deg,transparent,rgba(255,255,255,.16),transparent);animation:rohiReconcileSweep 1.5s ease-in-out infinite;}\n.rohi-ab .reconcile-status{margin-top:8px;font-size:11.5px;color:var(--muted-foreground);display:flex;align-items:center;gap:6px;}\n.rohi-ab .reconcile-status .status-dot{width:7px;height:7px;border-radius:50%;background:var(--success);animation:rohiReconcilePulse 1.2s ease-in-out infinite;}\n@keyframes rohiReconcileSpin{to{transform:rotate(360deg)}}\n@keyframes rohiReconcileSweep{0%{left:-35%}100%{left:110%}}\n@keyframes rohiReconcilePulse{0%,100%{transform:scale(.8);opacity:.55}50%{transform:scale(1.15);opacity:1}}\n
.rohi-ab .settings-section-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px;}
.rohi-ab .settings-section-head h3{margin:0;font-size:17px;color:var(--cream);font-weight:650;}
.rohi-ab .settings-note{font-size:12px;color:var(--muted-foreground);}
.rohi-ab .protected-delete-backdrop{position:fixed;inset:0;z-index:100;background:rgba(20,20,19,.55);display:flex;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(6px);}
.rohi-ab .protected-delete-dialog{width:min(420px,100%);background:var(--card);color:var(--foreground);border:1px solid var(--border);border-radius:14px;padding:22px;box-shadow:var(--shadow);}
.rohi-ab .protected-delete-dialog h3{margin:0 0 7px;font-size:18px;}
.rohi-ab .protected-delete-dialog p{margin:0 0 14px;color:var(--muted-foreground);font-size:13px;line-height:1.5;}
.rohi-ab .protected-delete-dialog input{width:100%;box-sizing:border-box;border:1px solid var(--border);background:var(--background);color:var(--foreground);border-radius:8px;padding:10px 12px;outline:none;}
.rohi-ab .protected-delete-error{color:var(--error)!important;margin-top:8px!important;}
.rohi-ab .protected-delete-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:16px;}

.rohi-ab .mobile-ledger-menu{display:none;align-items:center;justify-content:center;min-height:44px;gap:8px;margin-bottom:14px;}
.rohi-ab .mobile-ledger-backdrop{position:fixed;inset:0;z-index:65;background:rgba(20,20,19,.45);backdrop-filter:blur(8px);}
`;

type ModalKind = "quickadd" | "cashEntry" | "bankEntry" | "salesEntry" | "expenseEntry" | "transferEntry" | "editTransaction" | "addBank" | "addSalesCat" | "addExpenseCat" | null;

function ProtectedDeleteDialog({ guard, close, onDelete }: { guard: { kind: "account" | "category"; id: string; label: string }; close: () => void; onDelete: (password: string) => Promise<void> }) {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const verify = useServerFn(verifyAdminPassword);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setError(""); setBusy(true);
    try {
      const result = await verify({ data: { password } });
      if (!result.ok) { setError("Incorrect admin password."); return; }
      await onDelete(password);
    } catch (e) { setError(e instanceof Error ? e.message : "Delete failed."); }
    finally { setBusy(false); }
  };
  return <div className="protected-delete-backdrop">
    <form className="protected-delete-dialog" onSubmit={submit}>
      <h3>Admin Password Required</h3>
      <p>{guard.kind === "account"
        ? <>Removing <strong>{guard.label}</strong> is protected. Accounts with ledger entries are archived — <strong>their transactions and transfer history are never deleted.</strong></>
        : <>Deleting <strong>{guard.label}</strong> is a protected action. Enter the admin password to continue.</>}</p>
      <input autoFocus type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Admin password" />
      {error && <p className="protected-delete-error">{error}</p>}
      <div className="protected-delete-actions"><button type="button" className="btn small ghost" onClick={close}>Cancel</button><button type="submit" className="btn small" disabled={busy || !password}>{busy ? "Checking…" : guard.kind === "account" ? "Remove / Archive" : "Delete"}</button></div>
    </form>
  </div>;
}

export function AccountsBookClone({ initialTab = "dashboard" }: { initialTab?: TabId } = {}) {
  const router = useRouter();
  const logoutFn = useServerFn(adminLogout);
  async function onLogout() {
    await logoutFn();
    router.navigate({ to: "/admin" });
  }
  const queryClient = useQueryClient();
  const load = useServerFn(listAccountsBook);
  const addAccountFn = useServerFn(createAccountsBookAccount);
  const updateAccountFn = useServerFn(updateAccountsBookAccount);
  const syncAccountSettingsFn = useServerFn(syncAccountsBookAccountSettingsToSheets);
  const openingFn = useServerFn(updateAccountsBookOpening);
  const txnFn = useServerFn(createAccountsBookTransaction);
  const updateTxnFn = useServerFn(updateAccountsBookTransaction);
  const linkedFn = useServerFn(createAccountsBookLinkedEntry);
  const transferFn = useServerFn(createAccountsBookTransfer);
  const groupFn = useServerFn(createAccountsBookGroupTransaction);
  const deleteTxnFn = useServerFn(deleteAccountsBookTransaction);
  const reconcileBanksWalletsFn = useServerFn(reconcileBanksWalletsToSheets);
  const deleteAccountFn = useServerFn(deleteAccountsBookAccount);
  const addServiceFn = useServerFn(createAccountsBookService);
  const deleteServiceFn = useServerFn(deleteAccountsBookService);
  const reorderAccountsFn = useServerFn(reorderAccountsBookAccounts);
  const reorderServicesFn = useServerFn(reorderAccountsBookServices);

  const { data, isLoading, error, isFetching } = useQuery({ queryKey: ["accounts-book"], queryFn: () => load(), refetchInterval: 30000 });
  const [tab, setTab] = useState<TabId>("dashboard");
  const [modal, setModal] = useState<ModalKind>(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [draggedAccountId, setDraggedAccountId] = useState<string | null>(null);

  // Auto-sync Google Sheets on page load, matching Airline Accounts
  useEffect(() => {
    void reconcileBanksWalletsFn({ data: {} }).catch((error) => {
      console.warn("Banks & Wallets Google Sheet background auto-sync:", error);
    });
  }, []);
  const [bankSel, setBankSel] = useState<string | null>(null);
  const [salesSel, setSalesSel] = useState<string | null>(null);
  const [expSel, setExpSel] = useState<string | null>(null);
  const [settingsTab, setSettingsTab] = useState<"banks" | "cashbook" | "sales" | "expenses">("banks");
  const [deleteGuard, setDeleteGuard] = useState<{ kind: "account" | "category"; id: string; label: string } | null>(null);
  const [editingTxn, setEditingTxn] = useState<Txn | null>(null);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [isReconcilingBanksWallets, setIsReconcilingBanksWallets] = useState(false);
  const [isReconcilingCashBook, setIsReconcilingCashBook] = useState(false);
  const [isReconcilingExpenses, setIsReconcilingExpenses] = useState(false);

  const accounts = (data?.accounts ?? []) as Account[];
  const txns = (data?.transactions ?? []) as Txn[];
  const services = (data?.services ?? []) as Service[];

  const cash = accounts.find((a) => a.kind === "cash");
  const banks = accounts.filter((a) => a.kind !== "cash");
  const salesCats = useMemo(() => {
    const stored = services.filter((s) => !s.name.startsWith(EXPENSE_PREFIX)).map((s) => s.name);
    return stored.length ? stored : DEFAULT_SALES_CATS;
  }, [services]);
  const expenseCats = useMemo(() => {
    const stored = services.filter((s) => s.name.startsWith(EXPENSE_PREFIX)).map((s) => s.name.slice(EXPENSE_PREFIX.length));
    return stored.length ? stored : DEFAULT_EXPENSE_CATS;
  }, [services]);
  // Id-bearing versions of the two category lists above, used only for
  // drag-to-reorder (a plain default-category name has no row to persist
  // against yet, so those aren't draggable until a real one is added).
  const salesCatRows = useMemo(() => {
    const stored = services.filter((s) => !s.name.startsWith(EXPENSE_PREFIX));
    return stored.length ? stored.map((s) => ({ id: s.id, name: s.name })) : DEFAULT_SALES_CATS.map((name) => ({ id: null as string | null, name }));
  }, [services]);
  const expenseCatRows = useMemo(() => {
    const stored = services.filter((s) => s.name.startsWith(EXPENSE_PREFIX));
    return stored.length
      ? stored.map((s) => ({ id: s.id, name: s.name.slice(EXPENSE_PREFIX.length) }))
      : DEFAULT_EXPENSE_CATS.map((name) => ({ id: null as string | null, name }));
  }, [services]);

  const activeBank = banks.find((b) => b.id === bankSel) ?? banks[0] ?? null;
  const exportBankStatementCSV = () => {
    if (!activeBank) return;
    const accountRows = byDate(txns.filter((row) => row.account_id === activeBank.id));
    const opening = Number(activeBank.opening_balance) || 0;
    const rows: (string | number)[][] = [
      ["ROHI INTERNATIONAL TRAVELS"],
      ["Sardar Market, Shahi Road, Rahim Yar Khan  •  0305-6622988"],
      [activeBank.name + " Statement"],
      ["Current Balance", finalBalance(accountRows, opening), "PKR", "Transactions", accountRows.length],
      [],
      ["Date", "Description", "Debit", "Credit", "Balance"],
      [formatDateShort(activeBank.opening_balance_date || todayISO()), "Opening Balance", opening > 0 ? opening : "", opening < 0 ? Math.abs(opening) : "", opening],
      ...withRunning(accountRows, opening).map((row) => [
        formatDateShort(row.entry_date),
        [row.category ? "[" + row.category + "]" : "", row.description || "", row.party ? "(" + row.party + ")" : ""].filter(Boolean).join(" "),
        row.direction === "out" ? Number(row.amount) : "",
        row.direction === "in" ? Number(row.amount) : "",
        row.balance,
      ]),
    ];
    const csv = rows.map((row) => row.map((cell) => {
      const value = String(cell ?? "");
      return /[",\r\n]/.test(value) ? '"' + value.replace(/"/g, '""') + '"' : value;
    }).join(",")).join("\r\n");
    const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "Rohi-" + activeBank.name.replace(/[^a-z0-9-]+/gi, "-") + "-Statement.csv";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const exportBankStatement = (format: "excel" | "pdf") => {
    if (!activeBank) return;
    const accountRows = byDate(txns.filter((row) => row.account_id === activeBank.id));
    const opening = Number(activeBank.opening_balance) || 0;
    const statementRows: (string | number)[][] = [
      [
        formatDateShort(activeBank.opening_balance_date || todayISO()),
        "Opening Balance",
        opening > 0 ? opening : "",
        opening < 0 ? Math.abs(opening) : "",
        opening,
      ],
      ...withRunning(accountRows, opening).map((row) => [
        formatDateShort(row.entry_date),
        [row.category ? `[${row.category}]` : "", row.description || "", row.party ? `(${row.party})` : ""].filter(Boolean).join(" "),
        row.direction === "out" ? Number(row.amount) : "",
        row.direction === "in" ? Number(row.amount) : "",
        row.balance,
      ]),
    ];
    const payload = {
      title: `${activeBank.name} Statement`,
      headers: ["Date", "Description", "Debit", "Credit", "Balance"],
      rows: statementRows,
      subtitle: `Current Balance: ${fmt(finalBalance(accountRows, opening))} PKR • ${accountRows.length} transactions`,
      numericColumns: [2, 3, 4],
      orientation: "landscape" as const,
      fileName: `Rohi-${activeBank.name}-Statement`,
    };
    if (format === "excel") void downloadExcel(payload);
    else void downloadPdf(payload);
  };
  const activeSalesCat = salesCats.includes(salesSel ?? "") ? (salesSel as string) : salesCats[0] ?? null;
  const activeExpCat = expenseCats.includes(expSel ?? "") ? (expSel as string) : expenseCats[0] ?? null;

  const refresh = () => {
    // Immediately reload the authoritative Supabase snapshot after create/edit/delete.
    // Invalidation alone can leave the current screen showing stale cached rows until a later navigation/refresh.
    void queryClient.invalidateQueries({ queryKey: ["accounts-book"], exact: true });
    void queryClient.refetchQueries({ queryKey: ["accounts-book"], exact: true, type: "active" });
  };

  const fail = (e: unknown) => toast.error(e instanceof Error ? e.message : "Something went wrong");
  const mutate = <T,>(fn: (payload: T) => Promise<unknown>, message: string, _unused?: unknown, afterSuccess?: () => void) =>
    useMutationFactory(fn, message, refresh, fail, afterSuccess);

  // Settings saves are instant (database only); this refreshes the Google Sheets right after,
  // in its own request, with a small progress toast instead of freezing the Save button.
  const syncSheetsInBackground = () => {
    const toastId = toast.loading("Updating Google Sheets…");
    void syncAccountSettingsFn({ data: {} })
      .then((result) => {
        if (result.status === "success") toast.success("Google Sheets updated" + (result.sheets ? ": " + result.sheets : ""), { id: toastId });
        else toast.warning("Saved. Google Sheets sync needs attention — " + (result.failures?.filter(Boolean).join(" | ") || "try Reconcile"), { id: toastId });
      })
      .catch((e) => toast.error("Saved, but Google Sheets sync failed: " + (e instanceof Error ? e.message : String(e)), { id: toastId }));
  };
  // Show the new logo / balance / name in the UI immediately, before the server even answers.
  const patchAccountInCache = (id: string, patch: Partial<Account>) =>
    queryClient.setQueryData(["accounts-book"], (old: any) => (old ? { ...old, accounts: old.accounts.map((a: Account) => (a.id === id ? { ...a, ...patch } : a)) } : old));

  const saveOpening = mutate((payload: { id: string; opening_balance: number; opening_balance_date: string }) => openingFn({ data: payload }), "Opening balance saved", undefined, syncSheetsInBackground);
  const reconcileBanksWallets = () => {
    if (isReconcilingBanksWallets) return;
    setIsReconcilingBanksWallets(true);
    void reconcileBanksWalletsFn({ data: {} }).then((result) => {
      if (result.status === "success") {
        toast.success("Banks & Wallets reconciled from Supabase.");
      } else {
        toast.warning("Banks & Wallets reconciliation completed with issues.");
      }
      refresh();
    }).catch((error) => {
      toast.error("Banks & Wallets reconciliation failed: " + (error instanceof Error ? error.message : String(error)));
    }).finally(() => {
      setIsReconcilingBanksWallets(false);
    });
  };

  const reconcileDailyCashBook = () => {
    if (isReconcilingCashBook) return;
    setIsReconcilingCashBook(true);
    void reconcileDailyCashBookToSheets({ data: {} }).then((result) => {
      if (result.status === "success") {
        toast.success("Daily Cash Book reconciled from Supabase.");
      } else {
        toast.warning("Daily Cash Book reconciliation completed with issues.");
      }
      refresh();
    }).catch((error) => {
      toast.error("Daily Cash Book reconciliation failed: " + (error instanceof Error ? error.message : String(error)));
    }).finally(() => {
      setIsReconcilingCashBook(false);
    });
  };

  const reconcileExpenses = () => {
    if (isReconcilingExpenses) return;
    setIsReconcilingExpenses(true);
    void reconcileExpensesToSheets({ data: {} }).then((result) => {
      if (result.status === "success") {
        toast.success("Expenses reconciled from Supabase.");
      } else {
        toast.warning("Expenses reconciliation completed with issues.");
      }
      refresh();
    }).catch((error) => {
      toast.error("Expenses reconciliation failed: " + (error instanceof Error ? error.message : String(error)));
    }).finally(() => {
      setIsReconcilingExpenses(false);
    });
  };

  // New account (bank/wallet/cash) won't show in its Google Sheet until the next sync —
  // reconcileBanksWallets only touches bank/wallet rows, so it's a safe no-op for cash.
  const addAccount = mutate((payload: { name: string; kind: Kind; opening_balance: number; opening_balance_date?: string; logo_url?: string | null }) => addAccountFn({ data: payload }), "Account added", undefined, syncSheetsInBackground);
  const updateAccount = mutate((payload: { id: string; name: string; kind: "bank" | "wallet"; opening_balance: number; opening_balance_date?: string; logo_url: string | null }) => updateAccountFn({ data: payload }), "Account updated", undefined, syncSheetsInBackground);

  const addTxn = mutate((payload: Record<string, unknown>) => txnFn({ data: payload as never }), "Entry posted");
  const updateTxn = mutate((payload: Record<string, unknown>) => updateTxnFn({ data: payload as never }), "Entry updated");
  const addGroup = mutate((payload: Record<string, unknown>) => groupFn({ data: payload as never }), "Transaction posted to every ledger");
  const addLinked = mutate((payload: Record<string, unknown>) => linkedFn({ data: payload as never }), "Entry posted to the ledgers");
  const addTransfer = mutate((payload: Record<string, unknown>) => transferFn({ data: payload as never }), "Transfer posted to both ledgers");

  const removeTxn = mutate((id: string) => deleteTxnFn({ data: id }), "Entry deleted");
  const removeAccount = mutate((payload: { id: string; password: string }) => deleteAccountFn({ data: payload }), "Account removed");
  const addService = mutate((payload: { name: string }) => addServiceFn({ data: payload }), "Category added");
  const removeService = mutate((payload: { id: string; password: string }) => deleteServiceFn({ data: payload }), "Category removed");

  const busy = addTxn.isPending || addLinked.isPending || addTransfer.isPending || addAccount.isPending || addGroup.isPending;

  if (isLoading) return <div className="p-10 text-center">Loading Accounts Book…</div>;
  if (error) return <div className="p-10 text-center text-destructive">{error.message}</div>;

  const cashRows = txns.filter((t) => cash && t.account_id === cash.id);
  const moneyAccountIds = new Set(accounts.map((account) => account.id));
  // Daily Cash Book is the single fast-check journal for every cash/bank/wallet movement.
  const cashbookRows = txns.filter((t) => moneyAccountIds.has(t.account_id));
  const cashBalance = finalBalance(cashRows, cash?.opening_balance ?? 0);
  const bankTotal = banks.reduce((sum, b) => sum + finalBalance(txns.filter((t) => t.account_id === b.id), b.opening_balance), 0);
  const saleRows = txns.filter((t) => t.entry_type === "sale" && t.direction === "in");
  const expenseRows = txns.filter((t) => t.entry_type === "expense");

  const rollup = (() => {
    const keys = [...new Set([...saleRows, ...expenseRows].map((r) => monthKey(r.entry_date)).filter(Boolean))].sort();
    return keys.map((key) => {
      const sales = saleRows.filter((r) => monthKey(r.entry_date) === key);
      const exps = expenseRows.filter((r) => monthKey(r.entry_date) === key);
      const totalSale = sales.reduce((a, r) => a + Number(r.amount), 0);
      const totalCost = sales.reduce((a, r) => a + Number(r.direct_cost), 0);
      const totalExp = exps.reduce((a, r) => a + Number(r.amount), 0);
      return { key, label: monthLabel(key), totalSale, totalCost, grossProfit: totalSale - totalCost, totalExp, netProfit: totalSale - totalCost - totalExp };
    });
  })();
  const thisMonth = rollup.find((r) => r.key === monthKey(todayISO())) ?? { totalSale: 0, netProfit: 0 };
  const grand = rollup.reduce((a, r) => ({ totalSale: a.totalSale + r.totalSale, totalCost: a.totalCost + r.totalCost, totalExp: a.totalExp + r.totalExp, netProfit: a.netProfit + r.netProfit }), { totalSale: 0, totalCost: 0, totalExp: 0, netProfit: 0 });

  const editTransaction = (row: Txn) => { setEditingTxn(row); setModal("editTransaction"); };

  const deleteGroup = (row: Txn) => {
    if (window.confirm("Delete this transaction and every linked ledger projection? This cannot be undone.")) removeTxn.mutate(row.id);
  };
  const accountName = (id: string) => accounts.find((a) => a.id === id)?.name ?? "—";
  const sourceBadge = (row: Txn) =>
    row.source_type ? <span className="badge link">{row.source_type}</span> : <span className="badge manual">manual</span>;

  return (
    <div className="rohi-ab animate-premium-fade">
      <style>{STYLE}</style>
      <div className="border-b border-[var(--border)] bg-[var(--foreground)] text-[var(--background)]">
        <div className="flex w-full flex-wrap items-center justify-between gap-3 px-4 py-4">
          <div className="flex items-center gap-3">
            <Wallet className="h-5 w-5 text-white" />
            <div>
              <p className="font-sans text-lg font-semibold">Admin Panel</p>
              <p className="text-[11px] font-medium text-white/70">Accounts Book</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <AdminHeaderExtras />
            <a href="/" className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--card)] px-3 py-1.5 text-[13px] font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--muted)]"><Home className="h-3.5 w-3.5" /> Home</a>
            <button onClick={onLogout} className="inline-flex items-center gap-2 rounded-lg bg-[var(--accent)] px-3 py-1.5 text-[13px] font-medium text-[var(--background)] transition-colors hover:bg-[var(--accent-hover)]">
              <LogOut className="h-3.5 w-3.5" /> Logout
            </button>
          </div>
        </div>
        <AdminTabs />
      </div>
      <div className="shell">
        {mobileNavOpen && <button type="button" className="mobile-ledger-backdrop" aria-label="Close accounts navigation" onClick={() => setMobileNavOpen(false)} />}
        <aside className={`side ${mobileNavOpen ? "mobile-open" : ""}`}>
          <div className="brand">
            <div className="eyebrow flex items-center justify-between">Rohi International<button type="button" className="mobile-ledger-menu" aria-label="Close accounts menu" onClick={() => setMobileNavOpen(false)}><X size={18} /></button></div>
            <h1>Accounts&nbsp;Book</h1>
          </div>
          <nav className="tabs">
            {TAB_GROUPS.map((group, index) => {
              const groupKey = group.header ?? `g${index}`;
              const collapsed = Boolean(collapsedGroups[groupKey]);
              const hasActiveChild = group.tabs.some((item) => item.id === tab);
              return (
                <div className={`tab-group ${hasActiveChild ? "contains-active" : ""}`} key={groupKey}>
                  {group.header && (
                    <button
                      type="button"
                      className={`tab-group-label tab-group-toggle ${hasActiveChild ? "active-group" : ""}`}
                      aria-expanded={!collapsed}
                      onClick={() => setCollapsedGroups((previous) => ({ ...previous, [groupKey]: !previous[groupKey] }))}
                    >
                      <span>{group.header}</span>
                      <ChevronDown size={13} className={collapsed ? "group-chevron collapsed" : "group-chevron"} />
                    </button>
                  )}
                  {!collapsed && group.tabs.map((item) => {
                    const num = TAB_NUMBERS[item.id];
                    return (
                      <button key={item.id} type="button" className={`tab-btn ${tab === item.id ? "active" : ""}`} onClick={() => { setTab(item.id); setMobileNavOpen(false); }}>
                        <span className="num">{num}</span>
                        <span className="label">{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </nav>
          <div className="side-foot">
            <span className="save-dot" style={isFetching ? { background: "var(--brass)" } : undefined} />
            <span>{isFetching ? "Syncing…" : "Saved to the live database"}</span>
          </div>
        </aside>

        <main className="main">
          <button type="button" className="btn ghost mobile-ledger-menu" onClick={() => setMobileNavOpen(true)} aria-label="Open accounts navigation"><Menu size={17} /> Accounts menu</button>
          {tab === "dashboard" && (
            <>
              <div className="page-head">
                <div>
                  <h2>Dashboard</h2>
                  <p>ROHI INTERNATIONAL TRAVELS — overview as of {formatDateShort(todayISO())}</p>
                </div>
                <button type="button" className="btn" onClick={() => setModal("quickadd")}>NEW TRANSACTION</button>
                
              </div>
              <div className="cards">
                <Card label="Cash in Hand" value={cashBalance} tone={cashBalance >= 0 ? "pos" : "neg"} foot="Live Cash Book balance" />
                <Card label="Total in Banks & Wallets" value={bankTotal} tone="pos" foot={`${banks.length} accounts`} />
                <Card label="This Month Sales" value={thisMonth.totalSale} foot={monthLabel(monthKey(todayISO()))} />
                <Card label="This Month Profit" value={thisMonth.netProfit} tone={thisMonth.netProfit >= 0 ? "pos" : "neg"} foot="After cost & expenses" />
              </div>
              <Panel title="Recent Accounts Book Transactions">
                <div style={{ padding: "10px 16px", background: "var(--background)", borderBottom: "1px solid var(--border)", display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 10, fontSize: "0.82rem", color: "var(--muted-foreground)" }}>
                  <span>
                    <strong>1-Step Unified Linkage:</strong> Every transaction is recorded as a complete unit and automatically posted across Cash Book, Category, and Account ledgers, then synced to Google Sheets.
                  </span>
                  <span className="badge link" style={{ fontSize: "0.72rem", padding: "2px 8px" }}>
                    Atomic Edit &amp; Delete
                  </span>
                </div>
                <table className="dashboard-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Description</th>
                      <th>Category</th>
                      <th>Account / Paid Via</th>
                      <th className="num">Amount (PKR)</th>
                      <th>Ledger Linkage</th>
                      <th className="actions-cell">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {byDate(txns).slice(-15).reverse().map((row) => {
                      const acc = accountName(row.account_id);
                      const isOut = row.direction === "out";
                      const isIn = row.direction === "in";
                      const catName = row.category || (row.entry_type === "expense" ? "Office Expenses" : "General");
                      const isOfficeExp = catName.toLowerCase().includes("office");

                      return (
                        <tr key={row.id}>
                          <td style={{ whiteSpace: "nowrap", fontWeight: 500 }}>{formatDateShort(row.entry_date)}</td>
                          <td className="description-cell" title={row.description}>
                            <div style={{ fontWeight: 600, color: "var(--foreground)" }}>{row.description || "—"}</div>
                            {row.party && <div style={{ fontSize: "0.74rem", color: "var(--muted-foreground)" }}>Party: {row.party}</div>}
                          </td>
                          <td>
                            <span
                              className="badge manual"
                              style={{ cursor: "pointer" }}
                              onClick={() => {
                                if (row.entry_type === "expense") { setTab("expenses"); setExpSel(catName); }
                                else if (row.entry_type === "sale") { setTab("sales"); setSalesSel(catName); }
                              }}
                              title="Click to view category"
                            >
                              {catName}
                            </span>
                          </td>
                          <td>
                            <span
                              className="badge link"
                              style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4 }}
                              onClick={() => { setTab("bank"); setBankSel(row.account_id); }}
                              title="Click to view Bank/Wallet ledger"
                            >
                              <Wallet size={12} />
                              {acc}
                            </span>
                          </td>
                          <td className={`num ${isIn ? "in-amt" : "out-amt"}`} style={{ fontWeight: 600 }}>
                            {isIn ? `+ Rs ${fmt(row.amount)}` : `- Rs ${fmt(row.amount)}`}
                          </td>
                          <td>
                            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 4, fontSize: "0.72rem" }}>
                              <span style={{ padding: "2px 6px", borderRadius: 4, background: "rgba(0,0,0,0.06)", fontWeight: 500 }}>Cash Book</span>
                              <span>•</span>
                              <span style={{ padding: "2px 6px", borderRadius: 4, background: "rgba(217,119,87,0.12)", color: "#D97757", fontWeight: 600 }}>
                                {row.entry_type === "expense" ? (isOfficeExp ? "Office Expenses" : "Home Expenses") : (row.category || "Sales")}
                              </span>
                              <span>•</span>
                              <span style={{ padding: "2px 6px", borderRadius: 4, background: "rgba(0,0,0,0.06)", fontWeight: 500 }}>
                                {acc}
                              </span>
                            </div>
                          </td>
                          <td className="actions-cell">
                            <div className="dashboard-actions">
                              <button type="button" className="icon-btn" title="Edit entire linked transaction" onClick={() => editTransaction(row)}>
                                Edit
                              </button>
                              <button type="button" className="icon-btn danger" title="Delete entire linked transaction" onClick={() => deleteGroup(row)}>
                                Delete
                              </button>
                              {accountName(row.account_id) && (
                                <button type="button" className="icon-btn" title="View Account Ledger" onClick={() => { setTab("bank"); setBankSel(row.account_id); }}>
                                  Ledger
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {txns.length === 0 && (
                      <tr className="empty-row"><td colSpan={7}>No transactions recorded yet. Click &ldquo;NEW TRANSACTION&rdquo; to add one.</td></tr>
                    )}
                  </tbody>
                </table>
              </Panel>
            </>
          )}

          {tab === "cashbook" && (
            <CashBookReplacement
              rows={cashbookRows}
              opening={cash?.opening_balance ?? 0}
              accounts={accounts}
            />
          )}

          {tab === "bank" && (
            <>
              <div className="page-head">
                <div><h2>Banks &amp; Wallets</h2><p>Supabase is the source of truth; statements sync automatically to each account’s Google Sheets tab.</p></div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  <a className="btn ghost small" href="https://docs.google.com/spreadsheets/d/1k0oqR8oykH6wQfvE7xaVqbpsWgdyuz5XDYZdemcSerY/edit" target="_blank" rel="noreferrer">Open Google Sheet</a>
                  <button type="button" className="btn ghost small" onClick={() => exportBankStatement("excel")} disabled={!activeBank}>Export Excel</button>
                  <button type="button" className="btn ghost small" onClick={exportBankStatementCSV} disabled={!activeBank}>Export CSV</button>
                  <button type="button" className="btn ghost small" onClick={() => exportBankStatement("pdf")} disabled={!activeBank}>Export PDF</button>
                  
                </div>
              </div>
              {activeBank && (
                <div className="cards">
                  <Card label={`${activeBank.name} — Opening`} value={activeBank.opening_balance} />
                  <Card label="Total Debit (Out)" value={txns.filter((t) => t.account_id === activeBank.id && t.direction === "out").reduce((a, r) => a + Number(r.amount), 0)} tone="pos" />
                  <Card label="Total Credit (In)" value={txns.filter((t) => t.account_id === activeBank.id && t.direction === "in").reduce((a, r) => a + Number(r.amount), 0)} tone="neg" />
                  <Card label="Current Balance" value={finalBalance(txns.filter((t) => t.account_id === activeBank.id), activeBank.opening_balance)} tone="pos" />
                </div>
              )}
              <BankWalletAccountCards
                accounts={banks}
                transactions={txns}
                activeId={activeBank?.id}
                onSelect={setBankSel}
                draggedId={draggedAccountId}
                onDragChange={setDraggedAccountId}
                onReorder={(ids) => {
                  void reorderAccountsFn({ data: { ids } }).then((result: any) => {
                    refresh();
                    if (result?.sheetSync?.status === "failed") {
                      toast.warning("Account order saved. Google Sheets sync needs attention.");
                    } else {
                      toast.success("Bank/wallet order saved and sheet tab order refreshed.");
                    }
                  }).catch((error) => {
                    toast.error("Could not save account order: " + (error instanceof Error ? error.message : String(error)));
                    refresh();
                  });
                }}
              />
              <div className="pillbar">
                <button type="button" className="pill add" onClick={() => { setEditingAccount(null); setModal("addBank"); }}>+ Add Account</button>
              </div>
              {activeBank ? (
                <Panel title={`${activeBank.name} Ledger`}>
                  <LedgerTable rows={withRunning(txns.filter((t) => t.account_id === activeBank.id), activeBank.opening_balance)} inLabel="Debit" outLabel="Credit" onDelete={deleteGroup} onEdit={editTransaction} badge={sourceBadge} />
                </Panel>
              ) : (
                <Panel title="No accounts yet"><p style={{ fontSize: 13 }}>Add your first bank or wallet account to get started.</p></Panel>
              )}
            </>
          )}

          {tab === "sales" && (
            <>
              <div className="page-head">
                <div><h2>Sales Accounts</h2><p>Booking sales by category — profit calculates automatically from sale minus cost</p></div>
              </div>
              <DraggablePills
                items={salesCatRows.map((row) => ({ id: row.name, label: row.name }))}
                activeId={activeSalesCat}
                onSelect={setSalesSel}
                storageKey="accounts-book-pills-sales"
                onReorder={(names) => {
                  const real = names.map((n) => salesCatRows.find((r) => r.name === n)?.id).filter((id): id is string => Boolean(id));
                  if (real.length) reorderServicesFn({ data: { ids: real } }).catch(() => refresh());
                }}
              />
              <div className="pillbar"><button type="button" className="pill add" onClick={() => setModal("addSalesCat")}>+ Add Category</button></div>
              {(() => {
                const rows = byDate(saleRows.filter((r) => r.category === activeSalesCat));
                const totalSale = rows.reduce((a, r) => a + Number(r.amount), 0);
                const totalCost = rows.reduce((a, r) => a + Number(r.direct_cost), 0);
                return (
                  <>
                    <div className="cards">
                      <Card label="Total Sale" value={totalSale} />
                      <Card label="Total Cost" value={totalCost} />
                      <Card label="Profit" value={totalSale - totalCost} tone={totalSale - totalCost >= 0 ? "pos" : "neg"} />
                      <Card label="Entries" value={rows.length} raw />
                    </div>
                    <Panel title={activeSalesCat ?? "Sales"}>
                      <table>
                        <thead><tr><th>Date</th><th>Party</th><th>Description</th><th className="num">Sale</th><th className="num">Cost</th><th className="num">Profit</th><th>Received</th><th /></tr></thead>
                        <tbody>
                          {rows.map((row) => {
                            const profit = Number(row.amount) - Number(row.direct_cost);
                            return (
                              <tr key={row.id}>
                                <td>{formatDateShort(row.entry_date)}</td>
                                <td>{row.party ?? ""}</td>
                                <td>{row.description}</td>
                                <td className="num">{fmt(row.amount)}</td>
                                <td className="num">{fmt(row.direct_cost)}</td>
                                <td className="num" style={{ fontWeight: 600, color: profit >= 0 ? "var(--teal-dark)" : "var(--crimson-dark)" }}>{fmt(profit)}</td>
                                <td>{accountName(row.account_id)}</td>
                                <td><button type="button" className="icon-btn" onClick={() => editTransaction(row)}>Edit</button><button type="button" className="icon-btn" onClick={() => deleteGroup(row)}>Delete</button></td>
                              </tr>
                            );
                          })}
                          {rows.length === 0 && <tr className="empty-row"><td colSpan={8}>No entries yet for {activeSalesCat ?? "this category"}.</td></tr>}
                        </tbody>
                      </table>
                    </Panel>
                  </>
                );
              })()}
            </>
          )}

          {tab === "expenses" && (
            <>
              <div className="page-head">
                <div><h2>Expenses</h2><p>Personal &amp; office spending, tracked by category and payment source</p></div>
              </div>
              <DraggablePills
                items={expenseCatRows.map((row) => ({ id: row.name, label: row.name }))}
                activeId={activeExpCat}
                onSelect={setExpSel}
                storageKey="accounts-book-pills-expenses"
                onReorder={(names) => {
                  const real = names.map((n) => expenseCatRows.find((r) => r.name === n)?.id).filter((id): id is string => Boolean(id));
                  if (real.length) reorderServicesFn({ data: { ids: real } }).catch(() => refresh());
                }}
              />
              <div className="pillbar"><button type="button" className="pill add" onClick={() => setModal("addExpenseCat")}>+ Add Category</button></div>
              {(() => {
                const rows = byDate(expenseRows.filter((r) => r.category === activeExpCat));
                const total = rows.reduce((a, r) => a + Number(r.amount), 0);
                return (
                  <>
                    <div className="cards">
                      <Card label={`Total — ${activeExpCat ?? ""}`} value={total} tone="neg" />
                      <Card label="Entries" value={rows.length} raw />
                    </div>
                    <Panel title={activeExpCat ?? "Expenses"}>
                      <table>
                        <thead><tr><th>Date</th><th>Description</th><th className="num">Amount</th><th>Paid via</th><th /></tr></thead>
                        <tbody>
                          {rows.map((row) => (
                            <tr key={row.id}>
                              <td>{formatDateShort(row.entry_date)}</td>
                              <td>{row.description}</td>
                              <td className="num out-amt">{fmt(row.amount)}</td>
                              <td>{accountName(row.account_id)}</td>
                              <td><div className="dashboard-actions"><button type="button" className="icon-btn" onClick={() => editTransaction(row)}>Edit</button><button type="button" className="icon-btn danger" onClick={() => deleteGroup(row)}>Delete</button></div></td>
                            </tr>
                          ))}
                          {rows.length === 0 && <tr className="empty-row"><td colSpan={5}>No entries yet for {activeExpCat ?? "this category"}.</td></tr>}
                        </tbody>
                      </table>
                    </Panel>
                  </>
                );
              })()}
            </>
          )}

          {tab === "reports" && (
            <>
              <div className="page-head">
                <div><h2>Reports — Profit &amp; Loss</h2><p>Auto-calculated month by month from Sales and Expenses</p></div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button type="button" className="btn ghost" onClick={() => downloadExcel({ title: "Profit and Loss", headers: ["Month", "Sales", "Cost", "Gross Profit", "Expenses", "Net Profit"], rows: rollup.map((row) => [row.label, row.totalSale, row.totalCost, row.grossProfit, row.totalExp, row.netProfit]) })}>Excel / Sheets</button>
                  <button type="button" className="btn ghost" onClick={() => downloadPdf({ title: "Profit and Loss", headers: ["Month", "Sales", "Cost", "Gross Profit", "Expenses", "Net Profit"], rows: rollup.map((row) => [row.label, row.totalSale, row.totalCost, row.grossProfit, row.totalExp, row.netProfit]) })}>Download PDF</button>
                </div>
              </div>
              <div className="cards">
                <Card label="Total Sales" value={grand.totalSale} />
                <Card label="Total Cost" value={grand.totalCost} />
                <Card label="Total Expenses" value={grand.totalExp} tone="neg" />
                <Card label="Net Profit" value={grand.netProfit} tone={grand.netProfit >= 0 ? "pos" : "neg"} />
              </div>
              <Panel title="Monthly Summary">
                <table>
                  <thead><tr><th>Month</th><th className="num">Sales</th><th className="num">Cost</th><th className="num">Gross Profit</th><th className="num">Expenses</th><th className="num">Net Profit</th></tr></thead>
                  <tbody>
                    {rollup.map((row) => (
                      <tr key={row.key}>
                        <td>{row.label}</td>
                        <td className="num">{fmt(row.totalSale)}</td>
                        <td className="num">{fmt(row.totalCost)}</td>
                        <td className="num">{fmt(row.grossProfit)}</td>
                        <td className="num out-amt">{fmt(row.totalExp)}</td>
                        <td className="num" style={{ fontWeight: 600, color: row.netProfit >= 0 ? "var(--teal-dark)" : "var(--crimson-dark)" }}>{fmt(row.netProfit)}</td>
                      </tr>
                    ))}
                    {rollup.length === 0 && <tr className="empty-row"><td colSpan={6}>No sales or expense data yet.</td></tr>}
                  </tbody>
                </table>
              </Panel>
            </>
          )}

          {tab === "cashcount" && <CashCountPanel available={cashBalance} />}

          {tab === "settings" && (
            <>
              <div className="page-head">
                <div><h2>Settings</h2><p>Separate settings for each Google Sheets ledger</p></div>
              </div>
              <div className="settings-tabs" role="tablist" aria-label="Accounts Book settings">
                {[
                  ["banks", "Banks & Wallets"],
                  ["cashbook", "Daily Cash Book"],
                  ["sales", "Sales Accounts"],
                  ["expenses", "Expenses"],
                ].map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    role="tab"
                    aria-selected={settingsTab === id}
                    className={`settings-tab ${settingsTab === id ? "active" : ""}`}
                    onClick={() => setSettingsTab(id as typeof settingsTab)}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {settingsTab === "banks" && (
                <section className="settings-section">
                  <div className="settings-section-head">
                    <div>
                      <h3>Banks &amp; Wallets</h3>
                      <span className="settings-note">
                        Supabase is the source of truth; statements sync automatically to each account’s Google Sheets tab.
                      </span>
                    </div>
                    <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                      <a
                        className="btn ghost small"
                        href="https://docs.google.com/spreadsheets/d/1k0oqR8oykH6wQfvE7xaVqbpsWgdyuz5XDYZdemcSerY/edit"
                        target="_blank"
                        rel="noreferrer"
                        style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
                        title="Open live Banks & Wallets Google Spreadsheet"
                      >
                        <ExternalLink size={13} />
                        <span>Open Google Sheet</span>
                      </a>
                      <button
                        type="button"
                        className="btn small"
                        onClick={() => setModal("addBank")}
                        style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
                        title="Add a new bank or wallet account"
                      >
                        <Wallet size={14} />
                        <span>+ Add Account</span>
                      </button>
                    </div>
                  </div>
                  <BanksWalletsOpeningTable
                    banks={banks}
                    txns={txns}
                    onEditAccount={(account) => { setEditingAccount(account); setModal("addBank"); }}
                    onReorder={(ids) => {
                      void reorderAccountsFn({ data: { ids } })
                        .then((result: any) => {
                          refresh();
                          if (result?.sheetSync?.status === "failed") {
                            toast.warning("Account order saved. Google Sheets sync needs attention.");
                          } else {
                            toast.success("Bank/wallet order saved & sheet tab order updated.");
                          }
                        })
                        .catch((error) => {
                          toast.error("Could not save account order: " + (error instanceof Error ? error.message : String(error)));
                          refresh();
                        });
                    }}
                    onDeleteAccount={(acc) => {
                      setDeleteGuard({ kind: "account", id: acc.id, label: acc.name });
                    }}
                  />
                </section>
              )}

              {settingsTab === "cashbook" && (
                <section className="settings-section">
                  <div className="settings-section-head">
                    <div>
                      <h3>Daily Cash Book</h3>
                      <span className="settings-note">Cash account settings · Supabase → Daily Cash Book only</span>
                    </div>
                    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                      <a
                        className="btn ghost small"
                        href="https://docs.google.com/spreadsheets/d/1eMeClR8JrIOokh9JtPWF2JdyB6uMb_m_GsE9H42hZw8/edit"
                        target="_blank"
                        rel="noreferrer"
                        style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
                        title="Open live Daily Cash Book Google Spreadsheet"
                      >
                        <ExternalLink size={13} />
                        <span>Open Google Sheet</span>
                      </a>
                    </div>
                  </div>
                  {cash ? (
                    <table className="dashboard-table" style={{ marginTop: 8 }}>
                      <thead><tr><th>Cash Account</th><th className="num">Opening Balance (PKR)</th><th>Opening Date</th><th style={{ textAlign: "right" }}>Actions</th></tr></thead>
                      <tbody>
                        <CashOpeningRow
                          cash={cash}
                          onSave={async (id, opening_balance, opening_balance_date) => {
                            queryClient.setQueryData(["accounts-book"], (old: any) => {
                              if (!old || !Array.isArray(old.accounts)) return old;
                              return {
                                ...old,
                                accounts: old.accounts.map((acc: any) =>
                                  acc.id === id ? { ...acc, opening_balance, opening_balance_date } : acc
                                ),
                              };
                            });
                            try {
                              const res: any = await openingFn({ data: { id, opening_balance, opening_balance_date } });
                              refresh();
                              if (res?.sheetSync?.status === "failed") {
                                toast.warning("Cash opening balance saved. Google Sheets sync pending.");
                              } else {
                                toast.success("Cash opening balance saved.");
                              }
                            } catch (err) {
                              refresh();
                              toast.error("Failed to save cash opening balance: " + (err instanceof Error ? err.message : String(err)));
                              throw err;
                            }
                          }}
                        />
                      </tbody>
                    </table>
                  ) : (
                    <p className="settings-note">No cash account is configured yet.</p>
                  )}
                </section>
              )}

              {settingsTab === "sales" && (
                <section className="settings-section">
                  <div className="settings-section-head"><h3>Sales Accounts</h3><span className="settings-note">Sales category settings</span></div>
                  <DraggablePills
                    items={services.filter((s) => !s.name.startsWith(EXPENSE_PREFIX)).map((service) => ({ id: service.id, label: service.name }))}
                    storageKey="accounts-book-pills-settings-sales"
                    onDelete={(id) => {
                      const service = services.find((s) => s.id === id);
                      if (service) setDeleteGuard({ kind: "category", id: service.id, label: service.name });
                    }}
                  />
                  <button type="button" className="btn small ghost" onClick={() => setModal("addSalesCat")}>+ Add Sales Category</button>
                </section>
              )}

              {settingsTab === "expenses" && (
                <section className="settings-section">
                  <div className="settings-section-head">
                    <div>
                      <h3>Expenses</h3>
                      <span className="settings-note">Expense category settings · Supabase → Expenses workbook</span>
                    </div>
                    <div>
                      <button
                        type="button"
                        className={`btn small reconcile-btn ${isReconcilingExpenses ? "is-running" : ""}`}
                        onClick={reconcileExpenses}
                        disabled={isReconcilingExpenses}
                        aria-busy={isReconcilingExpenses}
                      >
                        <RefreshCw size={15} className={`reconcile-icon ${isReconcilingExpenses ? "spin" : ""}`} />
                        <span>{isReconcilingExpenses ? "Reconciling…" : "Reconcile Expenses"}</span>
                      </button>
                      {isReconcilingExpenses && (
                        <div className="reconcile-status" role="status" aria-live="polite">
                          <span className="status-dot" />
                          Updating Google Sheets from Supabase — please wait…
                        </div>
                      )}
                    </div>
                  </div>
                  <DraggablePills
                    items={services.filter((s) => s.name.startsWith(EXPENSE_PREFIX)).map((service) => ({ id: service.id, label: service.name.slice(EXPENSE_PREFIX.length) }))}
                    storageKey="accounts-book-pills-settings-expenses"
                    onDelete={(id) => {
                      const service = services.find((s) => s.id === id);
                      if (service) setDeleteGuard({ kind: "category", id: service.id, label: service.name.slice(EXPENSE_PREFIX.length) });
                    }}
                  />
                  <button type="button" className="btn small ghost" onClick={() => setModal("addExpenseCat")}>+ Add Expense Category</button>
                </section>
              )}
            </>
          )}
        </main>
      </div>

      {deleteGuard && <ProtectedDeleteDialog guard={deleteGuard} close={() => setDeleteGuard(null)} onDelete={async (password) => {
        if (deleteGuard.kind === "account") await removeAccount.mutateAsync({ id: deleteGuard.id, password });
        else await removeService.mutateAsync({ id: deleteGuard.id, password });
        setDeleteGuard(null);
      }} />}

      {modal && (
        <Modals
          key={`${modal}:${editingAccount?.id ?? "new"}`}
          kind={modal}
          close={() => setModal(null)}
          open={setModal}
          busy={busy || updateAccount.isPending}
          editingAccount={editingAccount}
          cash={cash ?? null}
          banks={banks}
          accounts={accounts}
          activeBank={activeBank}
          salesCats={salesCats}
          expenseCats={expenseCats}
          activeSalesCat={activeSalesCat}
          activeExpCat={activeExpCat}
          onCash={(payload) => addTxn.mutate(payload, { onSuccess: () => setModal(null) })}
          onLinked={(payload) => addLinked.mutate(payload, { onSuccess: () => setModal(null) })}
          onExtra={(payload) => addTxn.mutate(payload)}
          onTransfer={(payload) => addTransfer.mutate(payload, { onSuccess: () => setModal(null) })}
          onGroup={(payload) => addGroup.mutate(payload, { onSuccess: () => setModal(null) })}
          onAccount={(payload) => addAccount.mutate(payload, { onSuccess: () => { setModal(null); setEditingAccount(null); } })}
          onUpdateAccount={(payload) => {
            patchAccountInCache(payload.id, { name: payload.name, kind: payload.kind, opening_balance: payload.opening_balance, opening_balance_date: payload.opening_balance_date, logo_url: payload.logo_url });
            updateAccount.mutate(payload, { onSuccess: () => { setModal(null); setEditingAccount(null); }, onError: () => refresh() });
          }}
          onCategory={(name) => addService.mutate({ name }, { onSuccess: () => setModal(null) })}
          editTxn={editingTxn}
          onUpdate={(payload) => updateTxn.mutate(payload, { onSuccess: () => { setModal(null); setEditingTxn(null); } })}
        />
      )}
    </div>
  );
}

/* small factory so every mutation shares toast + refresh behaviour */
function useMutationFactory<T>(fn: (payload: T) => Promise<unknown>, message: string, refresh: () => void, fail: (e: unknown) => void, afterSuccess?: () => void) {
  return useMutation({
    mutationFn: fn,
    onSuccess: (result) => {
      refresh();
      const sync = (result as { sheetSync?: { status?: string; sheets?: string; failures?: string[] } } | undefined)?.sheetSync;
      if (!sync) {
        toast.success(message);
        return;
      }
      if (sync.status === "success" && sync.sheets) {
        toast.success(`${message}: saved to Supabase → synchronized to Google Sheets: ${sync.sheets}`);
        return;
      }
      if (sync.status === "pending") {
        toast.success(`${message}: saved to Supabase`);
        afterSuccess?.();
        return;
      }
      const detail = sync.failures?.filter(Boolean).join(" | ") || "Google Sheets sync did not complete";
      toast.warning(`${message}: saved to Supabase, but Google Sheets sync needs attention — ${detail}`);
      afterSuccess?.();
    },
    onError: fail,
  });
}

function CashCountPanel({ available }: { available: number }) {
  const DENOMS = [10, 20, 50, 100, 500, 1000, 5000];
  const [counts, setCounts] = useState<Record<number, number>>({});
  const countedCash = DENOMS.reduce((total, denomination) => total + denomination * (counts[denomination] || 0), 0);
  const difference = countedCash - available;
  return (
    <>
      <div className="page-head">
        <div><h2>Cash Counter</h2><p>Count physical notes and compare them with the live Accounts Book cash balance.</p></div>
        <button type="button" className="btn ghost" onClick={() => setCounts({})}>Reset count</button>
      </div>
      <div className="cashbook-summary">
        <Card label="Physical Cash Count" value={countedCash} foot="Calculated from denomination quantities" tone="pos" />
        <Card label="Cash Book Balance" value={available} foot="Live cash-in-hand balance" tone={available >= 0 ? "pos" : "neg"} />
        <Card label="Difference" value={difference} foot={difference === 0 ? "Count matches the book" : difference > 0 ? "Physical cash is above book balance" : "Physical cash is below book balance"} tone={difference === 0 ? "pos" : "neg"} />
      </div>
      <section className="cashbook-panel">
        <h3>Count notes currently in hand</h3>
        <div className="sub" style={{ display: "block", marginBottom: 12 }}>Enter the number of notes for each denomination. The total updates automatically.</div>
        <div className="cashbook-denoms">
          {DENOMS.map((denomination) => (
            <label key={denomination} className="cashbook-denom">
              <span>Rs {fmt(denomination)}</span>
              <input type="number" min={0} step={1} value={counts[denomination] || ""} onChange={(e) => setCounts((previous) => ({ ...previous, [denomination]: Math.max(0, Math.floor(Number(e.target.value) || 0)) }))} />
            </label>
          ))}
          <div className="cashbook-cash-total"><span>Physical cash total</span><span>Rs {fmt(countedCash)}</span></div>
          <div style={{ gridColumn: "1/-1", fontSize: 12, fontWeight: 700, color: difference === 0 ? "var(--teal-dark)" : "var(--ink-soft)" }}>
            {difference === 0 ? "Count matches the Accounts Book balance." : `Difference vs book: Rs ${fmt(difference)}`}
          </div>
        </div>
      </section>
    </>
  );
}

function CashBookReplacement({ rows, opening, accounts }: { rows: Txn[]; opening: number; accounts: Account[] }) {
  const [month, setMonth] = useState(todayISO().slice(0, 7));
  const [day, setDay] = useState(todayISO());
  const [search, setSearch] = useState("");

  const sorted = useMemo(() => byDate(rows), [rows]);
  const accountMap = useMemo(() => new Map(accounts.map((account) => [account.id, account])), [accounts]);
  const sum = (list: Txn[], direction: "in" | "out") => list.filter((x) => x.direction === direction).reduce((s, x) => s + Number(x.amount), 0);
  const cashRows = sorted.filter((t) => accountMap.get(t.account_id)?.kind === "cash");
  const available = finalBalance(cashRows, opening);
  const monthRows = sorted.filter((t) => monthKey(t.entry_date) === month);
  const mIn = sum(monthRows, "in");
  const mOut = sum(monthRows, "out");

  const openingForDay = new Map<string, number>();
  for (const account of accounts) openingForDay.set(account.id, Number(account.opening_balance) || 0);
  for (const row of sorted) {
    if (row.entry_date < day) {
      const current = openingForDay.get(row.account_id) ?? 0;
      openingForDay.set(row.account_id, current + (row.direction === "in" ? Number(row.amount) : -Number(row.amount)));
    }
  }
  const dayRows = sorted
    .filter((t) => (day === "all" ? monthKey(t.entry_date) === month : t.entry_date === day))
    .map((t) => {
      const current = openingForDay.get(t.account_id) ?? 0;
      const next = current + (t.direction === "in" ? Number(t.amount) : -Number(t.amount));
      openingForDay.set(t.account_id, next);
      return { ...t, balance: next };
    })
    .filter((t) => t.description.toLowerCase().includes(search.toLowerCase()));

  const [y = new Date().getFullYear(), m = new Date().getMonth() + 1] = month.split("-").map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const daily = Array.from({ length: daysInMonth }, (_, i) => {
    const d = `${month}-${String(i + 1).padStart(2, "0")}`;
    const list = monthRows.filter((t) => t.entry_date === d);
    return { d, incoming: sum(list, "in"), outgoing: sum(list, "out") };
  });
  const max = Math.max(1, ...daily.flatMap((x) => [x.incoming, x.outgoing]));
  const monthName = monthLabel(month);

  return (
    <>
      <div className="cashbook-head">
        <div>
          <h2>Daily Cash Book</h2>
          <p>All cash, bank &amp; wallet movements · {monthName}</p>
        </div>
        <div className="cashbook-tools">
          <input type="month" className="field" value={month} onChange={(e) => { setMonth(e.target.value); setDay(`${e.target.value}-01`); }} />
          <button type="button" className="btn ghost" onClick={() => window.print()}>Print</button>

        </div>
      </div>

      <div className="cashbook-summary">
        <Card label="Available Cash" value={available} foot="Current cash-in-hand balance" tone={available >= 0 ? "pos" : "neg"} />
        <Card label="Total Received" value={mIn} foot="All cash/bank/wallet accounts" tone="pos" />
        <Card label="Total Payments" value={mOut} foot="All cash/bank/wallet accounts" tone="neg" />
        <Card label="Net Movement" value={mIn - mOut} foot="All money accounts" tone={mIn - mOut >= 0 ? "pos" : "neg"} />
      </div>

      <section className="cashbook-panel">
        <div className="cashbook-head">
          <div><h3>All Money Movements</h3><div className="sub">{day === "all" ? `Entire Month · ${monthName}` : new Date(`${day}T00:00:00`).toDateString()}</div></div>
          <div className="cashbook-tools">
            <input className="field" placeholder="Search description…" value={search} onChange={(e) => setSearch(e.target.value)} />

          </div>
        </div>
        <div className="cashbook-table-wrap">
          <table className="cashbook-table">
            <thead><tr><th>#</th><th>Account</th><th>Description</th><th className="num">Received</th><th className="num">Payment</th><th className="num">Account Balance</th></tr></thead>
            <tbody>
              <tr><td>—</td><td colSpan={2}><strong>Opening balances are shown per account in the ledger below.</strong></td><td /><td /><td /></tr>
              {dayRows.map((t, i) => (
                <tr key={t.id}>
                  <td>{i + 1}</td><td>{accountMap.get(t.account_id)?.name ?? "—"}</td><td>{t.description}</td>
                  <td className="num in-amt">{t.direction === "in" ? fmt(t.amount) : "—"}</td>
                  <td className="num out-amt">{t.direction === "out" ? fmt(t.amount) : "—"}</td>
                  <td className="num"><strong>{fmt(t.balance)}</strong></td>
                </tr>
              ))}
              {dayRows.length === 0 && <tr className="empty-row"><td colSpan={6}>No entries for this day.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section className="cashbook-panel">
        <h3>Daily books</h3><div className="sub" style={{ display: "block", marginBottom: 12 }}>Jump to any day</div>
        <div className="cashbook-days" style={{ alignItems: "center" }}>
          <button type="button" className={`cashbook-day ${day === "all" ? "active" : ""}`} style={{ width: "auto", padding: "0 12px" }} onClick={() => setDay("all")}>
            All Month Entries
          </button>
          {daily.map((x, i) => (
            <button key={x.d} type="button" className={`cashbook-day ${x.d === day ? "active" : ""} ${x.incoming || x.outgoing ? "has-data" : ""}`} onClick={() => setDay(x.d)}>
              {String(i + 1).padStart(2, "0")}
            </button>
          ))}
        </div>
      </section>

      <div className="cashbook-two-col">
        <section className="cashbook-panel">
          <h3>Cash movement</h3><div className="sub" style={{ display: "block", marginBottom: 12 }}>Daily received vs payments</div>
          {monthRows.length === 0 ? (
            <div className="empty-row" style={{ border: "1px dashed var(--line)", borderRadius: 8 }}>No transactions this month.</div>
          ) : (
            <div className="cashbook-chart">
              {daily.map((x) => (
                <button key={x.d} type="button" className="cashbook-bar" title={`${x.d} · In ${fmt(x.incoming)} · Out ${fmt(x.outgoing)}`} onClick={() => setDay(x.d)}>
                  <span style={{ height: `${(x.incoming / max) * 100}%` }} />
                  <span style={{ height: `${(x.outgoing / max) * 100}%` }} />
                </button>
              ))}
            </div>
          )}
        </section>

        
      </div>
    </>
  );
}

type PillItem = { id: string; label: string };

function DraggablePills({
  items,
  activeId,
  onSelect,
  storageKey,
  onDelete,
  onReorder,
  hideReset,
}: {
  items: PillItem[];
  activeId?: string | null;
  onSelect?: (id: string) => void;
  storageKey: string;
  onDelete?: (id: string) => void;
  onReorder?: (ids: string[]) => void;
  hideReset?: boolean;
}) {
  const [order, setOrder] = useState<string[]>([]);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const orderRef = useRef<string[]>([]);
  const draggedRef = useRef<string | null>(null);
  const movedRef = useRef(false);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) ?? "[]");
      const ids = Array.isArray(saved) ? saved.filter((id): id is string => typeof id === "string") : [];
      setOrder(ids);
      orderRef.current = ids;
    } catch {
      setOrder([]);
      orderRef.current = [];
    }
  }, [storageKey]);

  const ordered = useMemo(() => {
    const position = new Map<string, number>(order.map((id, index) => [id, index]));
    return [...items].sort(
      (a, b) =>
        (position.get(a.id) ?? Number.MAX_SAFE_INTEGER) -
        (position.get(b.id) ?? Number.MAX_SAFE_INTEGER),
    );
  }, [items, order]);

  const resetOrder = () => {
    try { localStorage.removeItem(storageKey); } catch {}
    setOrder([]);
    orderRef.current = [];
  };

  useEffect(() => {
    if (!draggedId) return;

    const handleMove = (event: PointerEvent) => {
      if ((event.buttons & 1) !== 1) return;
      const target = document.elementFromPoint(event.clientX, event.clientY)
        ?.closest<HTMLElement>("[data-rohi-pill-id]");
      const toId = target?.dataset.rohiPillId;
      const fromId = draggedRef.current;
      if (!fromId || !toId || fromId === toId) return;

      const effective = orderRef.current.length
        ? [...orderRef.current]
        : ordered.map((item) => item.id);
      const from = effective.indexOf(fromId);
      const to = effective.indexOf(toId);
      if (from < 0 || to < 0) return;

      effective.splice(from, 1);
      const rect = target.getBoundingClientRect();
      const insertAt = event.clientX < rect.left + rect.width / 2 ? to : to + 1;
      effective.splice(Math.max(0, Math.min(insertAt, effective.length)), 0, fromId);

      orderRef.current = effective;
      setOrder(effective);
      movedRef.current = true;
      try { localStorage.setItem(storageKey, JSON.stringify(effective)); } catch {}
    };

    const handleUp = () => {
      const didMove = movedRef.current;
      const finalOrder = orderRef.current;
      draggedRef.current = null;
      setDraggedId(null);
      movedRef.current = false;
      if (didMove) onReorder?.(finalOrder);
    };

    window.addEventListener("pointermove", handleMove, { passive: true });
    window.addEventListener("pointerup", handleUp);
    window.addEventListener("pointercancel", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("pointercancel", handleUp);
    };
  }, [draggedId, ordered, storageKey, onReorder]);

  const startDrag = (event: React.PointerEvent<HTMLSpanElement>, id: string) => {
    if (event.button !== 0) return;
    // Preserve the native click sequence so a tap/click selects the category.
    draggedRef.current = id;
    movedRef.current = false;
    orderRef.current = ordered.map((item) => item.id);
    setDraggedId(id);
  };

  return (
    <div className="pillbar">
      {ordered.map((item) => {
        const isActive = activeId === item.id;
        return (
          <button
            key={item.id}
            type="button"
            className={"pill " + (isActive ? "active" : "")}
            data-rohi-pill-id={item.id}
            aria-pressed={isActive}
            onClick={() => {
              if (!movedRef.current) onSelect?.(item.id);
            }}
          >
            <span
              aria-label={"Drag " + item.label}
              title="Drag to reorder"
              onPointerDown={(event) => startDrag(event, item.id)}
              style={{
                display: "inline-flex",
                cursor: draggedId === item.id ? "grabbing" : "grab",
                touchAction: "none",
                userSelect: "none",
                marginRight: 6,
                opacity: 0.55,
              }}
            >⋮⋮</span>
            <span>{item.label}</span>
            {onDelete && (
              <span
                role="button"
                tabIndex={0}
                aria-label={"Remove " + item.label}
                style={{ cursor: "pointer", marginLeft: 6 }}
                onClick={(event) => {
                  event.stopPropagation();
                  onDelete(item.id);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    event.stopPropagation();
                    onDelete(item.id);
                  }
                }}
              >×</span>
            )}
          </button>
        );
      })}
      {!hideReset && order.length > 0 && (
        <button
          type="button"
          className="pill ghost"
          onClick={resetOrder}
          title="Reset to default order"
          style={{ opacity: 0.65, fontSize: 11, cursor: "pointer", padding: "4px 8px" }}
        >
          ↺ Reset order
        </button>
      )}
    </div>
  );
}

function Card({ label, value, tone, foot, raw }: { label: string; value: number; tone?: "pos" | "neg"; foot?: string; raw?: boolean }) {
  return (
    <div className="card">
      <div className="label">{label}</div>
      <div className={`value ${tone ?? ""}`}>{raw ? fmt(value) : `Rs ${fmt(value)}`}</div>
      {foot && <div className="foot">{foot}</div>}
    </div>
  );
}

function Panel({ title, sub, action, children }: { title: string; sub?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="ledger">
      <div className="ledger-inner">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 8 }}>
          <h3 style={{ margin: 0 }}>{title}{sub && <span className="sub">{sub}</span>}</h3>
          {action}
        </div>
        <div className="overflow-x-auto">{children}</div>
      </div>
    </div>
  );
}

function LedgerTable({ rows, inLabel, outLabel, onDelete, onEdit, badge }: { rows: (Txn & { balance: number })[]; inLabel: string; outLabel: string; onDelete: (row: Txn) => void; onEdit: (row: Txn) => void; badge: (row: Txn) => React.ReactNode }) {
  return (
    <div className="overflow-x-auto"><table>
      <thead><tr><th>Date</th><th>Description</th><th className="num">{inLabel}</th><th className="num">{outLabel}</th><th className="num">Balance</th><th>Source</th><th /></tr></thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id}>
            <td>{formatDateShort(row.entry_date)}</td>
            <td>{row.description}</td>
            <td className="num in-amt">{row.direction === "in" ? fmt(row.amount) : ""}</td>
            <td className="num out-amt">{row.direction === "out" ? fmt(row.amount) : ""}</td>
            <td className="num">{fmt(row.balance)}</td>
            <td>{badge(row)}</td>
            <td><button type="button" className="icon-btn" onClick={() => onEdit(row)}>Edit</button><button type="button" className="icon-btn" onClick={() => onDelete(row)}>Delete</button></td>
          </tr>
        ))}
        {rows.length === 0 && <tr className="empty-row"><td colSpan={7}>No entries yet.</td></tr>}
      </tbody>
    </table></div>
  );
}

/* ============================= MODALS ============================= */
function Modals(props: {
  kind: Exclude<ModalKind, null>;
  close: () => void;
  open: (kind: ModalKind) => void;
  busy: boolean;
  editingAccount: Account | null;
  cash: Account | null;
  banks: Account[];
  accounts: Account[];
  activeBank: Account | null;
  salesCats: string[];
  expenseCats: string[];
  activeSalesCat: string | null;
  activeExpCat: string | null;
  onCash: (payload: Record<string, unknown>) => void;
  onLinked: (payload: Record<string, unknown>) => void;
  onExtra: (payload: Record<string, unknown>) => void;
  onTransfer: (payload: Record<string, unknown>) => void;
  onGroup: (payload: Record<string, unknown>) => void;
  onAccount: (payload: { name: string; kind: Kind; opening_balance: number; opening_balance_date?: string; logo_url?: string | null }) => void;
  onUpdateAccount: (payload: { id: string; name: string; kind: "bank" | "wallet"; opening_balance: number; opening_balance_date?: string; logo_url: string | null }) => void;
  onCategory: (name: string) => void;
  editTxn: Txn | null;
  onUpdate: (payload: Record<string, unknown>) => void;
}) {
  const { kind, close, open, busy, editingAccount, cash, banks, accounts, activeBank, salesCats, expenseCats, activeSalesCat, activeExpCat, editTxn } = props;
  const [date, setDate] = useState(todayISO());
  const [desc, setDesc] = useState("");
  const [dir, setDir] = useState<"in" | "out">("in");
  const [amount, setAmount] = useState("");
  const [cat, setCat] = useState(kind === "expenseEntry" ? activeExpCat ?? "" : activeSalesCat ?? "");
  const [party, setParty] = useState("");
  const [cost, setCost] = useState("");
  const [recv, setRecv] = useState(cash?.id ?? accounts[0]?.id ?? "");
  const [paid, setPaid] = useState("");
  const [from, setFrom] = useState(cash?.id ?? accounts[0]?.id ?? "");
  const [to, setTo] = useState(banks[0]?.id ?? accounts[0]?.id ?? "");
  const [txType, setTxType] = useState<"expense" | "sale" | "transfer" | "entry">("expense");
  const [name, setName] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [accountKind, setAccountKind] = useState<Kind>("bank");
  const [opening, setOpening] = useState("0");
  const [openingDate, setOpeningDate] = useState(todayISO());

  useEffect(() => {
    if (kind === "addBank") {
      if (editingAccount) {
        setName(editingAccount.name);
        setAccountKind(editingAccount.kind === "wallet" ? "wallet" : "bank");
        setLogoUrl(editingAccount.logo_url ?? "");
        setOpening(String(editingAccount.opening_balance ?? 0));
        setOpeningDate(editingAccount.opening_balance_date ?? todayISO());
      } else {
        setName("");
        setAccountKind("bank");
        setLogoUrl("");
        setOpening("0");
        setOpeningDate(todayISO());
      }
    }
    if (kind === "editTransaction" && editTxn) {
      setDate(editTxn.entry_date); setDesc(editTxn.description); setDir(editTxn.direction); setAmount(String(editTxn.amount));
      setCat(editTxn.category); setParty(editTxn.party ?? ""); setCost(String(editTxn.direct_cost ?? 0)); setRecv(editTxn.account_id);
    } else if (kind === "transferEntry") {
      const fromName = accounts.find((a) => a.id === from)?.name;
      const toName = accounts.find((a) => a.id === to)?.name;
      if (fromName && toName && (!desc || desc.startsWith("Online Transfer ") || desc === "Cash Deposited")) {
        setDesc(`Online Transfer ${fromName} to ${toName}`);
      }
    }
  }, [kind, editTxn, from, to, accounts, editingAccount]);

  const accountOptions = (list: Account[]) => list.map((a) => <option key={a.id} value={a.id}>{a.name}</option>);

  const shell = (title: string, sub: string | null, body: React.ReactNode, submitLabel?: string, submit?: () => void) => (
    <div className="overlay" onClick={(event) => event.target === event.currentTarget && close()}>
      <div className="modal">
        <div className="modal-head"><h3>{title}</h3><button type="button" className="modal-close" onClick={close} aria-label="Close"><X size={18} /></button></div>
        {sub && <div className="modal-sub">{sub}</div>}
        {body}
        <div className="modal-actions">
          <button type="button" className="btn ghost" onClick={close}>{submit ? "Cancel" : "Close"}</button>
          {submit && <button type="button" className="btn" disabled={busy} onClick={submit}>{busy ? "Saving…" : submitLabel}</button>}
        </div>
      </div>
    </div>
  );

  const numeric = (value: string) => Number(value) || 0;

  if (kind === "quickadd") {
    const catList = txType === "sale" ? salesCats : expenseCats;
    const catValue = catList.includes(cat) ? cat : catList[0] ?? "";
    const nameOf = (id: string) => accounts.find((a) => a.id === id)?.name ?? "—";
    const amt = numeric(amount);
    const costAmt = numeric(cost);
    const isOffice = catValue.toLowerCase().includes("office");
    const legs: { where: string; what: string }[] = [];
    if (txType === "expense") {
      legs.push({ where: "Daily Cash Book", what: `Payment ${fmt(amt)} via ${nameOf(recv)}` });
      legs.push({ where: `${isOffice ? "Office" : "Home"} Expenses › ${catValue || "category"}`, what: `${fmt(amt)} — ${desc.trim() || "description"}` });
      legs.push({ where: `${nameOf(recv)} ledger`, what: `Credit (out) ${fmt(amt)}` });
    } else if (txType === "sale") {
      legs.push({ where: "Daily Cash Book", what: `Received ${fmt(amt)} via ${nameOf(recv)}` });
      legs.push({ where: `Sales Accounts › ${catValue || "category"}`, what: `Sale ${fmt(amt)} · profit ${fmt(amt - costAmt)}` });
      legs.push({ where: `${nameOf(recv)} ledger`, what: `Debit (in) ${fmt(amt)}` });
      if (paid && costAmt > 0) legs.push({ where: `${nameOf(paid)} ledger + Daily Cash Book`, what: `Cost paid ${fmt(costAmt)}` });
    } else if (txType === "transfer") {
      legs.push({ where: "Daily Cash Book", what: `${fmt(amt)} ${nameOf(from)} → ${nameOf(to)}` });
      legs.push({ where: `${nameOf(from)} ledger`, what: `Credit (out) ${fmt(amt)}` });
      legs.push({ where: `${nameOf(to)} ledger`, what: `Debit (in) ${fmt(amt)}` });
    } else {
      legs.push({ where: "Daily Cash Book", what: `${dir === "in" ? "Received" : "Payment"} ${fmt(amt)}` });
      legs.push({ where: `${nameOf(recv)} ledger`, what: `${dir === "in" ? "Debit (in)" : "Credit (out)"} ${fmt(amt)}` });
    }
    const types: [typeof txType, string][] = [["expense", "Expense"], ["sale", "Sale"], ["transfer", "Transfer"], ["entry", "Cash / Bank Entry"]];
    return shell("New Transaction", "One entry — it posts to the Cash Book, the category ledger and the account ledger together, then syncs to Google Sheets.", (
      <>
        <div className="txseg" role="radiogroup" aria-label="Transaction type">
          {types.map(([id, label]) => (
            <button key={id} type="button" role="radio" aria-checked={txType === id} className={txType === id ? "on" : ""} onClick={() => setTxType(id)}>{label}</button>
          ))}
        </div>
        <div className="field-row">
          <div className="field"><label>Date</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          <div className="field"><label>Amount</label><input type="number" min="1" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" /></div>
        </div>
        {(txType === "expense" || txType === "sale") && (
          <div className="field"><label>Category</label><select value={catValue} onChange={(e) => setCat(e.target.value)}>{catList.map((c) => <option key={c} value={c}>{c}</option>)}</select></div>
        )}
        {txType === "sale" && (
          <div className="field"><label>Customer / Agent</label><input type="text" value={party} onChange={(e) => setParty(e.target.value)} placeholder="e.g. Bin Qasim Travels" /></div>
        )}
        <div className="field"><label>Description</label><input type="text" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder={txType === "expense" ? "e.g. Tea Bill - Jam" : txType === "sale" ? "e.g. Ticket booking ref XY123" : txType === "transfer" ? "e.g. Cash Deposited" : "e.g. Online Received Danial Iqbal Travels"} /></div>
        {txType === "transfer" ? (
          <div className="field-row">
            <div className="field"><label>From</label><select value={from} onChange={(e) => setFrom(e.target.value)}>{accountOptions(accounts)}</select></div>
            <div className="field"><label>To</label><select value={to} onChange={(e) => setTo(e.target.value)}>{accountOptions(accounts)}</select></div>
          </div>
        ) : (
          <div className="field-row">
            <div className="field"><label>{txType === "expense" ? "Paid via" : txType === "sale" ? "Received via" : "Account"}</label><select value={recv} onChange={(e) => setRecv(e.target.value)}>{accountOptions(accounts)}</select></div>
            {txType === "entry" && (
              <div className="field"><label>Type</label><select value={dir} onChange={(e) => setDir(e.target.value as "in" | "out")}><option value="in">Received (In)</option><option value="out">Payment (Out)</option></select></div>
            )}
          </div>
        )}
        {txType === "sale" && (
          <div className="field-row">
            <div className="field"><label>Cost / Purchase</label><input type="number" min="0" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="0" /></div>
            <div className="field"><label>Cost paid via</label><select value={paid} onChange={(e) => setPaid(e.target.value)}><option value="">Not paid yet</option>{accountOptions(accounts)}</select></div>
          </div>
        )}
        <div className="posting" aria-live="polite">
          <h4>This one entry will post to</h4>
          {legs.map((leg) => (<div className="leg" key={leg.where + leg.what}><b>{leg.where}</b><span>{leg.what}</span></div>))}
          <div className="hint">Edit or delete it later and every one of these updates together.</div>
        </div>
      </>
    ), "Post Transaction", () => {
      const finalDesc = desc.trim();
      if (!finalDesc || amt <= 0) { toast.error("Enter a description and an amount above zero"); return; }
      const base = { entry_date: date, description: finalDesc, amount: amt, source_id: crypto.randomUUID() };
      if (txType === "expense") {
        if (!recv || !catValue) { toast.error("Choose a category and the account it was paid from"); return; }
        props.onGroup({ ...base, kind: "expense", account_id: recv, category: catValue });
      } else if (txType === "sale") {
        if (!recv || !catValue) { toast.error("Choose a category and the account that received the money"); return; }
        props.onGroup({ ...base, kind: "sale", account_id: recv, category: catValue, party: party.trim() || undefined, direct_cost: costAmt, cost_account_id: paid || undefined });
      } else if (txType === "transfer") {
        if (!from || !to || from === to) { toast.error("Choose two different accounts"); return; }
        props.onGroup({ ...base, kind: "transfer", account_id: from, to_account_id: to });
      } else {
        if (!recv) { toast.error("Choose an account"); return; }
        props.onGroup({ ...base, kind: "entry", account_id: recv, direction: dir });
      }
    });
  }

  if (kind === "cashEntry" || kind === "bankEntry") {
    const account = kind === "cashEntry" ? cash : activeBank;
    return shell(
      kind === "cashEntry" ? "Add Cash Book Entry" : "Add Bank Ledger Entry",
      kind === "cashEntry" ? "A direct entry with no other ledger effect." : `Direct entry into ${account?.name ?? "the selected account"} — for online transactions not touching cash.`,
      (
        <>
          <div className="field"><label>Date</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          <div className="field"><label>Description</label><input type="text" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="e.g. Online Received Danial Iqbal Travels" /></div>
          <div className="field-row">
            <div className="field"><label>Type</label>
              <select value={dir} onChange={(e) => setDir(e.target.value as "in" | "out")}>
                <option value="in">{kind === "cashEntry" ? "Received" : "Debit (In)"}</option>
                <option value="out">{kind === "cashEntry" ? "Payment" : "Credit (Out)"}</option>
              </select>
            </div>
            <div className="field"><label>Amount</label><input type="number" min="1" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" /></div>
          </div>
        </>
      ),
      "Save Entry",
      () => {
        if (!account) { toast.error("No account available for this entry"); return; }
        if (!desc.trim() || numeric(amount) <= 0) { toast.error("Enter a description and an amount above zero"); return; }
        props.onCash({ account_id: account.id, entry_date: date, entry_type: "manual", category: kind === "cashEntry" ? "Cash Book" : "Bank Ledger", description: desc.trim(), amount: numeric(amount), direct_cost: 0, direction: dir });
      },
    );
  }

  if (kind === "salesEntry")
    return shell("Add Sale", `Destination: Sales Accounts → ${cat || "category"}; payment → ${accounts.find((a) => a.id === recv)?.name ?? "selected account"}; cost → ${paid ? accounts.find((a) => a.id === paid)?.name ?? "selected account" : "none"}`, (
      <>
        <div className="field"><label>Category</label><select value={cat} onChange={(e) => setCat(e.target.value)}>{salesCats.map((c) => <option key={c} value={c}>{c}</option>)}</select></div>
        <div className="field-row">
          <div className="field"><label>Date</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          <div className="field"><label>Customer / Agent</label><input type="text" value={party} onChange={(e) => setParty(e.target.value)} placeholder="e.g. Bin Qasim Travels" /></div>
        </div>
        <div className="field"><label>Description</label><input type="text" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="e.g. Ticket booking ref XY123" /></div>
        <div className="field-row">
          <div className="field"><label>Sale Amount</label><input type="number" min="1" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" /></div>
          <div className="field"><label>Received via</label><select value={recv} onChange={(e) => setRecv(e.target.value)}>{accountOptions(accounts)}</select></div>
        </div>
        <div className="field-row">
          <div className="field"><label>Cost / Purchase</label><input type="number" min="0" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="0" /></div>
          <div className="field"><label>Paid via</label><select value={paid} onChange={(e) => setPaid(e.target.value)}><option value="">Not paid yet</option>{accountOptions(accounts)}</select></div>
        </div>
        <div className="hint">Profit = Sale − Cost, calculated automatically.</div>
      </>
    ), "Save Sale", () => {
      if (!desc.trim() || numeric(amount) <= 0 || !recv || !cat) { toast.error("Choose a category, received account, description and amount"); return; }
      const sourceId = crypto.randomUUID();
      props.onLinked({ entry_date: date, category: cat, party: party.trim() || undefined, description: desc.trim(), account_id: recv, amount: numeric(amount), direct_cost: numeric(cost), source_id: sourceId, source_type: "sale" });
      if (paid && numeric(cost) > 0)
        props.onExtra({ account_id: paid, entry_date: date, entry_type: "sale", category: cat, party: party.trim() || undefined, description: `${cat} cost — ${party.trim() || desc.trim()}`, amount: numeric(cost), direct_cost: 0, direction: "out", source_type: "sale", source_id: sourceId });
    });

  if (kind === "expenseEntry")
    return shell("Add Expense", `Destination: ${cat && cat.toLowerCase().includes("office") ? "Office Expenses" : "Home Expenses"} → ${cat || "category"}; payment → ${accounts.find((a) => a.id === recv)?.name ?? "selected account"}`, (
      <>
        <div className="field"><label>Category</label><select value={cat} onChange={(e) => setCat(e.target.value)}>{expenseCats.map((c) => <option key={c} value={c}>{c}</option>)}</select></div>
        <div className="field"><label>Date</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
        <div className="field"><label>Description</label><input type="text" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="e.g. Petrol Bike CG125" /></div>
        <div className="field-row">
          <div className="field"><label>Amount</label><input type="number" min="1" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" /></div>
          <div className="field"><label>Paid via</label><select value={recv} onChange={(e) => setRecv(e.target.value)}>{accountOptions(accounts)}</select></div>
        </div>
      </>
    ), "Save Expense", () => {
      if (!desc.trim() || numeric(amount) <= 0 || !recv || !cat) { toast.error("Choose a category, payment account, description and amount"); return; }
      props.onLinked({ entry_date: date, category: cat, description: desc.trim(), account_id: recv, amount: numeric(amount), direct_cost: 0, source_id: crypto.randomUUID(), source_type: "expense" });
    });

  if (kind === "editTransaction")
    return shell("Edit Transaction", "Master transaction " + (editTxn?.id ?? "") + " · " + (editTxn?.source_type ?? "manual") + " · projections will be reconciled automatically",
      (
        <>
          <div className="field-row">
            <div className="field"><label>Date</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
            <div className="field"><label>Type</label><select value={dir} disabled={editTxn?.source_type === "transfer"} onChange={(e) => setDir(e.target.value as "in" | "out")}><option value="in">Received / In</option><option value="out">Payment / Out</option></select></div>
          </div>
          <div className="field"><label>Category</label><input type="text" value={cat} onChange={(e) => setCat(e.target.value)} /></div>
          <div className="field"><label>Description</label><input type="text" value={desc} onChange={(e) => setDesc(e.target.value)} /></div>
          <div className="field-row">
            <div className="field"><label>Amount</label><input type="number" min="1" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
            <div className="field"><label>Account</label><select value={recv} disabled={editTxn?.source_type === "transfer"} onChange={(e) => setRecv(e.target.value)}>{accountOptions(accounts)}</select></div>
          </div>
          <div className="field-row">
            <div className="field"><label>Party</label><input type="text" value={party} onChange={(e) => setParty(e.target.value)} /></div>
            <div className="field"><label>Direct Cost</label><input type="number" min="0" value={cost} onChange={(e) => setCost(e.target.value)} /></div>
          </div>
          <div className="hint">This edits the master Supabase transaction. Every linked ledger projection is reconciled from that one record. Transfer account/direction are kept paired to prevent an unbalanced transfer.</div>
        </>
      ), "Save Changes", () => {
        if (!editTxn || !desc.trim() || numeric(amount) <= 0 || !recv || !cat.trim()) { toast.error("Enter a category, account, description and amount above zero"); return; }
        props.onUpdate({ id: editTxn.id, entry_date: date, entry_type: editTxn.entry_type as "sale" | "expense" | "transfer" | "manual", category: cat.trim(), party: party.trim() || undefined, description: desc.trim(), account_id: recv, amount: numeric(amount), direct_cost: numeric(cost), direction: dir, source_type: editTxn.source_type || undefined, source_id: editTxn.source_id || undefined });
      });

  if (kind === "transferEntry") {
    const fromAcc = accounts.find((a) => a.id === from);
    const toAcc = accounts.find((a) => a.id === to);
    // Only suggest the "( Self )" wording for a transfer directly between
    // two of our own banks/wallets (neither side Cash) -- a Cash deposit or
    // withdrawal isn't "self" money movement between accounts the same way.
    const defaultTransferDesc =
      fromAcc && toAcc && fromAcc.kind !== "cash" && toAcc.kind !== "cash" && fromAcc.id !== toAcc.id
        ? `Online Transfer ${fromAcc.name} to ${toAcc.name} ( Self )`
        : "";

    return shell("Transfer", "Move money between Cash and any bank or wallet account.", (
      <>
        <div className="field"><label>Date</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
        <div className="field-row">
          <div className="field">
            <label>From</label>
            <select
              value={from}
              onChange={(e) => {
                const nextFrom = e.target.value;
                setFrom(nextFrom);
                const nextFromName = accounts.find((a) => a.id === nextFrom)?.name;
                const currentToName = accounts.find((a) => a.id === to)?.name;
                if (nextFromName && currentToName && (!desc || desc.startsWith("Online Transfer ") || desc === "Cash Deposited")) {
                  setDesc(`Online Transfer ${nextFromName} to ${currentToName}`);
                }
              }}
            >
              {accountOptions(accounts)}
            </select>
          </div>
          <div className="field">
            <label>To</label>
            <select
              value={to}
              onChange={(e) => {
                const nextTo = e.target.value;
                setTo(nextTo);
                const currentFromName = accounts.find((a) => a.id === from)?.name;
                const nextToName = accounts.find((a) => a.id === nextTo)?.name;
                if (currentFromName && nextToName && (!desc || desc.startsWith("Online Transfer ") || desc === "Cash Deposited")) {
                  setDesc(`Online Transfer ${currentFromName} to ${nextToName}`);
                }
              }}
            >
              {accountOptions(accounts)}
            </select>
          </div>
        </div>
        <div className="field">
          <label>Description</label>
          <input
            type="text"
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder={defaultTransferDesc || "e.g. Online Transfer Account A to Account B"}
          />
        </div>
        <div className="field"><label>Amount</label><input type="number" min="1" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" /></div>
      </>
    ), "Save Transfer", () => {
      const finalDesc = desc.trim() || defaultTransferDesc;
      if (!finalDesc || numeric(amount) <= 0) { toast.error("Enter a description and an amount above zero"); return; }
      if (!from || !to || from === to) { toast.error("Choose two different accounts"); return; }
      props.onTransfer({ entry_date: date, category: "Transfer", description: finalDesc, from_account_id: from, to_account_id: to, amount: numeric(amount), source_id: crypto.randomUUID() });
    });
  }

  if (kind === "addBank")
    return shell(editingAccount ? "Edit Bank / Wallet Account" : "Add Bank / Wallet Account", editingAccount ? "Update account details, logo and opening balance in one place." : "Add the account and its opening balance. You can edit these details later.", (
      <>
        <div className="field"><label>Account Name</label><input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Al Baraka" /></div>
        <div className="field"><label>Type</label><select value={accountKind} onChange={(e) => setAccountKind(e.target.value as Kind)}><option value="bank">Bank</option><option value="wallet">Wallet</option></select></div>
        <div className="field"><label>Bank / Wallet Logo URL (optional)</label><input type="url" value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://example.com/logo.png" /><div className="hint">Use a public HTTPS image URL. It will appear on account cards and in the Google Sheet. Leave blank to use the official-site logo automatically when available.</div>{logoUrl.trim() && <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}><img src={logoUrl.trim()} alt="Logo preview" width={42} height={42} style={{ objectFit: "contain", borderRadius: 8 }} onError={(e) => { e.currentTarget.style.visibility = "hidden"; }} /><span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>Logo preview</span></div>}</div>
        <div className="field-row"><div className="field"><label>Opening Balance</label><input type="number" value={opening} onChange={(e) => setOpening(e.target.value)} /></div><div className="field"><label>Opening Balance Date</label><input type="date" value={openingDate} onChange={(e) => setOpeningDate(e.target.value)} /></div></div>
      </>
    ), editingAccount ? "Save Changes" : "Add Account", () => {
      if (!name.trim()) { toast.error("Enter an account name"); return; }
      if (logoUrl.trim() && !/^https:\/\//i.test(logoUrl.trim())) { toast.error("Logo URL must start with https://"); return; }
      const payload = { name: name.trim(), kind: accountKind as "bank" | "wallet", opening_balance: numeric(opening), opening_balance_date: openingDate, logo_url: logoUrl.trim() || null };
      if (editingAccount) props.onUpdateAccount({ ...payload, id: editingAccount.id });
      else props.onAccount(payload);
    });

  const categoryTitle = kind === "addSalesCat" ? "Add Sales Category" : "Add Expense Category";
  return shell(categoryTitle, null, (
    <div className="field"><label>Category Name</label><input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder={kind === "addSalesCat" ? "e.g. Hajj Packages" : "e.g. Travel & Fuel"} /></div>
  ), "Add Category", () => {
    if (!name.trim()) { toast.error("Enter a category name"); return; }
    props.onCategory(kind === "addSalesCat" ? name.trim() : `${EXPENSE_PREFIX}${name.trim()}`);
  });
}
