import React, { useEffect, useRef, useState } from 'react';
import {
  X, Loader2, Upload, FileText, Type, Image as ImageIcon, Eraser, Square, Circle,
  Minus, ArrowUpRight, Highlighter, Underline, Strikethrough, PenTool, StickyNote,
  TextCursorInput, CheckSquare, Signature, Stamp, Undo2, Redo2, ZoomIn, ZoomOut,
  ChevronLeft, ChevronRight, PanelLeft, Moon, Sun, Printer, Download, MousePointer2, Hand,
} from 'lucide-react';
import { PDFProvider, usePDF } from '@/context/PDFContext';
import { SidebarNav } from './SidebarNav';
import { PDFViewer } from './PDFViewer';
import { PropertyListPanel } from './PropertyListPanel';
import { SignatureModal } from './SignatureModal';
import { loadPDFDocument } from '@/utils/pdfHelpers';
import { exportEditedPDF, printPDFBytes } from '@/utils/pdfExporter';
import type { ActiveTool } from '@/types/pdf';

export interface SejdaEditorProps {
  isOpen: boolean;
  onClose: () => void;
  pdfUrl?: string;
  pdfBytes?: Uint8Array;
  fileName?: string;
  userRole?: 'admin' | 'b2b_agent';
}

type GroupItem = { tool: ActiveTool; label: string; icon: React.ComponentType<{ className?: string }>; adminOnly?: boolean };
type ToolGroup = { id: string; label: string; icon: React.ComponentType<{ className?: string }>; items: GroupItem[] };

const GROUPS: ToolGroup[] = [
  {
    id: 'text', label: 'Text', icon: Type,
    items: [
      { tool: 'text', label: 'Add text box', icon: Type },
      { tool: 'whiteout', label: 'Whiteout / erase', icon: Eraser },
    ],
  },
  {
    id: 'shapes', label: 'Shapes', icon: Square,
    items: [
      { tool: 'rectangle', label: 'Rectangle', icon: Square },
      { tool: 'circle', label: 'Ellipse', icon: Circle },
      { tool: 'line', label: 'Line', icon: Minus },
      { tool: 'arrow', label: 'Arrow', icon: ArrowUpRight },
    ],
  },
  {
    id: 'annotate', label: 'Annotate', icon: Highlighter,
    items: [
      { tool: 'highlight', label: 'Highlight', icon: Highlighter },
      { tool: 'underline', label: 'Underline', icon: Underline },
      { tool: 'strikethrough', label: 'Strikeout', icon: Strikethrough },
      { tool: 'pen', label: 'Free draw', icon: PenTool },
      { tool: 'sticky', label: 'Sticky note', icon: StickyNote },
    ],
  },
  {
    id: 'forms', label: 'Forms', icon: TextCursorInput,
    items: [
      { tool: 'form_text', label: 'Text field', icon: TextCursorInput },
      { tool: 'form_checkbox', label: 'Checkbox', icon: CheckSquare },
    ],
  },
];

