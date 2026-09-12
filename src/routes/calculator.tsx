import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { Plane, Calculator as CalcIcon, CalendarPlus, CalendarClock, CalendarRange, ArrowLeft, Percent, Timer } from "lucide-react";

export const Route = createFileRoute("/calculator")({
  head: () => ({
    meta: [
      { title: "Date Calculator — Rohi International Travels" },
      { name: "description", content: "Add/subtract days, calculate age or duration, and count days between two dates." },
      { property: "og:title", content: "Date Calculator — Rohi International Travels" },
      { property: "og:description", content: "Handy date tools for travel agents: add/subtract days, age & duration, day counter." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://rohitravels.com/calculator" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://rohitravels.com/calculator" }],
  }),

  component: CalculatorPage,
});

function fmt(d: Date) {
  const day = String(d.getDate()).padStart(2, "0");
  const mon = d.toLocaleString("en-US", { month: "short" });
  const yr = String(d.getFullYear()).slice(-2);
  return `${day}-${mon}-${yr}`;
}

function parseDate(v: string): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

function CalculatorPage() {
  const [activeCalculator, setActiveCalculator] = useState("add-subtract");
  const tabs = [
    { id: "add-subtract", label: "Add / Subtract Days" },
    { id: "age-duration", label: "Age / Duration" },
    { id: "days-between", label: "No. of Days" },
    { id: "hours-between", label: "Hours Between (From / To)" },
    { id: "discount", label: "Discount Calculator" },
  ];

  return (
    <div className="min-h-screen bg-background text-navy animate-premium-fade">
      <section className="bg-navy text-navy-foreground">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:py-14">
          <div className="flex items-center gap-3 text-gold">
            <CalcIcon className="h-5 w-5" aria-hidden="true" />
            <span className="text-xs font-bold uppercase tracking-[0.3em]">Travel Tools</span>
          </div>
          <h1 className="mt-3 font-serif text-4xl font-black sm:text-5xl">Date Calculator</h1>
          <p className="mt-3 max-w-2xl text-sm text-navy-foreground/75 sm:text-base">
            Plan dates, check durations, and calculate group fare discounts in one place.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-10 sm:py-14">
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gold/15 text-navy">
            <CalcIcon className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-serif text-2xl font-black text-navy">Quick calculations</h2>
            <p className="text-sm text-muted-foreground">Useful tools for everyday travel planning.</p>
          </div>
        </div>

        <div className="overflow-x-auto border-b border-border">
          <div className="flex min-w-max gap-1" role="tablist" aria-label="Calculator tools">
            {tabs.map((tab) => {
              const selected = activeCalculator === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => setActiveCalculator(tab.id)}
                  className={`border-b-2 px-3 py-3 text-xs font-bold transition sm:px-4 ${
                    selected
                      ? "border-gold text-navy"
                      : "border-transparent text-muted-foreground hover:border-gold/50 hover:text-navy"
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-6" role="tabpanel" aria-label={tabs.find((tab) => tab.id === activeCalculator)?.label}>
          {activeCalculator === "add-subtract" && <AddSubtractDays />}
          {activeCalculator === "age-duration" && <AgeDuration />}
          {activeCalculator === "days-between" && <DaysBetween />}
          {activeCalculator === "hours-between" && <HoursBetween />}
          {activeCalculator === "discount" && <DiscountCalculator />}
        </div>


      </section>
    </div>
  );
}

function Card({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm sm:p-6">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gold/15 text-navy">{icon}</div>
        <h2 className="font-serif text-lg font-black text-navy">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-black uppercase tracking-widest text-navy/70">{label}</span>
      {children}
    </label>
  );
}

const inputCls =
  "w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm text-navy outline-none focus:border-gold focus:ring-2 focus:ring-gold/30";

function Result({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-5 rounded-lg bg-navy px-4 py-3 text-center">
      <p className="text-[10px] font-bold uppercase tracking-widest text-gold">Result</p>
      <p className="mt-1 font-serif text-xl font-black text-white">{children}</p>
    </div>
  );
}

function AddSubtractDays() {
  const [start, setStart] = useState("");
  const [days, setDays] = useState<string>("");
  const [mode, setMode] = useState<"add" | "sub">("add");

  const result = useMemo(() => {
    const d = parseDate(start);
    const n = parseInt(days, 10);
    if (!d || isNaN(n)) return null;
    const out = new Date(d);
    out.setDate(out.getDate() + (mode === "add" ? n : -n));
    return out;
  }, [start, days, mode]);

  return (
    <Card icon={<CalendarPlus className="h-5 w-5" />} title="Add / Subtract Days">
      <div className="space-y-3">
        <Field label="Start Date">
          <input type="date" value={start} onChange={(e) => setStart(e.target.value)} className={inputCls} />
        </Field>
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <Field label="Days">
            <input
              type="number"
              min={0}
              value={days}
              onChange={(e) => setDays(e.target.value)}
              placeholder="e.g. 80"
              className={inputCls}
            />
          </Field>
          <Field label="Mode">
            <div className="inline-flex overflow-hidden rounded-md border border-input">
              <button
                type="button"
                onClick={() => setMode("add")}
                className={`px-3 py-2.5 text-xs font-bold ${mode === "add" ? "bg-navy text-white" : "bg-white text-navy"}`}
              >
                +
              </button>
              <button
                type="button"
                onClick={() => setMode("sub")}
                className={`px-3 py-2.5 text-xs font-bold ${mode === "sub" ? "bg-navy text-white" : "bg-white text-navy"}`}
              >
                −
              </button>
            </div>
          </Field>
        </div>
      </div>
      {result && <Result>{fmt(result)}</Result>}
    </Card>
  );
}

function AgeDuration() {
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");

  const result = useMemo(() => {
    const a = parseDate(start);
    const b = parseDate(end);
    if (!a || !b) return null;
    const [from, to] = a <= b ? [a, b] : [b, a];
    let years = to.getFullYear() - from.getFullYear();
    let months = to.getMonth() - from.getMonth();
    let days = to.getDate() - from.getDate();
    if (days < 0) {
      months -= 1;
      const prevMonth = new Date(to.getFullYear(), to.getMonth(), 0);
      days += prevMonth.getDate();
    }
    if (months < 0) {
      years -= 1;
      months += 12;
    }
    return { years, months, days };
  }, [start, end]);

  return (
    <Card icon={<CalendarClock className="h-5 w-5" />} title="Age / Duration">
      <div className="space-y-3">
        <Field label="Start Date">
          <input type="date" value={start} onChange={(e) => setStart(e.target.value)} className={inputCls} />
        </Field>
        <Field label="End Date">
          <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className={inputCls} />
        </Field>
      </div>
      {result && (
        <Result>
          {result.years} Years, {result.months} Months, {result.days} Days
        </Result>
      )}
    </Card>
  );
}

function DaysBetween() {
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");

  const result = useMemo(() => {
    const a = parseDate(start);
    const b = parseDate(end);
    if (!a || !b) return null;
    const ms = Math.abs(b.getTime() - a.getTime());
    return Math.round(ms / 86400000);
  }, [start, end]);

  return (
    <Card icon={<CalendarRange className="h-5 w-5" />} title="No. of Days">
      <div className="space-y-3">
        <Field label="Start Date">
          <input type="date" value={start} onChange={(e) => setStart(e.target.value)} className={inputCls} />
        </Field>
        <Field label="End Date">
          <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className={inputCls} />
        </Field>
      </div>
      {result !== null && <Result>{result} Days</Result>}
    </Card>
  );
}

function DiscountCalculator() {
  const [criteria, setCriteria] = useState<string>("");
  const [farePerPax, setFarePerPax] = useState<string>("");
  const [basicFare, setBasicFare] = useState<string>("");
  const [pax, setPax] = useState<string>("");

  const num = (v: string) => {
    const n = parseFloat(v);
    return isNaN(n) ? 0 : n;
  };

  const pct = num(criteria);
  const fpp = num(farePerPax);
  const basic = num(basicFare);
  const p = num(pax);

  const totalAll = fpp * p;
  const discountReceived = (basic * pct) / 100 * p;
  const netInvoice = totalAll - discountReceived;

  const money = (n: number) =>
    n.toLocaleString("en-PK", { maximumFractionDigits: 2, minimumFractionDigits: 0 });

  return (
    <Card icon={<Percent className="h-5 w-5" />} title="Discount Calculator">
      <div className="grid gap-3 md:grid-cols-4">
        <Field label="% Discount Criteria">
          <input type="number" min={0} step="0.01" value={criteria} onChange={(e) => setCriteria(e.target.value)} placeholder="e.g. 5" className={inputCls} />
        </Field>
        <Field label="Total Fare / Pax">
          <input type="number" min={0} step="0.01" value={farePerPax} onChange={(e) => setFarePerPax(e.target.value)} placeholder="e.g. 120000" className={inputCls} />
        </Field>
        <Field label="Basic Fare / Pax">
          <input type="number" min={0} step="0.01" value={basicFare} onChange={(e) => setBasicFare(e.target.value)} placeholder="e.g. 90000" className={inputCls} />
        </Field>

        <Field label="No. of Pax">
          <input type="number" min={0} step="1" value={pax} onChange={(e) => setPax(e.target.value)} placeholder="e.g. 2" className={inputCls} />
        </Field>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <div className="rounded-lg bg-secondary px-4 py-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-navy/70">Total Fare (All Pax)</p>
          <p className="mt-1 font-serif text-xl font-black text-navy">{money(totalAll)}</p>
        </div>
        <div className="rounded-lg bg-gold/15 px-4 py-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-navy/70">Total Discount Received</p>
          <p className="mt-1 font-serif text-xl font-black text-navy">{money(discountReceived)}</p>
        </div>

        <div className="rounded-lg bg-navy px-4 py-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gold">Net Invoice (All Pax)</p>
          <p className="mt-1 font-serif text-xl font-black text-white">{money(netInvoice)}</p>
        </div>
      </div>
    </Card>
  );
}

function HoursBetween() {
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");

  const result = useMemo(() => {
    if (!start || !end) return null;
    const a = new Date(start);
    const b = new Date(end);
    if (isNaN(a.getTime()) || isNaN(b.getTime())) return null;
    const ms = b.getTime() - a.getTime();
    const sign = ms < 0 ? -1 : 1;
    const abs = Math.abs(ms);
    const totalMinutes = Math.floor(abs / 60000);
    const days = Math.floor(totalMinutes / (60 * 24));
    const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
    const minutes = totalMinutes % 60;
    const totalHours = abs / 3600000;
    return { sign, days, hours, minutes, totalHours, totalMinutes: totalMinutes * sign };
  }, [start, end]);

  return (
    <Card icon={<Timer className="h-5 w-5" />} title="Hours Between (From / To)">
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="From (Date & Time)">
          <input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} className={inputCls} />
        </Field>
        <Field label="To (Date & Time)">
          <input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} className={inputCls} />
        </Field>
      </div>
      {result && (
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <div className="rounded-lg bg-navy px-4 py-3 text-center">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gold">Duration</p>
            <p className="mt-1 font-serif text-xl font-black text-white">
              {result.sign < 0 ? "− " : ""}
              {result.days > 0 && `${result.days}d `}
              {result.hours}h {result.minutes}m
            </p>
          </div>
          <div className="rounded-lg bg-gold/15 px-4 py-3 text-center">
            <p className="text-[10px] font-bold uppercase tracking-widest text-navy/70">Total Hours</p>
            <p className="mt-1 font-serif text-xl font-black text-navy">
              {result.totalHours.toLocaleString("en-US", { maximumFractionDigits: 2 })} hrs
            </p>
          </div>
        </div>
      )}
    </Card>
  );
}

