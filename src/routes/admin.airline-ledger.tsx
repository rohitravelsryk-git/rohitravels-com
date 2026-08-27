import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Download, Plus, Save, Trash2, Plane, ClipboardCheck } from "lucide-react";
import { toast } from "sonner";
import { AdminTabs } from "@/components/AdminTabs";
import { listAgentLedgersAdmin } from "@/lib/ledger-admin.functions";

export const Route = createFileRoute("/admin/airline-ledger")({
  component: AirlineLedgerPage,
  head: () => ({ meta: [
    { title: "Airline Ledger | Rohi International Travels" },
    { name: "description", content: "Review, reconcile, filter and export the airline ledger." },
    { property: "og:title", content: "Airline Ledger | Rohi International Travels" },
    { property: "og:description", content: "Airline ledger reconciliation and reporting." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
});

type Row = { id: string; date: string; details: string; debit: number; credit: number; balance: number; agency: string; airline: string; route: string };

function AirlineLedgerPage() {
  const fetchLedgers = useServerFn(listAgentLedgersAdmin);
  const { data, isLoading, refetch } = useQuery({ queryKey: ["admin-airline-ledger"], queryFn: () => fetchLedgers(), refetchInterval: 30000 });
  const [airline, setAirline] = useState("ALL");
  const [route, setRoute] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [manual, setManual] = useState<Row[]>([]);

  const rows = useMemo<Row[]>(() => {
    const result: Row[] = [];
    for (const agent of data ?? []) for (const item of agent.ledger ?? []) {
      const parts = String(item.details ?? "").split(" - ");
      const routeText = parts.find((p: string) => /\b[A-Z]{3}\s+[A-Z]{3}\b/.test(p)) ?? "";
      const airlineText = parts.at(-1) || "Manual";
      result.push({ ...item, agency: agent.agency_name, airline: airlineText.trim(), route: routeText.trim() });
    }
    return [...manual, ...result];
  }, [data, manual]);

  const airlines = [...new Set(rows.map((r) => r.airline).filter(Boolean))].sort();
  const filtered = rows.filter((r) => {
    const d = String(r.date).slice(0, 10);
    return (airline === "ALL" || r.airline === airline) && (!route || `${r.route} ${r.details}`.toLowerCase().includes(route.toLowerCase())) && (!from || d >= from) && (!to || d <= to);
  });
  const debit = filtered.reduce((s, r) => s + Number(r.debit || 0), 0);
  const credit = filtered.reduce((s, r) => s + Number(r.credit || 0), 0);
  const discrepancy = debit - credit;

  function addEntry() {
    setManual((v) => [{ id: `manual-${Date.now()}`, date: new Date().toISOString().slice(0, 10), details: "New airline ledger entry", debit: 0, credit: 0, balance: 0, agency: "Manual", airline: "Manual", route: "" }, ...v]);
  }
  function exportCsv() {
    const csv = [["Date", "Airline", "Route", "Agency", "Details", "Debit", "Credit", "Discrepancy"], ...filtered.map((r) => [r.date, r.airline, r.route, r.agency, r.details, r.debit, r.credit, r.debit - r.credit])].map((r) => r.map((v) => `"${String(v ?? "").replaceAll('"', '""')}"`).join(",")).join("\n");
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); a.download = "rohi-airline-ledger.csv"; a.click(); URL.revokeObjectURL(a.href); toast.success("CSV exported");
  }

  return <div className="min-h-screen bg-[#FDFBF7] text-[#0D0D0D]"><header className="bg-[#0D0D0D] text-white border-b border-[#D4AF37]/30"><div className="mx-auto max-w-[1600px] px-4 py-4 flex items-center gap-3"><Plane className="text-[#D4AF37]" /><div><h1 className="font-serif text-xl font-black text-[#D4AF37]">Airline Ledger</h1><p className="text-[10px] uppercase tracking-widest opacity-60">Reconciliation &amp; airline reporting</p></div></div><AdminTabs /></header>
    <main className="mx-auto max-w-[1600px] p-6 space-y-5"><div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="font-serif text-2xl font-black">Airline Ledger</h2><p className="text-sm text-slate-500">Track airline movement, agency charges, and outstanding discrepancies.</p></div><div className="flex gap-2"><button onClick={addEntry} className="inline-flex items-center gap-2 rounded bg-[#0D0D0D] px-4 py-2 text-xs font-bold text-white"><Plus size={15}/> New entry</button><button onClick={exportCsv} className="inline-flex items-center gap-2 rounded border border-[#0D0D0D] px-4 py-2 text-xs font-bold"><Download size={15}/> Export CSV</button></div></div>
      <section className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 md:grid-cols-4"><label className="text-xs font-bold uppercase">From<input type="date" value={from} onChange={e=>setFrom(e.target.value)} className="mt-1 block w-full rounded border p-2 font-normal"/></label><label className="text-xs font-bold uppercase">To<input type="date" value={to} onChange={e=>setTo(e.target.value)} className="mt-1 block w-full rounded border p-2 font-normal"/></label><label className="text-xs font-bold uppercase">Airline<select value={airline} onChange={e=>setAirline(e.target.value)} className="mt-1 block w-full rounded border p-2 font-normal"><option value="ALL">All airlines</option>{airlines.map(a=><option key={a}>{a}</option>)}</select></label><label className="text-xs font-bold uppercase">Route<input value={route} onChange={e=>setRoute(e.target.value)} placeholder="KHI DMM" className="mt-1 block w-full rounded border p-2 font-normal"/></label></section>
      <section className="grid gap-3 sm:grid-cols-3"><Metric label="Debit / purchase" value={debit}/><Metric label="Credit / settled" value={credit}/><Metric label="Discrepancy" value={discrepancy} accent/></section>
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white"><table className="w-full min-w-[1050px] text-sm"><thead className="bg-[#0D0D0D] text-left text-[10px] uppercase tracking-wider text-[#D4AF37]"><tr>{["Date","Airline","Route","Agency","Details","Debit","Credit","Discrepancy","Action"].map(h=><th key={h} className="px-4 py-3">{h}</th>)}</tr></thead><tbody>{isLoading?<tr><td colSpan={9} className="p-10 text-center">Loading ledger…</td></tr>:filtered.map((r,i)=><tr key={r.id+i} className="border-b hover:bg-[#FDFBF7]"><td className="px-4 py-3">{String(r.date).slice(0,10)}</td><td className="px-4 py-3 font-bold">{r.airline}</td><td className="px-4 py-3 font-mono">{r.route || "—"}</td><td className="px-4 py-3">{r.agency}</td><td className="px-4 py-3">{r.details}</td><td className="px-4 py-3 text-right">{Number(r.debit||0).toLocaleString()}</td><td className="px-4 py-3 text-right">{Number(r.credit||0).toLocaleString()}</td><td className="px-4 py-3 text-right font-black text-orange-600">{(Number(r.debit||0)-Number(r.credit||0)).toLocaleString()}</td><td className="px-4 py-3">{r.id.startsWith("manual-")&&<button onClick={()=>setManual(v=>v.filter(x=>x.id!==r.id))} aria-label="Delete entry"><Trash2 size={15} className="text-red-600"/></button>}</td></tr>)}{!isLoading&&!filtered.length&&<tr><td colSpan={9} className="p-10 text-center text-slate-500">No matching ledger entries.</td></tr>}</tbody></table></div><div className="flex items-center gap-2 text-xs text-slate-500"><ClipboardCheck size={15}/> Reconciliation uses filtered debit and credit totals. <button onClick={()=>refetch()} className="font-bold underline">Refresh</button></div>
    </main></div>;
}
function Metric({label,value,accent=false}:{label:string;value:number;accent?:boolean}) { return <div className="rounded-lg border border-slate-200 bg-white p-4"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</p><p className={`mt-1 text-2xl font-black ${accent?"text-orange-600":"text-[#0D0D0D]"}`}>{value.toLocaleString()} PKR</p></div>; }
