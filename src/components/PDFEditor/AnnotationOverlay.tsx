import React, { useRef, useState, useEffect } from 'react';
import { Trash2, Move, GripHorizontal, Type, Plus, Minus, Palette, RotateCw } from 'lucide-react';
import { usePDF } from '@/context/PDFContext';
import { Point, PDFAnnotation, TextAnnotation } from '@/types/pdf';

type ResizeHandle = 'nw' | 'n' | 'ne' | 'w' | 'e' | 'sw' | 's' | 'se';
const HANDLES: { id: ResizeHandle; cls: string; cursor: string }[] = [
  { id: 'nw', cls: '-left-1.5 -top-1.5', cursor: 'nwse-resize' },
  { id: 'n', cls: 'left-1/2 -top-1.5 -translate-x-1/2', cursor: 'ns-resize' },
  { id: 'ne', cls: '-right-1.5 -top-1.5', cursor: 'nesw-resize' },
  { id: 'w', cls: '-left-1.5 top-1/2 -translate-y-1/2', cursor: 'ew-resize' },
  { id: 'e', cls: '-right-1.5 top-1/2 -translate-y-1/2', cursor: 'ew-resize' },
  { id: 'sw', cls: '-left-1.5 -bottom-1.5', cursor: 'nesw-resize' },
  { id: 's', cls: 'left-1/2 -bottom-1.5 -translate-x-1/2', cursor: 'ns-resize' },
  { id: 'se', cls: '-right-1.5 -bottom-1.5', cursor: 'nwse-resize' },
];
const MIN_SIZE = 3; // percent

interface AnnotationOverlayProps {
  pageIndex: number;
  width: number;
  height: number;
}

