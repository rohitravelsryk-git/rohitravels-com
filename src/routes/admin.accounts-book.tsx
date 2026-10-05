import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Home, LogOut, Menu, Wallet, X } from "lucide-react";
import { adminLogout, verifyAdminPassword } from "@/lib/fares.functions";
import { AdminHeaderExtras } from "@/components/AdminHeaderExtras";import { AdminTabs } from "@/components/AdminTabs";
import { downloadExcel, downloadPdf } from "@/lib/table-export";
import {
  createAccountsBookAccount,
  createAccountsBookLinkedEntry,
  createAccountsBookService,
  createAccountsBookTransaction,
  createAccountsBookTransfer,
  deleteAccountsBookAccount,
  deleteAccountsBookService,
  deleteAccountsBookTransaction,
  listAccountsBook,
  updateAccountsBookTransaction,
  syncAccountsBookTransactionsToSheets,
  reconcileBanksWalletsToSheets,
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
type Account = { id: string; name: string; kind: Kind; opening_balance: number; opening_balance_date?: string | null };
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
type TabId = "dashboard" | "cashbook" | "bank" | "sales" | "expenses" | "reports" | "settings";

const EXPENSE_PREFIX = "EXP: ";
const DEFAULT_SALES_CATS = ["Counter Sales", "Visa Processing", "Group Tickets", "Umrah", "Insurance", "Protect", "Appointments", "Refunds"];
const DEFAULT_EXPENSE_CATS = ["Home Expense", "Office Expense"];

const TAB_GROUPS: { header: string | null; tabs: { id: TabId; label: string }[] }[] = [
  { header: null, tabs: [{ id: "dashboard", label: "Dashboard" }] },
  { header: "Cash & Bank", tabs: [{ id: "cashbook", label: "Daily Cash Book" }, { id: "bank", label: "Banks & Wallets" }] },
  { header: "Business Accounts", tabs: [{ id: "sales", label: "Sales Accounts" }, { id: "expenses", label: "Expenses" }] },
  { header: "Analysis", tabs: [{ id: "reports", label: "Reports (P&L)" }] },
  { header: null, tabs: [{ id: "settings", label: "Settings" }] },
];

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
.rohi-ab .settings-section{margin-top:0;padding-top:18px;border-top:0;}
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
      <p>Deleting <strong>{guard.label}</strong> is a protected action. Enter the admin password to continue.</p>
      <input autoFocus type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Admin password" />
      {error && <p className="protected-delete-error">{error}</p>}
      <div className="protected-delete-actions"><button type="button" className="btn small ghost" onClick={close}>Cancel</button><button type="submit" className="btn small" disabled={busy || !password}>{busy ? "Checking…" : "Delete"}</button></div>
    </form>
  </div>;
}

