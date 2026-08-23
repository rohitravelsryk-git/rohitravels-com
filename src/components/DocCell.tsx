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

  return (
    <div className="flex flex-col gap-1">
      {files && files.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {files.map((f, i) => (
            <div key={i} className="group relative">
              <a
                href={f.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded bg-emerald-50 px-1.5 py-0.5 text-[9px] font-bold text-emerald-700 hover:bg-emerald-100"
                title={f.name}
              >
                {f.type?.includes("image") ? <ImageIcon className="h-2.5 w-2.5" /> : <FileText className="h-2.5 w-2.5" />}
                {attachedLabel}
              </a>
              {onRemove && (
                <button
                  onClick={() => onRemove(f.path)}
                  className="absolute -right-1 -top-1 hidden h-3 w-3 rounded-full bg-rose-500 text-[8px] text-white group-hover:flex items-center justify-center"
                >
                  <X className="h-2 w-2" />
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
