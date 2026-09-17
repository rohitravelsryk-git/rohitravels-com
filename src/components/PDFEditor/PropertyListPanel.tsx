import React from 'react';
import { ChevronsRight, ChevronsLeft, SlidersHorizontal } from 'lucide-react';
import { usePDF } from '@/context/PDFContext';
import { PDFAnnotation, TextAnnotation, ShapeAnnotation } from '@/types/pdf';

const FONT_FAMILIES = ['Helvetica', 'Times New Roman', 'Courier New', 'Arial', 'sans-serif'];

function hasBox(a: PDFAnnotation): a is PDFAnnotation & { x: number; y: number; width: number; height: number } {
  return 'width' in a && 'height' in a;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[70px_1fr] items-center gap-2 px-3 py-1.5">
      <label className="text-[10px] font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</label>
      {children}
    </div>
  );
}

const inputCls =
  'w-full rounded border border-gray-300 bg-white px-1.5 py-1 text-xs font-mono text-gray-800 outline-none focus:border-[#FF6600] dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100';

export const PropertyListPanel: React.FC = () => {
  const { annotations, selectedAnnotationId, updateAnnotation, propertyPanelOpen, setPropertyPanelOpen } = usePDF();

  const selected = annotations.find((a) => a.id === selectedAnnotationId) || null;

  if (!propertyPanelOpen) {
    return (
      <button
        onClick={() => setPropertyPanelOpen(true)}
        title="Show Property List"
        className="flex h-8 w-6 flex-shrink-0 items-center justify-center border-l border-gray-200 bg-gray-50 text-gray-400 hover:bg-gray-100 dark:border-gray-800 dark:bg-gray-900"
      >
        <ChevronsLeft className="h-3.5 w-3.5" />
      </button>
    );
  }

  return (
    <div className="flex w-64 flex-shrink-0 flex-col border-l border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900">
      <div className="flex h-8 items-center justify-between border-b border-gray-200 px-2.5 dark:border-gray-800">
        <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-gray-600 dark:text-gray-300">
          <SlidersHorizontal className="h-3 w-3 text-[#FF6600]" /> Property List
        </span>
        <button
          onClick={() => setPropertyPanelOpen(false)}
          title="Hide Property List"
          className="rounded p-0.5 text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800"
        >
          <ChevronsRight className="h-3.5 w-3.5" />
        </button>
      </div>

      {!selected ? (
        <div className="flex flex-1 items-center justify-center p-4 text-center text-[11px] text-gray-400">
          Select an object to view and edit its properties.
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto py-1">
          <Field label="Type">
            <span className="rounded bg-gray-200 px-1.5 py-0.5 text-[10px] font-bold uppercase text-gray-700 dark:bg-gray-800 dark:text-gray-200">
              {selected.type.replace('_', ' ')}
            </span>
          </Field>

          {hasBox(selected) && (
            <>
              <div className="mt-1 border-t border-gray-200 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-gray-400 dark:border-gray-800">
                Position &amp; Size
              </div>
              <Field label="X (%)">
                <input type="number" className={inputCls} value={Math.round(selected.x * 10) / 10}
                  onChange={(e) => updateAnnotation(selected.id, { x: Number(e.target.value) })} />
              </Field>
              <Field label="Y (%)">
                <input type="number" className={inputCls} value={Math.round(selected.y * 10) / 10}
                  onChange={(e) => updateAnnotation(selected.id, { y: Number(e.target.value) })} />
              </Field>
              <Field label="Width (%)">
                <input type="number" className={inputCls} value={Math.round(selected.width * 10) / 10}
                  onChange={(e) => updateAnnotation(selected.id, { width: Math.max(2, Number(e.target.value)) })} />
              </Field>
              <Field label="Height (%)">
                <input type="number" className={inputCls} value={Math.round(selected.height * 10) / 10}
                  onChange={(e) => updateAnnotation(selected.id, { height: Math.max(2, Number(e.target.value)) })} />
              </Field>
              <Field label="Rotation">
                <div className="flex items-center gap-1.5">
                  <input type="range" min={0} max={360} value={selected.rotation || 0}
                    onChange={(e) => updateAnnotation(selected.id, { rotation: Number(e.target.value) })}
                    className="h-1.5 flex-1 accent-[#FF6600]" />
                  <span className="w-9 text-right font-mono text-[10px] text-gray-500">{selected.rotation || 0}°</span>
                </div>
              </Field>
            </>
          )}

          {(selected.type === 'text' || selected.type === 'form_text') && (
            <>
              <div className="mt-1 border-t border-gray-200 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-gray-400 dark:border-gray-800">
                Font
              </div>
              <Field label="Family">
                <select
                  className={inputCls}
                  value={(selected as TextAnnotation).fontFamily || 'Helvetica'}
                  onChange={(e) => updateAnnotation(selected.id, { fontFamily: e.target.value })}
                >
                  {FONT_FAMILIES.map((f) => <option key={f} value={f}>{f}</option>)}
                </select>
              </Field>
              <Field label="Size">
                <input type="number" className={inputCls} value={(selected as TextAnnotation).fontSize || 14}
                  onChange={(e) => updateAnnotation(selected.id, { fontSize: Number(e.target.value) })} />
              </Field>
              <Field label="Color">
                <input type="color" className="h-6 w-full cursor-pointer rounded border border-gray-300 dark:border-gray-700"
                  value={(selected as TextAnnotation).textColor || '#1E293B'}
                  onChange={(e) => updateAnnotation(selected.id, { textColor: e.target.value })} />
              </Field>
            </>
          )}

          {(selected.type === 'rectangle' || selected.type === 'circle' || selected.type === 'line' || selected.type === 'arrow') && (
            <>
              <div className="mt-1 border-t border-gray-200 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-gray-400 dark:border-gray-800">
                Stroke &amp; Fill
              </div>
              <Field label="Stroke">
                <input type="color" className="h-6 w-full cursor-pointer rounded border border-gray-300 dark:border-gray-700"
                  value={(selected as ShapeAnnotation).strokeColor || '#FF6600'}
                  onChange={(e) => updateAnnotation(selected.id, { strokeColor: e.target.value })} />
              </Field>
              <Field label="Width">
                <input type="number" className={inputCls} value={(selected as ShapeAnnotation).strokeWidth || 2}
                  onChange={(e) => updateAnnotation(selected.id, { strokeWidth: Number(e.target.value) })} />
              </Field>
            </>
          )}

          <div className="mt-1 border-t border-gray-200 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-gray-400 dark:border-gray-800">
            Transparency
          </div>
          <Field label="Alpha">
            <div className="flex items-center gap-1.5">
              <input type="range" min={0} max={100} value={Math.round((selected.opacity ?? 1) * 100)}
                onChange={(e) => updateAnnotation(selected.id, { opacity: Number(e.target.value) / 100 })}
                className="h-1.5 flex-1 accent-[#FF6600]" />
              <span className="w-9 text-right font-mono text-[10px] text-gray-500">{Math.round((selected.opacity ?? 1) * 100)}%</span>
            </div>
          </Field>
        </div>
      )}
    </div>
  );
};
