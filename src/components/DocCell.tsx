import { useEffect, useRef, useState } from "react";
import { Paperclip, Upload, X, FileText, Image as ImageIcon } from "lucide-react";

interface DocCellProps {
  files: any[];
  attachedLabel?: string;
  uploadLabel?: string;
  uploading?: boolean;
  busy?: boolean;
  onFiles: (files: FileList | null) => void;
  onRemove?: (path: string) => void;
}

export function DocCell({
  files,
  attachedLabel = "Attached",
  uploadLabel = "Upload",
  uploading = false,
  busy = false,
  onFiles,
  onRemove
}: DocCellProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [removing, setRemoving] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-1">
      {files && files.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {files.map((f, i) => (
            <div key={i} className="inline-flex items-center gap-1 rounded bg-emerald-50 pr-1">
              <a
                href={f.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-bold text-emerald-700 hover:bg-emerald-100"
                title={f.name}
              >
                {f.type?.includes("image") ? <ImageIcon className="h-2.5 w-2.5" /> : <FileText className="h-2.5 w-2.5" />}
                {attachedLabel}
              </a>
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
                  className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-rose-500 text-white transition-opacity hover:bg-rose-600 disabled:opacity-40"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <label className={`flex h-6 w-full cursor-pointer items-center justify-center gap-1 rounded border border-dashed border-navy/20 bg-navy/5 text-[9px] font-bold text-navy/60 transition-colors hover:bg-navy/10 ${busy || uploading ? "opacity-50 cursor-not-allowed" : ""}`}>
          <Upload className="h-3 w-3" />
          {uploading ? "..." : uploadLabel}
          <input
            ref={inputRef}
            type="file"
            multiple
            className="hidden"
            disabled={busy || uploading}
            onChange={(e) => onFiles(e.target.files)}
          />
        </label>
      )}
    </div>
  );
}
