import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Wallet, TrendingUp, TrendingDown, Receipt } from "lucide-react";

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
        <Link to="/agent/bookings" className="rounded-full border border-border bg-card px-5 py-2.5 text-xs font-black uppercase tracking-wider text-foreground hover:bg-secondary">
          View bookings →
        </Link>
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
              <th className="px-3 py-3 text-left font-bold">Date</th>
              <th className="px-3 py-3 text-left font-bold">Particulars</th>
              <th className="px-3 py-3 text-center font-bold">Seats</th>
              <th className="px-3 py-3 text-right font-bold">Rate</th>
              <th className="px-3 py-3 text-right font-bold">Debit</th>
              <th className="px-3 py-3 text-right font-bold">Credit</th>
              <th className="px-3 py-3 text-right font-bold">Balance</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">Loading…</td></tr>
            ) : entries.length === 0 ? (
              <tr><td colSpan={7} className="p-10 text-center text-muted-foreground">
                No ledger entries yet. Confirmed bookings appear here automatically.
              </td></tr>
            ) : entries.map((e, i) => {
              const f = e.fare_snapshot ?? {};
              return (
                <tr key={e.id} className={`border-t border-border ${i % 2 ? "bg-secondary/40" : ""}`}>
                  <td className="whitespace-nowrap px-3 py-3 text-[11px] font-semibold text-muted-foreground">{fmt(e.created_at)}</td>
                  <td className="px-3 py-3">
                    <p className="text-[12px] font-black text-navy">{f.airline ?? "—"} · {f.origin_code ?? ""} → {f.destination_code ?? ""}</p>
                    <p className="text-[10.5px] text-muted-foreground">{f.flight_date ?? ""}{f.pnr ? ` · PNR: ${f.pnr}` : ""}</p>
                    {e.passenger_names && (
                      <p className="mt-1 whitespace-pre-line text-[10.5px] font-semibold uppercase leading-snug text-foreground">{e.passenger_names}</p>
                    )}
                  </td>
                  <td className="px-3 py-3 text-center font-black text-navy">{e.seats}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-[11.5px]">{e.unit ? e.unit.toLocaleString("en-PK") : e.fare_on_demand || f.price_text || "—"}</td>
                  <td className="px-3 py-3 text-right tabular-nums font-bold text-navy">{e.debit ? e.debit.toLocaleString("en-PK") : "—"}</td>
                  <td className="px-3 py-3 text-right tabular-nums font-bold text-emerald-700">{e.credit ? e.credit.toLocaleString("en-PK") : "—"}</td>
                  <td className="px-3 py-3 text-right tabular-nums font-black text-[color:var(--ledger-brown)]">{e.balance.toLocaleString("en-PK")}</td>
                </tr>
              );
            })}
          </tbody>
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
