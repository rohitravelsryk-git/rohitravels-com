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
    subtitle: `Balance due ${money(outstanding)} • Generated ${new Date().toLocaleString()} • ${entries.length} entries`,
    headers: ["Date", "Details", "Debit (PKR)", "Credit (PKR)", "Balance (PKR)"],
    rows: [
      ...entries.map((entry) => [fmt(entry.date), entry.details, entry.debit || 0, entry.credit || 0, entry.balance]),
      ["TOTAL", "Aggregate totals", totalDebit, totalCredit, outstanding],
    ],
    numericColumns: [2, 3, 4],
    highlightLastRow: true,
  });

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="min-h-full bg-background pb-24"
    >
      <style>{`
        @media print {
          .print-header { display: block !important; }
          .no-print { display: none !important; }
          @page { size: A4 portrait; margin: 12mm; }
          body { background: white !important; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          .ledger-print { border: 0 !important; box-shadow: none !important; }
          .ledger-print table { min-width: 0 !important; font-size: 9px !important; }
          thead { display: table-row-group; }
          tfoot { display: table-footer-group; }
          tr { break-inside: avoid; }
        }
        .print-header { display: none; }
      `}</style>

      <div className="mx-auto max-w-7xl px-4 py-6 md:px-8">
        <div className="no-print mb-5 flex flex-wrap items-end justify-between gap-4 border-b border-border pb-5">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-gold">Account Statement</p>
            <h1 className="mt-1 font-serif text-3xl font-semibold leading-tight text-foreground">{agentName || "My Ledger"}</h1>
          </div>
          <div className="min-w-56 rounded-lg border border-border bg-card px-5 py-3 text-right shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Outstanding Balance</p>
            <p className="mt-1 font-sans text-2xl font-bold leading-none tabular-nums text-foreground">{money(outstanding)}</p>
          </div>
        </div>

        <div className="no-print mb-4 flex flex-wrap items-center justify-end gap-2">
          <Button type="button" size="sm" onClick={handlePrint} title="Open standard print settings">
            <Printer /> Print
          </Button>
          <Button type="button" size="sm" variant="secondary" onClick={() => downloadExcel(exportData())} title="Download as Excel / Google Sheets">
            <FileSpreadsheet /> Excel
          </Button>
          <Button type="button" size="sm" variant="destructive" onClick={() => downloadPdf(exportData())} title="Download portrait A4 PDF">
            <FileDown /> PDF
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link to="/agent/bookings">View bookings →</Link>
          </Button>
        </div>

        <div className="ledger-print overflow-hidden rounded-lg border border-border bg-card shadow-[var(--shadow-card)]" ref={printRef}>
          <div className="print-header border-b-4 border-navy bg-accent p-7 text-accent-foreground">
            <div className="space-y-1 text-center">
              <h1 className="font-serif text-3xl font-semibold tracking-tight text-accent-foreground">Rohi International Travels</h1>
              <p className="text-xs text-accent-foreground/80">Sardar Market, Shahi Road, Rahim Yar Khan · 0305-6622988</p>
              <div className="mt-4 flex items-end justify-between border-t border-accent-foreground/25 pt-4 text-left">
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-accent-foreground/70">Agency</p>
                  <p className="text-base font-bold text-accent-foreground">{agentName || "Agent"}</p>
                </div>
                <div className="text-right">
                  <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-accent-foreground/70">Outstanding Balance</p>
                  <p className="text-base font-bold tabular-nums text-accent-foreground">{money(outstanding)}</p>
                </div>
              </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] table-fixed border-collapse text-sm">
              <colgroup>
                <col style={{ width: "12%" }} />
                <col style={{ width: "46%" }} />
                <col style={{ width: "13%" }} />
                <col style={{ width: "13%" }} />
                <col style={{ width: "16%" }} />
              </colgroup>
              <thead>
                <tr className="bg-navy text-[10px] uppercase tracking-[0.14em] text-navy-foreground">
                  <th className="px-4 py-3 text-left font-bold">Date</th>
                  <th className="px-4 py-3 text-left font-bold">Details</th>
                  <th className="px-4 py-3 text-right font-bold">Debit</th>
                  <th className="px-4 py-3 text-right font-bold">Credit</th>
                  <th className="px-4 py-3 text-right font-bold">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/70">
                {loading ? (
                  <tr><td colSpan={5} className="p-16 text-center font-serif text-lg italic text-muted-foreground animate-pulse">Retrieving records...</td></tr>
                ) : entries.length === 0 ? (
                  <tr><td colSpan={5} className="p-20 text-center text-muted-foreground">
                    <Receipt className="mx-auto mb-4 h-12 w-12 opacity-10" />
                    <p className="font-serif text-lg italic">No ledger entries found in the archive.</p>
                  </td></tr>
                ) : entries.map((entry, index) => (
                  <motion.tr
                    key={entry.id || index}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35, delay: Math.min(index, 16) * 0.03, ease: "easeOut" }}
                    className={`${index % 2 ? "bg-secondary/45" : "bg-card"} group transition-colors hover:bg-accent/5`}
                  >
                    <td className="whitespace-nowrap px-4 py-2.5 font-mono text-[11px] text-muted-foreground">{fmt(entry.date)}</td>
                    <td className="px-4 py-2.5"><p className="truncate text-xs font-medium text-foreground">{entry.details}</p></td>
                    <td className="px-4 py-2.5 text-right text-xs font-medium tabular-nums text-foreground">{entry.debit ? entry.debit.toLocaleString("en-PK") : "—"}</td>
                    <td className="px-4 py-2.5 text-right text-xs font-medium tabular-nums text-ledger-green">{entry.credit ? entry.credit.toLocaleString("en-PK") : "—"}</td>
                    <td className="bg-foreground/[0.025] px-4 py-2.5 text-right text-xs font-bold tabular-nums text-foreground">{entry.balance.toLocaleString("en-PK")}</td>
                  </motion.tr>
                ))}
              </tbody>
              {entries.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-accent bg-navy text-[10px] font-bold uppercase tracking-widest text-navy-foreground">
                    <td className="px-4 py-3" colSpan={2}>Aggregate Totals</td>
                    <td className="px-4 py-3 text-right tabular-nums">{totalDebit.toLocaleString("en-PK")}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{totalCredit.toLocaleString("en-PK")}</td>
                    <td className="px-4 py-3 text-right text-xs tabular-nums">{outstanding.toLocaleString("en-PK")}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>

        <div className="no-print mt-6 flex items-start gap-3 rounded-lg border border-border bg-card p-4">
          <div className="mt-0.5 rounded-full bg-secondary p-1"><Receipt className="h-3 w-3 text-muted-foreground" /></div>
          <p className="max-w-3xl text-[11px] leading-relaxed text-muted-foreground">
            <strong className="text-foreground">Statement Note:</strong> Debit entries are automatically generated upon booking submission. Credit entries are reconciled and posted once the transaction is verified by the accounts department. "Fare on WhatsApp" entries represent pending valuations and will be updated upon final rate confirmation.
          </p>
        </div>
      </div>
    </motion.div>
  );
}


