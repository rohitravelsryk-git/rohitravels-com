import React, { useEffect, useRef, useState } from 'react';
import { usePDF } from '@/context/PDFContext';
import { renderPDFPageCanvas, renderPDFPageTextLayer } from '@/utils/pdfHelpers';
import { AnnotationOverlay } from './AnnotationOverlay';

interface PDFPageProps {
  pageIndex: number; // 0-based index in current pageOrder
}

export const PDFPage: React.FC<PDFPageProps> = ({ pageIndex }) => {
  const { pdfDoc, pageOrder, pagesInfo, setPagesInfo, zoomScale } = usePDF();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const textLayerRef = useRef<HTMLDivElement | null>(null);
  const [dimensions, setDimensions] = useState<{ width: number; height: number }>({ width: 612, height: 792 });
  const [rendering, setRendering] = useState<boolean>(true);

  const origPageIndex = pageOrder[pageIndex] ?? pageIndex;
  const pageInfo = pagesInfo.find((p) => p.pageIndex === pageIndex);
  const rotation = pageInfo?.rotation || 0;

  useEffect(() => {
    if (!pdfDoc || !canvasRef.current) return;
    let isMounted = true;
    setRendering(true);

    async function renderPage() {
      try {
        const { width, height } = await renderPDFPageCanvas({
          pdfDoc: pdfDoc!,
          pageIndex: origPageIndex,
          canvas: canvasRef.current!,
          scale: zoomScale,
          rotation,
        });

        if (textLayerRef.current) {
          await renderPDFPageTextLayer({
            pdfDoc: pdfDoc!,
            pageIndex: origPageIndex,
            container: textLayerRef.current,
            scale: zoomScale,
            rotation,
          });
        }

        if (isMounted) {
          setDimensions({ width, height });
          setRendering(false);

          setPagesInfo((prev) => {
            const existing = prev.find((p) => p.pageIndex === pageIndex);
            if (!existing) {
              return [...prev, { pageIndex, originalIndex: origPageIndex, rotation, width, height }];
            }
            return prev;
          });
        }
      } catch (err) {
        console.warn('PDF Page rendering error:', err);
        if (isMounted) setRendering(false);
      }
    }

    renderPage();
    return () => { isMounted = false; };
  }, [pdfDoc, origPageIndex, pageIndex, zoomScale, rotation]);

  return (
    <div
      style={{ width: `${dimensions.width}px`, height: `${dimensions.height}px` }}
      className="relative my-4 mx-auto bg-white shadow-xl rounded-sm overflow-hidden dark:bg-gray-900 border border-gray-200 dark:border-gray-800 transition-shadow select-text"
    >
      {/* PDFjs HTML5 Canvas Rendering Layer */}
      <canvas ref={canvasRef} className="absolute inset-0 block h-full w-full pointer-events-none" />

      {/* PDFjs Text Layer for native selection */}
      <div
        ref={textLayerRef}
        className="absolute inset-0 select-text overflow-hidden pointer-events-auto textLayer"
        style={{ zIndex: 10 }}
      />

      {/* Interactive Overlay Layer */}
      {!rendering && (
        <AnnotationOverlay pageIndex={pageIndex} width={dimensions.width} height={dimensions.height} />
      )}
    </div>
  );
};
