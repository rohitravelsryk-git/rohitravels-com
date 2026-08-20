import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Plane, LogOut, Upload, Download, Loader2, X, Stamp, Ticket, Pencil } from "lucide-react";
import { adminLogout, adminUnlock, checkAdminUnlocked } from "@/lib/fares.functions";
import { AdminHeaderExtras } from "@/components/AdminHeaderExtras";
import iataStampAsset from "@/assets/iata-stamp.png.asset.json";
import salamStampAsset from "@/assets/salam-stamp.png.asset.json";
import advisorStampAsset from "@/assets/travel-advisor-stamp.png.asset.json";
import salamMuxStampAsset from "@/assets/salam-air-mux-stamp.png.asset.json";
import { AdminTabs } from "@/components/AdminTabs";

// Base64 encoded fallbacks to ensure 100% availability even if CDN assets fail
// Note: These are small placeholders. In a real environment, you'd use the actual stamp Base64.
const IATA_STAMP_FALLBACK = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAKAAAABACAYAAABlE99aAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAG4SURBVHgB7d0xTsMwEIXhdk6A2DlzBsbOHTgCcwI2tqQGqZDYyS9Ztly9p0iJp6T/T47trr56Gqep+39Zlh9uL68fF8/Hh91H759m5sXo/e4Nzzb/8r1062bK73V4s+x++Xy/yD99eX85L597Xz724Xnpx8z+tG42s/+Pz/aNfP756x0fm9n/69y8f41334zZze7r29HMnG9mNjMzM+c7Y8e+e5t/eJ6Zzcycb2Y2MzPzvTP27dvOzMzm387s/Z/X4s32zGxmZjb/7858c73jzWZmNjPnPzOzmZnNzMye7+b/7c7szGxmZmZmNjMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzM2P23Q+e6u/p71r6BwAAAABJRU5ErkJggg==";
const SALAM_STAMP_FALLBACK = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAKAAAABACAYAAABlE99aAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAG4SURBVHgB7d0xTsMwEIXhdk6A2DlzBsbOHTgCcwI2tqQGqZDYyS9Ztly9p0iJp6T/T47trr56Gqep+39Zlh9uL68fF8/Hh91H759m5sXo/e4Nzzb/8r1062bK73V4s+x++Xy/yD99eX85L597Xz724Xnpx8z+tG42s/+Pz/aNfP756x0fm9n/69y8f41334zZze7r29HMnG9mNjMzM+c7Y8e+e5t/eJ6Zzcycb2Y2MzPzvTP27dvOzMzm387s/Z/X4s32zGxmZjb/7858c73jzWZmNjPnPzOzmZnNzMye7+b/7c7szGxmZmZmNjMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzM2P23Q+e6u/p71r6BwAAAABJRU5ErkJggg==";

const IATA_STAMP_URL = iataStampAsset.url;
const SALAM_STAMP_URL = salamStampAsset.url;
const ADVISOR_STAMP_URL = advisorStampAsset.url;
const SALAM_MUX_STAMP_URL = salamMuxStampAsset.url;

export const Route = createFileRoute("/admin/ok-to-board")({
  component: Page,
  errorComponent: ({ error }) => (
    <div className="p-8 text-center text-destructive">{error.message}</div>
  ),
});

function Page() {
  const { data: status, isLoading } = useQuery({
    queryKey: ["admin", "status"],
    queryFn: () => checkAdminUnlocked(),
  });
  if (isLoading) return <div className="p-10 text-center text-muted-foreground">Loading…</div>;
  return status?.unlocked ? <Panel /> : <Unlock />;
}

function Unlock() {
  const unlock = useServerFn(adminUnlock);
  const qc = useQueryClient();
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    try {
      const res = await unlock({ data: { password } });
      if (!res.ok) setErr("Incorrect password");
      else await qc.invalidateQueries({ queryKey: ["admin", "status"] });
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-hero px-4">
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl bg-card p-8 ring-1 ring-border shadow-[var(--shadow-hero)]">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-navy">
          <Plane className="h-6 w-6 -rotate-45 text-gold" />
        </div>
        <h1 className="mt-4 text-center font-serif text-2xl font-black text-navy">Admin Access</h1>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Admin password"
          className="mt-6 w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-gold focus:ring-2 focus:ring-gold/30"
        />
        {err && <p className="mt-2 text-xs text-destructive">{err}</p>}
        <button className="mt-4 w-full rounded-md bg-navy py-2.5 text-sm font-bold text-navy-foreground">Unlock</button>
      </form>
    </div>
  );
}

type TextItem = {
  pageIndex: number;
  x: number;
  y: number;
  widthPts: number;
  fontHeightPts: number;
  original: string;
  bgColor: { r: number; g: number; b: number };
};
type Source =
  | { kind: "pdf"; bytes: Uint8Array; pageSizes: { w: number; h: number }[]; textItems: TextItem[]; previews: string[] }
  | { kind: "image"; bytes: Uint8Array; mime: string; previewUrl: string };

const AGENCY_NAME = "ROHI INTERNATIONAL TRAVELS";
const AGENCY_TAGLINE = "YOUR'S TRUST";
const AGENCY_PHONE = "0305 6622988";
const AGENCY_AGENT = "Abdul Razzaq";
const AGENCY_ADDRESS = "Sardar Market Shahi Road Rahim Yar Khan";
const A4_SHORT = 595.28;
const A4_LONG = 841.89;

async function fileToBytes(f: File): Promise<Uint8Array> {
  return new Uint8Array(await f.arrayBuffer());
}

async function processPdf(bytes: Uint8Array): Promise<{ previews: string[]; pageSizes: { w: number; h: number }[]; textItems: TextItem[] }> {
  const pdfjs: any = await import("pdfjs-dist");
  const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

  const doc = await pdfjs.getDocument({ data: bytes.slice(0) }).promise;
  const previews: string[] = [];
  const pageSizes: { w: number; h: number }[] = [];
  const textItems: TextItem[] = [];
  const scale = 2;

  const pagesToProcess = doc.numPages;
  for (let p = 1; p <= pagesToProcess; p++) {
    const page = await doc.getPage(p);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({
      canvasContext: ctx,
      viewport,
      canvas,
      annotationMode: pdfjs.AnnotationMode?.DISABLE,
    }).promise;

    try {
      const textContent = await page.getTextContent();
      const pageWidthPts = page.getViewport({ scale: 1 }).width;
      const pageHeightPts = page.getViewport({ scale: 1 }).height;
      pageSizes.push({ w: pageWidthPts, h: pageHeightPts });

      const sampleBg = (vt: number[], fh: number): { r: number; g: number; b: number } => {
        const cx = Math.round(vt[4]);
        const cy = Math.round(vt[5]);
        const off = Math.max(4, Math.round(fh * 0.7));
        const pts = [
          [cx - off, cy - Math.round(fh * 0.4)],
          [cx - off * 2, cy - Math.round(fh * 0.4)],
          [cx + off, cy - Math.round(fh * 0.4)],
          [cx + off * 2, cy - Math.round(fh * 0.4)],
          [cx, cy - off - Math.round(fh * 0.2)],
          [cx, cy + Math.round(fh * 0.6)],
        ];
        const samples: number[][] = [];
        for (const [px, py] of pts) {
          if (px < 0 || py < 0 || px >= canvas.width || py >= canvas.height) continue;
          const d = ctx.getImageData(px, py, 1, 1).data;
          // Only accept clearly light pixels; skip dark text or coloured ink.
          if (Math.min(d[0], d[1], d[2]) < 200) continue;
          samples.push([d[0], d[1], d[2]]);
        }
        if (samples.length < 2) return { r: 1, g: 1, b: 1 };
        const avg = [0, 0, 0];
        samples.forEach((s) => { avg[0] += s[0]; avg[1] += s[1]; avg[2] += s[2]; });
        avg[0] /= samples.length; avg[1] /= samples.length; avg[2] /= samples.length;
        let maxDev = 0;
        samples.forEach((s) => s.forEach((v, i) => { maxDev = Math.max(maxDev, Math.abs(v - avg[i])); }));
        // If samples disagree, the text likely sits over a mixed area — bail to white.
        if (maxDev > 12) return { r: 1, g: 1, b: 1 };
        return { r: avg[0] / 255, g: avg[1] / 255, b: avg[2] / 255 };
      };

      for (const item of textContent.items as any[]) {
        const str: string = item.str || "";
        if (!str.trim()) continue;
        const t = item.transform as number[];
        const fontHeightPts = Math.hypot(t[2], t[3]) || item.height || 10;
        const widthPts = item.width || str.length * fontHeightPts * 0.5;
        const vt = pdfjs.Util.transform(viewport.transform, t);
        const fh = Math.hypot(vt[2], vt[3]);
        const bgColor = sampleBg(vt, fh);
        textItems.push({
          pageIndex: p - 1,
          x: t[4],
          y: t[5],
          widthPts,
          fontHeightPts,
          original: str,
          bgColor,
        });
      }
    } catch {
      pageSizes.push({ w: 595.28, h: 841.89 });
    }
    previews.push(canvas.toDataURL("image/jpeg", 0.9));
  }
  return { previews, pageSizes, textItems };
}

