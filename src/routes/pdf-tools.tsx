import { createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { PDFDocument, degrees, rgb, StandardFonts } from "pdf-lib";
import {
  FileStack, Scissors, Trash2, RotateCw, Hash, Droplets, Shrink, PenSquare, LogOut,
  Upload, Download, ArrowLeft, Loader2, GripVertical, X, CheckCircle2,
} from "lucide-react";
import { checkAdminUnlocked, adminLogout } from "@/lib/fares.functions";
import { AgentTopBar } from "@/components/AgentTopBar";
import { AdminTabs } from "@/components/AdminTabs";
import { AdminHeaderExtras } from "@/components/AdminHeaderExtras";
import { SejdaEditor } from "@/components/PDFEditor/SejdaEditor";

export const Route = createFileRoute("/pdf-tools")({
  head: () => ({
    meta: [
      { title: "PDF Tools — Rohi International Travels" },
      { name: "description", content: "Merge, split, rotate, watermark, and edit PDFs — all processed in your browser." },
      { name: "robots", content: "noindex" },
    ],
  }),
  validateSearch: (search: Record<string, unknown>) => ({
    portal: search.portal === "agent" ? ("agent" as const) : undefined,
  }),
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
  component: PDFToolsPage,
});

type ToolId = "merge" | "extract" | "delete" | "rotate" | "pagenumbers" | "watermark" | "compress" | "edit";

const TOOLS: { id: ToolId; label: string; desc: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "merge", label: "Merge PDFs", desc: "Combine two or more PDFs into one file, in the order you choose.", icon: FileStack },
  { id: "extract", label: "Extract / Split Pages", desc: "Pull a page range (e.g. 1-3, 5) out of a PDF into a new file.", icon: Scissors },
  { id: "delete", label: "Delete Pages", desc: "Remove specific pages from a PDF.", icon: Trash2 },
  { id: "rotate", label: "Rotate Pages", desc: "Rotate every page 90°, 180°, or 270°.", icon: RotateCw },
  { id: "pagenumbers", label: "Add Page Numbers", desc: "Stamp page numbers onto every page.", icon: Hash },
  { id: "watermark", label: "Add Watermark", desc: "Stamp a diagonal text watermark across every page.", icon: Droplets },
  { id: "compress", label: "Compress PDF", desc: "Re-save with optimized structure to shave off file size.", icon: Shrink },
  { id: "edit", label: "Edit PDF", desc: "Add text, whiteout, shapes, stamps, and signatures to a document.", icon: PenSquare },
];

