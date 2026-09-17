import React from 'react';
import { Trash2, MessageSquare } from 'lucide-react';
import { usePDF } from '@/context/PDFContext';

export const AnnotationsPanel: React.FC = () => {
  const { annotations, deleteAnnotation, setSelectedAnnotationId, selectedAnnotationId, setCurrentPageIndex } = usePDF();

  if (annotations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center text-gray-400 dark:text-gray-500">
        <MessageSquare className="mb-2 h-8 w-8 text-gray-300 dark:text-gray-600" />
        <p className="text-xs font-bold">No Annotations Yet</p>
        <p className="mt-1 text-[10px]">Added text, stamps, signatures, drawings, and whiteouts will appear here.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 p-3">
      <div className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
        Annotations ({annotations.length})
      </div>

      <div className="flex flex-col gap-2 max-h-[calc(100vh-220px)] overflow-y-auto">
        {annotations.map((ann) => {
          const isSelected = selectedAnnotationId === ann.id;
          return (
            <div
              key={ann.id}
              onClick={() => {
                setSelectedAnnotationId(ann.id);
                setCurrentPageIndex(ann.pageIndex);
              }}
              className={`flex items-start justify-between rounded-lg border p-2.5 cursor-pointer transition-all ${
                isSelected
                  ? 'border-[#FF6600] bg-orange-50/60 dark:bg-orange-950/30'
                  : 'border-gray-200 bg-white hover:border-gray-300 dark:border-gray-800 dark:bg-gray-900'
              }`}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[9px] font-bold uppercase text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                    P.{ann.pageIndex + 1}
                  </span>
                  <span className="text-xs font-bold capitalize text-gray-800 dark:text-gray-200">
                    {ann.type.replace('_', ' ')}
                  </span>
                </div>

                <p className="mt-1 truncate text-xs text-gray-500 dark:text-gray-400">
                  {'text' in ann ? ann.text : 'stampType' in ann ? ann.stampType : 'Added overlay element'}
                </p>
              </div>

              <button
                onClick={(e) => { e.stopPropagation(); deleteAnnotation(ann.id); }}
                className="rounded p-1 text-gray-400 hover:bg-rose-100 hover:text-rose-600 dark:hover:bg-rose-950/50"
                title="Delete Annotation"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
