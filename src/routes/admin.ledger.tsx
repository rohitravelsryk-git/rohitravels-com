import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { listAgentLedgersAdmin } from "@/lib/ledger-admin.functions";
import { AdminTabs } from "@/components/AdminTabs";
import { Wallet, Phone } from "lucide-react";

export const Route = createFileRoute("/admin/ledger")({
  component: AdminLedgerPage,
});

function AdminLedgerPage() {
  const list = useServerFn(listAgentLedgersAdmin);
  const q = useQuery({ queryKey: ["admin-ledgers"], queryFn: () => list(), refetchInterval: 30000 });

  const grandTotal = (q.data ?? []).reduce((s: number, a: any) => s + a.balance, 0);

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
                    <a href={`https://wa.me/${a.contact.replace(/[^0-9]/g, "")}?text=Dear%20${a.agency_name},%20your%20outstanding%20balance%20is%20${a.balance}%20PKR.%20Please%20clear%20at%20earliest.`} 
                       target="_blank" className="text-xs bg-navy text-white px-3 py-1.5 rounded hover:bg-navy/90">Reminder</a>
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
