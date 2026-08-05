import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ClipboardList, Plus, Trash2, X, Download, Save, Check } from "lucide-react";
import {
  listSelfGroupApplications,
  createSelfGroupApplication,
  updateSelfGroupApplication,
  deleteSelfGroupApplication,
  type SelfGroupApplication,
} from "@/lib/self-groups.functions";

const money = (n: number) =>
  Number.isFinite(n) ? Math.round(n).toLocaleString("en-US") : "";

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
  final: number;
  balance: number;
  reminder: string;
};

export function calcApplied(r: SelfGroupApplication): AppliedRowCalc {
  const total = (Number(r.seats) || 0) * (Number(r.fare_per_pax) || 0);
  const initial = total * 0.25;
  const final = total * 0.75;
  const paid = Number(r.final_deposit_paid) || 0;
  const balance = Math.max(final - paid, 0);
  let reminder = "";
  if (r.flight_date) {
    if (r.final_deposit_paid_date || paid >= final && final > 0) reminder = "PAID";
    else {
      const days = Math.ceil(
        (new Date(r.flight_date + "T00:00:00").getTime() - new Date(new Date().toDateString()).getTime()) /
          86400000,
      );
      reminder = days >= 15 ? "Second Deposit Available" : "Make Deposit";
    }
  }
  return { total, initial, final, balance, reminder };
}

const HEAD = [
  "Groups",
  "Group Applied Date",
  "Airline",
  "Sector",
  "Flight Date",
  "Tr",
  "Flight Details",
  "No. Of Seats",
  "Fare Confirmed (Per Pax)",
  "Total Amount",
  "Initial Deposit 25% (Paid @ Group Generate)",
  "Final Deposit 75% Payable",
  "Reminder",
  "Initial Deposit 25% Paid Date",
  "Final Deposit Paid Date",
  "Final Deposit 75% Paid",
  "Balance",
  "",
];

export function GroupsAppliedButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-lg bg-[#b03a3a] px-4 py-2.5 text-xs font-bold uppercase tracking-widest text-white shadow-md ring-1 ring-black/10 transition hover:bg-[#963030]"
      >
        <ClipboardList className="h-4 w-4" /> Groups Applied · Payment Status
      </button>
      {open && <GroupsAppliedPanel onClose={() => setOpen(false)} />}
    </>
  );
}

