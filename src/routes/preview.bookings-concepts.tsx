import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronDown, Download, MessageCircle, FileText, Upload, ShieldCheck,
  CheckCircle2, Clock, AlertTriangle, ChevronRight, Circle,
} from "lucide-react";

export const Route = createFileRoute("/preview/bookings-concepts")({
  component: Page,
  head: () => ({
    meta: [
      { title: "Bookings Table Redesign Concepts | Rohi International Travels" },
      { name: "description", content: "Five compact, action-oriented layouts for the B2B agent portal's All Group Bookings view." },
      { name: "robots", content: "noindex" },
    ],
  }),
});

/* ------------------------------------------------------------------ *
 * Shared mock data — same shape as the real agent bookings table.
 * ------------------------------------------------------------------ */
type Booking = {
  ref: string;
  date: string;
  from: string;
  to: string;
  fromCode: string;
  toCode: string;
  airline: string;
  passenger: string;
  seats: number;
  total: string;
  payment: "received" | "ledger" | "pending" | "confirmed";
  ticket: "on-hold" | "confirmed" | "issued";
  action: null | { label: string; kind: "urgent" | "warn" | "info" };
};

const BOOKINGS: Booking[] = [
  {
    ref: "ROHI61FA", date: "15 Aug 2026", from: "Karachi", to: "Riyadh", fromCode: "KHI", toCode: "RUH",
    airline: "Flynas", passenger: "Muhammad Aaraiz", seats: 1, total: "PKR 81,000",
    payment: "received", ticket: "on-hold", action: { label: "Payment update locked", kind: "info" },
  },
  {
    ref: "ROHI9D14", date: "18 Aug 2026", from: "Karachi", to: "Madinah", fromCode: "KHI", toCode: "MED",
    airline: "Salam Air", passenger: "Muhammad Umer", seats: 1, total: "PKR 95,000",
    payment: "ledger", ticket: "on-hold", action: { label: "Upload payment slip", kind: "urgent" },
  },
  {
    ref: "R0HI9D29", date: "03 Sep 2026", from: "Karachi", to: "Madinah", fromCode: "KHI", toCode: "MED",
    airline: "Salam Air", passenger: "Asad Ullah", seats: 1, total: "PKR 85,000",
    payment: "received", ticket: "on-hold", action: { label: "Approve passport & release ticket", kind: "warn" },
  },
  {
    ref: "R0HI2A95", date: "30 Aug 2026", from: "Karachi", to: "Madinah", fromCode: "KHI", toCode: "MED",
    airline: "Salam Air", passenger: "Ali Hamza", seats: 1, total: "PKR 72,000",
    payment: "received", ticket: "on-hold", action: { label: "Upload biometric visa & issue", kind: "warn" },
  },
  {
    ref: "ROHI3B22", date: "21 Sep 2026", from: "Karachi", to: "Jeddah", fromCode: "KHI", toCode: "JED",
    airline: "flyadeal", passenger: "Sana Tariq", seats: 2, total: "PKR 138,000",
    payment: "confirmed", ticket: "confirmed", action: null,
  },
];

const paymentLabel: Record<Booking["payment"], string> = {
  received: "RECEIVED", ledger: "ADDED IN LEDGER", pending: "PAYMENT PENDING", confirmed: "CONFIRMED",
};
const ticketLabel: Record<Booking["ticket"], string> = {
  "on-hold": "ON HOLD", confirmed: "CONFIRMED", issued: "ISSUED",
};

