import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";

import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, StandardFonts, degrees, rgb } from "pdf-lib";
import { Bold, Check, ChevronDown, ChevronLeft, ChevronRight, Copy, Download, FileInput, FileOutput, FilePlus2, FileUp, Highlighter, ImagePlus, Italic, Minus, MoreHorizontal, Pencil, Plus, Printer, RotateCw, Save, Settings2, Trash2, Undo2, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuShortcut, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { LayoutTemplate, X as CloseIcon, FileEdit, Upload, RotateCcw, Stamp, Plane, Phone, MessageCircle } from "lucide-react";


// Worker setup with CDN fallback
if (typeof window !== "undefined" && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/build/pdf.worker.min.mjs",
      import.meta.url
    ).toString();
  } catch {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version || "4.10.38"}/pdf.worker.min.mjs`;
  }
}

function StampCorners() {
  const c = "absolute size-1.5 border-red-600";
  return (
    <>
      <span className={`${c} -top-0.5 -left-0.5 border-t border-l`} />
      <span className={`${c} -top-0.5 -right-0.5 border-t border-r`} />
      <span className={`${c} -bottom-0.5 -left-0.5 border-b border-l`} />
      <span className={`${c} -bottom-0.5 -right-0.5 border-b border-r`} />
    </>
  );
}

function pickFont(item: { bold: boolean; italic: boolean; fontFamily: string }) {
  const serif = /times|serif|georgia|garamond|roman/i.test(item.fontFamily);
  const mono = /mono|courier|consol/i.test(item.fontFamily);
  if (mono) {
    if (item.bold && item.italic) return StandardFonts.CourierBoldOblique;
    if (item.bold) return StandardFonts.CourierBold;
    if (item.italic) return StandardFonts.CourierOblique;
    return StandardFonts.Courier;
  }
  if (serif) {
    if (item.bold && item.italic) return StandardFonts.TimesRomanBoldItalic;
    if (item.bold) return StandardFonts.TimesRomanBold;
    if (item.italic) return StandardFonts.TimesRomanItalic;
    return StandardFonts.TimesRoman;
  }
  if (item.bold && item.italic) return StandardFonts.HelveticaBoldOblique;
  if (item.bold) return StandardFonts.HelveticaBold;
  if (item.italic) return StandardFonts.HelveticaOblique;
  return StandardFonts.Helvetica;
}


export interface TicketCanvasStudioProps {
  portal?: string;
  initialPdfBytes?: Uint8Array | ArrayBuffer | null;
  fileName?: string;
  isOpen?: boolean;
  onClose?: () => void;
  onApplyToTicket?: (editedBytes: Uint8Array) => void;
  profile?: {
    agencyName?: string;
    phone?: string;
    address?: string;
    tagline?: string;
    logoUrl?: string;
    agent?: string;
    noBrand?: boolean;
    headerFooterPages?: number[];
    stamps?: {
      nonRefundable?: boolean;
      group?: boolean;
    };
  };
  onProfileChange?: (profile: {
    agencyName?: string;
    phone?: string;
    address?: string;
    tagline?: string;
    logoUrl?: string;
    agent?: string;
    noBrand?: boolean;
    headerFooterPages?: number[];
    stamps?: {
      nonRefundable?: boolean;
      group?: boolean;
    };
  }) => void;
  initialHeaderEnabled?: boolean;
  initialFooterEnabled?: boolean;
  initialHeaderFooterPages?: "first" | "all" | "none" | "custom";
}

export default function TicketCanvasStudio({
  portal = "Rohi Ticket Studio",
  initialPdfBytes,
  fileName: initialFileName,
  isOpen,
  onClose,
  onApplyToTicket,
  profile,
  onProfileChange,
  initialHeaderEnabled = true,
  initialFooterEnabled = true,
  initialHeaderFooterPages = "first",
}: TicketCanvasStudioProps) {
  const [fileName, setFileName] = useState<string | null>(null);
  const [bytes, setBytes] = useState<ArrayBuffer | null>(null);
  const [pages, setPages] = useState<PageInfo[]>([]);
  const [edits, setEdits] = useState<Edit[]>([]);
  const [tool, setTool] = useState<Tool>("select");
  const [scale, setScale] = useState(1.3);
  const [selection, setSelection] = useState<Selection>(NO_SEL);
  const [drag, setDrag] = useState<{ page: number; x0: number; y0: number; x1: number; y1: number } | null>(null);
  const dragRef = useRef<typeof drag>(null);
  const [editing, setEditing] = useState<number | null>(null);
  const [editingDraft, setEditingDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const canvasRefs = useRef<Record<number, HTMLCanvasElement | null>>({});
  const docRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null);
  const [previewDoc, setPreviewDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const fontsRef = useRef<Record<string, EmbeddedFont>>({});
  const styleRef = useRef<Record<string, { bold: boolean; italic: boolean }>>({});
  const dropInputRef = useRef<HTMLInputElement | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const workspaceRef = useRef<HTMLElement | null>(null);
  const pagesRef = useRef<HTMLDivElement | null>(null);
  const pageRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const anchorRef = useRef<{ px: number; py: number; cx: number; cy: number; k: number } | null>(null);
  const history = useRef<Array<{ bytes: ArrayBuffer; edits: Edit[]; name: string }>>([]);
  const fileHandleRef = useRef<any>(null);
  const imgDragRef = useRef<{ index: number; mode: "move" | "resize"; sx: number; sy: number; box: Box } | null>(null);
  const [selectedImage, setSelectedImage] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageInput, setPageInput] = useState("1");
  const [printOpen, setPrintOpen] = useState(false);
  const [printRange, setPrintRange] = useState<"all" | "current" | "custom">("all");
  const [printCustom, setPrintCustom] = useState("");
  // Initialize initial bytes if provided
  useEffect(() => {
    if (initialPdfBytes && !bytes) {
      void loadBytes(initialPdfBytes, initialFileName || "ticket.pdf", false);
    }
  }, [initialPdfBytes]);


  const clampScale = (value: number) => Math.min(4, Math.max(0.25, Math.round(value * 100) / 100));
  // Zoom keeps the point under the cursor (or the view centre) fixed, like Foxit.
  const zoomTo = (value: number, clientX?: number, clientY?: number) => {
    const next = clampScale(value);
    const main = workspaceRef.current;
    const el = pagesRef.current;
    if (next === scale) return;
    if (main && el) {
      const m = main.getBoundingClientRect();
      const rect = el.getBoundingClientRect();
      const cx = clientX ?? m.left + m.width / 2;
      const cy = clientY ?? m.top + m.height / 2;
      anchorRef.current = { px: cx - rect.left, py: cy - rect.top, cx, cy, k: next / scale };
    }
    setScale(next);
  };
  useLayoutEffect(() => {
    const a = anchorRef.current;
    const main = workspaceRef.current;
    const el = pagesRef.current;
    anchorRef.current = null;
    if (!a || !main || !el) return;
    const rect = el.getBoundingClientRect();
    main.scrollLeft += rect.left + a.px * a.k - a.cx;
    main.scrollTop += rect.top + a.py * a.k - a.cy;
  }, [scale]);
  const fitWidth = () => {
    const width = workspaceRef.current?.clientWidth;
    const widest = Math.max(...pages.map((page) => page.width), 1);
    if (width) zoomTo((width - 48) / widest);
  };
  const fitPage = () => {
    const main = workspaceRef.current;
    const first = pages.find((page) => page.index === currentPage) ?? pages[0];
    if (main && first) zoomTo(Math.min((main.clientWidth - 48) / first.width, (main.clientHeight - 90) / first.height));
  };
  const goToPage = (n: number) => {
    const target = Math.min(Math.max(1, n), pages.length || 1);
    pageRefs.current[target]?.scrollIntoView({ block: "start", behavior: "smooth" });
    setCurrentPage(target);
    setPageInput(String(target));
  };
  const onWorkspaceScroll = () => {
    const main = workspaceRef.current;
    if (!main) return;
    const line = main.getBoundingClientRect().top + main.clientHeight * 0.35;
    let found = 1;
    for (const info of pages) {
      const el = pageRefs.current[info.index];
      if (el && el.getBoundingClientRect().top <= line) found = info.index;
    }
    if (found !== currentPage) {
      setCurrentPage(found);
      setPageInput(String(found));
    }
  };

  const removed = useMemo(
    () => new Set(edits.filter((e) => e.kind === "removePage").map((e) => e.page)),
    [edits],
  );
  const rotationOf = useCallback(
    (page: number) =>
      edits.reduce((acc, e) => (e.kind === "rotate" && e.page === page ? acc + e.delta : acc), 0) % 360,
    [edits],
  );

  const loadBytes = useCallback(async (buf: ArrayBuffer, name: string, quiet = false) => {
    setBusy(true);
    try {
      const doc = await pdfjsLib.getDocument({ data: buf.slice(0), fontExtraProperties: true }).promise;
      docRef.current = doc;
      const infos: PageInfo[] = [];
      fontsRef.current = {};
      styleRef.current = {};
      for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i);
        const vp = page.getViewport({ scale: 1 });
        await page.getOperatorList(); // loads the PDF's own fonts
        const content = await page.getTextContent();
        const styles = content.styles as Record<string, { fontFamily?: string }>;
        for (const fontName of Object.keys(styles ?? {})) {
          const key = `${i}:${fontName}`;
          try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const obj: any = page.commonObjs.get(fontName);
            if (obj?.loadedName) {
              const realName = String(obj.name ?? obj.fallbackName ?? "");
              styleRef.current[key] = {
                bold: !!obj.bold || !!obj.black || /bold|black|heavy|semibold|demi/i.test(realName),
                italic: !!obj.italic || /italic|oblique/i.test(realName),
              };
            }
            if (obj?.data && obj?.loadedName) fontsRef.current[key] = { data: obj.data, css: obj.loadedName };
          } catch {
            /* font not embedded */
          }
        }
        const items: TextItem[] = [];
        for (const raw of content.items) {
          if (!("str" in raw) || !raw.str.trim()) continue;
          const tr = pdfjsLib.Util.transform(vp.transform, raw.transform);
          const h = Math.hypot(tr[2], tr[3]) || raw.height || 10;
          const fontName = raw.fontName ?? "";
            const own = fontsRef.current[`${i}:${fontName}`];
          const fallback = styles?.[fontName]?.fontFamily ?? "sans-serif";
          const fontFamily = own ? `"${own.css}", ${fallback}` : fallback;
          items.push({
            str: raw.str,
            x: tr[4],
            y: tr[5] - h * 0.85,
            w: raw.width || 1,
            h: h * 1.1,
            size: h,
            fontFamily,
            bold: !!styleRef.current[`${i}:${fontName}`]?.bold || /bold|black|heavy|semibold/i.test(fontName + fontFamily),
            italic: !!styleRef.current[`${i}:${fontName}`]?.italic || /italic|oblique/i.test(fontName + fontFamily),
            origBold: !!styleRef.current[`${i}:${fontName}`]?.bold || /bold|black|heavy|semibold/i.test(fontName + fontFamily),
            origItalic: !!styleRef.current[`${i}:${fontName}`]?.italic || /italic|oblique/i.test(fontName + fontFamily),
            fontKey: own ? `${i}:${fontName}` : undefined,
          });
        }
        infos.push({ index: i, width: vp.width, height: vp.height, items });
      }
      setBytes(buf);
      setFileName(name);
      setPages(infos);
      setEdits([]);
      setEditing(null);
      setEditingDraft("");
      setSelection(NO_SEL);
      setSelectedImage(null);
      if (!quiet) toast.success(`${name} loaded — ${infos.length} page(s)`);
    } catch {
      toast.error("Could not open that PDF file.");
    } finally {
      setBusy(false);
    }
  }, []);
  const loadFile = useCallback(
    async (file: File) => {
      history.current = [];
      fileHandleRef.current = null;
      await loadBytes(await file.arrayBuffer(), file.name);
      setCurrentPage(1);
      setPageInput("1");
    },
    [loadBytes],
  );

  // Render page canvases
  useEffect(() => {
    let cancelled = false;
    const doc = previewDoc;
    if (!doc) return;
    (async () => {
      for (const info of pages) {
        if (cancelled) return;
        const canvas = canvasRefs.current[info.index];
        if (!canvas) continue;
        const page = await doc.getPage(info.index);
        const vp = page.getViewport({ scale });
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) continue;
        const off = document.createElement("canvas");
        off.width = vp.width;
        off.height = vp.height;
        const octx = off.getContext("2d");
        if (!octx) continue;
        await page.render({ canvasContext: octx, viewport: vp }).promise;
        if (cancelled) return;
        canvas.width = vp.width;
        canvas.height = vp.height;
        ctx.drawImage(off, 0, 0);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pages, scale, previewDoc]);

  const sampleColor = useCallback(
    (page: number, box: Box): RGB => {
      const canvas = canvasRefs.current[page];
      const ctx = canvas?.getContext("2d", { willReadFrequently: true });
      if (!canvas || !ctx) return DEFAULT_COLOR;
      try {
        const x = Math.max(0, Math.floor(box.x * scale));
        const y = Math.max(0, Math.floor(box.y * scale));
        const w = Math.min(canvas.width - x, Math.ceil(box.w * scale)) || 1;
        const h = Math.min(canvas.height - y, Math.ceil(box.h * scale)) || 1;
        const data = ctx.getImageData(x, y, w, h).data;
        let best: RGB = DEFAULT_COLOR;
        let bestLum = 255;
        for (let i = 0; i < data.length; i += 4) {
          const [r, g, b] = [data[i]!, data[i + 1]!, data[i + 2]!];
          const lum = 0.299 * r + 0.587 * g + 0.114 * b;
          if (lum < bestLum) {
            bestLum = lum;
            best = { r: r / 255, g: g / 255, b: b / 255 };
          }
        }
        return bestLum < 230 ? best : DEFAULT_COLOR;
      } catch {
        return DEFAULT_COLOR;
      }
    },
    [scale],
  );

  const sampleBackground = useCallback(
    (page: number, box: Box): RGB => {
      const canvas = canvasRefs.current[page];
      const ctx = canvas?.getContext("2d", { willReadFrequently: true });
      if (!canvas || !ctx) return { r: 1, g: 1, b: 1 };
      try {
        const pad = Math.max(3, Math.round(4 * scale));
        const left = Math.max(0, Math.floor(box.x * scale) - pad);
        const top = Math.max(0, Math.floor(box.y * scale) - pad);
        const right = Math.min(canvas.width, Math.ceil((box.x + box.w) * scale) + pad);
        const bottom = Math.min(canvas.height, Math.ceil((box.y + box.h) * scale) + pad);
        const image = ctx.getImageData(left, top, Math.max(1, right - left), Math.max(1, bottom - top));
        const width = image.width;
        const height = image.height;
        const samples: Array<[number, number, number]> = [];
        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            const onBorder = x < pad || x >= width - pad || y < pad || y >= height - pad;
            if (!onBorder) continue;
            const offset = (y * width + x) * 4;
            samples.push([image.data[offset] ?? 255, image.data[offset + 1] ?? 255, image.data[offset + 2] ?? 255]);
          }
        }
        if (!samples.length) return { r: 1, g: 1, b: 1 };
        const median = (channel: 0 | 1 | 2) => {
          const values = samples.map((sample) => sample[channel]).sort((a, b) => a - b);
          return (values[Math.floor(values.length / 2)] ?? 255) / 255;
        };
        return { r: median(0), g: median(1), b: median(2) };
      } catch {
        return { r: 1, g: 1, b: 1 };
      }
    },
    [scale],
  );

  const detectBold = useCallback(
    (page: number, box: Box, size: number, bg: RGB): boolean => {
      const canvas = canvasRefs.current[page];
      const ctx = canvas?.getContext("2d", { willReadFrequently: true });
      if (!canvas || !ctx) return false;
      try {
        const x = Math.max(0, Math.floor(box.x * scale));
        const y = Math.max(0, Math.floor(box.y * scale));
        const w = Math.min(canvas.width - x, Math.ceil(box.w * scale));
        const h = Math.min(canvas.height - y, Math.ceil(box.h * scale));
        if (w < 2 || h < 2) return false;
        const d = ctx.getImageData(x, y, w, h).data;
        const br = bg.r * 255, bgG = bg.g * 255, bb = bg.b * 255;
        const ink = (i: number) => Math.abs(d[i]! - br) + Math.abs(d[i + 1]! - bgG) + Math.abs(d[i + 2]! - bb) > 180;
        // Average horizontal stroke width across all rows = stem thickness
        let runs = 0, total = 0;
        for (let row = 0; row < h; row++) {
          let len = 0;
          for (let col = 0; col < w; col++) {
            if (ink((row * w + col) * 4)) len++;
            else if (len) { runs++; total += len; len = 0; }
          }
          if (len) { runs++; total += len; }
        }
        if (runs < 6) return false;
        const stem = total / runs / (size * scale);
        return stem > 0.125;
      } catch {
        return false;
      }
    },
    [scale],
  );

  const deleteSelection = useCallback(() => {
    if (selection.ranges.length === 0) return;
    const info = pages.find((p) => p.index === selection.page);
    if (!info) return;
    // Erase exactly the selected characters. Whole runs get generous padding
    // (descenders, underlines, bullets); partial runs stay tight so the rest of
    // the line is kept intact.
    let allFull = true;
    const parts = selection.ranges.flatMap((r) => {
      const it = info.items[r.item];
      if (!it) return [];
      const full = r.start === 0 && r.end === it.str.length;
      if (!full) allFull = false;
      const b = rangeBox(it, r.start, r.end);
      const vp = Math.max(1.5, it.size * 0.25);
      const hp = full ? vp : 0.3;
      const box = { x: b.x - hp, y: b.y - vp, w: b.w + hp * 2, h: b.h + vp * 2 };
      return [{ box, background: sampleBackground(info.index, box) }];
    });
    const area = selection.area;
    if (area && allFull) {
      const selected = new Set(selection.ranges.map((r) => r.item));
      const clean = info.items.every((it, i) => selected.has(i) || !intersects(it, area));
      if (clean) parts.push({ box: area, background: sampleBackground(info.index, area) });
    }
    const [first, ...rest] = parts;
    if (!first) return;
    setEdits((e) => [...e, { kind: "erase", page: info.index, box: first.box, background: first.background, parts: rest }]);
    setSelection(NO_SEL);
  }, [selection, pages, sampleBackground]);

  const pointerPos = (ev: React.PointerEvent, el: HTMLElement) => {
    const rect = el.getBoundingClientRect();
    return { x: (ev.clientX - rect.left) / scale, y: (ev.clientY - rect.top) / scale };
  };

  const startEditing = (info: PageInfo, idx: number, range?: CharRange) => {
    const it = info.items[idx];
    if (!it) return;
    const s = range?.start ?? 0;
    const end = range?.end ?? it.str.length;
    const partial = s > 0 || end < it.str.length;
    const part = partial ? rangeBox(it, s, end) : it;
    const text = it.str.slice(s, end);
    const hp = partial ? 0.3 : 1;
    const box: Box = { x: part.x - hp, y: it.y - 1, w: part.w + hp * 2, h: it.h + 2 };
    const color = sampleColor(info.index, it);
    const background = sampleBackground(info.index, box);
    const isBold = it.bold || detectBold(info.index, it, it.size, background);
    setSelection(NO_SEL);
    setEdits((e) => {
      const next: Edit[] = [
        ...e,
        {
          kind: "text",
          page: info.index,
          x: part.x,
          y: it.y,
          size: it.size,
          value: text,
          fontFamily: it.fontFamily,
          bold: isBold,
          italic: it.italic,
          color,
          background,
          fontKey: it.fontKey,
          origBold: it.bold ? it.origBold : isBold ? false : it.origBold,
          origItalic: it.origItalic,
          cover: box,
          original: text,
          width: part.w,
        },
      ];
      setEditing(next.length - 1);
      setEditingDraft(text);
      return next;
    });
  };

  const commitEditing = useCallback(() => {
    if (editing === null) return;
    setEdits((all) =>
      all.map((item, index) =>
        index === editing && item.kind === "text" ? { ...item, value: editingDraft } : item,
      ),
    );
    setEditing(null);
  }, [editing, editingDraft]);

  const updateEditingStyle = (change: Partial<Extract<Edit, { kind: "text" }>>) => {
    if (editing === null) return;
    setEdits((all) =>
      all.map((item, index) => (index === editing && item.kind === "text" ? { ...item, ...change } : item)),
    );
  };

  const rangeAt = (info: PageInfo, p: { x: number; y: number }) =>
    selection.page === info.index
      ? selection.ranges.find((r) => {
          const it = info.items[r.item];
          return it ? intersects(rangeBox(it, r.start, r.end), { x: p.x, y: p.y, w: 0.5, h: 0.5 }) : false;
        })
      : undefined;

  const onPointerDown = (ev: React.PointerEvent, info: PageInfo) => {
    if (ev.button !== 0) return;
    setSelectedImage(null);
    const el = ev.currentTarget as HTMLElement;
    const p = pointerPos(ev, el);
    el.setPointerCapture(ev.pointerId);
    const next = { page: info.index, x0: p.x, y0: p.y, x1: p.x, y1: p.y };
    dragRef.current = next;
    setDrag(next);
  };

  const onPointerMove = (ev: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const p = pointerPos(ev, ev.currentTarget as HTMLElement);
    const next = { ...d, x1: p.x, y1: p.y };
    dragRef.current = next;
    setDrag(next);
  };

  const finishDrag = (ev: React.PointerEvent, info: PageInfo) => {
    const d = dragRef.current;
    const el = ev.currentTarget as HTMLElement;
    if (el.hasPointerCapture?.(ev.pointerId)) el.releasePointerCapture(ev.pointerId);
    dragRef.current = null;
    setDrag(null);
    if (!d || d.page !== info.index) return;
    const box: Box = {
      x: Math.min(d.x0, d.x1),
      y: Math.min(d.y0, d.y1),
      w: Math.abs(d.x1 - d.x0),
      h: Math.abs(d.y1 - d.y0),
    };
    if (box.w < 2 && box.h < 2) {
      // Clicking inside the current selection keeps it (so double-click can edit it)
      if (!rangeAt(info, { x: d.x1, y: d.y1 })) setSelection(NO_SEL);
      return;
    }
    const ranges = computeRanges(info, d);
    if (tool === "select") {
      if (ranges.length) {
        setSelection({ page: info.index, ranges, area: box });
      } else {
        // No text under the box: treat the drag as a whiteout area
        setSelection(NO_SEL);
        const background = sampleBackground(info.index, box);
        setEdits((e) => [...e, { kind: "erase", page: info.index, box, background }]);
      }
    } else if (tool === "highlight") {
      const boxes = ranges.length ? ranges.map((r) => rangeBox(info.items[r.item]!, r.start, r.end)) : [box];
      setEdits((e) => [...e, { kind: "highlight", page: info.index, box: boxes[0]!, parts: boxes.slice(1) }]);
    }
  };

  const onDoubleClick = (ev: React.MouseEvent, info: PageInfo) => {
    if (tool !== "select") return;
    dragRef.current = null;
    setDrag(null);
    const rect = (ev.currentTarget as HTMLElement).getBoundingClientRect();
    const p = { x: (ev.clientX - rect.left) / scale, y: (ev.clientY - rect.top) / scale };
    // Double-click on part of a line that is selected → edit just that part (split)
    const part = rangeAt(info, p);
    if (part && selection.ranges.length === 1) {
      const it = info.items[part.item];
      if (it && (part.start > 0 || part.end < it.str.length)) {
        startEditing(info, part.item, part);
        return;
      }
    }
    const hit = info.items.findIndex((it) => intersects(it, { x: p.x, y: p.y, w: 2, h: 2 }));
    if (hit < 0) return;
    // Re-open an existing edit of the same text instead of stacking a new one
    const it = info.items[hit]!;
    const existing = edits.findIndex(
      (e) => e.kind === "text" && e.page === info.index && e.cover && Math.abs(e.x - it.x) < 0.5 && Math.abs(e.y - it.y) < 0.5,
    );
    if (existing >= 0) {
      const edit = edits[existing];
      if (edit?.kind !== "text") return;
      setEditing(existing);
      setEditingDraft(edit.value);
    }
    else startEditing(info, hit);
  };

  const buildPdf = useCallback(async (src: ArrayBuffer, list: Edit[], preview: { editing: number | null } | null) => {
      const pdf = await PDFDocument.load(src.slice(0));
      pdf.registerFontkit(fontkit);
      const ownCache = new Map<string, Awaited<ReturnType<typeof pdf.embedFont>> | null>();
      const getOwnFont = async (key: string, text: string) => {
        if (!ownCache.has(key)) {
          const f = fontsRef.current[key];
          let emb: Awaited<ReturnType<typeof pdf.embedFont>> | null = null;
          if (f) {
            try {
              emb = await pdf.embedFont(f.data, { subset: false });
            } catch {
              emb = null;
            }
          }
          ownCache.set(key, emb);
        }
        const emb = ownCache.get(key);
        if (!emb) return null;
        try {
          const chars = new Set(emb.getCharacterSet());
          for (const ch of text) if (ch.trim() && !chars.has(ch.codePointAt(0)!)) return null;
          emb.encodeText(text);
          return emb;
        } catch {
          return null;
        }
      };
      const fontCache = new Map<string, Awaited<ReturnType<typeof pdf.embedFont>>>();
      const getFont = async (name: StandardFonts) => {
        const cached = fontCache.get(name);
        if (cached) return cached;
        const f = await pdf.embedFont(name);
        fontCache.set(name, f);
        return f;
      };
      for (let idx = 0; idx < list.length; idx++) {
        const e = list[idx]!;
        if (preview && (e.kind === "rotate" || e.kind === "removePage")) continue;
        const page = pdf.getPage(e.page - 1);
        const H = page.getSize().height;
        if (e.kind === "erase") {
          for (const part of [{ box: e.box, background: e.background }, ...(e.parts ?? [])]) {
            const bg = part.background;
            page.drawRectangle({ x: part.box.x, y: H - part.box.y - part.box.h, width: part.box.w, height: part.box.h, color: bg ? rgb(bg.r, bg.g, bg.b) : rgb(1, 1, 1) });
          }
        } else if (e.kind === "highlight") {
          for (const b of [e.box, ...(e.parts ?? [])]) {
            page.drawRectangle({ x: b.x, y: H - b.y - b.h, width: b.w, height: b.h, color: rgb(1, 0.92, 0.35), opacity: 0.4 });
          }
        } else if (e.kind === "image") {
          // Images are shown as a movable layer in the live preview
          if (preview) continue;
          const img = e.type === "jpg" ? await pdf.embedJpg(e.data) : await pdf.embedPng(e.data);
          page.drawImage(img, { x: e.box.x, y: H - e.box.y - e.box.h, width: e.box.w, height: e.box.h });
        } else if (e.kind === "text") {
          // Text edits stay as a DOM layer in the live preview. This keeps the
          // caret and edited text continuously visible while the canvas redraws.
          if (preview) continue;
          if (e.cover && e.value !== e.original) {
            page.drawRectangle({
              x: e.cover.x,
              y: H - e.cover.y - e.cover.h,
              width: e.cover.w,
              height: e.cover.h,
              color: rgb(e.background.r, e.background.g, e.background.b),
            });
          }
          if (e.cover && e.value === e.original) continue;
          if (!e.value) continue;
          const styleSame = !!e.origBold === e.bold && !!e.origItalic === e.italic;
          const font = (e.fontKey && styleSame && (await getOwnFont(e.fontKey, e.value))) || (await getFont(pickFont(e)));
          page.drawText(e.value, {
            x: e.x,
            y: H - e.y - e.size * 0.85,
            size: e.size,
            font,
            color: rgb(e.color.r, e.color.g, e.color.b),
          });
        } else if (e.kind === "rotate") {
          page.setRotation(degrees((page.getRotation().angle + e.delta) % 360));
        }
      }
      if (!preview) {
        const drop = [...new Set(list.filter((x) => x.kind === "removePage").map((x) => x.page))].sort((a, b) => b - a);
        for (const p of drop) pdf.removePage(p - 1);

      }
      return pdf.save();
    },
    []
  );

  // Live preview = the exact file that will be downloaded
  useEffect(() => {
    if (!bytes) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const hasPdfChanges = edits.some((e) => e.kind !== "rotate" && e.kind !== "removePage");
        const out = hasPdfChanges
          ? await buildPdf(bytes, edits, { editing })
          : new Uint8Array(bytes.slice(0));
        const doc = await pdfjsLib.getDocument({ data: out }).promise;
        if (!cancelled) setPreviewDoc(doc);
      } catch {
        /* keep previous preview */
      }
    }, 120);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [bytes, edits, editing, buildPdf]);


  const outputEdits = (): Edit[] =>
    editing !== null
      ? edits.map((x, i) => (i === editing && x.kind === "text" ? { ...x, value: editingDraft } : x))
      : edits;
    const applyAndClose = async () => {
    if (!bytes) return;
    setBusy(true);
    try {
      const out = await buildOutput();
      if (out && onApplyToTicket) {
        onApplyToTicket(out);
        toast.success("Applied edited PDF to ticket");
        onClose?.();
      }
    } catch (err) {
      toast.error("Failed to apply changes");
    } finally {
      setBusy(false);
    }
  };

  const buildOutput = async () => (bytes ? buildPdf(bytes, outputEdits(), null) : null);
  // Page number in the exported file (removed pages are dropped)
  const exportedIndex = (page: number) => pages.filter((p) => p.index <= page && !removed.has(p.index)).length;
  const baseName = (fileName ?? "document").replace(/\.pdf$/i, "");

  const run = async (label: string, fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } catch (err) {
      if ((err as { name?: string })?.name !== "AbortError") toast.error(`${label} failed. Try again.`);
    } finally {
      setBusy(false);
    }
  };

  const download = () =>
    run("Download", async () => {
      const out = await buildOutput();
      if (!out) return;
      saveBlob(out, `${baseName}-edited.pdf`);
      toast.success("Edited PDF downloaded");
    });

  const writeHandle = async (handle: any, out: Uint8Array) => {
    const writable = await handle.createWritable();
    await writable.write(out);
    await writable.close();
  };

  const saveAs = () =>
    run("Save as", async () => {
      const out = await buildOutput();
      if (!out) return;
      const picker = (window as any).showSaveFilePicker;
      if (picker) {
        try {
          const handle = await picker({
            suggestedName: `${baseName}.pdf`,
            types: [{ description: "PDF document", accept: { "application/pdf": [".pdf"] } }],
          });
          await writeHandle(handle, out);
          fileHandleRef.current = handle;
          setFileName(handle.name);
          toast.success(`Saved as ${handle.name}`);
          return;
        } catch (err) {
          if ((err as { name?: string })?.name === "AbortError") return;
        }
      }
      const name = window.prompt("Save as — file name", `${baseName}-edited.pdf`);
      if (!name) return;
      const finalName = /\.pdf$/i.test(name) ? name : `${name}.pdf`;
      saveBlob(out, finalName);
      setFileName(finalName);
      toast.success(`Saved as ${finalName}`);
    });

  const save = () => {
    if (!fileHandleRef.current) return saveAs();
    return run("Save", async () => {
      const out = await buildOutput();
      if (!out) return;
      await writeHandle(fileHandleRef.current, out);
      toast.success("Saved");
    });
  };

  const printPdf = (range: "all" | "current" | "custom" = "all", custom = "") =>
    run("Print", async () => {
      let out = await buildOutput();
      if (!out) return;
      const total = pages.length - removed.size;
      const wanted =
        range === "current" ? [exportedIndex(currentPage) - 1] : range === "custom" ? parsePageRange(custom, total) : null;
      if (wanted && !wanted.length) {
        toast.error("Enter valid pages, e.g. 1-3, 5");
        return;
      }
      if (wanted) {
        const src = await PDFDocument.load(out);
        const doc = await PDFDocument.create();
        (await doc.copyPages(src, wanted)).forEach((p) => doc.addPage(p));
        out = await doc.save();
      }
      const url = URL.createObjectURL(new Blob([out as BlobPart], { type: "application/pdf" }));
      const frame = document.createElement("iframe");
      frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
      frame.src = url;
      frame.onload = () =>
        setTimeout(() => {
          try {
            frame.contentWindow?.focus();
            frame.contentWindow?.print();
          } catch {
            window.open(url, "_blank");
          }
        }, 300);
      document.body.appendChild(frame);
      setTimeout(() => {
        frame.remove();
        URL.revokeObjectURL(url);
      }, 120000);
      setPrintOpen(false);
    });

  // Page structure changes: apply current edits, change the file, reload it.
  const restructure = (label: string, fn: (pdf: PDFDocument, at: number) => Promise<void> | void) =>
    run(label, async () => {
      if (!bytes) return;
      const out = await buildPdf(bytes, outputEdits(), null);
      const pdf = await PDFDocument.load(out);
      await fn(pdf, exportedIndex(currentPage));
      const saved = await pdf.save();
      history.current.push({ bytes, edits: outputEdits(), name: fileName ?? "document.pdf" });
      await loadBytes(saved.slice().buffer as ArrayBuffer, fileName ?? "document.pdf", true);
      toast.success(label);
    });

  const insertBlankPage = () =>
    restructure("Blank page inserted", (pdf, at) => {
      const ref = pdf.getPage(Math.max(0, Math.min(at, pdf.getPageCount()) - 1));
      const { width, height } = ref.getSize();
      pdf.insertPage(at, [width, height]);
    });

  const importPages = async (file: File) => {
    const buf = await file.arrayBuffer();
    await restructure(`Imported pages from ${file.name}`, async (pdf, at) => {
      const src = await PDFDocument.load(buf, { ignoreEncryption: true });
      const copied = await pdf.copyPages(src, src.getPageIndices());
      copied.forEach((p, i) => pdf.insertPage(at + i, p));
    });
  };

  const exportPage = () =>
    run("Export page", async () => {
      if (removed.has(currentPage)) {
        toast.error("This page is marked as deleted.");
        return;
      }
      const out = await buildOutput();
      if (!out) return;
      const src = await PDFDocument.load(out);
      const doc = await PDFDocument.create();
      const [p] = await doc.copyPages(src, [exportedIndex(currentPage) - 1]);
      if (p) doc.addPage(p);
      saveBlob(await doc.save(), `${baseName}-page-${currentPage}.pdf`);
      toast.success(`Page ${currentPage} exported`);
    });

  const toggleDeletePage = (page: number) =>
    setEdits((e) =>
      e.some((x) => x.kind === "removePage" && x.page === page)
        ? e.filter((x) => !(x.kind === "removePage" && x.page === page))
        : [...e, { kind: "removePage", page }],
    );

  const undo = async () => {
    if (edits.length) {
      setEdits((e) => e.slice(0, -1));
      return;
    }
    const prev = history.current.pop();
    if (!prev) return;
    await loadBytes(prev.bytes, prev.name, true);
    setEdits(prev.edits);
  };

  const addImage = async (file: File) => {
    const info = pages.find((p) => p.index === currentPage) ?? pages[0];
    if (!info) return;
    let blob: Blob = file;
    let type: "png" | "jpg" = file.type === "image/jpeg" ? "jpg" : "png";
    const url0 = URL.createObjectURL(file);
    const img = new Image();
    img.src = url0;
    await img.decode();
    if (file.type !== "image/jpeg" && file.type !== "image/png") {
      const c = document.createElement("canvas");
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      c.getContext("2d")?.drawImage(img, 0, 0);
      blob = await new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("png"))), "image/png"));
      type = "png";
    }
    URL.revokeObjectURL(url0);
    const data = new Uint8Array(await blob.arrayBuffer());
    const w = Math.min(info.width * 0.45, img.naturalWidth * 0.75);
    const h = (w * img.naturalHeight) / Math.max(1, img.naturalWidth);
    const box = { x: (info.width - w) / 2, y: Math.max(10, (info.height - h) / 3), w, h };
    const url = URL.createObjectURL(blob);
    setEdits((e) => {
      setSelectedImage(e.length);
      return [...e, { kind: "image", page: info.index, box, data, type, url }];
    });
    toast.success("Image added — drag to move, use the corner to resize");
  };

  const onImagePointerDown = (ev: React.PointerEvent, index: number, mode: "move" | "resize") => {
    ev.stopPropagation();
    ev.preventDefault();
    const e = edits[index];
    if (e?.kind !== "image") return;
    setSelectedImage(index);
    setSelection(NO_SEL);
    (ev.currentTarget as HTMLElement).setPointerCapture(ev.pointerId);
    imgDragRef.current = { index, mode, sx: ev.clientX, sy: ev.clientY, box: e.box };
  };
  const onImagePointerMove = (ev: React.PointerEvent) => {
    const d = imgDragRef.current;
    if (!d) return;
    const dx = (ev.clientX - d.sx) / scale;
    const dy = (ev.clientY - d.sy) / scale;
    const ratio = d.box.h / Math.max(1, d.box.w);
    const box =
      d.mode === "move"
        ? { ...d.box, x: d.box.x + dx, y: d.box.y + dy }
        : { ...d.box, w: Math.max(12, d.box.w + dx), h: Math.max(12, d.box.w + dx) * ratio };
    setEdits((all) => all.map((x, i) => (i === d.index && x.kind === "image" ? { ...x, box } : x)));
  };
  const onImagePointerUp = () => {
    imgDragRef.current = null;
  };

  const copySelection = () => {
    const info = pages.find((p) => p.index === selection.page);
    if (!info || !selection.ranges.length) return;
    const text = selection.ranges.map((r) => info.items[r.item]?.str.slice(r.start, r.end) ?? "").join(" ");
    void navigator.clipboard?.writeText(text);
    toast.success("Text copied");
  };

  const highlightSelection = () => {
    const info = pages.find((p) => p.index === selection.page);
    if (!info || !selection.ranges.length) return;
    const boxes = selection.ranges.map((r) => rangeBox(info.items[r.item]!, r.start, r.end));
    setEdits((e) => [...e, { kind: "highlight", page: info.index, box: boxes[0]!, parts: boxes.slice(1) }]);
    setSelection(NO_SEL);
  };

  // Keyboard shortcuts (latest handler via ref so the listener is attached once)
  const keyRef = useRef<(ev: KeyboardEvent) => void>(() => {});
  keyRef.current = (ev: KeyboardEvent) => {
    const target = ev.target as HTMLElement | null;
    const typing = target && (/input|textarea/i.test(target.tagName) || target.isContentEditable);
    const mod = ev.metaKey || ev.ctrlKey;
    const key = ev.key.toLowerCase();
    if (mod && key === "s") {
      ev.preventDefault();
      if (bytes) void (ev.shiftKey ? saveAs() : save());
      return;
    }
    if (mod && key === "p") {
      ev.preventDefault();
      if (bytes) void printPdf();
      return;
    }
    if (mod && (key === "=" || key === "+")) {
      ev.preventDefault();
      zoomTo(scale * 1.2);
      return;
    }
    if (mod && key === "-") {
      ev.preventDefault();
      zoomTo(scale / 1.2);
      return;
    }
    if (mod && key === "0") {
      ev.preventDefault();
      zoomTo(1);
      return;
    }
    if (typing) return;
    if (ev.key === "Delete" || ev.key === "Backspace") {
      ev.preventDefault();
      if (selectedImage !== null) {
        setEdits((all) => all.filter((_, i) => i !== selectedImage));
        setSelectedImage(null);
      } else deleteSelection();
    } else if (mod && key === "z") {
      ev.preventDefault();
      void undo();
    } else if (mod && key === "c" && selection.ranges.length) {
      ev.preventDefault();
      copySelection();
    } else if (ev.key === "Escape") {
      setSelection(NO_SEL);
      setSelectedImage(null);
    } else if (ev.key === "PageDown") {
      ev.preventDefault();
      goToPage(currentPage + 1);
    } else if (ev.key === "PageUp") {
      ev.preventDefault();
      goToPage(currentPage - 1);
    }
  };
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => keyRef.current(ev);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Ctrl/⌘ + wheel or trackpad pinch zooms around the cursor
  const wheelRef = useRef<(ev: WheelEvent) => void>(() => {});
  wheelRef.current = (ev: WheelEvent) => {
    if (!ev.ctrlKey && !ev.metaKey) return;
    ev.preventDefault();
    const dy = ev.deltaY * (ev.deltaMode === 1 ? 16 : ev.deltaMode === 2 ? 100 : 1);
    zoomTo(scale * Math.exp(-dy * 0.0025), ev.clientX, ev.clientY);
  };
  useEffect(() => {
    const el = workspaceRef.current;
    if (!el) return;
    const onWheel = (ev: WheelEvent) => wheelRef.current(ev);
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [bytes]);

  const onDrop = (ev: React.DragEvent) => {
    ev.preventDefault();
    const file = ev.dataTransfer.files[0];
    if (file) void loadFile(file);
  };

  const rgbCss = (c: RGB) => `rgb(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)})`;
  const menuBtn = (label: string) => (
    <Button type="button" size="sm" variant="ghost" className="h-8 px-2.5 font-medium">
      {label} <ChevronDown className="size-3 opacity-60" />
    </Button>
  );

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      <header className="z-30 shrink-0 border-b border-border bg-card shadow-sm">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5 sm:px-6">
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-muted-foreground">{portal}</p>
            <h1 className="truncate text-lg font-semibold text-foreground">PDF Editor</h1>
          </div>
          {fileName && <span className="hidden max-w-56 truncate text-sm text-muted-foreground md:block" title={fileName}>{fileName}</span>}
          <Button type="button" size="sm" variant="ghost" onClick={() => dropInputRef.current?.click()} title="Open PDF">
            <FileUp /> <span className="hidden sm:inline">Open</span>
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => void printPdf()} disabled={!bytes || busy} title="Print (Ctrl+P)">
            <Printer /> <span className="hidden sm:inline">Print</span>
          </Button>
          <Button type="button" size="sm" variant="secondary" onClick={() => void save()} disabled={!bytes || busy} title="Save (Ctrl+S)">
            <Save /> <span className="hidden sm:inline">Save</span>
          </Button>
          <Button type="button" size="sm" onClick={() => void download()} disabled={!bytes || busy} title="Download PDF">
            <Download /> <span className="hidden sm:inline">Download</span>
          </Button>

          {onApplyToTicket && (
            <Button
              type="button"
              size="sm"
              onClick={() => void applyAndClose()}
              disabled={!bytes || busy}
              className="bg-[#D97757] font-bold text-white hover:bg-[#c25e45]"
              title="Apply edits directly to ticket"
            >
              <Check className="size-4" /> <span className="hidden sm:inline">Apply to Ticket</span>
            </Button>
          )}

          {onClose && (
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="size-8 text-muted-foreground hover:text-foreground"
              onClick={onClose}
              title="Close Editor"
            >
              <CloseIcon className="size-4" />
            </Button>
          )}
        </div>
        <div className="flex items-center gap-0.5 overflow-x-auto px-4 pb-2 sm:px-6">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>{menuBtn("File")}</DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-60">
              <DropdownMenuItem onSelect={() => dropInputRef.current?.click()}><FileUp /> Open PDF…</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => void save()} disabled={!bytes || busy}><Save /> Save<DropdownMenuShortcut>Ctrl+S</DropdownMenuShortcut></DropdownMenuItem>
              <DropdownMenuItem onSelect={() => void saveAs()} disabled={!bytes || busy}><Save /> Save as…<DropdownMenuShortcut>Ctrl+⇧+S</DropdownMenuShortcut></DropdownMenuItem>
              <DropdownMenuItem onSelect={() => void download()} disabled={!bytes || busy}><Download /> Download PDF</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => void printPdf()} disabled={!bytes || busy}><Printer /> Print<DropdownMenuShortcut>Ctrl+P</DropdownMenuShortcut></DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setPrintOpen(true)} disabled={!bytes}><Settings2 /> Print setup…</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => importInputRef.current?.click()} disabled={!bytes || busy}><FileInput /> Import pages…</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => void exportPage()} disabled={!bytes || busy}><FileOutput /> Export current page</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>{menuBtn("Edit")}</DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuItem onSelect={() => void undo()} disabled={!edits.length && !history.current.length}><Undo2 /> Undo<DropdownMenuShortcut>Ctrl+Z</DropdownMenuShortcut></DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={copySelection} disabled={!selection.ranges.length}><Copy /> Copy text<DropdownMenuShortcut>Ctrl+C</DropdownMenuShortcut></DropdownMenuItem>
              <DropdownMenuItem onSelect={deleteSelection} disabled={!selection.ranges.length}><Trash2 /> Delete selection<DropdownMenuShortcut>Del</DropdownMenuShortcut></DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => setTool((t) => (t === "highlight" ? "select" : "highlight"))} disabled={!bytes}><Highlighter /> {tool === "highlight" ? "Stop highlighting" : "Highlight"}</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>{menuBtn("Insert")}</DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuItem onSelect={() => imageInputRef.current?.click()} disabled={!bytes}><ImagePlus /> Image…</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => void insertBlankPage()} disabled={!bytes || busy}><FilePlus2 /> Blank page after current</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => importInputRef.current?.click()} disabled={!bytes || busy}><FileInput /> Pages from another PDF…</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>{menuBtn("Page")}</DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuItem onSelect={() => setEdits((e) => [...e, { kind: "rotate", page: currentPage, delta: 90 }])} disabled={!bytes}><RotateCw /> Rotate page {currentPage}</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => toggleDeletePage(currentPage)} disabled={!bytes}><Trash2 /> {removed.has(currentPage) ? "Restore" : "Delete"} page {currentPage}</DropdownMenuItem>
              <DropdownMenuSeparator />
                            <DropdownMenuItem onSelect={() => zoomTo(scale * 1.2)}><ZoomIn /> Zoom in<DropdownMenuShortcut>Ctrl +</DropdownMenuShortcut></DropdownMenuItem>
              <DropdownMenuItem onSelect={() => zoomTo(scale / 1.2)}><ZoomOut /> Zoom out<DropdownMenuShortcut>Ctrl -</DropdownMenuShortcut></DropdownMenuItem>
              <DropdownMenuItem onSelect={fitWidth}>Fit width</DropdownMenuItem>
              <DropdownMenuItem onSelect={fitPage}>Fit page</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => zoomTo(1)}>Actual size<DropdownMenuShortcut>Ctrl 0</DropdownMenuShortcut></DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <span className="mx-2 h-5 w-px shrink-0 bg-border" />
          <Button type="button" size="sm" variant={tool === "highlight" ? "default" : "ghost"} className="h-8" onClick={() => setTool((t) => (t === "highlight" ? "select" : "highlight"))} disabled={!bytes} title="Highlight text">
            <Highlighter /> <span className="hidden sm:inline">Highlight</span>
          </Button>
          <Button type="button" size="sm" variant="ghost" className="h-8" onClick={() => imageInputRef.current?.click()} disabled={!bytes} title="Add image">
            <ImagePlus /> <span className="hidden sm:inline">Image</span>
          </Button>
          <Button type="button" size="sm" variant="ghost" className="h-8" onClick={() => void insertBlankPage()} disabled={!bytes || busy} title="Insert blank page">
            <FilePlus2 /> <span className="hidden md:inline">Insert page</span>
          </Button>
          <Button type="button" size="icon" variant="ghost" className="size-8" onClick={() => toggleDeletePage(currentPage)} disabled={!bytes} title={`Delete page ${currentPage}`} aria-label="Delete current page"><Trash2 /></Button>
          <Button type="button" size="icon" variant="ghost" className="size-8" onClick={() => void undo()} disabled={!edits.length && !history.current.length} title="Undo (Ctrl+Z)" aria-label="Undo"><Undo2 /></Button>
        </div>
      </header>

      <input ref={dropInputRef} type="file" accept="application/pdf" className="hidden" aria-label="Choose PDF" onChange={(e) => { const f = e.target.files?.[0]; if (f) void loadFile(f); e.target.value = ""; }} />
      <input ref={importInputRef} type="file" accept="application/pdf" className="hidden" aria-label="Import pages" onChange={(e) => { const f = e.target.files?.[0]; if (f) void importPages(f); e.target.value = ""; }} />
      <input ref={imageInputRef} type="file" accept="image/*" className="hidden" aria-label="Add image" onChange={(e) => { const f = e.target.files?.[0]; if (f) void addImage(f).catch(() => toast.error("Could not add that image.")); e.target.value = ""; }} />

      <main ref={workspaceRef} onScroll={onWorkspaceScroll} className="min-h-0 flex-1 overflow-auto bg-muted">
        {!bytes ? (
          <div className="mx-auto max-w-5xl px-4 pt-8 sm:px-6">
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={onDrop}
              onClick={() => dropInputRef.current?.click()}
              className="flex min-h-[55vh] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-card p-12 text-center transition-colors hover:border-primary"
            >
              <FileUp className="size-10 text-primary" />
              <h2 className="mt-4 text-lg font-semibold">Drop a PDF here, or click to choose a file</h2>
              <p className="mt-2 max-w-md text-sm text-muted-foreground">
                Drag across text to select it — even a single letter — and press Delete to remove it. Double-click text to
                edit it in place. Ctrl + mouse wheel zooms around your cursor.
              </p>
            </div>
          </div>
        ) : (
          <div ref={pagesRef} className="mx-auto flex w-max min-w-full flex-col items-center gap-6 px-6 pb-32 pt-6">
            {pages.map((info) => {
              const isRemoved = removed.has(info.index);
              const rot = rotationOf(info.index);
              const live = drag && drag.page === info.index ? computeRanges(info, drag) : null;
              const shown = live ?? (selection.page === info.index ? selection.ranges : []);
              const firstSel = shown[0] && info.items[shown[0].item] ? rangeBox(info.items[shown[0].item]!, shown[0].start, shown[0].end) : null;
              return (
                <div
                  key={info.index}
                  ref={(el) => {
                    pageRefs.current[info.index] = el;
                  }}
                  className="flex scroll-mt-4 flex-col items-center gap-1.5"
                >
                  <div className="flex w-full items-center justify-between gap-2 text-xs text-muted-foreground" style={{ width: info.width * scale }}>
                    <span className={info.index === currentPage ? "font-semibold text-foreground" : ""}>
                      Page {info.index} of {pages.length}{isRemoved ? " · will be deleted" : ""}
                    </span>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button type="button" size="icon" variant="ghost" className="size-7" title={`Page ${info.index} options`} aria-label={`Page ${info.index} options`}><MoreHorizontal /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => setEdits((e) => [...e, { kind: "rotate", page: info.index, delta: 90 }])}><RotateCw /> Rotate clockwise</DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => { setCurrentPage(info.index); setTimeout(() => void insertBlankPage(), 0); }}><FilePlus2 /> Insert blank page after</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onSelect={() => toggleDeletePage(info.index)}><Trash2 /> {isRemoved ? "Restore page" : "Delete page"}</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <div
                    className={`relative touch-none select-none bg-card shadow-[0_2px_12px_rgba(20,20,19,0.18)] transition-opacity ${isRemoved ? "opacity-25" : ""}`}
                    style={{
                      width: info.width * scale,
                      height: info.height * scale,
                      transform: `rotate(${rot}deg)`,
                      cursor: tool === "highlight" ? "crosshair" : "text",
                    }}
                    onPointerDown={(e) => onPointerDown(e, info)}
                    onPointerMove={onPointerMove}
                    onPointerUp={(e) => finishDrag(e, info)}
                    onPointerCancel={(e) => finishDrag(e, info)}
                    onDoubleClick={(e) => onDoubleClick(e, info)}
                  >
                    <canvas
                      ref={(el) => {
                        canvasRefs.current[info.index] = el;
                      }}
                      className="absolute inset-0 h-full w-full"
                    />
                    {edits.map((e, i) => {
                      if (e.page !== info.index) return null;
                      if (e.kind === "image") {
                        const active = selectedImage === i;
                        return (
                          <div
                            key={i}
                            className={`absolute cursor-move ${active ? "outline outline-2 outline-primary" : "hover:outline hover:outline-1 hover:outline-primary/60"}`}
                            style={{ left: e.box.x * scale, top: e.box.y * scale, width: e.box.w * scale, height: e.box.h * scale }}
                            onPointerDown={(ev) => onImagePointerDown(ev, i, "move")}
                            onPointerMove={onImagePointerMove}
                            onPointerUp={onImagePointerUp}
                            onDoubleClick={(ev) => ev.stopPropagation()}
                          >
                            <img src={e.url} alt="" draggable={false} className="pointer-events-none h-full w-full select-none" />
                            {active && (
                              <>
                                <div
                                  className="absolute -bottom-1.5 -right-1.5 size-3 cursor-nwse-resize rounded-sm border-2 border-primary bg-card"
                                  onPointerDown={(ev) => onImagePointerDown(ev, i, "resize")}
                                  onPointerMove={onImagePointerMove}
                                  onPointerUp={onImagePointerUp}
                                />
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="secondary"
                                  className="absolute -top-9 right-0 size-7"
                                  title="Remove image"
                                  onPointerDown={(ev) => ev.stopPropagation()}
                                  onClick={() => { setEdits((all) => all.filter((_, k) => k !== i)); setSelectedImage(null); }}
                                >
                                  <Trash2 className="size-3.5" />
                                </Button>
                              </>
                            )}
                          </div>
                        );
                      }
                      if (e.kind !== "text") return null;
                      const css = {
                        left: e.x * scale,
                        top: e.y * scale,
                        fontSize: e.size * scale,
                        fontFamily: e.fontFamily,
                        fontWeight: e.bold ? 700 : 400,
                        fontStyle: e.italic ? "italic" : "normal",
                        color: rgbCss(e.color),
                        lineHeight: `${e.size * scale * 1.1}px`,
                      } as const;
                      const value = editing === i ? editingDraft : e.value;
                      const changed = !e.cover || value !== e.original;
                      const cover = e.cover && (editing === i || changed) ? (
                        <div
                          className="pointer-events-none absolute"
                          style={{
                            left: e.cover.x * scale,
                            top: e.cover.y * scale,
                            width: e.cover.w * scale,
                            height: e.cover.h * scale,
                            backgroundColor: rgbCss(e.background),
                          }}
                        />
                      ) : null;
                      if (editing === i) {
                        return (
                          <div key={i} className="contents">
                            {cover}
                            <div
                              className="absolute z-20 flex items-center gap-0.5 rounded-md border border-border bg-card p-1 shadow-lg"
                              style={{ left: e.x * scale, top: Math.max(4, e.y * scale - 42) }}
                              onPointerDown={(ev) => { ev.preventDefault(); ev.stopPropagation(); }}
                            >
                              <Button type="button" size="icon" variant={e.bold ? "default" : "ghost"} className="size-7" title="Bold" onClick={() => updateEditingStyle({ bold: !e.bold })}><Bold className="size-3.5" /></Button>
                              <Button type="button" size="icon" variant={e.italic ? "default" : "ghost"} className="size-7" title="Italic" onClick={() => updateEditingStyle({ italic: !e.italic })}><Italic className="size-3.5" /></Button>
                              <span className="mx-1 h-5 w-px bg-border" />
                              <Button type="button" size="icon" variant="ghost" className="size-7" title="Decrease text size" onClick={() => updateEditingStyle({ size: Math.max(6, e.size - 1) })}><Minus className="size-3.5" /></Button>
                              <span className="min-w-7 text-center text-xs font-medium tabular-nums">{Math.round(e.size)}</span>
                              <Button type="button" size="icon" variant="ghost" className="size-7" title="Increase text size" onClick={() => updateEditingStyle({ size: Math.min(96, e.size + 1) })}><Plus className="size-3.5" /></Button>
                              <span className="mx-1 h-5 w-px bg-border" />
                              <Button type="button" size="icon" variant="ghost" className="size-7" title="Apply text change" onClick={commitEditing}><Check className="size-3.5" /></Button>
                            </div>
                            <input
                              autoFocus
                              value={editingDraft}
                              onFocus={(ev) => {
                                const end = ev.currentTarget.value.length;
                                ev.currentTarget.setSelectionRange(end, end);
                              }}
                              onPointerDown={(ev) => ev.stopPropagation()}
                              onDoubleClick={(ev) => ev.stopPropagation()}
                              onChange={(ev) => setEditingDraft(ev.target.value)}
                              onBlur={commitEditing}
                              onKeyDown={(ev) => {
                                if (ev.key === "Enter") commitEditing();
                                if (ev.key === "Escape") {
                                  setEditingDraft(e.value);
                                  setEditing(null);
                                }
                                ev.stopPropagation();
                              }}
                              size={Math.max(1, editingDraft.length)}
                              aria-label="Edit PDF text"
                              className="absolute z-10 m-0 border-0 bg-transparent p-0 caret-primary outline-none selection:bg-primary/25"
                              style={{
                                ...css,
                                top: e.y * scale,
                                height: e.size * scale * 1.1,
                                width: Math.max((e.width ?? 20) * scale, editingDraft.length * e.size * scale * 0.62) + 8,
                              }}
                            />
                          </div>
                        );
                      }
                      if (!changed) return null;
                      return (
                        <div key={i} className="contents">
                          {cover}
                          <span className="pointer-events-none absolute whitespace-pre" style={css}>
                            {e.value}
                          </span>
                        </div>
                      );
                    })}
                    {shown.map((r) => {
                      const it = info.items[r.item];
                      if (!it) return null;
                      const b = rangeBox(it, r.start, r.end);
                      return (
                        <div
                          key={`${r.item}-${r.start}`}
                          className="pointer-events-none absolute rounded-[1px] bg-primary/30 mix-blend-multiply"
                          style={{ left: b.x * scale, top: b.y * scale, width: b.w * scale, height: b.h * scale }}
                        />
                      );
                    })}
                    {drag && drag.page === info.index && !live?.length && (
                      <div
                        className="pointer-events-none absolute border border-dashed border-primary bg-primary/5"
                        style={{
                          left: Math.min(drag.x0, drag.x1) * scale,
                          top: Math.min(drag.y0, drag.y1) * scale,
                          width: Math.abs(drag.x1 - drag.x0) * scale,
                          height: Math.abs(drag.y1 - drag.y0) * scale,
                        }}
                      />
                    )}
                    {!drag && firstSel && editing === null && selection.page === info.index && (
                      <div
                        className="absolute z-20 flex items-center gap-0.5 rounded-md border border-border bg-secondary p-1 text-secondary-foreground shadow-lg"
                        style={{ left: firstSel.x * scale, top: Math.max(4, firstSel.y * scale - 44) }}
                        onPointerDown={(ev) => { ev.preventDefault(); ev.stopPropagation(); }}
                        onDoubleClick={(ev) => ev.stopPropagation()}
                      >
                        {selection.ranges.length === 1 && (
                          <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-secondary-foreground hover:bg-primary hover:text-primary-foreground" title="Edit selected text" onClick={() => { const r = selection.ranges[0]!; startEditing(info, r.item, r); }}>
                            <Pencil className="size-3.5" /> Edit
                          </Button>
                        )}
                        <Button type="button" size="icon" variant="ghost" className="size-7 text-secondary-foreground hover:bg-primary hover:text-primary-foreground" title="Highlight" onClick={highlightSelection}><Highlighter className="size-3.5" /></Button>
                        <Button type="button" size="icon" variant="ghost" className="size-7 text-secondary-foreground hover:bg-primary hover:text-primary-foreground" title="Copy (Ctrl+C)" onClick={copySelection}><Copy className="size-3.5" /></Button>
                        <Button type="button" size="icon" variant="ghost" className="size-7 text-secondary-foreground hover:bg-destructive hover:text-destructive-foreground" title="Delete (Del)" onClick={deleteSelection}><Trash2 className="size-3.5" /></Button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {bytes && (
        <div className="fixed bottom-4 left-1/2 z-30 flex w-[min(96vw,640px)] -translate-x-1/2 items-center gap-1.5 rounded-lg border border-border bg-card px-2 py-1.5 shadow-lg sm:bottom-6" role="group" aria-label="Page and zoom controls">
          <Button type="button" size="icon" variant="ghost" className="size-8 shrink-0" onClick={() => goToPage(currentPage - 1)} disabled={currentPage <= 1} title="Previous page (PgUp)" aria-label="Previous page"><ChevronLeft /></Button>
          <form className="flex shrink-0 items-center gap-1 text-sm tabular-nums" onSubmit={(ev) => { ev.preventDefault(); goToPage(Number(pageInput) || 1); }}>
            <Input value={pageInput} onChange={(ev) => setPageInput(ev.target.value.replace(/\D/g, ""))} onBlur={() => goToPage(Number(pageInput) || currentPage)} className="h-8 w-11 px-1 text-center" aria-label="Page number" />
            <span className="text-muted-foreground">/ {pages.length}</span>
          </form>
          <Button type="button" size="icon" variant="ghost" className="size-8 shrink-0" onClick={() => goToPage(currentPage + 1)} disabled={currentPage >= pages.length} title="Next page (PgDn)" aria-label="Next page"><ChevronRight /></Button>
          <span className="mx-1 h-5 w-px shrink-0 bg-border" />
          <Button type="button" size="icon" variant="ghost" className="size-8 shrink-0" onClick={() => zoomTo(scale / 1.2)} disabled={scale <= 0.25} title="Zoom out" aria-label="Zoom out"><ZoomOut /></Button>
          <Slider className="min-w-0 flex-1" min={25} max={400} step={5} value={[Math.round(scale * 100)]} onValueChange={([value]) => { if (value != null) zoomTo(value / 100); }} aria-label="Zoom level" />
          <Button type="button" size="icon" variant="ghost" className="size-8 shrink-0" onClick={() => zoomTo(scale * 1.2)} disabled={scale >= 4} title="Zoom in" aria-label="Zoom in"><ZoomIn /></Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button type="button" size="sm" variant="ghost" className="min-w-[4.5rem] shrink-0 tabular-nums" aria-label="Zoom presets">{Math.round(scale * 100)}% <ChevronDown className="size-3" /></Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={fitWidth}>Fit width</DropdownMenuItem>
              <DropdownMenuItem onSelect={fitPage}>Fit page</DropdownMenuItem>
              <DropdownMenuSeparator />
              {[50, 75, 100, 125, 150, 200, 300, 400].map((value) => <DropdownMenuItem key={value} onSelect={() => zoomTo(value / 100)}>{value}%</DropdownMenuItem>)}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      <Dialog open={printOpen} onOpenChange={setPrintOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Print setup</DialogTitle>
            <DialogDescription>Choose which pages to print. Paper size, orientation, copies and printer are set in the next step.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2 text-sm">
            {([
              ["all", `All pages (${pages.length - removed.size})`],
              ["current", `Current page (${currentPage})`],
              ["custom", "Custom range"],
            ] as const).map(([value, label]) => (
              <label key={value} className="flex cursor-pointer items-center gap-2">
                <input type="radio" name="print-range" className="accent-primary" checked={printRange === value} onChange={() => setPrintRange(value)} />
                {label}
              </label>
            ))}
            {printRange === "custom" && (
              <Input autoFocus placeholder="e.g. 1-3, 5" value={printCustom} onChange={(ev) => setPrintCustom(ev.target.value)} aria-label="Pages to print" />
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setPrintOpen(false)}>Cancel</Button>
            <Button type="button" onClick={() => void printPdf(printRange, printCustom)} disabled={busy}><Printer /> Print</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