function GroupsAppliedPanel({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const { data: rows = [], isLoading } = useQuery<SelfGroupApplication[]>({
    queryKey: ["self-group-applications"],
    queryFn: () => listSelfGroupApplications(),
  });
  const create = useServerFn(createSelfGroupApplication);
  const update = useServerFn(updateSelfGroupApplication);
  const remove = useServerFn(deleteSelfGroupApplication);
  const refetch = () => qc.invalidateQueries({ queryKey: ["self-group-applications"] });

  async function addRow() {
    await create({
      data: {
        group_label: `GROUP ${rows.length + 1}`,
        applied_date: new Date().toISOString().slice(0, 10),
        sort_order: rows.length + 1,
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
        acc.final += c.final;
        acc.balance += c.balance;
        return acc;
      },
      { total: 0, initial: 0, final: 0, balance: 0 },
    );
  }, [rows]);

  async function exportXlsx() {
    const XLSX = await import("xlsx");
    const aoa = [
      HEAD.slice(0, -1),
      ...rows.map((r) => {
        const c = calcApplied(r);
        return [
          r.group_label, fmtDate(r.applied_date), r.airline, r.sector, fmtDate(r.flight_date), r.tr,
          r.flight_details, r.seats, r.fare_per_pax, c.total, c.initial, c.final, c.reminder,
          fmtDate(r.initial_deposit_paid_date), fmtDate(r.final_deposit_paid_date),
          r.final_deposit_paid, c.balance,
        ];
      }),
    ];
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

  const save = async (id: string, patch: Partial<SelfGroupApplication>) => {
    await update({ data: { id, ...patch } as never });
    await refetch();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-auto bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-[1700px] overflow-hidden rounded-2xl bg-card shadow-2xl ring-1 ring-border">
        <div className="flex items-center justify-between gap-4 bg-[#b03a3a] px-5 py-3 text-white">
          <div className="flex items-center gap-3">
            <ClipboardList className="h-5 w-5" />
            <div>
              <p className="font-serif text-lg font-black">Groups Applied · Payment Status</p>
              <p className="text-[11px] text-white/80">
                Total &amp; deposits auto-calculate from seats × fare per pax
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={addRow} className="inline-flex items-center gap-1.5 rounded-md bg-white/15 px-3 py-1.5 text-xs font-bold ring-1 ring-white/30 hover:bg-white/25">
              <Plus className="h-3.5 w-3.5" /> Add group
            </button>
            <button onClick={exportXlsx} className="inline-flex items-center gap-1.5 rounded-md bg-white/15 px-3 py-1.5 text-xs font-bold ring-1 ring-white/30 hover:bg-white/25">
              <Download className="h-3.5 w-3.5" /> Excel
            </button>
            <button onClick={onClose} className="rounded-md bg-white/15 p-1.5 ring-1 ring-white/30 hover:bg-white/25">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1600px] border-collapse text-[12px]">
            <thead>
              <tr className="bg-[#b03a3a] text-white">
                {HEAD.map((h, i) => (
                  <th key={i} className="border border-white/20 px-2 py-2 text-center align-middle text-[10px] font-bold uppercase leading-tight tracking-wide">
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
              {rows.map((r) => (
                <Row key={r.id} row={r} onSave={save} onDelete={async () => { await remove({ data: { id: r.id } }); await refetch(); }} />
              ))}
            </tbody>
            {rows.length > 0 && (
              <tfoot>
                <tr className="bg-[#f3e7e7] font-bold text-[#7d2020]">
                  <td className="border border-[#e2c9c9] px-2 py-2" colSpan={9}>TOTAL</td>
                  <td className="border border-[#e2c9c9] px-2 py-2 text-right">{money(totals.total)}</td>
                  <td className="border border-[#e2c9c9] px-2 py-2 text-right">{money(totals.initial)}</td>
                  <td className="border border-[#e2c9c9] px-2 py-2 text-right">{money(totals.final)}</td>
                  <td className="border border-[#e2c9c9] px-2 py-2" colSpan={4}></td>
                  <td className="border border-[#e2c9c9] px-2 py-2 text-right">{money(totals.balance)}</td>
                  <td className="border border-[#e2c9c9]"></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}

const cell = "border border-[#e3d9d9] px-2 py-1.5 align-middle";
const inp = "w-full min-w-[70px] bg-transparent px-1 py-0.5 text-[12px] outline-none focus:bg-secondary/60 rounded";

function Row({
  row, onSave, onDelete,
}: {
  row: SelfGroupApplication;
  onSave: (id: string, patch: Partial<SelfGroupApplication>) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [draft, setDraft] = useState(row);
  const c = calcApplied(draft);
  const set = <K extends keyof SelfGroupApplication>(k: K, v: SelfGroupApplication[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));
  const commit = (k: keyof SelfGroupApplication) => onSave(row.id, { [k]: draft[k] } as never);

  const reminderClass =
    c.reminder === "PAID"
      ? "bg-[#e2e2e2] text-[#333] font-bold"
      : c.reminder === "Make Deposit"
        ? "bg-[#f7d7d7] text-[#8f2020] font-bold"
        : "text-[#333]";

  return (
    <tr className="odd:bg-white even:bg-[#fbf7f7]">
      <td className={cell}>
        <input className={`${inp} font-serif font-black text-[#7d2020]`} value={draft.group_label}
          onChange={(e) => set("group_label", e.target.value)} onBlur={() => commit("group_label")} />
      </td>
      <td className={cell}>
        <input type="date" className={inp} value={draft.applied_date ?? ""}
          onChange={(e) => set("applied_date", e.target.value || null)} onBlur={() => commit("applied_date")} />
      </td>
      <td className={cell}>
        <input className={`${inp} text-center uppercase`} value={draft.airline}
          onChange={(e) => set("airline", e.target.value)} onBlur={() => commit("airline")} />
      </td>
      <td className={cell}>
        <input className={`${inp} font-bold uppercase text-[#1a4b8f]`} value={draft.sector}
          onChange={(e) => set("sector", e.target.value)} onBlur={() => commit("sector")} />
      </td>
      <td className={cell}>
        <input type="date" className={inp} value={draft.flight_date ?? ""}
          onChange={(e) => set("flight_date", e.target.value || null)} onBlur={() => commit("flight_date")} />
      </td>
      <td className={cell}>
        <input className={`${inp} text-center`} value={draft.tr}
          onChange={(e) => set("tr", e.target.value)} onBlur={() => commit("tr")} />
      </td>
      <td className={cell}>
        <input className={`${inp} min-w-[200px] font-semibold`} value={draft.flight_details}
          onChange={(e) => set("flight_details", e.target.value)} onBlur={() => commit("flight_details")} />
      </td>
      <td className={cell}>
        <input type="number" className={`${inp} min-w-[60px] text-center font-bold`} value={draft.seats}
          onChange={(e) => set("seats", Number(e.target.value) || 0)} onBlur={() => commit("seats")} />
      </td>
      <td className={`${cell} bg-[#dff0dc]`}>
        <input type="number" className={`${inp} text-right font-bold`} value={draft.fare_per_pax}
          onChange={(e) => set("fare_per_pax", Number(e.target.value) || 0)} onBlur={() => commit("fare_per_pax")} />
      </td>
      <td className={`${cell} bg-[#f3d7d7] text-right font-bold`}>{money(c.total)}</td>
      <td className={`${cell} text-right`}>{money(c.initial)}</td>
      <td className={`${cell} text-right font-semibold`}>{money(c.final)}</td>
      <td className={`${cell} text-center ${reminderClass}`}>{c.reminder}</td>
      <td className={cell}>
        <input type="date" className={inp} value={draft.initial_deposit_paid_date ?? ""}
          onChange={(e) => set("initial_deposit_paid_date", e.target.value || null)}
          onBlur={() => commit("initial_deposit_paid_date")} />
      </td>
      <td className={cell}>
        <input type="date" className={inp} value={draft.final_deposit_paid_date ?? ""}
          onChange={(e) => set("final_deposit_paid_date", e.target.value || null)}
          onBlur={() => commit("final_deposit_paid_date")} />
      </td>
      <td className={cell}>
        <input type="number" className={`${inp} text-right font-bold`} value={draft.final_deposit_paid}
          onChange={(e) => set("final_deposit_paid", Number(e.target.value) || 0)}
          onBlur={() => commit("final_deposit_paid")} />
      </td>
      <td className={`${cell} bg-[#f7d98a] text-right font-black text-[#5c3c00]`}>{money(c.balance)}</td>
      <td className={cell}>
        <button onClick={onDelete} title="Delete group" className="rounded p-1 text-[#b03a3a] hover:bg-[#f7d7d7]">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </td>
    </tr>
  );
}
