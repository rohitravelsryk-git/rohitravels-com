import { useState, useEffect, useRef } from "react";
import { Check, Pencil } from "lucide-react";

interface FareOnDemandCellProps {
  value: string;
  placeholder?: string;
  onSave: (val: string) => void;
  attention?: boolean;
}

export function FareOnDemandCell({ value, placeholder = "Fare", onSave, attention = false }: FareOnDemandCellProps) {
  const [editing, setEditing] = useState(false);
  const [temp, setTemp] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTemp(value);
  }, [value]);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <input
          ref={inputRef}
          value={temp}
          onChange={(e) => setTemp(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              onSave(temp);
              setEditing(false);
            } else if (e.key === "Escape") {
              setTemp(value);
              setEditing(false);
            }
          }}
          className="w-full rounded border border-navy/30 px-1 py-0.5 text-[10px] font-bold outline-none"
        />
        <button type="button" aria-label="Save fare" onClick={() => { onSave(temp); setEditing(false); }} className="text-booking-green">
          <Check className="h-3 w-3" />
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className={`group flex min-h-8 w-full items-center justify-between gap-1 rounded-md px-2 text-left transition-colors ${attention ? "border border-booking-amber/40 bg-booking-amber-soft/70 text-booking-amber shadow-sm" : "hover:bg-muted"}`}
      aria-label={attention ? "Set Fare On Demand" : "Edit fare"}
    >
      <span className={`text-[10px] font-semibold ${value ? "text-booking-ink" : attention ? "text-booking-amber" : "text-booking-subtle"}`}>
        {value || placeholder}
      </span>
      <Pencil className={`h-3 w-3 shrink-0 ${attention ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`} />
    </button>
  );
}
