import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ArrowLeft, Search, Ticket, Plane, FileSpreadsheet, FileDown } from "lucide-react";
import { downloadCsv, printPdf } from "@/lib/voucher-export";

import { listVouchers, type PublicVoucher } from "@/lib/vouchers.functions";
import { daysUntil, statusFor, daysPill, displayExpiry } from "./admin.vouchers";

const vouchersQuery = queryOptions({
  queryKey: ["vouchers"],
  queryFn: () => listVouchers(),
});

export const Route = createFileRoute("/discountvouchers")({
  head: () => ({
    meta: [
      { title: "Discount Vouchers — Rohi International Travels" },
      { name: "description", content: "Live discount voucher inventory with airline, PNR expiry, days left and status." },
      { property: "og:title", content: "Discount Vouchers — Rohi International Travels" },
      { property: "og:description", content: "Real-time discount voucher availability with expiry and status. Book on WhatsApp 0305 6622988." },
      { property: "og:url", content: "https://rohitravels.lovable.app/discountvouchers" },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "canonical", href: "https://rohitravels.lovable.app/discountvouchers" }],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(vouchersQuery),
  component: VouchersPage,
  errorComponent: ({ error }) => (
    <div className="p-8 text-center text-destructive">Failed to load: {error.message}</div>
  ),
  notFoundComponent: () => <div className="p-6">Not found.</div>,
});

function VouchersPage() {
  const { data: vouchers } = useSuspenseQuery(vouchersQuery);
  const [q, setQ] = useState("");

  const rows: PublicVoucher[] = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return vouchers;
    return vouchers.filter((v) =>
      [v.expiry_date, v.airline, v.passenger_name].join(" ").toLowerCase().includes(t),
    );
  }, [vouchers, q]);

  function exportData() {
    return {
      title: "Discount Vouchers",
      headers: ["Sr", "Passenger Name", "Airline", "PNR Expiry", "Days Left", "Status"],
      rows: rows.map((v, i) => {
        const days = daysUntil(v.expiry_date);
        return [
          i + 1,
          v.passenger_name || "",
          v.airline || "",
          displayExpiry(v.expiry_date),
          days == null ? "—" : days,
          statusFor(days).label,
        ];
      }),
    };
  }


  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-navy text-navy-foreground">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4">
          <Link to="/" className="inline-flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/5 ring-1 ring-white/10">
              <Plane className="h-4 w-4 -rotate-45 text-gold" />
            </div>
            <div>
              <p className="font-serif text-lg font-black leading-none">ROHI INTERNATIONAL TRAVELS</p>
              <p className="text-[10px] tracking-[0.25em] text-white/60">VOUCHER INVENTORY</p>
            </div>
          </Link>
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs font-bold uppercase tracking-wide text-white/90 hover:border-gold/60 hover:text-gold"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-4 py-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-serif text-3xl font-black text-navy">
              <Ticket className="mr-2 inline h-6 w-6 text-gold" />
              Discount Vouchers
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Live discount voucher availability with expiry and status.
            </p>
          </div>
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            <div className="relative w-full sm:w-72">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search vouchers…"
                className="w-full rounded-lg border border-input bg-card py-2.5 pl-9 pr-3 text-sm outline-none focus:border-gold focus:ring-2 focus:ring-gold/30"
              />
            </div>
            <button
              onClick={() => downloadCsv(exportData())}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2.5 text-xs font-bold text-white hover:bg-emerald-700"
              title="Download as Excel / Google Sheets (CSV)"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" /> Excel
            </button>
            <button
              onClick={() => printPdf(exportData())}
              className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-2.5 text-xs font-bold text-white hover:bg-rose-700"
              title="Download / print as PDF"
            >
              <FileDown className="h-3.5 w-3.5" /> PDF
            </button>
          </div>
        </div>


        <div className="mt-6 overflow-hidden rounded-xl border border-border bg-card shadow-[var(--shadow-card)]">
          <table className="w-full text-sm">
            <thead className="bg-navy text-[10px] font-bold uppercase tracking-widest text-navy-foreground">
              <tr>
                <th className="px-3 py-3 text-left w-12">Sr</th>
                <th className="px-3 py-3 text-left w-44 pr-6">Passenger Name</th>
                <th className="px-3 py-3 text-left pl-12">Airline</th>
                <th className="px-3 py-3 text-left">PNR Expiry</th>
                <th className="px-3 py-3 text-center">Days Left</th>
                <th className="px-3 py-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((v, i) => {
                const days = daysUntil(v.expiry_date);
                const st = statusFor(days);
                return (
                  <tr key={v.id} className={i % 2 === 0 ? "bg-background" : "bg-secondary/40"}>
                    <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground">{i + 1}</td>
                    <td className="px-3 py-2.5 pr-6 font-bold text-navy text-xs">{v.passenger_name || "—"}</td>
                    <td className="px-3 py-2.5 pl-12 text-xs">{v.airline || "Air Arabia / FlyJinnah"}</td>
                    <td className="px-3 py-2.5 font-mono text-xs">{displayExpiry(v.expiry_date)}</td>
                    <td className="px-3 py-2.5 text-center">
                      <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] ${daysPill(days)}`}>
                        {days == null ? "—" : days}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <span className={`inline-flex items-center rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-widest ${st.cls}`}>
                        {st.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-sm text-muted-foreground">
                    {vouchers.length === 0 ? "No vouchers available." : "No vouchers match your search."}
                  </td>
                </tr>
              )}


            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
