import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ClipboardList, Plus, Trash2, Download, Save, Check, FileText } from "lucide-react";
import { listAirlines, listLocations, listLuggage } from "@/lib/fares.functions";
import {
  listSelfGroupApplications,
  createSelfGroupApplication,
  updateSelfGroupApplication,
  deleteSelfGroupApplication,
  type SelfGroupApplication,
} from "@/lib/self-groups.functions";

const money = (n: number) =>
  Number.isFinite(n) && n !== 0 ? Math.round(n).toLocaleString("en-US") : n === 0 ? "0" : "";

function fmtDate(d: string | null) {
  if (!d) return "";
  const dt = new Date(d + "T00:00:00");
  if (Number.isNaN(dt.getTime())) return d;
  const mon = dt.toLocaleString("en-US", { month: "short" });
  return `${String(dt.getDate()).padStart(2, "0")}-${mon}-${String(dt.getFullYear()).slice(2)}`;
}

export type AppliedRowCalc = {
  total: number;
  initial: number;
  additional: number;
  balanceDue: number;
  balance: number;
  reminder: string;
};

export function calcApplied(r: SelfGroupApplication): AppliedRowCalc {
  const total = (Number(r.seats) || 0) * (Number(r.fare_per_pax) || 0);
  const initial = total * 0.25;
  const additional = total * 0.25;
  const balanceDue = total * 0.5;
  const paidAdditional = Number(r.additional_25_paid) || 0;
  const paidBalance = Number(r.balance_50_paid) || 0;
  const paid = (total > 0 ? initial : 0) + paidAdditional + paidBalance;
  const balance = Math.max(total - paid, 0);

  let reminder = "";
  if (r.flight_date) {
    if (total > 0 && balance <= 0) reminder = "PAID";
    else {
      const days = Math.ceil(
        (new Date(r.flight_date + "T00:00:00").getTime() - new Date(new Date().toDateString()).getTime()) /
          86400000,
      );
      reminder = days >= 15 ? "Second Deposit Available" : "Make Deposit";
    }
  }
  return { total, initial, additional, balanceDue, balance, reminder };
}

const HEAD = [
  "Groups",
  "Group Applied Date",
  "Airline",
  "From",
  "To",
  "Flight Details",
  "Luggage",
  "Meal",
  "No. Of Seats",
  "Fare Confirmed (Per Pax)",
  "Total Group Amount",
  "Initial 25% ADV",
  "25% Additional",
  "50% Balance Due",
  "Reminder",
  "25% Additional Paid Date",
  "25% Additional Paid Amount",
  "50% Balance Paid Date",
  "50% Balance Paid Amount",
  "Balance",
  "Actions",
];


export type AppliedPrefill = {
  airline?: string;
  origin?: string;
  destination?: string;
  flight_details?: string;
  luggage?: string;
  meal?: string;
  seats?: number;
  flight_date?: string | null;
  fare_id?: string | null;
};

