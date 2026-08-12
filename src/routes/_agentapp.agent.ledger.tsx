import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Wallet, TrendingUp, TrendingDown, Receipt, Download, FileText, Table } from "lucide-react";
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

function money(n: number) {
  return n ? `PKR ${n.toLocaleString("en-PK")}` : "—";
}

function fmt(iso: string) {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}-${d.toLocaleString("en-US", { month: "short" })}-${d.getFullYear()}`;
}

function LedgerPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      const uid = sess.session?.user?.id;
      if (!uid) return setLoading(false);
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
        // Fare On Demand (typed by admin) always wins over the listed fare text.
        const unit = numericFare(r.fare_on_demand) || numericFare(r.fare_snapshot?.price_text);
        const debit = unit * (r.seats ?? 0);
        const credit = r.payment_status === "confirmed" || r.payment_status === "paid" || r.payment_status === "ledger" ? debit : 0;

        balance += debit - credit;
        return { ...r, unit, debit, credit, balance };
      });
  }, [rows]);

  const totalDebit = entries.reduce((s, e) => s + e.debit, 0);
  const totalCredit = entries.reduce((s, e) => s + e.credit, 0);
  const outstanding = totalDebit - totalCredit;

  const downloadCSV = () => {
    const headers = ["Date", "Details", "Debit", "Credit", "Balance"];
    const csvRows = entries.map(e => {
      const f = e.fare_snapshot ?? {};
      const paxCount = (e.passenger_names?.split("\n").filter(Boolean).length) || e.seats || 0;
      const firstPax = e.passenger_names?.split("\n")[0]?.trim() || "Pax";
      const paxDisplay = paxCount > 1 ? `${firstPax}*${paxCount}` : firstPax;
      
      const airlineMap: Record<string, string> = { "SALAM AIR": "OV", "PIA": "PK", "AIRBLUE": "PA", "SERENE AIR": "ER", "AIRSIAL": "PF", "FLYDUBAI": "FZ", "AIR ARABIA": "G9" };
      const airlineName = String(f.airline ?? "").toUpperCase();
      const airlineCode = f.airline_code || airlineMap[airlineName] || airlineName;

      const details = `GRP TKT ${paxDisplay} - ${f.origin_code ?? ""} ${f.destination_code ?? ""} - ${f.pnr ?? "—"} - ${airlineCode}`;

      return [
        fmt(e.created_at),
        `"${details.replace(/"/g, '""')}"`,
        e.debit,
        e.credit,
        e.balance
      ].join(",");
    });
    const blob = new Blob([[headers.join(","), ...csvRows].join("\n")], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Ledger_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  const downloadPDF = () => {
    const doc = new jsPDF({ orientation: "landscape" });
    
    // Branding
    doc.setFontSize(22);
    doc.setTextColor(13, 13, 13); // Black
    doc.setFillColor(253, 251, 247); // Cream background
    doc.rect(0, 0, doc.internal.pageSize.width, doc.internal.pageSize.height, "F");

    doc.setTextColor(212, 175, 55); // Gold
    doc.text("ROHI INTERNATIONAL TRAVELS", 14, 20);
    
    doc.setFontSize(12);
    doc.setTextColor(100);
    doc.text("B2B AGENT LEDGER REPORT", 14, 28);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 34);

    const tableRows = entries.map(e => {
      const f = e.fare_snapshot ?? {};
      const paxCount = (e.passenger_names?.split("\n").filter(Boolean).length) || e.seats || 0;
      const firstPax = e.passenger_names?.split("\n")[0]?.trim() || "Pax";
      const paxDisplay = paxCount > 1 ? `${firstPax}*${paxCount}` : firstPax;
      
      const airlineMap: Record<string, string> = { "SALAM AIR": "OV", "PIA": "PK", "AIRBLUE": "PA", "SERENE AIR": "ER", "AIRSIAL": "PF", "FLYDUBAI": "FZ", "AIR ARABIA": "G9" };
      const airlineName = String(f.airline ?? "").toUpperCase();
      const airlineCode = f.airline_code || airlineMap[airlineName] || airlineName;

      const details = `GRP TKT ${paxDisplay} - ${f.origin_code ?? ""} ${f.destination_code ?? ""} - ${f.pnr ?? "—"} - ${airlineCode}`;

      return [
        fmt(e.created_at),
        particulars,
        e.debit ? e.debit.toLocaleString() : "—",
        e.credit ? e.credit.toLocaleString() : "—",
        e.balance.toLocaleString()
      ];
    });

    autoTable(doc, {
      startY: 40,
      head: [["Date", "Details", "Debit", "Credit", "Balance"]],
      body: tableRows,
      theme: "grid",
      headStyles: { fillColor: [13, 13, 13], textColor: [212, 175, 55], fontStyle: "bold" },
      styles: { fontSize: 9, cellPadding: 4 },
      columnStyles: {
        1: { cellWidth: 140 },
        2: { halign: "right" },
        3: { halign: "right" },
        4: { halign: "right", fontStyle: "bold" }
      },
      foot: [["TOTAL", "", totalDebit.toLocaleString(), totalCredit.toLocaleString(), outstanding.toLocaleString()]],
      footStyles: { fillColor: [240, 240, 240], textColor: [1, 31, 75], fontStyle: "bold" }
    });

    doc.save(`Ledger_Report_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  return (
    <div className="min-h-full bg-background p-4 md:p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex items-center gap-3 rounded-lg bg-navy px-4 py-2.5 text-navy-foreground shadow-sm">
          <Wallet className="h-4 w-4 text-gold" />
          <div>
            <p className="font-serif text-base font-black leading-none">Accounts &amp; Ledger</p>
            <p className="mt-1 text-[10px] uppercase tracking-[0.2em] text-white/60">B2B Agent Portal</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button 
            onClick={downloadCSV}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-xs font-black uppercase tracking-wider text-foreground hover:bg-secondary transition-colors"
          >
            <Table className="h-3.5 w-3.5" /> CSV
          </button>
          <button 
            onClick={downloadPDF}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-xs font-black uppercase tracking-wider text-foreground hover:bg-secondary transition-colors"
          >
            <FileText className="h-3.5 w-3.5" /> PDF
          </button>
          <Link to="/agent/bookings" className="ml-2 rounded-full border border-border bg-card px-5 py-2.5 text-xs font-black uppercase tracking-wider text-foreground hover:bg-secondary transition-colors">
            View bookings →
          </Link>
        </div>
      </div>

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <Stat label="Total Billed" value={money(totalDebit)} icon={<Receipt className="h-4 w-4" />} tone="navy" />
        <Stat label="Paid / Confirmed" value={money(totalCredit)} icon={<TrendingUp className="h-4 w-4" />} tone="green" />
        <Stat label="Outstanding Balance" value={money(outstanding)} icon={<TrendingDown className="h-4 w-4" />} tone="amber" />
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-navy text-[10px] uppercase tracking-[0.12em] text-navy-foreground">
              <th className="px-6 py-4 text-left font-bold">Date</th>
              <th className="px-6 py-4 text-left font-bold">Particulars</th>
              <th className="px-6 py-4 text-right font-bold">Debit</th>
              <th className="px-6 py-4 text-right font-bold">Credit</th>
              <th className="px-6 py-4 text-right font-bold">Balance</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">Loading…</td></tr>
            ) : entries.length === 0 ? (
              <tr><td colSpan={5} className="p-10 text-center text-muted-foreground">
                No ledger entries yet. Confirmed bookings appear here automatically.
              </td></tr>
            ) : entries.map((e, i) => {
              const f = e.fare_snapshot ?? {};
              const paxCount = (e.passenger_names?.split("\n").filter(Boolean).length) || e.seats || 0;
              const firstPax = e.passenger_names?.split("\n")[0]?.trim() || "Pax";
              const paxDisplay = paxCount > 1 ? `${firstPax}*${paxCount}` : firstPax;

              return (
                <tr key={e.id} className={`border-t border-border ${i % 2 ? "bg-secondary/40" : ""}`}>
                  <td className="whitespace-nowrap px-6 py-4 text-[11px] font-semibold text-muted-foreground">{fmt(e.created_at)}</td>
                  <td className="px-6 py-4">
                    <p className="text-[12px] font-black text-navy uppercase tracking-tight">
                      GROUP TKT({paxDisplay} - {f.origin_code ?? ""} {f.destination_code ?? ""} - {f.pnr ?? "—"} - {f.airline_code ?? f.airline ?? "—"})
                    </p>
                  </td>
                  <td className="px-6 py-4 text-right tabular-nums font-bold text-navy">{e.debit ? e.debit.toLocaleString("en-PK") : "—"}</td>
                  <td className="px-6 py-4 text-right tabular-nums font-bold text-emerald-700">{e.credit ? e.credit.toLocaleString("en-PK") : "—"}</td>
                  <td className="px-6 py-4 text-right tabular-nums font-black text-[color:var(--ledger-brown)]">{e.balance.toLocaleString("en-PK")}</td>
                </tr>
              );
            })}
          </tbody>
          {entries.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-navy/20 bg-secondary/60 text-[12px] font-black text-navy">
                <td className="px-6 py-4" colSpan={2}>TOTAL</td>
                <td className="px-6 py-4 text-right tabular-nums">{totalDebit.toLocaleString("en-PK")}</td>
                <td className="px-6 py-4 text-right tabular-nums text-emerald-700">{totalCredit.toLocaleString("en-PK")}</td>
                <td className="px-6 py-4 text-right tabular-nums">{outstanding.toLocaleString("en-PK")}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      <p className="mt-3 text-[11px] text-muted-foreground">
        Debit is raised when a booking is submitted. Credit is posted once our team marks the payment as confirmed.
        Fares quoted as "Fare on WhatsApp" carry no amount until a rate is agreed.
      </p>
    </div>
  );
}

function Stat({ label, value, icon, tone }: { label: string; value: string; icon: React.ReactNode; tone: "navy" | "green" | "amber" }) {
  const cls = tone === "green"
    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
    : tone === "amber"
      ? "border-amber-200 bg-amber-50 text-amber-800"
      : "border-border bg-card text-navy";
  return (
    <div className={`rounded-xl border p-4 shadow-sm ${cls}`}>
      <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] opacity-80">
        {icon} {label}
      </div>
      <p className="mt-2 font-serif text-2xl font-black">{value}</p>
    </div>
  );
}
