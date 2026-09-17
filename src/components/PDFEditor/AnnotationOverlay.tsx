import React, { useRef, useState } from 'react';
import { Trash2, Move, GripHorizontal } from 'lucide-react';
import { usePDF } from '@/context/PDFContext';
import { Point, PDFAnnotation } from '@/types/pdf';

interface AnnotationOverlayProps {
  pageIndex: number;
  width: number;
  height: number;
}

export const AnnotationOverlay: React.FC<AnnotationOverlayProps> = ({ pageIndex, width, height }) => {
  const {
    activeTool,
    annotations,
    addAnnotation,
    updateAnnotation,
    deleteAnnotation,
    selectedAnnotationId,
    setSelectedAnnotationId,
    activeStampType,
    customStampText,
    activeColor,
    strokeWidth,
  } = usePDF();

  const [isDrawingPen, setIsDrawingPen] = useState(false);
  const [currentPenPoints, setCurrentPenPoints] = useState<Point[]>([]);

  const [dragState, setDragState] = useState<{
    id: string;
    startX: number;
    startY: number;
    initialX: number;
    initialY: number;
  } | null>(null);

  const containerRef = useRef<HTMLDivElement | null>(null);

  // Filter annotations for this page
  const pageAnns = annotations.filter((a) => a.pageIndex === pageIndex);

  // Click on background canvas overlay to add elements
  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (activeTool === 'select' || activeTool === 'hand' || isDrawingPen) return;

    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const clickXPercent = ((e.clientX - rect.left) / width) * 100;
    const clickYPercent = ((e.clientY - rect.top) / height) * 100;

    if (activeTool === 'whiteout') {
      addAnnotation({
        pageIndex,
        type: 'whiteout',
        x: Math.max(0, clickXPercent - 15),
        y: Math.max(0, clickYPercent - 5),
        width: 30,
        height: 10,
      });
    } else if (activeTool === 'redact') {
      addAnnotation({
        pageIndex,
        type: 'redact',
        x: Math.max(0, clickXPercent - 15),
        y: Math.max(0, clickYPercent - 5),
        width: 30,
        height: 10,
        reason: 'CONFIDENTIAL',
      });
    } else if (activeTool === 'text') {
      addAnnotation({
        pageIndex,
        type: 'text',
        text: 'Click to edit ticket text...',
        x: clickXPercent,
        y: clickYPercent,
        width: 25,
        height: 6,
        fontSize: 14,
        fontFamily: 'sans-serif',
        textColor: '#1E293B',
      });
    } else if (activeTool === 'stamp') {
      addAnnotation({
        pageIndex,
        type: 'stamp',
        stampType: activeStampType,
        customText: customStampText,
        x: Math.max(0, clickXPercent - 12),
        y: Math.max(0, clickYPercent - 5),
        width: 24,
        height: 10,
      });
    } else if (activeTool === 'highlight') {
      addAnnotation({
        pageIndex,
        type: 'highlight',
        x: Math.max(0, clickXPercent - 15),
        y: Math.max(0, clickYPercent - 2),
        width: 30,
        height: 4,
        color: '#FFFF00',
      });
    } else if (activeTool === 'rectangle') {
      addAnnotation({
        pageIndex,
        type: 'rectangle',
        x: Math.max(0, clickXPercent - 10),
        y: Math.max(0, clickYPercent - 5),
        width: 20,
        height: 10,
        strokeColor: activeColor || '#FF6600',
        strokeWidth,
      });
    } else if (activeTool === 'circle') {
      addAnnotation({
        pageIndex,
        type: 'circle',
        x: Math.max(0, clickXPercent - 8),
        y: Math.max(0, clickYPercent - 8),
        width: 16,
        height: 16,
        strokeColor: activeColor || '#FF6600',
        strokeWidth,
      });
    }
  };

  // Freehand Pen Drawing Handlers
  const handlePenMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (activeTool !== 'pen') return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setIsDrawingPen(true);
    const p = { x: (e.clientX - rect.left) / width, y: (e.clientY - rect.top) / height };
    setCurrentPenPoints([p]);
  };

  const handlePenMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDrawingPen || activeTool !== 'pen') return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const p = { x: (e.clientX - rect.left) / width, y: (e.clientY - rect.top) / height };
    setCurrentPenPoints((prev) => [...prev, p]);
  };

  const handlePenMouseUp = () => {
    if (isDrawingPen && currentPenPoints.length > 1) {
      addAnnotation({
        pageIndex,
        type: 'pen',
        points: currentPenPoints,
        strokeWidth: strokeWidth || 2,
        color: activeColor || '#000000',
      });
    }
    setIsDrawingPen(false);
    setCurrentPenPoints([]);
  };

  // Dragging annotations
  const handleMouseDownItem = (e: React.MouseEvent, id: string, initialX: number, initialY: number) => {
    e.stopPropagation();
    setSelectedAnnotationId(id);
    setDragState({
      id,
      startX: e.clientX,
      startY: e.clientY,
      initialX,
      initialY,
    });
  };

  const handleMouseMoveGlobal = (e: React.MouseEvent) => {
    if (!dragState) return;
    const deltaXPercent = ((e.clientX - dragState.startX) / width) * 100;
    const deltaYPercent = ((e.clientY - dragState.startY) / height) * 100;

    updateAnnotation(dragState.id, {
      x: Math.max(0, Math.min(90, dragState.initialX + deltaXPercent)),
      y: Math.max(0, Math.min(90, dragState.initialY + deltaYPercent)),
    });
  };

  const handleMouseUpGlobal = () => {
    setDragState(null);
  };

  return (
    <div
      ref={containerRef}
      style={{ width: `${width}px`, height: `${height}px` }}
      onClick={handleOverlayClick}
      onMouseDown={handlePenMouseDown}
      onMouseMove={(e) => { handlePenMouseMove(e); handleMouseMoveGlobal(e); }}
      onMouseUp={() => { handlePenMouseUp(); handleMouseUpGlobal(); }}
      className={`absolute inset-0 pointer-events-auto select-none ${
        activeTool === 'pen' ? 'cursor-crosshair' : activeTool === 'hand' ? 'cursor-grab' : 'cursor-default'
      }`}
    >
      {/* SVG Layer for Pen Strokes & Vector Shapes */}
      <svg className="absolute inset-0 h-full w-full pointer-events-none">
        {pageAnns.map((ann) => {
          if (ann.type === 'pen' && ann.points && ann.points.length > 1) {
            const pointsStr = ann.points.map((p) => `${p.x * width},${p.y * height}`).join(' ');
            return (
              <polyline
                key={ann.id}
                points={pointsStr}
                fill="none"
                stroke={ann.color || '#000'}
                strokeWidth={ann.strokeWidth || 2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            );
          }
          return null;
        })}

        {/* Live Pen Stroke */}
        {isDrawingPen && currentPenPoints.length > 1 && (
          <polyline
            points={currentPenPoints.map((p) => `${p.x * width},${p.y * height}`).join(' ')}
            fill="none"
            stroke={activeColor || '#000'}
            strokeWidth={strokeWidth || 2}
            strokeLinecap="round"
          />
        )}
      </svg>

      {/* Render HTML Annotations (Whiteouts, Redactions, Text, Stamps, Signatures, Shapes) */}
      {pageAnns.map((ann) => {
        if (ann.type === 'pen') return null;
        const isSelected = selectedAnnotationId === ann.id;

        return (
          <div
            key={ann.id}
            style={{
              left: `${ann.x}%`,
              top: `${ann.y}%`,
              width: `${'width' in ann ? ann.width : 20}%`,
              height: `${'height' in ann ? ann.height : 10}%`,
            }}
            className={`absolute flex items-center justify-center transition-shadow ${
              isSelected ? 'ring-2 ring-[#FF6600] ring-offset-1 z-30' : 'hover:ring-1 hover:ring-gray-400 z-20'
            }`}
            onMouseDown={(e) => handleMouseDownItem(e, ann.id, ann.x, ann.y)}
          >
            {/* Whiteout Overlay */}
            {ann.type === 'whiteout' && (
              <div className="h-full w-full bg-white shadow-xs border border-gray-100 flex items-center justify-center">
                {isSelected && <span className="text-[10px] font-bold text-gray-400 uppercase">Whiteout / Erased Area</span>}
              </div>
            )}

            {/* Blackout Redaction Overlay */}
            {ann.type === 'redact' && (
              <div className="h-full w-full bg-black text-white flex items-center justify-center font-mono text-[10px] font-bold tracking-wider">
                {'reason' in ann ? ann.reason : 'REDACTED'}
              </div>
            )}

            {/* Editable Text Overlay */}
            {(ann.type === 'text' || ann.type === 'form_text') && (
              <div
                contentEditable
                suppressContentEditableWarning
                onBlur={(e) => updateAnnotation(ann.id, { text: e.currentTarget.innerText })}
                style={{
                  fontSize: `${'fontSize' in ann ? ann.fontSize : 14}px`,
                  color: 'textColor' in ann ? ann.textColor : '#1E293B',
                }}
                className="h-full w-full p-1 font-bold outline-none bg-white/80 border border-dashed border-gray-300 rounded focus:border-[#FF6600] focus:bg-white"
              >
                {'text' in ann ? ann.text : ''}
              </div>
            )}

            {/* Agency Stamp Overlay */}
            {ann.type === 'stamp' && (
              <div
                className={`h-full w-full border-4 border-double flex flex-col items-center justify-center p-1 rounded font-black tracking-widest text-center ${
                  ann.stampType === 'APPROVED' || ann.stampType === 'COMPLETED'
                    ? 'border-emerald-600 text-emerald-600 bg-emerald-50/50'
                    : ann.stampType === 'CONFIDENTIAL'
                    ? 'border-rose-600 text-rose-600 bg-rose-50/50'
                    : 'border-[#FF6600] text-[#FF6600] bg-orange-50/50'
                }`}
              >
                <span className="text-xs">{ann.stampType === 'CUSTOM' ? ann.customText || 'STAMP' : ann.stampType.replace('_', ' ')}</span>
                <span className="text-[8px] font-mono font-normal">ROHI TRAVELS</span>
              </div>
            )}

            {/* Digital Signature Overlay */}
            {ann.type === 'signature' && 'imageDataUrl' in ann && (
              <img src={ann.imageDataUrl} alt="Signature" className="h-full w-full object-contain pointer-events-none" />
            )}

            {/* Highlight Rectangle Overlay */}
            {ann.type === 'highlight' && (
              <div className="h-full w-full bg-yellow-300/40 mix-blend-multiply border border-yellow-400" />
            )}

            {/* Shapes */}
            {ann.type === 'rectangle' && (
              <div
                style={{
                  borderColor: 'strokeColor' in ann ? ann.strokeColor : '#FF6600',
                  borderWidth: `${'strokeWidth' in ann ? ann.strokeWidth : 2}px`,
                }}
                className="h-full w-full border rounded-xs"
              />
            )}

            {ann.type === 'circle' && (
              <div
                style={{
                  borderColor: 'strokeColor' in ann ? ann.strokeColor : '#FF6600',
                  borderWidth: `${'strokeWidth' in ann ? ann.strokeWidth : 2}px`,
                }}
                className="h-full w-full border rounded-full"
              />
            )}

            {/* Action Bar on Selected Element */}
            {isSelected && (
              <div className="absolute -top-7 right-0 flex items-center gap-1 rounded bg-gray-900 px-1.5 py-0.5 text-white shadow-md z-40">
                <span className="cursor-move p-0.5 hover:text-orange-400"><Move className="h-3 w-3" /></span>
                <button
                  onClick={(e) => { e.stopPropagation(); deleteAnnotation(ann.id); }}
                  className="p-0.5 hover:text-rose-400"
                  title="Delete"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
