import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { formatDateShort, formatDateTimeShort } from "@/lib/date-format";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listAgentLedgersAdmin, addManualLedgerEntry, deleteManualLedgerEntry } from "@/lib/ledger-admin.functions";
import { listVendorLedgersAdmin, addVendorManualLedgerEntry, deleteVendorManualLedgerEntry } from "@/lib/vendors.functions";
import { adminLogout } from "@/lib/fares.functions";
import { AdminHeaderExtras } from "@/components/AdminHeaderExtras";import { AdminPageHeading } from "@/components/AdminPageHeading";import { AdminTabs } from "@/components/AdminTabs";
import { AdminNotifications } from "@/components/AdminNotifications";
import { Home, LogOut, Wallet, Phone, Eye, Table, FileText, ArrowLeft, Plus, Trash2, Calendar, Edit3, Save, X, Printer, Store, Search, Users, CreditCard, ChevronDown } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import ExcelJS from "exceljs";
import { toast } from "sonner";
import { SimplePager, paginate } from "@/components/ui/simple-pager";

export const Route = createFileRoute("/admin/ledger")({
  component: AdminLedgerPage,
});

function AdminLedgerPage() {
  const router = useRouter();
  const logout = useServerFn(adminLogout);
  async function onLogout() {
    await logout();
    router.navigate({ to: "/admin" });
  }
  const list = useServerFn(listAgentLedgersAdmin);
  const q = useQuery({ queryKey: ["admin-ledgers"], queryFn: () => list(), refetchInterval: 30000 });
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [selectedVendorId, setSelectedVendorId] = useState<string | null>(null);
  const [activeLedgerType, setActiveLedgerType] = useState<"agents" | "vendors">("agents");
  const [searchQuery, setSearchQuery] = useState("");
  const qc = useQueryClient();

  const listVendorLedgers = useServerFn(listVendorLedgersAdmin);
  const vendorQuery = useQuery({ queryKey: ["admin-vendor-ledgers"], queryFn: () => listVendorLedgers(), refetchInterval: 30000 });
  const vendorRows = vendorQuery.data ?? [];
  const filteredAgents = (q.data ?? []).filter((a: any) => {
    const term = searchQuery.trim().toLowerCase();
    if (!term) return true;
    return [a.agency_name, a.contact_person, a.contact, a.user_code].some((value) => String(value ?? "").toLowerCase().includes(term));
  });
  const filteredVendors = vendorRows.filter((v: any) => {
    const term = searchQuery.trim().toLowerCase();
    if (!term) return true;
    return [v.name, v.vendor_code, v.contact_person, v.phone, v.category].some((value) => String(value ?? "").toLowerCase().includes(term));
  });

  // Keep the admin ledger in sync the moment a booking is confirmed or a manual
  // entry changes, so it always matches the B2B agent ledger.
  useEffect(() => {
    const channel = supabase
      .channel("admin-ledger-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "agent_bookings" }, () => {
        qc.invalidateQueries({ queryKey: ["admin-ledgers"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "ledger_manual_entries" }, () => {
        qc.invalidateQueries({ queryKey: ["admin-ledgers"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "vendors" }, () => {
        qc.invalidateQueries({ queryKey: ["admin-vendor-ledgers"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "vendor_ledger" }, () => {
        qc.invalidateQueries({ queryKey: ["admin-vendor-ledgers"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);

  const selectedAgent = q.data?.find(a => a.user_id === selectedAgentId);
  const selectedVendor = vendorRows.find((v: any) => v.id === selectedVendorId);

  const grandTotal = (q.data ?? []).reduce((s: number, a: any) => s + a.balance, 0);
  const vendorsGrandTotal = vendorRows.reduce((s: number, v: any) => s + (Number(v.balance) || 0), 0);

  const [balancesPage, setBalancesPage] = useState(1);
  const { pageItems: pagedBalances, totalPages: balancesTotalPages, safePage: balancesSafePage } = paginate(filteredAgents, balancesPage, 25);
  const [vendorsPage, setVendorsPage] = useState(1);
  const { pageItems: pagedVendors, totalPages: vendorsTotalPages, safePage: vendorsSafePage } = paginate(filteredVendors, vendorsPage, 25);

  if (selectedAgentId && selectedAgent) {
    return (
      <AgentLedgerDetail 
        agent={selectedAgent} 
        onBack={() => setSelectedAgentId(null)} 
      />
    );
  }

  if (selectedVendorId && selectedVendor) {
    return (
      <VendorLedgerDetail
        vendor={selectedVendor}
        onBack={() => setSelectedVendorId(null)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-background animate-premium-fade">
      <header className="bg-[#D97757] text-white border-b border-black/10">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-3 px-4 py-4">
          <div className="flex items-center gap-3">
            <Wallet className="h-5 w-5 text-white" />
            <div>
              <p className="font-sans text-lg font-semibold text-white">Admin Ledger Accounts</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <AdminHeaderExtras />
            <a href="/" className="inline-flex items-center gap-1.5 rounded-full border border-[#3d3d3a] bg-[#262624] px-3 py-1.5 text-[13px] font-medium text-white transition-colors hover:border-[#55554f] hover:bg-[#34342f]"><Home className="h-3.5 w-3.5" /> Home</a>
            <button onClick={onLogout} className="inline-flex items-center gap-2 rounded-lg bg-[var(--accent)] px-3 py-1.5 text-[13px] font-medium text-white transition-colors hover:bg-[var(--accent-hover)]">
              <LogOut className="h-3.5 w-3.5" /> Logout
            </button>
          </div>
        </div>
        <AdminTabs />
      </header>

      <main className="mx-auto max-w-[1600px] p-4 md:p-6 space-y-5 bg-[#F4EFEA] min-h-[calc(100vh-130px)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black text-[#1C1917]">Ledger Accounts</h1>
            <p className="text-sm text-[#78716C]">Live balances and statements for registered agents and vendors</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a href="/admin/vendors" className="inline-flex items-center gap-2 rounded-lg bg-[#141413] px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-black"><Store className="h-4 w-4" /> Manage Vendors</a>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-[#E7E5E4] bg-[#FAF9F5] p-5 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#78716C]"><Users className="h-4 w-4 text-[#D97757]" /> Agent Outstanding</div>
            <p className="mt-3 text-2xl font-black text-[#1C1917]">{grandTotal.toLocaleString("en-PK")} <span className="text-sm font-semibold text-[#78716C]">PKR</span></p>
            <p className="mt-1 text-xs text-[#78716C]">{q.data?.length ?? 0} registered agencies</p>
          </div>
          <div className="rounded-2xl border border-[#E7E5E4] bg-[#FAF9F5] p-5 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#78716C]"><Store className="h-4 w-4 text-[#D97757]" /> Vendor Balance</div>
            <p className="mt-3 text-2xl font-black text-[#1C1917]">{vendorsGrandTotal.toLocaleString("en-PK")} <span className="text-sm font-semibold text-[#78716C]">PKR</span></p>
            <p className="mt-1 text-xs text-[#78716C]">{vendorRows.length} registered vendors</p>
          </div>
          <div className="rounded-2xl border border-[#E7E5E4] bg-[#FAF9F5] p-5 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#78716C]"><CreditCard className="h-4 w-4 text-[#D97757]" /> Combined Net Balance</div>
            <p className="mt-3 text-2xl font-black text-[#1C1917]">{(grandTotal + vendorsGrandTotal).toLocaleString("en-PK")} <span className="text-sm font-semibold text-[#78716C]">PKR</span></p>
            <p className="mt-1 text-xs text-[#78716C]">Calculated from live Supabase ledgers</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#E7E5E4] bg-[#FAF9F5] p-4 shadow-sm">
          <div className="flex rounded-xl border border-[#E7E5E4] bg-[#F4EFEA] p-1">
            <button onClick={() => setActiveLedgerType("agents")} className={`rounded-lg px-4 py-2 text-sm font-bold transition ${activeLedgerType === "agents" ? "bg-[#141413] text-white shadow-sm" : "text-[#57534E] hover:bg-white"}`}><Users className="mr-1 inline h-4 w-4" /> Agent Ledgers</button>
            <button onClick={() => setActiveLedgerType("vendors")} className={`rounded-lg px-4 py-2 text-sm font-bold transition ${activeLedgerType === "vendors" ? "bg-[#141413] text-white shadow-sm" : "text-[#57534E] hover:bg-white"}`}><Store className="mr-1 inline h-4 w-4" /> Vendor Ledgers</button>
          </div>
          <div className="relative min-w-[250px] flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#78716C]" />
            <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder={`Search ${activeLedgerType}...`} className="w-full rounded-xl border border-[#E7E5E4] bg-white py-2.5 pl-9 pr-3 text-sm text-[#1C1917] outline-none focus:border-[#D97757] focus:ring-2 focus:ring-[#D97757]/15" />
          </div>
        </div>

        {activeLedgerType === "agents" ? (
          <div className="overflow-x-auto rounded-2xl border border-[#E7E5E4] bg-[#FAF9F5] shadow-sm">
            <table className="min-w-[880px] w-full text-sm">
              <thead className="bg-[#141413] text-[10px] uppercase tracking-wider text-white">
                <tr>
                  <th className="px-5 py-4 text-left">Agency</th>
                  <th className="px-5 py-4 text-left">Contact</th>
                  <th className="px-5 py-4 text-right">Opening</th>
                  <th className="px-5 py-4 text-right">Total Debits</th>
                  <th className="px-5 py-4 text-right">Total Credits</th>
                  <th className="px-5 py-4 text-right">Outstanding Balance</th>
                  <th className="px-5 py-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E7E5E4]">
                {q.isLoading ? <tr><td colSpan={7} className="p-8 text-center text-[#78716C]">Loading agent ledgers…</td></tr> : q.isError ? <tr><td colSpan={7} className="p-8 text-center text-red-700">{(q.error as any)?.message || "Could not load agent ledger data."}</td></tr> : filteredAgents.length === 0 ? <tr><td colSpan={7} className="p-8 text-center text-[#78716C]">No registered agent ledgers found.</td></tr> : pagedBalances.map((a: any) => (
                  <tr key={a.user_id} className="hover:bg-[#F4EFEA]">
                    <td className="px-5 py-4"><div className="font-bold text-[#1C1917]">{a.agency_name}</div><div className="mt-0.5 text-[11px] text-[#78716C]">{a.user_code || "Registered Agent"}</div></td>
                    <td className="px-5 py-4 text-xs text-[#57534E]">{a.contact_person}<br /><span className="mt-1 inline-flex items-center gap-1 text-[#78716C]"><Phone className="h-3 w-3" /> {a.contact || "—"}</span></td>
                    <td className="px-5 py-4 text-right tabular-nums">{(Number(a.opening_balance) || 0).toLocaleString("en-PK")}</td>
                    <td className="px-5 py-4 text-right tabular-nums">{(Number(a.total_debits) || 0).toLocaleString("en-PK")}</td>
                    <td className="px-5 py-4 text-right tabular-nums">{(Number(a.total_credits) || 0).toLocaleString("en-PK")}</td>
                    <td className="px-5 py-4 text-right font-black tabular-nums text-[#1C1917]">{(Number(a.balance) || 0).toLocaleString("en-PK")} <span className="text-[10px] font-semibold text-[#78716C]">PKR</span></td>
                    <td className="px-5 py-4 text-center"><div className="flex justify-center gap-2"><button onClick={() => setSelectedAgentId(a.user_id)} className="inline-flex items-center gap-1 rounded-lg bg-[#141413] px-3 py-1.5 text-xs font-bold text-white hover:bg-black"><Eye className="h-3.5 w-3.5" /> Statement</button><a href={`https://wa.me/${String(a.contact || "").replace(/[^0-9]/g, "")}?text=${encodeURIComponent(`Dear ${a.agency_name}, your outstanding balance is ${a.balance} PKR. Please clear at earliest.`)}`} target="_blank" rel="noreferrer" className="rounded-lg border border-[#E7E5E4] bg-white px-3 py-1.5 text-xs font-bold text-[#57534E] hover:bg-[#F4EFEA]">Reminder</a></div></td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 border-[#D97757]/30 bg-[#F4EFEA] text-sm font-black"><tr><td colSpan={5} className="px-5 py-4 text-[#1C1917]">TOTAL OUTSTANDING</td><td className="px-5 py-4 text-right">{grandTotal.toLocaleString("en-PK")} PKR</td><td /></tr></tfoot>
            </table>
            {(filteredAgents.length > 0) && <div className="flex justify-center border-t border-[#E7E5E4] py-3"><SimplePager page={balancesSafePage} totalPages={balancesTotalPages} onPrev={() => setBalancesPage((p) => Math.max(1, p - 1))} onNext={() => setBalancesPage((p) => Math.min(balancesTotalPages, p + 1))} /></div>}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-[#E7E5E4] bg-[#FAF9F5] shadow-sm">
            <table className="min-w-[880px] w-full text-sm">
              <thead className="bg-[#141413] text-[10px] uppercase tracking-wider text-white"><tr><th className="px-5 py-4 text-left">Vendor</th><th className="px-5 py-4 text-left">Code / Category</th><th className="px-5 py-4 text-left">Contact</th><th className="px-5 py-4 text-right">Opening</th><th className="px-5 py-4 text-right">Total Debits</th><th className="px-5 py-4 text-right">Total Credits</th><th className="px-5 py-4 text-right">Current Balance</th><th className="px-5 py-4 text-center">Actions</th></tr></thead>
              <tbody className="divide-y divide-[#E7E5E4]">
                {vendorQuery.isLoading ? <tr><td colSpan={8} className="p-8 text-center text-[#78716C]">Loading vendor ledgers…</td></tr> : vendorQuery.isError ? <tr><td colSpan={8} className="p-8 text-center text-red-700">{(vendorQuery.error as any)?.message || "Could not load vendor ledger data."}</td></tr> : filteredVendors.length === 0 ? <tr><td colSpan={8} className="p-8 text-center text-[#78716C]">No registered vendor ledgers found.</td></tr> : filteredVendors.map((v: any) => (
                  <tr key={v.id} className="hover:bg-[#F4EFEA]"><td className="px-5 py-4"><div className="font-bold text-[#1C1917]">{v.name}</div><div className="text-[11px] text-[#78716C]">{v.contact_person || "Registered vendor"}</div></td><td className="px-5 py-4 text-xs text-[#57534E]">{v.vendor_code}<br /><span className="text-[#78716C]">{v.category}</span></td><td className="px-5 py-4 text-xs text-[#57534E]">{v.phone || "—"}<br /><span className="text-[#78716C]">{v.email || ""}</span></td><td className="px-5 py-4 text-right tabular-nums">{(Number(v.opening_balance) || 0).toLocaleString("en-PK")}</td><td className="px-5 py-4 text-right tabular-nums">{(Number(v.total_debits) || 0).toLocaleString("en-PK")}</td><td className="px-5 py-4 text-right tabular-nums">{(Number(v.total_credits) || 0).toLocaleString("en-PK")}</td><td className="px-5 py-4 text-right font-black tabular-nums">{(Number(v.balance) || 0).toLocaleString("en-PK")} <span className="text-[10px] font-semibold text-[#78716C]">PKR</span></td><td className="px-5 py-4 text-center"><button onClick={() => setSelectedVendorId(v.id)} className="inline-flex items-center gap-1 rounded-lg bg-[#141413] px-3 py-1.5 text-xs font-bold text-white hover:bg-black"><Eye className="h-3.5 w-3.5" /> Statement</button></td></tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 border-[#D97757]/30 bg-[#F4EFEA] text-sm font-black"><tr><td colSpan={6} className="px-5 py-4 text-[#1C1917]">TOTAL VENDOR BALANCE</td><td className="px-5 py-4 text-right">{vendorsGrandTotal.toLocaleString("en-PK")} PKR</td><td /></tr></tfoot>
            </table>
            {(filteredVendors.length > 0) && <div className="flex justify-center border-t border-[#E7E5E4] py-3"><SimplePager page={vendorsSafePage} totalPages={vendorsTotalPages} onPrev={() => setVendorsPage((p) => Math.max(1, p - 1))} onNext={() => setVendorsPage((p) => Math.min(vendorsTotalPages, p + 1))} /></div>}
          </div>
        )}
      </main>
    </div>
  );
}

function AgentLedgerDetail({ agent, onBack }: { agent: any, onBack: () => void }) {
  const queryClient = useQueryClient();
  const addEntry = useServerFn(addManualLedgerEntry);
  const removeEntry = useServerFn(deleteManualLedgerEntry);
  
  const [isAdding, setIsAdding] = useState(false);
  const [newRow, setNewRow] = useState({
    date: new Date().toISOString().split('T')[0],
    details: '',
    debit: 0,
    credit: 0
  });

  const mutation = useMutation({
    mutationFn: (data: any) => addEntry({ data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-ledgers"] });
      setIsAdding(false);
      setNewRow({ date: new Date().toISOString().split('T')[0], details: '', debit: 0, credit: 0 });
      toast.success("Entry added");
    },
    onError: (e) => toast.error(e.message)
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => removeEntry({ data: id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-ledgers"] });
      toast.success("Entry removed");
    },
    onError: (e) => toast.error(e.message)
  });

  const downloadExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Ledger Report");

    // Add Agency Header Information
    worksheet.mergeCells("A1:E1");
    const titleCell = worksheet.getCell("A1");
    titleCell.value = "ROHI INTERNATIONAL TRAVELS";
    titleCell.font = { name: "Arial", size: 20, bold: true, color: { argb: "FFD97757" } };
    titleCell.alignment = { horizontal: "center" };

    worksheet.mergeCells("A2:E2");
    const addressCell = worksheet.getCell("A2");
    addressCell.value = "Sardar Market Shahi Road Rahim Yar Khan";
    addressCell.font = { name: "Arial", size: 10, bold: true };
    addressCell.alignment = { horizontal: "center" };

    worksheet.mergeCells("A3:E3");
    const contactCell = worksheet.getCell("A3");
    contactCell.value = "Contact No. 0305-6622988";
    contactCell.font = { name: "Arial", size: 10, bold: true };
    contactCell.alignment = { horizontal: "center" };

    worksheet.mergeCells("A4:E4");
    const agencyCell = worksheet.getCell("A4");
    agencyCell.value = `Agency: ${agent.agency_name}`;
    agencyCell.font = { name: "Arial", size: 16, bold: true };
    agencyCell.alignment = { horizontal: "center" };

    worksheet.mergeCells("A5:E5");
    const timestampCell = worksheet.getCell("A5");
    const now = new Date();
    const timestamp = formatDateTimeShort(now);
    timestampCell.value = `Generated: ${timestamp}`;
    timestampCell.font = { name: "Arial", size: 9, italic: true };
    timestampCell.alignment = { horizontal: "center" };

    // Empty row
    worksheet.addRow([]);

    // Headers
    const headerRow = worksheet.addRow(["Date", "Details", "Debit", "Credit", "Balance"]);
    headerRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0D0D0D" } };
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.border = { top: { style: "thin" }, left: { style: "thin" }, bottom: { style: "thin" }, right: { style: "thin" } };
    });

    const fmtDate = (iso: string) => formatDateShort(iso);

    // Data Rows
    agent.ledger.forEach((l: any) => {
      const row = worksheet.addRow([
        fmtDate(l.date),
        l.details,
        l.debit || 0,
        l.credit || 0,
        l.balance
      ]);
      row.getCell(3).numFmt = "#,##0";
      row.getCell(4).numFmt = "#,##0";
      row.getCell(5).numFmt = "#,##0";
      row.eachCell((cell) => {
        cell.alignment = { vertical: "middle" };
        cell.border = { top: { style: "thin" }, left: { style: "thin" }, bottom: { style: "thin" }, right: { style: "thin" } };
      });
    });

    // Totals Row
    const totalDebit = agent.ledger.reduce((s: number, l: any) => s + (l.debit || 0), 0);
    const totalCredit = agent.ledger.reduce((s: number, l: any) => s + (l.credit || 0), 0);
    const totalsRow = worksheet.addRow(["TOTAL", "", totalDebit, totalCredit, agent.balance]);
    totalsRow.eachCell((cell, colNumber) => {
      cell.font = { bold: true };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF0F0F0" } };
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.border = { top: { style: "thin" }, left: { style: "thin" }, bottom: { style: "thin" }, right: { style: "thin" } };
      if (colNumber >= 3) cell.numFmt = "#,##0";
    });

    // Auto-fit columns
    worksheet.columns.forEach((column) => {
      let maxColumnLength = 0;
      column.eachCell?.({ includeEmpty: true }, (cell) => {
        const columnLength = cell.value ? cell.value.toString().length : 0;
        if (columnLength > maxColumnLength) maxColumnLength = columnLength;
      });
      column.width = maxColumnLength < 12 ? 12 : maxColumnLength + 5;
    });

    // Write to buffer and download
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Ledger - ${agent.agency_name}.xlsx`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const downloadPDF = (isPrint = false) => {
    const doc = new jsPDF({ orientation: "portrait", format: "a4" });
    doc.setFontSize(22);
    doc.setTextColor(212, 175, 55);
    doc.text("ROHI INTERNATIONAL TRAVELS", 14, 20);
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text("Sardar Market Shahi Road Rahim Yar Khan", 14, 26);
    doc.text("Contact No. 0305-6622988", 14, 31);

    doc.setFontSize(16);
    doc.setTextColor(13, 13, 13);
    doc.setFont("helvetica", "bold");
    doc.text(`Agency: ${agent.agency_name}`, 14, 42);

    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.setFont("helvetica", "italic");
    const now = new Date();
    const timestamp = formatDateTimeShort(now);
    doc.text(`Generated: ${timestamp}`, 14, 52);

    const fmtDate = (iso: string) => formatDateShort(iso);

    const rows = agent.ledger.map((l: any) => [
      fmtDate(l.date),
      l.details,
      (l.debit || 0).toLocaleString(),
      (l.credit || 0).toLocaleString(),
      (l.balance || 0).toLocaleString()
    ]);

    const totalDebit = agent.ledger.reduce((s: number, l: any) => s + (l.debit || 0), 0);
    const totalCredit = agent.ledger.reduce((s: number, l: any) => s + (l.credit || 0), 0);

    autoTable(doc, {
      startY: 60,
      head: [["Date", "Details", "Debit", "Credit", "Balance"]],
      body: rows,
      theme: "grid",
      headStyles: { fillColor: [13, 13, 13], textColor: [255, 255, 255], fontStyle: "bold" },
      styles: { fontSize: 9, cellPadding: 4 },
      columnStyles: {
        1: { cellWidth: 62 },
        2: { halign: "center" },
        3: { halign: "center" },
        4: { halign: "center", fontStyle: "bold" }
      },
      foot: [["TOTAL", "", totalDebit.toLocaleString(), totalCredit.toLocaleString(), (agent.balance || 0).toLocaleString()]],
      footStyles: { fillColor: [240, 240, 240], textColor: [13, 13, 13], fontStyle: "bold", halign: "center" },
      showHead: 'firstPage',
      showFoot: 'lastPage'
    });

      doc.save(`Ledger - ${agent.agency_name}.pdf`);

  };

  return (
    <div className="min-h-screen bg-background animate-premium-fade">
      <header className="bg-navy text-white border-b border-[rgba(255,255,255,0.10)] sticky top-0 z-10">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between px-4 py-4">
          <div className="flex items-center gap-4">
            <button onClick={onBack} className="rounded-full bg-white/10 p-2 hover:bg-white/10 transition-colors">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <h1 className="font-sans text-2xl font-black text-white">{agent.agency_name}</h1>
              <p className="text-[10px] uppercase tracking-widest opacity-60">Complete Account Ledger</p>
            </div>
          </div>
          <style>{`
            @media print {
              .print-header { display: block !important; }
              .no-print { display: none !important; }
              @page { size: landscape; margin: 10mm; }
              body { background: white !important; }
            }
            .print-header { display: none; }
          `}</style>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => downloadPDF(true)}
              className="inline-flex items-center gap-2 rounded-full border-none bg-navy px-5 py-2.5 text-[10px] font-black uppercase tracking-wider text-white hover:bg-navy/80 transition-all hover:shadow-lg active:scale-95 shadow-md"
            >
              <Printer className="h-3.5 w-3.5" /> Print
            </button>
            <button 
              onClick={downloadExcel}
              className="inline-flex items-center gap-2 rounded-full border-none bg-success px-5 py-2.5 text-[10px] font-black uppercase tracking-wider text-white hover:bg-success-strong transition-all hover:shadow-lg active:scale-95 shadow-md"
            >
              <Table className="h-3.5 w-3.5" /> Excel
            </button>
            <button 
              onClick={() => downloadPDF(false)}
              className="inline-flex items-center gap-2 rounded-full border-none bg-error px-5 py-2.5 text-[10px] font-black uppercase tracking-wider text-white hover:bg-error-strong transition-all hover:shadow-lg active:scale-95 shadow-md"
            >
              <FileText className="h-3.5 w-3.5" /> PDF
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] p-6 pb-24">
        <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
           <div className="rounded-xl bg-white border border-navy/10 p-4 shadow-sm">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Contact Details</p>
              <p className="mt-1 font-bold text-navy">{agent.contact_person}</p>
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5"><Phone className="h-3 w-3" /> {agent.contact}</p>
           </div>
           <div className="rounded-xl bg-white border border-navy/10 p-4 shadow-sm md:col-span-2 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Current Outstanding Balance</p>
                <p className={`text-3xl font-sans font-black ${(agent.balance || 0) > 0 ? "text-gold" : "text-success"}`}>
                  {(agent.balance || 0).toLocaleString("en-PK")} PKR
                </p>
              </div>
              <button 
                onClick={() => setIsAdding(true)}
                className="flex items-center gap-2 rounded-lg bg-navy text-white px-5 py-2.5 text-sm font-bold hover:bg-navy/90 shadow-md transition-all"
              >
                <Plus className="h-4 w-4" /> Add Manual Entry
              </button>
           </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-navy/10 bg-white shadow-lg">
          <div className="print-header p-8 border-b-2 border-navy bg-white text-center space-y-2">
            <h1 className="font-sans text-4xl font-black text-navy tracking-tighter uppercase">ROHI INTERNATIONAL TRAVELS</h1>
            <p className="text-sm font-bold text-navy/70 tracking-[0.3em] uppercase">Sardar Market Shahi Road Rahim Yar Khan</p>
            <div className="flex justify-center gap-8 py-2 border-y border-navy/10 mt-2">
              <p className="text-sm font-black text-navy">Contact: 0305-6622988</p>
              <p className="text-xl font-bold text-navy">Agency: {agent.agency_name}</p>
            </div>
            <p className="text-[10px] font-bold text-navy/40 uppercase tracking-[0.5em] pt-2">
              Generated: {formatDateTimeShort(new Date())}
            </p>
          </div>
          <table className="min-w-[820px] text-sm">
            <thead>
              <tr className="bg-navy text-[10px] uppercase text-gold">
                <th className="px-6 py-4 text-left">Date</th>
                <th className="px-6 py-4 text-left">Details</th>
                <th className="px-6 py-4 text-right">Debit</th>
                <th className="px-6 py-4 text-right">Credit</th>
                <th className="px-6 py-4 text-right">Balance</th>
                <th className="px-6 py-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-navy/5">
              {isAdding && (
                <tr className="bg-gold/5 animate-in fade-in slide-in-from-top-1 duration-200">
                  <td className="px-4 py-3">
                    <input 
                      type="date" 
                      className="w-full rounded border border-navy/20 bg-white px-2 py-1 text-xs focus:ring-1 focus:ring-gold outline-none" 
                      value={newRow.date}
                      onChange={e => setNewRow({...newRow, date: e.target.value})}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input 
                      type="text" 
                      placeholder="Enter description..."
                      className="w-full rounded border border-navy/20 bg-white px-2 py-1 text-xs focus:ring-1 focus:ring-gold outline-none"
                      value={newRow.details}
                      onChange={e => setNewRow({...newRow, details: e.target.value})}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input 
                      type="number" 
                      className="w-full rounded border border-navy/20 bg-white px-2 py-1 text-xs text-right focus:ring-1 focus:ring-gold outline-none"
                      value={newRow.debit}
                      onChange={e => setNewRow({...newRow, debit: Number(e.target.value)})}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input 
                      type="number" 
                      className="w-full rounded border border-navy/20 bg-white px-2 py-1 text-xs text-right focus:ring-1 focus:ring-gold outline-none"
                      value={newRow.credit}
                      onChange={e => setNewRow({...newRow, credit: Number(e.target.value)})}
                    />
                  </td>
                  <td className="px-4 py-3 text-right font-black opacity-30">—</td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button 
                        onClick={() => mutation.mutate({ ...newRow, agent_user_id: agent.user_id })}
                        disabled={mutation.isPending}
                        className="rounded bg-success p-1.5 text-white hover:bg-success-strong disabled:opacity-50"
                      >
                        <Save className="h-4 w-4" />
                      </button>
                      <button 
                        onClick={() => setIsAdding(false)}
                        className="rounded bg-error p-1.5 text-white hover:bg-error-strong"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              )}
              {agent.ledger.map((l: any, i: number) => (
                <tr key={l.id || i} className="hover:bg-[#FDFBF7] transition-colors group">
                  <td className="px-6 py-4 text-[11px] text-muted-foreground whitespace-nowrap">
                    {formatDateShort(l.date)}
                  </td>
                  <td className="px-6 py-4 font-medium uppercase text-navy text-[11px] max-w-md truncate">
                    {l.details}
                  </td>
                  <td className="px-6 py-4 text-right font-bold text-navy">
                    {(l.debit || 0).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-right font-bold text-success">
                    {(l.credit || 0).toLocaleString()}
                  </td>
                  <td className={`px-6 py-4 text-right font-black ${(l.balance || 0) > 0 ? "text-gold" : "text-success"}`}>
                    {(l.balance || 0).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-center">
                    {l.isManual ? (
                      <button 
                        onClick={() => {
                          if(confirm("Delete this manual record?")) deleteMutation.mutate(l.id);
                        }}
                        disabled={deleteMutation.isPending}
                        className="p-1.5 text-error hover:bg-error-strong-soft rounded transition-all opacity-0 group-hover:opacity-100"
                        title="Delete manual record"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    ) : (
                      <span className="text-[9px] text-muted-foreground uppercase tracking-widest bg-navy/5 px-2 py-0.5 rounded">Auto</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-[#FDFBF7] font-bold border-t-2 border-navy/10">
              <tr>
                <td className="px-6 py-4" colSpan={2}>LEDGER SUMMARY</td>
                <td className="px-6 py-4 text-right">
                  {agent.ledger.reduce((s: number, l: any) => s + (l.debit || 0), 0).toLocaleString()}
                </td>
                <td className="px-6 py-4 text-right text-success">
                  {agent.ledger.reduce((s: number, l: any) => s + (l.credit || 0), 0).toLocaleString()}
                </td>
                <td className={`px-6 py-4 text-right font-black ${(agent.balance || 0) > 0 ? "text-gold" : "text-success"}`}>
                  {(agent.balance || 0).toLocaleString()}
                </td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </main>
    </div>
  );
}


function VendorLedgerDetail({ vendor, onBack }: { vendor: any; onBack: () => void }) {
  const queryClient = useQueryClient();
  const addEntry = useServerFn(addVendorManualLedgerEntry);
  const removeEntry = useServerFn(deleteVendorManualLedgerEntry);
  const [isAdding, setIsAdding] = useState(false);
  const [newRow, setNewRow] = useState({
    date: new Date().toISOString().slice(0, 10),
    reference_no: "MANUAL",
    description: "",
    debit: 0,
    credit: 0,
  });

  const addMutation = useMutation({
    mutationFn: (data: any) => addEntry({ data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-vendor-ledgers"] });
      setIsAdding(false);
      setNewRow({ date: new Date().toISOString().slice(0, 10), reference_no: "MANUAL", description: "", debit: 0, credit: 0 });
      toast.success("Vendor ledger entry added");
    },
    onError: (e: any) => toast.error(e?.message || "Could not add vendor entry"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => removeEntry({ data: { id } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-vendor-ledgers"] });
      toast.success("Vendor ledger entry deleted");
    },
    onError: (e: any) => toast.error(e?.message || "Could not delete vendor entry"),
  });

  const totalDebits = (vendor.ledger || []).reduce((s: number, r: any) => s + (Number(r.debit) || 0), 0);
  const totalCredits = (vendor.ledger || []).reduce((s: number, r: any) => s + (Number(r.credit) || 0), 0);

  return (
    <div className="min-h-screen bg-[#F4EFEA]">
      <header className="sticky top-0 z-10 border-b border-black/10 bg-[#D97757] text-white shadow-sm">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-3 px-4 py-4">
          <div className="flex items-center gap-3"><button onClick={onBack} className="rounded-lg bg-black/10 p-2 hover:bg-black/20"><ArrowLeft className="h-5 w-5" /></button><div><h1 className="text-xl font-black">{vendor.name}</h1><p className="text-xs text-white/80">Vendor ledger statement • {vendor.vendor_code}</p></div></div>
          <div className="flex gap-2"><button onClick={() => setIsAdding(true)} className="inline-flex items-center gap-2 rounded-lg bg-[#141413] px-4 py-2 text-sm font-bold text-white hover:bg-black"><Plus className="h-4 w-4" /> Add Entry</button><a href={`https://docs.google.com/spreadsheets/d/1d5aNDN0mIL7rRpWgDCOAd0l59M8s8EUaUBSpRydxjqw/edit`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-lg border border-white/30 bg-white/10 px-4 py-2 text-sm font-bold text-white hover:bg-white/20"><FileText className="h-4 w-4" /> Google Sheet</a></div>
        </div>
      </header>
      <main className="mx-auto max-w-[1400px] space-y-5 p-4 md:p-6">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <div className="rounded-2xl border border-[#E7E5E4] bg-[#FAF9F5] p-4 shadow-sm"><p className="text-xs font-bold uppercase tracking-wider text-[#78716C]">Opening Balance</p><p className="mt-2 text-xl font-black text-[#1C1917]">{Number(vendor.opening_balance || 0).toLocaleString("en-PK")} PKR</p></div>
          <div className="rounded-2xl border border-[#E7E5E4] bg-[#FAF9F5] p-4 shadow-sm"><p className="text-xs font-bold uppercase tracking-wider text-[#78716C]">Total Debits / Paid</p><p className="mt-2 text-xl font-black text-[#1C1917]">{totalDebits.toLocaleString("en-PK")} PKR</p></div>
          <div className="rounded-2xl border border-[#E7E5E4] bg-[#FAF9F5] p-4 shadow-sm"><p className="text-xs font-bold uppercase tracking-wider text-[#78716C]">Total Credits / Costs</p><p className="mt-2 text-xl font-black text-[#1C1917]">{totalCredits.toLocaleString("en-PK")} PKR</p></div>
          <div className="rounded-2xl border border-[#D97757]/30 bg-[#FAF9F5] p-4 shadow-sm"><p className="text-xs font-bold uppercase tracking-wider text-[#78716C]">Current Balance</p><p className="mt-2 text-xl font-black text-[#D97757]">{Number(vendor.balance || 0).toLocaleString("en-PK")} PKR</p></div>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-[#E7E5E4] bg-[#FAF9F5] shadow-sm">
          <table className="min-w-[900px] w-full text-sm">
            <thead className="bg-[#141413] text-[10px] uppercase tracking-wider text-white"><tr><th className="px-5 py-4 text-left">Date</th><th className="px-5 py-4 text-left">Reference</th><th className="px-5 py-4 text-left">Description</th><th className="px-5 py-4 text-right">Debit / Paid</th><th className="px-5 py-4 text-right">Credit / Cost</th><th className="px-5 py-4 text-right">Balance</th><th className="px-5 py-4 text-center">Action</th></tr></thead>
            <tbody className="divide-y divide-[#E7E5E4]">
              {isAdding && <tr className="bg-[#D97757]/5"><td className="px-3 py-3"><input type="date" value={newRow.date} onChange={(e) => setNewRow({ ...newRow, date: e.target.value })} className="w-full rounded-lg border border-[#E7E5E4] bg-white px-2 py-1.5 text-xs" /></td><td className="px-3 py-3"><input value={newRow.reference_no} onChange={(e) => setNewRow({ ...newRow, reference_no: e.target.value })} className="w-full rounded-lg border border-[#E7E5E4] bg-white px-2 py-1.5 text-xs" /></td><td className="px-3 py-3"><input placeholder="Description" value={newRow.description} onChange={(e) => setNewRow({ ...newRow, description: e.target.value })} className="w-full rounded-lg border border-[#E7E5E4] bg-white px-2 py-1.5 text-xs" /></td><td className="px-3 py-3"><input type="number" min="0" value={newRow.debit} onChange={(e) => setNewRow({ ...newRow, debit: Number(e.target.value) })} className="w-full rounded-lg border border-[#E7E5E4] bg-white px-2 py-1.5 text-right text-xs" /></td><td className="px-3 py-3"><input type="number" min="0" value={newRow.credit} onChange={(e) => setNewRow({ ...newRow, credit: Number(e.target.value) })} className="w-full rounded-lg border border-[#E7E5E4] bg-white px-2 py-1.5 text-right text-xs" /></td><td className="px-3 py-3 text-right text-xs text-[#78716C]">Preview after save</td><td className="px-3 py-3"><div className="flex justify-center gap-1"><button disabled={addMutation.isPending || !newRow.description.trim()} onClick={() => addMutation.mutate({ ...newRow, vendor_id: vendor.id })} className="rounded-lg bg-[#141413] p-1.5 text-white disabled:opacity-40"><Save className="h-4 w-4" /></button><button onClick={() => setIsAdding(false)} className="rounded-lg border border-[#E7E5E4] bg-white p-1.5 text-[#57534E]"><X className="h-4 w-4" /></button></div></td></tr>}
              {(vendor.ledger || []).map((row: any, i: number) => <tr key={row.id || i} className="hover:bg-[#F4EFEA]"><td className="whitespace-nowrap px-5 py-4 text-xs text-[#78716C]">{formatDateShort(row.date)}</td><td className="px-5 py-4 text-xs font-semibold text-[#57534E]">{row.reference_no || "—"}</td><td className="max-w-lg px-5 py-4 text-xs text-[#1C1917]">{row.description}</td><td className="px-5 py-4 text-right tabular-nums">{Number(row.debit || 0).toLocaleString("en-PK")}</td><td className="px-5 py-4 text-right tabular-nums">{Number(row.credit || 0).toLocaleString("en-PK")}</td><td className="px-5 py-4 text-right font-bold tabular-nums">{Number(row.balance || 0).toLocaleString("en-PK")}</td><td className="px-5 py-4 text-center">{row.isManual && !row.isOpening ? <button title="Delete manual entry" disabled={deleteMutation.isPending} onClick={() => { if (confirm("Delete this manual ledger entry?")) deleteMutation.mutate(row.id); }} className="rounded-lg p-1.5 text-red-700 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button> : <span className="text-[10px] font-bold uppercase tracking-wider text-[#78716C]">Auto</span>}</td></tr>)}
              {(vendor.ledger || []).length === 0 && !isAdding && <tr><td colSpan={7} className="p-10 text-center text-[#78716C]">No vendor ledger entries yet.</td></tr>}
            </tbody>
            <tfoot className="border-t-2 border-[#D97757]/30 bg-[#F4EFEA] font-black"><tr><td colSpan={3} className="px-5 py-4">LEDGER TOTALS</td><td className="px-5 py-4 text-right">{totalDebits.toLocaleString("en-PK")}</td><td className="px-5 py-4 text-right">{totalCredits.toLocaleString("en-PK")}</td><td className="px-5 py-4 text-right">{Number(vendor.balance || 0).toLocaleString("en-PK")}</td><td /></tr></tfoot>
          </table>
        </div>
      </main>
    </div>
  );
}
