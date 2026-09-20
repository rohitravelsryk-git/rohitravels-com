import React, { useEffect, useState } from 'react';
import { RotateCw, Trash2, ChevronUp, ChevronDown } from 'lucide-react';
import { usePDF } from '@/context/PDFContext';
import { generateThumbnailDataUrl } from '@/utils/pdfHelpers';

export const ThumbnailPanel: React.FC = () => {
  const { pdfDoc, pageCount, pageOrder, currentPageIndex, setCurrentPageIndex, rotatePage, deletePage, userRole, setPageOrder } = usePDF();
  const [thumbnails, setThumbnails] = useState<string[]>([]);

  useEffect(() => {
    if (!pdfDoc) return;
    let isMounted = true;

    async function loadThumbnails() {
      const urls: string[] = [];
      for (let i = 0; i < (pdfDoc?.numPages || 0); i++) {
        try {
          const url = await generateThumbnailDataUrl(pdfDoc!, i, 0.25);
          urls.push(url);
        } catch {
          urls.push('');
        }
      }
      if (isMounted) setThumbnails(urls);
    }

    loadThumbnails();
    return () => { isMounted = false; };
  }, [pdfDoc]);

  const movePage = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= pageOrder.length) return;
    const newOrder = [...pageOrder];
    const [moved] = newOrder.splice(fromIndex, 1);
    newOrder.splice(toIndex, 0, moved);
    setPageOrder(newOrder);
  };

  return (
    <div className="flex flex-col gap-3 p-3">
      <div className="flex items-center justify-between text-xs font-bold text-gray-500 uppercase tracking-wider dark:text-gray-400">
        <span>Pages ({pageCount})</span>
      </div>

      <div className="flex flex-col gap-3 overflow-y-auto max-h-[calc(100vh-220px)] pr-1">
        {pageOrder.map((origIndex, displayIdx) => {
          const thumbUrl = thumbnails[origIndex];
          const isSelected = currentPageIndex === displayIdx;

          return (
            <div
              key={`${origIndex}_${displayIdx}`}
              onClick={() => setCurrentPageIndex(displayIdx)}
              className={`group relative flex flex-col items-center rounded-lg border-2 p-2 transition-all cursor-pointer ${
                isSelected
                  ? 'border-[#FF6600] bg-orange-50/50 dark:bg-orange-950/20 shadow-xs'
                  : 'border-gray-200 hover:border-gray-300 dark:border-gray-800 dark:hover:border-gray-700 bg-white dark:bg-gray-900'
              }`}
            >
              <div className="relative mb-1 flex items-center justify-center overflow-hidden rounded bg-gray-100 dark:bg-gray-800 w-full min-h-[120px]">
                {thumbUrl ? (
                  <img src={thumbUrl} alt={`PDF page ${displayIdx + 1} thumbnail`} width={612} height={792} loading="lazy" decoding="async" className="max-h-[160px] object-contain shadow-xs" />
                ) : (
                  <span className="text-xs text-gray-400">Loading Page {displayIdx + 1}</span>
                )}

                <span className="absolute bottom-1 right-1 rounded bg-black/70 px-1.5 py-0.5 text-[9px] font-bold text-white">
                  {displayIdx + 1}
                </span>
              </div>

              {/* Page Quick Tools */}
              <div className="flex w-full items-center justify-between px-1 pt-1 opacity-90 group-hover:opacity-100">
                <span className="text-[10px] font-bold text-gray-500">Page {displayIdx + 1}</span>

                <div className="flex items-center gap-1">
                  <button
                    onClick={(e) => { e.stopPropagation(); movePage(displayIdx, displayIdx - 1); }}
                    disabled={displayIdx === 0}
                    className="rounded p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-700 disabled:opacity-30 dark:hover:bg-gray-800"
                    title="Move Up"
                  >
                    <ChevronUp className="h-3 w-3" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); movePage(displayIdx, displayIdx + 1); }}
                    disabled={displayIdx === pageOrder.length - 1}
                    className="rounded p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-700 disabled:opacity-30 dark:hover:bg-gray-800"
                    title="Move Down"
                  >
                    <ChevronDown className="h-3 w-3" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); rotatePage(displayIdx, 'cw'); }}
                    className="rounded p-1 text-gray-400 hover:bg-gray-200 hover:text-[#FF6600] dark:hover:bg-gray-800"
                    title="Rotate 90°"
                  >
                    <RotateCw className="h-3 w-3" />
                  </button>
                  {userRole === 'admin' && pageOrder.length > 1 && (
                    <button
                      onClick={(e) => { e.stopPropagation(); deletePage(displayIdx); }}
                      className="rounded p-1 text-gray-400 hover:bg-rose-100 hover:text-rose-600 dark:hover:bg-rose-950/50"
                      title="Delete Page"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
