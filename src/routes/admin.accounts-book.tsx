import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AdminTabs } from "@/components/AdminTabs";
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
  updateAccountsBookOpening,
} from "@/lib/accounts-book.functions";

export const Route = createFileRoute("/admin/accounts-book")({
  head: () => ({
    meta: [{ title: "Accounts Book — Rohi Admin" }],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600;9..144,700&family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap",
      },
    ],
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
const DEFAULT_EXPENSE_CATS = ["Personal Expense", "Office Expense"];

const TAB_GROUPS: { header: string | null; tabs: { id: TabId; label: string }[] }[] = [
  { header: null, tabs: [{ id: "dashboard", label: "Dashboard" }] },
  { header: "Cash & Bank", tabs: [{ id: "cashbook", label: "Cash Book" }, { id: "bank", label: "Bank & Wallet Accounts" }] },
  { header: "Business Accounts", tabs: [{ id: "sales", label: "Sales Accounts" }, { id: "expenses", label: "Expenses" }] },
  { header: "Analysis", tabs: [{ id: "reports", label: "Reports (P&L)" }] },
  { header: null, tabs: [{ id: "settings", label: "Settings" }] },
];

/* ============================= HELPERS ============================= */
const fmt = (n: unknown) => (Number(n) || 0).toLocaleString("en-PK", { maximumFractionDigits: 0 });
const todayISO = () => new Date().toISOString().slice(0, 10);
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
.rohi-ab{--ink:#211B15;--ink-2:#2C251D;--paper:#F8F3E6;--line:#DCD0AF;--brass:#C17F45;--brass-dark:#9C6530;--teal:#4B7F5E;--teal-dark:#35604A;--crimson:#A2453B;--crimson-dark:#7E332B;--ink-soft:#6B5F4E;--cream:#F1EAD9;--cream-dim:#C9BFA9;--shadow:0 8px 24px rgba(33,27,21,.16);--radius:12px;--ease:cubic-bezier(0.16,1,0.3,1);
font-family:'IBM Plex Sans',sans-serif;background:var(--ink);color:var(--cream);min-height:100vh;}
.rohi-ab h2,.rohi-ab h3{font-family:'Fraunces',serif;}
.rohi-ab .mono{font-family:'IBM Plex Mono',monospace;font-variant-numeric:tabular-nums;}
.rohi-ab .shell{display:flex;min-height:100vh;}
.rohi-ab .side{width:230px;flex:0 0 230px;background:var(--ink-2);position:relative;display:flex;flex-direction:column;border-right:1px solid rgba(241,234,217,.06);}
.rohi-ab .side::before{content:"";position:absolute;left:14px;top:0;bottom:0;border-left:2px dashed rgba(241,234,217,.14);}
.rohi-ab .brand{padding:26px 22px 18px 30px;}
.rohi-ab .brand .eyebrow{font-size:10.5px;letter-spacing:.18em;text-transform:uppercase;color:var(--brass);font-weight:600;}
.rohi-ab .brand h1{font-family:'Fraunces',serif;font-size:20px;line-height:1.25;margin:6px 0 0;font-weight:600;color:var(--cream);}
.rohi-ab .tabs{display:flex;flex-direction:column;margin-top:6px;padding-left:6px;}
.rohi-ab .tab-btn{all:unset;cursor:pointer;padding:12px 22px 12px 30px;font-size:14.5px;font-weight:500;color:var(--cream-dim);border-left:3px solid transparent;display:flex;align-items:center;gap:10px;transition:color .22s var(--ease),background-color .22s var(--ease),border-color .22s var(--ease);}
.rohi-ab .tab-btn .num{font-family:'IBM Plex Mono',monospace;font-size:11px;color:rgba(241,234,217,.35);width:16px;}
.rohi-ab .tab-btn:hover{color:var(--cream);background:rgba(241,234,217,.04);}
.rohi-ab .tab-btn.active{color:var(--cream);border-left-color:var(--brass);background:rgba(193,127,69,.10);}
.rohi-ab .tab-btn.active .num{color:var(--brass);}
.rohi-ab .tab-group + .tab-group{margin-top:8px;padding-top:12px;border-top:1px solid rgba(241,234,217,.08);}
.rohi-ab .tab-group-label{padding:0 22px 6px 30px;font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:rgba(241,234,217,.38);font-weight:600;}
.rohi-ab .side-foot{margin-top:auto;padding:18px 22px 22px 30px;font-size:11px;color:rgba(241,234,217,.32);line-height:1.6;}
.rohi-ab .save-dot{display:inline-block;width:6px;height:6px;border-radius:50%;background:var(--teal);margin-right:6px;vertical-align:middle;}
.rohi-ab .main{flex:1;padding:30px 38px 60px;max-width:1180px;}
.rohi-ab .page-head{display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:22px;flex-wrap:wrap;gap:12px;}
.rohi-ab .page-head h2{font-size:26px;margin:0;color:var(--cream);font-weight:600;}
.rohi-ab .page-head p{margin:4px 0 0;color:var(--cream-dim);font-size:13px;}
.rohi-ab .btn{all:unset;cursor:pointer;font-weight:600;font-size:13px;padding:10px 16px;border-radius:8px;background:var(--brass);color:var(--ink);text-align:center;transition:background-color .22s var(--ease),transform .14s var(--ease);}
.rohi-ab .btn:hover{background:var(--brass-dark);}
.rohi-ab .btn:active{transform:scale(0.98);}
.rohi-ab .btn.ghost{background:transparent;border:1px solid rgba(241,234,217,.28);color:var(--cream);}
.rohi-ab .btn.ghost:hover{background:rgba(241,234,217,.08);}
.rohi-ab .btn.small{padding:7px 11px;font-size:12px;}
.rohi-ab .modal .btn.ghost{color:var(--ink);border-color:var(--line);}
.rohi-ab .ledger{background:var(--paper);color:var(--ink);border-radius:var(--radius);box-shadow:var(--shadow);position:relative;overflow:hidden;margin-bottom:22px;}
.rohi-ab .ledger::before{content:"";position:absolute;top:0;bottom:0;left:52px;width:1px;background:rgba(162,69,59,.35);}
.rohi-ab .ledger-inner{padding:20px 24px 22px 68px;}
.rohi-ab .ledger h3{font-size:15px;margin:0 0 14px;color:var(--ink);font-weight:600;}
.rohi-ab .ledger h3 .sub{font-weight:400;color:var(--ink-soft);font-size:12.5px;margin-left:8px;}
.rohi-ab .cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:14px;margin-bottom:22px;}
.rohi-ab .card{background:var(--paper);color:var(--ink);border-radius:var(--radius);padding:16px 18px;box-shadow:var(--shadow);transition:transform .22s var(--ease),box-shadow .22s var(--ease);}
.rohi-ab .card:hover{transform:translateY(-2px);box-shadow:0 14px 32px rgba(33,27,21,.20);}
.rohi-ab .card .label{font-size:11px;text-transform:uppercase;letter-spacing:.09em;color:var(--ink-soft);font-weight:600;}
.rohi-ab .card .value{font-family:'IBM Plex Mono',monospace;font-size:23px;font-weight:600;margin-top:6px;}
.rohi-ab .card .value.pos{color:var(--teal-dark);}
.rohi-ab .card .value.neg{color:var(--crimson-dark);}
.rohi-ab .card .foot{font-size:11.5px;color:var(--ink-soft);margin-top:4px;}
.rohi-ab table{width:100%;border-collapse:collapse;font-size:13px;}
.rohi-ab thead th{text-align:left;font-size:10.5px;text-transform:uppercase;letter-spacing:.07em;color:var(--ink-soft);padding:6px 10px;border-bottom:1.5px solid var(--line);font-weight:600;white-space:nowrap;}
.rohi-ab tbody td{padding:8px 10px;border-bottom:1px solid var(--line);vertical-align:top;}
.rohi-ab tbody tr{transition:background-color .18s var(--ease);}
.rohi-ab tbody tr:hover{background:rgba(193,127,69,.07);}
.rohi-ab td.num,.rohi-ab th.num{text-align:right;font-family:'IBM Plex Mono',monospace;}
.rohi-ab .in-amt{color:var(--teal-dark);font-family:'IBM Plex Mono',monospace;}
.rohi-ab .out-amt{color:var(--crimson-dark);font-family:'IBM Plex Mono',monospace;}
.rohi-ab .badge{font-size:10px;font-weight:600;padding:2px 7px;border-radius:20px;text-transform:uppercase;letter-spacing:.04em;display:inline-block;}
.rohi-ab .badge.link{background:rgba(75,127,94,.14);color:var(--teal-dark);}
.rohi-ab .badge.manual{background:rgba(107,95,78,.10);color:var(--ink-soft);}
.rohi-ab .icon-btn{all:unset;cursor:pointer;color:var(--ink-soft);font-size:12px;padding:3px 7px;border-radius:6px;transition:background-color .18s var(--ease),color .18s var(--ease);}
.rohi-ab .icon-btn:hover{background:rgba(162,69,59,.10);color:var(--crimson-dark);}
.rohi-ab .empty-row td{text-align:center;color:var(--ink-soft);font-style:italic;padding:20px;}
.rohi-ab .pillbar{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px;align-items:center;}
.rohi-ab .pill{all:unset;cursor:pointer;font-size:12.5px;font-weight:600;padding:7px 14px;border-radius:20px;background:var(--ink-2);color:var(--cream-dim);border:1px solid rgba(241,234,217,.14);transition:background-color .2s var(--ease),color .2s var(--ease),border-color .2s var(--ease);}
.rohi-ab .pill.active{background:var(--brass);color:var(--ink);border-color:var(--brass);}
.rohi-ab .pill.add{background:transparent;border:1px dashed rgba(241,234,217,.3);color:var(--cream-dim);}
.rohi-ab .ledger .pill{background:rgba(33,27,21,.06);color:var(--ink);border-color:var(--line);}
.rohi-ab .overlay{position:fixed;inset:0;background:rgba(33,27,21,.6);display:flex;align-items:center;justify-content:center;z-index:60;padding:20px;animation:rohiAbFadeIn .18s var(--ease);}
.rohi-ab .modal{background:var(--paper);color:var(--ink);width:100%;max-width:460px;border-radius:16px;padding:24px 26px 22px;box-shadow:0 24px 60px rgba(0,0,0,.35);max-height:88vh;overflow:auto;animation:rohiAbScaleIn .22s var(--ease);}
@keyframes rohiAbFadeIn{from{opacity:0}to{opacity:1}}
@keyframes rohiAbScaleIn{from{opacity:0;transform:scale(.97)}to{opacity:1;transform:scale(1)}}
.rohi-ab .modal h3{margin:0 0 4px;font-size:18px;}
.rohi-ab .modal-sub{font-size:12.5px;color:var(--ink-soft);margin-bottom:16px;}
.rohi-ab .field{margin-bottom:13px;}
.rohi-ab .field label{display:block;font-size:11.5px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:var(--ink-soft);margin-bottom:5px;}
.rohi-ab .field input,.rohi-ab .field select{width:100%;padding:9px 10px;border:1px solid var(--line);border-radius:8px;background:#fff;font-family:'IBM Plex Sans',sans-serif;font-size:13.5px;color:var(--ink);transition:border-color .18s var(--ease),box-shadow .18s var(--ease);}
.rohi-ab .field input:focus,.rohi-ab .field select:focus{outline:none;border-color:var(--brass);box-shadow:0 0 0 3px rgba(193,127,69,.18);}
.rohi-ab .field-row{display:grid;grid-template-columns:1fr 1fr;gap:10px;}
.rohi-ab .modal-actions{display:flex;justify-content:flex-end;gap:10px;margin-top:18px;}
.rohi-ab .hint{font-size:11.5px;color:var(--ink-soft);margin-top:3px;}
.rohi-ab .divider{border:none;border-top:1px solid var(--line);margin:16px 0;}
.rohi-ab .month-strong td{font-weight:600;background:rgba(193,127,69,.08);}
.rohi-ab .opening-input{width:130px;text-align:right;border:1px solid var(--line);border-radius:6px;padding:5px;font-family:'IBM Plex Mono',monospace;}
@media (prefers-reduced-motion: reduce){
.rohi-ab *{animation-duration:.01ms !important;transition-duration:.01ms !important;}
}
@media (max-width:880px){
.rohi-ab .side{width:74px;flex-basis:74px;}
.rohi-ab .brand h1,.rohi-ab .tab-btn .label,.rohi-ab .side-foot,.rohi-ab .tab-group-label{display:none;}
.rohi-ab .main{padding:22px 16px 50px;}
.rohi-ab .ledger-inner{padding:18px 16px 20px 40px;}
.rohi-ab .ledger::before{left:26px;}
.rohi-ab .field-row{grid-template-columns:1fr;}
}
`;

type ModalKind = "quickadd" | "cashEntry" | "bankEntry" | "salesEntry" | "expenseEntry" | "transferEntry" | "addBank" | "addSalesCat" | "addExpenseCat" | null;

function AccountsBookClone() {
  const queryClient = useQueryClient();
  const load = useServerFn(listAccountsBook);
  const addAccountFn = useServerFn(createAccountsBookAccount);
  const openingFn = useServerFn(updateAccountsBookOpening);
  const txnFn = useServerFn(createAccountsBookTransaction);
  const linkedFn = useServerFn(createAccountsBookLinkedEntry);
  const transferFn = useServerFn(createAccountsBookTransfer);
  const deleteTxnFn = useServerFn(deleteAccountsBookTransaction);
  const deleteAccountFn = useServerFn(deleteAccountsBookAccount);
  const addServiceFn = useServerFn(createAccountsBookService);
  const deleteServiceFn = useServerFn(deleteAccountsBookService);

  const { data, isLoading, error, isFetching } = useQuery({ queryKey: ["accounts-book"], queryFn: () => load(), refetchInterval: 30000 });
  const [tab, setTab] = useState<TabId>("dashboard");
  const [modal, setModal] = useState<ModalKind>(null);
  const [bankSel, setBankSel] = useState<string | null>(null);
  const [salesSel, setSalesSel] = useState<string | null>(null);
  const [expSel, setExpSel] = useState<string | null>(null);

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

  const activeBank = banks.find((b) => b.id === bankSel) ?? banks[0] ?? null;
  const activeSalesCat = salesCats.includes(salesSel ?? "") ? (salesSel as string) : salesCats[0] ?? null;
  const activeExpCat = expenseCats.includes(expSel ?? "") ? (expSel as string) : expenseCats[0] ?? null;

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["accounts-book"] });
  const fail = (e: unknown) => toast.error(e instanceof Error ? e.message : "Something went wrong");
  const mutate = <T,>(fn: (payload: T) => Promise<unknown>, message: string) =>
    useMutationFactory(fn, message, refresh, fail);

  const addAccount = mutate((payload: { name: string; kind: Kind; opening_balance: number; opening_balance_date?: string }) => addAccountFn({ data: payload }), "Account added");
  const saveOpening = mutate((payload: { id: string; opening_balance: number }) => openingFn({ data: payload }), "Opening balance saved");
  const addTxn = mutate((payload: Record<string, unknown>) => txnFn({ data: payload as never }), "Entry posted");
  const addLinked = mutate((payload: Record<string, unknown>) => linkedFn({ data: payload as never }), "Entry posted to the ledgers");
  const addTransfer = mutate((payload: Record<string, unknown>) => transferFn({ data: payload as never }), "Transfer posted to both ledgers");
  const removeTxns = mutate(async (ids: string[]) => { for (const id of ids) await deleteTxnFn({ data: id }); }, "Entry deleted");
  const removeAccount = mutate((id: string) => deleteAccountFn({ data: id }), "Account removed");
  const addService = mutate((payload: { name: string }) => addServiceFn({ data: payload }), "Category added");
  const removeService = mutate((id: string) => deleteServiceFn({ data: id }), "Category removed");

  const busy = addTxn.isPending || addLinked.isPending || addTransfer.isPending || addAccount.isPending;

  if (isLoading) return <div className="p-10 text-center">Loading Accounts Book…</div>;
  if (error) return <div className="p-10 text-center text-destructive">{error.message}</div>;

  const cashRows = txns.filter((t) => cash && t.account_id === cash.id);
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

  const deleteGroup = (row: Txn) => {
    const ids = row.source_id ? txns.filter((t) => t.source_id === row.source_id).map((t) => t.id) : [row.id];
    if (window.confirm("Delete this entry and every ledger row linked to it?")) removeTxns.mutate(ids);
  };
  const accountName = (id: string) => accounts.find((a) => a.id === id)?.name ?? "—";
  const sourceBadge = (row: Txn) =>
    row.source_type ? <span className="badge link">{row.source_type}</span> : <span className="badge manual">manual</span>;

  let tabNumber = 0;

  return (
    <div className="rohi-ab animate-premium-fade">
      <style dangerouslySetInnerHTML={{ __html: STYLE }} />
      <div className="border-b border-white/10 bg-[#14202B]">
        <AdminTabs />
      </div>
      <div className="shell">
        <aside className="side">
          <div className="brand">
            <div className="eyebrow">Rohi International</div>
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
                    <button key={item.id} type="button" className={`tab-btn ${tab === item.id ? "active" : ""}`} onClick={() => setTab(item.id)}>
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
          {tab === "dashboard" && (
            <>
              <div className="page-head">
                <div>
                  <h2>Dashboard</h2>
                  <p>ROHI INTERNATIONAL TRAVELS — overview as of {todayISO()}</p>
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
                    {byDate(cashRows).slice(-5).reverse().map((row) => (
                      <tr key={row.id}>
                        <td>{row.entry_date}</td>
                        <td>{row.description}</td>
                        <td className="num in-amt">{row.direction === "in" ? `Rs ${fmt(row.amount)}` : ""}</td>
                        <td className="num out-amt">{row.direction === "out" ? `Rs ${fmt(row.amount)}` : ""}</td>
                        <td>{sourceBadge(row)}</td>
                      </tr>
                    ))}
                    {cashRows.length === 0 && <tr className="empty-row"><td colSpan={5}>No cash book entries yet — post one from the button above.</td></tr>}
                  </tbody>
                </table>
              </Panel>
            </>
          )}

          {tab === "cashbook" && (
            <>
              <div className="page-head">
                <div><h2>Cash Book</h2><p>Daily cash received &amp; paid, with running balance carried forward automatically</p></div>
                <button type="button" className="btn" onClick={() => setModal("cashEntry")}>+ Add Cash Entry</button>
              </div>
              <div className="cards">
                <Card label="Opening Balance" value={cash?.opening_balance ?? 0} />
                <Card label="Total Received" value={cashRows.filter((r) => r.direction === "in").reduce((a, r) => a + Number(r.amount), 0)} tone="pos" />
                <Card label="Total Paid" value={cashRows.filter((r) => r.direction === "out").reduce((a, r) => a + Number(r.amount), 0)} tone="neg" />
                <Card label="Current Balance" value={cashBalance} tone={cashBalance >= 0 ? "pos" : "neg"} />
              </div>
              <Panel title="Ledger" sub="sorted by date">
                <LedgerTable rows={withRunning(cashRows, cash?.opening_balance ?? 0)} inLabel="Received" outLabel="Payment" onDelete={deleteGroup} badge={sourceBadge} />
              </Panel>
            </>
          )}

          {tab === "bank" && (
            <>
              <div className="page-head">
                <div><h2>Bank &amp; Wallet Accounts</h2><p>Each account keeps its own running ledger, linked from Sales, Expenses and Cash transfers</p></div>
                <button type="button" className="btn" onClick={() => setModal("bankEntry")} disabled={!activeBank}>+ Add Ledger Entry</button>
              </div>
              <div className="pillbar">
                {banks.map((bank) => (
                  <button key={bank.id} type="button" className={`pill ${activeBank?.id === bank.id ? "active" : ""}`} onClick={() => setBankSel(bank.id)}>{bank.name}</button>
                ))}
                <button type="button" className="pill add" onClick={() => setModal("addBank")}>+ Add Account</button>
              </div>
              {activeBank ? (
                <>
                  <div className="cards">
                    <Card label={`${activeBank.name} — Opening`} value={activeBank.opening_balance} />
                    <Card label="Total Debit (In)" value={txns.filter((t) => t.account_id === activeBank.id && t.direction === "in").reduce((a, r) => a + Number(r.amount), 0)} tone="pos" />
                    <Card label="Total Credit (Out)" value={txns.filter((t) => t.account_id === activeBank.id && t.direction === "out").reduce((a, r) => a + Number(r.amount), 0)} tone="neg" />
                    <Card label="Current Balance" value={finalBalance(txns.filter((t) => t.account_id === activeBank.id), activeBank.opening_balance)} tone="pos" />
                  </div>
                  <Panel title={`${activeBank.name} Ledger`}>
                    <LedgerTable rows={withRunning(txns.filter((t) => t.account_id === activeBank.id), activeBank.opening_balance)} inLabel="Debit" outLabel="Credit" onDelete={deleteGroup} badge={sourceBadge} />
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
              <div className="pillbar">
                {salesCats.map((cat) => (
                  <button key={cat} type="button" className={`pill ${activeSalesCat === cat ? "active" : ""}`} onClick={() => setSalesSel(cat)}>{cat}</button>
                ))}
                <button type="button" className="pill add" onClick={() => setModal("addSalesCat")}>+ Add Category</button>
              </div>
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
                                <td>{row.entry_date}</td>
                                <td>{row.party ?? ""}</td>
                                <td>{row.description}</td>
                                <td className="num">{fmt(row.amount)}</td>
                                <td className="num">{fmt(row.direct_cost)}</td>
                                <td className="num" style={{ fontWeight: 600, color: profit >= 0 ? "var(--teal-dark)" : "var(--crimson-dark)" }}>{fmt(profit)}</td>
                                <td>{accountName(row.account_id)}</td>
                                <td><button type="button" className="icon-btn" onClick={() => deleteGroup(row)}>Delete</button></td>
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
              <div className="pillbar">
                {expenseCats.map((cat) => (
                  <button key={cat} type="button" className={`pill ${activeExpCat === cat ? "active" : ""}`} onClick={() => setExpSel(cat)}>{cat}</button>
                ))}
                <button type="button" className="pill add" onClick={() => setModal("addExpenseCat")}>+ Add Category</button>
              </div>
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
                              <td>{row.entry_date}</td>
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
                <button type="button" className="btn ghost" onClick={() => window.print()}>Print / Save PDF</button>
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
              <div className="page-head"><div><h2>Settings</h2><p>Manage accounts and categories used across the book</p></div></div>
              <Panel title="Opening Balances">
                <table>
                  <thead><tr><th>Account</th><th>Type</th><th className="num">Opening Balance</th><th /></tr></thead>
                  <tbody>
                    {accounts.map((account) => (
                      <tr key={account.id}>
                        <td>{account.name}</td>
                        <td style={{ textTransform: "uppercase", fontSize: 11 }}>{account.kind}</td>
                        <td className="num">
                          <input
                            className="opening-input"
                            type="number"
                            defaultValue={account.opening_balance}
                            onBlur={(event) => {
                              const next = Number(event.target.value) || 0;
                              if (next !== Number(account.opening_balance)) saveOpening.mutate({ id: account.id, opening_balance: next });
                            }}
                          />
                        </td>
                        <td>
                          {account.kind !== "cash" && (
                            <button type="button" className="icon-btn" onClick={() => window.confirm(`Remove ${account.name}?`) && removeAccount.mutate(account.id)}>Remove</button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <button type="button" className="btn small ghost" style={{ marginTop: 10 }} onClick={() => setModal("addBank")}>+ Add Account</button>
                <hr className="divider" />
                <h3>Sales Categories</h3>
                <div className="pillbar">
                  {services.filter((s) => !s.name.startsWith(EXPENSE_PREFIX)).map((service) => (
                    <span key={service.id} className="pill">
                      {service.name}
                      <span style={{ cursor: "pointer", marginLeft: 6 }} onClick={() => removeService.mutate(service.id)}>✕</span>
                    </span>
                  ))}
                </div>
                <button type="button" className="btn small ghost" onClick={() => setModal("addSalesCat")}>+ Add Sales Category</button>
                <hr className="divider" />
                <h3>Expense Categories</h3>
                <div className="pillbar">
                  {services.filter((s) => s.name.startsWith(EXPENSE_PREFIX)).map((service) => (
                    <span key={service.id} className="pill">
                      {service.name.slice(EXPENSE_PREFIX.length)}
                      <span style={{ cursor: "pointer", marginLeft: 6 }} onClick={() => removeService.mutate(service.id)}>✕</span>
                    </span>
                  ))}
                </div>
                <button type="button" className="btn small ghost" onClick={() => setModal("addExpenseCat")}>+ Add Expense Category</button>
              </Panel>
            </>
          )}
        </main>
      </div>

      {modal && (
        <Modals
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
        />
      )}
    </div>
  );
}

/* small factory so every mutation shares toast + refresh behaviour */
function useMutationFactory<T>(fn: (payload: T) => Promise<unknown>, message: string, refresh: () => void, fail: (e: unknown) => void) {
  return useMutation({
    mutationFn: fn,
    onSuccess: () => { refresh(); toast.success(message); },
    onError: fail,
  });
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
        {children}
      </div>
    </div>
  );
}

function LedgerTable({ rows, inLabel, outLabel, onDelete, badge }: { rows: (Txn & { balance: number })[]; inLabel: string; outLabel: string; onDelete: (row: Txn) => void; badge: (row: Txn) => React.ReactNode }) {
  return (
    <table>
      <thead><tr><th>Date</th><th>Description</th><th className="num">{inLabel}</th><th className="num">{outLabel}</th><th className="num">Balance</th><th>Source</th><th /></tr></thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id}>
            <td>{row.entry_date}</td>
            <td>{row.description}</td>
            <td className="num in-amt">{row.direction === "in" ? fmt(row.amount) : ""}</td>
            <td className="num out-amt">{row.direction === "out" ? fmt(row.amount) : ""}</td>
            <td className="num">{fmt(row.balance)}</td>
            <td>{badge(row)}</td>
            <td><button type="button" className="icon-btn" onClick={() => onDelete(row)}>Delete</button></td>
          </tr>
        ))}
        {rows.length === 0 && <tr className="empty-row"><td colSpan={7}>No entries yet.</td></tr>}
      </tbody>
    </table>
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
}) {
  const { kind, close, open, busy, cash, banks, accounts, activeBank, salesCats, expenseCats, activeSalesCat, activeExpCat } = props;
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

  const accountOptions = (list: Account[]) => list.map((a) => <option key={a.id} value={a.id}>{a.name}</option>);

  const shell = (title: string, sub: string | null, body: React.ReactNode, submitLabel?: string, submit?: () => void) => (
    <div className="overlay" onClick={(event) => event.target === event.currentTarget && close()}>
      <div className="modal">
        <h3>{title}</h3>
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
          <button type="button" className="btn" onClick={() => open("salesEntry")}>Sale</button>
          <button type="button" className="btn ghost" onClick={() => open("expenseEntry")}>Expense</button>
        </div>
        <div className="field-row">
          <button type="button" className="btn ghost" onClick={() => open("transferEntry")}>Transfer (Cash ⇄ Bank)</button>
          <button type="button" className="btn ghost" onClick={() => open("cashEntry")}>Plain Cash Book Entry</button>
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
    return shell("Add Sale", "Sale & cost post automatically to the Cash Book or the bank account you choose.", (
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
    return shell("Add Expense", "Posts straight out of the cash or bank account you choose.", (
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

  if (kind === "transferEntry")
    return shell("Transfer", "Move money between Cash and any bank or wallet account.", (
      <>
        <div className="field"><label>Date</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
        <div className="field-row">
          <div className="field"><label>From</label><select value={from} onChange={(e) => setFrom(e.target.value)}>{accountOptions(accounts)}</select></div>
          <div className="field"><label>To</label><select value={to} onChange={(e) => setTo(e.target.value)}>{accountOptions(accounts)}</select></div>
        </div>
        <div className="field"><label>Description</label><input type="text" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="e.g. Cash Deposited" /></div>
        <div className="field"><label>Amount</label><input type="number" min="1" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" /></div>
      </>
    ), "Save Transfer", () => {
      if (!desc.trim() || numeric(amount) <= 0) { toast.error("Enter a description and an amount above zero"); return; }
      if (!from || !to || from === to) { toast.error("Choose two different accounts"); return; }
      props.onTransfer({ entry_date: date, category: "Transfer", description: desc.trim(), from_account_id: from, to_account_id: to, amount: numeric(amount), source_id: crypto.randomUUID() });
    });

  if (kind === "addBank")
    return shell("Add Bank / Wallet Account", null, (
      <>
        <div className="field"><label>Account Name</label><input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Al Baraka" /></div>
        <div className="field"><label>Type</label><select value={accountKind} onChange={(e) => setAccountKind(e.target.value as Kind)}><option value="bank">Bank</option><option value="wallet">Wallet</option></select></div>
        <div className="field"><label>Opening Balance</label><input type="number" value={opening} onChange={(e) => setOpening(e.target.value)} /></div>
      </>
    ), "Add Account", () => {
      if (!name.trim()) { toast.error("Enter an account name"); return; }
      props.onAccount({ name: name.trim(), kind: accountKind, opening_balance: numeric(opening), opening_balance_date: todayISO() });
    });

  const categoryTitle = kind === "addSalesCat" ? "Add Sales Category" : "Add Expense Category";
  return shell(categoryTitle, null, (
    <div className="field"><label>Category Name</label><input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder={kind === "addSalesCat" ? "e.g. Hajj Packages" : "e.g. Travel & Fuel"} /></div>
  ), "Add Category", () => {
    if (!name.trim()) { toast.error("Enter a category name"); return; }
    props.onCategory(kind === "addSalesCat" ? name.trim() : `${EXPENSE_PREFIX}${name.trim()}`);
  });
}
