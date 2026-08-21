import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Wallet, TrendingUp, TrendingDown, Receipt, Download, FileText, Table, Printer } from "lucide-react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { useReactToPrint } from "react-to-print";
import ExcelJS from "exceljs";

export const Route = createFileRoute("/_agentapp/agent/ledger")({
  ssr: false,
  component: LedgerPage,
});

type Row = {
  id: string;
  created_at: string;
  seats: number;
  status: string;
  payment_status: string;
  ticket_status: string;
  fare_on_demand: string | null;
  fare_snapshot: any;
  passenger_names: string | null;
};


function numericFare(text: unknown): number {
  const digits = String(text ?? "").replace(/[^0-9]/g, "");
  return digits ? parseInt(digits, 10) : 0;
}

function money(n: number) {
  return n ? `PKR ${n.toLocaleString("en-PK")}` : "—";
}

function fmt(iso: string) {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  return `${p(d.getDate())}-${months[d.getMonth()]}-${String(d.getFullYear()).slice(-2)}`;
}

function LedgerPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [agentName, setAgentName] = useState("");
  const [showAgencyHeader, setShowAgencyHeader] = useState(true);
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    downloadPDF(true);
  };

  useEffect(() => {
    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      const uid = sess.session?.user?.id;
      if (!uid) return setLoading(false);
      
      const { data: profile } = await supabase.from("profiles").select("agency_name").eq("id", uid).single();
      if (profile) setAgentName(profile.agency_name || "");
      const { data: bookings } = await supabase
        .from("agent_bookings")
        .select("id, created_at, seats, status, payment_status, ticket_status, fare_on_demand, fare_snapshot, passenger_names")
        .eq("agent_user_id", uid)
        .order("created_at", { ascending: true });
      
      const { data: manualEntries } = await supabase
        .from("ledger_manual_entries")
        .select("*")
        .eq("agent_user_id", uid)
        .order("date", { ascending: true });

      const combined = [
        ...(bookings ?? []).map((b: any) => ({ type: 'booking' as const, ...b })),
        ...(manualEntries ?? []).map((m: any) => ({ type: 'manual' as const, ...m, created_at: m.date }))
      ].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());


      setRows(combined as any[]);

      setLoading(false);
    })();
  }, []);

  const entries = useMemo(() => {
    let balance = 0;
    const airlineMap: Record<string, string> = { "SALAM AIR": "OV", "PIA": "PK", "AIRBLUE": "PA", "SERENE AIR": "ER", "AIRSIAL": "PF", "FLYDUBAI": "FZ", "AIR ARABIA": "G9" };

    return rows
      .filter((r: any) => r.status !== "cancelled")
      .map((r: any) => {
        let debit = 0;
        let credit = 0;
        let details = "";
        let date = r.created_at;

        if (r.type === 'booking') {
          const unit = numericFare(r.fare_on_demand) || numericFare(r.fare_snapshot?.price_text);
          debit = unit * (r.seats ?? 0);
          credit = r.payment_status === "confirmed" || r.payment_status === "paid" || r.payment_status === "ledger" ? debit : 0;
          
          const f = r.fare_snapshot ?? {};
          const paxCount = (r.passenger_names?.split("\n").filter(Boolean).length) || r.seats || 0;
          const firstPax = r.passenger_names?.split("\n")[0]?.trim() || "Pax";
          const paxDisplay = paxCount > 1 ? `${firstPax}*${paxCount}` : firstPax;
          const airlineName = String(f.airline ?? "").toUpperCase();
          const airlineCode = f.airline_code || airlineMap[airlineName] || airlineName;
          details = `GRP TKT ${paxDisplay} - ${f.origin_code ?? ""} ${f.destination_code ?? ""} - ${f.pnr ?? "—"} - ${airlineCode}`;
        } else {
          debit = r.debit || 0;
          credit = r.credit || 0;
          details = r.details || "";
          date = r.date;
        }

        balance += (debit - credit);
        return { ...r, debit, credit, balance, details, date };
      });
  }, [rows]);


  const totalDebit = entries.reduce((s, e) => s + e.debit, 0);
  const totalCredit = entries.reduce((s, e) => s + e.credit, 0);
  const outstanding = totalDebit - totalCredit;

  const downloadCSV = async () => {
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
    agentCell.value = `Agent: ${(agentName || "ROHI INTERNATIONAL TRAVELS").toUpperCase()}`;
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

    // Data Rows
    entries.forEach((e) => {
      const row = worksheet.addRow([
        fmt(e.date),
        e.details,
        e.debit || 0,
        e.credit || 0,
        e.balance
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
    const totalsRow = worksheet.addRow(["TOTAL", "", totalDebit, totalCredit, outstanding]);
    totalsRow.eachCell((cell, colNumber) => {
      cell.font = { bold: true };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF0F0F0" } };
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.border = { top: { style: "thin" }, left: { style: "thin" }, bottom: { style: "thin" }, right: { style: "thin" } };
      if (colNumber >= 3) cell.numFmt = "#,##0";
    });

    // Auto-fit columns
    worksheet.columns.forEach((column, i) => {
      let maxColumnLength = 0;
      column.eachCell?.({ includeEmpty: true }, (cell) => {
        const columnLength = cell.value ? cell.value.toString().length : 0;
        if (columnLength > maxColumnLength) {
          maxColumnLength = columnLength;
        }
      });
      column.width = maxColumnLength < 12 ? 12 : maxColumnLength + 5;
    });

    // Write to buffer and download
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Ledger_Report_${new Date().toISOString().slice(0, 10)}.xlsx`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const downloadPDF = (isPrint = false) => {
    const doc = new jsPDF({ orientation: "landscape" });
    
    // Previous ledger style: Classic grid with white background
    doc.setFontSize(22);
    doc.setTextColor(13, 13, 13); // Black

    doc.setTextColor(212, 175, 55); // Gold
    doc.text("ROHI INTERNATIONAL TRAVELS", 14, 20);
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text("Sardar Market Shahi Road Rahim Yar Khan", 14, 26);
    doc.text("Contact No. 0305-6622988", 14, 31);

    doc.setFontSize(14);
    doc.setTextColor(13, 13, 13);
    doc.setFont("helvetica", "bold");
    doc.text(`Agent: ${(agentName || "ROHI INTERNATIONAL TRAVELS").toUpperCase()}`, 14, 42);
    doc.setFont("helvetica", "normal");

    doc.setFontSize(10);
    doc.setTextColor(100);
    const now = new Date();
    const p = (n: number) => String(n).padStart(2, "0");
    const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
    const timestamp = `${p(now.getDate())}-${months[now.getMonth()]}-${String(now.getFullYear()).slice(-2)} ${now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true })}`;
    doc.text(`Generated: ${timestamp}`, 14, 48);

    const tableRows = entries.map(e => {
      return [
        fmt(e.date),
        e.details,
        e.debit ? e.debit.toLocaleString() : "—",
        e.credit ? e.credit.toLocaleString() : "—",
        e.balance.toLocaleString()
      ];
    });

    autoTable(doc, {
      startY: 60,
      head: [["Date", "Details", "Debit", "Credit", "Balance"]],
      body: tableRows,
      theme: "grid",
      headStyles: { fillColor: [13, 13, 13], textColor: [255, 255, 255], fontStyle: "bold" },
      styles: { fontSize: 9, cellPadding: 4 },
      columnStyles: {
        1: { cellWidth: 140 },
        2: { halign: "center" },
        3: { halign: "center" },
        4: { halign: "center", fontStyle: "bold" }
      },
      foot: [["TOTAL", "", totalDebit.toLocaleString(), totalCredit.toLocaleString(), outstanding.toLocaleString()]],
      footStyles: { fillColor: [240, 240, 240], textColor: [13, 13, 13], fontStyle: "bold", halign: "center" },
      // Disable repeat header on every page
      showHead: 'firstPage',
      // Show footer only on the last page
      showFoot: 'lastPage'
    });

    if (isPrint) {
      doc.autoPrint();
      window.open(doc.output('bloburl'), '_blank');
    } else {
      doc.save(`Ledger_Report_${new Date().toISOString().slice(0, 10)}.pdf`);
    }
  };

  return (
    <div className="min-h-full bg-[#FDFBF7] pb-24">
      {/* Print-only CSS to handle page headers */}
      <style>{`
        @media print {
          .print-header { display: block !important; }
          .no-print { display: none !important; }
          @page { size: landscape; margin: 10mm; }
          body { background: white !important; }
          .print-container { padding: 0 !important; width: 100% !important; max-width: none !important; }
          thead { display: table-header-group; }
          tfoot { display: table-footer-group; }
          /* Only show table header on first page for browser print if possible */
          /* Note: Browser support for hiding table headers on subsequent pages is limited in native print */
        }
        .print-header { display: none; }
      `}</style>

      {/* Header section with max-width to create side space */}
      <div className="mx-auto max-w-7xl px-4 md:px-8 py-6 no-print">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex items-center gap-3 rounded-lg bg-[#0D0D0D] px-5 py-3 text-white shadow-xl border-l-4 border-[#D4AF37]">
            <Wallet className="h-5 w-5 text-[#D4AF37]" />
            <div>
              <p className="font-serif text-lg font-black leading-none text-[#D4AF37] tracking-tight">Accounts &amp; Ledger</p>
              <p className="mt-1 text-[10px] uppercase tracking-[0.25em] text-white/50">Official Statement</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="mr-4 flex items-center gap-2 rounded-lg bg-white/50 px-3 py-2 ring-1 ring-navy/10">
              <input 
                type="checkbox" 
                id="agencyHeader" 
                checked={showAgencyHeader} 
                onChange={(e) => setShowAgencyHeader(e.target.checked)}
                className="h-4 w-4 rounded border-navy/20 text-navy focus:ring-navy"
              />
              <label htmlFor="agencyHeader" className="text-[10px] font-bold uppercase tracking-widest text-navy/60">Professional Header</label>
            </div>
            
            <button 
              onClick={handlePrint}
              className="inline-flex items-center gap-2 rounded-full border-none bg-navy px-5 py-2.5 text-[10px] font-black uppercase tracking-wider text-white hover:bg-navy/80 transition-all hover:shadow-lg active:scale-95 shadow-md"
            >
              <Printer className="h-3.5 w-3.5" /> Print
            </button>
            <button 
              onClick={downloadCSV}
              className="inline-flex items-center gap-2 rounded-full border-none bg-emerald-600 px-5 py-2.5 text-[10px] font-black uppercase tracking-wider text-white hover:bg-emerald-700 transition-all hover:shadow-lg active:scale-95 shadow-md"
            >
              <Table className="h-3.5 w-3.5" /> Excel
            </button>
            <button 
              onClick={downloadPDF}
              className="inline-flex items-center gap-2 rounded-full border-none bg-red-600 px-5 py-2.5 text-[10px] font-black uppercase tracking-wider text-white hover:bg-red-700 transition-all hover:shadow-lg active:scale-95 shadow-md"
            >
              <FileText className="h-3.5 w-3.5" /> PDF
            </button>
            <Link to="/agent/bookings" className="ml-2 rounded-full border border-navy/20 bg-white px-5 py-2.5 text-[10px] font-black uppercase tracking-wider text-navy hover:bg-[#0D0D0D] hover:text-white transition-all shadow-md">
              View bookings →
            </Link>
          </div>
        </div>

        <div className="mb-10 grid gap-6 sm:grid-cols-3">
          <Stat label="Total" value={money(totalDebit)} icon={<Receipt className="h-4 w-4" />} tone="navy" />
          <Stat label="Paid" value={money(totalCredit)} icon={<TrendingUp className="h-4 w-4" />} tone="green" />
          <Stat label="Balance" value={money(outstanding)} icon={<TrendingDown className="h-4 w-4" />} tone="amber" />
        </div>

        <div className="overflow-hidden rounded-2xl border border-navy/10 bg-white shadow-2xl" ref={printRef}>
          {showAgencyHeader && (
            <div className="print-header p-8 border-b-2 border-navy bg-white">
              <div className="text-center space-y-2">
                <h1 className="font-serif text-4xl font-black text-navy tracking-tighter uppercase">ROHI INTERNATIONAL TRAVELS</h1>
                <p className="text-sm font-bold text-navy/70 tracking-[0.3em] uppercase">Sardar Market Shahi Road Rahim Yar Khan</p>
                <div className="flex justify-center gap-8 py-2 border-y border-navy/10 mt-2">
                  <p className="text-sm font-black text-navy">Contact: 0305-6622988</p>
                  <p className="text-sm font-black text-navy uppercase">Agent: <span className="text-gold underline decoration-2 underline-offset-4">{(agentName || "ROHI INTERNATIONAL TRAVELS").toUpperCase()}</span></p>
                </div>
                <p className="text-[10px] font-bold text-navy/40 uppercase tracking-[0.5em] pt-2">
                  Generated: {(() => {
                    const now = new Date();
                    const p = (n: number) => String(n).padStart(2, "0");
                    const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
                    return `${p(now.getDate())}-${months[now.getMonth()]}-${String(now.getFullYear()).slice(-2)} ${now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true })}`;
                  })()}
                </p>
              </div>
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm border-collapse">
              <thead>
                <tr className="bg-[#0D0D0D] text-[10px] uppercase tracking-[0.15em] text-[#D4AF37]">
                  <th className="px-6 py-4 text-left font-bold w-[120px]">Date</th>
                  <th className="px-6 py-4 text-left font-bold">Transaction Details</th>
                   <th className="px-6 py-4 text-center font-bold w-[130px]">Debit</th>
                  <th className="px-6 py-4 text-center font-bold w-[130px]">Credit</th>
                  <th className="px-6 py-4 text-center font-bold w-[140px]">Net Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy/5">
                {loading ? (
                  <tr><td colSpan={5} className="p-16 text-center text-muted-foreground animate-pulse font-serif italic text-lg">Retrieving records...</td></tr>
                ) : entries.length === 0 ? (
                  <tr><td colSpan={5} className="p-20 text-center text-muted-foreground">
                    <Receipt className="h-12 w-12 mx-auto mb-4 opacity-10" />
                    <p className="font-serif text-lg italic">No ledger entries found in the archive.</p>
                  </td></tr>
                ) : entries.map((e, i) => {
                  return (
                    <tr key={e.id || i} className={`${i % 2 ? "bg-[#FDFBF7]/50" : "bg-white"} hover:bg-[#D4AF37]/5 transition-colors group`}>
                      <td className="whitespace-nowrap px-6 py-4 text-[10px] font-bold text-navy/60 group-hover:text-navy">{fmt(e.date)}</td>
                      <td className="px-6 py-4">
                        <p className="text-[10px] font-bold text-navy uppercase tracking-tight leading-relaxed max-w-md">
                          {e.details}
                        </p>
                      </td>
                      <td className="px-6 py-4 text-center tabular-nums font-bold text-navy text-[12px]">{e.debit ? e.debit.toLocaleString("en-PK") : "—"}</td>
                      <td className="px-6 py-4 text-center tabular-nums font-bold text-emerald-700 text-[12px]">{e.credit ? e.credit.toLocaleString("en-PK") : "—"}</td>
                      <td className="px-6 py-4 text-center tabular-nums font-black text-[#D4AF37] text-[13px] bg-[#0D0D0D]/[0.02]">{e.balance.toLocaleString("en-PK")}</td>
                    </tr>
                  );
                })}
              </tbody>
              {entries.length > 0 && (
                <tfoot className="no-print">
                  <tr className="border-t-4 border-[#0D0D0D] bg-[#0D0D0D] text-[11px] font-black text-[#D4AF37] uppercase tracking-widest">
                    <td className="px-6 py-5" colSpan={2}>Aggregate Totals</td>
                    <td className="px-6 py-5 text-center tabular-nums">{totalDebit.toLocaleString("en-PK")}</td>
                    <td className="px-6 py-5 text-center tabular-nums">{totalCredit.toLocaleString("en-PK")}</td>
                    <td className="px-6 py-5 text-center tabular-nums text-white text-[14px]">{outstanding.toLocaleString("en-PK")}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>

        <div className="mt-8 flex items-start gap-3 rounded-lg border border-navy/5 bg-navy/[0.02] p-4 no-print">
          <div className="rounded-full bg-navy/10 p-1 mt-0.5">
            <Receipt className="h-3 w-3 text-navy/40" />
          </div>
          <p className="text-[11px] leading-relaxed text-muted-foreground max-w-3xl italic">
            <strong>Statement Note:</strong> Debit entries are automatically generated upon booking submission. Credit entries are reconciled and posted once the transaction is verified by the accounts department. 
            "Fare on WhatsApp" entries represent pending valuations and will be updated upon final rate confirmation.
          </p>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, icon, tone }: { label: string; value: string; icon: React.ReactNode; tone: "navy" | "green" | "amber" }) {
  const cls = tone === "green"
    ? "border-emerald-200 bg-emerald-50 text-emerald-800 shadow-emerald-900/5"
    : tone === "amber"
      ? "border-amber-200 bg-amber-50 text-amber-800 shadow-amber-900/5"
      : "border-navy/10 bg-white text-navy shadow-navy-900/5";
  
  return (
    <div className={`rounded-2xl border p-6 shadow-xl transition-transform hover:-translate-y-1 duration-300 ${cls}`}>
      <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] opacity-60">
        <span className="p-1.5 rounded-lg bg-current/10">{icon}</span> {label}
      </div>
      <p className="mt-4 font-serif text-3xl font-black tracking-tight">{value}</p>
    </div>
  );
}
