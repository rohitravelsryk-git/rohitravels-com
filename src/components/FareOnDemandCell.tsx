import { useState, useEffect, useRef } from "react";
import { Check, Pencil, X } from "lucide-react";

interface FareOnDemandCellProps {
  value: string;
  placeholder?: string;
  onSave: (val: string) => void;
}

export function FareOnDemandCell({ value, placeholder = "Fare", onSave }: FareOnDemandCellProps) {
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
        <button onClick={() => { onSave(temp); setEditing(false); }} className="text-emerald-600">
          <Check className="h-3 w-3" />
        </button>
      </div>
    );
  }

  return (
    <div className="group flex items-center justify-between gap-1">
      <span className={`text-[10px] font-bold ${value ? "text-navy" : "text-navy/30"}`}>
        {value || placeholder}
      </span>
      <button
        onClick={() => setEditing(true)}
        className="opacity-0 group-hover:opacity-100 text-navy/40 hover:text-navy"
      >
        <Pencil className="h-3 w-3" />
      </button>
    </div>
  );
}
