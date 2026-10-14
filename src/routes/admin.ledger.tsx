import React, { useState, useRef, useEffect } from "react";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listAgentLedgersAdmin,
  addManualLedgerEntry,
  deleteManualLedgerEntry,
} from "@/lib/ledger-admin.functions";
import { adminLogout, checkAdminUnlocked } from "@/lib/fares.functions";
import { AdminHeaderExtras } from "@/components/AdminHeaderExtras";
import { AdminTabs } from "@/components/AdminTabs";
import {
  Home,
  LogOut,
  Wallet,
  Phone,
  Eye,
  FileText,
  ArrowLeft,
  Plus,
  Trash2,
  Calendar,
  X,
  Printer,
  Search,
  Users,
  CreditCard,
  Building2,
  TrendingUp,
  TrendingDown,
  Scale,
  Download,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { formatDateShort } from "@/lib/date-format";

export const Route = createFileRoute("/admin/ledger")({
  head: () => ({
    meta: [
      {
        title: "Ledger Accounts — Single Unified Statements — Rohi Admin",
      },
    ],
  }),
  component: AdminLedgerPage,
});

export function AdminLedgerPage() {
  const router = useRouter();
  const logout = useServerFn(adminLogout);
  const check = useServerFn(checkAdminUnlocked);
  const qc = useQueryClient();

  const gate = useQuery({
    queryKey: ["admin", "status"],
    queryFn: () => check(),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const getLedgers = useServerFn(listAgentLedgersAdmin);
  const { data: accounts, isLoading } = useQuery({
    queryKey: ["admin-ledgers"],
    queryFn: () => getLedgers(),
    enabled: !!gate.data?.unlocked,
  });

  // Realtime updates across agents, bookings, manual entries, and vendor ledgers
  useEffect(() => {
    const channel = supabase
      .channel("admin-party-ledger-sync")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "agent_bookings" },
        () => qc.invalidateQueries({ queryKey: ["admin-ledgers"] })
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "ledger_manual_entries" },
        () => qc.invalidateQueries({ queryKey: ["admin-ledgers"] })
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "vendors" },
        () => qc.invalidateQueries({ queryKey: ["admin-ledgers"] })
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "vendor_ledger" },
        () => qc.invalidateQueries({ queryKey: ["admin-ledgers"] })
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "agents" },
        () => qc.invalidateQueries({ queryKey: ["admin-ledgers"] })
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);

  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<"all" | "dr" | "cr" | "zero">("all");
  const [searchTerm, setSearchTerm] = useState("");

  async function onLogout() {
    await logout();
    router.navigate({ to: "/admin" });
  }

  if (gate.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FAF9F5] p-10 text-center text-[#78716C]">
        Loading admin session…
      </div>
    );
  }

  if (!gate.data?.unlocked) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#FAF9F5] p-10 text-center">
        <div className="max-w-md rounded-2xl border border-[#E7E5E4] bg-white p-8 shadow-sm">
          <Wallet className="mx-auto mb-3 h-10 w-10 text-[#D97757]" />
          <h2 className="text-lg font-bold text-[#1C1917]">Admin Authentication Required</h2>
          <p className="mt-1 text-xs text-[#78716C]">
            Please sign in or unlock the Rohi admin panel to view party ledgers.
          </p>
          <a
            href="/admin"
            className="mt-5 inline-block rounded-lg bg-[#D97757] px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-white shadow hover:bg-[#c66849]"
          >
            Go to Admin Login →
          </a>
        </div>
      </div>
    );
  }

  const selectedAccount = (accounts || []).find((a: any) => a.user_id === selectedAccountId);

  // Summary Metrics
  const list = accounts || [];
  let totalDR = 0;
  let totalCR = 0;
  let netBalance = 0;

  for (const acc of list) {
    const bal = Number(acc.balance) || 0;
    netBalance += bal;
    if (bal > 0) totalDR += bal;
    if (bal < 0) totalCR += Math.abs(bal);
  }

  // Filter accounts
  const filteredAccounts = list.filter((a: any) => {
    const bal = Number(a.balance) || 0;
    if (filterType === "dr" && bal <= 0) return false;
    if (filterType === "cr" && bal >= 0) return false;
    if (filterType === "zero" && bal !== 0) return false;

    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase();
    const name = (a.agency_name || "").toLowerCase();
    const contact = (a.contact_person || "").toLowerCase();
    const phone = (a.cell_number || a.contact || "").toLowerCase();
    const code = (a.user_code || "").toLowerCase();
    return name.includes(q) || contact.includes(q) || phone.includes(q) || code.includes(q);
  });

  return (
    <div className="min-h-screen bg-[#F4EFEA] text-[#1C1917]">
      {/* Top Admin Header Bar */}
      <header className="border-b border-[#E7E5E4] bg-[#141413] text-white">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#D97757] text-white shadow-sm">
              <Wallet className="h-5 w-5" />
            </div>
            <div>
              <p className="font-sans text-base font-bold text-white tracking-wide">
                Ledger Accounts
              </p>
              <p className="text-[11px] font-medium text-white/70">
                Single unified Debit & Credit statements for all registered agents, partners, and suppliers
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <AdminHeaderExtras />
            <a
              href="/"
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#3d3d3a] bg-[#262624] px-3 py-1.5 text-xs font-medium text-white transition-colors hover:border-[#55554f] hover:bg-[#34342f]"
            >
              <Home className="h-3.5 w-3.5" />
              <span>Home</span>
            </a>
            <button
              onClick={onLogout}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#D97757] px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-[#c66849]"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Logout</span>
            </button>
          </div>
        </div>

        {/* Global Admin Navigation Tabs */}
        <AdminTabs />
      </header>

      {/* Main Content Area */}
      <main className="mx-auto max-w-[1600px] p-4 sm:p-6">
        {selectedAccount ? (
          <PartyLedgerDetail
            account={selectedAccount}
            onBack={() => setSelectedAccountId(null)}
          />
        ) : (
          <div className="space-y-5">
            {/* 4 Summary Stat Cards */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl border border-[#E7E5E4] bg-[#FAF9F5] p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#78716C]">
                    Total Receivables (DR)
                  </span>
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                    <TrendingUp className="h-4 w-4" />
                  </div>
                </div>
                <div className="mt-2 text-2xl font-black text-emerald-700">
                  Rs {totalDR.toLocaleString()}
                </div>
                <p className="mt-1 text-[11px] text-[#78716C]">
                  Amounts agents & clients owe to Rohi Travels
                </p>
              </div>

              <div className="rounded-xl border border-[#E7E5E4] bg-[#FAF9F5] p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#78716C]">
                    Total Payables (CR)
                  </span>
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-50 text-rose-600">
                    <TrendingDown className="h-4 w-4" />
                  </div>
                </div>
                <div className="mt-2 text-2xl font-black text-rose-700">
                  Rs {totalCR.toLocaleString()}
                </div>
                <p className="mt-1 text-[11px] text-[#78716C]">
                  Amounts Rohi Travels owes to suppliers & agents
                </p>
              </div>

              <div className="rounded-xl border border-[#E7E5E4] bg-[#FAF9F5] p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#78716C]">
                    Net Position
                  </span>
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#D97757]/10 text-[#D97757]">
                    <Scale className="h-4 w-4" />
                  </div>
                </div>
                <div
                  className={`mt-2 text-2xl font-black ${
                    netBalance >= 0 ? "text-[#1C1917]" : "text-rose-700"
                  }`}
                >
                  Rs {netBalance.toLocaleString()}{" "}
                  <span className="text-xs font-bold uppercase tracking-wider text-[#78716C]">
                    {netBalance >= 0 ? "(DR)" : "(CR)"}
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-[#78716C]">
                  Overall net outstanding balance
                </p>
              </div>

              <div className="rounded-xl border border-[#E7E5E4] bg-[#FAF9F5] p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#78716C]">
                    Registered Accounts
                  </span>
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                    <Users className="h-4 w-4" />
                  </div>
                </div>
                <div className="mt-2 text-2xl font-black text-[#1C1917]">
                  {list.length}
                </div>
                <p className="mt-1 text-[11px] text-[#78716C]">
                  Live synced with Google Sheets
                </p>
              </div>
            </div>

            {/* Filter Pills and Search Bar */}
            <div className="flex flex-col gap-3 rounded-xl border border-[#E7E5E4] bg-[#FAF9F5] p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setFilterType("all")}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                    filterType === "all"
                      ? "bg-[#141413] text-white shadow-sm"
                      : "bg-white text-[#78716C] border border-[#E7E5E4] hover:bg-[#F4EFEA]"
                  }`}
                >
                  All Accounts ({list.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterType("dr")}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                    filterType === "dr"
                      ? "bg-emerald-700 text-white shadow-sm"
                      : "bg-white text-emerald-700 border border-emerald-200 hover:bg-emerald-50"
                  }`}
                >
                  Receivables (DR) ({list.filter((a: any) => (Number(a.balance) || 0) > 0).length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterType("cr")}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                    filterType === "cr"
                      ? "bg-rose-700 text-white shadow-sm"
                      : "bg-white text-rose-700 border border-rose-200 hover:bg-rose-50"
                  }`}
                >
                  Payables (CR) ({list.filter((a: any) => (Number(a.balance) || 0) < 0).length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterType("zero")}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                    filterType === "zero"
                      ? "bg-[#78716C] text-white shadow-sm"
                      : "bg-white text-[#78716C] border border-[#E7E5E4] hover:bg-[#F4EFEA]"
                  }`}
                >
                  Settled (0) ({list.filter((a: any) => (Number(a.balance) || 0) === 0).length})
                </button>
              </div>

              <div className="relative min-w-[260px] sm:max-w-xs">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#78716C]" />
                <input
                  type="text"
                  placeholder="Search account, code, contact…"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full rounded-lg border border-[#E7E5E4] bg-white py-1.5 pl-8 pr-3 text-xs text-[#1C1917] placeholder-[#78716C] focus:border-[#D97757] focus:outline-none focus:ring-1 focus:ring-[#D97757]"
                />
              </div>
            </div>

            {/* Accounts Directory Table */}
            <div className="overflow-hidden rounded-xl border border-[#E7E5E4] bg-white shadow-sm">
              {isLoading ? (
                <div className="py-16 text-center text-xs text-[#78716C]">
                  Loading ledger accounts…
                </div>
              ) : filteredAccounts.length === 0 ? (
                <div className="py-16 text-center text-xs text-[#78716C]">
                  No accounts found matching current criteria.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-[#E7E5E4] bg-[#FAF9F5] text-[11px] font-bold uppercase tracking-wider text-[#78716C]">
                        <th className="py-3 px-4">Account / Partner Name</th>
                        <th className="py-3 px-4">Role / Category</th>
                        <th className="py-3 px-4">Contact & Code</th>
                        <th className="py-3 px-4 text-right">Total Debits (DR)</th>
                        <th className="py-3 px-4 text-right">Total Credits (CR)</th>
                        <th className="py-3 px-4 text-right">Net Balance</th>
                        <th className="py-3 px-4 text-center">Statement</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E7E5E4]">
                      {filteredAccounts.map((acc: any) => {
                        const bal = Number(acc.balance) || 0;
                        const debits = Number(acc.total_debits) || 0;
                        const credits = Number(acc.total_credits) || 0;

                        return (
                          <tr
                            key={acc.user_id}
                            className="transition-colors hover:bg-[#FAF9F5]/70"
                          >
                            <td className="py-3 px-4">
                              <div className="font-bold text-[#1C1917]">
                                {acc.agency_name}
                              </div>
                              <div className="text-[11px] text-[#78716C]">
                                {acc.contact_person || "—"}
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <span
                                className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                                  acc.party_type?.includes("Dual")
                                    ? "bg-purple-100 text-purple-800 border border-purple-200"
                                    : acc.party_type?.includes("Supplier")
                                    ? "bg-amber-100 text-amber-800 border border-amber-200"
                                    : "bg-blue-100 text-blue-800 border border-blue-200"
                                }`}
                              >
                                {acc.party_type || "Agent"}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <div className="font-mono text-[11px] text-[#1C1917]">
                                {acc.user_code || "—"}
                              </div>
                              <div className="text-[11px] text-[#78716C]">
                                {acc.contact || acc.cell_number || "—"}
                              </div>
                            </td>
                            <td className="py-3 px-4 text-right font-mono text-emerald-700 font-semibold">
                              Rs {debits.toLocaleString()}
                            </td>
                            <td className="py-3 px-4 text-right font-mono text-rose-700 font-semibold">
                              Rs {credits.toLocaleString()}
                            </td>
                            <td className="py-3 px-4 text-right">
                              <span
                                className={`inline-block rounded-md px-2.5 py-1 font-mono text-xs font-bold ${
                                  bal > 0
                                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                    : bal < 0
                                    ? "bg-rose-50 text-rose-700 border border-rose-200"
                                    : "bg-stone-50 text-stone-600 border border-stone-200"
                                }`}
                              >
                                Rs {Math.abs(bal).toLocaleString()}{" "}
                                <span className="text-[10px] uppercase">
                                  {bal > 0 ? "DR" : bal < 0 ? "CR" : "0"}
                                </span>
                              </span>
                            </td>
                            <td className="py-3 px-4 text-center">
                              <button
                                type="button"
                                onClick={() => setSelectedAccountId(acc.user_id)}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-[#E7E5E4] bg-white px-3 py-1.5 text-xs font-bold text-[#141413] shadow-sm hover:border-[#D97757] hover:bg-[#FAF9F5]"
                              >
                                <Eye className="h-3.5 w-3.5 text-[#D97757]" />
                                <span>Statement</span>
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

// -------------------------------------------------------------
// PartyLedgerDetail: Single Unified Debit & Credit Statement
// -------------------------------------------------------------
function PartyLedgerDetail({
  account,
  onBack,
}: {
  account: any;
  onBack: () => void;
}) {
  const qc = useQueryClient();
  const [showAddModal, setShowAddModal] = useState(false);
  const [entryType, setEntryType] = useState<"debit" | "credit">("debit");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [details, setDetails] = useState("");
  const [amount, setAmount] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const addEntry = useServerFn(addManualLedgerEntry);
  const deleteEntry = useServerFn(deleteManualLedgerEntry);

  const addMutation = useMutation({
    mutationFn: (vars: {
      agent_user_id: string;
      date: string;
      details: string;
      debit: number;
      credit: number;
    }) => addEntry({ data: vars }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-ledgers"] });
      setShowAddModal(false);
      setDetails("");
      setAmount("");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteEntry({ data: id }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-ledgers"] });
    },
  });

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const num = Number(amount) || 0;
    if (num <= 0 || !details.trim()) return;

    addMutation.mutate({
      agent_user_id: account.user_id,
      date: new Date(date).toISOString(),
      details: details.trim(),
      debit: entryType === "debit" ? num : 0,
      credit: entryType === "credit" ? num : 0,
    });
  };

  // Filter statement entries
  const allEntries = account.ledger || [];
  const filteredEntries = allEntries.filter((item: any) => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const det = (item.details || "").toLowerCase();
      if (!det.includes(q)) return false;
    }
    if (fromDate) {
      const itemD = String(item.date || "").slice(0, 10);
      if (itemD < fromDate) return false;
    }
    if (toDate) {
      const itemD = String(item.date || "").slice(0, 10);
      if (itemD > toDate) return false;
    }
    return true;
  });

  const bal = Number(account.balance) || 0;

  // Export PDF
  const handleExportPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text("ROHI INTERNATIONAL TRAVELS", 14, 15);
    doc.setFontSize(9);
    doc.text("Sardar Market, Shahi Road, Rahim Yar Khan • 0305-6622988", 14, 21);
    doc.text(`STATEMENT OF ACCOUNT: ${account.agency_name.toUpperCase()}`, 14, 27);
    doc.text(`Contact: ${account.contact || "—"}  •  Code: ${account.user_code || "—"}`, 14, 32);

    const rows = filteredEntries.map((l: any) => [
      l.date ? String(l.date).slice(0, 10) : "—",
      l.details || "—",
      Number(l.debit) || 0 ? `Rs ${Number(l.debit).toLocaleString()}` : "—",
      Number(l.credit) || 0 ? `Rs ${Number(l.credit).toLocaleString()}` : "—",
      `Rs ${Number(l.balance).toLocaleString()}`,
    ]);

    autoTable(doc, {
      startY: 38,
      head: [["Date", "Details / Particulars", "Debit (DR)", "Credit (CR)", "Balance"]],
      body: rows,
      theme: "grid",
      headStyles: { fillColor: [217, 119, 87] },
      styles: { fontSize: 8 },
    });

    doc.save(`Statement-${account.agency_name.replace(/\s+/g, "_")}.pdf`);
  };

  // Export Excel
  const handleExportExcel = () => {
    const rows = filteredEntries.map((l: any) => ({
      Date: l.date ? String(l.date).slice(0, 10) : "—",
      "Particulars / Details": l.details || "—",
      "Debit (PKR)": Number(l.debit) || 0,
      "Credit (PKR)": Number(l.credit) || 0,
      "Balance (PKR)": Number(l.balance) || 0,
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Statement");
    XLSX.writeFile(wb, `Statement-${account.agency_name.replace(/\s+/g, "_")}.xlsx`);
  };

  return (
    <div className="space-y-4">
      {/* Detail Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#E7E5E4] bg-[#FAF9F5] p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#E7E5E4] bg-white text-[#1C1917] shadow-sm hover:bg-[#F4EFEA]"
            title="Back to accounts"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-[#1C1917]">
                {account.agency_name}
              </h2>
              <span className="rounded bg-[#D97757]/10 px-2 py-0.5 font-mono text-[11px] font-bold text-[#D97757]">
                {account.user_code || "CODE"}
              </span>
              <span className="rounded bg-stone-100 px-2 py-0.5 text-[10px] font-bold text-stone-600">
                {account.party_type || "Agent"}
              </span>
            </div>
            <p className="text-xs text-[#78716C]">
              {account.contact_person && `${account.contact_person} • `}
              {account.contact || account.cell_number || "No contact"}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Outstanding Balance Pill */}
          <div
            className={`rounded-xl border px-3 py-1.5 font-mono text-xs font-bold ${
              bal > 0
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : bal < 0
                ? "border-rose-200 bg-rose-50 text-rose-800"
                : "border-stone-200 bg-stone-50 text-stone-700"
            }`}
          >
            Balance: Rs {Math.abs(bal).toLocaleString()}{" "}
            <span className="uppercase">{bal > 0 ? "DR (Receivable)" : bal < 0 ? "CR (Payable)" : "Settled"}</span>
          </div>

          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#D97757] px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-[#c66849]"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add Entry</span>
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#E7E5E4] bg-white px-2.5 py-1.5 text-xs font-medium text-[#1C1917] shadow-sm hover:bg-[#F4EFEA]"
            title="Print Voucher"
          >
            <Printer className="h-3.5 w-3.5 text-[#78716C]" />
            <span>Print</span>
          </button>

          <button
            type="button"
            onClick={handleExportPDF}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#E7E5E4] bg-white px-2.5 py-1.5 text-xs font-medium text-[#1C1917] shadow-sm hover:bg-[#F4EFEA]"
            title="Export PDF"
          >
            <FileText className="h-3.5 w-3.5 text-[#78716C]" />
            <span>PDF</span>
          </button>

          <button
            type="button"
            onClick={handleExportExcel}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#E7E5E4] bg-white px-2.5 py-1.5 text-xs font-medium text-[#1C1917] shadow-sm hover:bg-[#F4EFEA]"
            title="Export Excel"
          >
            <Download className="h-3.5 w-3.5 text-[#78716C]" />
            <span>Excel</span>
          </button>
        </div>
      </div>

      {/* Search and Date Filter Controls */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[#E7E5E4] bg-white p-3 shadow-sm">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#78716C]" />
          <input
            type="text"
            placeholder="Search particulars / reference…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-[#E7E5E4] bg-[#FAF9F5] py-1.5 pl-8 pr-3 text-xs text-[#1C1917] placeholder-[#78716C] focus:border-[#D97757] focus:outline-none"
          />
        </div>
        <div className="flex items-center gap-1.5 text-xs text-[#78716C]">
          <span>From:</span>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="rounded-lg border border-[#E7E5E4] bg-[#FAF9F5] px-2 py-1 text-xs text-[#1C1917] focus:border-[#D97757] focus:outline-none"
          />
        </div>
        <div className="flex items-center gap-1.5 text-xs text-[#78716C]">
          <span>To:</span>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="rounded-lg border border-[#E7E5E4] bg-[#FAF9F5] px-2 py-1 text-xs text-[#1C1917] focus:border-[#D97757] focus:outline-none"
          />
        </div>
        {(searchQuery || fromDate || toDate) && (
          <button
            type="button"
            onClick={() => {
              setSearchQuery("");
              setFromDate("");
              setToDate("");
            }}
            className="rounded-lg border border-[#E7E5E4] bg-[#FAF9F5] px-2.5 py-1 text-xs font-bold text-[#78716C] hover:bg-stone-200"
          >
            Clear
          </button>
        )}
      </div>

      {/* Detailed Ledger Transactions Table */}
      <div className="overflow-hidden rounded-xl border border-[#E7E5E4] bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#E7E5E4] bg-[#FAF9F5] text-[11px] font-bold uppercase tracking-wider text-[#78716C]">
                <th className="py-2.5 px-4 w-[120px]">Date</th>
                <th className="py-2.5 px-4">Particulars / Details</th>
                <th className="py-2.5 px-4 text-right w-[140px]">Debit (DR)</th>
                <th className="py-2.5 px-4 text-right w-[140px]">Credit (CR)</th>
                <th className="py-2.5 px-4 text-right w-[150px]">Balance (PKR)</th>
                <th className="py-2.5 px-4 text-center w-[60px]" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E7E5E4]">
              {filteredEntries.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-xs text-[#78716C]">
                    No statement entries found.
                  </td>
                </tr>
              ) : (
                filteredEntries.map((row: any) => {
                  const d = Number(row.debit) || 0;
                  const c = Number(row.credit) || 0;
                  const running = Number(row.balance) || 0;

                  return (
                    <tr
                      key={row.id}
                      className="transition-colors hover:bg-[#FAF9F5]/70"
                    >
                      <td className="py-2.5 px-4 font-mono text-[11px] text-[#78716C]">
                        {row.date ? String(row.date).slice(0, 10) : "—"}
                      </td>
                      <td className="py-2.5 px-4">
                        <div className="font-medium text-[#1C1917]">
                          {row.details || "—"}
                        </div>
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono font-semibold text-emerald-700">
                        {d > 0 ? `Rs ${d.toLocaleString()}` : "—"}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono font-semibold text-rose-700">
                        {c > 0 ? `Rs ${c.toLocaleString()}` : "—"}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono font-bold text-[#1C1917]">
                        Rs {running.toLocaleString()}
                      </td>
                      <td className="py-2.5 px-4 text-center">
                        {row.isManual && !row.isOpening && (
                          <button
                            type="button"
                            onClick={() => {
                              if (confirm("Delete this manual ledger entry? This cannot be undone.")) {
                                deleteMutation.mutate(row.id);
                              }
                            }}
                            className="text-stone-400 hover:text-rose-600 transition-colors"
                            title="Delete manual entry"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {filteredEntries.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-[#141413] bg-[#FAF9F5] font-bold text-xs text-[#1C1917]">
                  <td colSpan={2} className="py-3 px-4 uppercase tracking-wider">
                    Statement Totals ({filteredEntries.length} entries)
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-emerald-700">
                    Rs {filteredEntries.reduce((s: number, r: any) => s + (Number(r.debit) || 0), 0).toLocaleString()}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-rose-700">
                    Rs {filteredEntries.reduce((s: number, r: any) => s + (Number(r.credit) || 0), 0).toLocaleString()}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-[#1C1917]">
                    Rs {bal.toLocaleString()}
                  </td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Add Entry Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl border border-[#E7E5E4] bg-white p-6 shadow-xl animate-premium-fade">
            <div className="flex items-center justify-between border-b border-[#E7E5E4] pb-3">
              <div>
                <h3 className="text-base font-bold text-[#1C1917]">
                  New Ledger Entry
                </h3>
                <p className="text-xs text-[#78716C]">{account.agency_name}</p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="rounded-lg p-1 text-[#78716C] hover:bg-stone-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="mt-4 space-y-4">
              {/* Debit / Credit Switcher */}
              <div>
                <label className="block text-xs font-bold text-[#1C1917] mb-1.5">
                  Entry Type
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setEntryType("debit")}
                    className={`rounded-lg py-2 text-xs font-bold border transition-all ${
                      entryType === "debit"
                        ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                        : "bg-white text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                    }`}
                  >
                    Debit (DR)
                    <div className="text-[10px] font-normal opacity-80">
                      Sale / Booking / Payment Sent
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setEntryType("credit")}
                    className={`rounded-lg py-2 text-xs font-bold border transition-all ${
                      entryType === "credit"
                        ? "bg-rose-600 text-white border-rose-600 shadow-sm"
                        : "bg-white text-rose-700 border-rose-200 hover:bg-rose-50"
                    }`}
                  >
                    Credit (CR)
                    <div className="text-[10px] font-normal opacity-80">
                      Purchase / Payment Received
                    </div>
                  </button>
                </div>
              </div>

              {/* Date */}
              <div>
                <label className="block text-xs font-bold text-[#1C1917] mb-1">
                  Transaction Date
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                  className="w-full rounded-lg border border-[#E7E5E4] px-3 py-2 text-xs text-[#1C1917] focus:border-[#D97757] focus:outline-none"
                />
              </div>

              {/* Particulars / Details */}
              <div>
                <label className="block text-xs font-bold text-[#1C1917] mb-1">
                  Particulars / Description
                </label>
                <input
                  type="text"
                  placeholder="e.g. Visa Service, Ticket Invoice, Bank Transfer…"
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  required
                  className="w-full rounded-lg border border-[#E7E5E4] px-3 py-2 text-xs text-[#1C1917] focus:border-[#D97757] focus:outline-none"
                />
              </div>

              {/* Amount */}
              <div>
                <label className="block text-xs font-bold text-[#1C1917] mb-1">
                  Amount (PKR)
                </label>
                <input
                  type="number"
                  placeholder="0"
                  min="1"
                  step="any"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                  className="w-full rounded-lg border border-[#E7E5E4] px-3 py-2 text-sm font-mono font-bold text-[#1C1917] focus:border-[#D97757] focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E7E5E4]">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="rounded-lg border border-[#E7E5E4] bg-white px-4 py-2 text-xs font-bold text-[#78716C] hover:bg-stone-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addMutation.isPending}
                  className="rounded-lg bg-[#D97757] px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-[#c66849] disabled:opacity-50"
                >
                  {addMutation.isPending ? "Posting…" : "Post to Ledger"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