const EditorShell: React.FC<SejdaEditorProps> = ({ onClose, pdfUrl, pdfBytes: propBytes, fileName = 'document', userRole = 'admin' }) => {
  const {
    setPdfDoc, pdfBytes, setPdfBytes, setIsLoading, setUserRole, userRole: role,
    setAnnotations, setSelectedAnnotationId, selectedAnnotationId, deleteAnnotation, addAnnotation,
    annotations, pagesInfo, pageOrder, setPageOrder, currentPageIndex, setCurrentPageIndex, pageCount,
    zoomScale, setZoomScale, undo, redo, canUndo, canRedo, isDarkMode, setIsDarkMode,
    sidebarOpen, setSidebarOpen, activeTool, setActiveTool, setIsSignatureModalOpen,
  } = usePDF();

  const [saving, setSaving] = useState(false);
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => { setUserRole(userRole); }, [userRole, setUserRole]);

  const loadDoc = async (bytes?: Uint8Array, url?: string) => {
    setIsLoading(true);
    setAnnotations([]);
    setSelectedAnnotationId(null);
    setCurrentPageIndex(0);
    try {
      let toLoad: Uint8Array;
      if (bytes) toLoad = bytes;
      else if (url) {
        const resp = await fetch(url);
        if (!resp.ok) throw new Error(`PDF could not be loaded (${resp.status})`);
        toLoad = new Uint8Array(await resp.arrayBuffer());
      } else {
        setPdfBytes(null); setPdfDoc(null); setPageOrder([]);
        return;
      }
      setPdfBytes(toLoad.slice());
      const doc = await loadPDFDocument(toLoad.slice());
      setPdfDoc(doc);
      setPageOrder(Array.from({ length: doc.numPages }, (_, i) => i));
    } catch (err) {
      console.error('Failed to load PDF into editor:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { void loadDoc(propBytes, pdfUrl); }, [pdfUrl, propBytes]);

  const handleUploadFile = async (file: File) => {
    const buf = await file.arrayBuffer();
    void loadDoc(new Uint8Array(buf));
  };

  const compile = async (): Promise<Uint8Array | null> => {
    if (!pdfBytes) return null;
    return exportEditedPDF({ originalPdfBytes: pdfBytes, annotations, pagesInfo, pageOrder });
  };

  const handleApply = async () => {
    setSaving(true);
    try {
      const bytes = await compile();
      if (!bytes) return;
      const blob = new Blob([bytes as unknown as BlobPart], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${fileName.replace(/\.pdf$/i, '')}-edited.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Apply changes failed:', e);
    } finally {
      setSaving(false);
    }
  };

  const handlePrint = async () => {
    setSaving(true);
    try {
      const bytes = await compile();
      if (bytes) printPDFBytes(bytes);
    } finally {
      setSaving(false);
    }
  };

  const handleInsertImage = async (file: File) => {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    addAnnotation({
      pageIndex: currentPageIndex,
      type: 'signature',
      imageDataUrl: dataUrl,
      x: 30,
      y: 30,
      width: 30,
      height: 15,
    });
    setActiveTool('select');
  };

  // Keyboard: delete selection / whiteout selected PDF text / shortcuts
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.matches('input, textarea, select, [contenteditable="true"]')) return;

      if (event.key === 'Delete' || event.key === 'Backspace') {
        const selection = window.getSelection();
        if (selection && !selection.isCollapsed && selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          const container = range.commonAncestorContainer;
          const pageElement = (container.nodeType === Node.ELEMENT_NODE
            ? (container as Element)
            : container.parentElement)?.closest<HTMLElement>('[data-pdf-page-index]');
          const rect = range.getBoundingClientRect();
          if (pageElement && rect.width > 1 && rect.height > 1) {
            const pageRect = pageElement.getBoundingClientRect();
            event.preventDefault();
            addAnnotation({
              pageIndex: Number(pageElement.dataset.pdfPageIndex || 0),
              type: 'whiteout',
              x: Math.max(0, ((rect.left - pageRect.left) / pageRect.width) * 100),
              y: Math.max(0, ((rect.top - pageRect.top) / pageRect.height) * 100),
              width: Math.min(100, (rect.width / pageRect.width) * 100),
              height: Math.min(100, (rect.height / pageRect.height) * 100),
            });
            selection.removeAllRanges();
            return;
          }
        }
        if (selectedAnnotationId) {
          event.preventDefault();
          deleteAnnotation(selectedAnnotationId);
        }
        return;
      }

      const cmd = event.ctrlKey || event.metaKey;
      if (cmd && event.key.toLowerCase() === 'z') { event.preventDefault(); event.shiftKey ? redo() : undo(); }
      if (cmd && event.key.toLowerCase() === 'y') { event.preventDefault(); redo(); }
      if (cmd && event.key.toLowerCase() === 's') { event.preventDefault(); void handleApply(); }
      if (cmd && event.key.toLowerCase() === 'p') { event.preventDefault(); void handlePrint(); }
      if (cmd && (event.key === '+' || event.key === '=')) { event.preventDefault(); setZoomScale((s) => Math.min(5, s + 0.15)); }
      if (cmd && event.key === '-') { event.preventDefault(); setZoomScale((s) => Math.max(0.25, s - 0.15)); }
      if (event.key === 'Escape') { setSelectedAnnotationId(null); setOpenGroup(null); }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedAnnotationId, deleteAnnotation, addAnnotation, undo, redo, setZoomScale, annotations, pdfBytes]);

  const pick = (tool: ActiveTool) => { setActiveTool(tool); setOpenGroup(null); };

  const groups = GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((i) => !i.adminOnly || role === 'admin'),
  }));

  return (
    <div className={`fixed inset-0 z-50 flex flex-col bg-[#f4f6f8] ${isDarkMode ? 'dark' : ''}`}>
      {/* Title bar */}
      <div className="flex h-12 flex-shrink-0 items-center justify-between border-b border-gray-200 bg-white px-4">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded bg-[#24a865] text-[11px] font-black text-white">PDF</span>
          <span className="text-sm font-bold text-gray-800">Rohi PDF Editor</span>
          <span className="rounded-full bg-[#e8f7ee] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#1d8a53]">
            No watermark · no limits
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setIsDarkMode((d) => !d)} className="rounded p-1.5 text-gray-500 hover:bg-gray-100" title="Toggle dark canvas">
            {isDarkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <button onClick={onClose} className="flex items-center gap-1 rounded bg-gray-100 px-2.5 py-1 text-xs font-bold text-gray-600 hover:bg-rose-500 hover:text-white">
            <X className="h-3.5 w-3.5" /> Close
          </button>
        </div>
      </div>

      {/* Sejda-style tool strip */}
      <div className="flex h-16 flex-shrink-0 items-center gap-1 overflow-x-auto border-b border-gray-200 bg-white px-3">
        <ToolButton active={activeTool === 'select'} label="Select" icon={MousePointer2} onClick={() => pick('select')} />
        <ToolButton active={activeTool === 'hand'} label="Pan" icon={Hand} onClick={() => pick('hand')} />
        <Divider />

        {groups.map((group) => {
          const Icon = group.icon;
          const isActive = group.items.some((i) => i.tool === activeTool);
          return (
            <div key={group.id} className="relative">
              <ToolButton
                active={isActive}
                label={group.label}
                icon={Icon}
                onClick={() => setOpenGroup((prev) => (prev === group.id ? null : group.id))}
              />
              {openGroup === group.id && (
                <div className="absolute left-0 top-full z-50 mt-1 w-52 overflow-hidden rounded-lg border border-gray-200 bg-white py-1 shadow-xl">
                  {group.items.map((item) => {
                    const ItemIcon = item.icon;
                    return (
                      <button
                        key={item.tool}
                        onClick={() => pick(item.tool)}
                        className={`flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-semibold ${
                          activeTool === item.tool ? 'bg-[#e8f7ee] text-[#1d8a53]' : 'text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        <ItemIcon className="h-4 w-4" /> {item.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        <ToolButton label="Images" icon={ImageIcon} onClick={() => imageInputRef.current?.click()} />
        <ToolButton active={activeTool === 'signature'} label="Sign" icon={Signature} onClick={() => { setActiveTool('signature'); setIsSignatureModalOpen(true); setOpenGroup(null); }} />
        <ToolButton active={activeTool === 'stamp'} label="Stamp" icon={Stamp} onClick={() => pick('stamp')} />
        {role === 'admin' && (
          <ToolButton active={activeTool === 'redact'} label="Redact" icon={Eraser} onClick={() => pick('redact')} />
        )}

        <Divider />
        <ToolButton label="Undo" icon={Undo2} disabled={!canUndo} onClick={undo} />
        <ToolButton label="Redo" icon={Redo2} disabled={!canRedo} onClick={redo} />
        <Divider />
        <ToolButton label="Pages" icon={PanelLeft} active={sidebarOpen} onClick={() => setSidebarOpen((o) => !o)} />

        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleInsertImage(f); e.currentTarget.value = ''; }}
        />
      </div>

      {/* Workspace */}
      <div className="relative flex flex-1 overflow-hidden">
        <SidebarNav />
        <PDFViewer />
        <PropertyListPanel />

        {!pdfBytes && (
          <div className="absolute inset-0 z-40 flex items-center justify-center bg-[#f4f6f8] p-6">
            <label className="flex max-w-md cursor-pointer flex-col items-center rounded-xl border-2 border-dashed border-[#24a865]/40 bg-white px-12 py-12 text-center shadow-sm">
              <FileText className="mb-3 h-10 w-10 text-[#24a865]" />
              <span className="text-base font-bold text-gray-900">Choose a PDF to edit</span>
              <span className="mt-1 text-xs text-gray-500">Everything happens in your browser — no upload, no watermark, no page limits.</span>
              <span className="mt-5 inline-flex items-center gap-2 rounded-md bg-[#24a865] px-4 py-2 text-xs font-bold text-white"><Upload className="h-4 w-4" /> Select PDF file</span>
              <input type="file" accept="application/pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleUploadFile(f); }} />
            </label>
          </div>
        )}
      </div>

      {/* Bottom action bar */}
      <div className="flex h-16 flex-shrink-0 items-center justify-between border-t border-gray-200 bg-white px-4">
        <div className="flex items-center gap-1">
          <button onClick={() => setCurrentPageIndex((p) => Math.max(0, p - 1))} disabled={currentPageIndex === 0} className="rounded p-1.5 text-gray-500 hover:bg-gray-100 disabled:opacity-30">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-16 text-center text-xs font-bold text-gray-600">{Math.min(currentPageIndex + 1, pageCount || 1)} / {pageCount || 1}</span>
          <button onClick={() => setCurrentPageIndex((p) => Math.min(pageCount - 1, p + 1))} disabled={currentPageIndex >= pageCount - 1} className="rounded p-1.5 text-gray-500 hover:bg-gray-100 disabled:opacity-30">
            <ChevronRight className="h-4 w-4" />
          </button>
          <Divider />
          <button onClick={() => setZoomScale((s) => Math.max(0.25, s - 0.15))} className="rounded p-1.5 text-gray-500 hover:bg-gray-100"><ZoomOut className="h-4 w-4" /></button>
          <span className="w-12 text-center text-xs font-bold text-gray-600">{Math.round(zoomScale * 100)}%</span>
          <button onClick={() => setZoomScale((s) => Math.min(5, s + 0.15))} className="rounded p-1.5 text-gray-500 hover:bg-gray-100"><ZoomIn className="h-4 w-4" /></button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handlePrint}
            disabled={!pdfBytes}
            className="inline-flex items-center gap-2 rounded-md border border-gray-300 px-4 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-40"
          >
            <Printer className="h-4 w-4" /> Print
          </button>
          <button
            onClick={handleApply}
            disabled={!pdfBytes}
            className="inline-flex items-center gap-2 rounded-md bg-[#24a865] px-6 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-[#1d8a53] disabled:opacity-40"
          >
            <Download className="h-4 w-4" /> Apply changes
          </button>
        </div>
      </div>

      <SignatureModal />

      {saving && (
        <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-black/60 text-white backdrop-blur-xs">
          <Loader2 className="mb-3 h-10 w-10 animate-spin text-[#24a865]" />
          <p className="text-sm font-bold">Applying your changes…</p>
        </div>
      )}
    </div>
  );
};

const Divider: React.FC = () => <div className="mx-1.5 h-8 w-px flex-shrink-0 bg-gray-200" />;

const ToolButton: React.FC<{
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
}> = ({ label, icon: Icon, onClick, active, disabled }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    title={label}
    className={`flex w-16 flex-shrink-0 flex-col items-center gap-1 rounded-md px-1 py-1.5 text-[10px] font-bold transition-colors disabled:opacity-30 ${
      active ? 'bg-[#e8f7ee] text-[#1d8a53]' : 'text-gray-600 hover:bg-gray-100'
    }`}
  >
    <Icon className="h-4.5 w-4.5" />
    <span className="truncate">{label}</span>
  </button>
);

export const SejdaEditor: React.FC<SejdaEditorProps> = (props) => {
  if (!props.isOpen) return null;
  return (
    <PDFProvider initialRole={props.userRole}>
      <EditorShell {...props} />
    </PDFProvider>
  );
};
