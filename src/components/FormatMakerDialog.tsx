import { useEffect, useMemo, useState } from "react";
import { X, Copy, Check, Upload, Loader2, Wand2, Search } from "lucide-react";

/**
 * Parses raw pasted flight text (or OCR'd image text) into canonical legs:
 *   { dd, mon, org, dst, dep, arr }
 */
type Leg = { dd: string; mon: string; org: string; dst: string; dep: string; arr: string };

function parseLegs(input: string): Leg[] {
  if (!input) return [];
  const text = input
    .replace(/\u00A0/g, " ")
    .replace(/[➜→⇒⟶►▶]/g, " ")
    .toUpperCase();

  const MONTHS = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];
  const MONTH_BY_NUM = ["", "JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];
  const legs: Leg[] = [];
  const pad = (t: string) => {
    const clean = t.replace(":", "").trim();
    return clean.length <= 4 ? clean.padStart(4, "0") : clean;
  };
  const seen = new Set<string>();
  const pushLeg = (dd: string, mon: string, org: string, dst: string, dep: string, arr: string) => {
    if (MONTHS.includes(org) || MONTHS.includes(dst)) return;
    const key = `${dd}${mon}${org}${dst}${dep}${arr}`;
    if (seen.has(key)) return;
    seen.add(key);
    legs.push({
      dd: dd ? String(parseInt(dd, 10)) : "",
      mon, org, dst,
      dep: pad(dep), arr: pad(arr),
    });
  };

  // ---- Table-style detection (route header + date rows with time ranges) ----
  // e.g. "MUX-MCT-JED" as header, rows like "02-08-2026  04:00 - 05:45"
  const routeHeaderMatch = text.match(/\b([A-Z]{3})[-\s]+([A-Z]{3})(?:[-\s]+([A-Z]{3}))?(?:[-\s]+([A-Z]{3}))?\b/);
  const routeSegments: Array<[string, string]> = [];
  if (routeHeaderMatch) {
    const codes = routeHeaderMatch.slice(1).filter(Boolean) as string[];
    if (codes.length >= 2 && codes.every((c) => !MONTHS.includes(c))) {
      for (let i = 0; i < codes.length - 1; i++) routeSegments.push([codes[i], codes[i + 1]]);
    }
  }

  if (routeSegments.length >= 2) {
    const lines = text.split(/\r?\n/);
    let currentDate: { dd: string; mon: string } | null = null;
    const dateNumRe = /\b(\d{1,2})[-\/](\d{1,2})(?:[-\/](\d{2,4}))?\b/;
    const dateMonRe = /\b(\d{1,2})\s*([A-Z]{3})\b/;
    const timeRangeRe = /(\d{1,2}:?\d{2})\s*[-–—]\s*(\d{1,2}:?\d{2})/g;
    const buckets: Array<{ dd: string; mon: string; times: Array<[string, string]> }> = [];
    for (const raw of lines) {
      const line = raw.trim();
      if (!line) continue;
      let m = line.match(dateNumRe);
      if (m) {
        const mm = parseInt(m[2], 10);
        if (mm >= 1 && mm <= 12) currentDate = { dd: m[1], mon: MONTH_BY_NUM[mm] };
      } else if ((m = line.match(dateMonRe)) && MONTHS.includes(m[2])) {
        currentDate = { dd: m[1], mon: m[2] };
      }
      timeRangeRe.lastIndex = 0;
      const times: Array<[string, string]> = [];
      let tm: RegExpExecArray | null;
      while ((tm = timeRangeRe.exec(line)) !== null) times.push([tm[1], tm[2]]);
      if (times.length && currentDate) {
        const last = buckets[buckets.length - 1];
        if (last && last.dd === currentDate.dd && last.mon === currentDate.mon) {
          last.times.push(...times);
        } else {
          buckets.push({ dd: currentDate.dd, mon: currentDate.mon, times: [...times] });
        }
      }
    }
    if (buckets.length) {
      for (const b of buckets) {
        for (let i = 0; i < b.times.length && i < routeSegments.length; i++) {
          const [org, dst] = routeSegments[i];
          const [dep, arr] = b.times[i];
          pushLeg(b.dd, b.mon, org, dst, dep, arr);
        }
      }
      if (legs.length) return legs;
    }
  }

  // ---- Generic inline parser ----
  const dateRe = /\b(\d{1,2})\s*([A-Z]{3})\b/g;
  const dateHits: { idx: number; dd: string; mon: string }[] = [];
  let dm: RegExpExecArray | null;
  while ((dm = dateRe.exec(text)) !== null) {
    if (MONTHS.includes(dm[2])) dateHits.push({ idx: dm.index, dd: dm[1], mon: dm[2] });
  }

  const legRe =
    /(?:\b([A-Z]{2}[0-9]?|[A-Z0-9]{2,3}[- ]?\d{2,4})\s+)?\b([A-Z]{3})\b[^A-Z0-9\n]{0,6}\b([A-Z]{3})\b[^0-9\n]{0,10}(\d{1,2}:?\d{2})[^0-9\n]{0,10}(\d{1,2}:?\d{2})/g;

  const blocks: { dd: string; mon: string; start: number; end: number }[] = [];
  if (dateHits.length) {
    for (let i = 0; i < dateHits.length; i++) {
      blocks.push({
        dd: dateHits[i].dd, mon: dateHits[i].mon,
        start: dateHits[i].idx,
        end: i + 1 < dateHits.length ? dateHits[i + 1].idx : text.length,
      });
    }
  } else {
    blocks.push({ dd: "", mon: "", start: 0, end: text.length });
  }

  for (const b of blocks) {
    // Strip the leading date token (e.g. "02 AUG") so it can't be mis-parsed
    // as an origin airport code by the leg regex.
    let chunk = text.slice(b.start, b.end);
    if (b.dd && b.mon) {
      chunk = chunk.replace(new RegExp(`\\b${b.dd}\\s*${b.mon}\\b`), "   ");
    }
    legRe.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = legRe.exec(chunk)) !== null) {
      const [, , org, dst, dep, arr] = m;
      pushLeg(b.dd, b.mon, org, dst, dep, arr);
    }
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
    const datePart = l.dd && l.mon ? `${l.dd} ${l.mon} ` : "";
    lines.push(`${datePart}${l.org} ${l.dst} ${l.dep} ${l.arr}`);
  }

  lines.push("");
  if (baggage) {
    const parts = baggage.split("+");
    let formattedBaggage = baggage.trim();
    if (parts.length === 2) {
      const p0 = parts[0].trim();
      const p1 = parts[1].replace(/KG/i, "").trim();
      // If it looks like "7+25 KG", swap it to "25+7 KG"
      // We assume the smaller number is cabin baggage and the larger is checked.
      // Or we just swap them if the user specifically asked for "25+7" style.
      // Usually users want Checked + Cabin.
      const n0 = parseInt(p0, 10);
      const n1 = parseInt(p1, 10);
      if (!isNaN(n0) && !isNaN(n1)) {
        if (n0 < n1) {
          formattedBaggage = `${n1}+${n0} KG`;
        } else {
          formattedBaggage = `${n0}+${n1} KG`;
        }
      }
    }
    lines.push(`Baggage: ${formattedBaggage}`);
  }

  if (meal) {
    lines.push(`Meal Included: ${meal}`);
  }

  return lines.join("\n").trim();
}