function AccountsBookClone() {
  const router = useRouter();
  const logoutFn = useServerFn(adminLogout);
  async function onLogout() {
    await logoutFn();
    router.navigate({ to: "/admin" });
  }
  const queryClient = useQueryClient();
  const load = useServerFn(listAccountsBook);
  const addAccountFn = useServerFn(createAccountsBookAccount);
  const openingFn = useServerFn(updateAccountsBookOpening);
  const txnFn = useServerFn(createAccountsBookTransaction);
  const updateTxnFn = useServerFn(updateAccountsBookTransaction);
  const linkedFn = useServerFn(createAccountsBookLinkedEntry);
  const transferFn = useServerFn(createAccountsBookTransfer);
  const deleteTxnFn = useServerFn(deleteAccountsBookTransaction);
  const syncSheetsFn = useServerFn(syncAccountsBookTransactionsToSheets);
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
  const [bankSel, setBankSel] = useState<string | null>(null);
  const [salesSel, setSalesSel] = useState<string | null>(null);
  const [expSel, setExpSel] = useState<string | null>(null);
  const [settingsTab, setSettingsTab] = useState<"banks" | "cashbook" | "sales" | "expenses">("banks");
  const [deleteGuard, setDeleteGuard] = useState<{ kind: "account" | "category"; id: string; label: string } | null>(null);
  const [editingTxn, setEditingTxn] = useState<Txn | null>(null);

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
  const activeSalesCat = salesCats.includes(salesSel ?? "") ? (salesSel as string) : salesCats[0] ?? null;
  const activeExpCat = expenseCats.includes(expSel ?? "") ? (expSel as string) : expenseCats[0] ?? null;

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["accounts-book"] });

  const fail = (e: unknown) => toast.error(e instanceof Error ? e.message : "Something went wrong");
  const mutate = <T,>(fn: (payload: T) => Promise<unknown>, message: string, _unused?: unknown, afterSuccess?: () => void) =>
    useMutationFactory(fn, message, refresh, fail, afterSuccess);

  const saveOpening = mutate((payload: { id: string; opening_balance: number; opening_balance_date: string }) => openingFn({ data: payload }), "Opening balance saved");
  const triggerSheetSync = () => {
    void syncSheetsFn({ data: {} }).then((result) => {
      if (result.status === "success") {
        const sheets = result.sheets ? ": " + result.sheets : "";
        toast.success("Google Sheets synchronized" + sheets);
      } else {
        const detail = result.failures?.filter(Boolean).join(" | ") || "Sync will remain queued for retry.";
        toast.warning("Saved to Supabase, but Google Sheets sync needs attention — " + detail);
      }
      refresh();
    }).catch((error) => {
      toast.warning("Saved to Supabase. Google Sheets sync is queued — " + (error instanceof Error ? error.message : String(error)));
    });
  };
  const reconcileBanksWallets = () => {
    void reconcileBanksWalletsFn({ data: {} }).then((result) => {
      if (result.status === "success") {
        toast.success("Banks & Wallets reconciled from Supabase.");
      } else {
        toast.warning("Banks & Wallets reconciliation completed with issues.");
      }
      refresh();
    }).catch((error) => {
      toast.error("Banks & Wallets reconciliation failed: " + (error instanceof Error ? error.message : String(error)));
    });
  };

  // New account (bank/wallet/cash) won't show in its Google Sheet until the next sync —
  // reconcileBanksWallets only touches bank/wallet rows, so it's a safe no-op for cash.
  const addAccount = mutate((payload: { name: string; kind: Kind; opening_balance: number; opening_balance_date?: string }) => addAccountFn({ data: payload }), "Account added", undefined, reconcileBanksWallets);

  const addTxn = mutate((payload: Record<string, unknown>) => txnFn({ data: payload as never }), "Entry posted", undefined, triggerSheetSync);
  const updateTxn = mutate((payload: Record<string, unknown>) => updateTxnFn({ data: payload as never }), "Entry updated", undefined, triggerSheetSync);
  const addLinked = mutate((payload: Record<string, unknown>) => linkedFn({ data: payload as never }), "Entry posted to the ledgers", undefined, triggerSheetSync);
  const addTransfer = mutate((payload: Record<string, unknown>) => transferFn({ data: payload as never }), "Transfer posted to both ledgers", undefined, triggerSheetSync);

  const removeTxn = mutate((id: string) => deleteTxnFn({ data: id }), "Entry deleted", undefined, triggerSheetSync);
  const removeAccount = mutate((payload: { id: string; password: string }) => deleteAccountFn({ data: payload }), "Account removed");
  const addService = mutate((payload: { name: string }) => addServiceFn({ data: payload }), "Category added");
  const removeService = mutate((payload: { id: string; password: string }) => deleteServiceFn({ data: payload }), "Category removed");

  const busy = addTxn.isPending || addLinked.isPending || addTransfer.isPending || addAccount.isPending;

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

  let tabNumber = 0;

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
            {TAB_GROUPS.map((group, index) => (
              <div className="tab-group" key={group.header ?? `g${index}`}>
                {group.header && <div className="tab-group-label">{group.header}</div>}
                {group.tabs.map((item) => {
                  tabNumber += 1;
                  const num = String(tabNumber).padStart(2, "0");
                  return (
                    <button key={item.id} type="button" className={`tab-btn ${tab === item.id ? "active" : ""}`} onClick={() => { setTab(item.id); setMobileNavOpen(false); }}>
                      <span className="num">{num}</span>
                      <span className="label">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            ))}
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
                <button type="button" className="btn" onClick={() => setModal("quickadd")}>+ New Transaction</button>
              </div>
              <div className="cards">
                <Card label="Cash in Hand" value={cashBalance} tone={cashBalance >= 0 ? "pos" : "neg"} foot="Live Cash Book balance" />
                <Card label="Total in Banks & Wallets" value={bankTotal} tone="pos" foot={`${banks.length} accounts`} />
                <Card label="This Month Sales" value={thisMonth.totalSale} foot={monthLabel(monthKey(todayISO()))} />
                <Card label="This Month Profit" value={thisMonth.netProfit} tone={thisMonth.netProfit >= 0 ? "pos" : "neg"} foot="After cost & expenses" />
              </div>
              <Panel title="Recent Cash Book Activity">
                <table>
                  <thead><tr><th>Date</th><th>Description</th><th className="num">Received</th><th className="num">Payment</th><th>Type</th></tr></thead>
                  <tbody>
                    {byDate(cashbookRows).slice(-5).reverse().map((row) => (
                      <tr key={row.id}>
                        <td>{formatDateShort(row.entry_date)}</td>
                        <td>{row.description}</td>
                        <td className="num in-amt">{row.direction === "in" ? `Rs ${fmt(row.amount)}` : ""}</td>
                        <td className="num out-amt">{row.direction === "out" ? `Rs ${fmt(row.amount)}` : ""}</td>
                        <td>{sourceBadge(row)}</td>
                      </tr>
                    ))}
                    {cashbookRows.length === 0 && <tr className="empty-row"><td colSpan={5}>No cash/bank/wallet entries yet — post one from the button above.</td></tr>}
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
              onAdd={() => setModal("cashEntry")}
              onEdit={editTransaction}
            />
          )}

          {tab === "bank" && (
            <>
              <div className="page-head">
                <div><h2>Banks &amp; Wallets</h2><p>Each account keeps its own running ledger, linked from Sales, Expenses and Cash transfers</p></div>
                <button type="button" className="btn" onClick={() => setModal("bankEntry")} disabled={!activeBank}>+ Add Ledger Entry</button>
              </div>
              <DraggablePills
                items={banks.map((bank) => ({ id: bank.id, label: bank.name }))}
                activeId={activeBank?.id}
                onSelect={setBankSel}
                storageKey="accounts-book-pills-banks-wallets"
                onReorder={(ids) => reorderAccountsFn({ data: { ids } }).catch(() => refresh())}
                hideReset
              />
              <div className="pillbar"><button type="button" className="pill add" onClick={() => setModal("addBank")}>+ Add Account</button></div>
              {activeBank ? (
                <>
                  <div className="cards">
                    <Card label={`${activeBank.name} — Opening`} value={activeBank.opening_balance} />
                    <Card label="Total Debit (Out)" value={txns.filter((t) => t.account_id === activeBank.id && t.direction === "out").reduce((a, r) => a + Number(r.amount), 0)} tone="pos" />
                    <Card label="Total Credit (In)" value={txns.filter((t) => t.account_id === activeBank.id && t.direction === "in").reduce((a, r) => a + Number(r.amount), 0)} tone="neg" />
                    <Card label="Current Balance" value={finalBalance(txns.filter((t) => t.account_id === activeBank.id), activeBank.opening_balance)} tone="pos" />
                  </div>
                  <Panel title={`${activeBank.name} Ledger`}>
                    <LedgerTable rows={withRunning(txns.filter((t) => t.account_id === activeBank.id), activeBank.opening_balance)} inLabel="Debit" outLabel="Credit" onDelete={deleteGroup} onEdit={editTransaction} badge={sourceBadge} />
                  </Panel>
                </>
              ) : (
                <Panel title="No accounts yet"><p style={{ fontSize: 13 }}>Add your first bank or wallet account to get started.</p></Panel>
              )}
            </>
          )}

          {tab === "sales" && (
            <>
              <div className="page-head">
                <div><h2>Sales Accounts</h2><p>Booking sales by category — profit calculates automatically from sale minus cost</p></div>
                <button type="button" className="btn" onClick={() => setModal("salesEntry")}>+ Add Sale</button>
              </div>
              <DraggablePills
                items={salesCatRows.map((row) => ({ id: row.id ?? `default-${row.name}`, label: row.name }))}
                activeId={activeSalesCat}
                onSelect={setSalesSel}
                storageKey="accounts-book-pills-sales"
                onReorder={(ids) => {
                  const real = ids.filter((id) => salesCatRows.some((r) => r.id === id));
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
                <button type="button" className="btn" onClick={() => setModal("expenseEntry")}>+ Add Expense</button>
              </div>
              <DraggablePills
                items={expenseCatRows.map((row) => ({ id: row.id ?? `default-${row.name}`, label: row.name }))}
                activeId={activeExpCat}
                onSelect={setExpSel}
                storageKey="accounts-book-pills-expenses"
                onReorder={(ids) => {
                  const real = ids.filter((id) => expenseCatRows.some((r) => r.id === id));
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
                              <td><button type="button" className="icon-btn" onClick={() => deleteGroup(row)}>Delete</button></td>
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
              <Panel title="Bank & Wallet Snapshot">
                <table>
                  <thead><tr><th>Account</th><th className="num">Opening</th><th className="num">Current Balance</th></tr></thead>
                  <tbody>
                    {banks.map((bank) => (
                      <tr key={bank.id}>
                        <td>{bank.name}</td>
                        <td className="num">{fmt(bank.opening_balance)}</td>
                        <td className="num" style={{ fontWeight: 600 }}>{fmt(finalBalance(txns.filter((t) => t.account_id === bank.id), bank.opening_balance))}</td>
                      </tr>
                    ))}
                    <tr className="month-strong"><td>Cash in Hand</td><td className="num">{fmt(cash?.opening_balance ?? 0)}</td><td className="num">{fmt(cashBalance)}</td></tr>
                  </tbody>
                </table>
              </Panel>
            </>
          )}

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
                      <h3>Banks & Wallets</h3>
                      <span className="settings-note">Account settings · Supabase → Banks & Wallets only</span>
                    </div>
                    <button type="button" className="btn small" onClick={reconcileBanksWallets}>Reconcile Banks & Wallets</button>
                  </div>
                  <table>
                    <thead><tr><th>Account</th><th>Type</th><th className="num">Opening Balance</th><th>Opening Date</th><th /></tr></thead>
                    <tbody>
                      {accounts.map((account) => (
                        <tr key={account.id}>
                          <td>{account.name}</td><td style={{ textTransform: "uppercase", fontSize: 11 }}>{account.kind}</td>
                          <td className="num"><input className="opening-input" type="number" defaultValue={account.opening_balance} onBlur={(event) => { const next = Number(event.target.value) || 0; if (next !== Number(account.opening_balance)) saveOpening.mutate({ id: account.id, opening_balance: next, opening_balance_date: account.opening_balance_date ?? todayISO() }); }} /></td>
                          <td><input className="opening-input" type="date" value={account.opening_balance_date ?? todayISO()} onChange={(event) => saveOpening.mutate({ id: account.id, opening_balance: Number(account.opening_balance) || 0, opening_balance_date: event.target.value })} /></td>
                          <td>{account.kind !== "cash" && <button type="button" className="icon-btn" onClick={() => setDeleteGuard({ kind: "account", id: account.id, label: account.name })}>Remove</button>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <button type="button" className="btn small ghost" style={{ marginTop: 10 }} onClick={() => setModal("addBank")}>+ Add Account</button>
                </section>
              )}

              {settingsTab === "cashbook" && (
                <section className="settings-section">
                  <div className="settings-section-head"><h3>Daily Cash Book</h3><span className="settings-note">Cash account settings</span></div>
                  {cash ? (
                    <table>
                      <thead><tr><th>Cash Account</th><th className="num">Opening Balance</th><th>Opening Date</th></tr></thead>
                      <tbody>
                        <tr>
                          <td>{cash.name}</td>
                          <td className="num"><input className="opening-input" type="number" defaultValue={cash.opening_balance} onBlur={(event) => { const next = Number(event.target.value) || 0; if (next !== Number(cash.opening_balance)) saveOpening.mutate({ id: cash.id, opening_balance: next, opening_balance_date: cash.opening_balance_date ?? todayISO() }); }} /></td>
                          <td><input className="opening-input" type="date" value={cash.opening_balance_date ?? todayISO()} onChange={(event) => saveOpening.mutate({ id: cash.id, opening_balance: Number(cash.opening_balance) || 0, opening_balance_date: event.target.value })} /></td>
                        </tr>
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
                  <div className="settings-section-head"><h3>Expenses</h3><span className="settings-note">Expense category settings</span></div>
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
          key={modal}
          kind={modal}
          close={() => setModal(null)}
          open={setModal}
          busy={busy}
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
          onAccount={(payload) => addAccount.mutate(payload, { onSuccess: () => setModal(null) })}
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

function CashBookReplacement({ rows, opening, accounts, onAdd, onEdit }: { rows: Txn[]; opening: number; accounts: Account[]; onAdd: () => void; onEdit: (row: Txn) => void }) {
  const [month, setMonth] = useState(todayISO().slice(0, 7));
  const [day, setDay] = useState(todayISO());
  const [search, setSearch] = useState("");
  const [counts, setCounts] = useState<Record<number, number>>({});
  const DENOMS = [10, 20, 50, 100, 500, 1000, 5000];

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
  const countedCash = DENOMS.reduce((total, denomination) => total + denomination * (counts[denomination] || 0), 0);
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
          <button type="button" className="btn" onClick={onAdd}>+ Add transaction</button>
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
            <button type="button" className="btn small" onClick={onAdd}>+ Entry</button>
          </div>
        </div>
        <div className="cashbook-table-wrap">
          <table className="cashbook-table">
            <thead><tr><th>#</th><th>Account</th><th>Description</th><th className="num">Received</th><th className="num">Payment</th><th className="num">Account Balance</th><th /></tr></thead>
            <tbody>
              <tr><td>—</td><td colSpan={2}><strong>Opening balances are shown per account in the ledger below.</strong></td><td /><td /><td /><td /></tr>
              {dayRows.map((t, i) => (
                <tr key={t.id}>
                  <td>{i + 1}</td><td>{accountMap.get(t.account_id)?.name ?? "—"}</td><td>{t.description}</td>
                  <td className="num in-amt">{t.direction === "in" ? fmt(t.amount) : "—"}</td>
                  <td className="num out-amt">{t.direction === "out" ? fmt(t.amount) : "—"}</td>
                  <td className="num"><strong>{fmt(t.balance)}</strong></td>
                  <td><button type="button" className="icon-btn" onClick={() => onEdit(t)}>Edit</button></td>
                </tr>
              ))}
              {dayRows.length === 0 && <tr className="empty-row"><td colSpan={7}>No entries for this day.</td></tr>}
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

        <section className="cashbook-panel">
          <h3>Cash count</h3><div className="sub" style={{ display: "block", marginBottom: 12 }}>Count notes currently in hand</div>
          <div className="cashbook-denoms">
            {DENOMS.map((denomination) => (
              <label key={denomination} className="cashbook-denom">
                <span>Rs {fmt(denomination)}</span>
                <input type="number" min={0} value={counts[denomination] || ""} onChange={(e) => setCounts({ ...counts, [denomination]: Number(e.target.value) || 0 })} />
              </label>
            ))}
            <div className="cashbook-cash-total"><span>Cash in hand</span><span>Rs {fmt(countedCash)}</span></div>
            <div style={{ gridColumn: "1/-1", fontSize: 11, color: countedCash === available ? "var(--teal-dark)" : "var(--ink-soft)" }}>
              Difference vs book: Rs {fmt(countedCash - available)}
            </div>
          </div>
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
  /** Called once, with the full new id order, when a drag finishes having
   * actually moved something -- lets a caller persist the order server-side
   * instead of (or in addition to) the local-only storageKey copy. */
  onReorder?: (ids: string[]) => void;
  /** Hides the "Reset order" button for this pill bar. */
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
      if (Array.isArray(saved)) {
        const ids = saved.filter((id): id is string => typeof id === "string");
        setOrder(ids);
        orderRef.current = ids;
      }
    } catch {
      setOrder([]);
      orderRef.current = [];
    }
  }, [storageKey]);

  const ordered = useMemo(() => {
    const position = new Map(order.map((id, index) => [id, index]));
    return [...items].sort(
      (a, b) =>
        (position.get(a.id) ?? Number.MAX_SAFE_INTEGER) -
        (position.get(b.id) ?? Number.MAX_SAFE_INTEGER),
    );
  }, [items, order]);

  const resetOrder = () => {
    try {
      localStorage.removeItem(storageKey);
    } catch {}
    setOrder([]);
    orderRef.current = [];
  };

  useEffect(() => {
    if (!draggedId) return;

    const handleMove = (event: PointerEvent) => {
      if ((event.buttons & 1) !== 1) return;

      const target = document
        .elementFromPoint(event.clientX, event.clientY)
        ?.closest<HTMLElement>("[data-rohi-pill-id]");
      const toId = target?.dataset.rohiPillId;
      const fromId = draggedRef.current;
      if (!fromId || !toId || fromId === toId) return;

      // Use consistent current order to avoid jumping
      const effective = ordered.map((item) => item.id);
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
      try {
        localStorage.setItem(storageKey, JSON.stringify(effective));
      } catch {}
    };

    const handleUp = () => {
      draggedRef.current = null;
      setDraggedId(null);
      if (movedRef.current) onReorder?.(orderRef.current);
    };

    window.addEventListener("pointermove", handleMove, { passive: true });
    window.addEventListener("pointerup", handleUp);
    window.addEventListener("pointercancel", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("pointercancel", handleUp);
    };
  }, [draggedId, items, storageKey, onReorder]);

  return (
    <div className="pillbar">
      {ordered.map((item) => {
        const content = (
          <>
            {item.label}
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
                onPointerDown={(event) => event.stopPropagation()}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    event.stopPropagation();
                    onDelete(item.id);
                  }
                }}
              >
                ✕
              </span>
            )}
          </>
        );

        const startDrag = (event: React.PointerEvent<HTMLElement>) => {
          if (event.button !== 0) return;
          draggedRef.current = item.id;
          movedRef.current = false;
          setDraggedId(item.id);
          event.currentTarget.setPointerCapture?.(event.pointerId);
        };

        const endDrag = (event: React.PointerEvent<HTMLElement>) => {
          event.currentTarget.releasePointerCapture?.(event.pointerId);
          draggedRef.current = null;
          setDraggedId(null);
        };

        const common = {
          title: "Drag to reorder",
          "data-rohi-pill-id": item.id,
          onPointerDown: startDrag,
          onPointerUp: endDrag,
          style: {
            cursor: draggedId === item.id ? "grabbing" : "grab",
            userSelect: "none" as const,
            touchAction: "none" as const,
          },
        };

        return onSelect ? (
          <button
            key={item.id}
            type="button"
            className={"pill " + (activeId === item.id ? "active" : "")}
            onClick={() => {
              if (!movedRef.current) onSelect(item.id);
              movedRef.current = false;
            }}
            {...common}
          >
            {content}
          </button>
        ) : (
          <span key={item.id} className="pill" {...common}>
            {content}
          </span>
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

function Panel({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="ledger">
      <div className="ledger-inner">
        <h3>{title}{sub && <span className="sub">{sub}</span>}</h3>
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
  onAccount: (payload: { name: string; kind: Kind; opening_balance: number; opening_balance_date?: string }) => void;
  onCategory: (name: string) => void;
  editTxn: Txn | null;
  onUpdate: (payload: Record<string, unknown>) => void;
}) {
  const { kind, close, open, busy, cash, banks, accounts, activeBank, salesCats, expenseCats, activeSalesCat, activeExpCat, editTxn } = props;
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
  const [name, setName] = useState("");
  const [accountKind, setAccountKind] = useState<Kind>("bank");
  const [opening, setOpening] = useState("0");
  const [openingDate, setOpeningDate] = useState(todayISO());

  useEffect(() => {
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
  }, [kind, editTxn, from, to, accounts]);

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

  if (kind === "quickadd")
    return shell("New Transaction", "Choose what this is for — it'll post to the right ledgers automatically.", (
      <>
        <div className="field-row" style={{ marginBottom: 10 }}>
          <button type="button" className="btn" onClick={() => open("salesEntry")}>Sales Accounts</button>
          <button type="button" className="btn ghost" onClick={() => open("expenseEntry")}>Expenses</button>
        </div>
        <div className="field-row">
          <button type="button" className="btn ghost" onClick={() => open("transferEntry")}>Cash ⇄ Bank / Wallet</button>
          <button type="button" className="btn ghost" onClick={() => open("cashEntry")}>Daily Cash Book</button>
        </div>
      </>
    ));

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
    const fromName = accounts.find((a) => a.id === from)?.name;
    const toName = accounts.find((a) => a.id === to)?.name;
    const defaultTransferDesc = fromName && toName ? `Online Transfer ${fromName} to ${toName}` : "";

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
    return shell("Add Bank / Wallet Account", null, (
      <>
        <div className="field"><label>Account Name</label><input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Al Baraka" /></div>
        <div className="field"><label>Type</label><select value={accountKind} onChange={(e) => setAccountKind(e.target.value as Kind)}><option value="bank">Bank</option><option value="wallet">Wallet</option></select></div>
        <div className="field-row"><div className="field"><label>Opening Balance</label><input type="number" value={opening} onChange={(e) => setOpening(e.target.value)} /></div><div className="field"><label>Opening Balance Date</label><input type="date" value={openingDate} onChange={(e) => setOpeningDate(e.target.value)} /></div></div>
      </>
    ), "Add Account", () => {
      if (!name.trim()) { toast.error("Enter an account name"); return; }
      props.onAccount({ name: name.trim(), kind: accountKind, opening_balance: numeric(opening), opening_balance_date: openingDate });
    });

  const categoryTitle = kind === "addSalesCat" ? "Add Sales Category" : "Add Expense Category";
  return shell(categoryTitle, null, (
    <div className="field"><label>Category Name</label><input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder={kind === "addSalesCat" ? "e.g. Hajj Packages" : "e.g. Travel & Fuel"} /></div>
  ), "Add Category", () => {
    if (!name.trim()) { toast.error("Enter a category name"); return; }
    props.onCategory(kind === "addSalesCat" ? name.trim() : `${EXPENSE_PREFIX}${name.trim()}`);
  });
}
