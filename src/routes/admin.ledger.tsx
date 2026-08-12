import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { listAgentLedgersAdmin } from "@/lib/ledger-admin.functions";
import { AdminTabs } from "@/components/AdminTabs";
import { Wallet, Phone, Eye, Table, FileText, X } from "lucide-react";
import { useState } from "react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

export const Route = createFileRoute("/admin/ledger")({
  component: AdminLedgerPage,
});

function AdminLedgerPage() {
  const list = useServerFn(listAgentLedgersAdmin);
  const q = useQuery({ queryKey: ["admin-ledgers"], queryFn: () => list(), refetchInterval: 30000 });
  const [selectedAgent, setSelectedAgent] = useState<any>(null);

  const grandTotal = (q.data ?? []).reduce((s: number, a: any) => s + a.balance, 0);

  const downloadCSV = (agent: any) => {
    const headers = ["Date", "Details", "Debit", "Credit", "Balance"];
    const rows = agent.ledger.map((l: any) => [
      new Date(l.date).toLocaleDateString("en-GB").replace(/\//g, "-"),
      `"${l.details.replace(/"/g, '""')}"`,
      l.debit,
      l.credit,
      l.balance
    ].join(","));
    const blob = new Blob([[headers.join(","), ...rows].join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Ledger_${agent.agency_name}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  const downloadPDF = (agent: any) => {
    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFillColor(253, 251, 247);
    doc.rect(0, 0, doc.internal.pageSize.width, doc.internal.pageSize.height, "F");
    doc.setFontSize(22);
    doc.setTextColor(212, 175, 55);
    doc.text("ROHI INTERNATIONAL TRAVELS", 14, 20);
    doc.setFontSize(12);
    doc.setTextColor(100);
    doc.text(`LEDGER ACCOUNT: ${agent.agency_name.toUpperCase()}`, 14, 28);
    doc.text(`Contact: ${agent.contact}`, 14, 34);

    const rows = agent.ledger.map((l: any) => [
      new Date(l.date).toLocaleDateString("en-GB").replace(/\//g, "-"),
      l.details,
      l.debit.toLocaleString(),
      l.credit.toLocaleString(),
      l.balance.toLocaleString()
    ]);

    autoTable(doc, {
      startY: 40,
      head: [["Date", "Details", "Debit", "Credit", "Balance"]],
      body: rows,
      theme: "grid",
      headStyles: { fillColor: [13, 13, 13], textColor: [212, 175, 55] },
      columnStyles: { 1: { cellWidth: 140 } },
      foot: [["TOTAL", "", 
        agent.ledger.reduce((s: any, l: any) => s + l.debit, 0).toLocaleString(),
        agent.ledger.reduce((s: any, l: any) => s + l.credit, 0).toLocaleString(),
        agent.balance.toLocaleString()
      ]],
      footStyles: { fillColor: [253, 251, 247], textColor: [13, 13, 13], fontStyle: "bold" }
    });
    doc.save(`Ledger_${agent.agency_name}.pdf`);
  };

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

      <main className="mx-auto max-w-[1600px] p-6">
        <div className="mb-6 flex items-center justify-between">
            <h2 className="text-xl font-bold font-serif text-[#0D0D0D]">Agency Balances Overview</h2>
            <div className="rounded-xl bg-[#0D0D0D] px-6 py-4 text-white shadow-lg">
                <p className="text-[10px] font-black uppercase tracking-widest text-[#D4AF37]">Grand Total Outstanding</p>
                <p className="text-3xl font-serif font-black">{grandTotal.toLocaleString("en-PK")} PKR</p>
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
                    {a.balance.toLocaleString("en-PK")} PKR
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button onClick={() => setSelectedAgent(a)} className="text-xs bg-navy text-white px-3 py-1.5 rounded hover:bg-navy/90 flex items-center gap-1">
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

      {selectedAgent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-5xl rounded-2xl bg-[#FDFBF7] shadow-2xl">
            <div className="flex items-center justify-between border-b border-gold/20 bg-[#0D0D0D] p-6 text-white rounded-t-2xl">
              <div>
                <h3 className="text-2xl font-serif font-black text-[#D4AF37]">{selectedAgent.agency_name}</h3>
                <p className="text-xs opacity-60">Complete Ledger History</p>
              </div>
              <div className="flex items-center gap-4">
                <button onClick={() => downloadCSV(selectedAgent)} className="flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2 text-xs font-bold uppercase text-white hover:bg-emerald-700">
                  <Table className="h-3.5 w-3.5" /> CSV
                </button>
                <button onClick={() => downloadPDF(selectedAgent)} className="flex items-center gap-2 rounded-full bg-red-600 px-4 py-2 text-xs font-bold uppercase text-white hover:bg-red-700">
                  <FileText className="h-3.5 w-3.5" /> PDF
                </button>
                <button onClick={() => setSelectedAgent(null)} className="rounded-full bg-white/10 p-2 hover:bg-white/20">
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
            <div className="max-h-[70vh] overflow-y-auto p-6">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-navy/20 text-left text-xs font-bold uppercase tracking-wider text-navy">
                    <th className="pb-4">Date</th>
                    <th className="pb-4">Details</th>
                    <th className="pb-4 text-right">Debit</th>
                    <th className="pb-4 text-right">Credit</th>
                    <th className="pb-4 text-right">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedAgent.ledger.map((l: any, i: number) => (
                    <tr key={i} className="border-b border-navy/5 hover:bg-white/50">
                      <td className="py-3 text-xs text-muted-foreground">{new Date(l.date).toLocaleDateString("en-GB").replace(/\//g, "-")}</td>
                      <td className="py-3 font-medium uppercase text-navy text-[11px]">{l.details}</td>
                      <td className="py-3 text-right font-bold">{l.debit.toLocaleString()}</td>
                      <td className="py-3 text-right font-bold text-emerald-700">{l.credit.toLocaleString()}</td>
                      <td className="py-3 text-right font-black text-[#D4AF37]">{l.balance.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
