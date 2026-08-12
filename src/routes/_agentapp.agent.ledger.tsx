import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Wallet, TrendingUp, TrendingDown, Receipt, FileText, Table, Plane } from "lucide-react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

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

function fmtMoney(n: number, suffix = true) {
  if (!n && n !== 0) return "—";
  const abs = Math.abs(n);
  const formatted = abs.toLocaleString("en-PK");
  if (!suffix) return formatted;
  return `${formatted} ${n >= 0 ? "DR" : "CR"}`;
}

function fmt(iso: string) {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}-${d.toLocaleString("en-US", { month: "short" })}-${String(d.getFullYear()).slice(-2)}`;
}

function LedgerPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [agencyName, setAgencyName] = useState("Agent");
  const [agencyPhone, setAgencyPhone] = useState("");

  useEffect(() => {
    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      const uid = sess.session?.user?.id;
      if (!uid) return setLoading(false);
      
      const { data: profile } = await supabase
        .from("agent_profiles")
        .select("agency_name, phone")
        .eq("user_id", uid)
        .single();
      
      if (profile) {
        setAgencyName(profile.agency_name);
        setAgencyPhone(profile.phone);
      }

      const { data } = await supabase
        .from("agent_bookings")
        .select("id, created_at, seats, status, payment_status, ticket_status, fare_on_demand, fare_snapshot, passenger_names")
        .eq("agent_user_id", uid)
        .order("created_at", { ascending: true });
      
      setRows((data ?? []) as Row[]);
      setLoading(false);
    })();
  }, []);

  const entries = useMemo(() => {
    let balance = 0;
    return rows
      .filter((r) => r.status !== "cancelled")
      .map((r) => {
        const unit = numericFare(r.fare_on_demand) || numericFare(r.fare_snapshot?.price_text);
        const debit = unit * (r.seats ?? 0);
        const credit = r.payment_status === "confirmed" || r.payment_status === "paid" || r.payment_status === "ledger" ? debit : 0;
        balance += debit - credit;
        return { ...r, unit, debit, credit, balance };
      });
  }, [rows]);

  const totalDebit = entries.reduce((s, e) => s + e.debit, 0);
  const totalCredit = entries.reduce((s, e) => s + e.credit, 0);
  const netBalance = totalDebit - totalCredit;

  const downloadCSV = () => {
    const headers = ["Date", "Particulars", "Debit (-)", "Credit (+)", "Balance"];
    const csvRows = entries.map(e => {
      const f = e.fare_snapshot ?? {};
      const particulars = `${f.airline ?? "—"} ${f.origin_code ?? ""} to ${f.destination_code ?? ""} ${f.flight_date ?? ""} ${e.passenger_names ? `(${e.passenger_names.replace(/\n/g, " ")})` : ""}`;
      return [
        fmt(e.created_at),
        particulars,
        e.debit,
        e.credit,
        fmtMoney(e.balance)
      ].join(",");
    });
    const blob = new Blob([[headers.join(","), ...csvRows].join("\n")], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Ledger_${agencyName.replace(/\s+/g, "_")}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  const downloadPDF = () => {
    const doc = new jsPDF({ orientation: "landscape" });
    
    // Header Block (Red theme)
    doc.setFillColor(225, 29, 72); // Redish
    doc.rect(0, 0, 300, 30, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("ROHI INTERNATIONAL TRAVELS", 14, 12);
    doc.setFontSize(10);
    doc.text("0305 6622988", 14, 18);
    doc.setFontSize(24);
    doc.text("ROHI", 260, 20);

    // Title
    doc.setTextColor(17, 24, 39);
    doc.setFontSize(18);
    doc.text(`${agencyName} Statement`.toUpperCase(), 148.5, 45, { align: "center" });
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Phone Number: ${agencyPhone}`, 148.5, 52, { align: "center" });

    // Summary Table
    autoTable(doc, {
      startY: 60,
      head: [["No of Entries", "Total Debit (-)", "Total Credit (+)", "Net Balance"]],
      body: [[entries.length, fmtMoney(totalDebit), fmtMoney(totalCredit), fmtMoney(netBalance)]],
      theme: "grid",
      headStyles: { fillColor: [240, 240, 240], textColor: [100, 100, 100], fontSize: 9, halign: "center" },
      styles: { fontSize: 12, halign: "center", fontStyle: "bold" },
      columnStyles: {
        1: { textColor: [225, 29, 72] },
        2: { textColor: [16, 185, 129] },
        3: { textColor: [225, 29, 72] }
      }
    });

    // Main Ledger
    const tableRows = entries.map(e => {
      const f = e.fare_snapshot ?? {};
      const particulars = `${f.airline ?? "—"} · ${f.origin_code ?? ""} -> ${f.destination_code ?? ""}\n${f.flight_date ?? ""}${f.pnr ? ` · PNR: ${f.pnr}` : ""}${e.passenger_names ? `\n${e.passenger_names}` : ""}`;
      return [
        fmt(e.created_at),
        particulars,
        e.debit ? e.debit.toLocaleString() : "",
        e.credit ? e.credit.toLocaleString() : "",
        fmtMoney(e.balance)
      ];
    });

    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 10,
      head: [["Date", "Details", "Debit (-)", "Credit (+)", "Balance"]],
      body: tableRows,
      theme: "grid",
      headStyles: { fillColor: [243, 244, 246], textColor: [17, 24, 39], fontStyle: "bold" },
      styles: { fontSize: 8, cellPadding: 3 },
      columnStyles: {
        1: { cellWidth: 100 },
        2: { halign: "center", fillColor: [254, 242, 242] },
        3: { halign: "center", fillColor: [240, 253, 244] },
        4: { halign: "center", fontStyle: "bold" }
      }
    });

    doc.save(`Statement_${agencyName.replace(/\s+/g, "_")}_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  return (
    <div className="min-h-full bg-background p-4 md:p-6 font-sans">
      {/* Top Branding Header */}
      <div className="mb-6 overflow-hidden rounded-t-xl bg-[#e11d48] text-white shadow-sm">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 flex items-center justify-center rounded-lg bg-white/20">
               <Plane className="h-8 w-8 -rotate-45 text-white" />
            </div>
            <div>
              <h1 className="font-serif text-xl font-black leading-none md:text-2xl">Rohi International Travels</h1>
              <p className="mt-1 text-sm font-semibold opacity-90">0305 6622988</p>
            </div>
          </div>
          <div className="hidden items-baseline gap-2 md:flex">
             <span className="font-serif text-5xl font-black tracking-tighter opacity-40">ROHI</span>
          </div>
        </div>
      </div>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-4 px-1">
        <div>
          <h2 className="font-serif text-2xl font-black text-navy">{agencyName} Statement</h2>
          {agencyPhone && <p className="text-xs font-bold text-muted-foreground">Phone Number: {agencyPhone}</p>}
        </div>
        
        <div className="flex items-center gap-3">
          <button onClick={downloadCSV} className="btn-excel">
            <Table className="h-4 w-4" /> Excel
          </button>
          <button onClick={downloadPDF} className="btn-pdf">
            <FileText className="h-4 w-4" /> PDF
          </button>
          <Link to="/agent/bookings" className="ml-2 rounded-full border border-border bg-card px-5 py-2.5 text-xs font-black uppercase tracking-wider text-foreground hover:bg-secondary transition-colors">
            View bookings →
          </Link>
        </div>
      </div>

      {/* Summary Row */}
      <div className="mb-6 overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-border">
          <StatBox label="No of Entries" value={entries.length} />
          <StatBox label="Total Debit (-)" value={fmtMoney(totalDebit)} tone="red" />
          <StatBox label="Total Credit (+)" value={fmtMoney(totalCredit)} tone="green" />
          <StatBox label="Net Balance" value={fmtMoney(netBalance)} tone="red" />
        </div>
      </div>

      {/* Ledger Table */}
      <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-md sheet-paper">
        <table className="min-w-full text-sm ledger-figures">
          <thead>
            <tr className="bg-gray-100/80 border-b border-border text-[10px] uppercase tracking-[0.12em] text-foreground font-black">
              <th className="px-4 py-4 text-left w-24">Date</th>
              <th className="px-4 py-4 text-left">Details</th>
              <th className="px-4 py-4 text-center w-32">Debit (-)</th>
              <th className="px-4 py-4 text-center w-32">Credit (+)</th>
              <th className="px-4 py-4 text-center w-32">Balance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading ? (
              <tr><td colSpan={5} className="p-12 text-center text-muted-foreground animate-pulse">Loading secure ledger…</td></tr>
            ) : entries.length === 0 ? (
              <tr><td colSpan={5} className="p-20 text-center text-muted-foreground">
                <Receipt className="mx-auto h-12 w-12 opacity-20 mb-4" />
                No ledger entries yet. Confirmed bookings appear here automatically.
              </td></tr>
            ) : (
              <>
                {/* Opening Balance Row */}
                <tr className="bg-white/50">
                  <td className="px-4 py-3"></td>
                  <td className="px-4 py-3 text-right text-[11px] font-bold text-muted-foreground italic">(Opening Balance)</td>
                  <td className="px-4 py-3 bg-red-50/30"></td>
                  <td className="px-4 py-3 bg-emerald-50/30"></td>
                  <td className="px-4 py-3 text-center font-black text-red-700">0 DR</td>
                </tr>
                {entries.map((e, i) => {
                  const f = e.fare_snapshot ?? {};
                  return (
                    <tr key={e.id} className="group hover:bg-navy/5 transition-colors">
                      <td className="whitespace-nowrap px-4 py-4 text-[11px] font-bold text-muted-foreground">{fmt(e.created_at)}</td>
                      <td className="px-4 py-4">
                        <p className="text-[13px] font-black text-navy uppercase leading-tight">{f.airline ?? "—"} · {f.origin_code ?? ""} → {f.destination_code ?? ""}</p>
                        <p className="mt-0.5 text-[10.5px] text-muted-foreground font-semibold">{f.flight_date ?? ""}{f.pnr ? ` · PNR: ${f.pnr}` : ""}</p>
                        {e.passenger_names && (
                          <p className="mt-1.5 whitespace-pre-line text-[10px] font-bold uppercase leading-relaxed text-slate-700 border-l-2 border-gold/30 pl-2">{e.passenger_names}</p>
                        )}
                      </td>
                      <td className="px-4 py-4 text-center tabular-nums font-bold text-red-600 bg-red-50/30 group-hover:bg-red-100/40 transition-colors">
                        {e.debit ? e.debit.toLocaleString() : ""}
                      </td>
                      <td className="px-4 py-4 text-center tabular-nums font-bold text-emerald-600 bg-emerald-50/30 group-hover:bg-emerald-100/40 transition-colors">
                        {e.credit ? e.credit.toLocaleString() : ""}
                      </td>
                      <td className="px-4 py-4 text-center tabular-nums font-black text-red-700">
                        {fmtMoney(e.balance)}
                      </td>
                    </tr>
                  );
                })}
              </>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-6 flex items-start gap-3 rounded-lg bg-navy/5 p-4 border border-navy/10">
        <Receipt className="h-5 w-5 text-navy mt-0.5" />
        <p className="text-[11px] leading-relaxed text-slate-600 font-medium">
          <strong className="text-navy uppercase tracking-wider block mb-1">Accounting Notice:</strong>
          Debit (DR) is raised when a booking is confirmed. Credit (CR) is posted once payment is verified and added to our main ledger.
          Values shown in red (DR) represent outstanding amounts. Green (CR) indicates successful payments.
        </p>
      </div>
    </div>
  );
}

function StatBox({ label, value, tone }: { label: string; value: string | number; tone?: "red" | "green" }) {
  const valueCls = tone === "red" ? "text-red-600" : tone === "green" ? "text-emerald-600" : "text-navy";
  return (
    <div className="px-6 py-4">
      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">{label}</p>
      <p className={`text-xl font-black font-serif ${valueCls}`}>{value}</p>
    </div>
  );
}
