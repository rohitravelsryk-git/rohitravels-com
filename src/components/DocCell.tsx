import { useRef, useState } from "react";
import { Upload, Trash2, FileText, Image as ImageIcon } from "lucide-react";
import { useDocPreview } from "@/components/DocViewer";

interface DocCellProps {
  files: any[];
  attachedLabel?: string;
  uploadLabel?: string;
  uploading?: boolean;
  busy?: boolean;
  /** Omit for a read-only cell — the upload control then never renders. */
  onFiles?: (files: FileList | null) => void;
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
  const { openDoc, previewNode } = useDocPreview();
  const atCap = (files?.length ?? 0) >= maxFiles;

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      {files && files.length > 0 && (
        <div className="flex min-w-0 flex-wrap gap-1.5">
          {files.map((f, i) => (
            <div key={i} className="inline-flex max-w-full items-center gap-1 rounded-md border border-booking-green/20 bg-booking-green-soft/45 px-1.5 py-1">
              <button
                type="button"
                onClick={() => f.url && openDoc({ url: f.url, name: f.name ?? attachedLabel, type: f.type ?? "" })}
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
      {onFiles && !atCap && !hideUpload && (
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
      {previewNode}
    </div>
  );
}