const AIRLINE_KEYWORDS: Record<string, string> = {
  FLYNAS: "FLYNAS", FLYADEAL: "FLYADEAL", SAUDIA: "SAUDIA", "SAUDI ARABIAN": "SAUDIA",
  EMIRATES: "EMIRATES", FLYDUBAI: "FLYDUBAI", "AIR ARABIA": "AIRARABIA", AIRARABIA: "AIRARABIA",
  AIRBLUE: "AIRBLUE", "AIR BLUE": "AIRBLUE", AIRSIAL: "AIRSIAL", "AIR SIAL": "AIRSIAL",
  PIA: "PIA", "PAKISTAN INTERNATIONAL": "PIA", SERENEAIR: "SERENE AIR", SERENE: "SERENE AIR",
  QATAR: "QATAR AIRWAYS", ETIHAD: "ETIHAD", "GULF AIR": "GULF AIR", GULFAIR: "GULF AIR",
  "OMAN AIR": "OMAN AIR", OMANAIR: "OMAN AIR", SALAMAIR: "SALAM AIR", "SALAM AIR": "SALAM AIR",
  "KUWAIT AIRWAYS": "KUWAIT AIRWAYS", JAZEERA: "JAZEERA AIRWAYS", TURKISH: "TURKISH AIRLINES",
  PEGASUS: "PEGASUS",
  FLYJINNAH: "FLY JINNAH", "FLY JINNAH": "FLY JINNAH",
};

