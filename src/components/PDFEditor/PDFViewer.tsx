import React, { useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ZoomIn, ZoomOut, Loader2 } from 'lucide-react';
import { usePDF } from '@/context/PDFContext';
import { PDFPage } from './PDFPage';

export const PDFViewer: React.FC = () => {
  const {
    pdfDoc,
    pageCount,
    currentPageIndex,
    setCurrentPageIndex,
    zoomScale,
    setZoomScale,
    isLoading,
  } = usePDF();

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [coords, setCoords] = useState<{ x: number; y: number } | null>(null);
  const [pageInput, setPageInput] = useState(String(currentPageIndex + 1));

  React.useEffect(() => setPageInput(String(currentPageIndex + 1)), [currentPageIndex]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = scrollRef.current?.getBoundingClientRect();
    if (!rect) return;
    setCoords({ x: Math.round(e.clientX - rect.left), y: Math.round(e.clientY - rect.top + scrollRef.current!.scrollTop) });
  };

  const commitPageInput = () => {
    const n = parseInt(pageInput, 10);
    if (!isNaN(n)) {
      setCurrentPageIndex(Math.max(0, Math.min(pageCount - 1, n - 1)));
    } else {
      setPageInput(String(currentPageIndex + 1));
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center bg-gray-100 dark:bg-gray-950 p-8 text-center text-gray-500">
        <Loader2 className="mb-3 h-10 w-10 animate-spin text-[#FF6600]" />
        <p className="text-sm font-bold text-gray-700 dark:text-gray-200">Rendering Ticket PDF Pages...</p>
        <p className="mt-1 text-xs text-gray-400">High-DPI canvas & text overlay loading</p>
      </div>
    );
  }

  if (!pdfDoc) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center bg-gray-100 dark:bg-gray-950 p-8 text-center text-gray-400">
        <p className="text-sm font-bold">No Document Loaded</p>
      </div>
    );
  }

  return (
    <div className="relative flex flex-1 flex-col overflow-hidden bg-gray-200/70 dark:bg-gray-950 transition-colors">
      {/* Scrollable Document Area */}
      <div
        ref={scrollRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setCoords(null)}
        className="flex-1 overflow-auto px-4 py-6 scrollbar-thin"
      >
        <div className="flex flex-col items-center">
          {Array.from({ length: pageCount }).map((_, idx) => (
            <PDFPage key={idx} pageIndex={idx} />
          ))}
        </div>
      </div>

      {/* Classic status bar: page navigation, zoom, cursor coordinates */}
      <div className="flex h-8 flex-shrink-0 items-center justify-between border-t border-gray-800 bg-gray-900 px-3 text-white">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setCurrentPageIndex(0)}
            disabled={currentPageIndex === 0}
            className="rounded p-1 hover:bg-gray-800 disabled:opacity-30"
            title="First Page"
          >
            <ChevronsLeft className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setCurrentPageIndex((p) => Math.max(0, p - 1))}
            disabled={currentPageIndex === 0}
            className="rounded p-1 hover:bg-gray-800 disabled:opacity-30"
            title="Previous Page"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>

          <span className="mx-1 flex items-center gap-1 font-mono text-xs text-gray-300">
            <input
              value={pageInput}
              onChange={(e) => setPageInput(e.target.value)}
              onBlur={commitPageInput}
              onKeyDown={(e) => e.key === 'Enter' && commitPageInput()}
              className="w-9 rounded border border-gray-700 bg-gray-800 px-1 py-0.5 text-center text-xs text-orange-400 outline-none focus:border-[#FF6600]"
            />
            / {pageCount}
          </span>

          <button
            onClick={() => setCurrentPageIndex((p) => Math.min(pageCount - 1, p + 1))}
            disabled={currentPageIndex >= pageCount - 1}
            className="rounded p-1 hover:bg-gray-800 disabled:opacity-30"
            title="Next Page"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setCurrentPageIndex(pageCount - 1)}
            disabled={currentPageIndex >= pageCount - 1}
            className="rounded p-1 hover:bg-gray-800 disabled:opacity-30"
            title="Last Page"
          >
            <ChevronsRight className="h-3.5 w-3.5" />
          </button>

          <div className="mx-1.5 h-4 w-px bg-gray-700" />

          <button
            onClick={() => setZoomScale((s) => Math.max(0.5, s - 0.15))}
            className="rounded p-1 hover:bg-gray-800"
            title="Zoom Out"
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </button>
          <span className="w-11 text-center font-mono text-xs text-gray-300">{Math.round(zoomScale * 100)}%</span>
          <button
            onClick={() => setZoomScale((s) => Math.min(3, s + 0.15))}
            className="rounded p-1 hover:bg-gray-800"
            title="Zoom In"
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </button>
        </div>

        <span className="font-mono text-[11px] text-gray-400">
          {coords ? `X: ${coords.x}, Y: ${coords.y}` : 'X: —, Y: —'}
        </span>
      </div>
    </div>
  );
};
