import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { checkAdminUnlocked } from "@/lib/fares.functions";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Plane, Download, Upload, X, Phone, MessageCircle, Loader2, Save, RotateCcw, Check, Pencil } from "lucide-react";
import { AdminTabs } from "@/components/AdminTabs";
import { AdminHeaderExtras } from "@/components/AdminHeaderExtras";
import { AgentSidebarNav } from "@/components/AgentSidebarNav";

import QRCode from "qrcode";
import { toPng } from "html-to-image";
import defaultLogo from "@/assets/default-logo.png";
import iataStampAsset from "@/assets/iata-stamp.png.asset.json";
import salamStampAsset from "@/assets/salam-stamp.png.asset.json";

function normalizePhoneForWa(p: string) {
  let d = (p || "").replace(/\D+/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("0")) d = "92" + d.slice(1);
  return d;
}
function waLink(p: string) {
  return `https://wa.me/${normalizePhoneForWa(p)}`;
}

export const Route = createFileRoute("/print-format")({
  head: () => ({
    meta: [
      { title: "Ticket Print Format — Rohi International Travels" },
      {
        name: "description",
        content:
          "Upload any ticket (JPG, PNG or PDF) and download a branded, editable PDF with the Rohi International Travels header and footer. Fare & taxes are auto-hidden.",
      },
      { property: "og:title", content: "Ticket Print Format — Rohi International Travels" },
      { property: "og:description", content: "Turn any ticket into a branded, agent-ready PDF in seconds. Auto-hides fare & taxes." },
      { property: "og:url", content: "https://rohitravels.lovable.app/print-format" },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "canonical", href: "https://rohitravels.lovable.app/print-format" }],
  }),
  validateSearch: (search: Record<string, unknown>) => ({
    portal: search.portal === "agent" ? ("agent" as const) : undefined,
  }),
  // Role is resolved before the page (and therefore before any navigation
  // chrome) renders, so a B2B agent never sees admin tabs — not even a flash.
  ssr: false,
  beforeLoad: async ({ search }) => {
    if (search.portal === "agent") {
      return { portalRole: "agent" as const, staffTabs: [] as string[], staffUsername: null };
    }
    const s = await checkAdminUnlocked();
    if (!s.unlocked) throw redirect({ to: "/admin" });
    return {
      portalRole: (s.staffUsername ? "staff" : "admin") as "staff" | "admin",
      staffTabs: s.staffTabs ?? [],
      staffUsername: s.staffUsername ?? null,
    };
  },
  component: PrintFormatPage,
});


// ---------- Stamp preview components ----------
function StampCorners() {
  const c = "absolute w-[10px] h-[10px] border-red-600";
  return (
    <>
      <span className={`${c} top-[3px] left-[3px] border-t-2 border-l-2`} />
      <span className={`${c} top-[3px] right-[3px] border-t-2 border-r-2`} />
      <span className={`${c} bottom-[3px] left-[3px] border-b-2 border-l-2`} />
      <span className={`${c} bottom-[3px] right-[3px] border-b-2 border-r-2`} />
    </>
  );
}
function PlaneBadge({ size = 22 }: { size?: number }) {
  return (
    <span
      className="inline-flex items-center justify-center rounded-full border-[1.5px] border-red-600 text-red-600"
      style={{ width: size, height: size }}
    >
      <Plane className="rotate-[-45deg]" style={{ width: size * 0.55, height: size * 0.55 }} fill="currentColor" strokeWidth={1} />
    </span>
  );
}
function StampSingle({ text }: { text: string }) {
  return (
    <div className="relative inline-flex items-center gap-3 border-[1.5px] border-red-600 px-5 py-2.5 text-red-600">
      <StampCorners />
      <PlaneBadge size={22} />
      <span className="text-[15px] font-black tracking-[0.12em]">{text}</span>
    </div>
  );
}
function StampGroup() {
  return (
    <div className="relative inline-flex items-center gap-3 border-[1.5px] border-red-600 px-5 py-2 text-red-600">
      <StampCorners />
      <PlaneBadge size={26} />
      <div className="leading-tight">
        <div className="text-[16px] font-black tracking-[0.12em]">GROUP TICKET</div>
        <div className="my-[3px] h-[1px] w-full bg-red-600" />
        <div className="text-[10px] font-black tracking-[0.16em]">NON REFUNDABLE</div>
        <div className="text-[10px] font-black tracking-[0.16em]">NON CHANGEABLE</div>
      </div>
    </div>
  );
}

const DEFAULT_NAME = "ROHI INTERNATIONAL TRAVELS";
const DEFAULT_TAGLINE = "Your's Trust";
const DEFAULT_ADDRESS = "Sardar Market Shahi Road Rahim Yar Khan";
const DEFAULT_PHONE = "0305 6622988";
const MAPS_URL = "https://www.google.com/maps/place/Rohi+International+Travels/@28.4225455,70.3078476,17z/data=!3m1!4b1!4m6!3m5!1s0x39375b4c6684a931:0xe2636cc3c3b64d4d!8m2!3d28.4225455!4d70.3078476!16s%2Fg%2F11gxm624dj?entry=tts";
const DEFAULT_AGENT = "Abdul Razzaq";
const DEFAULT_LOGO = defaultLogo;

// Keywords that indicate a fare/tax/amount line that must be hidden.
const REDACT_PATTERNS = [
  /fare/i,
  /tax(es)?\b/i,
  /\bsub[-\s]?total\b/i,
  /\bgrand\s*total\b/i,
  /\btotal\s*amount\s*paid\b/i,
  /\btotal\s*amount\b/i,
  /\bamount\s*paid\b/i,
  /\bamount\s*due\b/i,
  /\btotal\b/i,
  /\bamount\b/i,
  /\bpaid\b/i,
  /\bprice\b/i,
  /\bpayable\b/i,
  /\bbase\s*fare\b/i,
  /\bfuel\s*(surcharge|tax)\b/i,
  /\byq\b/i,
  /\byr\b/i,
  /\bpkr\b/i,
  /\busd\b/i,
  /\bsar\b/i,
  /\baed\b/i,
  /\beur\b/i,
  /\bgbp\b/i,
];

const AMOUNT_PATTERN = /(?:pkr|rs\.?|usd|\$|sar|aed|eur|€|gbp|£)\s*[\d,]{3,}(?:\.\d+)?|\b\d{1,3}(?:,\d{3})+(?:\.\d+)?\b/i;

function shouldRedact(text: string) {
  const t = text.trim();
  if (!t) return false;
  if (AMOUNT_PATTERN.test(t)) return true;
  return REDACT_PATTERNS.some((r) => r.test(t));
}

type Redaction = {
  pageIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
  color: { r: number; g: number; b: number };
};
type TextItem = {
  pageIndex: number;
  x: number;               // pdf-space left (points, y-up baseline)
  y: number;               // pdf-space baseline y
  widthPts: number;
  fontHeightPts: number;
  original: string;
  bgColor: { r: number; g: number; b: number };
};
type Source =
  | { kind: "pdf"; bytes: Uint8Array; redactions: Redaction[]; pageSizes: { w: number; h: number }[]; textItems: TextItem[] }
  | { kind: "image"; bytes: Uint8Array; mime: string };

async function fileToBytes(f: File): Promise<Uint8Array> {
  return new Uint8Array(await f.arrayBuffer());
}

async function dataUrlToBytes(dataUrl: string): Promise<{ bytes: Uint8Array; mime: string }> {
  const res = await fetch(dataUrl);
  const buf = await res.arrayBuffer();
  let mime = "";
  if (dataUrl.startsWith("data:")) {
    mime = dataUrl.substring(5, dataUrl.indexOf(";"));
  } else {
    mime = res.headers.get("content-type") || "";
    if (!mime) {
      const lower = dataUrl.toLowerCase().split("?")[0];
      if (lower.endsWith(".png")) mime = "image/png";
      else if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) mime = "image/jpeg";
      else mime = "image/png";
    }
  }
  return { bytes: new Uint8Array(buf), mime };
}

