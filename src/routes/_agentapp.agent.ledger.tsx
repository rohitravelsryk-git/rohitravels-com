import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Wallet, TrendingUp, TrendingDown, Receipt, FileSpreadsheet, FileDown } from "lucide-react";
import { downloadCsv, downloadPdf } from "@/lib/export-utils";


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

  function exportLedger() {
    return {
      title: "Agent Ledger — Rohi International Travels",
      headers: ["Date", "Particulars", "Seats", "Rate", "Debit", "Credit", "Balance"],
      rows: entries.map((e) => {
        const f = e.fare_snapshot ?? {};
        const particulars = `${f.airline ?? "—"} · ${f.origin_code ?? ""} → ${f.destination_code ?? ""} · ${f.flight_date ?? ""}${f.pnr ? ` · PNR: ${f.pnr}` : ""}\n${e.passenger_names || ""}`;
        return [
          fmt(e.created_at),
          particulars,
          e.seats || 0,
          e.unit || e.fare_on_demand || f.price_text || 0,
          e.debit || 0,
          e.credit || 0,
          e.balance || 0,
        ];
      }),
    };
  }

  return (
    <div className="min-h-full bg-[#fdf8f1] p-6">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div className="inline-flex items-center gap-3 rounded-xl bg-navy px-5 py-3 text-navy-foreground shadow-lg ring-1 ring-white/10">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gold/10">
            <Wallet className="h-6 w-6 text-gold" />
          </div>
          <div>
            <p className="font-serif text-xl font-black leading-none tracking-tight">Accounts &amp; Ledger</p>
            <p className="mt-1.5 text-[11px] font-bold uppercase tracking-[0.25em] text-gold/60">B2B Agent Portal</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 rounded-lg bg-white/50 p-1 ring-1 ring-black/5">
            <button
              onClick={() => downloadCsv(exportLedger())}
              className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-[13px] font-black text-white shadow-sm transition-all hover:bg-emerald-700 active:scale-95"
            >
              <FileSpreadsheet className="h-4 w-4" /> Excel
            </button>
            <button
              onClick={() => downloadPdf(exportLedger())}
              className="inline-flex items-center gap-2 rounded-md bg-rose-600 px-4 py-2 text-[13px] font-black text-white shadow-sm transition-all hover:bg-rose-700 active:scale-95"
            >
              <FileDown className="h-4 w-4" /> PDF
            </button>
          </div>
          <Link to="/agent/bookings" className="rounded-lg border border-navy/10 bg-white px-5 py-2 text-[13px] font-black uppercase tracking-widest text-navy transition-all hover:bg-navy hover:text-white">
            View bookings →
          </Link>
        </div>
      </div>

      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <Stat label="Total Billed" value={money(totalDebit)} icon={<Receipt className="h-4 w-4" />} tone="navy" />
        <Stat label="Paid / Confirmed" value={money(totalCredit)} icon={<TrendingUp className="h-4 w-4" />} tone="green" />
        <Stat label="Outstanding Balance" value={money(outstanding)} icon={<TrendingDown className="h-4 w-4" />} tone="amber" />
      </div>

      <div className="overflow-hidden rounded-2xl border border-navy/10 bg-white shadow-xl ring-1 ring-black/5">
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-left text-sm">
            <thead>
              <tr className="bg-navy text-[11px] font-black uppercase tracking-[0.2em] text-white">
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4">Particulars</th>
                <th className="px-6 py-4 text-center">Seats</th>
                <th className="px-6 py-4 text-right">Rate</th>
                <th className="px-6 py-4 text-right">Debit</th>
                <th className="px-6 py-4 text-right text-emerald-300">Credit</th>
                <th className="px-6 py-4 text-right text-gold">Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={7} className="p-12 text-center font-serif text-lg italic text-muted-foreground">Loading ledger records...</td></tr>
              ) : entries.length === 0 ? (
                <tr><td colSpan={7} className="p-16 text-center">
                  <p className="font-serif text-xl text-navy/40 italic">No ledger entries found</p>
                  <p className="mt-2 text-xs uppercase tracking-widest text-muted-foreground">Confirmed bookings appear here automatically</p>
                </td></tr>
              ) : entries.map((e, i) => {
                const f = e.fare_snapshot ?? {};
                const isPaid = e.credit > 0;
                return (
                  <tr key={e.id} className="group hover:bg-[#fcfaf7] transition-colors">
                    <td className="whitespace-nowrap px-6 py-5 text-[12px] font-bold text-gray-400">{fmt(e.created_at)}</td>
                    <td className="px-6 py-5">
                      <p className="text-[14px] font-black leading-tight text-navy uppercase tracking-tight">
                        {f.airline ?? "—"} · {f.origin_code ?? ""} → {f.destination_code ?? ""}
                      </p>
                      <p className="mt-1 text-[11px] font-bold text-gray-500">
                        {f.flight_date ?? ""}{f.pnr ? ` · PNR: ${f.pnr}` : ""}
                      </p>
                      {e.passenger_names && (
                        <p className="mt-2 inline-block rounded bg-navy/5 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-navy/70">
                          {e.passenger_names}
                        </p>
                      )}
                    </td>
                    <td className="px-6 py-5 text-center font-black text-lg text-navy">{e.seats}</td>
                    <td className="px-6 py-5 text-right tabular-nums text-[13px] font-bold text-gray-600">
                      {e.unit ? e.unit.toLocaleString("en-PK") : (e.fare_on_demand === "ARE ON WHATSAPP" ? <span className="text-[10px] tracking-widest text-gray-400">ARE ON WHATSAPP</span> : e.fare_on_demand || f.price_text || "—")}
                    </td>
                    <td className="px-6 py-5 text-right tabular-nums text-[15px] font-black text-navy">
                      {e.debit ? e.debit.toLocaleString("en-PK") : "—"}
                    </td>
                    <td className="px-6 py-5 text-right tabular-nums text-[15px] font-black text-emerald-600">
                      {isPaid ? e.credit.toLocaleString("en-PK") : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-6 py-5 text-right tabular-nums text-[15px] font-black text-[color:var(--ledger-brown)]">
                      {e.balance.toLocaleString("en-PK")}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
          {entries.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-navy/20 bg-secondary/60 text-[12px] font-black text-navy">
                <td className="px-3 py-3" colSpan={4}>TOTAL</td>
                <td className="px-3 py-3 text-right tabular-nums">{totalDebit.toLocaleString("en-PK")}</td>
                <td className="px-3 py-3 text-right tabular-nums text-emerald-700">{totalCredit.toLocaleString("en-PK")}</td>
                <td className="px-3 py-3 text-right tabular-nums">{outstanding.toLocaleString("en-PK")}</td>
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
    ? "bg-[#e6f7ef] border-emerald-100 text-emerald-900"
    : tone === "amber"
      ? "bg-[#fff9eb] border-amber-100 text-amber-900"
      : "bg-white border-navy/5 text-navy";
  
  const labelCls = tone === "green" 
    ? "text-emerald-600" 
    : tone === "amber" 
      ? "text-amber-600" 
      : "text-gray-400";

  return (
    <div className={`rounded-2xl border p-6 shadow-sm transition-transform hover:scale-[1.02] ${cls}`}>
      <div className={`flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.2em] ${labelCls}`}>
        {icon} {label}
      </div>
      <p className="mt-3 font-serif text-3xl font-black tracking-tight">{value}</p>
    </div>
  );
}