function downloadBytes(bytes: Uint8Array, filename: string) {
  const blob = new Blob([bytes as unknown as BlobPart], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function parsePageRanges(input: string, pageCount: number): number[] {
  const indices = new Set<number>();
  for (const part of input.split(",").map((p) => p.trim()).filter(Boolean)) {
    const m = part.match(/^(\d+)\s*-\s*(\d+)$/);
    if (m) {
      const start = Math.max(1, parseInt(m[1], 10));
      const end = Math.min(pageCount, parseInt(m[2], 10));
      for (let i = start; i <= end; i++) indices.add(i - 1);
    } else {
      const n = parseInt(part, 10);
      if (!isNaN(n) && n >= 1 && n <= pageCount) indices.add(n - 1);
    }
  }
  return Array.from(indices).sort((a, b) => a - b);
}

function UploadDrop({ multiple, onFiles, accept = "application/pdf" }: { multiple?: boolean; onFiles: (files: File[]) => void; accept?: string }) {
  const [dragOver, setDragOver] = useState(false);
  return (
    <label
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        onFiles(Array.from(e.dataTransfer.files).filter((f) => f.type === "application/pdf"));
      }}
      className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-10 text-center transition-colors ${
        dragOver ? "border-gold bg-gold/5" : "border-border bg-muted/30 hover:border-gold/50"
      }`}
    >
      <Upload className="h-8 w-8 text-muted-foreground" />
      <p className="text-sm font-semibold text-foreground">Drop {multiple ? "PDFs" : "a PDF"} here, or click to browse</p>
      <p className="text-xs text-muted-foreground">Files are processed entirely in your browser — nothing is uploaded to a server.</p>
      <input
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        onChange={(e) => onFiles(Array.from(e.target.files ?? []))}
      />
    </label>
  );
}

function ToolShell({ tool, onBack, children }: { tool: (typeof TOOLS)[number]; onBack: () => void; children: React.ReactNode }) {
  const Icon = tool.icon;
  return (
    <div className="mx-auto max-w-3xl">
      <button onClick={onBack} className="mb-5 inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> All tools
      </button>
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gold/15 text-gold"><Icon className="h-6 w-6" /></div>
        <div>
          <h1 className="font-sans text-2xl font-black text-navy">{tool.label}</h1>
          <p className="text-sm text-muted-foreground">{tool.desc}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

function ProcessButton({ onClick, disabled, busy, label = "Process & Download" }: { onClick: () => void; disabled?: boolean; busy?: boolean; label?: string }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || busy}
      className="mt-5 inline-flex items-center gap-2 rounded-lg bg-gold px-5 py-3 text-sm font-bold text-gold-foreground shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
      {busy ? "Processing…" : label}
    </button>
  );
}

function FileChip({ name, onRemove }: { name: string; onRemove?: () => void }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-xs font-medium text-foreground">
      {name}
      {onRemove && <button onClick={onRemove}><X className="h-3 w-3 text-muted-foreground hover:text-foreground" /></button>}
    </span>
  );
}

/* ---------- Merge ---------- */
function MergeTool({ onBack }: { onBack: () => void }) {
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const move = (from: number, to: number) => {
    setFiles((f) => {
      const next = [...f];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  };
  const run = async () => {
    setBusy(true);
    try {
      const merged = await PDFDocument.create();
      for (const file of files) {
        const src = await PDFDocument.load(await file.arrayBuffer());
        const pages = await merged.copyPages(src, src.getPageIndices());
        pages.forEach((p) => merged.addPage(p));
      }
      downloadBytes(await merged.save(), "merged.pdf");
    } finally {
      setBusy(false);
    }
  };
  return (
    <ToolShell tool={TOOLS[0]} onBack={onBack}>
      <UploadDrop multiple onFiles={(f) => setFiles((prev) => [...prev, ...f])} />
      {files.length > 0 && (
        <div className="mt-4 space-y-1.5">
          {files.map((f, i) => (
            <div key={i} className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2">
              <GripVertical className="h-4 w-4 text-muted-foreground" />
              <span className="flex-1 truncate text-sm">{i + 1}. {f.name}</span>
              <button disabled={i === 0} onClick={() => move(i, i - 1)} className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-30">↑</button>
              <button disabled={i === files.length - 1} onClick={() => move(i, i + 1)} className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-30">↓</button>
              <button onClick={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))}><X className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" /></button>
            </div>
          ))}
        </div>
      )}
      <ProcessButton onClick={run} disabled={files.length < 2} busy={busy} label={`Merge ${files.length || ""} PDFs`} />
    </ToolShell>
  );
}

/* ---------- Extract / Split ---------- */
function ExtractTool({ onBack }: { onBack: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [range, setRange] = useState("");
  const [busy, setBusy] = useState(false);
  const onFiles = async (files: File[]) => {
    const f = files[0];
    if (!f) return;
    setFile(f);
    const doc = await PDFDocument.load(await f.arrayBuffer());
    setPageCount(doc.getPageCount());
  };
  const run = async () => {
    if (!file) return;
    setBusy(true);
    try {
      const src = await PDFDocument.load(await file.arrayBuffer());
      const indices = parsePageRanges(range, src.getPageCount());
      const out = await PDFDocument.create();
      const pages = await out.copyPages(src, indices);
      pages.forEach((p) => out.addPage(p));
      downloadBytes(await out.save(), "extracted.pdf");
    } finally {
      setBusy(false);
    }
  };
  return (
    <ToolShell tool={TOOLS[1]} onBack={onBack}>
      {!file ? (
        <UploadDrop onFiles={onFiles} />
      ) : (
        <div className="space-y-4">
          <FileChip name={`${file.name} (${pageCount} pages)`} onRemove={() => { setFile(null); setRange(""); }} />
          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-muted-foreground">Pages to extract</label>
            <input
              value={range}
              onChange={(e) => setRange(e.target.value)}
              placeholder="e.g. 1-3, 5, 8-10"
              className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gold/30"
            />
          </div>
          <ProcessButton onClick={run} disabled={!range.trim()} busy={busy} label="Extract & Download" />
        </div>
      )}
    </ToolShell>
  );
}

/* ---------- Delete Pages ---------- */
function DeleteTool({ onBack }: { onBack: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [range, setRange] = useState("");
  const [busy, setBusy] = useState(false);
  const onFiles = async (files: File[]) => {
    const f = files[0];
    if (!f) return;
    setFile(f);
    const doc = await PDFDocument.load(await f.arrayBuffer());
    setPageCount(doc.getPageCount());
  };
  const run = async () => {
    if (!file) return;
    setBusy(true);
    try {
      const doc = await PDFDocument.load(await file.arrayBuffer());
      const toRemove = new Set(parsePageRanges(range, doc.getPageCount()));
      Array.from(toRemove).sort((a, b) => b - a).forEach((i) => doc.removePage(i));
      downloadBytes(await doc.save(), "pages-removed.pdf");
    } finally {
      setBusy(false);
    }
  };
  return (
    <ToolShell tool={TOOLS[2]} onBack={onBack}>
      {!file ? (
        <UploadDrop onFiles={onFiles} />
      ) : (
        <div className="space-y-4">
          <FileChip name={`${file.name} (${pageCount} pages)`} onRemove={() => { setFile(null); setRange(""); }} />
          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-muted-foreground">Pages to delete</label>
            <input
              value={range}
              onChange={(e) => setRange(e.target.value)}
              placeholder="e.g. 2, 4-6"
              className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gold/30"
            />
          </div>
          <ProcessButton onClick={run} disabled={!range.trim()} busy={busy} label="Delete & Download" />
        </div>
      )}
    </ToolShell>
  );
}

/* ---------- Rotate ---------- */
function RotateTool({ onBack }: { onBack: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [angle, setAngle] = useState(90);
  const [busy, setBusy] = useState(false);
  const run = async () => {
    if (!file) return;
    setBusy(true);
    try {
      const doc = await PDFDocument.load(await file.arrayBuffer());
      doc.getPages().forEach((page) => {
        page.setRotation(degrees((page.getRotation().angle + angle) % 360));
      });
      downloadBytes(await doc.save(), "rotated.pdf");
    } finally {
      setBusy(false);
    }
  };
  return (
    <ToolShell tool={TOOLS[3]} onBack={onBack}>
      {!file ? (
        <UploadDrop onFiles={(f) => setFile(f[0] ?? null)} />
      ) : (
        <div className="space-y-4">
          <FileChip name={file.name} onRemove={() => setFile(null)} />
          <div className="flex gap-2">
            {[90, 180, 270].map((a) => (
              <button
                key={a}
                onClick={() => setAngle(a)}
                className={`rounded-lg border px-4 py-2 text-sm font-semibold ${angle === a ? "border-gold bg-gold/10 text-navy" : "border-border text-muted-foreground hover:border-gold/40"}`}
              >
                {a}°
              </button>
            ))}
          </div>
          <ProcessButton onClick={run} busy={busy} label="Rotate & Download" />
        </div>
      )}
    </ToolShell>
  );
}

/* ---------- Page Numbers ---------- */
function PageNumbersTool({ onBack }: { onBack: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const run = async () => {
    if (!file) return;
    setBusy(true);
    try {
      const doc = await PDFDocument.load(await file.arrayBuffer());
      const font = await doc.embedFont(StandardFonts.Helvetica);
      const pages = doc.getPages();
      pages.forEach((page, i) => {
        const { width } = page.getSize();
        const text = `${i + 1} / ${pages.length}`;
        page.drawText(text, {
          x: width / 2 - font.widthOfTextAtSize(text, 10) / 2,
          y: 18,
          size: 10,
          font,
          color: rgb(0.35, 0.35, 0.35),
        });
      });
      downloadBytes(await doc.save(), "numbered.pdf");
    } finally {
      setBusy(false);
    }
  };
  return (
    <ToolShell tool={TOOLS[4]} onBack={onBack}>
      {!file ? (
        <UploadDrop onFiles={(f) => setFile(f[0] ?? null)} />
      ) : (
        <div className="space-y-4">
          <FileChip name={file.name} onRemove={() => setFile(null)} />
          <p className="text-xs text-muted-foreground">Adds "Page X / N" centered at the bottom of every page.</p>
          <ProcessButton onClick={run} busy={busy} label="Add Numbers & Download" />
        </div>
      )}
    </ToolShell>
  );
}

/* ---------- Watermark ---------- */
function WatermarkTool({ onBack }: { onBack: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState("ROHI INTERNATIONAL TRAVELS");
  const [busy, setBusy] = useState(false);
  const run = async () => {
    if (!file || !text.trim()) return;
    setBusy(true);
    try {
      const doc = await PDFDocument.load(await file.arrayBuffer());
      const font = await doc.embedFont(StandardFonts.HelveticaBold);
      doc.getPages().forEach((page) => {
        const { width, height } = page.getSize();
        const size = 36;
        const textWidth = font.widthOfTextAtSize(text, size);
        page.drawText(text, {
          x: width / 2 - textWidth / 2,
          y: height / 2,
          size,
          font,
          color: rgb(0.85, 0.45, 0.35),
          opacity: 0.25,
          rotate: degrees(45),
        });
      });
      downloadBytes(await doc.save(), "watermarked.pdf");
    } finally {
      setBusy(false);
    }
  };
  return (
    <ToolShell tool={TOOLS[5]} onBack={onBack}>
      {!file ? (
        <UploadDrop onFiles={(f) => setFile(f[0] ?? null)} />
      ) : (
        <div className="space-y-4">
          <FileChip name={file.name} onRemove={() => setFile(null)} />
          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-muted-foreground">Watermark text</label>
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gold/30"
            />
          </div>
          <ProcessButton onClick={run} disabled={!text.trim()} busy={busy} label="Add Watermark & Download" />
        </div>
      )}
    </ToolShell>
  );
}

/* ---------- Compress ---------- */
function CompressTool({ onBack }: { onBack: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [before, setBefore] = useState(0);
  const [busy, setBusy] = useState(false);
  const onFiles = (files: File[]) => {
    const f = files[0];
    if (f) { setFile(f); setBefore(f.size); }
  };
  const run = async () => {
    if (!file) return;
    setBusy(true);
    try {
      const doc = await PDFDocument.load(await file.arrayBuffer());
      const bytes = await doc.save({ useObjectStreams: true });
      downloadBytes(bytes, "compressed.pdf");
    } finally {
      setBusy(false);
    }
  };
  return (
    <ToolShell tool={TOOLS[6]} onBack={onBack}>
      {!file ? (
        <UploadDrop onFiles={onFiles} />
      ) : (
        <div className="space-y-4">
          <FileChip name={`${file.name} (${(before / 1024).toFixed(0)} KB)`} onRemove={() => setFile(null)} />
          <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-booking-green" />
            This re-optimizes the PDF's internal structure. It won't shrink files as dramatically as re-compressing embedded images would, but it's a real, lossless size reduction with no quality loss.
          </p>
          <ProcessButton onClick={run} busy={busy} label="Compress & Download" />
        </div>
      )}
    </ToolShell>
  );
}

/* ---------- Edit PDF ---------- */
function EditTool({ onBack, userRole }: { onBack: () => void; userRole: "admin" | "b2b_agent" }) {
  const [file, setFile] = useState<File | null>(null);
  const [bytes, setBytes] = useState<Uint8Array | null>(null);

  const onFiles = async (files: File[]) => {
    const f = files[0];
    if (!f) return;
    setFile(f);
    setBytes(new Uint8Array(await f.arrayBuffer()));
  };

  if (file && bytes) {
    return (
      <div className="fixed inset-0 z-50 bg-background">
        <SejdaEditor
          isOpen
          onClose={() => { setFile(null); setBytes(null); }}
          pdfBytes={bytes}
          fileName={file.name}
          userRole={userRole}
        />
      </div>
    );
  }

  return (
    <ToolShell tool={TOOLS[7]} onBack={onBack}>
      <UploadDrop onFiles={onFiles} />
      <p className="mt-4 flex items-start gap-1.5 text-xs text-muted-foreground">
        <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-booking-green" />
        Once open: drag to select any text and press Delete to remove it, or click a shape/stamp/signature to select it and press Delete to remove that instead.
      </p>
    </ToolShell>
  );
}

function PDFToolsPage() {
  const search = Route.useSearch();
  const router = useRouter();
  const logout = useServerFn(adminLogout);
  async function onLogout() {
    await logout();
    router.navigate({ to: "/admin" });
  }
  const agentPortal = search.portal === "agent";
  const { staffTabs, portalRole } = Route.useRouteContext() as { staffTabs: string[]; portalRole: "admin" | "staff" };
  const [activeTool, setActiveTool] = useState<ToolId | null>(null);

  return (
    <div className="min-h-screen bg-background text-navy">
      {agentPortal ? (
        <AgentTopBar />
      ) : (
        <header className="border-b border-[rgba(255,255,255,0.10)] bg-navy text-white">
          <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-3 px-4 py-4">
            <div className="flex items-center gap-3">
              <FileStack className="h-5 w-5 text-white" />
              <div>
                <p className="font-sans text-lg font-semibold">Admin Panel</p>
                <p className="text-[11px] font-medium text-white/70">PDF Tools</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <AdminHeaderExtras />
              <a href="/" className="rounded-lg border border-white/25 px-3 py-1.5 text-[13px] font-medium hover:bg-white/10">Home</a>
              <button onClick={onLogout} className="inline-flex items-center gap-2 rounded-lg bg-[var(--accent)] px-3 py-1.5 text-[13px] font-medium text-white transition-colors hover:bg-[var(--accent-hover)]">
                <LogOut className="h-3.5 w-3.5" /> Logout
              </button>
            </div>
          </div>
          <AdminTabs staffTabs={staffTabs} panelRole={portalRole} />
        </header>
      )}

      <div className="mx-auto max-w-6xl px-4 py-10">
        {!activeTool ? (
          <>
            <div className="mb-8">
              <p className="text-xs font-bold uppercase tracking-[0.3em] text-gold">PDF Tools</p>
              <h1 className="mt-2 font-sans text-3xl font-black md:text-4xl">Everything you need for a PDF</h1>
              <p className="mt-2 max-w-xl text-sm text-muted-foreground">
                Merge, split, rotate, watermark, compress, and edit documents — all processed locally in your browser, nothing is uploaded anywhere.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {TOOLS.map((tool) => {
                const Icon = tool.icon;
                return (
                  <button
                    key={tool.id}
                    onClick={() => setActiveTool(tool.id)}
                    className="group flex flex-col items-start gap-3 rounded-xl border border-border bg-card p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-gold/50 hover:shadow-md"
                  >
                    <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-gold/15 text-gold transition-colors group-hover:bg-gold group-hover:text-gold-foreground">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-bold text-navy">{tool.label}</p>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{tool.desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        ) : activeTool === "merge" ? (
          <MergeTool onBack={() => setActiveTool(null)} />
        ) : activeTool === "extract" ? (
          <ExtractTool onBack={() => setActiveTool(null)} />
        ) : activeTool === "delete" ? (
          <DeleteTool onBack={() => setActiveTool(null)} />
        ) : activeTool === "rotate" ? (
          <RotateTool onBack={() => setActiveTool(null)} />
        ) : activeTool === "pagenumbers" ? (
          <PageNumbersTool onBack={() => setActiveTool(null)} />
        ) : activeTool === "watermark" ? (
          <WatermarkTool onBack={() => setActiveTool(null)} />
        ) : activeTool === "compress" ? (
          <CompressTool onBack={() => setActiveTool(null)} />
        ) : activeTool === "edit" ? (
          <EditTool onBack={() => setActiveTool(null)} userRole={agentPortal ? "b2b_agent" : "admin"} />
        ) : null}
      </div>
    </div>
  );
}