export const AnnotationOverlay: React.FC<AnnotationOverlayProps> = ({ pageIndex, width, height }) => {
  const {
    activeTool,
    setActiveTool,
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

  const [resizeState, setResizeState] = useState<{
    id: string;
    handle: ResizeHandle;
    startX: number;
    startY: number;
    initial: { x: number; y: number; width: number; height: number };
  } | null>(null);

  const [rotateState, setRotateState] = useState<{
    id: string;
    centerX: number; // px, viewport
    centerY: number;
    startAngle: number; // current rotation at drag start
  } | null>(null);

  const containerRef = useRef<HTMLDivElement | null>(null);

  // Filter annotations for this page
  const pageAnns = annotations.filter((a) => a.pageIndex === pageIndex);

  // Click on background overlay to add elements
  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (activeTool === 'select' || activeTool === 'hand' || isDrawingPen) return;

    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const clickXPercent = ((e.clientX - rect.left) / width) * 100;
    const clickYPercent = ((e.clientY - rect.top) / height) * 100;

    if (activeTool === 'text') {
      addAnnotation({
        pageIndex,
        type: 'text',
        text: 'Type new text here...',
        x: Math.max(0, Math.min(80, clickXPercent)),
        y: Math.max(0, Math.min(90, clickYPercent)),
        width: 30,
        height: 8,
        fontSize: 14,
        fontFamily: 'sans-serif',
        textColor: '#1E293B',
      });
      // Switch to select tool after adding text box
      setActiveTool('select');
    } else if (activeTool === 'whiteout') {
      addAnnotation({
        pageIndex,
        type: 'whiteout',
        x: Math.max(0, clickXPercent - 15),
        y: Math.max(0, clickYPercent - 4),
        width: 30,
        height: 8,
      });
    } else if (activeTool === 'redact') {
      addAnnotation({
        pageIndex,
        type: 'redact',
        x: Math.max(0, clickXPercent - 15),
        y: Math.max(0, clickYPercent - 4),
        width: 30,
        height: 8,
        reason: 'CONFIDENTIAL',
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
    if (dragState) {
      const deltaXPercent = ((e.clientX - dragState.startX) / width) * 100;
      const deltaYPercent = ((e.clientY - dragState.startY) / height) * 100;

      updateAnnotation(dragState.id, {
        x: Math.max(0, Math.min(95, dragState.initialX + deltaXPercent)),
        y: Math.max(0, Math.min(95, dragState.initialY + deltaYPercent)),
      });
      return;
    }

    if (resizeState) {
      const deltaXPercent = ((e.clientX - resizeState.startX) / width) * 100;
      const deltaYPercent = ((e.clientY - resizeState.startY) / height) * 100;
      const { x, y, width: w0, height: h0 } = resizeState.initial;
      let next = { x, y, width: w0, height: h0 };

      const h = resizeState.handle;
      if (h.includes('n')) {
        const dh = Math.max(-h0 + MIN_SIZE, deltaYPercent);
        next.y = y + dh;
        next.height = h0 - dh;
      }
      if (h.includes('s')) {
        next.height = Math.max(MIN_SIZE, h0 + deltaYPercent);
      }
      if (h.includes('w')) {
        const dw = Math.max(-w0 + MIN_SIZE, deltaXPercent);
        next.x = x + dw;
        next.width = w0 - dw;
      }
      if (h.includes('e')) {
        next.width = Math.max(MIN_SIZE, w0 + deltaXPercent);
      }

      updateAnnotation(resizeState.id, {
        x: Math.max(0, next.x),
        y: Math.max(0, next.y),
        width: next.width,
        height: next.height,
      });
      return;
    }

    if (rotateState) {
      const angleRad = Math.atan2(e.clientY - rotateState.centerY, e.clientX - rotateState.centerX);
      const angleDeg = angleRad * (180 / Math.PI) + 90; // +90 so pointing up = 0deg
      updateAnnotation(rotateState.id, { rotation: Math.round((angleDeg + 360) % 360) });
    }
  };

  const handleMouseUpGlobal = () => {
    setDragState(null);
    setResizeState(null);
    setRotateState(null);
  };

  const handleResizeMouseDown = (e: React.MouseEvent, ann: PDFAnnotation, handle: ResizeHandle) => {
    e.stopPropagation();
    if (!('width' in ann) || !('height' in ann)) return;
    setResizeState({
      id: ann.id,
      handle,
      startX: e.clientX,
      startY: e.clientY,
      initial: { x: ann.x, y: ann.y, width: ann.width, height: ann.height },
    });
  };

  const handleRotateMouseDown = (e: React.MouseEvent, ann: PDFAnnotation) => {
    e.stopPropagation();
    const target = (e.currentTarget as HTMLElement).closest('[data-ann-box]') as HTMLElement | null;
    const rect = target?.getBoundingClientRect();
    if (!rect) return;
    setRotateState({
      id: ann.id,
      centerX: rect.left + rect.width / 2,
      centerY: rect.top + rect.height / 2,
      startAngle: ann.rotation || 0,
    });
  };

  // Pointer events logic: allow text selection on PDF canvas when 'select' tool is active
  const isBackgroundClickable = activeTool !== 'select' && activeTool !== 'hand';

  return (
    <div
      ref={containerRef}
      style={{ width: `${width}px`, height: `${height}px`, zIndex: 20 }}
      onClick={handleOverlayClick}
      onMouseDown={handlePenMouseDown}
      onMouseMove={(e) => { handlePenMouseMove(e); handleMouseMoveGlobal(e); }}
      onMouseUp={() => { handlePenMouseUp(); handleMouseUpGlobal(); }}
      className={`absolute inset-0 ${
        isBackgroundClickable ? 'pointer-events-auto' : 'pointer-events-none'
      } ${activeTool === 'pen' ? 'cursor-crosshair' : activeTool === 'hand' ? 'cursor-grab' : 'cursor-default'}`}
    >
      {/* SVG Layer for Pen Strokes */}
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

      {/* Render HTML Annotations (Text, Whiteout, Redaction, Stamps, Signatures, Shapes) */}
      {pageAnns.map((ann) => {
        if (ann.type === 'pen') return null;
        const isSelected = selectedAnnotationId === ann.id;

        return (
          <div
            key={ann.id}
            data-ann-box
            style={{
              left: `${ann.x}%`,
              top: `${ann.y}%`,
              width: `${'width' in ann ? ann.width : 25}%`,
              height: `${'height' in ann ? ann.height : 10}%`,
              opacity: ann.opacity ?? 1,
              transform: ann.rotation ? `rotate(${ann.rotation}deg)` : undefined,
              transformOrigin: 'center center',
            }}
            className={`absolute flex flex-col pointer-events-auto transition-shadow ${
              isSelected ? 'ring-2 ring-[#FF6600] ring-offset-1 z-40' : 'hover:ring-1 hover:ring-gray-400 z-30'
            }`}
            onClick={(e) => {
              e.stopPropagation();
              setSelectedAnnotationId(ann.id);
            }}
          >
            {/* 8-handle resize bounding box + rotation handle, classic Foxit-style */}
            {isSelected && 'width' in ann && 'height' in ann && (
              <>
                {HANDLES.map((h) => (
                  <div
                    key={h.id}
                    onMouseDown={(e) => handleResizeMouseDown(e, ann, h.id)}
                    style={{ cursor: h.cursor }}
                    className={`absolute z-50 h-3 w-3 rounded-xs border border-white bg-[#FF6600] shadow-xs ${h.cls}`}
                  />
                ))}
                {/* Rotation handle */}
                <div className="absolute -top-9 left-1/2 h-6 w-px -translate-x-1/2 bg-[#FF6600]/60" />
                <div
                  onMouseDown={(e) => handleRotateMouseDown(e, ann)}
                  title="Drag to rotate"
                  style={{ cursor: 'grab' }}
                  className="absolute -top-11 left-1/2 z-50 flex h-4 w-4 -translate-x-1/2 items-center justify-center rounded-full border border-white bg-[#FF6600] shadow-xs"
                >
                  <RotateCw className="h-2.5 w-2.5 text-white" />
                </div>
              </>
            )}
            {/* Header Drag Handle for Selected Annotation */}
            {isSelected && (
              <div
                onMouseDown={(e) => handleMouseDownItem(e, ann.id, ann.x, ann.y)}
                className="absolute -top-7 left-0 right-0 flex items-center justify-between rounded bg-gray-900 px-2 py-1 text-white shadow-md cursor-move select-none z-50"
              >
                <div className="flex items-center gap-1">
                  <GripHorizontal className="h-3.5 w-3.5 text-orange-400" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-300">
                    {ann.type}
                  </span>
                </div>

                {/* Text Formatting Toolbar inside Text Box Selection */}
                {(ann.type === 'text' || ann.type === 'form_text') && (
                  <div className="flex items-center gap-1.5 border-l border-gray-700 pl-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        const cur = (ann as TextAnnotation).fontSize || 14;
                        updateAnnotation(ann.id, { fontSize: Math.max(8, cur - 2) });
                      }}
                      className="rounded p-0.5 hover:bg-gray-800 text-xs font-bold"
                      title="Decrease Font Size"
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="text-[10px] font-mono">{(ann as TextAnnotation).fontSize || 14}px</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        const cur = (ann as TextAnnotation).fontSize || 14;
                        updateAnnotation(ann.id, { fontSize: Math.min(72, cur + 2) });
                      }}
                      className="rounded p-0.5 hover:bg-gray-800 text-xs font-bold"
                      title="Increase Font Size"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                    <input
                      type="color"
                      value={(ann as TextAnnotation).textColor || '#1E293B'}
                      onChange={(e) => updateAnnotation(ann.id, { textColor: e.target.value })}
                      className="h-4 w-4 cursor-pointer rounded border-0 bg-transparent"
                      title="Change Text Color"
                    />
                  </div>
                )}

                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); deleteAnnotation(ann.id); }}
                  className="rounded p-0.5 text-gray-300 hover:text-rose-400"
                  title="Delete Annotation"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            {/* Editable Text Overlay Component */}
            {(ann.type === 'text' || ann.type === 'form_text') && (
              <textarea
                value={(ann as TextAnnotation).text || ''}
                onChange={(e) => updateAnnotation(ann.id, { text: e.target.value })}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
                style={{
                  fontSize: `${(ann as TextAnnotation).fontSize || 14}px`,
                  color: (ann as TextAnnotation).textColor || '#1E293B',
                }}
                placeholder="Type ticket text..."
                className="h-full w-full resize-none rounded border border-dashed border-gray-400 bg-white/90 p-1.5 font-bold outline-none shadow-xs focus:border-[#FF6600] focus:bg-white select-text"
              />
            )}

            {/* Whiteout / Erase Overlay */}
            {ann.type === 'whiteout' && (
              <div className="h-full w-full bg-white border border-gray-200 shadow-xs flex items-center justify-center">
                {isSelected && <span className="text-[9px] font-bold text-gray-400 uppercase select-none">Whiteout / Erased Area</span>}
              </div>
            )}

            {/* Blackout Redaction Overlay */}
            {ann.type === 'redact' && (
              <div className="h-full w-full bg-black text-white flex items-center justify-center font-mono text-[10px] font-bold tracking-wider select-none">
                {'reason' in ann ? ann.reason : 'REDACTED'}
              </div>
            )}

            {/* Agency Stamp Overlay */}
            {ann.type === 'stamp' && (
              <div
                className={`h-full w-full border-4 border-double flex flex-col items-center justify-center p-1 rounded font-black tracking-widest text-center select-none ${
                  ann.stampType === 'APPROVED' || ann.stampType === 'COMPLETED'
                    ? 'border-emerald-600 text-emerald-600 bg-emerald-50/70'
                    : ann.stampType === 'CONFIDENTIAL'
                    ? 'border-rose-600 text-rose-600 bg-rose-50/70'
                    : 'border-[#FF6600] text-[#FF6600] bg-orange-50/70'
                }`}
              >
                <span className="text-xs">{ann.stampType === 'CUSTOM' ? ann.customText || 'STAMP' : ann.stampType.replace('_', ' ')}</span>
                <span className="text-[8px] font-mono font-normal">ROHI TRAVELS</span>
              </div>
            )}

            {/* Digital Signature Overlay */}
            {ann.type === 'signature' && 'imageDataUrl' in ann && (
              <img src={ann.imageDataUrl} alt="Signature" className="h-full w-full object-contain pointer-events-none select-none" />
            )}

            {/* Highlight Rectangle Overlay */}
            {ann.type === 'highlight' && (
              <div className="h-full w-full bg-yellow-300/40 mix-blend-multiply border border-yellow-400 select-none" />
            )}

            {/* Shapes */}
            {ann.type === 'rectangle' && (
              <div
                style={{
                  borderColor: 'strokeColor' in ann ? ann.strokeColor : '#FF6600',
                  borderWidth: `${'strokeWidth' in ann ? ann.strokeWidth : 2}px`,
                }}
                className="h-full w-full border rounded-xs select-none"
              />
            )}

            {ann.type === 'circle' && (
              <div
                style={{
                  borderColor: 'strokeColor' in ann ? ann.strokeColor : '#FF6600',
                  borderWidth: `${'strokeWidth' in ann ? ann.strokeWidth : 2}px`,
                }}
                className="h-full w-full border rounded-full select-none"
              />
            )}
          </div>
        );
      })}
    </div>
  );
};
