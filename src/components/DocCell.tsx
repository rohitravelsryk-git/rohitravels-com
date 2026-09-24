import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Upload, Trash2, X, ExternalLink, FileText, Image as ImageIcon } from "lucide-react";

interface DocCellProps {
  files: any[];
  attachedLabel?: string;
  uploadLabel?: string;
  uploading?: boolean;
  busy?: boolean;
  onFiles: (files: FileList | null) => void;
  onRemove?: (path: string) => void;
  /** Max files this cell allows in total. Once reached, the upload control
   * hides — pass 1 for a single-file slot (e.g. payment slip), or a seat
   * count for something like passport copies. Defaults to unlimited. */
  maxFiles?: number;
  /** Force the upload control hidden regardless of file count — used when a
   * slot should offer upload only while nothing is attached yet. */
  hideUpload?: boolean;
  /** Whether the file picker allows selecting more than one file at once.
   * Defaults to true; set false for a strictly single-file slot. */
  multiple?: boolean;
}

type Preview = { url: string; name: string; type: string };

export function DocCell({
  files,
  attachedLabel = "Attached",
  uploadLabel = "Upload",
  uploading = false,
  busy = false,
  onFiles,
  onRemove,
  maxFiles = Infinity,
  hideUpload = false,
  multiple = true,
}: DocCellProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const atCap = (files?.length ?? 0) >= maxFiles;

  // Documents must stay beside the booking they belong to, so the viewer is an
  // overlay on top of the current screen rather than a new browser tab.
  useEffect(() => {
    if (!preview) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPreview(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [preview]);

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      {files && files.length > 0 && (
        <div className="flex min-w-0 flex-wrap gap-1.5">
          {files.map((f, i) => (
            <div key={i} className="inline-flex max-w-full items-center gap-1 rounded-md border border-booking-green/20 bg-booking-green-soft/45 px-1.5 py-1">
              <button
                type="button"
                onClick={() => f.url && setPreview({ url: f.url, name: f.name ?? attachedLabel, type: f.type ?? "" })}
                className="inline-flex min-w-0 items-center gap-1 text-[9px] font-bold text-booking-green hover:text-booking-ink"
                title={f.name}
              >
                {f.type?.includes("image") ? <ImageIcon className="h-2.5 w-2.5 shrink-0" /> : <FileText className="h-2.5 w-2.5 shrink-0" />}
                <span className="truncate">{attachedLabel}</span>
              </button>
              {onRemove && (
                <button
                  type="button"
                  aria-label={`Remove ${f.name ?? "file"}`}
                  title="Remove file"
                  disabled={removing === (f.path ?? f.url ?? f.name)}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const ref = f.path ?? f.url ?? f.name;
                    setRemoving(ref);
                    try { onRemove(ref); } finally { setTimeout(() => setRemoving(null), 2500); }
                  }}
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-booking-subtle transition-colors hover:bg-booking-rose-soft hover:text-booking-rose disabled:opacity-40"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      {!atCap && !hideUpload && (
        <label className={`flex h-7 w-full cursor-pointer items-center justify-center gap-1 rounded-md border border-dashed border-navy/20 bg-navy/5 text-[9px] font-bold text-navy/60 transition-colors hover:bg-navy/10 ${busy || uploading ? "opacity-50 cursor-not-allowed" : ""}`}>
          <Upload className="h-3 w-3" />
          {uploading ? "..." : uploadLabel}
          <input
            ref={inputRef}
            type="file"
            multiple={multiple}
            className="hidden"
            disabled={busy || uploading}
            onChange={(e) => onFiles(e.target.files)}
          />
        </label>
      )}

      {preview &&
        createPortal(
          <div
            className="fixed inset-0 z-[200] flex items-center justify-center bg-foreground/70 p-3 backdrop-blur-sm sm:p-6"
            onClick={() => setPreview(null)}
          >
            <div
              className="flex max-h-[94dvh] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-card shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex shrink-0 items-center gap-3 border-b border-border px-4 py-3">
                <p className="min-w-0 flex-1 truncate text-xs font-bold uppercase tracking-wide text-booking-ink">{preview.name}</p>
                <a
                  href={preview.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border px-2 py-1 text-[10px] font-semibold text-booking-subtle transition-colors hover:bg-bg-primary"
                >
                  <ExternalLink className="h-3 w-3" /> New tab
                </a>
                <button
                  type="button"
                  aria-label="Close document"
                  onClick={() => setPreview(null)}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-booking-subtle transition-colors hover:bg-booking-rose-soft hover:text-booking-rose"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-auto bg-secondary/50 p-3">
                {preview.type.includes("image") ? (
                  <img src={preview.url} alt={preview.name} className="mx-auto max-h-[74dvh] w-auto rounded-lg object-contain" />
                ) : preview.type.includes("pdf") || preview.url.includes(".pdf") ? (
                  <iframe src={preview.url} title={preview.name} className="h-[70dvh] w-full rounded-lg border border-border bg-white" />
                ) : (
                  <div className="grid h-40 place-items-center px-6 text-center text-xs text-muted-foreground">
                    This file type can't be previewed here — use New tab to open it.
                  </div>
                )}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
