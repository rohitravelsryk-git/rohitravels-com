import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, ExternalLink } from "lucide-react";

export type DocPreviewFile = { url: string; name: string; type?: string };

function isPdf(doc: DocPreviewFile) {
  if ((doc.type ?? "").includes("pdf")) return true;
  return /\.pdf([?#]|$)/i.test(doc.name) || /\.pdf([?#]|$)/i.test(doc.url);
}

/**
 * In-place document viewer. Call `openDoc(file)` from any handler and render
 * `previewNode` — the overlay mounts on document.body so it is never clipped by
 * a scrolling table cell or an animated row.
 */
export function useDocPreview() {
  const [doc, setDoc] = useState<DocPreviewFile | null>(null);

  useEffect(() => {
    if (!doc) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDoc(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [doc]);

  return {
    openDoc: setDoc,
    previewNode: doc
      ? createPortal(
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-foreground/70 p-3 backdrop-blur-sm sm:p-6" onClick={() => setDoc(null)}>
            <div className="flex max-h-[94dvh] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-card shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex shrink-0 items-center gap-3 border-b border-border px-4 py-3">
                <p className="min-w-0 flex-1 truncate text-xs font-bold uppercase tracking-wide text-booking-ink">{doc.name}</p>
                <a
                  href={doc.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border px-2 py-1 text-[10px] font-semibold text-booking-subtle transition-colors hover:bg-bg-primary"
                >
                  <ExternalLink className="h-3 w-3" /> New tab
                </a>
                <button
                  type="button"
                  aria-label="Close document"
                  onClick={() => setDoc(null)}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-booking-subtle transition-colors hover:bg-booking-rose-soft hover:text-booking-rose"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-auto bg-secondary/50 p-3">
                {isPdf(doc) ? (
                  <iframe src={doc.url} title={doc.name} className="h-[70dvh] w-full rounded-lg border border-border bg-white" />
                ) : (
                  <img src={doc.url} alt={doc.name} className="mx-auto max-h-[74dvh] w-auto rounded-lg object-contain" />
                )}
              </div>
            </div>
          </div>,
          document.body,
        )
      : null,
  };
}