// IATA airline codes → display name
const AIRLINE_BY_IATA: Record<string, string> = {
  XY: "FLYNAS", F3: "FLYADEAL", SV: "SAUDIA", EK: "EMIRATES", FZ: "FLYDUBAI",
  G9: "AIRARABIA", PA: "AIRBLUE", PF: "AIRSIAL", PK: "PIA", ER: "SERENE AIR",
  QR: "QATAR AIRWAYS", EY: "ETIHAD", GF: "GULF AIR", WY: "OMAN AIR", OV: "SALAM AIR",
  KU: "KUWAIT AIRWAYS", J9: "JAZEERA AIRWAYS", TK: "TURKISH AIRLINES", PC: "PEGASUS",
  IX: "AIR INDIA EXPRESS", AI: "AIR INDIA", "6E": "INDIGO", "9P": "FLY JINNAH",
};

function detectAirline(text: string, managedAirlines: any[] = []): string {
  const up = text.toUpperCase();
  
  // 1. Try IATA codes first (more specific)
  // Look for IATA codes in the managed list
  for (const ma of managedAirlines) {
    if (ma.iata_code) {
      const codeRe = new RegExp(`\\b${ma.iata_code.toUpperCase()}\\b`);
      if (codeRe.test(up)) return ma.name;
    }
  }

  // Look for hardcoded IATA codes
  for (const code of Object.keys(AIRLINE_BY_IATA)) {
    const re = new RegExp(`\\b${code}\\b`);
    if (re.test(up)) return AIRLINE_BY_IATA[code];
  }

  // 2. Try Full Names
  // Look for managed names
  for (const ma of managedAirlines) {
    if (up.includes(ma.name.toUpperCase())) return ma.name;
  }

  // Look for hardcoded keywords
  for (const key of Object.keys(AIRLINE_KEYWORDS)) {
    if (up.includes(key)) return AIRLINE_KEYWORDS[key];
  }

  return "";
}

function detectBaggage(text: string): string {
  const up = text.toUpperCase().replace(/\s+/g, " ");
  // "20KG + 5KG", "20 KG + 5 KG"
  let m = up.match(/(\d{1,2})\s*KGS?\s*\+\s*(\d{1,2})\s*KGS?/);
  if (m) {
    const n1 = parseInt(m[1], 10);
    const n2 = parseInt(m[2], 10);
    return n1 < n2 ? `${n2}+${n1} KG` : `${n1}+${n2} KG`;
  }
  m = up.match(/(\d{1,2})\s*\+\s*(\d{1,2})\s*KGS?/);
  if (m) {
    const n1 = parseInt(m[1], 10);
    const n2 = parseInt(m[2], 10);
    return n1 < n2 ? `${n2}+${n1} KG` : `${n1}+${n2} KG`;
  }
  m = up.match(/BAG(?:GAGE)?[^0-9]{0,10}(\d{1,2})\s*\+\s*(\d{1,2})/);
  if (m) {
    const n1 = parseInt(m[1], 10);
    const n2 = parseInt(m[2], 10);
    return n1 < n2 ? `${n2}+${n1} KG` : `${n1}+${n2} KG`;
  }
  // "BAG 20 KG" / "20 KG"
  m = up.match(/BAG(?:GAGE)?[^0-9]{0,10}(\d{1,2})\s*KGS?/) || up.match(/(\d{1,2})\s*KGS?\b/);
  if (m) return `${m[1]} KG`;
  return "";
}