function StatusPill({ tone, children }: { tone: "blue" | "amber" | "green" | "rose"; children: React.ReactNode }) {
  const map = {
    blue: "bg-booking-blue-soft text-booking-blue",
    amber: "bg-booking-amber-soft text-booking-amber",
    green: "bg-booking-green-soft text-booking-green",
    rose: "bg-booking-rose-soft text-booking-rose",
  };
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide ${map[tone]}`}>{children}</span>;
}

function paymentTone(p: Booking["payment"]): "blue" | "amber" | "green" | "rose" {
  if (p === "confirmed") return "green";
  if (p === "received") return "blue";
  if (p === "ledger") return "amber";
  return "rose";
}

function ActionChip({ action }: { action: Booking["action"] }) {
  if (!action) return <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-booking-green"><CheckCircle2 className="h-3.5 w-3.5" /> All set</span>;
  const map = {
    urgent: "bg-booking-rose-soft text-booking-rose",
    warn: "bg-booking-amber-soft text-booking-amber",
    info: "bg-muted text-muted-foreground",
  };
  const Icon = action.kind === "urgent" ? Upload : action.kind === "warn" ? ShieldCheck : Clock;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-bold ${map[action.kind]}`}>
      <Icon className="h-3.5 w-3.5" /> {action.label}
    </span>
  );
}

const fadeUp = {
  hidden: { opacity: 0, y: 10 },
  show: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.05, duration: 0.35, ease: "easeOut" as const } }),
};

/* ------------------------------------------------------------------ *
 * Concept 1 — Progress Stepper Rows
 * A slim row per booking with a 4-stage mini progress bar as the
 * dominant visual, so an agent can tell a booking's stage at a glance.
 * ------------------------------------------------------------------ */
