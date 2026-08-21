import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listAgentLedgersAdmin, addManualLedgerEntry, deleteManualLedgerEntry } from "@/lib/ledger-admin.functions";
import { AdminTabs } from "@/components/AdminTabs";
import { AdminNotifications } from "@/components/AdminNotifications";
import { Wallet, Phone, Eye, Table, FileText, ArrowLeft, Plus, Trash2, Calendar, Edit3, Save, X, Printer } from "lucide-react";
import { useState, useRef } from "react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import ExcelJS from "exceljs";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/ledger")({
  component: AdminLedgerPage,
});

function AdminLedgerPage() {
  const list = useServerFn(listAgentLedgersAdmin);
  const q = useQuery({ queryKey: ["admin-ledgers"], queryFn: () => list(), refetchInterval: 30000 });
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);

  const selectedAgent = q.data?.find(a => a.user_id === selectedAgentId);

  const grandTotal = (q.data ?? []).reduce((s: number, a: any) => s + a.balance, 0);

  if (selectedAgentId && selectedAgent) {
    return (
      <AgentLedgerDetail 
        agent={selectedAgent} 
        onBack={() => setSelectedAgentId(null)} 
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#FDFBF7]">
      <header className="bg-navy text-white border-b border-gold/20">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <Wallet className="h-5 w-5 text-[#D4AF37]" />
            <div>
              <p className="font-serif text-lg font-black text-[#D4AF37]">Admin Ledger Accounts</p>
            </div>
          </div>
        </div>
        <AdminTabs />
      </header>

      <main className="mx-auto max-w-[1600px] p-6 space-y-4">
        {/* AdminNotifications is now globally mounted in __root */}
        <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold font-serif text-[#0D0D0D]">Agency Balances Overview</h2>
            <div className="rounded-xl bg-[#0D0D0D] px-6 py-4 text-white shadow-lg">
                <p className="text-[10px] font-black uppercase tracking-widest text-[#D4AF37]">Grand Total Outstanding</p>
                <p className="text-3xl font-serif font-black">{(grandTotal || 0).toLocaleString("en-PK")} PKR</p>
            </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-navy/10 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-[#0D0D0D] text-[10px] uppercase text-[#D4AF37]">
              <tr>
                <th className="px-6 py-3 text-left">Agency</th>
                <th className="px-6 py-3 text-left">Contact</th>
                <th className="px-6 py-3 text-right">Outstanding Balance</th>
                <th className="px-6 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {q.isLoading ? (
                <tr><td colSpan={4} className="p-8 text-center text-muted-foreground">Loading...</td></tr>
              ) : q.data?.map((a: any) => (
                <tr key={a.user_id} className="border-b border-navy/5 hover:bg-[#FDFBF7]">
                  <td className="px-6 py-4 font-bold text-navy">{a.agency_name}</td>
                  <td className="px-6 py-4 text-xs text-muted-foreground">
                    {a.contact_person}
                    <br />
                    <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {a.contact}</span>
                  </td>
                  <td className={`px-6 py-4 text-right font-black ${a.balance > 0 ? "text-[#D4AF37]" : "text-emerald-700"}`}>
                    {(a.balance || 0).toLocaleString("en-PK")} PKR
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button onClick={() => setSelectedAgentId(a.user_id)} className="text-xs bg-navy text-white px-3 py-1.5 rounded hover:bg-navy/90 flex items-center gap-1">
                        <Eye className="h-3 w-3" /> Details
                      </button>
                      <a href={`https://wa.me/${a.contact.replace(/[^0-9]/g, "")}?text=Dear%20${a.agency_name},%20your%20outstanding%20balance%20is%20${a.balance}%20PKR.%20Please%20clear%20at%20earliest.`} 
                         target="_blank" className="text-xs border border-emerald-600 text-emerald-600 px-3 py-1.5 rounded hover:bg-emerald-50">Reminder</a>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
    titleCell.font = { name: "Arial", size: 20, bold: true, color: { argb: "FFD4AF37" } };
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
    const agentCell = worksheet.getCell("A4");
    agentCell.value = `Agent: ${(agent.agency_name || "").toUpperCase()}`;
    agentCell.font = { name: "Arial", size: 12, bold: true };
    agentCell.alignment = { horizontal: "center" };

    worksheet.mergeCells("A5:E5");
    const timestampCell = worksheet.getCell("A5");
    const now = new Date();
    const p = (n: number) => String(n).padStart(2, "0");
    const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
    const timestamp = `${p(now.getDate())}-${months[now.getMonth()]}-${String(now.getFullYear()).slice(-2)} ${now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true })}`;
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

    const fmtDate = (iso: string) => {
      const d = new Date(iso);
      const p2 = (n: number) => String(n).padStart(2, "0");
      const ms = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
      return `${p2(d.getDate())}-${ms[d.getMonth()]}-${String(d.getFullYear()).slice(-2)}`;
    };

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
    a.download = `Ledger - ${(agent.agency_name || "").toUpperCase()}.xlsx`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const downloadPDF = (isPrint = false) => {
    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFontSize(22);
    doc.setTextColor(212, 175, 55);
    doc.text("ROHI INTERNATIONAL TRAVELS", 14, 20);
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text("Sardar Market Shahi Road Rahim Yar Khan", 14, 26);
    doc.text("Contact No. 0305-6622988", 14, 31);

    doc.setFontSize(14);
    doc.setTextColor(13, 13, 13);
    doc.setFont("helvetica", "bold");
    doc.text(`Agent: ${(agent.agency_name || "").toUpperCase()}`, 14, 42);
    doc.setFont("helvetica", "normal");

    doc.setFontSize(10);
    doc.setTextColor(100);
    const now = new Date();
    const p = (n: number) => String(n).padStart(2, "0");
    const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
    const timestamp = `${p(now.getDate())}-${months[now.getMonth()]}-${String(now.getFullYear()).slice(-2)} ${now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true })}`;
    doc.text(`Generated: ${timestamp}`, 14, 48);

    const fmtDate = (iso: string) => {
      const d = new Date(iso);
      const p2 = (n: number) => String(n).padStart(2, "0");
      const ms = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
      return `${p2(d.getDate())}-${ms[d.getMonth()]}-${String(d.getFullYear()).slice(-2)}`;
    };

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
        1: { cellWidth: 140 },
        2: { halign: "center" },
        3: { halign: "center" },
        4: { halign: "center", fontStyle: "bold" }
      },
      foot: [["TOTAL", "", totalDebit.toLocaleString(), totalCredit.toLocaleString(), (agent.balance || 0).toLocaleString()]],
      footStyles: { fillColor: [240, 240, 240], textColor: [13, 13, 13], fontStyle: "bold", halign: "center" },
      showHead: 'firstPage',
      showFoot: 'lastPage'
    });

    if (isPrint) {
      doc.autoPrint();
      window.open(doc.output('bloburl'), '_blank');
    } else {
      doc.save(`Ledger - ${(agent.agency_name || "").toUpperCase()}.pdf`);
    }
  };

  return (
    <div className="min-h-screen bg-[#FDFBF7]">
      <header className="bg-[#0D0D0D] text-white border-b border-gold/20 sticky top-0 z-10">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between px-4 py-4">
          <div className="flex items-center gap-4">
            <button onClick={onBack} className="rounded-full bg-white/10 p-2 hover:bg-white/20 transition-colors">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <h1 className="font-serif text-2xl font-black text-[#D4AF37]">{agent.agency_name}</h1>
              <p className="text-[10px] uppercase tracking-widest opacity-60">Complete Account Ledger</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => downloadPDF(true)}
              className="inline-flex items-center gap-2 rounded-full border-none bg-navy px-5 py-2.5 text-[10px] font-black uppercase tracking-wider text-white hover:bg-navy/80 transition-all hover:shadow-lg active:scale-95 shadow-md"
            >
              <Printer className="h-3.5 w-3.5" /> Print
            </button>
            <button 
              onClick={downloadExcel}
              className="inline-flex items-center gap-2 rounded-full border-none bg-emerald-600 px-5 py-2.5 text-[10px] font-black uppercase tracking-wider text-white hover:bg-emerald-700 transition-all hover:shadow-lg active:scale-95 shadow-md"
            >
              <Table className="h-3.5 w-3.5" /> Excel
            </button>
            <button 
              onClick={() => downloadPDF(false)}
              className="inline-flex items-center gap-2 rounded-full border-none bg-red-600 px-5 py-2.5 text-[10px] font-black uppercase tracking-wider text-white hover:bg-red-700 transition-all hover:shadow-lg active:scale-95 shadow-md"
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
                <p className={`text-3xl font-serif font-black ${(agent.balance || 0) > 0 ? "text-[#D4AF37]" : "text-emerald-700"}`}>
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

        <div className="overflow-hidden rounded-xl border border-navy/10 bg-white shadow-lg">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#0D0D0D] text-[10px] uppercase text-[#D4AF37]">
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
                        className="rounded bg-emerald-600 p-1.5 text-white hover:bg-emerald-700 disabled:opacity-50"
                      >
                        <Save className="h-4 w-4" />
                      </button>
                      <button 
                        onClick={() => setIsAdding(false)}
                        className="rounded bg-red-600 p-1.5 text-white hover:bg-red-700"
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
                    {new Date(l.date).toLocaleDateString("en-GB").replace(/\//g, "-")}
                  </td>
                  <td className="px-6 py-4 font-medium uppercase text-navy text-[11px] max-w-md truncate">
                    {l.details}
                  </td>
                  <td className="px-6 py-4 text-right font-bold text-navy">
                    {(l.debit || 0).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-right font-bold text-emerald-700">
                    {(l.credit || 0).toLocaleString()}
                  </td>
                  <td className={`px-6 py-4 text-right font-black ${(l.balance || 0) > 0 ? "text-[#D4AF37]" : "text-emerald-700"}`}>
                    {(l.balance || 0).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-center">
                    {l.isManual ? (
                      <button 
                        onClick={() => {
                          if(confirm("Delete this manual record?")) deleteMutation.mutate(l.id);
                        }}
                        disabled={deleteMutation.isPending}
                        className="p-1.5 text-red-500 hover:bg-red-50 rounded transition-all opacity-0 group-hover:opacity-100"
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
                <td className="px-6 py-4 text-right text-emerald-700">
                  {agent.ledger.reduce((s: number, l: any) => s + (l.credit || 0), 0).toLocaleString()}
                </td>
                <td className={`px-6 py-4 text-right font-black ${(agent.balance || 0) > 0 ? "text-[#D4AF37]" : "text-emerald-700"}`}>
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