function detectMeal(text: string): "YES" | "NO" | "" {
  const up = text.toUpperCase();
  if (/NO\s*MEAL|WITHOUT\s*MEAL|MEAL[^A-Z]{0,10}(NOT|NO)\b/.test(up)) return "NO";
  if (/MEAL[^A-Z]{0,10}(INCLUDED|YES|AVAILABLE)/.test(up) || /\bWITH\s*MEAL\b/.test(up) || /\bMEAL\b/.test(up)) return "YES";
  return "";
}

function detectSeats(text: string): string {
  const up = text.toUpperCase();
  const m =
    up.match(/(\d{1,2})\s*(?:OUT\s*OF|\/)\s*(\d{1,2})/) ||
    up.match(/SEATS?[^0-9]{0,15}(\d{1,2})\b/);
  if (!m) return "";
  if (m[2]) return `${m[1]} out of ${m[2]}`;
  return m[1];
}

export function FormatMakerDialog({ open, onClose, airlines = [], luggage = [] }: { open: boolean; onClose: () => void; airlines?: any[]; luggage?: any[] }) {
  const [airlineSearch, setAirlineSearch] = useState("");
  const [showAirlineDropdown, setShowAirlineDropdown] = useState(false);
  const [raw, setRaw] = useState("");
  const [airline, setAirline] = useState("");
  const [baggage, setBaggage] = useState("");
  const [meal, setMeal] = useState<"YES" | "NO" | "">("");
  const [seats, setSeats] = useState("");
  const [ocrBusy, setOcrBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  // Auto-clear all fields whenever the dialog is (re)opened
  useEffect(() => {
    if (open) {
      setRaw("");
      setAirline("");
      setBaggage("");
      setMeal("");
      setSeats("");
      setAirlineSearch("");
      setCopied(false);
    }
  }, [open]);

  // Auto-fill fields from raw text (pasted or OCR'd)
  useEffect(() => {
    if (!raw) return;
    const a = detectAirline(raw, airlines);
    const b = detectBaggage(raw);
    const m = detectMeal(raw);
    if (a) {
      setAirline(a);
      setAirlineSearch(a);
    }
    if (b) setBaggage(b);
    if (m) setMeal(m);
  }, [raw, airlines]);

  const legs = useMemo(() => parseLegs(raw), [raw]);
  const autoOutput = useMemo(
    () => buildOutput({ legs, airline, baggage, meal, seats: "" }),
    [legs, airline, baggage, meal],
  );
  const output = autoOutput;

  // Reset forced output whenever inputs change
  function generate() {
    // Re-run detectors and overwrite empty fields
    const a = detectAirline(raw, airlines);
    const b = detectBaggage(raw);
    const m = detectMeal(raw);
    const s = detectSeats(raw);
    if (a && !airline) setAirline(a);
    if (b && !baggage) setBaggage(b);
    if (m && !meal) setMeal(m);
    if (s && !seats) setSeats(s);
  }

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
      setRaw(text);
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
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4">
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
              Paste fare text (any format), paste image (Ctrl+V), or drag & drop
            </label>
            <textarea
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              onPaste={(e) => {
                const items = e.clipboardData?.items;
                if (!items) return;
                for (const it of Array.from(items)) {
                  if (it.kind === "file" && it.type.startsWith("image/")) {
                    const f = it.getAsFile();
                    if (f) {
                      e.preventDefault();
                      onImage(f);
                      return;
                    }
                  }
                }
              }}
              onDragOver={(e) => {
                if (e.dataTransfer?.types?.includes("Files")) e.preventDefault();
              }}
              onDrop={(e) => {
                const f = e.dataTransfer?.files?.[0];
                if (f && f.type.startsWith("image/")) {
                  e.preventDefault();
                  onImage(f);
                }
              }}
              rows={5}
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
                onClick={() => {
                  setRaw("");
                  setAirline("");
                  setAirlineSearch("");
                  setBaggage("");
                  setMeal("");
                  setSeats("");
                  
                }}
                className="rounded-md border border-input bg-background px-3 py-1.5 text-xs font-semibold hover:bg-secondary"
              >
                Clear
              </button>
            </div>
          </div>


          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="relative">
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Airline</label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2.5">
                  <Search className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
                <input
                  type="text"
                  placeholder="Type to search..."
                  value={airlineSearch}
                  onFocus={() => setShowAirlineDropdown(true)}
                  onChange={(e) => {
                    setAirlineSearch(e.target.value);
                    setShowAirlineDropdown(true);
                  }}
                  className="w-full rounded-md border border-input bg-background pl-8 pr-2 py-1.5 text-sm focus:border-gold focus:ring-1 focus:ring-gold"
                />
              </div>
              
              {showAirlineDropdown && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowAirlineDropdown(false)} />
                  <div className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-md border border-border bg-popover py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                    {airlines
                      .filter(a => 
                        a.name.toLowerCase().includes(airlineSearch.toLowerCase()) || 
                        (a.iata_code && a.iata_code.toLowerCase().includes(airlineSearch.toLowerCase()))
                      )
                      .length > 0 ? (
                      airlines
                        .filter(a => 
                          a.name.toLowerCase().includes(airlineSearch.toLowerCase()) || 
                          (a.iata_code && a.iata_code.toLowerCase().includes(airlineSearch.toLowerCase()))
                        )
                        .map((a: any) => (
                          <div
                            key={a.id}
                            className={`flex cursor-pointer items-center justify-between px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground ${airline === a.name ? 'bg-accent/50' : ''}`}
                            onClick={() => {
                              setAirline(a.name);
                              setAirlineSearch(a.name);
                              setShowAirlineDropdown(false);
                            }}
                          >
                            <span className="font-medium">{a.name}</span>
                            {a.iata_code && <span className="ml-2 text-[10px] font-bold text-muted-foreground uppercase bg-secondary px-1 rounded">{a.iata_code}</span>}
                          </div>
                        ))
                    ) : (
                      <div className="px-3 py-2 text-xs text-muted-foreground">No airlines found</div>
                    )}
                  </div>
                </>
              )}
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Baggage</label>
              <select
                value={baggage}
                onChange={(e) => setBaggage(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
              >
                <option value="">— select baggage —</option>
                {luggage.map((l: any) => (
                  <option key={l.id} value={l.label}>{l.label}</option>
                ))}
              </select>
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
            <div className="hidden">
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Seats Available (optional)</label>
              <input
                value={seats}
                onChange={(e) => setSeats(e.target.value)}
                placeholder="9 out of 10"
                className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
              />
            </div>
          </div>

          <div className="flex-1 overflow-hidden rounded-xl border border-gray-300 bg-white shadow-inner admin-hd-table">
            <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50/80 px-4 py-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-navy">WhatsApp Preview (HD)</span>
              {output && (
                <button
                  onClick={copyOut}
                  className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-[10px] font-black uppercase tracking-widest transition-all ${
                    copied ? "bg-emerald-100 text-emerald-700" : "bg-[#25D366] text-white hover:brightness-95 shadow-sm"
                  }`}
                >
                  {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  {copied ? "Copied" : "Copy Output"}
                </button>
              )}
            </div>
            <div className="max-h-[300px] overflow-y-auto p-4">
              {output ? (
                <pre className="whitespace-pre-wrap font-sans text-[13px] font-bold leading-relaxed text-gray-800 tracking-tight">
                  {output}
                </pre>
              ) : (
                <div className="flex h-32 flex-col items-center justify-center text-center">
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground opacity-40 italic">
                    Output will appear here...
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
