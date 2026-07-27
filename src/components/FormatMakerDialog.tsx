import { useEffect, useMemo, useState } from "react";
import { X, Copy, Check, Upload, Loader2, Wand2 } from "lucide-react";

/**
 * Parses raw pasted flight text (or OCR'd image text) into canonical legs:
 *   { dd, mon, org, dst, dep, arr }
 */
type Leg = { dd: string; mon: string; org: string; dst: string; dep: string; arr: string };

function parseLegs(input: string): Leg[] {
  if (!input) return [];
  const text = input.replace(/\u00A0/g, " ").toUpperCase();
  const re =
    /(?:([A-Z0-9]{2,3})\s+)?(\d{1,2})\s*([A-Z]{3})\s+([A-Z]{3})\s*[-\/ ]\s*([A-Z]{3})\s+(\d{3,4})\s+(\d{3,4})/g;
  const legs: Leg[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const [, , dd, mon, org, dst, dep, arr] = m;
    const pad = (t: string) => t.padStart(4, "0");
    legs.push({ dd: String(parseInt(dd, 10)), mon, org, dst, dep: pad(dep), arr: pad(arr) });
  }
  return legs;
}

// Destination-country flag
const FLAG_BY_CODE: Record<string, string> = {
  JED: "🇸🇦", RUH: "🇸🇦", MED: "🇸🇦", DMM: "🇸🇦", AHB: "🇸🇦", ELQ: "🇸🇦", YNB: "🇸🇦",
  DXB: "🇦🇪", AUH: "🇦🇪", SHJ: "🇦🇪", DWC: "🇦🇪",
  DOH: "🇶🇦",
  KWI: "🇰🇼",
  BAH: "🇧🇭",
  MCT: "🇴🇲", SLL: "🇴🇲",
  IST: "🇹🇷", SAW: "🇹🇷",
  KHI: "🇵🇰", LHE: "🇵🇰", ISB: "🇵🇰", MUX: "🇵🇰", PEW: "🇵🇰", UET: "🇵🇰", LYP: "🇵🇰", SKT: "🇵🇰",
};

const CITY_BY_CODE: Record<string, string> = {
  KHI: "KARACHI", LHE: "LAHORE", ISB: "ISLAMABAD", MUX: "MULTAN", PEW: "PESHAWAR",
  UET: "QUETTA", LYP: "FAISALABAD", SKT: "SIALKOT",
  JED: "JEDDAH", MED: "MADINAH", RUH: "RIYADH", DMM: "DAMMAM", AHB: "ABHA", ELQ: "QASSIM", YNB: "YANBU",
  DXB: "DUBAI", AUH: "ABU DHABI", SHJ: "SHARJAH", DWC: "DUBAI",
  DOH: "DOHA", KWI: "KUWAIT", BAH: "BAHRAIN",
  MCT: "MUSCAT", SLL: "SALALAH",
  IST: "ISTANBUL", SAW: "ISTANBUL",
};

function cityName(code: string): string {
  return CITY_BY_CODE[code?.toUpperCase()] ?? code?.toUpperCase() ?? "";
}

function buildOutput(opts: {
  legs: Leg[];
  airline: string;
  baggage: string;
  meal: string;
  seats: string;
}): string {
  const { legs, airline, baggage, meal, seats } = opts;
  if (!legs.length && !airline && !baggage && !meal && !seats) return "";

  const first = legs[0];
  const last = legs[legs.length - 1];
  const flag = first ? (FLAG_BY_CODE[last.dst] ?? "✈️") : "✈️";
  const origin = first ? cityName(first.org) : "";
  const dest = first ? cityName(last.dst) : "";

  const lines: string[] = [];
  if (origin && dest) lines.push(`${flag} *${origin} → ${dest}*`);
  lines.push("");
  if (airline) {
    lines.push(airline.toUpperCase());
    lines.push("");
  }
  for (const l of legs) {
    lines.push(`${l.dd} ${l.mon} ${l.org} ${l.dst} ${l.dep} ${l.arr}`);
  }
  if (legs.length) lines.push("");
  if (baggage) lines.push(`Baggage: ${baggage.trim()}`);
  if (meal) lines.push(`Meal Included: ${meal.trim().toUpperCase()}`);
  if (seats) lines.push(`NO. OF SEATS AVAILABLE: ${seats.trim()}`);
  lines.push("");
  lines.push("*ROHI INTERNATIONAL TRAVELS*");
  lines.push("wa.me/+923056622988");

  return lines.join("\n");
}