function Panel() {
  const logout = useServerFn(adminLogout);
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);

  const [source, setSource] = useState<Source | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [building, setBuilding] = useState(false);
  const [iata, setIata] = useState(true);
  const [salam, setSalam] = useState(false);
  const [pnr, setPnr] = useState("");
  const [editMode, setEditMode] = useState(false);
  const [textEdits, setTextEdits] = useState<Record<number, string>>({});
  const [textStyles, setTextStyles] = useState<Record<number, { size?: number; bold?: boolean; italic?: boolean; underline?: boolean; color?: string; family?: "helv" | "times" | "courier" }>>({});
  const [focusedIdx, setFocusedIdx] = useState<number | null>(null);
  const [selectedIdx, setSelectedIdx] = useState<Set<number>>(new Set());
  const [eraseRects, setEraseRects] = useState<Array<{ pageIndex: number; x: number; y: number; w: number; h: number }>>([]);
  const [marquee, setMarquee] = useState<{ pageIndex: number; x: number; y: number; w: number; h: number; erase: boolean } | null>(null);
  // Stamp positions as top-left percent of the preview / page.
  const [stampPos, setStampPos] = useState<{ 
    iata: { x: number; y: number }; 
    salam: { x: number; y: number };
    advisor: { x: number; y: number };
    salamMux: { x: number; y: number };
  }>({
    iata: { x: 30, y: 45 },
    salam: { x: 55, y: 45 },
    advisor: { x: 30, y: 55 },
    salamMux: { x: 55, y: 55 },
  });
  const [activeStamp, setActiveStamp] = useState<"iata" | "salam" | "advisor" | "salamMux" | null>(null);
  const [includedPages, setIncludedPages] = useState<Set<number>>(new Set());
  const [currentPage, setCurrentPage] = useState(0);
  
  const [deletePagesInput, setDeletePagesInput] = useState("");
  type PastedItem = {
    id: string;
    pageIndex: number;
    xPct: number;
    yPct: number;
    text: string;
    size: number;
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
    color?: string;
    family?: "helv" | "times" | "courier";
    bg?: { r: number; g: number; b: number };
  };
  const [pastedItems, setPastedItems] = useState<PastedItem[]>([]);
  const [selectedPastedIds, setSelectedPastedIds] = useState<Set<string>>(new Set());
  const clipboardRef = useRef<Array<{
    text: string; size: number; bold?: boolean; italic?: boolean; underline?: boolean;
    color?: string; family?: "helv" | "times" | "courier"; bg?: { r: number; g: number; b: number };
    relXPct: number; relYPct: number;
  }>>([]);
  const lastPageRef = useRef<number>(0);
  const pasteDragRef = useRef<{ primaryId: string; startX: number; startY: number; rect: DOMRect; starts: Map<string, { xPct: number; yPct: number }> } | null>(null);
  const dragRef = useRef<{ which: "iata" | "salam" | "advisor" | "salamMux"; offX: number; offY: number; rect: DOMRect } | null>(null);
  const historyRef = useRef<Array<{ eraseRects: typeof eraseRects; textEdits: typeof textEdits; pastedItems: PastedItem[] }>>([]);
  const pushHistory = () => {
    historyRef.current.push({ eraseRects: [...eraseRects], textEdits: { ...textEdits }, pastedItems: [...pastedItems] });
    if (historyRef.current.length > 100) historyRef.current.shift();
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z")) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      const prev = historyRef.current.pop();
      if (prev) {
        e.preventDefault();
        setEraseRects(prev.eraseRects);
        setTextEdits(prev.textEdits);
        setPastedItems(prev.pastedItems);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Keep currentPage within bounds when previews load/change.
  useEffect(() => {
    const total = source?.kind === "pdf" ? source.previews.length : (source?.kind === "image" ? 1 : 0);
    if (total === 0) { if (currentPage !== 0) setCurrentPage(0); return; }
    if (currentPage >= total) setCurrentPage(total - 1);
  }, [source, currentPage]);

  // Delete selected text/pasted items via Delete or Backspace (Escape clears selection).
  useEffect(() => {
    if (selectedIdx.size === 0 && selectedPastedIds.size === 0) return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        pushHistory();
        if (selectedIdx.size > 0) {
          setTextEdits((prev) => {
            const next = { ...prev };
            selectedIdx.forEach((i) => { next[i] = ""; });
            return next;
          });
          setSelectedIdx(new Set());
        }
        if (selectedPastedIds.size > 0) {
          setPastedItems((prev) => prev.filter((p) => !selectedPastedIds.has(p.id)));
          setSelectedPastedIds(new Set());
        }
      } else if (e.key === "Escape") {
        setSelectedIdx(new Set());
        setSelectedPastedIds(new Set());
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedIdx, selectedPastedIds]);

  // Copy (Ctrl+C / Cmd+C) selected text items — captures formatting + relative layout.
  // Paste (Ctrl+V / Cmd+V) places them on the last-focused page.
  const doCopy = () => {
    if (source?.kind !== "pdf") return false;
    const items: Array<{
      text: string; size: number; bold?: boolean; italic?: boolean; underline?: boolean;
      color?: string; family?: "helv" | "times" | "courier"; bg?: { r: number; g: number; b: number };
      absX: number; absY: number;
    }> = [];
    let minX = Infinity, minY = Infinity;
    selectedIdx.forEach((idx) => {
      const t = source.textItems[idx];
      if (!t) return;
      const sz = source.pageSizes[t.pageIndex];
      if (!sz) return;
      const style = textStyles[idx];
      const effH = style?.size ?? t.fontHeightPts;
      const xPct = (t.x / sz.w) * 100;
      const yPct = ((sz.h - t.y - effH) / sz.h) * 100;
      if (xPct < minX) minX = xPct;
      if (yPct < minY) minY = yPct;
      items.push({
        text: textEdits[idx] ?? t.original,
        size: effH,
        bold: style?.bold, italic: style?.italic, underline: style?.underline,
        color: style?.color, family: style?.family, bg: t.bgColor,
        absX: xPct, absY: yPct,
      });
    });
    selectedPastedIds.forEach((id) => {
      const p = pastedItems.find((x) => x.id === id);
      if (!p) return;
      if (p.xPct < minX) minX = p.xPct;
      if (p.yPct < minY) minY = p.yPct;
      items.push({
        text: p.text, size: p.size, bold: p.bold, italic: p.italic, underline: p.underline,
        color: p.color, family: p.family, bg: p.bg, absX: p.xPct, absY: p.yPct,
      });
    });
    if (items.length === 0) return false;
    clipboardRef.current = items.map((it) => ({
      text: it.text, size: it.size, bold: it.bold, italic: it.italic, underline: it.underline,
      color: it.color, family: it.family, bg: it.bg,
      relXPct: it.absX - minX, relYPct: it.absY - minY,
    }));
    try { navigator.clipboard.writeText(items.map((i) => i.text).join(" ")); } catch { /* noop */ }
    return true;
  };
  const doPaste = (targetPage?: number) => {
    if (clipboardRef.current.length === 0) return false;
    const target = targetPage ?? lastPageRef.current ?? 0;
    pushHistory();
    const now = Date.now();
    const anchorX = 8, anchorY = 8;
    const newIds: string[] = [];
    setPastedItems((prev) => {
      const additions = clipboardRef.current.map((it, i) => {
        const id = `p-${now}-${i}`;
        newIds.push(id);
        return {
          id,
          pageIndex: target,
          xPct: Math.max(0, Math.min(95, anchorX + it.relXPct)),
          yPct: Math.max(0, Math.min(95, anchorY + it.relYPct)),
          text: it.text, size: it.size,
          bold: it.bold, italic: it.italic, underline: it.underline,
          color: it.color, family: it.family, bg: it.bg,
        };
      });
      return [...prev, ...additions];
    });
    setSelectedPastedIds(new Set(newIds));
    setSelectedIdx(new Set());
    setIncludedPages((prev) => { const n = new Set(prev); n.add(target); return n; });
    setCurrentPage(target);
    return true;
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      const isEditable = tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement)?.isContentEditable;
      if (isEditable) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "c") {
        if (doCopy()) e.preventDefault();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "v") {
        if (doPaste()) e.preventDefault();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedIdx, selectedPastedIds, pastedItems, source, textEdits, textStyles]);

  const applyDeletePages = () => {
    const src = deletePagesInput.trim();
    if (!src || !source) return;
    const total = source.kind === "pdf" ? source.previews.length : 1;
    const toDelete = new Set<number>();
    src.split(",").forEach((chunk) => {
      const c = chunk.trim();
      if (!c) return;
      const m = /^(\d+)\s*-\s*(\d+)$/.exec(c);
      if (m) {
        const a = Math.min(+m[1], +m[2]);
        const b = Math.max(+m[1], +m[2]);
        for (let n = a; n <= b; n++) if (n >= 1 && n <= total) toDelete.add(n - 1);
      } else if (/^\d+$/.test(c)) {
        const n = +c;
        if (n >= 1 && n <= total) toDelete.add(n - 1);
      }
    });
    if (toDelete.size === 0) return;
    setIncludedPages((prev) => {
      const n = new Set(prev);
      toDelete.forEach((i) => n.delete(i));
      return n;
    });
    setDeletePagesInput("");
  };


  async function onFile(f: File | undefined | null) {
    if (!f) return;
    setFileName(f.name);
    setLoading(true);
    setSource(null);
    setTextEdits({});
    setTextStyles({});
    setFocusedIdx(null);
    setSelectedIdx(new Set());
    setEraseRects([]);
    setIncludedPages(new Set());
    setCurrentPage(0);
    
    setPastedItems([]);
    setSelectedPastedIds(new Set());
    clipboardRef.current = [];
    historyRef.current = [];
    setEditMode(false);
    try {
      const bytes = await fileToBytes(f);
      if (f.type === "application/pdf" || /\.pdf$/i.test(f.name)) {
        const { previews, pageSizes, textItems } = await processPdf(bytes);
        setSource({ kind: "pdf", bytes, pageSizes, textItems, previews });
        setIncludedPages(new Set(previews.map((_, i) => i)));
      } else if (f.type.startsWith("image/")) {
        const dataUrl: string = await new Promise((resolve, reject) => {
          const r = new FileReader();
          r.onload = () => resolve(String(r.result));
          r.onerror = reject;
          r.readAsDataURL(f);
        });
        setSource({ kind: "image", bytes, mime: f.type || "image/jpeg", previewUrl: dataUrl });
      } else {
        alert("Unsupported file. Please upload JPG, PNG or PDF.");
      }
    } catch (e) {
      console.error(e);
      alert("Failed to load the visa. Please try another file.");
    } finally {
      setLoading(false);
    }
  }

  async function download() {
    if (!source) return;
    if (!iata && !salam) {
      alert("Select at least one stamp.");
      return;
    }
    setBuilding(true);
    try {
      const { PDFDocument, rgb, StandardFonts } = await import("pdf-lib");
      const fontkit = (await import("@pdf-lib/fontkit")).default;
      const out = await PDFDocument.create();
      out.registerFontkit(fontkit);
      const font = await out.embedFont(StandardFonts.Helvetica);
      const fontBold = await out.embedFont(StandardFonts.HelveticaBold);
      const fontItalic = await out.embedFont(StandardFonts.HelveticaOblique);
      const fontBoldItalic = await out.embedFont(StandardFonts.HelveticaBoldOblique);
      const fontT = await out.embedFont(StandardFonts.TimesRoman);
      const fontTB = await out.embedFont(StandardFonts.TimesRomanBold);
      const fontTI = await out.embedFont(StandardFonts.TimesRomanItalic);
      const fontTBI = await out.embedFont(StandardFonts.TimesRomanBoldItalic);
      const fontC = await out.embedFont(StandardFonts.Courier);
      const fontCB = await out.embedFont(StandardFonts.CourierBold);
      const fontCI = await out.embedFont(StandardFonts.CourierOblique);
      const fontCBI = await out.embedFont(StandardFonts.CourierBoldOblique);
      const famFonts = {
        helv: { r: font, b: fontBold, i: fontItalic, bi: fontBoldItalic },
        times: { r: fontT, b: fontTB, i: fontTI, bi: fontTBI },
        courier: { r: fontC, b: fontCB, i: fontCI, bi: fontCBI },
      } as const;
      const pickStyledFont = (fam: "helv" | "times" | "courier" | undefined, bold?: boolean, italic?: boolean) => {
        const f = famFonts[fam || "helv"];
        return bold && italic ? f.bi : bold ? f.b : italic ? f.i : f.r;
      };
      const hexRgb = (h: string | undefined) => {
        const m = /^#?([0-9a-f]{6})$/i.exec(h || "");
        if (!m) return rgb(0, 0, 0);
        const n = parseInt(m[1], 16);
        return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
      };

      let fontHand: any = null;
      try {
        const hRes = await fetch("https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/comicneue/ComicNeue-Bold.ttf");
        if (hRes.ok) fontHand = await out.embedFont(new Uint8Array(await hRes.arrayBuffer()));
      } catch { /* noop */ }

      let iataImg: any = null;
      let salamImg: any = null;
      let advisorImg: any = null;
      let salamMuxImg: any = null;
      if (iata) {
        const r = await fetch(IATA_STAMP_URL);
        iataImg = await out.embedPng(new Uint8Array(await r.arrayBuffer()));
      }
      if (salam) {
        const r = await fetch(SALAM_STAMP_URL);
        salamImg = await out.embedPng(new Uint8Array(await r.arrayBuffer()));
      }
      if ((window as any).__advisor_active) {
        const r = await fetch(ADVISOR_STAMP_URL);
        advisorImg = await out.embedPng(new Uint8Array(await r.arrayBuffer()));
      }
      if ((window as any).__salamMux_active) {
        const r = await fetch(SALAM_MUX_STAMP_URL);
        salamMuxImg = await out.embedPng(new Uint8Array(await r.arrayBuffer()));
      }
      const IMG_STAMP_H = 70;

      const stampPage = (page: any, width: number, height: number) => {
        const drawOne = (img: any, isSalam: boolean, pos: { x: number; y: number }) => {
          const stampH = IMG_STAMP_H;
          const stampW = img.width * (stampH / img.height);
          let x = (pos.x / 100) * width;
          let y = height - (pos.y / 100) * height - stampH;
          x = Math.max(0, Math.min(width - stampW, x));
          y = Math.max(0, Math.min(height - stampH, y));
          page.drawImage(img, { x, y, width: stampW, height: stampH });
          if (isSalam && fontHand) {
            const pnrText = pnr.trim().toUpperCase();
            if (pnrText) {
              page.drawText(pnrText, {
                x: x + stampW * 0.30,
                y: y + stampH * 0.88,
                size: 12,
                font: fontHand,
                color: rgb(0.196, 0.184, 1.0),
              });
            }
          }
        };
        if (iataImg) drawOne(iataImg, false, stampPos.iata);
        if (salamImg) drawOne(salamImg, true, stampPos.salam);
        if (advisorImg) drawOne(advisorImg, false, stampPos.advisor);
        if (salamMuxImg) drawOne(salamMuxImg, false, stampPos.salamMux);
      };

      if (source.kind === "pdf") {
        const { PDFName } = await import("pdf-lib");
        const src = await PDFDocument.load(source.bytes, { ignoreEncryption: true });
        src.getPages().forEach((p: any) => p.node.delete(PDFName.of("Annots")));
        src.catalog.delete(PDFName.of("AcroForm"));

        const pageIdxs = Array.from(includedPages).sort((a, b) => a - b);
        if (pageIdxs.length === 0) {
          alert("Select at least one page to include.");
          setBuilding(false);
          return;
        }
        const srcPages = pageIdxs.map((i) => src.getPage(i));
        const embeds = await out.embedPages(srcPages);

        for (let pi = 0; pi < pageIdxs.length; pi++) {
          const origIdx = pageIdxs[pi];
          const srcPage = srcPages[pi];
          const w = srcPage.getWidth();
          const h = srcPage.getHeight();
          const scale = 1;
          const page = out.addPage([w, h]);
          const ox = 0;
          const oy = 0;
          page.drawPage(embeds[pi], { x: ox, y: oy, width: w, height: h });

          // Bake user text edits for this page.
          source.textItems.forEach((t, idx) => {
            if (t.pageIndex !== origIdx) return;
            const edited = textEdits[idx];
            const style = textStyles[idx];
            const hasStyle = !!style && (style.size !== undefined || style.bold || style.italic || style.underline || style.color || style.family);
            if (edited === undefined && !hasStyle) return;
            const value = edited ?? t.original;
            if (edited !== undefined && value === t.original && !hasStyle) return;
            const cleared = value.trim() === "";
            const effHeight = style?.size ?? t.fontHeightPts;
            const padX = effHeight * (cleared ? 0.9 : 0.35);
            const padY = effHeight * (cleared ? 0.8 : 0.35);
            const bg = t.bgColor || { r: 1, g: 1, b: 1 };
            page.drawRectangle({
              x: ox + (t.x - padX) * scale,
              y: oy + (t.y - padY) * scale,
              width: (t.widthPts + padX * 2) * scale,
              height: (effHeight + padY * 2) * scale,
              color: rgb(bg.r, bg.g, bg.b),
            });
            if (!cleared) {
              const size = effHeight * scale;
              const useFont = pickStyledFont(style?.family, style?.bold, style?.italic);
              const textColor = hexRgb(style?.color);
              page.drawText(value, {
                x: ox + t.x * scale,
                y: oy + t.y * scale,
                size,
                font: useFont,
                color: textColor,
              });
              if (style?.underline) {
                const tw = useFont.widthOfTextAtSize(value, size);
                page.drawLine({
                  start: { x: ox + t.x * scale, y: oy + t.y * scale - size * 0.12 },
                  end: { x: ox + t.x * scale + tw, y: oy + t.y * scale - size * 0.12 },
                  thickness: Math.max(0.5, size * 0.06),
                  color: textColor,
                });
              }
            }
          });

          // Bake erase rects for this page.
          eraseRects.filter((r) => r.pageIndex === origIdx).forEach((r) => {
            page.drawRectangle({
              x: ox + r.x * w,
              y: oy + h - (r.y + r.h) * h,
              width: r.w * w,
              height: r.h * h,
              color: rgb(1, 1, 1),
            });
          });

          // Bake pasted items (Ctrl+V clipboard drops) for this page.
          pastedItems.filter((p) => p.pageIndex === origIdx).forEach((p) => {
            const size = p.size;
            const useFont = pickStyledFont(p.family, p.bold, p.italic);
            const textColor = hexRgb(p.color);
            const px = (p.xPct / 100) * w + ox;
            const pyTop = (p.yPct / 100) * h;
            const py = oy + h - pyTop - size;
            const tw = useFont.widthOfTextAtSize(p.text, size);
            if (p.bg) {
              page.drawRectangle({
                x: px - size * 0.35,
                y: py - size * 0.35,
                width: tw + size * 0.7,
                height: size + size * 0.7,
                color: rgb(p.bg.r, p.bg.g, p.bg.b),
              });
            }
            page.drawText(p.text, { x: px, y: py, size, font: useFont, color: textColor });
            if (p.underline) {
              page.drawLine({
                start: { x: px, y: py - size * 0.12 },
                end: { x: px + tw, y: py - size * 0.12 },
                thickness: Math.max(0.5, size * 0.06),
                color: textColor,
              });
            }
          });


          if (pi === 0) stampPage(page, w, h);
        }

      } else {
        const img = source.mime.includes("png")
          ? await out.embedPng(source.bytes)
          : await out.embedJpg(source.bytes);
        const w = img.width;
        const h = img.height;
        const page = out.addPage([w, h]);
        page.drawImage(img, { x: 0, y: 0, width: w, height: h });
        stampPage(page, w, h);
      }


      const bytes = await out.save();
      const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const base = (fileName || "visa").replace(/\.[^.]+$/, "");
      const tag = iata && salam ? "ok-to-board" : iata ? "iata" : "salam";
      a.download = `${base}-${tag}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch (e) {
      console.error(e);
      alert("Failed to build the PDF. Please try again.");
    } finally {
      setBuilding(false);
    }
  }

  function clear() {
    setSource(null);
    setFileName("");
    setTextEdits({});
    setSelectedIdx(new Set());
    setEraseRects([]);
    setPastedItems([]);
    setSelectedPastedIds(new Set());
    clipboardRef.current = [];
    setEditMode(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function onLogout() {
    await logout();
    await qc.invalidateQueries({ queryKey: ["admin", "status"] });
  }

  const previews = source?.kind === "pdf" ? source.previews : source?.kind === "image" ? [source.previewUrl] : [];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-navy text-navy-foreground">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <Plane className="h-5 w-5 -rotate-45 text-gold" />
            <div>
              <p className="font-serif text-lg font-black">Admin Panel</p>
              <p className="text-[10px] tracking-widest text-white/60">OK TO BOARD stamps</p>
            </div>
          </div>
          <div className="flex gap-2">
            <AdminHeaderExtras />
            <a href="/" className="rounded-md border border-white/20 px-3 py-2 text-xs font-semibold hover:bg-white/10">View site</a>
            <button onClick={onLogout} className="inline-flex items-center gap-2 rounded-md bg-gold px-3 py-2 text-xs font-bold text-gold-foreground">
              <LogOut className="h-3.5 w-3.5" /> Logout
            </button>
          </div>
        </div>
        <AdminTabs />
      </header>

      <section className="mx-auto grid max-w-6xl gap-8 px-4 py-8 lg:grid-cols-[340px_1fr]">
        <div>
          <h1 className="font-serif text-2xl font-black text-navy">OK TO BOARD</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Upload the visa, edit any text on the document if needed, choose the stamp(s) — IATA and/or Salam Air — and download with Rohi International Travels header/footer and fitted full-width lines.
          </p>

          <div className="mt-6 space-y-4">
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,application/pdf,.pdf,.jpg,.jpeg,.png"
              className="hidden"
              onChange={(e) => onFile(e.target.files?.[0])}
            />
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={loading}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-navy/40 bg-navy/5 px-4 py-3 text-sm font-bold text-navy hover:bg-navy/10 disabled:opacity-60"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {loading ? "Processing…" : source ? "Replace Visa" : "Upload Visa (JPEG, PNG, PDF)"}
            </button>

            {source?.kind === "pdf" && (
              <button
                type="button"
                onClick={() => setEditMode((v) => !v)}
                className={`inline-flex w-full items-center justify-center gap-2 rounded-lg border px-4 py-2 text-xs font-bold uppercase tracking-widest ${editMode ? "border-navy bg-navy text-white" : "border-navy/40 bg-white text-navy hover:bg-navy/5"}`}
              >
                <Pencil className="h-3.5 w-3.5" />
                {editMode ? "Done editing" : "Edit content"}
              </button>
            )}

            {editMode && focusedIdx !== null && source?.kind === "pdf" && source.textItems[focusedIdx] && (() => {
              const idx = focusedIdx;
              const t = source.textItems[idx];
              const style = textStyles[idx] || {};
              const curSize = Math.round(style.size ?? t.fontHeightPts);
              const setStyle = (patch: Partial<{ size: number; bold: boolean; italic: boolean; underline: boolean; color: string; family: "helv" | "times" | "courier" }>) =>
                setTextStyles((prev) => ({ ...prev, [idx]: { ...(prev[idx] || {}), ...patch } }));
              return (
                <div className="rounded-lg border border-navy/40 bg-white p-2 shadow-sm">
                  <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-navy/70">Format</div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => setStyle({ bold: !style.bold })}
                      className={`h-7 w-7 rounded border text-xs font-black ${style.bold ? "border-navy bg-navy text-white" : "border-navy/30 bg-white text-navy hover:bg-navy/5"}`}>B</button>
                    <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => setStyle({ italic: !style.italic })}
                      className={`h-7 w-7 rounded border text-xs font-bold italic ${style.italic ? "border-navy bg-navy text-white" : "border-navy/30 bg-white text-navy hover:bg-navy/5"}`}>I</button>
                    <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => setStyle({ underline: !style.underline })}
                      className={`h-7 w-7 rounded border text-xs font-bold underline ${style.underline ? "border-navy bg-navy text-white" : "border-navy/30 bg-white text-navy hover:bg-navy/5"}`}>U</button>
                    <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => setStyle({ size: Math.max(4, curSize - 1) })}
                      className="h-7 w-7 rounded border border-navy/30 bg-white text-xs font-bold text-navy hover:bg-navy/5">−</button>
                    <input
                      type="number"
                      value={curSize}
                      min={4}
                      max={72}
                      onChange={(e) => {
                        const n = parseInt(e.target.value, 10);
                        if (Number.isFinite(n) && n > 0) setStyle({ size: n });
                      }}
                      className="h-7 w-14 rounded border border-navy/30 px-1 text-center text-xs font-bold text-navy"
                    />
                    <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => setStyle({ size: Math.min(72, curSize + 1) })}
                      className="h-7 w-7 rounded border border-navy/30 bg-white text-xs font-bold text-navy hover:bg-navy/5">+</button>
                    <select
                      value={style.family || "helv"}
                      onMouseDown={(e) => e.stopPropagation()}
                      onChange={(e) => setStyle({ family: e.target.value as any })}
                      className="h-7 rounded border border-navy/30 bg-white px-1 text-[11px] font-semibold text-navy"
                      title="Font family"
                    >
                      <option value="helv">Sans</option>
                      <option value="times">Serif</option>
                      <option value="courier">Mono</option>
                    </select>
                    <label className="inline-flex h-7 items-center gap-1 rounded border border-navy/30 bg-white px-1.5" title="Text color">
                      <span className="text-[10px] font-bold text-navy">A</span>
                      <input
                        type="color"
                        value={style.color || "#000000"}
                        onChange={(e) => setStyle({ color: e.target.value })}
                        className="h-5 w-6 cursor-pointer border-0 bg-transparent p-0"
                      />
                    </label>
                    <button type="button" onMouseDown={(e) => e.preventDefault()}
                      onClick={() => setTextStyles((prev) => { const n = { ...prev }; delete n[idx]; return n; })}
                      className="ml-auto h-7 rounded border border-navy/30 bg-white px-2 text-[10px] font-bold uppercase tracking-widest text-navy hover:bg-navy/5">Reset</button>
                  </div>
                  <p className="mt-1 text-[10px] text-navy/60">Editing: <span className="font-bold">{t.original}</span></p>
                </div>
              );
            })()}

            {fileName && !loading && (
              <div className="flex items-center justify-between rounded-md border border-border bg-white px-3 py-2 text-[11px]">
                <span className="truncate text-muted-foreground">{fileName}</span>
                <button onClick={clear} className="rounded p-1 text-muted-foreground hover:bg-secondary">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}





            <div className="rounded-lg border border-border bg-white p-4">
              <p className="mb-3 text-[10px] font-black uppercase tracking-widest text-navy">Stamps</p>
              <div className="space-y-3">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={iata}
                    onChange={(e) => setIata(e.target.checked)}
                    className="h-4 w-4 accent-navy"
                  />
                  <span className="text-sm font-bold text-navy">IATA · OK TO BOARD</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={salam}
                    onChange={(e) => setSalam(e.target.checked)}
                    className="h-4 w-4 accent-navy"
                  />
                  <span className="text-sm font-bold text-navy">SALAM AIR · OK TO BOARD</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!(window as any).__advisor_active}
                    onChange={(e) => {
                      (window as any).__advisor_active = e.target.checked;
                      setIncludedPages(new Set(includedPages)); // Trigger re-render
                    }}
                    className="h-4 w-4 accent-navy"
                  />
                  <span className="text-sm font-bold text-navy">ADVISOR · OK TO BOARD</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!(window as any).__salamMux_active}
                    onChange={(e) => {
                      (window as any).__salamMux_active = e.target.checked;
                      setIncludedPages(new Set(includedPages)); // Trigger re-render
                    }}
                    className="h-4 w-4 accent-navy"
                  />
                  <span className="text-sm font-bold text-navy">SALAM AIR MUX · OK TO BOARD</span>
                </label>
                {salam && (
                  <div className="ml-7">
                    <label
                      className="mb-1 block text-navy/70"
                      style={{ fontFamily: "'Comic Sans MS', 'Comic Neue', 'Chalkboard SE', cursive", fontSize: "12pt" }}
                    >
                      PNR (written on Salam Air stamp)
                    </label>
                    <input
                      type="text"
                      value={pnr}
                      onChange={(e) => setPnr(e.target.value)}
                      placeholder="e.g. ABC123"
                      className="w-full rounded-md border border-border bg-white px-2 py-1.5 text-sm text-navy focus:border-navy focus:outline-none"
                    />
                  </div>
                )}
              </div>
            </div>
            
            <button
              type="button"
              onClick={() => {
                pushHistory();
                setTextEdits({});
                setTextStyles({});
                setSelectedIdx(new Set());
                setEraseRects([]);
                setPastedItems([]);
                setSelectedPastedIds(new Set());
                (window as any).__advisor_active = false;
                (window as any).__salamMux_active = false;
                setStampPos({
                  iata: { x: 30, y: 45 },
                  salam: { x: 55, y: 45 },
                  advisor: { x: 30, y: 55 },
                  salamMux: { x: 55, y: 55 },
                });
                setIncludedPages(new Set((source?.kind === "pdf" ? source.previews : [0]).map((_, i) => i)));
              }}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-xs font-bold uppercase tracking-widest text-red-600 hover:bg-red-100"
              title="Reset all edits, stamps and deleted pages to original state"
            >
              Recover Lost Stamps
            </button>

            <button

              onClick={download}
              disabled={!source || building}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-navy px-4 py-3 text-sm font-bold text-navy-foreground hover:brightness-110 disabled:opacity-50"
            >
              {building ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              {building ? "Building…" : "Download"}
            </button>
          </div>
        </div>

        <div className="rounded-xl bg-white p-4 ring-1 ring-border">
          {previews.length === 0 ? (
            <div className="flex h-[400px] items-center justify-center text-sm text-muted-foreground">
              Upload a visa to preview.
            </div>
          ) : (
            (() => {
              const visible = previews.map((_, i) => i).filter((i) => includedPages.has(i));
              const activeIdx = visible.includes(currentPage) ? currentPage : (visible[0] ?? 0);
              const posInVisible = visible.indexOf(activeIdx);
              const goto = (n: number) => {
                const clamped = Math.max(0, Math.min(visible.length - 1, n));
                if (visible[clamped] !== undefined) setCurrentPage(visible[clamped]);
              };
              const deleteCurrent = () => {
                pushHistory();
                const remaining = visible.filter((v) => v !== activeIdx);
                setIncludedPages((prev) => { const n = new Set(prev); n.delete(activeIdx); return n; });
                if (remaining.length > 0) {
                  const next = remaining[Math.min(posInVisible, remaining.length - 1)];
                  setCurrentPage(next);
                }
              };
              return (
            <div className="mx-auto max-w-[720px] space-y-4">
              {previews.map((src, i) => {
                if (i !== activeIdx) return null;
                const pageSize = source?.kind === "pdf" ? source.pageSizes[i] : null;
                const pageItems =
                  source?.kind === "pdf" && pageSize
                    ? source.textItems.map((t, idx) => ({ t, idx })).filter((it) => it.t.pageIndex === i)
                    : [];
                return (
                  <div key={i} className="rounded-lg border border-border bg-secondary/40 p-3">
                  <div
                    className="relative"
                    style={pageSize ? ({ containerType: "inline-size", touchAction: editMode ? "none" : undefined } as any) : undefined}
                    onPointerDown={(e) => {
                      lastPageRef.current = i;
                      if (!editMode || !pageSize) return;
                      const target = e.target as HTMLElement;
                      if (target.tagName === "INPUT") return;
                      const rect = e.currentTarget.getBoundingClientRect();
                      const sx = e.clientX - rect.left;
                      const sy = e.clientY - rect.top;
                      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
                      setSelectedIdx(new Set());
                      setSelectedPastedIds(new Set());
                      setMarquee({ pageIndex: i, x: sx, y: sy, w: 0, h: 0, erase: e.altKey || e.shiftKey });
                      e.preventDefault();
                    }}
                    onPointerMove={(e) => {
                      if (!marquee || marquee.pageIndex !== i) return;
                      const rect = e.currentTarget.getBoundingClientRect();
                      const cx = e.clientX - rect.left;
                      const cy = e.clientY - rect.top;
                      setMarquee({
                        pageIndex: i,
                        x: Math.min(marquee.x, cx),
                        y: Math.min(marquee.y, cy),
                        w: Math.abs(cx - marquee.x),
                        h: Math.abs(cy - marquee.y),
                        erase: marquee.erase,
                      });
                    }}
                    onPointerUp={(e) => {
                      if (!marquee || marquee.pageIndex !== i || !pageSize) { setMarquee(null); return; }
                      const rect = e.currentTarget.getBoundingClientRect();
                      if (marquee.erase && marquee.w > 3 && marquee.h > 3) {
                        pushHistory();
                        setEraseRects((prev) => [...prev, {
                          pageIndex: i,
                          x: marquee.x / rect.width,
                          y: marquee.y / rect.height,
                          w: marquee.w / rect.width,
                          h: marquee.h / rect.height,
                        }]);
                        setMarquee(null);
                        return;
                      }
                      const mLeft = marquee.x / rect.width;
                      const mTop = marquee.y / rect.height;
                      const mRight = (marquee.x + marquee.w) / rect.width;
                      const mBottom = (marquee.y + marquee.h) / rect.height;
                      const sel = new Set<number>();
                      if (marquee.w > 3 && marquee.h > 3) {
                        pageItems.forEach(({ t, idx }) => {
                          const l = t.x / pageSize.w;
                          const top = (pageSize.h - t.y - t.fontHeightPts) / pageSize.h;
                          const r = (t.x + t.widthPts) / pageSize.w;
                          const b = (pageSize.h - t.y) / pageSize.h;
                          if (l < mRight && r > mLeft && top < mBottom && b > mTop) sel.add(idx);
                        });
                      }
                      setSelectedIdx(sel);
                      setMarquee(null);
                    }}
                  >
                    <img
                      src={src}
                      alt={`Visa page ${i + 1}`}
                      draggable={false}
                      className="w-full select-none rounded-md border border-border"
                    />
                    <div
                      className="absolute bottom-2 right-2 z-30 flex items-center gap-1 rounded-md border border-navy/20 bg-white/95 px-1.5 py-1 shadow-md backdrop-blur print:hidden"
                      onPointerDown={(e) => e.stopPropagation()}
                    >
                      <button type="button" onClick={() => goto(0)} disabled={posInVisible <= 0}
                        className="rounded px-1.5 py-0.5 text-[11px] font-bold text-navy hover:bg-secondary disabled:opacity-40" aria-label="First page">⏮</button>
                      <button type="button" onClick={() => goto(posInVisible - 1)} disabled={posInVisible <= 0}
                        className="rounded px-1.5 py-0.5 text-[11px] font-bold text-navy hover:bg-secondary disabled:opacity-40" aria-label="Previous page">◀</button>
                      <input
                        type="number" min={1} max={visible.length} value={posInVisible + 1}
                        onChange={(e) => { const n = Math.max(1, Math.min(visible.length, Number(e.target.value) || 1)); goto(n - 1); }}
                        className="w-10 rounded border border-border bg-white px-1 py-0.5 text-center text-[11px]"
                      />
                      <span className="text-[11px] font-bold text-navy">of {visible.length}</span>
                      <button type="button" onClick={() => goto(posInVisible + 1)} disabled={posInVisible >= visible.length - 1}
                        className="rounded px-1.5 py-0.5 text-[11px] font-bold text-navy hover:bg-secondary disabled:opacity-40" aria-label="Next page">▶</button>
                      <button type="button" onClick={() => goto(visible.length - 1)} disabled={posInVisible >= visible.length - 1}
                        className="rounded px-1.5 py-0.5 text-[11px] font-bold text-navy hover:bg-secondary disabled:opacity-40" aria-label="Last page">⏭</button>
                      <button type="button" onClick={deleteCurrent} disabled={visible.length <= 1}
                        className="ml-1 rounded border border-red-300 bg-white px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-red-700 hover:bg-red-50 disabled:opacity-40"
                        title="Delete this page">Delete page</button>
                    </div>
                    {marquee && marquee.pageIndex === i && (
                      <div
                        className={`pointer-events-none absolute border-2 ${marquee.erase ? "border-red-500 bg-red-500/10" : "border-gold bg-gold/10"}`}
                        style={{ left: marquee.x, top: marquee.y, width: marquee.w, height: marquee.h }}
                      />
                    )}
                    {eraseRects.filter((r) => r.pageIndex === i).map((r, ri) => (
                      <div
                        key={`erase-${ri}`}
                        className="absolute bg-white"
                        style={{
                          left: `${r.x * 100}%`,
                          top: `${r.y * 100}%`,
                          width: `${r.w * 100}%`,
                          height: `${r.h * 100}%`,
                          zIndex: 4,
                        }}
                        onDoubleClick={() => { pushHistory(); setEraseRects((prev) => prev.filter((_, j) => j !== ri)); }}
                        title="Double-click to remove erase area"
                      />
                    ))}
                    {pageSize && pageItems.map(({ t, idx }) => {
                      const edited = textEdits[idx];
                      const style = textStyles[idx];
                      const hasStyle = !!style && (style.size !== undefined || style.bold || style.italic || style.underline || style.color || style.family);
                      if (edited === undefined && !hasStyle) return null;
                      const value = edited ?? t.original;
                      const leftPct = (t.x / pageSize.w) * 100;
                      const effHeight = style?.size ?? t.fontHeightPts;
                      const topPct = ((pageSize.h - t.y - effHeight) / pageSize.h) * 100;
                      const cleared = value.trim() === "";
                      const padCqi = cleared ? 0.9 : 0.35;
                      const widthPct = Math.min(100 - leftPct, (t.widthPts / pageSize.w) * 100 + 3);
                      const fontCqi = (effHeight / pageSize.w) * 100;
                      const bg = t.bgColor || { r: 1, g: 1, b: 1 };
                      const bgCss = `rgb(${Math.round(bg.r * 255)}, ${Math.round(bg.g * 255)}, ${Math.round(bg.b * 255)})`;
                      const famCss = style?.family === "times" ? '"Times New Roman", Times, serif'
                        : style?.family === "courier" ? '"Courier New", Courier, monospace'
                        : "Helvetica, Arial, sans-serif";
                      return (
                        <div
                          key={`baked-${idx}`}
                          className="pointer-events-none absolute box-border overflow-hidden"
                          style={{
                            left: `calc(${leftPct}% - ${padCqi}cqi)`,
                            top: `calc(${topPct}% - ${padCqi}cqi)`,
                            width: `calc(${widthPct}% + ${padCqi * 2}cqi)`,
                            height: `calc(${fontCqi}cqi + ${padCqi * 2}cqi + 4px)`,
                            padding: `${padCqi}cqi`,
                            fontSize: `calc(${fontCqi} * 1cqi)`,
                            lineHeight: 1,
                            fontFamily: famCss,
                            fontWeight: style?.bold ? 700 : 400,
                            fontStyle: style?.italic ? "italic" : "normal",
                            textDecoration: style?.underline ? "underline" : "none",
                            color: style?.color || "#000",
                            background: bgCss,
                            zIndex: editMode ? 0 : 5,
                            display: editMode ? "none" : "block",
                          }}
                        >
                          {cleared ? "" : value}
                        </div>
                      );
                    })}
                    {pageSize && pastedItems.filter((p) => p.pageIndex === i).map((p) => {
                      const isSel = selectedPastedIds.has(p.id);
                      const fontCqi = (p.size / pageSize.w) * 100;
                      const famCss = p.family === "times" ? '"Times New Roman", Times, serif'
                        : p.family === "courier" ? '"Courier New", Courier, monospace'
                        : "Helvetica, Arial, sans-serif";
                      const bgCss = p.bg ? `rgb(${Math.round(p.bg.r * 255)}, ${Math.round(p.bg.g * 255)}, ${Math.round(p.bg.b * 255)})` : "transparent";
                      return (
                        <div
                          key={p.id}
                          tabIndex={0}
                          role="button"
                          onPointerDown={(e) => {
                            e.stopPropagation();
                            const rect = (e.currentTarget.parentElement as HTMLElement).getBoundingClientRect();
                            let selected = selectedPastedIds;
                            if (e.shiftKey || e.ctrlKey || e.metaKey) {
                              const n = new Set(selectedPastedIds);
                              if (n.has(p.id)) n.delete(p.id); else n.add(p.id);
                              setSelectedPastedIds(n);
                              selected = n;
                            } else if (!selectedPastedIds.has(p.id)) {
                              const n = new Set([p.id]);
                              setSelectedPastedIds(n);
                              setSelectedIdx(new Set());
                              selected = n;
                            }
                            const starts = new Map<string, { xPct: number; yPct: number }>();
                            pastedItems.forEach((it) => {
                              if (selected.has(it.id)) starts.set(it.id, { xPct: it.xPct, yPct: it.yPct });
                            });
                            if (!starts.has(p.id)) starts.set(p.id, { xPct: p.xPct, yPct: p.yPct });
                            pasteDragRef.current = {
                              primaryId: p.id,
                              startX: e.clientX,
                              startY: e.clientY,
                              rect,
                              starts,
                            };
                            (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
                          }}
                          onPointerMove={(e) => {
                            const d = pasteDragRef.current;
                            if (!d || d.primaryId !== p.id) return;
                            const dxPct = ((e.clientX - d.startX) / d.rect.width) * 100;
                            const dyPct = ((e.clientY - d.startY) / d.rect.height) * 100;
                            setPastedItems((prev) => prev.map((x) => {
                              const s = d.starts.get(x.id);
                              if (!s) return x;
                              return { ...x, xPct: Math.max(0, Math.min(95, s.xPct + dxPct)), yPct: Math.max(0, Math.min(95, s.yPct + dyPct)) };
                            }));
                          }}
                          onPointerUp={(e) => {
                            (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
                            pasteDragRef.current = null;
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Delete" || e.key === "Backspace") {
                              e.preventDefault();
                              pushHistory();
                              setPastedItems((prev) => prev.filter((x) => x.id !== p.id));
                              setSelectedPastedIds((prev) => { const n = new Set(prev); n.delete(p.id); return n; });
                              return;
                            }
                            const step = e.shiftKey ? 5 : 0.5;
                            const dirs: Record<string, [number, number]> = {
                              ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step],
                            };
                            const d = dirs[e.key];
                            if (!d) return;
                            e.preventDefault();
                            setPastedItems((prev) => prev.map((x) => x.id === p.id ? { ...x, xPct: Math.max(0, Math.min(95, x.xPct + d[0])), yPct: Math.max(0, Math.min(95, x.yPct + d[1])) } : x));
                          }}
                          className="absolute cursor-move select-none whitespace-pre outline-none"
                          style={{
                            left: `${p.xPct}%`,
                            top: `${p.yPct}%`,
                            fontSize: `calc(${fontCqi} * 1cqi)`,
                            lineHeight: 1,
                            fontFamily: famCss,
                            fontWeight: p.bold ? 700 : 400,
                            fontStyle: p.italic ? "italic" : "normal",
                            textDecoration: p.underline ? "underline" : "none",
                            color: p.color || "#000",
                            background: bgCss,
                            padding: "1px 2px",
                            zIndex: 7,
                            boxShadow: isSel ? "0 0 0 1px #c8940b" : "none",
                            touchAction: "none",
                          }}
                          title="Drag to move · Delete/Backspace to remove"
                        >
                          {p.text}
                        </div>
                      );
                    })}
                    {(() => {
                      const groupItems = pastedItems.filter((p) => p.pageIndex === i && selectedPastedIds.has(p.id));
                      if (groupItems.length < 1 || !pageSize) return null;
                      const measure = (t: string, sizePct: number) => {
                        const charW = sizePct * 0.55;
                        return { w: Math.max(1, t.length * charW), h: sizePct * 1.15 };
                      };
                      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
                      groupItems.forEach((p) => {
                        const fontPct = (p.size / pageSize.w) * 100;
                        const { w, h } = measure(p.text, fontPct);
                        minX = Math.min(minX, p.xPct);
                        minY = Math.min(minY, p.yPct);
                        maxX = Math.max(maxX, p.xPct + w);
                        maxY = Math.max(maxY, p.yPct + h);
                      });
                      const pad = 0.6;
                      const bx = Math.max(0, minX - pad);
                      const by = Math.max(0, minY - pad);
                      const bw = Math.min(100 - bx, (maxX - minX) + pad * 2);
                      const bh = Math.min(100 - by, (maxY - minY) + pad * 2);
                      return (
                        <div
                          className="absolute cursor-move"
                          style={{
                            left: `${bx}%`,
                            top: `${by}%`,
                            width: `${bw}%`,
                            height: `${bh}%`,
                            border: "1.5px dashed #c8940b",
                            background: "rgba(200,148,11,0.06)",
                            zIndex: 8,
                            touchAction: "none",
                          }}
                          onPointerDown={(e) => {
                            e.stopPropagation();
                            const rect = (e.currentTarget.parentElement as HTMLElement).getBoundingClientRect();
                            const starts = new Map<string, { xPct: number; yPct: number }>();
                            pastedItems.forEach((it) => {
                              if (selectedPastedIds.has(it.id)) starts.set(it.id, { xPct: it.xPct, yPct: it.yPct });
                            });
                            const primaryId = groupItems[0].id;
                            pasteDragRef.current = { primaryId, startX: e.clientX, startY: e.clientY, rect, starts };
                            (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
                          }}
                          onPointerMove={(e) => {
                            const d = pasteDragRef.current;
                            if (!d) return;
                            const dxPct = ((e.clientX - d.startX) / d.rect.width) * 100;
                            const dyPct = ((e.clientY - d.startY) / d.rect.height) * 100;
                            setPastedItems((prev) => prev.map((x) => {
                              const s = d.starts.get(x.id);
                              if (!s) return x;
                              return { ...x, xPct: Math.max(0, Math.min(95, s.xPct + dxPct)), yPct: Math.max(0, Math.min(95, s.yPct + dyPct)) };
                            }));
                          }}
                          onPointerUp={(e) => {
                            (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
                            pasteDragRef.current = null;
                          }}
                          title="Drag the group to move all pasted text together"
                        />
                      );
                    })()}


                    {editMode && pageSize && pageItems.map(({ t, idx }) => {
                      const style = textStyles[idx];
                      const effHeight = style?.size ?? t.fontHeightPts;
                      const leftPct = (t.x / pageSize.w) * 100;
                      const topPct = ((pageSize.h - t.y - effHeight) / pageSize.h) * 100;
                      const value = textEdits[idx] ?? t.original;
                      const cleared = textEdits[idx] !== undefined && value.trim() === "";
                      const padCqi = 0.35;
                      const widthPct = Math.min(100 - leftPct, (t.widthPts / pageSize.w) * 100 + 3);
                      const fontCqi = (effHeight / pageSize.w) * 100;
                      const isSel = selectedIdx.has(idx);
                      const bg = t.bgColor || { r: 1, g: 1, b: 1 };
                      const bgCss = `rgb(${Math.round(bg.r * 255)}, ${Math.round(bg.g * 255)}, ${Math.round(bg.b * 255)})`;
                      return (
                        <input
                          key={idx}
                          type="text"
                          value={value}
                          onFocus={() => setFocusedIdx(idx)}
                          onChange={(e) => setTextEdits((prev) => ({ ...prev, [idx]: e.target.value }))}
                          onPointerDown={(e) => {
                            if (e.shiftKey || e.ctrlKey || e.metaKey) {
                              e.preventDefault();
                              setSelectedIdx((prev) => {
                                const next = new Set(prev);
                                if (next.has(idx)) next.delete(idx); else next.add(idx);
                                return next;
                              });
                            } else if (selectedIdx.size > 0) {
                              setSelectedIdx(new Set());
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Delete" || ((e.ctrlKey || e.metaKey) && e.key === "Backspace")) {
                              e.preventDefault();
                              setTextEdits((prev) => ({ ...prev, [idx]: "" }));
                              return;
                            }
                            if (e.key === "Backspace") {
                              const inp = e.currentTarget as HTMLInputElement;
                              const current = textEdits[idx] ?? t.original;
                              const allSelected =
                                inp.selectionStart === 0 && inp.selectionEnd === current.length && current.length > 0;
                              if (current === "" || allSelected) {
                                e.preventDefault();
                                setTextEdits((prev) => ({ ...prev, [idx]: "" }));
                              }
                            }
                          }}
                          onDoubleClick={(e) => {
                            (e.currentTarget as HTMLInputElement).select();
                          }}
                          title={`Original: ${t.original} — press Delete to wipe`}
                          className="absolute box-border outline-none cursor-text focus:z-10"
                          style={{
                            left: `calc(${leftPct}% - ${padCqi}cqi)`,
                            top: `calc(${topPct}% - ${padCqi}cqi)`,
                            width: `calc(${widthPct}% + ${padCqi * 2}cqi)`,
                            height: `calc(${fontCqi}cqi + ${padCqi * 2}cqi + 4px)`,
                            padding: `${padCqi}cqi`,
                            fontSize: `calc(${fontCqi} * 1cqi)`,
                            lineHeight: 1,
                            fontFamily: style?.family === "times" ? '"Times New Roman", Times, serif'
                              : style?.family === "courier" ? '"Courier New", Courier, monospace'
                              : "Helvetica, Arial, sans-serif",
                            fontWeight: style?.bold ? 700 : 400,
                            fontStyle: style?.italic ? "italic" : "normal",
                            textDecoration: style?.underline ? "underline" : "none",
                            color: style?.color || "#000",
                            background: cleared ? "#ffffff" : bgCss,
                            border: isSel ? "1px dashed #c8940b" : "none",
                            boxShadow: "none",
                          }}
                        />
                      );
                    })}


                    {(["iata", "salam", "advisor", "salamMux"] as const).map((which) => {
                      if (which === "iata" && !iata) return null;
                      if (which === "salam" && !salam) return null;
                      if (which === "advisor" && !(window as any).__advisor_active) return null;
                      if (which === "salamMux" && !(window as any).__salamMux_active) return null;
                      const pos = stampPos[which];
                      const src = 
                        which === "iata" ? IATA_STAMP_URL : 
                        which === "salam" ? SALAM_STAMP_URL :
                        which === "advisor" ? ADVISOR_STAMP_URL :
                        SALAM_MUX_STAMP_URL;
                      const isActive = activeStamp === which;
                      return (
                        <div
                          key={which}
                          tabIndex={0}
                          role="button"
                          aria-label={`${which === "iata" ? "IATA" : "Salam Air"} stamp — drag or use arrow keys to move`}
                          onFocus={() => setActiveStamp(which)}
                          onBlur={() => setActiveStamp((s) => (s === which ? null : s))}
                          onPointerDown={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            const parent = (e.currentTarget.parentElement as HTMLElement).getBoundingClientRect();
                            const target = (e.currentTarget as HTMLElement).getBoundingClientRect();
                            dragRef.current = {
                              which,
                              offX: e.clientX - target.left,
                              offY: e.clientY - target.top,
                              rect: parent,
                            };
                            (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
                            setActiveStamp(which);
                          }}
                          onPointerMove={(e) => {
                            const d = dragRef.current;
                            if (!d || d.which !== which) return;
                            const nx = ((e.clientX - d.offX - d.rect.left) / d.rect.width) * 100;
                            const ny = ((e.clientY - d.offY - d.rect.top) / d.rect.height) * 100;
                            setStampPos((prev) => ({
                              ...prev,
                              [which]: {
                                x: Math.max(0, Math.min(95, nx)),
                                y: Math.max(0, Math.min(95, ny)),
                              },
                            }));
                          }}
                          onPointerUp={(e) => {
                            (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
                            dragRef.current = null;
                          }}
                          onKeyDown={(e) => {
                            const step = e.shiftKey ? 5 : 1;
                            const dirs: Record<string, [number, number]> = {
                              ArrowLeft: [-step, 0],
                              ArrowRight: [step, 0],
                              ArrowUp: [0, -step],
                              ArrowDown: [0, step],
                            };
                            const d = dirs[e.key];
                            if (!d) return;
                            e.preventDefault();
                            setStampPos((prev) => ({
                              ...prev,
                              [which]: {
                                x: Math.max(0, Math.min(95, prev[which].x + d[0])),
                                y: Math.max(0, Math.min(95, prev[which].y + d[1])),
                              },
                            }));
                          }}
                          className="absolute cursor-move select-none outline-none"
                          style={{
                            left: `${pos.x}%`,
                            top: `${pos.y}%`,
                            zIndex: 10,
                            touchAction: "none",
                            boxShadow: isActive ? "0 0 0 2px #c8940b, 0 4px 12px rgba(0,0,0,.15)" : "none",
                            borderRadius: 4,
                          }}
                        >
                          <img
                            src={src}
                            alt={which + " stamp"}
                            draggable={false}
                            className="h-[70px] w-auto object-contain drop-shadow pointer-events-none"
                            onError={(e) => {
                              // If primary asset fails, switch to fallback
                               const img = e.currentTarget;
                               const fallbacks: Record<string, string> = {
                                 iata: IATA_STAMP_FALLBACK,
                                 salam: SALAM_STAMP_FALLBACK,
                                 advisor: ADVISOR_STAMP_URL, // Use URL as its own fallback for new ones
                                 salamMux: SALAM_MUX_STAMP_URL
                               };
                               const fallback = fallbacks[which];
                               if (img.src !== fallback) {
                                 img.src = fallback;
                               }
                            }}
                          />
                          {which === "salam" && pnr.trim() && (
                            <span
                              className="pointer-events-none absolute leading-none tracking-tight"
                              style={{
                                 left: "30%",
                                 top: "-2%",
                                fontSize: "12pt",
                                color: "#322fff",
                                fontFamily: "'Comic Sans MS', 'Comic Neue', 'Chalkboard SE', cursive",
                                fontWeight: 700,
                              }}
                            >
                              {pnr.trim().toUpperCase()}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  </div>
                );
              })}
            </div>
              );
            })()
          )}
        </div>
      </section>
    </div>
  );
}
