import { useState } from "react";
import { X, Copy, Check, Upload, Loader2, Wand2 } from "lucide-react";

/**
 * Parses raw pasted flight text (or OCR'd image text) into the canonical
 * per-leg format used across Rohi shares:
 *
 *   29 JUL LHE RUH 0355 0610
 *   (29 JUL RUH ISB 0800 0900)   ← second/third legs wrapped in parens on new lines
 *
 * Accepts messy inputs like:
 *   XY 27JUL LHE-RUH 0355 0610
 *   G9  29 JUL  LHE / RUH   0355   0610
 *   FLY 04AUG KHI-MCT 0640 0730  04AUG MCT-JED 1330 1600
 */
function parseLegs(input: string): string[] {
  if (!input) return [];
  const text = input.replace(/\u00A0/g, " ").toUpperCase();
  // Global regex — supports many legs concatenated on one line.
  const re =
    /(?:([A-Z0-9]{2,3})\s+)?(\d{1,2})\s*([A-Z]{3})\s+([A-Z]{3})\s*[-\/ ]\s*([A-Z]{3})\s+(\d{3,4})\s+(\d{3,4})/g;
  const legs: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const [, , dd, mon, org, dst, dep, arr] = m;
    const pad = (t: string) => t.padStart(4, "0");
    legs.push(`${parseInt(dd, 10)} ${mon} ${org} ${dst} ${pad(dep)} ${pad(arr)}`);
  }
  return legs;
}

function formatLegs(legs: string[]): string {
  if (!legs.length) return "";
  const [first, ...rest] = legs;
  return [first, ...rest.map((l) => `(${l})`)].join("\n");
}

export function FormatMakerDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [raw, setRaw] = useState("");
  const [ocrBusy, setOcrBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const output = formatLegs(parseLegs(raw));

  async function onImage(file: File) {
    setOcrBusy(true);
    try {
      // Load tesseract.js on demand from CDN — no build-time dependency.
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
        className="w-full max-w-2xl overflow-hidden rounded-xl bg-card shadow-2xl ring-1 ring-border"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border bg-navy px-4 py-3 text-navy-foreground">
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
              rows={6}
              placeholder={"XY 27JUL LHE-RUH 0355 0610\nXY 29JUL LHE-RUH 0355 0610"}
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

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Formatted output
            </label>
            <pre className="min-h-[80px] whitespace-pre-wrap rounded-md border border-dashed border-gold bg-gold/5 p-3 font-mono text-sm text-navy">
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