const PROFILE_STORAGE_KEY = "rohi.printFormat.profile.v1";

type SavedProfile = {
  agencyName: string;
  tagline: string;
  address: string;
  phone: string;
  agent: string;
  logoDataUrl: string;
};

function loadSavedProfile(): SavedProfile | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(PROFILE_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SavedProfile;
  } catch {
    return null;
  }
}

type Stamps = { nonRefundable: boolean; group: boolean; iata: boolean; salam: boolean };
const IATA_STAMP_URL = iataStampAsset.url;
const SALAM_STAMP_URL = salamStampAsset.url;

function PrintFormatPage() {
  const [previewPages, setPreviewPages] = useState<string[]>([]);
  const [source, setSource] = useState<Source | null>(null);
  const [loading, setLoading] = useState(false);
  const [building, setBuilding] = useState(false);
  const [fileName, setFileName] = useState<string>("");
  const [agencyName, setAgencyName] = useState<string>(DEFAULT_NAME);
  const [tagline, setTagline] = useState<string>(DEFAULT_TAGLINE);
  const [address, setAddress] = useState<string>(DEFAULT_ADDRESS);
  const [phone, setPhone] = useState<string>(DEFAULT_PHONE);
  const [agent, setAgent] = useState<string>(DEFAULT_AGENT);
  const [logoDataUrl, setLogoDataUrl] = useState<string>(DEFAULT_LOGO);
  const [hasSavedProfile, setHasSavedProfile] = useState<boolean>(false);
  const [savedFlash, setSavedFlash] = useState<boolean>(false);
  const [stampModalOpen, setStampModalOpen] = useState<boolean>(false);
  const [pendingStamps, setPendingStamps] = useState<Stamps>({ nonRefundable: false, group: false, iata: false, salam: false });
  const [stamps, setStamps] = useState<Stamps>({ nonRefundable: false, group: false, iata: false, salam: false });
  const [pendingPnr, setPendingPnr] = useState<string>("");
  const [pnr, setPnr] = useState<string>("");
  const [noBrand, setNoBrand] = useState<boolean>(false);
  const [editMode, setEditMode] = useState<boolean>(false);
  const [textEdits, setTextEdits] = useState<Record<number, string>>({});
  const [textStyles, setTextStyles] = useState<Record<number, { size?: number; bold?: boolean; italic?: boolean; underline?: boolean; color?: string; family?: "helv" | "times" | "courier" }>>({});
  const [focusedIdx, setFocusedIdx] = useState<number | null>(null);
  const [selectedIdx, setSelectedIdx] = useState<Set<number>>(new Set());
  const [eraseRects, setEraseRects] = useState<Array<{ pageIndex: number; x: number; y: number; w: number; h: number }>>([]);
  const [marquee, setMarquee] = useState<{ pageIndex: number; x: number; y: number; w: number; h: number; erase: boolean } | null>(null);
  const [includedPages, setIncludedPages] = useState<Set<number>>(new Set());
  const [currentPage, setCurrentPage] = useState(0);
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
  const pasteAnchorRef = useRef<{ pageIndex: number; xPct: number; yPct: number } | null>(null);
  const historyRef = useRef<Array<{ eraseRects: typeof eraseRects; textEdits: Record<number, string>; pastedItems: PastedItem[] }>>([]);
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
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const inputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const url = await QRCode.toDataURL(waLink(phone || DEFAULT_PHONE), {
          margin: 2,
          width: 1024,
          color: { dark: "#062148", light: "#ffffff" },
          errorCorrectionLevel: "H",
        });
        if (!cancelled) setQrDataUrl(url);
      } catch {
        if (!cancelled) setQrDataUrl("");
      }
    })();
    return () => { cancelled = true; };
  }, [phone]);

  useEffect(() => {
    const p = loadSavedProfile();
    if (!p) return;
    setAgencyName(p.agencyName ?? DEFAULT_NAME);
    setTagline(p.tagline ?? DEFAULT_TAGLINE);
    setAddress(p.address ?? DEFAULT_ADDRESS);
    setPhone(p.phone ?? DEFAULT_PHONE);
    setAgent(p.agent ?? DEFAULT_AGENT);
    setLogoDataUrl(p.logoDataUrl ?? DEFAULT_LOGO);
    setHasSavedProfile(true);
  }, []);

  // Keep currentPage within bounds when previews load/change.
  useEffect(() => {
    const total = previewPages.length;
    if (total === 0) { if (currentPage !== 0) setCurrentPage(0); return; }
    if (currentPage >= total) setCurrentPage(total - 1);
  }, [previewPages, currentPage]);

  // Global Delete/Backspace handler for marquee-selected text items and pasted items.
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

  // Ctrl+C / Ctrl+V — copy selected text items (preserves format+relative layout), paste to last-focused page.
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
    const anchor = pasteAnchorRef.current;
    const target = targetPage ?? anchor?.pageIndex ?? lastPageRef.current ?? 0;
    pushHistory();
    const now = Date.now();
    const anchorX = anchor && anchor.pageIndex === target ? anchor.xPct : 8;
    const anchorY = anchor && anchor.pageIndex === target ? anchor.yPct : 8;
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
      const hasSel = selectedIdx.size > 0 || selectedPastedIds.size > 0;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "a") {
        // Ctrl+A: select every text item on the active page (only when not typing inside an input)
        if (isEditable) return;
        if (source?.kind !== "pdf") return;
        const page = lastPageRef.current ?? currentPage;
        const all = new Set<number>();
        source.textItems.forEach((t, idx) => { if (t.pageIndex === page) all.add(idx); });
        const allPasted = new Set<string>();
        pastedItems.forEach((p) => { if (p.pageIndex === page) allPasted.add(p.id); });
        setSelectedIdx(all);
        setSelectedPastedIds(allPasted);
        e.preventDefault();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "c") {
        if (isEditable && !hasSel) return;
        if (doCopy()) e.preventDefault();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "v") {
        if (isEditable) return;
        if (doPaste()) e.preventDefault();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedIdx, selectedPastedIds, pastedItems, source, textEdits, textStyles, currentPage]);

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    const listener = () => void onFile(input.files?.[0]);
    input.addEventListener("input", listener);
    input.addEventListener("change", listener);
    return () => {
      input.removeEventListener("input", listener);
      input.removeEventListener("change", listener);
    };
  }, [stamps, pnr]);

  function saveProfileAsDefault() {
    const profile: SavedProfile = { agencyName, tagline, address, phone, agent, logoDataUrl };
    try {
      window.localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
      setHasSavedProfile(true);
      setSavedFlash(true);
      window.setTimeout(() => setSavedFlash(false), 1800);
    } catch {
      alert("Couldn't save profile — your browser storage may be full or blocked.");
    }
  }

  function resetSavedDefaults() {
    try {
      window.localStorage.removeItem(PROFILE_STORAGE_KEY);
    } catch {
      /* noop */
    }
    setHasSavedProfile(false);
    setAgencyName(DEFAULT_NAME);
    setTagline(DEFAULT_TAGLINE);
    setAddress(DEFAULT_ADDRESS);
    setPhone(DEFAULT_PHONE);
    setAgent(DEFAULT_AGENT);
    setLogoDataUrl(DEFAULT_LOGO);
    if (logoInputRef.current) logoInputRef.current.value = "";
  }


  async function onLogo(f: File | undefined | null) {
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      alert("Please upload an image file for the logo.");
      return;
    }
    const dataUrl: string = await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = reject;
      r.readAsDataURL(f);
    });
    setLogoDataUrl(dataUrl);
  }

  // Render PDF pages to preview JPEGs and collect redaction rects in PDF (user-space) coords.
  async function processPdf(bytes: Uint8Array): Promise<{ previews: string[]; redactions: Redaction[]; pageSizes: { w: number; h: number }[]; textItems: TextItem[] }> {
    const pdfjs: any = await import("pdfjs-dist");
    const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

    const doc = await pdfjs.getDocument({ data: bytes.slice(0) }).promise;
    const previews: string[] = [];
    const redactions: Redaction[] = [];
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
        const pdfPage = await doc.getPage(p);
        const pageWidthPts = pdfPage.getViewport({ scale: 1 }).width;
        const pageHeightPts = pdfPage.getViewport({ scale: 1 }).height;
        pageSizes.push({ w: pageWidthPts, h: pageHeightPts });

        const sampleBg = (vt: number[], fh: number): { r: number; g: number; b: number } => {
          const cx = Math.round(vt[4]);
          const cy = Math.round(vt[5]);
          const off = Math.max(4, Math.round(fh * 0.7));
          const points = [
            [cx - off, cy - Math.round(fh * 0.4)],
            [cx - off * 2, cy - Math.round(fh * 0.4)],
            [cx + off, cy - Math.round(fh * 0.4)],
            [cx + off * 2, cy - Math.round(fh * 0.4)],
            [cx, cy - off - Math.round(fh * 0.2)],
            [cx, cy + Math.round(fh * 0.6)],
          ];
          const samples: number[][] = [];
          for (const [px, py] of points) {
            if (px < 0 || py < 0 || px >= canvas.width || py >= canvas.height) continue;
            const d = ctx.getImageData(px, py, 1, 1).data;
            if (Math.min(d[0], d[1], d[2]) < 200) continue;
            samples.push([d[0], d[1], d[2]]);
          }
          if (samples.length < 2) return { r: 1, g: 1, b: 1 };
          const avg = [0, 0, 0];
          samples.forEach((s) => { avg[0] += s[0]; avg[1] += s[1]; avg[2] += s[2]; });
          avg[0] /= samples.length; avg[1] /= samples.length; avg[2] /= samples.length;
          let maxDev = 0;
          samples.forEach((s) => s.forEach((v, i) => { maxDev = Math.max(maxDev, Math.abs(v - avg[i])); }));
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

          // Collect every text item for the editor overlay.
          textItems.push({
            pageIndex: p - 1,
            x: t[4],
            y: t[5],
            widthPts,
            fontHeightPts,
            original: str,
            bgColor,
          });

          if (!shouldRedact(str)) continue;

          const padX = fontHeightPts * 0.55;
          const padY = fontHeightPts * 0.36;
          const x = Math.max(0, t[4] - padX);
          const y = Math.max(0, t[5] - padY);
          const width = Math.min(pageWidthPts - x, widthPts + padX * 2);
          const height = Math.min(pageHeightPts - y, fontHeightPts + padY * 2);
          const [canvasLeft, canvasTop] = viewport.convertToViewportPoint(x, y + height);
          redactions.push({ pageIndex: p - 1, x, y, width, height, color: bgColor });
          ctx.fillStyle = `rgb(${Math.round(bgColor.r * 255)},${Math.round(bgColor.g * 255)},${Math.round(bgColor.b * 255)})`;
          ctx.fillRect(canvasLeft, canvasTop, width * scale, height * scale);
        }
      } catch {
        pageSizes.push({ w: 595.28, h: 841.89 });
      }

      previews.push(canvas.toDataURL("image/jpeg", 0.9));
    }
    return { previews, redactions, pageSizes, textItems };
  }


  async function onFile(f: File | undefined | null) {
    if (!f) return;
    setFileName(f.name);
    setLoading(true);
    setPreviewPages([]);
    setSource(null);
    setEraseRects([]);
    setPastedItems([]);
    setSelectedPastedIds(new Set());
    clipboardRef.current = [];
    setIncludedPages(new Set());
    setCurrentPage(0);
    historyRef.current = [];
    let loaded = false;
    try {
      if (f.type === "application/pdf" || /\.pdf$/i.test(f.name)) {
        const bytes = await fileToBytes(f);
        const { previews, redactions, pageSizes, textItems } = await processPdf(bytes);
        setPreviewPages(previews);
        setSource({ kind: "pdf", bytes, redactions, pageSizes, textItems });
        setIncludedPages(new Set(previews.map((_, i) => i)));
        setTextEdits({});
        setSelectedIdx(new Set());
        setEraseRects([]);
        setEditMode(false);
        loaded = true;
      } else if (f.type.startsWith("image/")) {
        const bytes = await fileToBytes(f);
        const dataUrl: string = await new Promise((resolve, reject) => {
          const r = new FileReader();
          r.onload = () => resolve(String(r.result));
          r.onerror = reject;
          r.readAsDataURL(f);
        });
        setPreviewPages([dataUrl]);
        setSource({ kind: "image", bytes, mime: f.type || "image/jpeg" });
        setIncludedPages(new Set([0]));
        loaded = true;
      } else {
        alert("Unsupported file. Please upload JPG, PNG or PDF.");
      }
    } catch (e) {
      console.error(e);
      alert("Failed to load the ticket. Please try another file.");
    } finally {
      setLoading(false);
    }
    if (loaded) {
      setPendingStamps(stamps);
      setPendingPnr(pnr);
      setStampModalOpen(true);
    }
  }

  async function buildPdf(): Promise<Uint8Array | null> {
    if (!source) return null;
    const { PDFDocument, StandardFonts, rgb, PDFName, PDFString } = await import("pdf-lib");
    const fontkit = (await import("@pdf-lib/fontkit")).default;

    const displayName = agencyName.trim() || DEFAULT_NAME;
    const displayTagline = tagline.trim() || (agencyName.trim() ? "" : DEFAULT_TAGLINE);
    const displayAddress = address.trim() || (agencyName.trim() ? "" : DEFAULT_ADDRESS);
    const displayPhone = phone.trim() || DEFAULT_PHONE;
    const displayAgent = agent.trim();

    const out = await PDFDocument.create();
    out.registerFontkit(fontkit);
    const fontBold = await out.embedFont(StandardFonts.HelveticaBold);
    const font = await out.embedFont(StandardFonts.Helvetica);
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
    let fontHand: any = fontBold;
    try {
      const hRes = await fetch("https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/comicneue/ComicNeue-Bold.ttf");
      if (hRes.ok) fontHand = await out.embedFont(new Uint8Array(await hRes.arrayBuffer()));
    } catch { /* fallback to bold */ }

    const navy = rgb(0.06, 0.13, 0.28);
    const gold = rgb(0.83, 0.68, 0.21);
    const muted = rgb(0.45, 0.47, 0.52);
    

    let logoImg: any = null;
    if (logoDataUrl) {
      try {
        const { bytes, mime } = await dataUrlToBytes(logoDataUrl);
        logoImg = mime.includes("png")
          ? await out.embedPng(bytes)
          : await out.embedJpg(bytes);
      } catch {
        logoImg = null;
      }
    }

    // Embed the WhatsApp QR code so it can be drawn inside the branded header.
    let qrImg: any = null;
    try {
      const qrUrl = await QRCode.toDataURL(waLink(displayPhone), {
        margin: 2,
        width: 1024,
        color: { dark: "#062148", light: "#ffffff" },
        errorCorrectionLevel: "H",
      });
      const { bytes: qrBytes } = await dataUrlToBytes(qrUrl);
      qrImg = await out.embedPng(qrBytes);
    } catch {
      qrImg = null;
    }
    const QR_SIZE = 72;
    const waHref = waLink(displayPhone);

    // Render lucide "Phone" + "MessageCircle" (green, filled) so the downloaded
    // PDF header shows the same two green glyphs as the on-screen preview.
    const renderLucideIcon = async (d: string): Promise<any | null> => {
      try {
        const size = 128;
        const c = document.createElement("canvas");
        c.width = size; c.height = size;
        const ctx = c.getContext("2d")!;
        ctx.clearRect(0, 0, size, size);
        const scale = size / 24;
        ctx.scale(scale, scale);
        ctx.fillStyle = "#25D366";
        ctx.strokeStyle = "#25D366";
        ctx.lineWidth = 2;
        ctx.lineJoin = "round";
        ctx.lineCap = "round";
        const p = new Path2D(d);
        ctx.fill(p);
        ctx.stroke(p);
        const pngUrl = c.toDataURL("image/png");
        const { bytes } = await dataUrlToBytes(pngUrl);
        return await out.embedPng(bytes);
      } catch {
        return null;
      }
    };
    const phoneIconImg = await renderLucideIcon(
      "M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"
    );
    const chatIconImg = await renderLucideIcon(
      "M7.9 20A9 9 0 1 0 4 16.1L2 22Z"
    );


    const skipBranding = stamps.iata || stamps.salam || noBrand;

    // Rasterize the on-screen preview header so the downloaded PDF is a pixel
    // match of the preview (logo size, text alignment, icons, QR — everything).
    let headerImg: any = null;
    let headerAspect = 0; // height / width
    if (!skipBranding && headerRef.current) {
      try {
        const node = headerRef.current;
        const rect = node.getBoundingClientRect();
        const pngUrl = await toPng(node, {
          pixelRatio: 3,
          cacheBust: true,
          backgroundColor: "#ffffff",
          width: rect.width,
          height: rect.height,
        });
        const { bytes: hb } = await dataUrlToBytes(pngUrl);
        headerImg = await out.embedPng(hb);
        headerAspect = headerImg.height / headerImg.width;
      } catch {
        headerImg = null;
      }
    }
    const footerH = skipBranding ? 0 : 32;

    // Fallback header height when rasterization fails.
    const FALLBACK_HEADER_H = displayAgent ? 104 : 96;
    const getHeaderH = (width: number) => {
      if (skipBranding) return 0;
      if (headerImg && headerAspect > 0) {
        // Header image spans between the same margins used elsewhere (24pt).
        const w = width - 48;
        return Math.round(w * headerAspect); // no extra breathing room
      }
      return FALLBACK_HEADER_H;
    };

    const drawHeader = (page: any, width: number, pageTop: number) => {
      const headerH = getHeaderH(width);
      if (headerImg && headerAspect > 0) {
        const w = width - 48;
        const h = w * headerAspect;
        page.drawImage(headerImg, {
          x: 24,
          y: pageTop - h - 3,
          width: w,
          height: h,
        });
        // Clickable WhatsApp link across the whole header (covers QR + phone).
        try {
          const annot = out.context.obj({
            Type: "Annot",
            Subtype: "Link",
            Rect: [24, pageTop - h - 3, width - 24, pageTop],
            Border: [0, 0, 0],
            A: { Type: "Action", S: "URI", URI: PDFString.of(waHref) },
          });
          const ref = out.context.register(annot);
          const existing = page.node.Annots();
          if (existing) existing.push(ref);
          else page.node.set(PDFName.of("Annots"), out.context.obj([ref]));
        } catch { /* optional */ }
        return;
      }

      // ---- Fallback manual header (used only if rasterization failed) ----
      const baseY = pageTop - headerH;
      page.drawLine({ start: { x: 24, y: baseY + 2 }, end: { x: width - 24, y: baseY + 2 }, thickness: 0.7, color: navy });
      page.drawLine({ start: { x: 24, y: baseY }, end: { x: width - 24, y: baseY }, thickness: 1.6, color: navy });

      const logoSize = 80;
      let textX = 30;
      if (logoImg) {
        const scale = logoSize / Math.max(logoImg.width, logoImg.height);
        const w = logoImg.width * scale;
        const h = logoImg.height * scale;
        page.drawImage(logoImg, { x: 30, y: baseY + (headerH - h) / 2 + 4, width: w, height: h });
        textX = 30 + logoSize + 12;
      }
      const nameSize = 16;
      const nameY = pageTop - 26 - (displayTagline ? 0 : 6);
      page.drawText(displayName, { x: textX, y: nameY, size: nameSize, font: fontBold, color: navy });
      if (displayTagline) {
        page.drawText(displayTagline.toUpperCase(), { x: textX, y: nameY - 12, size: 7, font: fontBold, color: muted });
      }
      const qrX = width - 30 - (qrImg ? QR_SIZE : 0);
      const qrY = baseY + 10;
      const rightEdge = qrImg ? qrX - 16 : width - 30;
      if (qrImg) {
        page.drawImage(qrImg, { x: qrX, y: qrY, width: QR_SIZE, height: QR_SIZE });
        page.drawRectangle({ x: qrX - 2, y: qrY - 2, width: QR_SIZE + 4, height: QR_SIZE + 4, borderColor: gold, borderWidth: 0.8 });
      }
      const phoneText = displayPhone;
      const phoneSize = 14;
      const phoneWidth = fontBold.widthOfTextAtSize(phoneText, phoneSize);
      const iconSize = 14;
      const iconGap = 4;
      const iconsBlockW = (phoneIconImg ? iconSize : 0) + (chatIconImg ? iconSize + 3 : 0);
      const phoneX = rightEdge - phoneWidth;
      const phoneY = pageTop - 28;
      let ix = phoneX - iconsBlockW - iconGap;
      if (phoneIconImg) { page.drawImage(phoneIconImg, { x: ix, y: phoneY - 1, width: iconSize, height: iconSize }); ix += iconSize + 3; }
      if (chatIconImg) { page.drawImage(chatIconImg, { x: ix, y: phoneY - 1, width: iconSize, height: iconSize }); }
      page.drawText(phoneText, { x: phoneX, y: phoneY, size: phoneSize, font: fontBold, color: navy });
      let rightCursorY = phoneY - 14;
      if (displayAgent) {
        const agentLabel = "Travel Arranger: ";
        const agentSize = 8;
        const labelWidth = font.widthOfTextAtSize(agentLabel, agentSize);
        const valueWidth = fontBold.widthOfTextAtSize(displayAgent, agentSize);
        const startX = rightEdge - (labelWidth + valueWidth);
        page.drawText(agentLabel, { x: startX, y: rightCursorY, size: agentSize, font, color: muted });
        page.drawText(displayAgent, { x: startX + labelWidth, y: rightCursorY, size: agentSize, font: fontBold, color: navy });
        rightCursorY -= 11;
      }
      if (displayAddress) {
        const addrSize = 7.5;
        const addrWidth = font.widthOfTextAtSize(displayAddress, addrSize);
        page.drawText(displayAddress, { x: rightEdge - addrWidth, y: rightCursorY, size: addrSize, font, color: muted });
      }
    };


    const drawFooter = (page: any, width: number) => {
      page.drawLine({
        start: { x: 24, y: footerH - 4 },
        end: { x: width - 24, y: footerH - 4 },
        thickness: 1.2,
        color: navy,
      });
      const parts = [displayName];
      if (displayAddress) parts.push(displayAddress);
      parts.push(displayPhone);
      const line1 = parts.join("  ·  ");
      const line2 = "Thank you for booking with us — Have Safe Journey!";
      const s1 = 8;
      const s2 = 7;
      const w1 = fontBold.widthOfTextAtSize(line1, s1);
      const w2 = font.widthOfTextAtSize(line2, s2);
      const line1X = (width - w1) / 2;
      const line1Y = footerH - 16;
      page.drawText(line1, {
        x: line1X,
        y: line1Y,
        size: s1,
        font: fontBold,
        color: navy,
      });
      page.drawText(line2, {
        x: (width - w2) / 2,
        y: footerH - 26,
        size: s2,
        font,
        color: muted,
      });
      // Clickable (non-underlined) WhatsApp link over the phone number in line1.
      try {
        const phoneW = fontBold.widthOfTextAtSize(displayPhone, s1);
        const phoneX = line1X + w1 - phoneW;
        const annot = out.context.obj({
          Type: "Annot",
          Subtype: "Link",
          Rect: [phoneX - 2, line1Y - 2, phoneX + phoneW + 2, line1Y + s1 + 1],
          Border: [0, 0, 0],
          A: { Type: "Action", S: "URI", URI: PDFString.of(waHref) },
        });
        const ref = out.context.register(annot);
        const existing = page.node.Annots();
        if (existing) existing.push(ref);
        else page.node.set(PDFName.of("Annots"), out.context.obj([ref]));
      } catch { /* optional */ }
      // Clickable (non-underlined) Google Maps link over the address in line1.
      if (displayAddress) {
        try {
          const sep = "  ·  ";
          const nameW = fontBold.widthOfTextAtSize(displayName, s1);
          const sepW = fontBold.widthOfTextAtSize(sep, s1);
          const addrW = fontBold.widthOfTextAtSize(displayAddress, s1);
          const addrX = line1X + nameW + sepW;
          const annot2 = out.context.obj({
            Type: "Annot",
            Subtype: "Link",
            Rect: [addrX - 2, line1Y - 2, addrX + addrW + 2, line1Y + s1 + 1],
            Border: [0, 0, 0],
            A: { Type: "Action", S: "URI", URI: PDFString.of(MAPS_URL) },
          });
          const ref2 = out.context.register(annot2);
          const existing2 = page.node.Annots();
          if (existing2) existing2.push(ref2);
          else page.node.set(PDFName.of("Annots"), out.context.obj([ref2]));
        } catch { /* optional */ }
      }
    };



    const red = rgb(0.83, 0.10, 0.14);

    // Draw a small red plane inside a red circle (icon on the left of the stamp).
    const drawPlaneIcon = (page: any, cx: number, cy: number, r: number) => {
      page.drawCircle({ x: cx, y: cy, size: r, borderColor: red, borderWidth: 1.2 });
      // Simple upright airplane silhouette, scaled to icon size
      const s = r / 6;
      const path =
        "M0,5 L1.6,1 L6,-0.4 L6,-1.6 L1.6,-1 L0.4,-4 L1.8,-4.6 L1.8,-5.4 " +
        "L-1.8,-5.4 L-1.8,-4.6 L-0.4,-4 L-1.6,-1 L-6,-1.6 L-6,-0.4 L-1.6,1 Z";
      page.drawSvgPath(path, {
        x: cx,
        y: cy,
        scale: s,
        color: red,
        borderColor: red,
        borderWidth: 0.2,
      });
    };

    // Draw corner brackets (like ⌐ ¬ ⌐ ¬) inside the stamp rectangle.
    const drawCorners = (page: any, x: number, y: number, w: number, h: number) => {
      const inset = 4;
      const len = 7;
      const t = 1;
      const bx = x + inset, by = y + inset, bw = w - inset * 2, bh = h - inset * 2;
      const seg = (px: number, py: number, ww: number, hh: number) =>
        page.drawRectangle({ x: px, y: py, width: ww, height: hh, color: red });
      // bottom-left
      seg(bx, by, len, t); seg(bx, by, t, len);
      // bottom-right
      seg(bx + bw - len, by, len, t); seg(bx + bw - t, by, t, len);
      // top-left
      seg(bx, by + bh - t, len, t); seg(bx, by + bh - len, t, len);
      // top-right
      seg(bx + bw - len, by + bh - t, len, t); seg(bx + bw - t, by + bh - len, t, len);
    };

    type Stamp = { kind: "single"; text: string } | { kind: "group" };

    const drawStamp = (page: any, stamp: Stamp, cx: number, cy: number) => {
      if (stamp.kind === "single") {
        const size = 13;
        const iconR = 9;
        const padX = 14;
        const padY = 10;
        const gap = 10;
        const textW = fontBold.widthOfTextAtSize(stamp.text, size);
        const w = padX * 2 + iconR * 2 + gap + textW;
        const h = padY * 2 + Math.max(size, iconR * 2);
        const x = cx - w / 2;
        const y = cy - h / 2;
        page.drawRectangle({ x, y, width: w, height: h, borderColor: red, borderWidth: 1.2 });
        drawCorners(page, x, y, w, h);
        drawPlaneIcon(page, x + padX + iconR, y + h / 2, iconR);
        page.drawText(stamp.text, {
          x: x + padX + iconR * 2 + gap,
          y: y + (h - size) / 2 + 1,
          size,
          font: fontBold,
          color: red,
        });
      } else {
        const titleSize = 14;
        const subSize = 9;
        const iconR = 11;
        const padX = 14;
        const padY = 9;
        const gap = 12;
        const title = "GROUP TICKET";
        const sub1 = "NON REFUNDABLE";
        const sub2 = "NON CHANGEABLE";
        const titleW = fontBold.widthOfTextAtSize(title, titleSize);
        const subW = Math.max(
          fontBold.widthOfTextAtSize(sub1, subSize),
          fontBold.widthOfTextAtSize(sub2, subSize),
        );
        const rightW = Math.max(titleW, subW);
        const w = padX * 2 + iconR * 2 + gap + rightW;
        const h = padY * 2 + titleSize + 4 + subSize * 2 + 3;
        const x = cx - w / 2;
        const y = cy - h / 2;
        page.drawRectangle({ x, y, width: w, height: h, borderColor: red, borderWidth: 1.2 });
        drawCorners(page, x, y, w, h);
        drawPlaneIcon(page, x + padX + iconR, y + h / 2, iconR);
        const textX = x + padX + iconR * 2 + gap;
        const titleY = y + h - padY - titleSize + 2;
        page.drawText(title, { x: textX, y: titleY, size: titleSize, font: fontBold, color: red });
        // divider line under title
        page.drawRectangle({
          x: textX,
          y: titleY - 3,
          width: rightW,
          height: 0.8,
          color: red,
        });
        page.drawText(sub1, {
          x: textX,
          y: titleY - 3 - subSize - 3,
          size: subSize,
          font: fontBold,
          color: red,
        });
        page.drawText(sub2, {
          x: textX,
          y: titleY - 3 - subSize * 2 - 5,
          size: subSize,
          font: fontBold,
          color: red,
        });
      }
    };

    const activeStamps: Stamp[] = [];
    if (stamps.nonRefundable) activeStamps.push({ kind: "single", text: "NON REFUNDABLE" });
    if (stamps.group) activeStamps.push({ kind: "group" });

    const stampWidth = (stamp: Stamp): number => {
      if (stamp.kind === "single") {
        const size = 13, iconR = 9, padX = 14, gap = 10;
        return padX * 2 + iconR * 2 + gap + fontBold.widthOfTextAtSize(stamp.text, size);
      }
      const titleSize = 14, subSize = 9, iconR = 11, padX = 14, gap = 12;
      const titleW = fontBold.widthOfTextAtSize("GROUP TICKET", titleSize);
      const subW = Math.max(
        fontBold.widthOfTextAtSize("NON REFUNDABLE", subSize),
        fontBold.widthOfTextAtSize("NON CHANGEABLE", subSize),
      );
      return padX * 2 + iconR * 2 + gap + Math.max(titleW, subW);
    };

    const drawStampsOnPage = (page: any, width: number) => {
      if (activeStamps.length === 0) return;
      const baselineY = footerH + 60;
      const gap = 30;
      const widths = activeStamps.map(stampWidth);
      const total = widths.reduce((a, b) => a + b, 0) + gap * (activeStamps.length - 1);
      let cursor = (width - total) / 2;
      if (cursor < 20) cursor = 20;
      activeStamps.forEach((s, i) => {
        const cx = cursor + widths[i] / 2;
        drawStamp(page, s, cx, baselineY);
        cursor += widths[i] + gap;
      });
    };

    // ---- Image stamps (IATA / Salam Air) placed on empty margin ----
    let iataImg: any = null;
    let salamImg: any = null;
    if (stamps.iata) {
      try {
        const res = await fetch(IATA_STAMP_URL);
        iataImg = await out.embedPng(new Uint8Array(await res.arrayBuffer()));
      } catch { iataImg = null; }
    }
    if (stamps.salam) {
      try {
        const res = await fetch(SALAM_STAMP_URL);
        salamImg = await out.embedPng(new Uint8Array(await res.arrayBuffer()));
      } catch { salamImg = null; }
    }
    const IMG_STAMP_H = 70;

    const drawImageStampsOnPage = (page: any, width: number, height: number) => {
      // Center the image stamps on the page (both axes), side-by-side, so they
      // land on the empty middle area of the ticket rather than over the text edges.
      const items: Array<{ img: any; isSalam: boolean }> = [];
      if (iataImg) items.push({ img: iataImg, isSalam: false });
      if (salamImg) items.push({ img: salamImg, isSalam: true });
      if (items.length === 0) return;

      const gap = 24;
      const sized = items.map(({ img, isSalam }) => {
        const scale = IMG_STAMP_H / img.height;
        return { img, isSalam, w: img.width * scale, h: IMG_STAMP_H };
      });
      const totalW = sized.reduce((a, s) => a + s.w, 0) + gap * (sized.length - 1);
      let cursorX = (width - totalW) / 2;
      const y = (height - IMG_STAMP_H) / 2;

      sized.forEach(({ img, isSalam, w, h }) => {
        page.drawImage(img, { x: cursorX, y, width: w, height: h });
        if (isSalam) {
          const pnrText = (pnr || "").trim().toUpperCase();
          if (pnrText) {
            const size = 12;
            const stampBlue = rgb(0.196, 0.184, 1.0);
            page.drawText(pnrText, {
              x: cursorX + w * 0.44,
              y: y + h * 0.92,
              size,
              font: fontHand,
              color: stampBlue,
            });
          }
        }
        cursorX += w + gap;
      });

    };



    const A4_SHORT = 595.28;
    const A4_LONG = 841.89;
    const contentGap = 4;

    if (source.kind === "pdf") {
      const src = await PDFDocument.load(source.bytes, { ignoreEncryption: true });
      src.getPages().forEach((p: any) => p.node.delete(PDFName.of("Annots")));
      src.catalog.delete(PDFName.of("AcroForm"));
      const pageIdxs = Array.from(includedPages).sort((a, b) => a - b);
      if (pageIdxs.length === 0) {
        alert("Select at least one page to include.");
        return null;
      }
      const srcPages = pageIdxs.map((idx) => src.getPage(idx));
      const embeds = await out.embedPages(srcPages);
      for (let pi = 0; pi < pageIdxs.length; pi++) {
        const origIdx = pageIdxs[pi];
        const srcPage = srcPages[pi];
        const srcW = srcPage.getWidth();
        const srcH = srcPage.getHeight();
        const landscape = srcW > srcH;
        const pageW = landscape ? A4_LONG : A4_SHORT;
        const boxX = 24;
        const boxW = pageW - 48;
        const scale = boxW / srcW;
        const drawW = boxW;
        const drawH = srcH * scale;
        const isFirst = pi === 0;
        const headerHPts = isFirst ? getHeaderH(pageW) : 0;
        const pageFooterH = isFirst ? footerH : 0;
        const pageH = headerHPts + pageFooterH + contentGap * 2 + drawH;
        const offsetX = boxX;
        const offsetY = pageFooterH + contentGap;
        const page = out.addPage([pageW, pageH]);

        page.drawPage(embeds[pi], {
          x: offsetX,
          y: offsetY,
          width: drawW,
          height: drawH,
        });
        for (const r of source.redactions) {
          if (r.pageIndex !== origIdx) continue;
          page.drawRectangle({
            x: offsetX + r.x * scale,
            y: offsetY + r.y * scale,
            width: r.width * scale,
            height: r.height * scale,
            color: rgb(r.color.r, r.color.g, r.color.b),
          });
        }
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
            x: offsetX + (t.x - padX) * scale,
            y: offsetY + (t.y - padY) * scale,
            width: (t.widthPts + padX * 2) * scale,
            height: (effHeight + padY * 2) * scale,
            color: rgb(bg.r, bg.g, bg.b),
          });
          if (!cleared) {
            const size = effHeight * scale;
            const useFont = pickStyledFont(style?.family, style?.bold, style?.italic);
            const textColor = hexRgb(style?.color);
            page.drawText(value, {
              x: offsetX + t.x * scale,
              y: offsetY + t.y * scale,
              size,
              font: useFont,
              color: textColor,
            });
            if (style?.underline) {
              const tw = useFont.widthOfTextAtSize(value, size);
              page.drawLine({
                start: { x: offsetX + t.x * scale, y: offsetY + t.y * scale - size * 0.12 },
                end: { x: offsetX + t.x * scale + tw, y: offsetY + t.y * scale - size * 0.12 },
                thickness: Math.max(0.5, size * 0.06),
                color: textColor,
              });
            }
          }
        });

        eraseRects.filter((r) => r.pageIndex === origIdx).forEach((r) => {
          page.drawRectangle({
            x: offsetX + r.x * drawW,
            y: offsetY + drawH - (r.y + r.h) * drawH,
            width: r.w * drawW,
            height: r.h * drawH,
            color: rgb(1, 1, 1),
          });
        });

        pastedItems.filter((p) => p.pageIndex === origIdx).forEach((p) => {
          const size = p.size * scale;
          const useFont = pickStyledFont(p.family, p.bold, p.italic);
          const textColor = hexRgb(p.color);
          const px = offsetX + (p.xPct / 100) * drawW;
          const pyTop = (p.yPct / 100) * drawH;
          const py = offsetY + drawH - pyTop - size;
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

        if (isFirst && !skipBranding) {
          drawHeader(page, pageW, pageH);
          drawFooter(page, pageW);
        }

        if (isFirst) {
          drawStampsOnPage(page, pageW);
          drawImageStampsOnPage(page, pageW, pageH);
        }
      }

    } else {
      const img = source.mime.includes("png")
        ? await out.embedPng(source.bytes)
        : await out.embedJpg(source.bytes);
      const landscape = img.width > img.height;
      const pageW = landscape ? A4_LONG : A4_SHORT;
      const boxX = 24;
      const boxW = pageW - 48;
      const ratio = boxW / img.width;
      const w = boxW;
      const h = img.height * ratio;
      const headerHPts = getHeaderH(pageW);
      const pageH = headerHPts + footerH + contentGap * 2 + h;
      const page = out.addPage([pageW, pageH]);
      page.drawImage(img, {
        x: boxX,
        y: footerH + contentGap,
        width: w,
        height: h,
      });
      if (!skipBranding) {
        drawHeader(page, pageW, pageH);
        drawFooter(page, pageW);
      }

      drawStampsOnPage(page, pageW);
      drawImageStampsOnPage(page, pageW, pageH);
    }


    return await out.save();
  }

  async function downloadPdf() {
    if (!source) return;
    setBuilding(true);
    try {
      const bytes = await buildPdf();
      if (!bytes) return;
      const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const base = (fileName || "ticket").replace(/\.[^.]+$/, "");
      a.download = `${base}-rohi.pdf`;
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

  function clearAll() {
    setPreviewPages([]);
    setSource(null);
    setFileName("");
    setTextEdits({});
    setEraseRects([]);
    setPastedItems([]);
    setSelectedPastedIds(new Set());
    clipboardRef.current = [];
    setIncludedPages(new Set());
    setCurrentPage(0);
    setEditMode(false);
    if (inputRef.current) inputRef.current.value = "";
  }


  // Resolved synchronously from the route's search params / role gate.
  const agentPortal = Route.useSearch().portal === "agent";

  if (agentPortal) {
    return (
      <div className="min-h-screen bg-background">
        <AgentTopBar />
        <div className="flex min-h-[calc(100vh-3.5rem)]">
          <AgentSidebarNav inline />
          <div className="min-w-0 flex-1">
            {printBody}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="min-w-0 flex-1">
      <header className="border-b border-border bg-navy text-navy-foreground print:hidden">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-3 px-4 py-3">
          <Link to="/admin" className="inline-flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/5 ring-1 ring-white/10">
              <Plane className="h-4 w-4 -rotate-45 text-gold" />
            </div>
            <div>
              <p className="font-serif text-lg font-black leading-none">ROHI INTERNATIONAL TRAVELS</p>
              <p className="text-[10px] tracking-[0.25em] text-white/60">PRINT TICKETS</p>
            </div>
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <AdminHeaderExtras />
          </div>
        </div>
        <AdminTabs />
      </header>




      <section className="mx-auto grid max-w-6xl gap-8 px-4 py-8 lg:grid-cols-[320px_1fr]">
        {/* Controls */}
        <div className="print:hidden">
          <h1 className="font-serif text-2xl font-black text-navy">Print Format</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Upload a ticket in any format — you'll get a branded, editable PDF (vector text preserved) with fare / tax
            amounts hidden. Open it in any PDF editor for further tweaks.
          </p>

          <div className="mt-6 space-y-4">
            <label className={`inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-navy/40 bg-navy/5 px-4 py-3 text-sm font-bold text-navy hover:bg-navy/10 ${loading ? "pointer-events-none opacity-60" : ""}`}>
              <input
                ref={inputRef}
                type="file"
                accept="image/jpeg,application/pdf,.pdf,.jpg,.jpeg"
                className="sr-only"
                disabled={loading}
              />
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {loading
                ? "Processing…"
                : source
                  ? "Replace Ticket"
                  : "Upload Ticket (JPEG, PDF)"}
            </label>

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
              <p className="truncate text-[11px] text-muted-foreground">Loaded: {fileName}</p>
            )}

            <label className="flex items-start gap-2 rounded-lg border border-border bg-white p-3 cursor-pointer hover:bg-secondary/40">
              <input
                type="checkbox"
                checked={noBrand}
                onChange={(e) => setNoBrand(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-navy"
              />
              <span className="text-xs font-semibold text-navy">
                Remove header, footer & agent details
                <span className="mt-0.5 block text-[10px] font-normal text-muted-foreground">
                  Outputs the ticket only — no branding, agency name, address, phone, arranger or footer note.
                </span>
              </span>
            </label>

            {!noBrand && (
              <>
                <div className="space-y-2 rounded-lg border border-dashed border-navy/25 bg-navy/[0.03] px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] font-semibold text-navy/80">
                      {hasSavedProfile
                        ? "Using your saved profile — edit anytime."
                        : "Using Rohi defaults — fill your own, then save as default."}
                    </p>
                    <button
                      type="button"
                      onClick={resetSavedDefaults}
                      className="inline-flex items-center gap-1 rounded-md border border-navy/30 bg-white px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-navy hover:border-navy hover:bg-navy hover:text-white"
                    >
                      <RotateCcw className="h-3 w-3" /> Reset to Rohi default
                    </button>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={saveProfileAsDefault}
                      className="inline-flex items-center gap-1.5 rounded-md border border-gold bg-gold px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-widest text-navy hover:bg-gold/90"
                    >
                      {savedFlash ? <Check className="h-3 w-3" /> : <Save className="h-3 w-3" />}
                      {savedFlash ? "Saved as default" : "Save as my default"}
                    </button>
                  </div>
                  <p className="text-[10px] leading-snug text-muted-foreground">
                    Saved on this device only — your agency name, tagline, address, contact, agent name and logo will
                    auto-fill next time.
                  </p>
                </div>

                {[
                  { label: "Agency Name", value: agencyName, set: setAgencyName, ph: DEFAULT_NAME, optional: false },
                  { label: "Tagline", value: tagline, set: setTagline, ph: DEFAULT_TAGLINE, optional: true },
                  { label: "Address", value: address, set: setAddress, ph: DEFAULT_ADDRESS, optional: true },
                  { label: "Contact / WhatsApp Number", value: phone, set: setPhone, ph: DEFAULT_PHONE, optional: false },
                  { label: "Travel Arranger Name", value: agent, set: setAgent, ph: "e.g. Ahmed Khan", optional: true },
                ].map((f) => (
                  <div key={f.label}>
                    <label className="mb-1 block text-[11px] font-bold uppercase tracking-widest text-navy/70">
                      {f.label}
                      {f.optional && (
                        <span className="font-normal normal-case tracking-normal text-muted-foreground"> (optional)</span>
                      )}
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={f.value}
                        onChange={(e) => f.set(e.target.value)}
                        placeholder={f.ph}
                        className="w-full rounded-lg border border-border bg-white px-3 py-2 pr-8 text-sm text-navy placeholder:text-muted-foreground/60 focus:border-navy focus:outline-none"
                      />
                      {f.value && (
                        <button
                          type="button"
                          onClick={() => f.set("")}
                          className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-secondary hover:text-navy"
                          aria-label={`Clear ${f.label}`}
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}

                <div>
                  <label className="mb-1 block text-[11px] font-bold uppercase tracking-widest text-navy/70">
                    Upload Logo
                  </label>
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => onLogo(e.target.files?.[0])}
                  />
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => logoInputRef.current?.click()}
                      className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-dashed border-navy/40 bg-navy/5 px-3 py-2 text-xs font-bold text-navy hover:bg-navy/10"
                    >
                      <Upload className="h-3.5 w-3.5" />
                      {logoDataUrl ? "Replace Logo" : "Upload Agency Logo"}
                    </button>
                    {logoDataUrl && (
                      <>
                        <img src={logoDataUrl} alt="Logo preview" className="h-10 w-10 rounded-md object-contain ring-1 ring-border" />
                        <button
                          type="button"
                          onClick={() => {
                            setLogoDataUrl("");
                            if (logoInputRef.current) logoInputRef.current.value = "";
                          }}
                          className="rounded-md border border-border p-1.5 text-muted-foreground hover:bg-secondary"
                          aria-label="Remove logo"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </>
            )}


            {source && (
              <>
                <button
                  type="button"
                  onClick={downloadPdf}
                  disabled={building}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-gold px-4 py-3 text-sm font-black tracking-wide text-gold-foreground shadow-lg hover:brightness-95 disabled:opacity-60"
                >
                  {building ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  {building ? "Building PDF…" : "Download"}
                </button>
                <p className="text-[10px] leading-snug text-muted-foreground">
                  Click any text on the ticket preview to edit it. Drag over any text, image or shape to erase that area.
                  Double-click a white patch to undo it. Press <b>Delete</b> inside a field to wipe that text instantly.
                  Edits are baked into the downloaded PDF while keeping the original vector layout.
                </p>
                <button
                  type="button"
                  onClick={clearAll}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-border px-4 py-2 text-xs font-bold uppercase tracking-widest text-muted-foreground hover:bg-secondary"
                >
                  <X className="h-3.5 w-3.5" /> Clear
                </button>
              </>
            )}
          </div>
        </div>

        {/* Preview */}
        <div className="rounded-xl bg-white ring-1 ring-border print:ring-0">
          <div id="rohi-print-sheet" className="mx-auto w-full max-w-[820px] p-6 print:p-0">
            {/* Header (hidden when IATA / Salam Air stamps are active) */}
            {!(stamps.iata || stamps.salam || noBrand) && (() => {

              const displayName = agencyName.trim() || DEFAULT_NAME;
              const displayTagline = tagline.trim() || (agencyName.trim() ? "" : DEFAULT_TAGLINE);
              const displayAddress = address.trim() || (agencyName.trim() ? "" : DEFAULT_ADDRESS);
              const displayPhone = phone.trim() || DEFAULT_PHONE;
              const displayAgent = agent.trim();
              return (
                <div ref={headerRef} className="flex items-center justify-between gap-6 border-b-4 border-double border-navy pb-4">
                  <div className="flex min-w-0 items-center gap-3">
                    {logoDataUrl ? (
                      <img src={logoDataUrl} alt="Agency logo" className="h-20 w-20 shrink-0 object-contain" />
                    ) : (
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-navy">
                        <Plane className="h-6 w-6 -rotate-45 text-gold" />
                      </div>
                    )}
                    <div className={`min-w-0 ${displayTagline ? "" : "flex flex-col justify-center"}`}>
                      <p className="font-serif text-xl font-black leading-tight text-navy">
                        {displayName}
                      </p>
                      {displayTagline && (
                        <p className="mt-0.5 text-[10px] font-bold tracking-[0.25em] text-muted-foreground">
                          {displayTagline}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-4">
                    <div className="text-right text-navy">
                      <a
                        href={waLink(displayPhone)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 whitespace-nowrap text-[18px] font-extrabold leading-none tracking-tight no-underline hover:opacity-80"
                      >
                        <span className="inline-flex items-center gap-1">
                          <Phone className="h-4 w-4" style={{ color: "#25D366" }} fill="#25D366" />
                          <MessageCircle className="h-4 w-4" style={{ color: "#25D366" }} fill="#25D366" />
                        </span>
                        <span className="whitespace-nowrap">{displayPhone}</span>
                      </a>
                      {displayAgent && (
                        <p className="mt-1.5 text-[11px] font-semibold text-navy">
                          <span className="text-muted-foreground">Travel Arranger:</span>{" "}
                          <span className="font-black">{displayAgent}</span>
                        </p>
                      )}
                      {displayAddress && (
                        <p className="mt-1 text-[10px] font-semibold text-muted-foreground">{displayAddress}</p>
                      )}
                    </div>
                    {qrDataUrl && (
                      <a
                        href={waLink(displayPhone)}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Scan or click to chat on WhatsApp"
                        className="group shrink-0 rounded-md border border-gold/60 bg-white p-1 shadow-sm no-underline hover:border-gold hover:shadow-md"
                      >
                        <img src={qrDataUrl} alt="WhatsApp QR" className="h-[72px] w-[72px] [image-rendering:pixelated]" />
                      </a>
                    )}
                  </div>
                </div>

              );
            })()}



            {/* Ticket preview */}
            <div className="mt-3 space-y-4">
              {previewPages.length === 0 && !loading && (
                <div className="flex h-72 items-center justify-center rounded-md border-2 border-dashed border-border text-sm text-muted-foreground">
                  Upload a ticket (JPG, PNG or PDF) to preview it here.
                </div>
              )}
              {loading && (
                <div className="flex h-72 items-center justify-center rounded-md border-2 border-dashed border-border text-sm text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing ticket…
                </div>
              )}
              {previewPages.length > 0 && (() => {
                const visible = previewPages.map((_, i) => i).filter((i) => includedPages.has(i));
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
                return previewPages.map((src, i) => {
                  if (i !== activeIdx) return null;
                  const pageSize = source?.kind === "pdf" ? source.pageSizes[i] : null;
                  const pageItems =
                    source?.kind === "pdf" && pageSize
                      ? source.textItems
                          .map((t, idx) => ({ t, idx }))
                          .filter((it) => it.t.pageIndex === i)
                      : [];
                  return (
                <div
                  key={i}
                  className="relative"
                  style={pageSize ? { containerType: "inline-size", touchAction: editMode ? "none" : undefined } as any : undefined}
                  onPointerDown={(e) => {
                    lastPageRef.current = i;
                    if (!editMode || !pageSize) return;
                    const target = e.target as HTMLElement;
                    const rect = e.currentTarget.getBoundingClientRect();
                    const sx = e.clientX - rect.left;
                    const sy = e.clientY - rect.top;
                    // Always record paste anchor at click point so Ctrl+V pastes here
                    pasteAnchorRef.current = { pageIndex: i, xPct: (sx / rect.width) * 100, yPct: (sy / rect.height) * 100 };
                    if (target.tagName === "INPUT") return;
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
                    alt={`Ticket page ${i + 1}`}
                    draggable={false}
                    className="w-full break-inside-avoid select-none rounded-md ring-1 ring-border print:ring-0"
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
                    const effHeight = (style?.size ?? t.fontHeightPts);
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
                      // approximate character width as 0.55em for group bbox
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



                  {(stamps.iata || stamps.salam) && (
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center gap-6">
                      {stamps.iata && (
                        <img src={IATA_STAMP_URL} alt="IATA stamp" className="h-[70px] w-auto object-contain" />
                      )}
                      {stamps.salam && (
                        <div className="relative inline-block">
                          <img src={SALAM_STAMP_URL} alt="Salam Air stamp" className="h-[70px] w-auto object-contain" />
                      {pnr.trim() && (
                            <span
                              className="absolute leading-none tracking-tight"
                              style={{
                                left: "44%",
                                top: "-6%",
                                fontSize: 12,
                                color: "#322fff",
                                fontFamily: "'Comic Sans MS', 'Comic Neue', 'Chalkboard SE', cursive",
                                fontWeight: 700,
                              }}
                            >
                              {pnr.trim().toUpperCase()}
                            </span>
                          )}

                        </div>
                      )}
                    </div>
                  )}
                </div>
                );
              });
              })()}


            </div>

            {/* Stamp overlay above footer */}
            {(stamps.nonRefundable || stamps.group) && previewPages.length > 0 && (
              <div className="mt-4 flex flex-wrap items-center justify-center gap-8">
                {stamps.nonRefundable && <StampSingle text="NON REFUNDABLE" />}
                {stamps.group && <StampGroup />}
              </div>
            )}





            {/* Footer (hidden when IATA / Salam Air stamps are active) */}
            {!(stamps.iata || stamps.salam || noBrand) && (
              <div className="mt-4 border-t-2 border-navy pt-2 text-center text-[10px] font-semibold tracking-widest text-navy">
                <p>
                  {(agencyName.trim() || DEFAULT_NAME)}
                  {(address.trim() || (agencyName.trim() ? "" : DEFAULT_ADDRESS)) ? (
                    <>
                      {` · `}
                      <a
                        href={MAPS_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="no-underline hover:text-gold"
                      >
                        {address.trim() || DEFAULT_ADDRESS}
                      </a>
                    </>
                  ) : null}
                  {` · `}
                  <a
                    href={waLink(phone.trim() || DEFAULT_PHONE)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-black no-underline hover:text-gold"
                  >
                    {phone.trim() || DEFAULT_PHONE}
                  </a>
                </p>
                <p className="mt-0.5 text-muted-foreground">Thank you for booking with us — Have Safe Journey!</p>
              </div>
            )}

          </div>
        </div>
      </section>

      {stampModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-2xl">
            <h3 className="text-sm font-black uppercase tracking-widest text-navy">Stamp Options</h3>
            <div className="mt-4 space-y-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={pendingStamps.nonRefundable}
                  onChange={(e) => setPendingStamps((p) => ({ ...p, nonRefundable: e.target.checked }))}
                  className="h-4 w-4 accent-red-600"
                />
                <span className="text-sm font-bold text-red-600">NON REFUNDABLE</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={pendingStamps.group}
                  onChange={(e) => setPendingStamps((p) => ({ ...p, group: e.target.checked }))}
                  className="h-4 w-4 accent-red-600"
                />
                <span className="text-sm font-bold text-red-600">GROUP TICKET · NON REFUNDABLE NON CHANGEABLE</span>
              </label>
            </div>
            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setStampModalOpen(false)}
                className="rounded-md border border-border bg-white px-4 py-2 text-sm font-semibold text-navy hover:bg-secondary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setStamps(pendingStamps);
                  setPnr(pendingPnr);
                  setStampModalOpen(false);
                }}
                className="rounded-md bg-navy px-4 py-2 text-sm font-bold text-white hover:brightness-110"
              >
                Generate
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