export function GroupsAppliedPanel({ prefills = [] }: { prefills?: (AppliedPrefill & { label: string })[] }) {
  const qc = useQueryClient();
  const { data: rows = [], isLoading } = useQuery<SelfGroupApplication[]>({
    queryKey: ["self-group-applications"],
    queryFn: () => listSelfGroupApplications(),
  });
  const { data: airlines = [] } = useQuery({ queryKey: ["airlines"], queryFn: () => listAirlines() });
  const { data: locations = [] } = useQuery({ queryKey: ["locations"], queryFn: () => listLocations() });
  const { data: luggages = [] } = useQuery({ queryKey: ["luggage"], queryFn: () => listLuggage() });
  const lists: Lists = { airlines, locations, luggages };
  const create = useServerFn(createSelfGroupApplication);
  const update = useServerFn(updateSelfGroupApplication);
  const remove = useServerFn(deleteSelfGroupApplication);
  const refetch = async () => {
    await qc.invalidateQueries({ queryKey: ["self-group-applications"] });
    await qc.invalidateQueries({ queryKey: ["fares"] });
  };

  const [pick, setPick] = useState("");

  async function addRow(pre?: AppliedPrefill) {
    await create({
      data: {
        group_label: `GROUP ${rows.length + 1}`,
        applied_date: new Date().toISOString().slice(0, 10),
        sort_order: rows.length + 1,
        airline: pre?.airline ?? "",
        origin: pre?.origin ?? "",
        destination: pre?.destination ?? "",
        flight_details: pre?.flight_details ?? "",
        luggage: pre?.luggage ?? "",
        meal: pre?.meal ?? "Not Included",
        seats: pre?.seats ?? 0,
        flight_date: pre?.flight_date ?? null,
        fare_id: pre?.fare_id ?? null,
      },
    });
    await refetch();
  }

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, r) => {
        const c = calcApplied(r);
        acc.total += c.total;
        acc.initial += c.initial;
        acc.additional += c.additional;
        acc.balanceDue += c.balanceDue;
        acc.balance += c.balance;
        acc.paid25 += Number(r.additional_25_paid) || 0;
        acc.paid50 += Number(r.balance_50_paid) || 0;
        return acc;
      },
      { total: 0, initial: 0, additional: 0, balanceDue: 0, balance: 0, paid25: 0, paid50: 0 },

    );
  }, [rows]);

  function bodyRows() {
    return rows.map((r) => {
      const c = calcApplied(r);
      return [
        r.group_label, fmtDate(r.applied_date), r.airline, r.origin, r.destination,
        r.flight_details, r.luggage, r.meal, r.seats, r.fare_per_pax,
        Math.round(c.total), Math.round(c.initial), Math.round(c.additional), Math.round(c.balanceDue),
        c.reminder,
        fmtDate(r.additional_25_paid_date), Math.round(Number(r.additional_25_paid) || 0),
        fmtDate(r.balance_50_paid_date), Math.round(Number(r.balance_50_paid) || 0),
        Math.round(c.balance),

      ];
    });
  }

  async function exportXlsx() {
    const XLSX = await import("xlsx");
    const aoa = [HEAD.slice(0, -1), ...bodyRows()];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), "Groups Applied");
    const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const url = URL.createObjectURL(
      new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `groups-applied-${new Date().toISOString().slice(0, 10)}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function exportPdf() {
    const { default: jsPDF } = await import("jspdf");
    const autoTable = (await import("jspdf-autotable")).default;
    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a3" });
    doc.setFontSize(14);
    doc.text("Groups Applied · Payment Status", 40, 32);
    doc.setFontSize(9);
    doc.text(new Date().toLocaleString(), 40, 48);
    autoTable(doc, {
      head: [HEAD.slice(0, -1)],
      body: bodyRows().map((r) => r.map((c) => String(c ?? ""))),
      startY: 60,
      styles: { fontSize: 7, cellPadding: 3 },
      headStyles: { fillColor: [11, 16, 36], textColor: 255 },
    });
    doc.save(`groups-applied-${new Date().toISOString().slice(0, 10)}.pdf`);
  }

  const save = async (id: string, patch: Partial<SelfGroupApplication>) => {
    await update({ data: { id, ...patch } as never });
    await refetch();
  };

  return (
    <section className="overflow-hidden rounded-xl bg-card ring-1 ring-border">
      <div className="flex flex-wrap items-center justify-between gap-4 bg-navy px-5 py-3 text-navy-foreground">
        <div className="flex items-center gap-3">
          <ClipboardList className="h-5 w-5 text-gold" />
          <div>
            <p className="font-serif text-lg font-black">Groups Applied · Payment Status</p>
            <p className="text-[11px] text-white/70">
              Total, 25% advance, 25% additional and 50% balance auto-calculate from seats × fare per pax
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {prefills.length > 0 && (
            <select
              value={pick}
              onChange={async (e) => {
                const i = Number(e.target.value);
                setPick("");
                const p = prefills[i];
                if (p) await addRow(p);
              }}
              className="rounded-md border border-white/20 bg-navy px-2 py-1.5 text-xs font-semibold"
            >
              <option value="">Add from self group fare…</option>
              {prefills.map((p, i) => (
                <option key={i} value={i}>{p.label}</option>
              ))}
            </select>
          )}
          <button onClick={() => addRow()} className="inline-flex items-center gap-1.5 rounded-md bg-gold px-3 py-1.5 text-xs font-bold text-gold-foreground hover:brightness-105">
            <Plus className="h-3.5 w-3.5" /> Add group
          </button>
          <button onClick={exportXlsx} className="inline-flex items-center gap-1.5 rounded-md border border-white/20 px-3 py-1.5 text-xs font-bold hover:bg-white/10">
            <Download className="h-3.5 w-3.5" /> Excel
          </button>
          <button onClick={exportPdf} className="inline-flex items-center gap-1.5 rounded-md border border-white/20 px-3 py-1.5 text-xs font-bold hover:bg-white/10">
            <FileText className="h-3.5 w-3.5" /> PDF
          </button>
        </div>
      </div>

      <datalist id="ga-airlines">
        {airlines.map((a) => (
          <option key={a.id} value={a.name}>{a.iata_code}</option>
        ))}
      </datalist>
      <datalist id="ga-locations">
        {locations.map((l) => (
          <option key={l.id} value={l.code}>{l.city}</option>
        ))}
      </datalist>
      <datalist id="ga-luggage">
        {luggages.map((l) => (
          <option key={l.id} value={l.label} />
        ))}
      </datalist>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[1900px] border-collapse text-[12px]">
          <thead>
            <tr className="bg-navy/95 text-navy-foreground">
              {HEAD.map((h, i) => (
                <th key={i} className="border border-white/10 px-2 py-2 text-center align-middle text-[10px] font-bold uppercase leading-tight tracking-wide">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={HEAD.length} className="py-8 text-center text-muted-foreground">Loading…</td></tr>
            )}
            {!isLoading && rows.length === 0 && (
              <tr><td colSpan={HEAD.length} className="py-8 text-center text-sm text-muted-foreground">
                No groups applied yet — click <b>Add group</b>.
              </td></tr>
            )}
            {rows.map((r, i) => (
              <Row
                key={r.id}
                row={r}
                index={i}
                lists={lists}
                onSave={save}
                onDelete={async () => { await remove({ data: { id: r.id } }); await refetch(); }}
              />
            ))}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr className="bg-gold/20 font-bold text-navy">
                <td className="border border-border px-2 py-2" colSpan={10}>TOTAL</td>
                <td className="border border-border px-2 py-2 text-right">{money(totals.total)}</td>
                <td className="border border-border px-2 py-2 text-right">{money(totals.initial)}</td>
                <td className="border border-border px-2 py-2 text-right">{money(totals.additional)}</td>
                <td className="border border-border px-2 py-2 text-right">{money(totals.balanceDue)}</td>
                <td className="border border-border px-2 py-2" colSpan={2}></td>
                <td className="border border-border px-2 py-2 text-right">{money(totals.paid25)}</td>
                <td className="border border-border px-2 py-2"></td>
                <td className="border border-border px-2 py-2 text-right">{money(totals.paid50)}</td>

                <td className="border border-border px-2 py-2 text-right">{money(totals.balance)}</td>
                <td className="border border-border"></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </section>
  );
}

const cell = "border border-border px-2 py-1.5 align-middle";
const inp = "w-full min-w-[70px] bg-transparent px-1 py-0.5 text-[12px] outline-none focus:bg-secondary/60 rounded";

export type Lists = {
  airlines: { name: string; iata_code: string }[];
  locations: { city: string; code: string }[];
  luggages: { label: string }[];
};

function Row({
  row, index, lists, onSave, onDelete,
}: {
  row: SelfGroupApplication;
  index: number;
  lists: Lists;
  onSave: (id: string, patch: Partial<SelfGroupApplication>) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [draft, setDraft] = useState(row);
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle");
  const c = calcApplied(draft);
  const dirty = useMemo(
    () => (Object.keys(draft) as (keyof SelfGroupApplication)[]).some((k) => draft[k] !== row[k]),
    [draft, row],
  );
  const set = <K extends keyof SelfGroupApplication>(k: K, v: SelfGroupApplication[K]) => {
    setState("idle");
    setDraft((d) => {
      const next = { ...d, [k]: v } as SelfGroupApplication;
      const total = (Number(next.seats) || 0) * (Number(next.fare_per_pax) || 0);
      const today = new Date().toISOString().slice(0, 10);
      if (k === "additional_25_paid") {
        const paid = Number(next.additional_25_paid) || 0;
        if (paid > 0 && !next.additional_25_paid_date) next.additional_25_paid_date = today;
        if (paid === 0) next.additional_25_paid_date = null;
      }
      if (k === "balance_50_paid") {
        const paid = Number(next.balance_50_paid) || 0;
        if (paid > 0 && !next.balance_50_paid_date) next.balance_50_paid_date = today;
        if (paid === 0) next.balance_50_paid_date = null;
      }
      if ((k === "seats" || k === "fare_per_pax") && total > 0 && !next.initial_deposit_paid_date) {
        next.initial_deposit_paid_date = next.applied_date ?? today;
      }
      return next;
    });
  };

  const resolveAirline = (v: string) => {
    const q = v.trim().toUpperCase();
    if (!q) return "";
    const hit =
      lists.airlines.find((a) => a.iata_code.toUpperCase() === q) ??
      lists.airlines.find((a) => a.name.toUpperCase() === q) ??
      lists.airlines.find((a) => a.name.toUpperCase().startsWith(q));
    return hit ? hit.name : v.trim();
  };
  const resolveLoc = (v: string) => {
    const q = v.trim().toUpperCase();
    if (!q) return "";
    const hit =
      lists.locations.find((l) => l.code.toUpperCase() === q) ??
      lists.locations.find((l) => l.city.toUpperCase() === q) ??
      lists.locations.find((l) => l.city.toUpperCase().startsWith(q));
    return hit ? hit.code.toUpperCase() : q;
  };

  async function saveRow() {
    setState("saving");
    const { id, created_at, updated_at, ...patch } = draft;
    await onSave(row.id, patch);
    setState("saved");
    setTimeout(() => setState("idle"), 1500);
  }

  const reminderClass =
    c.reminder === "PAID"
      ? "bg-emerald-100 text-emerald-700 font-bold"
      : c.reminder === "Make Deposit"
        ? "bg-red-100 text-red-700 font-bold"
        : "text-foreground";

  return (
    <tr className={dirty ? "bg-gold/10" : index % 2 ? "bg-secondary/40" : "bg-card"}>
      <td className={cell}>
        <input className={`${inp} font-serif font-black text-navy`} value={draft.group_label}
          placeholder={`GROUP ${index + 1}`}
          onChange={(e) => set("group_label", e.target.value)} />
      </td>
      <td className={cell}>
        <input type="date" className={inp} value={draft.applied_date ?? ""}
          onChange={(e) => set("applied_date", e.target.value || null)} />
      </td>
      <td className={cell}>
        <input list="ga-airlines" className={`${inp} text-center uppercase`} value={draft.airline}
          placeholder="Airline / code"
          onChange={(e) => set("airline", e.target.value)}
          onBlur={(e) => set("airline", resolveAirline(e.target.value))} />
      </td>
      <td className={cell}>
        <input list="ga-locations" className={`${inp} min-w-[60px] text-center font-bold uppercase text-navy`} value={draft.origin}
          placeholder="KHI / Karachi"
          onChange={(e) => set("origin", e.target.value.toUpperCase())}
          onBlur={(e) => set("origin", resolveLoc(e.target.value))} />
      </td>
      <td className={cell}>
        <input list="ga-locations" className={`${inp} min-w-[60px] text-center font-bold uppercase text-navy`} value={draft.destination}
          placeholder="JED / Jeddah"
          onChange={(e) => set("destination", e.target.value.toUpperCase())}
          onBlur={(e) => set("destination", resolveLoc(e.target.value))} />
      </td>
      <td className={cell}>
        <input className={`${inp} min-w-[200px] font-mono font-semibold`} value={draft.flight_details}
          onChange={(e) => set("flight_details", e.target.value.toUpperCase())} />
      </td>
      <td className={cell}>
        <input list="ga-luggage" className={`${inp} min-w-[80px] text-center`} value={draft.luggage} placeholder="20+05 KG"
          onChange={(e) => set("luggage", e.target.value)} />
      </td>
      <td className={cell}>
        <select className={`${inp} text-center`} value={draft.meal || "Not Included"}
          onChange={(e) => set("meal", e.target.value)}>
          <option value="Included">Included</option>
          <option value="Not Included">Not Included</option>
        </select>
      </td>
      <td className={cell}>
        <input type="number" min={0} className={`${inp} min-w-[60px] text-center font-bold`} value={draft.seats}
          onChange={(e) => set("seats", Number(e.target.value) || 0)} />
      </td>
      <td className={`${cell} bg-emerald-50`}>
        <input type="number" min={0} className={`${inp} text-right font-bold`} value={draft.fare_per_pax}
          onChange={(e) => set("fare_per_pax", Number(e.target.value) || 0)} />
      </td>
      <td className={`${cell} bg-navy/5 text-right font-bold text-navy`}>{money(c.total)}</td>
      <td className={`${cell} text-right`}>{money(c.initial)}</td>
      <td className={`${cell} text-right`}>{money(c.additional)}</td>
      <td className={`${cell} text-right font-semibold`}>{money(c.balanceDue)}</td>
      <td className={`${cell} text-center text-[11px] ${reminderClass}`}>{c.reminder}</td>
      <td className={cell}>
        <input type="date" className={inp} value={draft.additional_25_paid_date ?? ""}
          onChange={(e) => set("additional_25_paid_date", e.target.value || null)} />
      </td>
      <td className={`${cell} bg-emerald-50`}>
        <input type="number" min={0} className={`${inp} text-right font-semibold`} placeholder="0"
          value={draft.additional_25_paid}
          onChange={(e) => set("additional_25_paid", Number(e.target.value) || 0)} />
      </td>
      <td className={cell}>
        <input type="date" className={inp} value={draft.balance_50_paid_date ?? ""}
          onChange={(e) => set("balance_50_paid_date", e.target.value || null)} />
      </td>
      <td className={`${cell} bg-emerald-50`}>
        <input type="number" min={0} className={`${inp} text-right font-semibold`} placeholder="0"
          value={draft.balance_50_paid}
          onChange={(e) => set("balance_50_paid", Number(e.target.value) || 0)} />
      </td>

      <td className={`${cell} bg-gold/25 text-right font-black text-navy`}>{money(c.balance)}</td>
      <td className={cell}>
        <div className="flex items-center justify-center gap-1">
          <button
            onClick={saveRow}
            disabled={state === "saving" || (!dirty && state !== "saved")}
            title="Save row"
            className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-bold transition ${
              state === "saved"
                ? "bg-emerald-100 text-emerald-700"
                : dirty
                  ? "bg-navy text-navy-foreground hover:opacity-90"
                  : "bg-muted text-muted-foreground"
            }`}
          >
            {state === "saved" ? <Check className="h-3.5 w-3.5" /> : <Save className="h-3.5 w-3.5" />}
            {state === "saving" ? "Saving…" : state === "saved" ? "Saved" : "Save"}
          </button>
          <button onClick={onDelete} title="Delete group" className="rounded p-1 text-red-600 hover:bg-red-50">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </td>
    </tr>
  );
}
