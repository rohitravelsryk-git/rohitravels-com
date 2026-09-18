import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useRef } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Receipt, FileDown, FileSpreadsheet, Printer } from "lucide-react";
import { useReactToPrint } from "react-to-print";
import { Button } from "@/components/ui/button";
import { downloadExcel, downloadPdf, type ExportTable } from "@/lib/table-export";

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
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Ledger - ${agentName || "Agent"}`,
    pageStyle: "@page { size: A4 portrait; margin: 12mm; }",
  });

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const load = async (uid: string) => {
      // Both reads run together so the ledger paints in one round-trip.
      const [{ data: bookings }, { data: manualEntries }] = await Promise.all([
        supabase
          .from("agent_bookings")
          .select("id, created_at, seats, status, payment_status, ticket_status, fare_on_demand, fare_snapshot, passenger_names")
          .eq("agent_user_id", uid)
          // Only confirmed bookings post a debit to the ledger (same rule as the
          // admin ledger), so nothing is recorded until Confirm succeeds.
          .eq("status", "confirmed")
          .order("created_at", { ascending: true }),
        supabase
          .from("ledger_manual_entries")
          .select("*")
          .eq("agent_user_id", uid)
          .order("date", { ascending: true }),
      ]);

      const combined = [
        ...(bookings ?? []).map((b: any) => ({ type: 'booking' as const, ...b })),
        ...(manualEntries ?? []).map((m: any) => ({ type: 'manual' as const, ...m, created_at: m.date }))
      ].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

      setRows(combined as any[]);
      setLoading(false);
    };

    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      const uid = sess.session?.user?.id;
      if (!uid) return setLoading(false);

      // Agency name is only used in the header, so it never delays the table.
      supabase
        .from("agents")
        .select("agency_name")
        .eq("user_id", uid)
        .maybeSingle()
        .then(({ data: profile }: { data: { agency_name: string | null } | null }) => {
          if (profile) setAgentName(profile.agency_name || "");
        });

      await load(uid);

      channel = supabase
        .channel("agent-ledger-realtime")
        .on("postgres_changes", { event: "*", schema: "public", table: "agent_bookings", filter: `agent_user_id=eq.${uid}` }, () => load(uid))
        .on("postgres_changes", { event: "*", schema: "public", table: "ledger_manual_entries", filter: `agent_user_id=eq.${uid}` }, () => load(uid))
        .subscribe();
    })();

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
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
          // Bookings never auto-credit the ledger — credits come only from
          // manual entries recorded by admin (same source as Admin Ledger).
          credit = 0;
          
          const f = r.fare_snapshot ?? {};
          const paxCount = (r.passenger_names?.split("\n").filter(Boolean).length) || r.seats || 0;
          const firstPax = r.passenger_names?.split("\n")[0]?.trim() || "Pax";
          const paxDisplay = paxCount > 1 ? `${firstPax}*${paxCount}` : firstPax;
          const airlineName = String(f.airline ?? "").toUpperCase();
          const airlineCode = f.airline_code || airlineMap[airlineName] || airlineName;
          details = `GRP TKT ${paxDisplay} - ${f.origin_code ?? ""} ${f.destination_code ?? ""} - ${airlineCode}`;
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

  const exportData = (): ExportTable => ({
    title: `${agentName || "Agent"} — Ledger Statement`,
    subtitle: `Rohi International Travels • Balance due ${money(outstanding)} • Generated ${new Date().toLocaleString()} • ${entries.length} entries`,
    headers: ["Date", "Details", "Debit (PKR)", "Credit (PKR)", "Balance (PKR)"],
    rows: [
      ...entries.map((entry) => [fmt(entry.date), entry.details, entry.debit || 0, entry.credit || 0, entry.balance]),
      ["TOTAL", "Aggregate totals", totalDebit, totalCredit, outstanding],
    ],
    numericColumns: [2, 3, 4],
  });

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="min-h-full bg-background pb-24"
    >
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
          .on-screen-header { display: block !important; }
        }
        .print-header { display: none; }
      `}</style>

      {/* Header section with max-width to create side space */}
      <div className="mx-auto max-w-7xl px-4 md:px-8 py-6 no-print">
        <div className="on-screen-header mb-8 text-center space-y-2 border-b-2 border-navy/10 pb-6 hidden">
          <h1 className="font-serif text-4xl font-black text-navy tracking-tighter uppercase">ROHI INTERNATIONAL TRAVELS</h1>
          <p className="text-sm font-bold text-navy/70 tracking-[0.3em] uppercase">Sardar Market Shahi Road Rahim Yar Khan</p>
          <div className="flex justify-center gap-8 py-2 border-y border-navy/10 mt-2">
            <p className="text-sm font-black text-navy">Contact: 0305-6622988</p>
            <p className="text-sm font-black text-navy uppercase">Agent: <span className="text-gold underline decoration-2 underline-offset-4">{agentName}</span></p>
          </div>
        </div>

        <div className="mb-5 flex flex-wrap items-end justify-between gap-4 border-b-[3px] border-double border-navy pb-4">
          <div>
            <h1 className="font-serif text-2xl font-black leading-none tracking-tight text-navy">{agentName}</h1>
            <p className="mt-1.5 text-[10px] font-bold uppercase tracking-[0.3em] text-navy/50">Account Statement</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-navy/50">Balance Due</p>
            <p className="font-serif text-2xl font-black leading-none text-gold">{money(outstanding)}</p>
          </div>
        </div>

        <div className="mb-5 flex flex-wrap items-center justify-end gap-1.5">
          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 rounded-md border-none bg-navy px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-white transition-all hover:bg-navy/80 active:scale-95"
          >
            <Printer className="h-3 w-3" /> Print
          </button>
          <button
            onClick={downloadCSV}
            className="inline-flex items-center gap-1.5 rounded-md border-none bg-emerald-600 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-white transition-all hover:bg-emerald-700 active:scale-95"
          >
            <Table className="h-3 w-3" /> Excel
          </button>
          <button
            onClick={() => downloadPDF(false)}
            className="inline-flex items-center gap-1.5 rounded-md border-none bg-red-600 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-white transition-all hover:bg-red-700 active:scale-95"
          >
            <FileText className="h-3 w-3" /> PDF
          </button>
          <Link to="/agent/bookings" className="ml-1 rounded-md border border-navy/20 bg-white px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-navy transition-all hover:bg-navy hover:text-white">
            View bookings →
          </Link>
        </div>

        <div className="overflow-hidden rounded-lg border border-navy/10 bg-white shadow-lg" ref={printRef}>
          {showAgencyHeader && (
            <div className="print-header p-8 border-b-2 border-navy bg-white">
              <div className="text-center space-y-2">
                <h1 className="font-serif text-4xl font-black text-navy tracking-tighter uppercase">ROHI INTERNATIONAL TRAVELS</h1>
                <p className="text-sm font-bold text-navy/70 tracking-[0.3em] uppercase">Sardar Market Shahi Road Rahim Yar Khan</p>
                <div className="flex justify-center gap-8 py-2 border-y border-navy/10 mt-2">
                  <p className="text-sm font-black text-navy">Contact: 0305-6622988</p>
                  <div className="flex flex-col items-center">
                    <p className="text-xl font-bold text-navy">Agency: {agentName}</p>
                  </div>
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
            <table className="w-full table-fixed border-collapse text-sm">
              <colgroup>
                <col style={{ width: "12%" }} />
                <col style={{ width: "46%" }} />
                <col style={{ width: "13%" }} />
                <col style={{ width: "13%" }} />
                <col style={{ width: "16%" }} />
              </colgroup>
              <thead>
                <tr className="bg-navy text-[10px] uppercase tracking-[0.16em] text-gold">
                  <th className="px-4 py-3 text-left font-bold">Date</th>
                  <th className="px-4 py-3 text-left font-bold">Transaction Details</th>
                  <th className="px-4 py-3 text-center font-bold">Debit</th>
                  <th className="px-4 py-3 text-center font-bold">Credit</th>
                  <th className="px-4 py-3 text-center font-bold">Net Balance</th>
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
                    <motion.tr
                      key={e.id || i}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.35, delay: Math.min(i, 16) * 0.03, ease: "easeOut" }}
                      className={`${i % 2 ? "bg-secondary/50" : "bg-white"} group transition-colors hover:bg-gold/5`}
                    >
                      <td className="whitespace-nowrap px-4 py-2.5 text-[10px] font-bold text-navy/60 group-hover:text-navy">{fmt(e.date)}</td>
                      <td className="px-4 py-2.5">
                        <p className="truncate text-[11px] font-bold uppercase tracking-tight text-navy">
                          {e.details}
                        </p>
                      </td>
                      <td className="px-4 py-2.5 text-center tabular-nums text-[12px] font-bold text-navy">{e.debit ? e.debit.toLocaleString("en-PK") : "—"}</td>
                      <td className="px-4 py-2.5 text-center tabular-nums text-[12px] font-bold text-emerald-700">{e.credit ? e.credit.toLocaleString("en-PK") : "—"}</td>
                      <td className="bg-navy/[0.02] px-4 py-2.5 text-center tabular-nums text-[13px] font-black text-gold">{e.balance.toLocaleString("en-PK")}</td>
                    </motion.tr>
                  );
                })}
              </tbody>
              {entries.length > 0 && (
                <tfoot className="no-print">
                  <tr className="border-t-4 border-navy bg-navy text-[10px] font-black text-gold uppercase tracking-widest">
                    <td className="px-4 py-3" colSpan={2}>Aggregate Totals</td>
                    <td className="px-4 py-3 text-center tabular-nums">{totalDebit.toLocaleString("en-PK")}</td>
                    <td className="px-4 py-3 text-center tabular-nums">{totalCredit.toLocaleString("en-PK")}</td>
                    <td className="px-4 py-3 text-center tabular-nums text-white text-[13px]">{outstanding.toLocaleString("en-PK")}</td>
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
    </motion.div>
  );
}