const STAGES = ["Payment", "Documents", "Ticketing", "Confirmed"];
function stageIndex(b: Booking) {
  if (b.ticket === "confirmed" && b.payment === "confirmed") return 4;
  if (b.action?.kind === "urgent") return 1; // stuck at payment
  if (b.action?.kind === "warn") return 2; // stuck at documents
  return 3; // ticketing
}
function ConceptStepper() {
  return (
    <div className="space-y-2.5">
      {BOOKINGS.map((b, i) => {
        const stage = stageIndex(b);
        return (
          <motion.div
            key={b.ref}
            custom={i}
            variants={fadeUp}
            initial="hidden"
            animate="show"
            className="grid grid-cols-1 items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-sm md:grid-cols-[140px_1fr_240px_170px]"
          >
            <div>
              <p className="font-mono text-xs font-bold text-booking-blue">{b.ref}</p>
              <p className="text-[11px] text-muted-foreground">{b.date}</p>
            </div>

            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-navy">{b.fromCode} → {b.toCode} <span className="font-normal text-muted-foreground">· {b.airline}</span></p>
              <p className="truncate text-xs text-muted-foreground">{b.passenger} · {b.seats} pax · {b.total}</p>
            </div>

            <div className="flex items-center">
              {STAGES.map((s, si) => {
                const done = si < stage;
                const active = si === stage - 1 && stage < 4;
                return (
                  <div key={s} className="flex flex-1 items-center last:flex-none">
                    <div className="flex flex-col items-center gap-1">
                      <div className={`flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold ${
                        done ? "bg-booking-green text-white" : active ? "bg-booking-amber text-white" : "bg-muted text-muted-foreground"
                      }`}>
                        {done ? "✓" : si + 1}
                      </div>
                      <span className="hidden text-[8px] font-semibold uppercase tracking-wide text-muted-foreground lg:block">{s}</span>
                    </div>
                    {si < STAGES.length - 1 && (
                      <div className={`mx-1 h-[2px] flex-1 rounded ${si < stage - 1 ? "bg-booking-green" : "bg-border"}`} />
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex justify-start md:justify-end">
              <ActionChip action={b.action} />
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Concept 2 — Dense Data Table
 * Classic spreadsheet-style table, maximum bookings per screen.
 * ------------------------------------------------------------------ */
function ConceptTable() {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/40 text-left text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">
            <th className="px-4 py-3">Booking</th>
            <th className="px-4 py-3">Route &amp; Airline</th>
            <th className="px-4 py-3">Passenger</th>
            <th className="px-4 py-3">Total</th>
            <th className="px-4 py-3">Payment</th>
            <th className="px-4 py-3">Ticket</th>
            <th className="px-4 py-3">Recommended Action</th>
            <th className="px-4 py-3 text-right">Quick</th>
          </tr>
        </thead>
        <tbody>
          {BOOKINGS.map((b, i) => (
            <motion.tr
              key={b.ref}
              custom={i}
              variants={fadeUp}
              initial="hidden"
              animate="show"
              className="border-b border-border last:border-0 hover:bg-muted/30"
            >
              <td className="px-4 py-3">
                <p className="font-mono text-xs font-bold text-booking-blue">{b.ref}</p>
                <p className="text-[11px] text-muted-foreground">{b.date}</p>
              </td>
              <td className="px-4 py-3">
                <p className="font-semibold text-navy">{b.fromCode} → {b.toCode}</p>
                <p className="text-xs text-muted-foreground">{b.airline}</p>
              </td>
              <td className="px-4 py-3">
                <p className="font-medium text-navy">{b.passenger}</p>
                <p className="text-xs text-muted-foreground">{b.seats} pax</p>
              </td>
              <td className="px-4 py-3 font-bold text-navy">{b.total}</td>
              <td className="px-4 py-3"><StatusPill tone={paymentTone(b.payment)}>{paymentLabel[b.payment]}</StatusPill></td>
              <td className="px-4 py-3"><StatusPill tone={b.ticket === "confirmed" ? "green" : "amber"}>{ticketLabel[b.ticket]}</StatusPill></td>
              <td className="px-4 py-3"><ActionChip action={b.action} /></td>
              <td className="px-4 py-3">
                <div className="flex justify-end gap-1.5">
                  <button className="rounded-md border border-border p-1.5 text-muted-foreground hover:text-navy" title="Download ticket"><Download className="h-3.5 w-3.5" /></button>
                  <button className="rounded-md border border-border p-1.5 text-muted-foreground hover:text-navy" title="Details"><FileText className="h-3.5 w-3.5" /></button>
                  <button className="rounded-md bg-whatsapp p-1.5 text-whatsapp-foreground" title="WhatsApp agent"><MessageCircle className="h-3.5 w-3.5" /></button>
                </div>
              </td>
            </motion.tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Concept 3 — Status Kanban
 * Grouped into three columns by urgency, so agents triage at a glance.
 * ------------------------------------------------------------------ */
function ConceptKanban() {
  const needsAction = BOOKINGS.filter((b) => b.action?.kind === "urgent" || b.action?.kind === "warn");
  const processing = BOOKINGS.filter((b) => b.action?.kind === "info");
  const confirmed = BOOKINGS.filter((b) => !b.action);

  const toneText = { rose: "text-booking-rose", amber: "text-booking-amber", green: "text-booking-green" } as const;
  const Column = ({ title, tone, items }: { title: string; tone: "rose" | "amber" | "green"; items: Booking[] }) => (
    <div className="flex-1 min-w-[260px]">
      <div className="mb-3 flex items-center justify-between">
        <p className={`text-xs font-extrabold uppercase tracking-wide ${toneText[tone]}`}>{title}</p>
        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">{items.length}</span>
      </div>
      <div className="space-y-2.5">
        {items.map((b, i) => (
          <motion.div
            key={b.ref}
            custom={i}
            variants={fadeUp}
            initial="hidden"
            animate="show"
            className="rounded-xl border border-border bg-card p-3.5 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <p className="font-mono text-[11px] font-bold text-booking-blue">{b.ref}</p>
              <p className="text-[10px] text-muted-foreground">{b.date}</p>
            </div>
            <p className="mt-1.5 text-sm font-bold text-navy">{b.fromCode} → {b.toCode}</p>
            <p className="text-xs text-muted-foreground">{b.airline} · {b.passenger}</p>
            <p className="mt-1 text-sm font-extrabold text-navy">{b.total}</p>
            {b.action && (
              <div className="mt-2.5">
                <ActionChip action={b.action} />
              </div>
            )}
          </motion.div>
        ))}
        {items.length === 0 && <p className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">Nothing here</p>}
      </div>
    </div>
  );

  return (
    <div className="flex flex-wrap gap-4">
      <Column title="Needs Action" tone="rose" items={needsAction} />
      <Column title="Processing" tone="amber" items={processing} />
      <Column title="Confirmed" tone="green" items={confirmed} />
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Concept 4 — Expandable Accordion Rows
 * Ultra-compact one-line summaries; click to expand full details.
 * Maximizes bookings visible without scrolling.
 * ------------------------------------------------------------------ */
function ConceptAccordion() {
  const [open, setOpen] = useState<string | null>(BOOKINGS[1].ref);
  return (
    <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
      {BOOKINGS.map((b, i) => {
        const isOpen = open === b.ref;
        return (
          <motion.div key={b.ref} custom={i} variants={fadeUp} initial="hidden" animate="show">
            <button
              onClick={() => setOpen(isOpen ? null : b.ref)}
              className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/30"
            >
              <ChevronRight className={`h-4 w-4 flex-shrink-0 text-muted-foreground transition-transform ${isOpen ? "rotate-90" : ""}`} />
              <span className="w-24 flex-shrink-0 font-mono text-xs font-bold text-booking-blue">{b.ref}</span>
              <span className="w-28 flex-shrink-0 text-sm font-semibold text-navy">{b.fromCode} → {b.toCode}</span>
              <span className="flex-1 truncate text-xs text-muted-foreground">{b.passenger} · {b.airline}</span>
              <span className="w-24 flex-shrink-0 text-right text-sm font-bold text-navy">{b.total}</span>
              <span className="w-8 flex-shrink-0 text-right">
                {b.action ? (
                  <span className={`inline-block h-2 w-2 rounded-full ${b.action.kind === "urgent" ? "bg-booking-rose" : b.action.kind === "warn" ? "bg-booking-amber" : "bg-booking-blue"}`} />
                ) : (
                  <CheckCircle2 className="ml-auto h-4 w-4 text-booking-green" />
                )}
              </span>
              <ChevronDown className={`h-3.5 w-3.5 flex-shrink-0 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
            </button>
            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25, ease: "easeOut" }}
                  className="overflow-hidden bg-muted/20"
                >
                  <div className="grid grid-cols-1 gap-4 px-4 py-4 pl-11 md:grid-cols-3">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Payment</p>
                      <div className="mt-1"><StatusPill tone={paymentTone(b.payment)}>{paymentLabel[b.payment]}</StatusPill></div>
                      <p className="mt-2 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Ticket status</p>
                      <div className="mt-1"><StatusPill tone={b.ticket === "confirmed" ? "green" : "amber"}>{ticketLabel[b.ticket]}</StatusPill></div>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Recommended action</p>
                      <div className="mt-1.5"><ActionChip action={b.action} /></div>
                    </div>
                    <div className="flex items-start justify-start gap-2 md:justify-end">
                      <button className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-navy hover:bg-muted"><Download className="h-3.5 w-3.5" /> Ticket</button>
                      <button className="inline-flex items-center gap-1.5 rounded-lg bg-whatsapp px-3 py-1.5 text-xs font-semibold text-whatsapp-foreground"><MessageCircle className="h-3.5 w-3.5" /> WhatsApp</button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Concept 5 — Boarding Pass Strip
 * A horizontal ticket-stub layout with a perforated divider and a
 * vertical progress rail, leaning into the "travel" identity.
 * ------------------------------------------------------------------ */
function ConceptBoardingPass() {
  return (
    <div className="space-y-3">
      {BOOKINGS.map((b, i) => {
        const stage = stageIndex(b);
        return (
          <motion.div
            key={b.ref}
            custom={i}
            variants={fadeUp}
            initial="hidden"
            animate="show"
            className="relative flex overflow-hidden rounded-xl border border-border bg-card shadow-sm"
          >
            <div className="flex w-20 flex-shrink-0 flex-col items-center justify-center gap-1 bg-navy py-3 text-navy-foreground">
              <span className="font-serif text-xl font-black leading-none">{b.seats}</span>
              <span className="text-[8px] font-bold uppercase tracking-widest text-gold">PAX</span>
            </div>

            {/* perforated divider */}
            <div className="relative flex w-0 flex-col items-center">
              <span className="absolute -left-2 -top-2 h-4 w-4 rounded-full bg-background" />
              <span className="h-full w-px border-l border-dashed border-border" />
              <span className="absolute -bottom-2 -left-2 h-4 w-4 rounded-full bg-background" />
            </div>

            <div className="flex-1 px-5 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-mono text-[11px] font-bold text-booking-blue">{b.ref} <span className="font-sans font-normal text-muted-foreground">· {b.date}</span></p>
                  <p className="text-base font-bold text-navy">{b.from} → {b.to} <span className="font-normal text-muted-foreground">({b.fromCode}→{b.toCode})</span></p>
                  <p className="text-xs text-muted-foreground">{b.airline} · {b.passenger} · {b.total}</p>
                </div>
                <ActionChip action={b.action} />
              </div>
            </div>

            {/* vertical progress rail */}
            <div className="flex w-10 flex-shrink-0 flex-col items-center justify-center gap-1.5 border-l border-dashed border-border bg-muted/20 py-3">
              {STAGES.map((s, si) => (
                <div
                  key={s}
                  title={s}
                  className={`h-2 w-2 rounded-full ${si < stage ? "bg-booking-green" : si === stage ? "bg-booking-amber" : "bg-border"}`}
                />
              ))}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */

const CONCEPTS = [
  { id: "stepper", name: "Progress Stepper Rows", desc: "A 4-stage mini progress bar per booking (Payment → Documents → Ticketing → Confirmed) so status is visible at a glance, action shown only when it's the agent's turn.", Comp: ConceptStepper },
  { id: "table", name: "Dense Data Table", desc: "Classic spreadsheet layout — maximum bookings visible per screen, status pills and a dedicated Recommended Action column.", Comp: ConceptTable },
  { id: "kanban", name: "Status Kanban", desc: "Bookings grouped into Needs Action / Processing / Confirmed columns, so agents triage urgent ones first.", Comp: ConceptKanban },
  { id: "accordion", name: "Expandable Accordion Rows", desc: "Ultra-compact one-line rows by default — click to expand full passenger/flight detail inline, without leaving the page.", Comp: ConceptAccordion },
  { id: "boarding-pass", name: "Boarding Pass Strip", desc: "A ticket-stub inspired horizontal card with a perforated divider and a vertical progress rail — leans into the travel-agency identity.", Comp: ConceptBoardingPass },
] as const;

function Page() {
  const [active, setActive] = useState<(typeof CONCEPTS)[number]["id"]>("stepper");
  const current = CONCEPTS.find((c) => c.id === active)!;

  return (
    <div className="min-h-screen bg-background px-4 py-10 md:px-8">
      <div className="mx-auto max-w-6xl">
        <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-gold">Rohi International Travels · Design Lab</p>
        <h1 className="mt-2 font-serif text-3xl font-black text-navy md:text-4xl">All Group Bookings — Redesign Concepts</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Five real, working layouts using the same theme colors, fonts and Framer Motion animations as the rest of the site. Pick one and I'll build it into the live agent portal.
        </p>

        <div className="mt-6 flex flex-wrap gap-2">
          {CONCEPTS.map((c) => (
            <button
              key={c.id}
              onClick={() => setActive(c.id)}
              className={`rounded-full px-4 py-2 text-xs font-bold uppercase tracking-wide transition ${
                active === c.id ? "bg-navy text-navy-foreground ring-1 ring-gold" : "bg-secondary text-secondary-foreground hover:bg-muted"
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>

        <p className="mt-4 flex items-start gap-1.5 text-xs text-muted-foreground">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-gold" /> {current.desc}
        </p>

        <AnimatePresence mode="wait">
          <motion.div
            key={active}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8, transition: { duration: 0.15 } }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="mt-6"
          >
            <current.Comp />
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