export function FormatMakerDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [raw, setRaw] = useState("");
  const [airline, setAirline] = useState("");
  const [baggage, setBaggage] = useState("");
  const [meal, setMeal] = useState<"YES" | "NO" | "">("");
  const [seats, setSeats] = useState("");
  const [ocrBusy, setOcrBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const legs = useMemo(() => parseLegs(raw), [raw]);
  const output = useMemo(
    () => buildOutput({ legs, airline, baggage, meal, seats }),
    [legs, airline, baggage, meal, seats],
  );

  async function onImage(file: File) {
    setOcrBusy(true);
    try {
      const w = window as any;
      if (!w.Tesseract) {
        await new Promise<void>((resolve, reject) => {
          const s = document.createElement("script");
          s.src = "https://unpkg.com/tesseract.js@5/dist/tesseract.min.js";
          s.onload = () => resolve();
          s.onerror = () => reject(new Error("Failed to load OCR engine"));
          document.head.appendChild(s);
        });
      }
      const url = URL.createObjectURL(file);
      const res = await w.Tesseract.recognize(url, "eng");
      URL.revokeObjectURL(url);
      const text: string = res?.data?.text ?? "";
      setRaw((prev) => (prev ? prev + "\n" + text : text));
    } catch (e: any) {
      alert("OCR failed: " + (e?.message ?? "unknown error"));
    } finally {
      setOcrBusy(false);
    }
  }

  async function copyOut() {
    if (!output) return;
    await navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-xl bg-card shadow-2xl ring-1 ring-border"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 flex items-center justify-between border-b border-border bg-navy px-4 py-3 text-navy-foreground">
          <div className="flex items-center gap-2">
            <Wand2 className="h-4 w-4 text-gold" />
            <h3 className="text-sm font-bold uppercase tracking-wider">Fare Format Maker</h3>
          </div>
          <button onClick={onClose} className="rounded p-1 hover:bg-white/10">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3 p-4">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Paste fare text (any format) or upload image
            </label>
            <textarea
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              rows={5}
              placeholder={"XY 04AUG LHE-RUH 0300 0600\nXY 04AUG RUH-JED 0800 1000"}
              className="w-full rounded-md border border-input bg-background p-2 font-mono text-sm outline-none focus:border-gold focus:ring-2 focus:ring-gold/30"
            />
            <div className="mt-2 flex items-center gap-2">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-input bg-background px-3 py-1.5 text-xs font-semibold hover:bg-secondary">
                {ocrBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                {ocrBusy ? "Reading image…" : "Upload image (OCR)"}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) onImage(f);
                    e.currentTarget.value = "";
                  }}
                />
              </label>
              <button
                onClick={() => setRaw("")}
                className="rounded-md border border-input bg-background px-3 py-1.5 text-xs font-semibold hover:bg-secondary"
              >
                Clear
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Airline</label>
              <input
                value={airline}
                onChange={(e) => setAirline(e.target.value)}
                placeholder="FLYNAS"
                className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Baggage</label>
              <input
                value={baggage}
                onChange={(e) => setBaggage(e.target.value)}
                placeholder="20+05 KG"
                className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Meal Included</label>
              <select
                value={meal}
                onChange={(e) => setMeal(e.target.value as any)}
                className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
              >
                <option value="">— select —</option>
                <option value="YES">YES</option>
                <option value="NO">NO</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Seats Available (optional)</label>
              <input
                value={seats}
                onChange={(e) => setSeats(e.target.value)}
                placeholder="9 out of 10"
                className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Formatted output
            </label>
            <pre className="min-h-[120px] whitespace-pre-wrap rounded-md border border-dashed border-gold bg-gold/5 p-3 font-mono text-sm text-navy">
              {output || <span className="text-muted-foreground">Waiting for input…</span>}
            </pre>
            <button
              onClick={copyOut}
              disabled={!output}
              className="mt-2 inline-flex items-center gap-2 rounded-md bg-navy px-3 py-1.5 text-xs font-bold text-navy-foreground hover:opacity-90 disabled:opacity-50"
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copied" : "Copy formatted"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
