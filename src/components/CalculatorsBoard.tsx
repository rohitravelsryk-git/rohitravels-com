import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarPlus, CalendarClock, CalendarRange, Timer, Percent,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  getCalculatorsContent,
  type CalculatorsContent,
  type CalculatorTool,
  type CalculatorToolId,
} from "@/lib/calculators.functions";

export const calculatorsQueryKey = ["site-settings", "calculators"];

/**
 * Admin-managed Calculators content, shared by the public page and the B2B
 * agent portal so both render the single copy stored in the admin panel.
 * A realtime subscription on site_settings pushes edits instantly.
 */
export function useCalculatorsContent() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: calculatorsQueryKey,
    queryFn: () => getCalculatorsContent(),
    staleTime: 60_000,
  });

  useEffect(() => {
    const channel = supabase
      .channel("calculators-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "site_settings" }, () => {
        qc.invalidateQueries({ queryKey: calculatorsQueryKey });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);

  return data ?? null;
}

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

const inputCls =
  "w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm text-navy outline-none focus:border-gold focus:ring-2 focus:ring-gold/30";

type ToolProps = { title: string; note?: string };

function Card({ icon, title, note, children }: ToolProps & { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm sm:p-6">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gold/15 text-navy">{icon}</div>
        <h2 className="font-serif text-lg font-black text-navy">{title}</h2>
      </div>
      {children}
      {note && (
        <p className="mt-4 rounded-lg bg-secondary px-4 py-3 text-xs leading-relaxed text-navy/80">{note}</p>
      )}
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

function Result({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-5 rounded-lg bg-navy px-4 py-3 text-center">
      <p className="text-[10px] font-bold uppercase tracking-widest text-gold">Result</p>
      <p className="mt-1 font-serif text-xl font-black text-white">{children}</p>
    </div>
  );
}

function AddSubtractDays({ title, note }: ToolProps) {
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
    <Card icon={<CalendarPlus className="h-5 w-5" />} title={title} note={note}>
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

function AgeDuration({ title, note }: ToolProps) {
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
    <Card icon={<CalendarClock className="h-5 w-5" />} title={title} note={note}>
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

function DaysBetween({ title, note }: ToolProps) {
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
    <Card icon={<CalendarRange className="h-5 w-5" />} title={title} note={note}>
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

function HoursBetween({ title, note }: ToolProps) {
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
    return { sign, days, hours, minutes, totalHours };
  }, [start, end]);

  return (
    <Card icon={<Timer className="h-5 w-5" />} title={title} note={note}>
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

function DiscountCalculator({ title, note }: ToolProps) {
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
  const discountReceived = ((basic * pct) / 100) * p;
  const netInvoice = totalAll - discountReceived;

  const money = (n: number) => n.toLocaleString("en-PK", { maximumFractionDigits: 2, minimumFractionDigits: 0 });

  return (
    <Card icon={<Percent className="h-5 w-5" />} title={title} note={note}>
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

const TOOL_ICONS: Record<CalculatorToolId, React.ComponentType<{ className?: string }>> = {
  "add-subtract": CalendarPlus,
  "age-duration": CalendarClock,
  "days-between": CalendarRange,
  "hours-between": Timer,
  discount: Percent,
};

function ToolPanel({ id, title, note }: { id: CalculatorToolId; title: string; note: string }) {
  switch (id) {
    case "add-subtract": return <AddSubtractDays title={title} note={note} />;
    case "age-duration": return <AgeDuration title={title} note={note} />;
    case "days-between": return <DaysBetween title={title} note={note} />;
    case "hours-between": return <HoursBetween title={title} note={note} />;
    case "discount": return <DiscountCalculator title={title} note={note} />;
  }
}

/**
 * The tab strip + active tool. Without `onToolsChange` it renders exactly what
 * visitors see; with it, every tool stays listed (hidden ones dimmed) and an
 * inline editor sits under the tab so the admin edits the live page itself.
 */
export function CalculatorsBoard({
  content,
  onToolsChange,
}: {
  content: CalculatorsContent;
  onToolsChange?: (tools: CalculatorTool[]) => void;
}) {
  const editable = !!onToolsChange;
  const tools = editable ? content.tools : content.tools.filter((t) => t.visible);
  const [activeId, setActiveId] = useState<string>(tools[0]?.id ?? "");
  const active = tools.find((t) => t.id === activeId) ?? tools[0];
  const activeIndex = tools.findIndex((t) => t.id === active?.id);

  if (tools.length === 0) {
    return <p className="text-sm text-muted-foreground">No calculator tools are available right now.</p>;
  }

  function patchActive(changes: Partial<CalculatorTool>) {
    if (!onToolsChange || !active) return;
    onToolsChange(content.tools.map((t) => (t.id === active.id ? { ...t, ...changes } : t)));
  }

  function moveActive(direction: -1 | 1) {
    if (!onToolsChange || activeIndex < 0) return;
    const target = activeIndex + direction;
    if (target < 0 || target >= content.tools.length) return;
    const next = [...content.tools];
    [next[activeIndex], next[target]] = [next[target], next[activeIndex]];
    onToolsChange(next);
  }

  return (
    <>
      <div className="overflow-x-auto border-b border-border">
        <div className="flex min-w-max gap-1" role="tablist" aria-label="Calculator tools">
          {tools.map((tab) => {
            const Icon = TOOL_ICONS[tab.id];
            const selected = active?.id === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setActiveId(tab.id)}
                className={`flex items-center gap-2 border-b-2 px-3 py-3 text-xs font-bold transition sm:px-4 ${
                  selected
                    ? "border-gold text-navy"
                    : "border-transparent text-muted-foreground hover:border-gold/50 hover:text-navy"
                } ${!tab.visible ? "opacity-45" : ""}`}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                {tab.label}
                {!tab.visible && <span className="text-[9px] font-black uppercase text-muted-foreground">hidden</span>}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-6" role="tabpanel" aria-label={active?.label}>
        {active && <ToolPanel id={active.id} title={active.label} note={active.note} />}
      </div>

      {editable && active && (
        <div className="mt-4 rounded-xl border border-dashed border-gold/60 bg-gold/5 p-4">
          <p className="mb-3 text-[10px] font-black uppercase tracking-widest text-gold">Edit this tool</p>
          <div className="flex flex-wrap items-end gap-3">
            <label className="block min-w-[220px] flex-1">
              <span className="mb-1 block text-[10px] font-black uppercase tracking-widest text-navy/70">Name shown on the tab</span>
              <input
                value={active.label}
                onChange={(e) => patchActive({ label: e.target.value })}
                maxLength={60}
                className={inputCls}
              />
            </label>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-input bg-background px-3 py-2.5 text-xs font-bold">
              <input
                type="checkbox"
                checked={active.visible}
                onChange={(e) => patchActive({ visible: e.target.checked })}
                className="h-4 w-4"
              />
              Show to visitors
            </label>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => moveActive(-1)}
                disabled={activeIndex <= 0}
                className="rounded-md border border-input px-3 py-2.5 text-xs font-bold hover:bg-secondary disabled:opacity-40"
              >
                Move up
              </button>
              <button
                type="button"
                onClick={() => moveActive(1)}
                disabled={activeIndex >= content.tools.length - 1}
                className="rounded-md border border-input px-3 py-2.5 text-xs font-bold hover:bg-secondary disabled:opacity-40"
              >
                Move down
              </button>
            </div>
          </div>
          <label className="mt-3 block">
            <span className="mb-1 block text-[10px] font-black uppercase tracking-widest text-navy/70">Note under this tool (optional)</span>
            <textarea
              value={active.note}
              onChange={(e) => patchActive({ note: e.target.value })}
              maxLength={600}
              rows={2}
              placeholder="e.g. Instruction for agents about how to use this tool"
              className={inputCls}
            />
          </label>
        </div>
      )}
    </>
  );
}
