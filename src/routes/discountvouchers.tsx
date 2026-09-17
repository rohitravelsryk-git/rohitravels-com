import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Search, Ticket, FileSpreadsheet, FileDown } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { downloadCsv, printPdf } from "@/lib/voucher-export";
import { Button } from "@/components/ui/button";

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
      { property: "og:url", content: "https://rohitravels.com/discountvouchers" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://rohitravels.com/discountvouchers" }],
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
    <div className="min-h-screen bg-background animate-premium-fade">
      <section className="-mt-px bg-navy text-white">
        <div className="mx-auto max-w-6xl px-4 py-14">
          <div className="flex items-center gap-3 text-gold">
            <Ticket className="h-6 w-6" />
            <span className="text-xs font-bold uppercase tracking-[0.3em]">Voucher Availability</span>
          </div>
          <h1 className="mt-3 font-serif text-4xl font-black md:text-5xl">Discount Vouchers</h1>
          <p className="mt-3 max-w-2xl text-white/80">
            Check current discount voucher availability, passenger details, expiry dates and status.
          </p>
        </div>
      </section>

      <motion.section
        className="mx-auto max-w-7xl px-4 py-8"
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="flex justify-end">
          <div className="ml-auto flex w-full flex-col items-stretch justify-end gap-2 sm:w-auto sm:flex-row sm:items-center">
            <div className="relative w-full sm:w-72 lg:w-80">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search vouchers…"
                className="h-9 w-full rounded-lg border border-input bg-card pl-9 pr-3 text-sm shadow-xs outline-none transition-colors focus:border-gold focus:ring-2 focus:ring-gold/30"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => downloadCsv(exportData())}
                title="Download as Excel / Google Sheets (CSV)"
              >
                <FileSpreadsheet /> Excel
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => printPdf(exportData())}
                title="Download / print as PDF"
              >
                <FileDown /> PDF
              </Button>
            </div>
          </div>
        </div>

        <motion.div
          className="mt-4 overflow-x-auto rounded-lg border border-border bg-card shadow-[var(--shadow-card)]"
          initial={{ opacity: 0, scale: 0.995 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.08, duration: 0.4 }}
        >
          <table className="w-full min-w-max table-auto text-sm">
            <thead className="bg-navy text-[10px] font-bold uppercase tracking-widest text-navy-foreground">
              <tr>
                <th className="whitespace-nowrap px-3 py-2.5 text-left">Sr</th>
                <th className="whitespace-nowrap px-3 py-2.5 text-left">Passenger Name</th>
                <th className="whitespace-nowrap px-3 py-2.5 text-left">Airline</th>
                <th className="whitespace-nowrap px-3 py-2.5 text-left">PNR Expiry</th>
                <th className="whitespace-nowrap px-3 py-2.5 text-center">Days Left</th>
                <th className="whitespace-nowrap px-3 py-2.5 text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              <AnimatePresence initial={false}>
                {rows.map((v, i) => {
                  const days = daysUntil(v.expiry_date);
                  const st = statusFor(days);
                  return (
                    <motion.tr
                      layout
                      key={v.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2, delay: Math.min(i * 0.025, 0.2) }}
                      className={`${i % 2 === 0 ? "bg-background" : "bg-secondary/40"} border-b border-border/60 transition-colors last:border-b-0 hover:bg-accent/5`}
                    >
                      <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-muted-foreground">{i + 1}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-xs font-bold text-navy">{v.passenger_name || "—"}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-xs">{v.airline || "Air Arabia / FlyJinnah"}</td>
                      <td className="whitespace-nowrap px-3 py-2 font-mono text-xs">{displayExpiry(v.expiry_date)}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-center">
                        <span className={`inline-flex min-w-8 items-center justify-center rounded-md px-2 py-0.5 text-[11px] ${daysPill(days)}`}>
                          {days == null ? "—" : days}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-center">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest ${st.cls}`}>
                          {st.label}
                        </span>
                      </td>
                    </motion.tr>
                  );
                })}
              </AnimatePresence>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-sm text-muted-foreground">
                    {vouchers.length === 0 ? "No vouchers available." : "No vouchers match your search."}
                  </td>
                </tr>
              )}


            </tbody>
          </table>
        </motion.div>
      </motion.section>
    </div>
  );
}
