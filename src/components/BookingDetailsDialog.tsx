import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { AirlineLogo } from "@/components/AirlineLogo";
import { Button } from "@/components/ui/button";

type PassengerRow = {
  title: string;
  given: string;
  surname: string;
  passport: string;
  dob: string;
  passportIssue: string;
  passportExpiry: string;
};

function parsePassengers(value: string): PassengerRow[] {
  return value.split("\n").map((line) => line.trim()).filter(Boolean).map((line) => {
    const fields = line.split("|").map((field) => field.trim());
    const parts = (fields[0] ?? "").split(/\s+/).filter(Boolean);
    const possibleTitle = parts[0]?.toUpperCase() ?? "";
    const hasTitle = ["MR", "MRS", "MS", "MISS", "MSTR", "MASTER"].includes(possibleTitle);
    const title = hasTitle ? possibleTitle : "—";
    const names = hasTitle ? parts.slice(1) : parts;
    return {
      title,
      given: (names.slice(0, -1).join(" ") || names[0] || "—").toUpperCase(),
      surname: (names.length > 1 ? names.at(-1) : "—")?.toUpperCase() ?? "—",
      passport: (fields[1] || "—").toUpperCase(),
      dob: fields[2] || "—",
      passportIssue: fields[3] || "—",
      passportExpiry: fields[4] || "—",
    };
  });
}

export type BookingDetailsDialogProps = {
  open: boolean;
  onClose: () => void;
  bookingRef: string;
  createdLabel?: string;
  route: string;
  routeCodes?: string;
  airline: string;
  flightDetails: string[];
  baggage?: string;
  seats: number;
  passengerNames: string;
  totalLabel?: string;
  totalHint?: string;
  documents?: ReactNode;
  aside?: ReactNode;
};

export function BookingDetailsDialog({
  open,
  onClose,
  bookingRef,
  createdLabel,
  route,
  routeCodes,
  airline,
  flightDetails,
  baggage,
  seats,
  passengerNames,
  totalLabel,
  totalHint,
  documents,
  aside,
}: BookingDetailsDialogProps) {
  const passengers = parsePassengers(passengerNames);
  const detailLines = flightDetails.filter((line) => line && line !== "Flight Details:" && !line.startsWith("Airline:") && !line.startsWith("Baggage:") && !line.startsWith("Fare:"));

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[120] flex items-center justify-center bg-foreground/60 p-0 backdrop-blur-sm sm:p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 6 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            onClick={(event) => event.stopPropagation()}
            className="flex max-h-[100dvh] w-full max-w-5xl flex-col overflow-hidden bg-background shadow-2xl ring-1 ring-accent/30 sm:max-h-[94vh] sm:rounded-xl"
          >
            <header className="sticky top-0 z-20 flex shrink-0 items-center gap-4 border-b border-border bg-card px-4 py-3 shadow-sm sm:px-6 sm:py-4">
              <div className="flex h-12 w-16 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-background p-1.5 shadow-sm">
                <AirlineLogo name={airline} height={34} className="max-h-9" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <h2 className="font-mono text-sm font-bold text-accent">{bookingRef}</h2>
                  {createdLabel && <span className="text-[10px] text-muted-foreground">{createdLabel}</span>}
                </div>
                <p className="mt-1 truncate text-base font-semibold text-foreground sm:text-lg">Booking Details</p>
              </div>
              <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Close booking details" className="h-11 w-11 shrink-0 rounded-full">
                <X className="h-5 w-5" />
              </Button>
            </header>

            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto bg-secondary/40 p-4 sm:p-6">
              <section className="rounded-lg border border-border bg-card p-4 shadow-sm">
                <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px] md:gap-6">
                  <div className="min-w-0 space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold uppercase text-foreground">{route || "—"}</p>
                        <p className="mt-1 text-[11px] font-medium uppercase text-muted-foreground">{routeCodes || "—"}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-[9px] font-bold uppercase text-muted-foreground">Airline</p>
                        <p className="mt-0.5 text-xs font-semibold text-foreground">{airline || "—"}</p>
                      </div>
                    </div>
                    <div className="border-t border-border pt-3">
                      <p className="mb-1.5 text-[10px] font-bold uppercase text-muted-foreground">Flight Details</p>
                      <div className="space-y-1 border-l-2 border-accent/40 pl-3">
                        {detailLines.length ? detailLines.map((line, index) => (
                          <p key={`${line}-${index}`} className="break-words font-mono text-xs font-semibold leading-relaxed text-foreground">{line}</p>
                        )) : <p className="text-xs text-muted-foreground">—</p>}
                      </div>
                      {baggage && <p className="mt-3 text-xs text-muted-foreground">Baggage: <span className="font-semibold text-foreground">{baggage}</span></p>}
                    </div>
                  </div>
                  <div className="border-t border-border pt-4 md:border-l md:border-t-0 md:pl-6 md:pt-0">
                    <p className="text-[9px] font-bold uppercase text-muted-foreground">Passengers</p>
                    <p className="mt-1 text-lg font-semibold text-foreground">{seats} seat{seats === 1 ? "" : "s"}</p>
                    {totalLabel && (
                      <div className="mt-4 border-t border-border pt-4">
                        <p className="text-[9px] font-bold uppercase text-muted-foreground">Booking Total</p>
                        <p className="mt-1 break-words text-lg font-bold text-accent">{totalLabel}</p>
                        {totalHint && <p className="mt-1 text-[10px] text-muted-foreground">{totalHint}</p>}
                      </div>
                    )}
                  </div>
                </div>
              </section>

              <section className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[820px] border-collapse text-xs">
                    <thead className="bg-secondary text-[10px] font-bold uppercase text-muted-foreground">
                      <tr>
                        {[
                          ["Sr#", "w-12"], ["Title", "w-16"], ["Given Name", ""], ["Sur Name", ""],
                          ["Passport#", ""], ["Date of Birth", ""], ["Passport Issue Date", ""], ["Passport Expiry", ""],
                        ].map(([label, width]) => <th key={label} className={`border-b border-r border-border px-2 py-2 text-left last:border-r-0 ${width}`}>{label}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {passengers.length ? passengers.map((passenger, index) => (
                        <tr key={index} className={index % 2 ? "bg-muted/20" : "bg-card"}>
                          <td className="border-b border-r border-border px-2 py-2 text-center font-semibold text-muted-foreground">{index + 1}</td>
                          <td className="border-b border-r border-border px-2 py-2 font-semibold text-foreground">{passenger.title}</td>
                          <td className="border-b border-r border-border px-2 py-2 font-semibold uppercase text-foreground">{passenger.given}</td>
                          <td className="border-b border-r border-border px-2 py-2 font-semibold uppercase text-foreground">{passenger.surname}</td>
                          <td className="border-b border-r border-border px-2 py-2 font-mono uppercase text-foreground">{passenger.passport}</td>
                          <td className="border-b border-r border-border px-2 py-2 text-foreground">{passenger.dob}</td>
                          <td className="border-b border-r border-border px-2 py-2 text-foreground">{passenger.passportIssue}</td>
                          <td className="border-b border-border px-2 py-2 text-foreground">{passenger.passportExpiry}</td>
                        </tr>
                      )) : (
                        <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">No passenger details recorded.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>

              {documents && (
                <section className="rounded-lg border border-border bg-card p-4 shadow-sm">
                  <p className="mb-2 text-[10px] font-bold uppercase text-muted-foreground">Documents</p>
                  {documents}
                </section>
              )}

              {aside && <section className="rounded-lg border border-border bg-card p-4 shadow-sm">{aside}</section>}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}