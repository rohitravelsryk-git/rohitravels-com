import React from 'react';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Loader2 } from 'lucide-react';
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
      <div className="flex-1 overflow-auto px-4 py-6 scrollbar-thin">
        <div className="flex flex-col items-center">
          {Array.from({ length: pageCount }).map((_, idx) => (
            <PDFPage key={idx} pageIndex={idx} />
          ))}
        </div>
      </div>

      {/* Floating Bottom Navigation Pill */}
      <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 rounded-full border border-gray-200/80 bg-gray-900/90 px-4 py-2 text-white shadow-2xl backdrop-blur-md dark:border-gray-800">
        <button
          onClick={() => setCurrentPageIndex((p) => Math.max(0, p - 1))}
          disabled={currentPageIndex === 0}
          className="rounded p-1 hover:bg-gray-800 disabled:opacity-30"
          title="Previous Page"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        <span className="font-mono text-xs font-bold text-gray-200">
          Page <strong className="text-orange-400">{currentPageIndex + 1}</strong> of {pageCount}
        </span>

        <button
          onClick={() => setCurrentPageIndex((p) => Math.min(pageCount - 1, p + 1))}
          disabled={currentPageIndex >= pageCount - 1}
          className="rounded p-1 hover:bg-gray-800 disabled:opacity-30"
          title="Next Page"
        >
          <ChevronRight className="h-4 w-4" />
        </button>

        <div className="h-4 w-px bg-gray-700 mx-1" />

        <button
          onClick={() => setZoomScale((s) => Math.max(0.5, s - 0.15))}
          className="rounded p-1 hover:bg-gray-800"
          title="Zoom Out"
        >
          <ZoomOut className="h-3.5 w-3.5" />
        </button>
        <span className="font-mono text-xs text-gray-300">{Math.round(zoomScale * 100)}%</span>
        <button
          onClick={() => setZoomScale((s) => Math.min(3, s + 0.15))}
          className="rounded p-1 hover:bg-gray-800"
          title="Zoom In"
        >
          <ZoomIn className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
};
